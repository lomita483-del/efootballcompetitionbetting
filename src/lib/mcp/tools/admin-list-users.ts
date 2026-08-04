import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_list_users",
  title: "Admin list users",
  description: "Search member accounts and review balances, status flags, contact details and assigned roles.",
  inputSchema: {
    search: z.string().trim().max(120).optional(),
    status: z.enum(["active", "banned", "muted", "restricted"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_list_users", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    let query = db.from("profiles").select("id,special_id,full_name,ingame_name,email,phone,region,gang_name,token_balance,xp,vip_tier,is_banned,is_muted,is_restricted,created_at").order("created_at", { ascending: false }).limit(input.limit ?? 50);
    if (input.search) query = query.or(`full_name.ilike.%${input.search}%,ingame_name.ilike.%${input.search}%,email.ilike.%${input.search}%,special_id.ilike.%${input.search}%`);
    if (input.status === "banned") query = query.eq("is_banned", true);
    else if (input.status === "muted") query = query.eq("is_muted", true);
    else if (input.status === "restricted") query = query.eq("is_restricted", true);
    else if (input.status === "active") query = query.eq("is_banned", false).eq("is_restricted", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const ids = (data ?? []).map((row) => row.id);
    const { data: roleRows } = ids.length ? await db.from("user_roles").select("user_id,role").in("user_id", ids) : { data: [] };
    const users = (data ?? []).map((row) => ({ ...row, roles: (roleRows ?? []).filter((role) => role.user_id === row.id).map((role) => role.role) }));
    return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }], structuredContent: { users } };
  }),
});