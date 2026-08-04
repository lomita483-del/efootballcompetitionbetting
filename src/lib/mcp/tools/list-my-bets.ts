import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { auditedToolCall } from "../audit";

export default defineTool({
  name: "list_my_bets",
  title: "List my bets",
  description: "List the signed-in player's bet tickets, newest first, optionally filtered by status.",
  inputSchema: {
    status: z.enum(["open", "won", "lost", "void", "cashed_out"]).optional().describe("Filter by ticket status."),
    limit: z.number().int().optional().describe("Max tickets to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("list_my_bets", input, ctx, async () => {
    const { status, limit } = input;
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bets")
      .select("id,tracking_id,booking_code,kind,stake,total_odds,potential_payout,status,is_virtual,created_at,settled_at")
      .eq("user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bets: data ?? [] },
    };
  }),
});