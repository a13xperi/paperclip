import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginContext, PluginEvent, PaperclipPlugin } from "@paperclipai/plugin-sdk";
import type { Issue, Company } from "@paperclipai/shared";
import { DEFAULT_CONFIG, JOB_KEYS, STATUS_MAP, ACTION_FOR_EVENT } from "./constants.js";
import {
  createNotionClient,
  buildCreateProperties,
  buildUpdateProperties,
  NotionNotFoundError,
  sleep,
} from "./notion-client.js";

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

interface SyncConfig {
  notionTokenRef: string;
  notionDatabaseId: string;
  paperclipBaseUrl: string;
  companyDomainMap: string;
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx: PluginContext) {
    const notion = createNotionClient(ctx);

    // ------- helpers -------

    async function getConfig(): Promise<SyncConfig> {
      const cfg = ((await ctx.config.get()) ?? {}) as Partial<SyncConfig>;
      return {
        notionTokenRef: cfg.notionTokenRef || DEFAULT_CONFIG.notionTokenRef,
        notionDatabaseId: cfg.notionDatabaseId || DEFAULT_CONFIG.notionDatabaseId,
        paperclipBaseUrl: (cfg.paperclipBaseUrl || DEFAULT_CONFIG.paperclipBaseUrl).replace(/\/$/, ""),
        companyDomainMap: cfg.companyDomainMap || DEFAULT_CONFIG.companyDomainMap,
      };
    }

    function resolveDomain(company: Company | null, domainMapJson: string): string | null {
      if (!company) return null;
      try {
        const map = JSON.parse(domainMapJson) as Record<string, string>;
        return map[company.issuePrefix] ?? null;
      } catch {
        return null;
      }
    }

    function issueUrl(config: SyncConfig, issue: Issue): string {
      return `${config.paperclipBaseUrl}/issues/${issue.identifier ?? issue.id}`;
    }

    // ------- shared create logic -------

    async function createNotionPageForIssue(
      issue: Issue,
      companyId: string,
      action: string,
    ): Promise<string | null> {
      const config = await getConfig();
      const company = await ctx.companies.get(companyId);
      const domain = resolveDomain(company, config.companyDomainMap);
      const notionStatus = STATUS_MAP[issue.status] ?? "Open Thread";
      const link = issueUrl(config, issue);

      const properties = buildCreateProperties({
        issue,
        notionStatus,
        action,
        domain,
        issueUrl: link,
      });

      const pageId = await notion.createPage(config, properties);

      // Store mapping
      await ctx.state.set(
        { scopeKind: "issue", scopeId: issue.id, stateKey: "notion-page-id" },
        pageId,
      );

      await ctx.activity.log({
        companyId,
        message: `Synced issue "${issue.title}" to Notion (${action})`,
        entityType: "issue",
        entityId: issue.id,
        metadata: { notionPageId: pageId, action },
      });

      ctx.logger.info("Created Notion page for issue", {
        issueId: issue.id,
        identifier: issue.identifier,
        notionPageId: pageId,
      });

      return pageId;
    }

    // ------- event: issue.created -------

    ctx.events.on("issue.created", async (event: PluginEvent) => {
      try {
        const issueId = event.entityId;
        if (!issueId) return;

        // Idempotency: check state
        const existingPageId = await ctx.state.get({
          scopeKind: "issue",
          scopeId: issueId,
          stateKey: "notion-page-id",
        });
        if (existingPageId) return;

        // Event dedup
        const lastEventId = await ctx.state.get({
          scopeKind: "issue",
          scopeId: issueId,
          namespace: "notion-sync",
          stateKey: "last-event-id",
        });
        if (lastEventId === event.eventId) return;

        // Fetch full issue
        const issue = await ctx.issues.get(issueId, event.companyId);
        if (!issue) return;

        await createNotionPageForIssue(issue, event.companyId, "Created");

        // Mark event processed
        await ctx.state.set(
          { scopeKind: "issue", scopeId: issueId, namespace: "notion-sync", stateKey: "last-event-id" },
          event.eventId,
        );
      } catch (err) {
        ctx.logger.error("Failed to sync issue.created to Notion", {
          issueId: event.entityId,
          error: String(err),
        });
      }
    });

    // ------- event: issue.updated -------

    ctx.events.on("issue.updated", async (event: PluginEvent) => {
      try {
        const issueId = event.entityId;
        if (!issueId) return;

        // Event dedup
        const lastEventId = await ctx.state.get({
          scopeKind: "issue",
          scopeId: issueId,
          namespace: "notion-sync",
          stateKey: "last-event-id",
        });
        if (lastEventId === event.eventId) return;

        const issue = await ctx.issues.get(issueId, event.companyId);
        if (!issue) return;

        // Look up existing Notion page
        let notionPageId = (await ctx.state.get({
          scopeKind: "issue",
          scopeId: issueId,
          stateKey: "notion-page-id",
        })) as string | null;

        if (!notionPageId) {
          // Issue predates plugin install — create page
          await createNotionPageForIssue(issue, event.companyId, "Created");
        } else {
          // Update existing page
          const config = await getConfig();
          const notionStatus = STATUS_MAP[issue.status] ?? "Open Thread";
          const properties = buildUpdateProperties({
            notionStatus,
            action: "Updated",
            description: issue.description,
          });

          try {
            await notion.updatePage(config, notionPageId, properties);
            ctx.logger.info("Updated Notion page for issue", {
              issueId,
              notionPageId,
            });
          } catch (err) {
            if (err instanceof NotionNotFoundError) {
              // Page was deleted in Notion — recreate
              await ctx.state.delete({
                scopeKind: "issue",
                scopeId: issueId,
                stateKey: "notion-page-id",
              });
              await createNotionPageForIssue(issue, event.companyId, "Updated");
            } else {
              throw err;
            }
          }

          await ctx.activity.log({
            companyId: event.companyId,
            message: `Updated Notion page for issue "${issue.title}"`,
            entityType: "issue",
            entityId: issueId,
            metadata: { notionPageId, action: "Updated" },
          });
        }

        // Mark event processed
        await ctx.state.set(
          { scopeKind: "issue", scopeId: issueId, namespace: "notion-sync", stateKey: "last-event-id" },
          event.eventId,
        );
      } catch (err) {
        ctx.logger.error("Failed to sync issue.updated to Notion", {
          issueId: event.entityId,
          error: String(err),
        });
      }
    });

    // ------- job: reconciliation -------

    ctx.jobs.register(JOB_KEYS.reconcile, async (job) => {
      ctx.logger.info("Starting Notion reconciliation", { runId: job.runId });
      let created = 0;
      let recovered = 0;
      let skipped = 0;
      let errored = 0;

      try {
        const config = await getConfig();
        const companies = await ctx.companies.list();

        for (const company of companies) {
          const issues = await ctx.issues.list({
            companyId: company.id,
            limit: 100,
          });

          for (const issue of issues) {
            try {
              const existing = await ctx.state.get({
                scopeKind: "issue",
                scopeId: issue.id,
                stateKey: "notion-page-id",
              });

              if (existing) {
                skipped++;
                continue;
              }

              // Check Notion for existing page by Link URL
              const link = issueUrl(config, issue);
              const foundPageId = await notion.queryByLink(config, link);

              if (foundPageId) {
                // Page exists in Notion but state was lost — recover mapping
                await ctx.state.set(
                  { scopeKind: "issue", scopeId: issue.id, stateKey: "notion-page-id" },
                  foundPageId,
                );
                recovered++;
                ctx.logger.info("Recovered Notion page mapping", {
                  issueId: issue.id,
                  notionPageId: foundPageId,
                });
              } else {
                // Create new page
                await createNotionPageForIssue(issue, company.id, "Created");
                created++;
              }

              // Rate limit: 350ms between API calls (Notion allows ~3 req/s)
              await sleep(350);
            } catch (err) {
              ctx.logger.error("Reconciliation error for issue", {
                issueId: issue.id,
                error: String(err),
              });
              errored++;
            }
          }
        }
      } catch (err) {
        ctx.logger.error("Reconciliation failed", { error: String(err) });
      }

      ctx.logger.info("Reconciliation complete", {
        runId: job.runId,
        created,
        recovered,
        skipped,
        errored,
      });
    });
  },

  // ------- health check -------

  async onHealth() {
    // Basic health — we can't easily re-resolve config here without ctx,
    // but the host calls this periodically and logs the result.
    return { status: "ok" as const, message: "Notion sync plugin loaded" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
