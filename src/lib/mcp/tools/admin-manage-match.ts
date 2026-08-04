import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_manage_match",
  title: "Admin manage match",
  description: "Start, reschedule, score, settle, void, unvoid or archive a match using the same administrator permissions as the console.",
  inputSchema: {
    match_id: z.string().describe("Match UUID."),
    action: z.enum(["start", "reschedule", "update_score", "end_and_settle", "void", "unvoid", "archive"]).describe("Administrative action."),
    home_score: z.number().int().optional().describe("Home score for score or settlement actions."),
    away_score: z.number().int().optional().describe("Away score for score or settlement actions."),
    start_time: z.string().optional().describe("ISO date-time for rescheduling."),
    reason: z.string().optional().describe("Reason recorded for voiding or administrative traceability."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_manage_match", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    const { data: match, error: findError } = await db.from("matches").select("id,home_team_id,away_team_id,status").eq("id", input.match_id).maybeSingle();
    if (findError || !match) return { content: [{ type: "text", text: findError?.message ?? "Match not found." }], isError: true };
    let error: { message: string } | null = null;
    if (input.action === "void" || input.action === "unvoid") {
      ({ error } = await db.rpc("admin_toggle_match_void", { _match_id: input.match_id, _void: input.action === "void", _reason: input.reason }));
    } else if (input.action === "archive") {
      ({ error } = await db.from("matches").update({ is_archived: true }).eq("id", input.match_id));
    } else if (input.action === "start") {
      ({ error } = await db.from("matches").update({ status: "live" }).eq("id", input.match_id));
    } else if (input.action === "reschedule") {
      if (!input.start_time) return { content: [{ type: "text", text: "start_time is required for reschedule." }], isError: true };
      ({ error } = await db.from("matches").update({ status: "scheduled", start_time: input.start_time }).eq("id", input.match_id));
    } else {
      if (input.home_score === undefined || input.away_score === undefined) return { content: [{ type: "text", text: "home_score and away_score are required." }], isError: true };
      const winnerId = input.home_score > input.away_score ? match.home_team_id : input.away_score > input.home_score ? match.away_team_id : null;
      const status = input.action === "end_and_settle" ? "ended" : match.status;
      ({ error } = await db.from("matches").update({ home_score: input.home_score, away_score: input.away_score, winner_team_id: winnerId, status }).eq("id", input.match_id));
      if (!error && input.action === "end_and_settle") {
        await db.from("markets").update({ is_open: false }).eq("match_id", input.match_id);
        const resolved = await db.rpc("resolve_open_bets");
        if (resolved.error) error = resolved.error;
        if (!error) await db.rpc("resettle_won_bets");
      }
    }
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const summary = { match_id: input.match_id, action: input.action, success: true };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
  }, { targetType: "match", targetId: input.match_id }),
});