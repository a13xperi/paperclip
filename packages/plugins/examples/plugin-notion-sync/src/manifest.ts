import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG, JOB_KEYS, PLUGIN_ID, PLUGIN_VERSION } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Notion Ticket Sync",
  description:
    "Syncs Paperclip issue events (created, updated) to a Notion Session Artifacts database for cross-platform visibility.",
  author: "Delphi Digital",
  categories: ["connector", "automation"],
  capabilities: [
    "events.subscribe",
    "http.outbound",
    "secrets.read-ref",
    "plugin.state.read",
    "plugin.state.write",
    "issues.read",
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
      notionTokenRef: {
        type: "string",
        title: "Notion API Token (Secret Ref)",
        description:
          "Paperclip secret reference for the Notion internal integration token.",
        default: DEFAULT_CONFIG.notionTokenRef,
      },
      notionToken: {
        type: "string",
        title: "Notion API Token (Direct)",
        description:
          "Direct Notion API token. Use this if you don't have a Paperclip secret configured. The secret ref is preferred when available.",
      },
      notionDatabaseId: {
        type: "string",
        title: "Notion Database ID",
        description:
          "UUID of the Notion Session Artifacts database (without dashes).",
        default: DEFAULT_CONFIG.notionDatabaseId,
      },
      paperclipBaseUrl: {
        type: "string",
        title: "Paperclip Base URL",
        description:
          "Public URL of this Paperclip instance, used to construct issue links.",
        default: DEFAULT_CONFIG.paperclipBaseUrl,
      },
      companyDomainMap: {
        type: "string",
        title: "Company → Domain Mapping",
        description:
          'JSON object mapping company issuePrefix to Notion Domain select value. Example: {"DEL":"📊 Delphi","KAA":"🌿 KAA"}',
        default: DEFAULT_CONFIG.companyDomainMap,
      },
    },
  },
  jobs: [
    {
      jobKey: JOB_KEYS.reconcile,
      displayName: "Notion Reconciliation",
      description:
        "Scans all Paperclip issues and ensures each has a corresponding Notion page. Recovers lost state mappings.",
      schedule: "0 */6 * * *",
    },
  ],
};

export default manifest;
