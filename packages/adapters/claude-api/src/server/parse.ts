import type { UsageSummary } from "@paperclipai/adapter-utils";

/**
 * Shape of the content block array returned by @anthropic-ai/sdk
 * Messages.create. Kept structural so we don't depend on the SDK's
 * generated types at parse time.
 */
type ContentBlockLike =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking?: string; text?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [key: string]: unknown };

interface UsageLike {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
}

interface MessageLike {
  id?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  content?: ContentBlockLike[] | unknown;
  usage?: UsageLike | unknown;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function extractAssistantText(message: MessageLike): string {
  const content = Array.isArray(message.content) ? message.content : [];
  const parts: string[] = [];
  for (const blockRaw of content) {
    if (!blockRaw || typeof blockRaw !== "object") continue;
    const block = blockRaw as ContentBlockLike;
    if (block.type === "text" && typeof (block as { text?: unknown }).text === "string") {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join("\n\n").trim();
}

export function extractUsageSummary(message: MessageLike): UsageSummary {
  const usageRaw = (message.usage ?? {}) as UsageLike;
  return {
    inputTokens: asNumber(usageRaw.input_tokens, 0),
    cachedInputTokens: asNumber(usageRaw.cache_read_input_tokens, 0),
    outputTokens: asNumber(usageRaw.output_tokens, 0),
  };
}

export function messageToResultJson(message: MessageLike): Record<string, unknown> {
  return {
    id: asString(message.id, ""),
    model: asString(message.model, ""),
    stop_reason: asString(message.stop_reason, ""),
    content: Array.isArray(message.content) ? message.content : [],
    usage: (message.usage ?? {}) as Record<string, unknown>,
  };
}

/**
 * Detect auth-failure error shapes from the Anthropic SDK.
 * The SDK throws typed errors (AuthenticationError, APIError) but we
 * accept anything with a status 401 / 403 or an "authentication" code.
 */
export function isAuthenticationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { status?: unknown; code?: unknown; error?: { type?: unknown } };
  if (rec.status === 401 || rec.status === 403) return true;
  const code = typeof rec.code === "string" ? rec.code.toLowerCase() : "";
  if (code.includes("authentication") || code.includes("unauthorized")) return true;
  const innerType = rec.error && typeof rec.error === "object" && rec.error !== null
    ? (rec.error as { type?: unknown }).type
    : undefined;
  if (typeof innerType === "string" && innerType.toLowerCase().includes("authentication")) {
    return true;
  }
  return false;
}
