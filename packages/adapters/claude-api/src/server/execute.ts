import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  buildPaperclipEnv,
  joinPromptSections,
  parseObject,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_CLAUDE_MODEL } from "@paperclipai/shared";
import {
  extractAssistantText,
  extractUsageSummary,
  isAuthenticationError,
  messageToResultJson,
} from "./parse.js";
import { estimateCostUsd } from "./pricing.js";

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_PROMPT_TEMPLATE =
  "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.";
const DEFAULT_SYSTEM_PROMPT = "You are a Paperclip agent. Follow the operator's instructions precisely.";

function resolveApiKey(
  configEnv: Record<string, unknown>,
  adapterEnv: Record<string, string>,
  authToken: string | undefined,
  explicitApiKey: string,
): { apiKey: string | null; source: "config" | "env_binding" | "process" | "auth_token" | null } {
  if (explicitApiKey) return { apiKey: explicitApiKey, source: "config" };
  const bindingRaw = configEnv.ANTHROPIC_API_KEY;
  if (typeof bindingRaw === "string" && bindingRaw.trim().length > 0) {
    return { apiKey: bindingRaw.trim(), source: "env_binding" };
  }
  const fromAdapterEnv = adapterEnv.ANTHROPIC_API_KEY;
  if (typeof fromAdapterEnv === "string" && fromAdapterEnv.trim().length > 0) {
    return { apiKey: fromAdapterEnv.trim(), source: "env_binding" };
  }
  const fromProcess = process.env.ANTHROPIC_API_KEY;
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return { apiKey: fromProcess.trim(), source: "process" };
  }
  if (authToken && authToken.startsWith("sk-ant-")) {
    return { apiKey: authToken, source: "auth_token" };
  }
  return { apiKey: null, source: null };
}

