import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description: "List E-Football competition matches with teams, scores, kickoff time and status.",
  inputSchema: {
    status: z.enum(["scheduled", "live", "ended"]).optional().describe("Filter by match status."),
    limit: z.number().int().optional().describe("Max matches to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("matches")
      .select("id,public_id,name,sport,match_kind,start_time,status,home_score,away_score,is_void,is_virtual,home_team:home_team_id(name),away_team:away_team_id(name)")
      .eq("is_archived", false)
      .order("start_time", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { matches: data ?? [] },
    };
  },
});