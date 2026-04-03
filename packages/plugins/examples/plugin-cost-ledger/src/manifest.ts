import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG, JOB_KEYS, PLUGIN_ID, PLUGIN_VERSION } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Cost Ledger Sync",
  description:
    "Syncs Paperclip agent cost events to Supabase ai_capacity_ledger for unified capacity tracking across all AI compute.",
  author: "Delphi Digital",
  categories: ["connector", "automation"],
  capabilities: [
    "events.subscribe",
    "http.outbound",
    "secrets.read-ref",
    "plugin.state.read",
    "plugin.state.write",
    "companies.read",
    "activity.log.write",
    "jobs.schedule",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      supabaseUrl: {
        type: "string",
        title: "Supabase Project URL",
        description: "Full Supabase project URL (e.g. https://xxxx.supabase.co).",
        default: DEFAULT_CONFIG.supabaseUrl,
      },
      supabaseKeyRef: {
        type: "string",
        title: "Supabase Key (Secret Ref)",
        description: "Paperclip secret reference for the Supabase anon/service key.",
        default: DEFAULT_CONFIG.supabaseKeyRef,
      },
      supabaseKey: {
        type: "string",
        title: "Supabase Key (Direct)",
        description:
          "Direct Supabase key. Use if no Paperclip secret configured. Secret ref is preferred.",
      },
      projectId: {
        type: "string",
        title: "Supabase Project ID",
        description: "Supabase project ID for reference in logs.",
        default: DEFAULT_CONFIG.projectId,
      },
      account: {
        type: "string",
        title: "Account Label",
        description: "Account label for capacity ledger (e.g. A or B).",
        default: DEFAULT_CONFIG.account,
      },
    },
  },
  jobs: [
    {
      jobKey: JOB_KEYS.reconcile,
      displayName: "Cost Reconciliation",
      description:
        "Scans recent Paperclip cost events and ensures each has a corresponding Supabase ledger entry. Recovers missed syncs.",
      schedule: "0 */6 * * *",
    },
  ],
};

export default manifest;
