import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_list_matches",
  title: "Admin list matches",
  description: "Search all platform matches, including archived and voided records, with scores, status and betting state.",
  inputSchema: {
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional().describe("Optional match status."),
    search: z.string().optional().describe("Match name, public match ID, team or player name."),
    limit: z.number().int().optional().describe("Maximum rows to return; defaults to 50 and is capped at 200."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_list_matches", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const take = Math.min(Math.max(input.limit ?? 50, 1), 200);
    let query = supabaseForUser(ctx).from("matches")
      .select("id,public_id,name,match_kind,start_time,status,home_score,away_score,is_void,is_archived,home_present,away_present,home_team:home_team_id(name),away_team:away_team_id(name),home_player:home_player_id(name),away_player:away_player_id(name)")
      .order("start_time", { ascending: false }).limit(take);
    if (input.status) query = query.eq("status", input.status);
    if (input.search?.trim()) query = query.or(`name.ilike.%${input.search.trim()}%,public_id.ilike.%${input.search.trim()}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }], structuredContent: { matches: data ?? [] } };
  }),
});