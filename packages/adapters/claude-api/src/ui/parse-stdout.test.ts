import { describe, expect, it } from "vitest";
import { parseClaudeApiStdoutLine } from "./parse-stdout.js";

const TS = "2026-04-10T12:00:00.000Z";

describe("parseClaudeApiStdoutLine", () => {
  it("parses init events into transcript init entries", () => {
    const entries = parseClaudeApiStdoutLine(
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: "claude-sonnet-4-6",
        session_id: "msg_123",
      }),
      TS,
    );
    expect(entries).toEqual([
      { kind: "init", ts: TS, model: "claude-sonnet-4-6", sessionId: "msg_123" },
    ]);
  });

  it("parses assistant text content blocks", () => {
    const entries = parseClaudeApiStdoutLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "hello world" }] },
      }),
      TS,
    );
    expect(entries).toEqual([{ kind: "assistant", ts: TS, text: "hello world" }]);
  });

  it("parses result events with usage and cost", () => {
    const entries = parseClaudeApiStdoutLine(
      JSON.stringify({
        type: "result",
        subtype: "end_turn",
        result: "done",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 20,
        },
        total_cost_usd: 0.002,
      }),
      TS,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "result",
      ts: TS,
      text: "done",
      inputTokens: 100,
      outputTokens: 50,
      cachedTokens: 20,
      costUsd: 0.002,
      subtype: "end_turn",
      isError: false,
    });
  });

  it("falls back to stdout for unknown lines", () => {
    const entries = parseClaudeApiStdoutLine("not json", TS);
    expect(entries).toEqual([{ kind: "stdout", ts: TS, text: "not json" }]);
  });
});
