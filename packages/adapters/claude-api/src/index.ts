import { CLAUDE_MODELS, CLAUDE_MODEL_LABELS, DEFAULT_CLAUDE_MODEL, type ClaudeModel } from "@paperclipai/shared";

export const type = "claude_api";
export const label = "Claude API (Anthropic SDK)";

export const models = CLAUDE_MODELS.map((id) => ({
  id,
  label: CLAUDE_MODEL_LABELS[id],
}));

export const defaultModel: ClaudeModel = DEFAULT_CLAUDE_MODEL;

/**
 * Keyword-based default model picker used when an agent's adapter config does
 * not pin a specific model. Paperclip agents are not typed into "bug_sync" or
 * "content_creation" directly; instead we look at role/title/capabilities for
 * well-known keywords and route to the appropriate tier.
 *
 * Tier mapping:
 *   - bug sync, monitoring, health checks -> Haiku  (cheap, fast, latency-sensitive)
 *   - content creation, writing, drafting -> Sonnet (balanced)
 *   - complex analysis, research, planning -> Opus  (deep reasoning)
 */
export function pickDefaultClaudeModel(
  hints: {
    role?: string | null;
    title?: string | null;
    capabilities?: string | null;
    name?: string | null;
  },
): ClaudeModel {
  const blob = [hints.role, hints.title, hints.capabilities, hints.name]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  if (!blob) return DEFAULT_CLAUDE_MODEL;

  const haikuKeywords = [
    "bug sync",
    "bugsync",
    "monitor",
    "monitoring",
    "watcher",
    "health check",
    "status",
    "ping",
    "heartbeat check",
    "smoke test",
    "linter",
  ];
  const opusKeywords = [
    "complex analysis",
    "deep analysis",
    "research",
    "researcher",
    "architect",
    "strategy",
    "strategist",
    "planner",
    "planning",
    "reasoning",
    "audit",
    "whitepaper",
  ];
  const sonnetKeywords = [
    "content",
    "writer",
    "writing",
    "editor",
    "copy",
    "draft",
    "marketing",
    "pm",
    "product manager",
    "designer",
    "engineer",
    "developer",
    "support",
  ];

  if (haikuKeywords.some((keyword) => blob.includes(keyword))) {
    return "claude-haiku-4-5-20251001";
  }
  if (opusKeywords.some((keyword) => blob.includes(keyword))) {
    return "claude-opus-4-6";
  }
  if (sonnetKeywords.some((keyword) => blob.includes(keyword))) {
    return "claude-sonnet-4-6";
  }
  return DEFAULT_CLAUDE_MODEL;
}

export const agentConfigurationDoc = `# claude_api agent configuration

Adapter: claude_api

This adapter calls the Anthropic REST API directly via @anthropic-ai/sdk. It
does not spawn the \`claude\` CLI — each heartbeat is a single stateless
\`messages.create\` call. Use this when you want per-run isolation, predictable
cost, and do not need Claude Code's local filesystem tools or skill loading.

Core fields:
- model (string, optional): Claude model id. Defaults to "${DEFAULT_CLAUDE_MODEL}".
  Supported ids: ${CLAUDE_MODELS.join(", ")}
- apiKey (string, optional): Anthropic API key. When omitted, the adapter reads
  ANTHROPIC_API_KEY from the agent env binding or the server process env.
- baseURL (string, optional): override Anthropic API base URL (for proxies /
  local gateways).
- systemPrompt (string, optional): static system prompt. Merged with
  \`instructionsFilePath\` content and any bootstrap prompt.
- instructionsFilePath (string, optional): absolute path to a markdown
  instructions file whose contents are appended to the system prompt on every
  run.
- promptTemplate (string, optional): user-turn template rendered for each run.
  Supports {{ agent.* }}, {{ run.* }}, {{ context.* }} variables. When empty,
  a minimal default is used.
- maxTokens (number, optional): max output tokens per response. Defaults to 4096.
- temperature (number, optional): sampling temperature (0-1).
- env (object, optional): KEY=VALUE env bindings. ANTHROPIC_API_KEY is the
  canonical key when you want to pass the key via a secret ref.

Billing: this adapter always reports billingType="api" and provider="anthropic".

Notes:
- No session resume: each run is stateless. Paperclip heartbeat compaction does
  not rotate sessions for this adapter.
- No local filesystem skills. Use claude_local if you need skills or tools.
`;
