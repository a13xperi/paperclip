import pc from "picocolors";

/**
 * The claude_api adapter emits JSON log lines modelled after the
 * claude_local stream-json format (system/init, assistant, result). The CLI
 * printer here mirrors the subset we emit so paperclipai tail views render
 * claude_api runs consistently with claude_local runs.
 */
export function printClaudeApiStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";
  if (type === "system" && parsed.subtype === "init") {
    const model = typeof parsed.model === "string" ? parsed.model : "?";
    console.log(pc.gray(`init model=${model}`));
    return;
  }

  if (type === "assistant") {
    const message =
      parsed.message && typeof parsed.message === "object" && !Array.isArray(parsed.message)
        ? (parsed.message as { content?: unknown })
        : null;
    const content = message && Array.isArray(message.content) ? message.content : [];
    for (const blockRaw of content) {
      if (!blockRaw || typeof blockRaw !== "object") continue;
      const block = blockRaw as Record<string, unknown>;
      if (block.type === "text" && typeof block.text === "string" && block.text) {
        console.log(pc.cyan(block.text));
      }
    }
    return;
  }

  if (type === "result") {
    const summary = typeof parsed.result === "string" ? parsed.result : "";
    const isError = parsed.is_error === true;
    console.log((isError ? pc.red : pc.green)("result"));
    if (summary) console.log(isError ? pc.red(summary) : pc.gray(summary));
    return;
  }

  if (debug) console.log(line);
}
