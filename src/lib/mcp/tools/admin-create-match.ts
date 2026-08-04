import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_create_match",
  title: "Admin create match",
  description: "Create a scheduled team match with a match-winner market and home, draw and away odds.",
  inputSchema: {
    name: z.string().trim().min(1).max(160).describe("Public match title."),
    home_team_id: z.string().uuid().describe("Home team UUID."),
    away_team_id: z.string().uuid().describe("Away team UUID."),
    start_time: z.string().describe("ISO date-time for kickoff."),
    location: z.string().trim().max(160).optional(),
    category_id: z.string().uuid().optional(),
    home_odds: z.number().positive(),
    draw_odds: z.number().positive(),
    away_odds: z.number().positive(),
    is_featured: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_create_match", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    if (input.home_team_id === input.away_team_id) return { content: [{ type: "text", text: "Home and away teams must be different." }], isError: true };
    const startTime = new Date(input.start_time);
    if (Number.isNaN(startTime.getTime())) return { content: [{ type: "text", text: "start_time must be a valid ISO date-time." }], isError: true };
    const db = supabaseForUser(ctx);
    const { data: teams, error: teamError } = await db.from("teams").select("id,name").in("id", [input.home_team_id, input.away_team_id]);
    if (teamError) return { content: [{ type: "text", text: teamError.message }], isError: true };
    if ((teams ?? []).length !== 2) return { content: [{ type: "text", text: "One or both teams were not found." }], isError: true };
    const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
    const { data: match, error: matchError } = await db.from("matches").insert({
      name: input.name,
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      start_time: startTime.toISOString(),
      location: input.location ?? null,
      category_id: input.category_id ?? null,
      status: "scheduled",
      is_featured: input.is_featured ?? false,
      created_by: ctx.getUserId(),
    }).select("id,public_id,name,start_time,status").single();
    if (matchError || !match) return { content: [{ type: "text", text: matchError?.message ?? "Could not create match." }], isError: true };
    const { data: market, error: marketError } = await db.from("markets").insert({ match_id: match.id, name: "Match Winner", is_open: true }).select("id").single();
    if (marketError || !market) {
      await db.from("matches").delete().eq("id", match.id);
      return { content: [{ type: "text", text: marketError?.message ?? "Could not create market." }], isError: true };
    }
    const { error: oddsError } = await db.from("odds").insert([
      { market_id: market.id, label: teamNames.get(input.home_team_id) ?? "Home", value: input.home_odds },
      { market_id: market.id, label: "Draw", value: input.draw_odds },
      { market_id: market.id, label: teamNames.get(input.away_team_id) ?? "Away", value: input.away_odds },
    ]);
    if (oddsError) {
      await db.from("matches").delete().eq("id", match.id);
      return { content: [{ type: "text", text: oddsError.message }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(match, null, 2) }], structuredContent: { match } };
  }),
});