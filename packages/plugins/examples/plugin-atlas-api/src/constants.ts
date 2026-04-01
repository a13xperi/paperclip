export const PLUGIN_ID = "plugin-atlas-api";
export const PLUGIN_VERSION = "0.1.0";

export const TOOL_NAMES = {
  trendingScan: "atlas-trending-scan",
  trendingTopics: "atlas-trending-topics",
  draftGenerate: "atlas-draft-generate",
  draftSave: "atlas-draft-save",
  research: "atlas-research",
} as const;

export const DEFAULT_CONFIG = {
  atlasApiUrl: "https://api-production-9bef.up.railway.app",
  atlasApiToken: "",
  atlasApiTokenRef: "",
} as const;
