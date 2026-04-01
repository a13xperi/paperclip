import type { IssueStatus } from "@paperclipai/shared";

export const PLUGIN_ID = "plugin-notion-sync";
export const PLUGIN_VERSION = "0.1.0";

export const JOB_KEYS = {
  reconcile: "notion-reconcile",
} as const;

export const DEFAULT_CONFIG = {
  notionTokenRef: "",
  notionDatabaseId: "35a406fb22f3401f992f216c1a8bdb1c",
  paperclipBaseUrl: "https://paperclip-server-production-24ad.up.railway.app",
  companyDomainMap: JSON.stringify({
    DEL: "📊 Delphi",
    KAA: "🌿 KAA",
    FP: "🏗️ SAGE Infrastructure",
    SAG: "🏗️ SAGE Infrastructure",
  }),
} as const;

export const STATUS_MAP: Record<IssueStatus, string> = {
  backlog: "Open Thread",
  todo: "Open Thread",
  in_progress: "In Progress",
  in_review: "In Progress",
  done: "Complete",
  blocked: "Needs Cleanup",
  cancelled: "Needs Cleanup",
};

export const ACTION_FOR_EVENT: Record<string, string> = {
  "issue.created": "Created",
  "issue.updated": "Updated",
};
