import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { Issue, IssueStatus } from "@paperclipai/shared";
import { STATUS_MAP, ACTION_FOR_EVENT } from "./constants.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionConfig {
  notionTokenRef: string;
  notionToken?: string;
  notionDatabaseId: string;
  paperclipBaseUrl: string;
  companyDomainMap: string;
}

interface NotionPage {
  id: string;
  url: string;
}

interface NotionQueryResult {
  results: NotionPage[];
  has_more: boolean;
}

type NotionProperty =
  | { title: { text: { content: string } }[] }
  | { rich_text: { text: { content: string } }[] }
  | { status: { name: string } }
  | { select: { name: string } }
  | { url: string }
  | { number: number };

// ---------------------------------------------------------------------------
// Property builders
// ---------------------------------------------------------------------------

function title(content: string): NotionProperty {
  return { title: [{ text: { content } }] };
}

function richText(content: string): NotionProperty {
  return { rich_text: [{ text: { content } }] };
}

function status(name: string): NotionProperty {
  return { status: { name } };
}

function select(name: string): NotionProperty {
  return { select: { name } };
}

function url(value: string): NotionProperty {
  return { url: value };
}

// ---------------------------------------------------------------------------
// Build Notion properties from an issue
// ---------------------------------------------------------------------------

export function buildCreateProperties(opts: {
  issue: Issue;
  notionStatus: string;
  action: string;
  domain: string | null;
  issueUrl: string;
}): Record<string, NotionProperty> {
  const props: Record<string, NotionProperty> = {
    Artifact: title(
      opts.issue.identifier
        ? `${opts.issue.identifier}: ${opts.issue.title}`
        : opts.issue.title,
    ),
    Status: status(opts.notionStatus),
    Action: select(opts.action),
    Notes: richText(opts.issue.description?.slice(0, 2000) ?? ""),
    Link: url(opts.issueUrl),
    Session: richText("Paperclip Auto-Sync"),
  };
  if (opts.domain) {
    props.Domain = select(opts.domain);
  }
  return props;
}

export function buildUpdateProperties(opts: {
  notionStatus: string;
  action: string;
  description?: string | null;
}): Record<string, NotionProperty> {
  const props: Record<string, NotionProperty> = {
    Status: status(opts.notionStatus),
    Action: select(opts.action),
  };
  if (opts.description != null) {
    props.Notes = richText(opts.description.slice(0, 2000));
  }
  return props;
}

// ---------------------------------------------------------------------------
// Notion API client factory
// ---------------------------------------------------------------------------

export function createNotionClient(ctx: PluginContext) {
  let resolvedToken: string | null = null;

  async function getToken(config: NotionConfig): Promise<string> {
    if (resolvedToken) return resolvedToken;
    // Try secret ref first, then fall back to direct token
    if (config.notionTokenRef) {
      try {
        resolvedToken = await ctx.secrets.resolve(config.notionTokenRef);
        return resolvedToken;
      } catch {
        // Secret ref resolution failed — try direct token
      }
    }
    if (config.notionToken) {
      resolvedToken = config.notionToken;
      return resolvedToken;
    }
    throw new Error("Neither notionTokenRef nor notionToken is configured");
  }

  function clearTokenCache() {
    resolvedToken = null;
  }

  async function notionFetch(
    path: string,
    config: NotionConfig,
    options: { method?: string; body?: unknown } = {},
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    const token = await getToken(config);
    const response = await ctx.http.fetch(`${NOTION_API}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
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

  // -------------------------------------------------------------------------
  // Public methods
  // -------------------------------------------------------------------------

  async function createPage(
    config: NotionConfig,
    properties: Record<string, NotionProperty>,
  ): Promise<string> {
    const result = await notionFetch("/pages", config, {
      method: "POST",
      body: {
        parent: { database_id: config.notionDatabaseId },
        properties,
      },
    });

    if (!result.ok) {
      // Handle rate limiting with one retry
      if (result.status === 429) {
        await sleep(1000);
        const retry = await notionFetch("/pages", config, {
          method: "POST",
          body: {
            parent: { database_id: config.notionDatabaseId },
            properties,
          },
        });
        if (!retry.ok) {
          throw new Error(
            `Notion createPage failed after retry (${retry.status}): ${JSON.stringify(retry.data)}`,
          );
        }
        return (retry.data as NotionPage).id;
      }
      throw new Error(
        `Notion createPage failed (${result.status}): ${JSON.stringify(result.data)}`,
      );
    }
    return (result.data as NotionPage).id;
  }

  async function updatePage(
    config: NotionConfig,
    pageId: string,
    properties: Record<string, NotionProperty>,
  ): Promise<void> {
    const result = await notionFetch(`/pages/${pageId}`, config, {
      method: "PATCH",
      body: { properties },
    });

    if (!result.ok) {
      if (result.status === 404) {
        throw new NotionNotFoundError(pageId);
      }
      if (result.status === 429) {
        await sleep(1000);
        const retry = await notionFetch(`/pages/${pageId}`, config, {
          method: "PATCH",
          body: { properties },
        });
        if (!retry.ok) {
          throw new Error(
            `Notion updatePage failed after retry (${retry.status}): ${JSON.stringify(retry.data)}`,
          );
        }
        return;
      }
      throw new Error(
        `Notion updatePage failed (${result.status}): ${JSON.stringify(result.data)}`,
      );
    }
  }

  async function queryByLink(
    config: NotionConfig,
    linkUrl: string,
  ): Promise<string | null> {
    const result = await notionFetch(
      `/databases/${config.notionDatabaseId}/query`,
      config,
      {
        method: "POST",
        body: {
          filter: {
            property: "Link",
            url: { equals: linkUrl },
          },
          page_size: 1,
        },
      },
    );

    if (!result.ok) {
      throw new Error(
        `Notion query failed (${result.status}): ${JSON.stringify(result.data)}`,
      );
    }

    const queryResult = result.data as NotionQueryResult;
    return queryResult.results.length > 0 ? queryResult.results[0].id : null;
  }

  async function checkHealth(config: NotionConfig): Promise<boolean> {
    try {
      const result = await notionFetch(
        `/databases/${config.notionDatabaseId}`,
        config,
      );
      return result.ok;
    } catch {
      return false;
    }
  }

  return { createPage, updatePage, queryByLink, checkHealth, clearTokenCache };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class NotionNotFoundError extends Error {
  constructor(pageId: string) {
    super(`Notion page ${pageId} not found (404)`);
    this.name = "NotionNotFoundError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { sleep };
