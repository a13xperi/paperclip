import type { PluginContext } from "@paperclipai/plugin-sdk";

export interface LedgerRow {
  platform: string;
  task_id: string;
  session_type: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  estimated_cost?: number | null;
  outcome?: string | null;
  notes?: string | null;
  account: string;
}

interface LedgerConfig {
  supabaseUrl: string;
  supabaseKeyRef: string;
  supabaseKey?: string;
}

export function createSupabaseClient(ctx: PluginContext) {
  async function resolveKey(config: LedgerConfig): Promise<string> {
    if (config.supabaseKeyRef) {
      const resolved = await ctx.secrets.resolve(config.supabaseKeyRef);
      if (resolved) return resolved;
    }
    if (config.supabaseKey) return config.supabaseKey;
    throw new Error("No Supabase key configured (supabaseKeyRef or supabaseKey required)");
  }

  async function insertRow(config: LedgerConfig, row: LedgerRow): Promise<string | null> {
    const key = await resolveKey(config);
    const url = `${config.supabaseUrl}/rest/v1/ai_capacity_ledger`;

    const resp = await ctx.http.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    if (!resp.ok) {
      const body = await resp.text();
      ctx.logger.error("Supabase insert failed", { status: resp.status, body });
      return null;
    }

    const data = (await resp.json()) as Array<{ id: string }>;
    return data[0]?.id ?? null;
  }

  async function queryByTaskId(
    config: LedgerConfig,
    taskId: string,
  ): Promise<Array<{ id: string; task_id: string }>> {
    const key = await resolveKey(config);
    const url = `${config.supabaseUrl}/rest/v1/ai_capacity_ledger?task_id=eq.${encodeURIComponent(taskId)}&select=id,task_id`;

    const resp = await ctx.http.fetch(url, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!resp.ok) return [];
    return (await resp.json()) as Array<{ id: string; task_id: string }>;
  }

  return { insertRow, queryByTaskId };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