async function readInstructionsFile(filePath: string): Promise<string | null> {
  if (!filePath) return null;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const configRecord = parseObject(config);
  const envConfig = parseObject(configRecord.env);
  // adapterConfig.env bindings may be stored either as plain strings or as
  // { type: "plain", value } entries; the server-side secret resolver lifts
  // them into ctx.config.env as plain strings before execute() runs, so we
  // can read strings directly here. Non-string entries are ignored.
  const adapterEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") adapterEnv[key] = value;
  }

  const model = asString(configRecord.model, DEFAULT_CLAUDE_MODEL);
  const explicitApiKey = asString(configRecord.apiKey, "");
  const baseURL = asString(configRecord.baseURL, "");
  const systemPromptConfig = asString(configRecord.systemPrompt, "");
  const promptTemplate = asString(configRecord.promptTemplate, DEFAULT_PROMPT_TEMPLATE);
  const bootstrapPromptTemplate = asString(configRecord.bootstrapPromptTemplate, "");
  const instructionsFilePath = asString(configRecord.instructionsFilePath, "").trim();
  const maxTokens = Math.max(1, Math.floor(asNumber(configRecord.maxTokens, DEFAULT_MAX_TOKENS)));
  const temperature = asNumber(configRecord.temperature, Number.NaN);

  const paperclipEnv = buildPaperclipEnv(agent);
  paperclipEnv.PAPERCLIP_RUN_ID = runId;

  const { apiKey, source: apiKeySource } = resolveApiKey(envConfig, adapterEnv, authToken, explicitApiKey);
  if (!apiKey) {
    const message =
      "claude_api adapter requires an Anthropic API key. Set adapterConfig.apiKey, bind ANTHROPIC_API_KEY via env, or export ANTHROPIC_API_KEY in the server environment.";
    await onLog("stderr", `${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: message,
      errorCode: "claude_auth_required",
      provider: "anthropic",
      biller: "anthropic",
      billingType: "api",
      model,
    };
  }

  const fileInstructions = await readInstructionsFile(instructionsFilePath);
  if (instructionsFilePath && fileInstructions === null) {
    await onLog(
      "stderr",
      `[paperclip] Warning: could not read instructions file "${instructionsFilePath}". Continuing without it.\n`,
    );
  }
  const systemPromptSections = [
    systemPromptConfig || DEFAULT_SYSTEM_PROMPT,
    fileInstructions ?? "",
  ];
  const systemPrompt = joinPromptSections(systemPromptSections);

  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrap =
    bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const userPrompt = joinPromptSections([renderedBootstrap, sessionHandoffNote, renderedPrompt]);

  // Empty-prompt guard. When tickTimers wakes an agent and the context snapshot
  // is empty (no inbox digest, no pending issue, no handoff) the prompt template
  // can render to an empty string. Previously we fell back to sending "Continue."
  // which caused Claude to respond "I'm standing by", Paperclip to log a success,
  // and the heartbeat scheduler to requeue forever — the single line "Continue."
  // fallback was the root cause of 297 Life Pilot empty heartbeats on 2026-04-09.
  // Refuse to spend tokens on empty context; let the heartbeat report a failure
  // so the operator can investigate.
  if (userPrompt.trim().length === 0) {
    const message = "Refusing to invoke model with empty user prompt";
    await onLog("stderr", `[paperclip] ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: message,
      errorCode: "empty_prompt",
      provider: "anthropic",
      biller: "anthropic",
      billingType: "api",
      model,
    };
  }

  const promptMetrics = {
    promptChars: userPrompt.length,
    bootstrapPromptChars: renderedBootstrap.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
    systemPromptChars: systemPrompt.length,
  };

  const commandArgs: string[] = [
    "--model",
    model,
    "--max-tokens",
    String(maxTokens),
  ];
  if (Number.isFinite(temperature)) {
    commandArgs.push("--temperature", String(temperature));
  }

  const loggedEnv: Record<string, string> = {
    ANTHROPIC_API_KEY: "***REDACTED***",
  };
  if (baseURL) loggedEnv.ANTHROPIC_BASE_URL = baseURL;
  loggedEnv.PAPERCLIP_API_KEY_SOURCE = apiKeySource ?? "unknown";

  if (onMeta) {
    await onMeta({
      adapterType: "claude_api",
      command: "anthropic.messages.create",
      commandArgs,
      commandNotes: [
        `In-process Anthropic SDK call (model=${model}, maxTokens=${maxTokens})`,
      ],
      env: loggedEnv,
      prompt: userPrompt,
      promptMetrics,
      context,
    });
  }

  const startedAt = new Date().toISOString();
  if (onSpawn) {
    await onSpawn({ pid: process.pid, startedAt });
  }

  const client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  try {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(Number.isFinite(temperature) ? { temperature } : {}),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const summary = extractAssistantText(message);
    const usage = extractUsageSummary(message);
    const resultJson = messageToResultJson(message);
    const costUsd = estimateCostUsd(asString(message.model, model), usage);

    await onLog(
      "stdout",
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: asString(message.model, model),
        session_id: asString(message.id, ""),
      }) + "\n",
    );
    await onLog(
      "stdout",
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: summary }],
        },
        session_id: asString(message.id, ""),
      }) + "\n",
    );
    await onLog(
      "stdout",
      JSON.stringify({
        type: "result",
        subtype: asString(message.stop_reason, ""),
        session_id: asString(message.id, ""),
        result: summary,
        usage: {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cache_read_input_tokens: usage.cachedInputTokens ?? 0,
        },
        total_cost_usd: costUsd ?? 0,
      }) + "\n",
    );

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      errorMessage: null,
      errorCode: null,
      usage,
      sessionId: asString(message.id, "") || null,
      sessionParams: null,
      sessionDisplayId: asString(message.id, "") || null,
      provider: "anthropic",
      biller: "anthropic",
      model: asString(message.model, model),
      billingType: "api",
      costUsd: costUsd ?? null,
      resultJson,
      summary,
      clearSession: true,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const authFailure = isAuthenticationError(err);
    await onLog("stderr", `[paperclip] claude_api call failed: ${reason}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: reason,
      errorCode: authFailure ? "claude_auth_required" : "claude_api_error",
      provider: "anthropic",
      biller: "anthropic",
      billingType: "api",
      model,
      clearSession: true,
    };
  }
}
