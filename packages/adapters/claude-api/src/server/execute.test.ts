import { describe, expect, it, vi } from "vitest";
import type {
  AdapterAgent,
  AdapterExecutionContext,
  AdapterRuntime,
} from "@paperclipai/adapter-utils";
import { execute } from "./execute.js";

/**
 * Regression test for the "empty-prompt root cause" of 297 Life Pilot empty
 * heartbeats (2026-04-09). The claude_api adapter used to fall back to
 * `content: userPrompt || "Continue."` on line 197 of execute.ts, which
 * caused Claude to cheerfully reply "I'm standing by" when Paperclip woke an
 * agent with an empty context snapshot. Paperclip logged a successful run,
 * scheduled the next heartbeat 30 seconds later, and burned API credit in a
 * loop forever. See commit msg on fix/adapters-reject-empty-prompt.
 *
 * The fix replaces the fallback with an explicit early-reject before any
 * network call is made, returning errorCode "empty_prompt". This test
 * verifies exactly that path — crucially, it never needs to mock the
 * Anthropic SDK because the guard fires before the client is invoked.
 */
describe("execute — empty prompt guard", () => {
  function buildCtx(
    overrides: { promptTemplate?: string; context?: Record<string, unknown> } = {},
  ): AdapterExecutionContext {
    const agent: AdapterAgent = {
      id: "agent-test",
      companyId: "company-test",
      name: "Test Agent",
    } as AdapterAgent;
    const runtime: AdapterRuntime = {} as AdapterRuntime;
    // Whitespace-only template is the simplest way to force an empty rendered
    // prompt: asString() treats empty strings as "use the default", but a
    // space is length > 0, so it survives into renderTemplate(), which does no
    // substitution on whitespace, then joinPromptSections() trims to "" and
    // filters the section out — producing an empty userPrompt. The guard
    // should reject this case.
    return {
      runId: "run-test",
      agent,
      runtime,
      config: {
        // Any non-empty apiKey short-circuits resolveApiKey() before we hit
        // process.env, so the guard can be exercised without network setup.
        apiKey: "sk-ant-test-not-real",
        promptTemplate: overrides.promptTemplate ?? "   ",
      },
      context: overrides.context ?? {},
      onLog: vi.fn(async () => {}),
      onMeta: vi.fn(async () => {}),
      onSpawn: vi.fn(async () => {}),
      authToken: undefined,
    };
  }

  it("returns errorCode=empty_prompt when prompt template renders to whitespace", async () => {
    const ctx = buildCtx({ promptTemplate: "   " });
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("empty_prompt");
    expect(result.errorMessage).toMatch(/empty user prompt/i);
    expect(result.provider).toBe("anthropic");
    expect(result.biller).toBe("anthropic");
    expect(result.billingType).toBe("api");
  });

  it("returns errorCode=empty_prompt when template and session handoff are both whitespace", async () => {
    const ctx = buildCtx({
      promptTemplate: "   \n\t\n  ",
      context: { paperclipSessionHandoffMarkdown: "   " },
    });
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("empty_prompt");
  });

  it("returns errorCode=empty_prompt when template references an unresolved variable", async () => {
    // renderTemplate() substitutes {{missing.path}} with an empty string when
    // the path is not in templateData. That is the realistic production
    // failure mode — tickTimers wakes an agent with an empty contextSnapshot
    // so e.g. "{{context.inboxDigest}}" evaluates to "" and the whole prompt
    // collapses.
    const ctx = buildCtx({ promptTemplate: "{{context.inboxDigest}}" });
    const result = await execute(ctx);

    expect(result.errorCode).toBe("empty_prompt");
  });

  it("never calls onMeta or onSpawn when the guard fires", async () => {
    const ctx = buildCtx({ promptTemplate: "   " });
    await execute(ctx);

    expect(ctx.onMeta).not.toHaveBeenCalled();
    expect(ctx.onSpawn).not.toHaveBeenCalled();
  });

  it("does NOT trip the guard when the prompt template has real content", async () => {
    // Sanity check that the guard is not over-eager: a non-empty prompt must
    // NOT short-circuit with errorCode=empty_prompt. Downstream the bogus API
    // key will cause a different failure (claude_auth_required or
    // claude_api_error), which is fine — we only assert the guard itself
    // did not fire.
    const ctx = buildCtx({ promptTemplate: "Do the thing." });
    const result = await execute(ctx);

    expect(result.errorCode).not.toBe("empty_prompt");
  });
});
