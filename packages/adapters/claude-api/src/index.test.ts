import { describe, expect, it } from "vitest";
import { pickDefaultClaudeModel, defaultModel } from "./index.js";

describe("pickDefaultClaudeModel", () => {
  it("routes monitoring/bug-sync roles to haiku", () => {
    expect(pickDefaultClaudeModel({ role: "engineer", title: "Bug Sync Watcher" })).toBe(
      "claude-haiku-4-5-20251001",
    );
    expect(pickDefaultClaudeModel({ capabilities: "monitoring and health checks" })).toBe(
      "claude-haiku-4-5-20251001",
    );
  });

  it("routes research/planning/analysis roles to opus", () => {
    expect(pickDefaultClaudeModel({ role: "researcher", name: "complex analysis bot" })).toBe(
      "claude-opus-4-6",
    );
    expect(pickDefaultClaudeModel({ title: "Chief Strategist" })).toBe("claude-opus-4-6");
  });

  it("routes content/writing/engineering roles to sonnet", () => {
    expect(pickDefaultClaudeModel({ role: "engineer" })).toBe("claude-sonnet-4-6");
    expect(pickDefaultClaudeModel({ title: "Content Marketing Editor" })).toBe(
      "claude-sonnet-4-6",
    );
  });

  it("falls back to the shared default when nothing matches", () => {
    expect(pickDefaultClaudeModel({})).toBe(defaultModel);
    expect(pickDefaultClaudeModel({ role: "ceo" })).toBe(defaultModel);
  });
});
