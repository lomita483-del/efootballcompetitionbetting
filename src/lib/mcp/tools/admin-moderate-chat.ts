import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_moderate_chat",
  title: "Admin moderate chat",
  description: "Review recent chat messages or delete a specific message from any room.",
  inputSchema: {
    action: z.enum(["list", "delete"]),
    message_id: z.string().uuid().optional(),
    room: z.enum(["general", "gang", "moderator"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_moderate_chat", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    if (input.action === "delete") {
      if (!input.message_id) return { content: [{ type: "text", text: "message_id is required for delete." }], isError: true };
      const { error } = await db.from("chat_messages").delete().eq("id", input.message_id);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return { content: [{ type: "text", text: "Chat message deleted." }], structuredContent: { message_id: input.message_id, deleted: true } };
    }
    let query = db.from("chat_messages").select("id,user_id,room,content,image_url,created_at").order("created_at", { ascending: false }).limit(input.limit ?? 50);
    if (input.room) query = query.eq("room", input.room);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }], structuredContent: { messages: data ?? [] } };
  }, { targetType: "chat_message", targetId: input.message_id }),
});