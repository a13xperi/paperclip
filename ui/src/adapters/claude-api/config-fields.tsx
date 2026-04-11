import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  DraftNumberInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) whose contents are appended to the system prompt on every run.";

const maxTokensHint =
  "Upper bound on output tokens per API call (default 4096).";

const temperatureHint =
  "Sampling temperature between 0 and 1. Leave blank for Anthropic default.";

/**
 * Config fields for the claude_api adapter. Kept intentionally lean:
 * no cwd, no workspace runtime, no skills — the adapter is a stateless
 * Anthropic API call. The model dropdown itself is rendered centrally by
 * AgentConfigForm, so this component only surfaces the claude_api-specific
 * knobs (instructions file, maxTokens, temperature).
 *
 * maxTokens and temperature are only surfaced in edit mode because
 * CreateConfigValues does not carry them; the adapter defaults (4096,
 * provider default) are fine at creation time and the user can tune them
 * after the agent exists.
 */
export function ClaudeApiConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  return (
    <>
      {!hideInstructionsFile && (
        <Field label="Agent instructions file" hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? values!.instructionsFilePath ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark("adapterConfig", "instructionsFilePath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}
      {!isCreate && (
        <>
          <Field label="Max output tokens" hint={maxTokensHint}>
            <DraftNumberInput
              value={eff(
                "adapterConfig",
                "maxTokens",
                Number(config.maxTokens ?? 4096),
              )}
              onCommit={(v) => mark("adapterConfig", "maxTokens", v || 4096)}
              immediate
              className={inputClass}
            />
          </Field>
          <Field label="Temperature" hint={temperatureHint}>
            <DraftInput
              value={eff(
                "adapterConfig",
                "temperature",
                String(config.temperature ?? ""),
              )}
              onCommit={(v) => {
                const trimmed = v.trim();
                if (!trimmed) {
                  mark("adapterConfig", "temperature", undefined);
                  return;
                }
                const parsed = Number(trimmed);
                mark(
                  "adapterConfig",
                  "temperature",
                  Number.isFinite(parsed) ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="default"
            />
          </Field>
        </>
      )}
    </>
  );
}
