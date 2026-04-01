import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG, PLUGIN_ID, PLUGIN_VERSION, TOOL_NAMES } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Atlas Content API",
  description:
    "Exposes Atlas content pipeline endpoints (trending scan, draft generation, research) as native Paperclip agent tools.",
  author: "Delphi Digital",
  categories: ["connector", "automation"],
  capabilities: [
    "agent.tools.register",
    "http.outbound",
    "secrets.read-ref",
    "plugin.state.read",
    "plugin.state.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      atlasApiUrl: {
        type: "string",
        title: "Atlas API Base URL",
        description: "Base URL for the Atlas backend API",
        default: DEFAULT_CONFIG.atlasApiUrl,
      },
      atlasApiToken: {
        type: "string",
        title: "Atlas API Token",
        description:
          "Direct JWT token for Atlas API authentication. Use for development; prefer atlasApiTokenRef for production.",
        default: DEFAULT_CONFIG.atlasApiToken,
      },
      atlasApiTokenRef: {
        type: "string",
        title: "Atlas API Token (Secret Ref)",
        description:
          "Paperclip secret reference for the Atlas JWT auth token. Takes precedence over atlasApiToken when set.",
        default: DEFAULT_CONFIG.atlasApiTokenRef,
      },
    },
  },
  tools: [
    {
      name: TOOL_NAMES.trendingScan,
      displayName: "Atlas Trending Scan",
      description:
        "Scans Twitter/X for trending crypto topics via Grok analysis. Creates alert entries and returns trending items with sentiment and relevance scores.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.trendingTopics,
      displayName: "Atlas Trending Topics",
      description:
        "Returns cached trending topics from the last 24 hours, ordered by relevance. Use this for quick lookups without triggering a new scan.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.draftGenerate,
      displayName: "Atlas Draft Generate",
      description:
        "Generates a tweet draft from source content using the user's voice profile. Includes automatic research enrichment for factual grounding.",
      parametersSchema: {
        type: "object",
        properties: {
          sourceContent: {
            type: "string",
            description: "The source material to craft a tweet from (max 10000 chars)",
          },
          sourceType: {
            type: "string",
            enum: ["REPORT", "ARTICLE", "TWEET", "TRENDING_TOPIC", "VOICE_NOTE", "MANUAL"],
            description: "Type of source content",
          },
          blendId: {
            type: "string",
            description: "Optional saved blend ID for voice mixing",
          },
        },
        required: ["sourceContent", "sourceType"],
      },
    },
    {
      name: TOOL_NAMES.draftSave,
      displayName: "Atlas Draft Save",
      description:
        "Saves a manually composed tweet draft to the Atlas drafts queue for review.",
      parametersSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The tweet content to save",
          },
          sourceType: {
            type: "string",
            description: "Type of source (e.g., MANUAL, TRENDING_TOPIC)",
          },
          sourceContent: {
            type: "string",
            description: "Optional original source material",
          },
          blendId: {
            type: "string",
            description: "Optional saved blend ID",
          },
        },
        required: ["content"],
      },
    },
    {
      name: TOOL_NAMES.research,
      displayName: "Atlas Research",
      description:
        "Conducts research analysis on a topic. Returns summary, key facts, sentiment, related topics, and sources with confidence score.",
      parametersSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The research query (max 10000 chars)",
          },
        },
        required: ["query"],
      },
    },
  ],
};

export default manifest;
