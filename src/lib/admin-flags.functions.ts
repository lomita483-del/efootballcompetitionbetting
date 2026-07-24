import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { supabase, userId } = context;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
  return userId as string;
}

/** Admin-only: list flagged activity, optionally filtered by status/category. */
export const listAdminFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      status: z.enum(["all", "new", "reviewing", "dismissed", "actioned"]).optional().default("all"),
      category: z.string().optional().default("all"),
    }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("admin_flags")
      .select("*, profiles:user_id(full_name,email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category !== "all") q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Admin-only: update a flag's review status. */
export const updateAdminFlagStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "reviewing", "dismissed", "actioned"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_flags")
      .update({ status: data.status, reviewed_by: userId, reviewed_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Admin-only: list configurable detection rules. */
export const listFlagRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("flag_rules").select("*").order("is_builtin", { ascending: false }).order("created_at");
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  rule_key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  category: z.enum(["match_fixing", "financial_fraud", "account_abuse", "custom"]),
  metric: z.enum(["withdrawal_count", "wager_count", "token_request_count"]),
  operator: z.string().trim().default(">="),
  value: z.number(),
  window_minutes: z.number().int().positive().max(525600).optional(),
  enabled: z.boolean().default(true),
});

/** Admin-only: create or update a custom rule. Built-in rules can only be
 * toggled/tweaked (value, window_minutes, enabled), not retyped. */
export const upsertFlagRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ruleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, is_builtin: false, created_by: userId, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("flag_rules").upsert(payload, { onConflict: "rule_key" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Admin-only: enable/disable or retune value+window on any rule (including built-ins). */
export const tuneFlagRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      id: z.string().uuid(),
      value: z.number().optional(),
      window_minutes: z.number().int().positive().max(525600).optional(),
      enabled: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.value !== undefined) patch.value = data.value;
    if (data.window_minutes !== undefined) patch.window_minutes = data.window_minutes;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    const { error } = await supabaseAdmin.from("flag_rules").update(patch).eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Admin-only: delete a custom rule (built-ins cannot be deleted, only disabled). */
export const deleteFlagRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("flag_rules").delete().eq("id", data.id).eq("is_builtin", false);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Admin-only: run the scan immediately instead of waiting for the cron tick. */
export const runFlagScanNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("run_suspicious_activity_scan");
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
