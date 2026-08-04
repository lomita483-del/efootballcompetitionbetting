import { defineTool } from "@lovable.dev/mcp-js";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_platform_overview",
  title: "Admin platform overview",
  description: "Return administrator-only totals for users, matches, bets, open exposure and token balances.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_platform_overview", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    const [users, matches, bets, openBets, balances] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("matches").select("id", { count: "exact", head: true }).eq("is_archived", false),
      db.from("bets").select("id", { count: "exact", head: true }),
      db.from("bets").select("stake,potential_payout").eq("status", "open"),
      db.from("profiles").select("token_balance"),
    ]);
    const firstError = [users.error, matches.error, bets.error, openBets.error, balances.error].find(Boolean);
    if (firstError) return { content: [{ type: "text", text: firstError.message }], isError: true };
    const overview = {
      users: users.count ?? 0,
      active_matches: matches.count ?? 0,
      total_bets: bets.count ?? 0,
      open_bets: openBets.data?.length ?? 0,
      open_stakes: (openBets.data ?? []).reduce((sum, row) => sum + Number(row.stake ?? 0), 0),
      potential_open_payout: (openBets.data ?? []).reduce((sum, row) => sum + Number(row.potential_payout ?? 0), 0),
      player_token_balance: (balances.data ?? []).reduce((sum, row) => sum + Number(row.token_balance ?? 0), 0),
    };
    return { content: [{ type: "text", text: JSON.stringify(overview, null, 2) }], structuredContent: { overview } };
  }),
});