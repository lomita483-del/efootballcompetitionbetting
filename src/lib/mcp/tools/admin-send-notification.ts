import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_send_notification",
  title: "Admin send notification",
  description: "Send an in-app and device notification to one member, a role, or all members.",
  inputSchema: {
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(400),
    link: z.string().trim().max(500).optional(),
    image_url: z.string().url().max(1000).optional(),
    user_id: z.string().uuid().optional().describe("Target one member. Omit for a role or all users."),
    role: z.enum(["viewer", "shooter", "gang_leader", "registered", "moderator", "admin", "sponsor"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => auditedToolCall("admin_send_notification", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    let recipientIds: string[] = [];
    if (input.user_id) recipientIds = [input.user_id];
    else if (input.role) {
      const { data, error } = await db.from("user_roles").select("user_id").eq("role", input.role);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      recipientIds = Array.from(new Set((data ?? []).map((row) => row.user_id)));
    } else {
      const { data, error } = await db.from("profiles").select("id").eq("is_banned", false).limit(10000);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      recipientIds = (data ?? []).map((row) => row.id);
    }
    if (!recipientIds.length) return { content: [{ type: "text", text: "No recipients matched." }], isError: true };
    const { error } = await db.from("notifications").insert(recipientIds.map((userId) => ({ user_id: userId, title: input.title, body: input.body, link: input.link ?? "/notifications", image_url: input.image_url ?? null, skip_push: false })));
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const summary = { recipients: recipientIds.length, title: input.title, success: true };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
  }),
});