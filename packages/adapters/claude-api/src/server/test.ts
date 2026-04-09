import Anthropic from "@anthropic-ai/sdk";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from "@paperclipai/shared";
import { isAuthenticationError } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const envConfig = parseObject(config.env);

  const model = asString(config.model, DEFAULT_CLAUDE_MODEL);
  if (!(CLAUDE_MODELS as readonly string[]).includes(model)) {
    checks.push({
      code: "claude_api_unknown_model",
      level: "warn",
      message: `Model "${model}" is not in the known Paperclip model list.`,
      hint: `Known models: ${CLAUDE_MODELS.join(", ")}. The adapter will still forward unknown ids to Anthropic verbatim.`,
    });
  } else {
    checks.push({
      code: "claude_api_model_known",
      level: "info",
      message: `Model "${model}" is supported.`,
    });
  }

  const explicitApiKey = asString(config.apiKey, "");
  const envBindingKey =
    typeof envConfig.ANTHROPIC_API_KEY === "string" ? envConfig.ANTHROPIC_API_KEY.trim() : "";
  const processKey = typeof process.env.ANTHROPIC_API_KEY === "string" ? process.env.ANTHROPIC_API_KEY.trim() : "";
  const apiKey = explicitApiKey || envBindingKey || processKey;

  if (!apiKey) {
    checks.push({
      code: "claude_api_missing_api_key",
      level: "error",
      message: "No Anthropic API key configured.",
      hint: "Set adapterConfig.apiKey, bind ANTHROPIC_API_KEY in adapter env, or export ANTHROPIC_API_KEY on the server.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "claude_api_api_key_present",
    level: "info",
    message: "Anthropic API key is configured.",
    detail: explicitApiKey
      ? "Source: adapter config (apiKey)"
      : envBindingKey
        ? "Source: adapter config env binding"
        : "Source: server process env",
  });

  const baseURL = asString(config.baseURL, "");
  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Respond with the single word hello." }],
    });
    const firstBlock = Array.isArray(response.content)
      ? response.content.find((block) => block?.type === "text")
      : null;
    const text =
      firstBlock && typeof (firstBlock as { text?: unknown }).text === "string"
        ? ((firstBlock as { text: string }).text).trim()
        : "";
    const hasHello = /\bhello\b/i.test(text);
    checks.push({
      code: hasHello ? "claude_api_hello_probe_passed" : "claude_api_hello_probe_unexpected_output",
      level: hasHello ? "info" : "warn",
      message: hasHello ? "Anthropic hello probe succeeded." : "Anthropic probe ran but did not return `hello`.",
      ...(text ? { detail: text.slice(0, 240) } : {}),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const authFail = isAuthenticationError(err);
    checks.push({
      code: authFail ? "claude_api_authentication_failed" : "claude_api_probe_failed",
      level: "error",
      message: authFail ? "Anthropic API rejected the credentials." : "Anthropic API probe failed.",
      detail: reason.slice(0, 240),
      hint: authFail
        ? "Verify the key at https://console.anthropic.com/ and re-save it as a Paperclip secret."
        : "Retry the probe. If the failure persists, check network egress and Anthropic status.",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
