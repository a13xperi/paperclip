import type { UsageSummary } from "@paperclipai/adapter-utils";

/**
 * Per-million-token USD pricing for the Claude models we expose via
 * adapterConfig.model. Values track Anthropic's published list pricing at
 * the time of writing. Used for informational `costUsd` on execution
 * results. Finance/ledger should still reconcile against the canonical
 * billing source.
 */
interface ModelPrice {
  /** $ per 1M input tokens (cache miss) */
  inputPerMTok: number;
  /** $ per 1M output tokens */
  outputPerMTok: number;
  /** $ per 1M input tokens that were served from cache */
  cachedInputPerMTok: number;
}

const PRICE_TABLE: Record<string, ModelPrice> = {
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cachedInputPerMTok: 0.1,
  },
  "claude-sonnet-4-6": {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cachedInputPerMTok: 0.3,
  },
  "claude-opus-4-6": {
    inputPerMTok: 15.0,
    outputPerMTok: 75.0,
    cachedInputPerMTok: 1.5,
  },
};

export function estimateCostUsd(model: string, usage: UsageSummary): number | null {
  const price = PRICE_TABLE[model];
  if (!price) return null;
  const inputTokens = Math.max(0, usage.inputTokens ?? 0);
  const cachedInputTokens = Math.max(0, usage.cachedInputTokens ?? 0);
  const outputTokens = Math.max(0, usage.outputTokens ?? 0);
  // Anthropic reports cache_read_input_tokens separately from input_tokens,
  // so we do not subtract; both are counted at their respective rates.
  const cost =
    (inputTokens / 1_000_000) * price.inputPerMTok +
    (cachedInputTokens / 1_000_000) * price.cachedInputPerMTok +
    (outputTokens / 1_000_000) * price.outputPerMTok;
  return Number.isFinite(cost) ? cost : null;
}
