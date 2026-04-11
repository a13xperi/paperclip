import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export {
  extractAssistantText,
  extractUsageSummary,
  messageToResultJson,
  isAuthenticationError,
} from "./parse.js";
export { estimateCostUsd } from "./pricing.js";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * claude_api is a stateless adapter — each run is a fresh API call and there
 * is no server-side session to resume. The session codec is kept for parity
 * with the other adapter modules but performs a minimal round-trip so the
 * framework can still surface a human-readable display id (the Anthropic
 * message id) on the agent detail view.
 */
export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const sessionId = asNonEmptyString(record.sessionId) ?? asNonEmptyString(record.session_id);
    if (!sessionId) return null;
    return { sessionId };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const sessionId = asNonEmptyString(params.sessionId) ?? asNonEmptyString(params.session_id);
    if (!sessionId) return null;
    return { sessionId };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    return asNonEmptyString(params.sessionId) ?? asNonEmptyString(params.session_id);
  },
};
