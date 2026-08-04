import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_list_mcp_audit",
  title: "Admin list MCP audit log",
  description: "List recent MCP tool calls with timestamp, acting account, role, outcome and target for traceability.",
  inputSchema: {
    tool_name: z.string().optional().describe("Optional exact tool name."),
    actor_role: z.enum(["user", "moderator", "admin"]).optional().describe("Optional acting role."),
    limit: z.number().int().optional().describe("Maximum entries; defaults to 50 and is capped at 200."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_list_mcp_audit", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    let query = (supabaseForUser(ctx) as any).from("mcp_audit_logs").select("id,user_id,user_email,actor_role,tool_name,success,target_type,target_id,input_summary,error_message,client_id,created_at").order("created_at", { ascending: false }).limit(Math.min(Math.max(input.limit ?? 50, 1), 200));
    if (input.tool_name) query = query.eq("tool_name", input.tool_name);
    if (input.actor_role) query = query.eq("actor_role", input.actor_role);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }], structuredContent: { entries: data ?? [] } };
  }),
});