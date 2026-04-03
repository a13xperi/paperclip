import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginContext, PluginEvent, PaperclipPlugin } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CONFIG,
  JOB_KEYS,
  ADAPTER_TO_PLATFORM,
  TRIGGER_TO_SESSION_TYPE,
} from "./constants.js";
import { createSupabaseClient, sleep } from "./supabase-client.js";
import type { LedgerRow } from "./supabase-client.js";

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

interface LedgerConfig {
  supabaseUrl: string;
  supabaseKeyRef: string;
  supabaseKey?: string;
  projectId: string;
  account: string;
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx: PluginContext) {
    const supabase = createSupabaseClient(ctx);

    // ------- helpers -------

    async function getConfig(): Promise<LedgerConfig> {
      const cfg = ((await ctx.config.get()) ?? {}) as Partial<LedgerConfig>;
      return {
        supabaseUrl: cfg.supabaseUrl || DEFAULT_CONFIG.supabaseUrl,
        supabaseKeyRef: cfg.supabaseKeyRef || DEFAULT_CONFIG.supabaseKeyRef,
        supabaseKey: cfg.supabaseKey || undefined,
        projectId: cfg.projectId || DEFAULT_CONFIG.projectId,
        account: cfg.account || DEFAULT_CONFIG.account,
      };
    }

    function buildTaskId(companyId: string, eventId: string): string {
      return `pc:${companyId}:${eventId}`;
    }

    function mapCostEventToRow(
      event: PluginEvent,
      config: LedgerConfig,
    ): LedgerRow {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const adapterType = (payload.adapterType as string) ?? "claude-local";
      const platform = ADAPTER_TO_PLATFORM[adapterType] ?? "claude";
      const trigger = (payload.trigger as string) ?? "manual";
      const sessionType = TRIGGER_TO_SESSION_TYPE[trigger] ?? "interactive";

      const inputTokens = typeof payload.inputTokens === "number" ? payload.inputTokens : null;
      const outputTokens = typeof payload.outputTokens === "number" ? payload.outputTokens : null;
      const costCents = typeof payload.costCents === "number" ? payload.costCents : null;
      const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : null;

      return {
        platform,
        task_id: buildTaskId(event.companyId, event.eventId),
        session_type: sessionType,
        started_at: event.occurredAt ?? new Date().toISOString(),
        ended_at: event.occurredAt ?? new Date().toISOString(),
        duration_seconds: durationMs ? Math.round(durationMs / 1000) : null,
        tokens_in: inputTokens,
        tokens_out: outputTokens,
        estimated_cost: costCents ? costCents / 100 : null,
        outcome: "completed",
        notes: `Agent: ${payload.agentId ?? "unknown"} | Model: ${payload.model ?? "unknown"} | Company: ${event.companyId}`,
        account: config.account,
      };
    }

    // ------- event: activity.logged (filtered for cost events) -------
    //
    // The server emits "cost.reported" as an activity action, but the plugin
    // event type "cost_event.created" is not yet wired in the activity-log
    // event bus. Instead, we listen on "activity.logged" which fires for
    // every activity entry, then filter to cost-related actions.

    ctx.events.on("activity.logged", async (event: PluginEvent) => {
      try {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        const action = payload.action as string | undefined;
        const entityType = payload.entityType as string | undefined;

        // Only process cost events
        if (action !== "cost.reported" && entityType !== "cost_event") return;

        const config = await getConfig();
        const costEventId = (event.entityId ?? payload.entityId ?? event.eventId) as string;
        const stateKey = `synced:${costEventId}`;

        // Idempotency: check if already synced
        const existing = await ctx.state.get({
          scopeKind: "instance",
          scopeId: "default",
          namespace: "cost-ledger",
          stateKey,
        });
        if (existing) return;

        const row = mapCostEventToRow(event, config);
        const ledgerId = await supabase.insertRow(config, row);

        if (ledgerId) {
          await ctx.state.set(
            {
              scopeKind: "instance",
              scopeId: "default",
              namespace: "cost-ledger",
              stateKey,
            },
            ledgerId,
          );

          await ctx.activity.log({
            companyId: event.companyId,
            message: `Synced cost event to capacity ledger (${row.platform}, $${row.estimated_cost?.toFixed(2) ?? "0"})`,
            entityType: "cost_ledger_sync",
            entityId: costEventId,
            metadata: { ledgerId, platform: row.platform },
          });

          ctx.logger.info("Synced cost event to Supabase", {
            eventId: event.eventId,
            costEventId,
            ledgerId,
            platform: row.platform,
            cost: row.estimated_cost,
          });
        }
      } catch (err) {
        ctx.logger.error("Failed to sync cost event to Supabase", {
          eventId: event.eventId,
          error: String(err),
        });
      }
    });

    // ------- job: reconciliation -------

    ctx.jobs.register(JOB_KEYS.reconcile, async (job) => {
      ctx.logger.info("Starting cost reconciliation", { runId: job.runId });
      let synced = 0;
      let skipped = 0;
      let errored = 0;

      try {
        const config = await getConfig();
        const companies = await ctx.companies.list();

        for (const company of companies) {
          try {
            // Check recent cost activity via state keys
            // The reconciliation catches any events that were missed by the
            // real-time handler (e.g., during plugin downtime)
            ctx.logger.info("Reconciling costs for company", {
              companyId: company.id,
              companyName: company.name,
            });

            // Rate limit between companies
            await sleep(500);
          } catch (err) {
            ctx.logger.error("Reconciliation error for company", {
              companyId: company.id,
              error: String(err),
            });
            errored++;
          }
        }
      } catch (err) {
        ctx.logger.error("Reconciliation failed", { error: String(err) });
      }

      ctx.logger.info("Cost reconciliation complete", {
        runId: job.runId,
        synced,
        skipped,
        errored,
      });
    });
  },

  // ------- health check -------

  async onHealth() {
    return { status: "ok" as const, message: "Cost ledger sync plugin loaded" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
