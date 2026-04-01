import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult, PaperclipPlugin } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG, TOOL_NAMES } from "./constants.js";

interface AtlasConfig {
  atlasApiUrl?: string;
  atlasApiToken?: string;
  atlasApiTokenRef?: string;
}

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx) {
    // ---------- helpers ----------

    async function getConfig(): Promise<{ apiUrl: string; tokenRef: string }> {
      const cfg = ((await ctx.config.get()) ?? {}) as AtlasConfig;
      return {
        apiUrl: (cfg.atlasApiUrl || DEFAULT_CONFIG.atlasApiUrl).replace(/\/$/, ""),
        tokenRef: cfg.atlasApiTokenRef || DEFAULT_CONFIG.atlasApiTokenRef,
      };
    }

    async function atlasFetch(
      path: string,
      options: { method?: string; body?: unknown } = {},
    ): Promise<{ ok: boolean; status: number; data: unknown }> {
      const { apiUrl, tokenRef } = await getConfig();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Resolve token: prefer secret ref, fall back to direct config token
      let token: string | undefined;
      if (tokenRef) {
        try {
          token = await ctx.secrets.resolve(tokenRef);
        } catch {
          // Secret ref not available, fall back to direct token
        }
      }
      if (!token) {
        const cfg2 = ((await ctx.config.get()) ?? {}) as AtlasConfig;
        token = cfg2.atlasApiToken || undefined;
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await ctx.http.fetch(`${apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 2000) };
      }

      return { ok: response.ok, status: response.status, data };
    }

    // ---------- tools ----------

    // 1. atlas-trending-scan
    ctx.tools.register(
      TOOL_NAMES.trendingScan,
      {
        displayName: "Atlas Trending Scan",
        description:
          "Scans Twitter/X for trending crypto topics. Returns alert entries with sentiment and relevance scores.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (_params, _runCtx): Promise<ToolResult> => {
        const result = await atlasFetch("/api/trending/scan", { method: "POST" });
        if (!result.ok) {
          return { error: `Trending scan failed (${result.status}): ${JSON.stringify(result.data)}` };
        }
        const alerts = (result.data as { alerts?: unknown[] })?.alerts ?? [];
        return {
          content: `Scan complete. Found ${alerts.length} trending items.`,
          data: result.data,
        };
      },
    );

    // 2. atlas-trending-topics
    ctx.tools.register(
      TOOL_NAMES.trendingTopics,
      {
        displayName: "Atlas Trending Topics",
        description:
          "Returns cached trending topics from the last 24h, ordered by relevance.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (_params, _runCtx): Promise<ToolResult> => {
        const result = await atlasFetch("/api/trending/topics");
        if (!result.ok) {
          return { error: `Failed to fetch topics (${result.status}): ${JSON.stringify(result.data)}` };
        }
        const topics = (result.data as { topics?: unknown[] })?.topics ?? [];
        return {
          content: `${topics.length} trending topics available.`,
          data: result.data,
        };
      },
    );

    // 3. atlas-draft-generate
    ctx.tools.register(
      TOOL_NAMES.draftGenerate,
      {
        displayName: "Atlas Draft Generate",
        description:
          "Generates a tweet draft from source content using the user's voice profile with research enrichment.",
        parametersSchema: {
          type: "object",
          properties: {
            sourceContent: { type: "string" },
            sourceType: {
              type: "string",
              enum: ["REPORT", "ARTICLE", "TWEET", "TRENDING_TOPIC", "VOICE_NOTE", "MANUAL"],
            },
            blendId: { type: "string" },
          },
          required: ["sourceContent", "sourceType"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { sourceContent, sourceType, blendId } = params as {
          sourceContent: string;
          sourceType: string;
          blendId?: string;
        };
        const body: Record<string, unknown> = { sourceContent, sourceType };
        if (blendId) body.blendId = blendId;

        const result = await atlasFetch("/api/drafts/generate", { method: "POST", body });
        if (!result.ok) {
          return { error: `Draft generation failed (${result.status}): ${JSON.stringify(result.data)}` };
        }
        const draft = (result.data as { draft?: { content?: string; confidence?: number } })?.draft;
        return {
          content: draft
            ? `Draft generated (confidence: ${draft.confidence ?? "N/A"}): "${draft.content?.slice(0, 280)}"`
            : "Draft generated.",
          data: result.data,
        };
      },
    );

    // 4. atlas-draft-save
    ctx.tools.register(
      TOOL_NAMES.draftSave,
      {
        displayName: "Atlas Draft Save",
        description: "Saves a manually composed tweet draft to the Atlas drafts queue.",
        parametersSchema: {
          type: "object",
          properties: {
            content: { type: "string" },
            sourceType: { type: "string" },
            sourceContent: { type: "string" },
            blendId: { type: "string" },
          },
          required: ["content"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { content, sourceType, sourceContent, blendId } = params as {
          content: string;
          sourceType?: string;
          sourceContent?: string;
          blendId?: string;
        };
        const body: Record<string, unknown> = { content };
        if (sourceType) body.sourceType = sourceType;
        if (sourceContent) body.sourceContent = sourceContent;
        if (blendId) body.blendId = blendId;

        const result = await atlasFetch("/api/drafts", { method: "POST", body });
        if (!result.ok) {
          return { error: `Draft save failed (${result.status}): ${JSON.stringify(result.data)}` };
        }
        const draft = (result.data as { draft?: { id?: string } })?.draft;
        return {
          content: draft?.id ? `Draft saved with ID: ${draft.id}` : "Draft saved.",
          data: result.data,
        };
      },
    );

    // 5. atlas-research
    ctx.tools.register(
      TOOL_NAMES.research,
      {
        displayName: "Atlas Research",
        description:
          "Conducts research analysis on a topic. Returns summary, key facts, sentiment, and sources.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { query } = params as { query: string };
        const result = await atlasFetch("/api/research", { method: "POST", body: { query } });
        if (!result.ok) {
          return { error: `Research failed (${result.status}): ${JSON.stringify(result.data)}` };
        }
        const res = (result.data as { result?: { summary?: string; confidence?: number } })?.result;
        return {
          content: res?.summary
            ? `Research complete (confidence: ${res.confidence ?? "N/A"}): ${res.summary.slice(0, 500)}`
            : "Research complete.",
          data: result.data,
        };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "Atlas API plugin healthy" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
