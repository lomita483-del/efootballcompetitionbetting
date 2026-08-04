import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_list_bets",
  title: "Admin list bets",
  description: "Search platform bet tickets by status, tracking ID, booking code or player email with selections and settlement data.",
  inputSchema: {
    status: z.enum(["open", "won", "lost", "void", "refunded", "suspended", "cashed_out"]).optional().describe("Optional ticket status."),
    search: z.string().optional().describe("Tracking ID, booking code or player email."),
    limit: z.number().int().optional().describe("Maximum rows; defaults to 50 and is capped at 200."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_list_bets", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const take = Math.min(Math.max(input.limit ?? 50, 1), 200);
    let query = supabaseForUser(ctx).from("bets")
      .select("id,user_id,tracking_id,booking_code,kind,stake,total_odds,potential_payout,status,is_virtual,created_at,settled_at,profiles!user_id(full_name,email,ingame_name),bet_selections(id,selection_label,locked_odds,result,matches!match_id(id,name,status,home_score,away_score))")
      .order("created_at", { ascending: false }).limit(take);
    if (input.status) query = query.eq("status", input.status);
    if (input.search?.trim()) query = query.or(`tracking_id.ilike.%${input.search.trim()}%,booking_code.ilike.%${input.search.trim()}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }], structuredContent: { bets: data ?? [] } };
  }),
});