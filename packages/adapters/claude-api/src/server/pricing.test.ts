import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.js";

describe("estimateCostUsd", () => {
  it("returns null for unknown models", () => {
    expect(
      estimateCostUsd("claude-unknown-model", {
        inputTokens: 1_000_000,
        outputTokens: 0,
      }),
    ).toBeNull();
  });

  it("computes the price for a known haiku model", () => {
    const cost = estimateCostUsd("claude-haiku-4-5-20251001", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 0,
    });
    expect(cost).toBeCloseTo(1.0 + 5.0, 5);
  });

  it("includes cached input tokens at the reduced rate", () => {
    const cost = estimateCostUsd("claude-sonnet-4-6", {
      inputTokens: 500_000,
      outputTokens: 0,
      cachedInputTokens: 1_000_000,
    });
    // 0.5 * 3 + 1.0 * 0.3 = 1.8
    expect(cost).toBeCloseTo(1.8, 5);
  });
});
