import type { UIAdapterModule } from "../types";
import {
  parseClaudeApiStdoutLine,
  buildClaudeApiConfig,
} from "@paperclipai/adapter-claude-api/ui";
import { ClaudeApiConfigFields } from "./config-fields";

export const claudeApiUIAdapter: UIAdapterModule = {
  type: "claude_api",
  label: "Claude API (Anthropic)",
  parseStdoutLine: parseClaudeApiStdoutLine,
  ConfigFields: ClaudeApiConfigFields,
  buildAdapterConfig: buildClaudeApiConfig,
};
