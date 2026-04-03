export const PLUGIN_ID = "plugin-cost-ledger";
export const PLUGIN_VERSION = "0.1.0";

export const JOB_KEYS = {
  reconcile: "cost-reconcile",
} as const;

export const DEFAULT_CONFIG = {
  supabaseUrl: "https://zoirudjyqfqvpxsrxepr.supabase.co",
  supabaseKeyRef: "",
  projectId: "zoirudjyqfqvpxsrxepr",
  account: "A",
} as const;

/** Map Paperclip adapter types to ai_capacity_ledger platform values */
export const ADAPTER_TO_PLATFORM: Record<string, string> = {
  "claude-local": "claude",
  "codex-local": "codex",
  "gemini-local": "gemini",
  "opencode-local": "openai_api",
  "pi-local": "openai_api",
  "openclaw-gateway": "claude",
  "cursor-local": "openai_api",
};

/** Map Paperclip run triggers to ai_capacity_ledger session types */
export const TRIGGER_TO_SESSION_TYPE: Record<string, string> = {
  heartbeat: "scheduled",
  manual: "interactive",
  routine: "scheduled",
  api: "api",
};
