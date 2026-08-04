import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

const roleSchema = z.enum(["viewer", "shooter", "gang_leader", "registered", "moderator", "admin", "sponsor"]);

export default defineTool({
  name: "admin_manage_user",
  title: "Admin manage user",
  description: "Adjust tokens, ban, mute, restrict, kick, or change the role of a member account.",
  inputSchema: {
    user_id: z.string().uuid(),
    action: z.enum(["adjust_tokens", "ban", "unban", "mute", "unmute", "restrict", "unrestrict", "kick", "add_role", "remove_role"]),
    reason: z.string().trim().max(500).optional(),
    token_delta: z.number().int().min(-1000000000000000).max(1000000000000000).optional(),
    role: roleSchema.optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_manage_user", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    if (input.user_id === ctx.getUserId() && ["ban", "restrict", "kick", "remove_role"].includes(input.action)) return { content: [{ type: "text", text: "You cannot lock, kick, or demote your own administrator account." }], isError: true };
    const db = supabaseForUser(ctx);
    const { data: profile, error: profileError } = await db.from("profiles").select("id,token_balance").eq("id", input.user_id).maybeSingle();
    if (profileError || !profile) return { content: [{ type: "text", text: profileError?.message ?? "User not found." }], isError: true };
    let error: { message: string } | null = null;
    if (input.action === "adjust_tokens") {
      if (input.token_delta === undefined || !input.reason) return { content: [{ type: "text", text: "token_delta and reason are required." }], isError: true };
      const balance = Number(profile.token_balance ?? 0) + input.token_delta;
      if (balance < 0 || balance > 1000000000000000) return { content: [{ type: "text", text: "The resulting token balance is outside the allowed range." }], isError: true };
      ({ error } = await db.from("profiles").update({ token_balance: balance }).eq("id", input.user_id));
    } else if (input.action === "kick") {
      if (!input.reason) return { content: [{ type: "text", text: "reason is required to kick a user." }], isError: true };
      ({ error } = await db.rpc("admin_kick_user", { _user_id: input.user_id, _reason: input.reason }));
    } else if (input.action === "add_role" || input.action === "remove_role") {
      if (!input.role) return { content: [{ type: "text", text: "role is required." }], isError: true };
      if (input.action === "add_role") ({ error } = await db.from("user_roles").upsert({ user_id: input.user_id, role: input.role }, { onConflict: "user_id,role" }));
      else ({ error } = await db.from("user_roles").delete().eq("user_id", input.user_id).eq("role", input.role));
    } else {
      const enabled = ["ban", "mute", "restrict"].includes(input.action);
      if (enabled && !input.reason) return { content: [{ type: "text", text: "reason is required for this restriction." }], isError: true };
      const kind = input.action.replace("un", "") as "ban" | "mute" | "restrict";
      const fields = kind === "ban" ? { is_banned: enabled, ban_reason: enabled ? input.reason : null } : kind === "mute" ? { is_muted: enabled, mute_reason: enabled ? input.reason : null } : { is_restricted: enabled, restrict_reason: enabled ? input.reason : null };
      ({ error } = await db.from("profiles").update(fields).eq("id", input.user_id));
    }
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const summary = { user_id: input.user_id, action: input.action, success: true };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
  }, { targetType: "user", targetId: input.user_id }),
});