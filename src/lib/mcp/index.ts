import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyAccount from "./tools/get-my-account";
import listMyBets from "./tools/list-my-bets";
import listMatches from "./tools/list-matches";
import listMyWagers from "./tools/list-my-wagers";
import adminPlatformOverview from "./tools/admin-platform-overview";
import adminListMatches from "./tools/admin-list-matches";
import adminManageMatch from "./tools/admin-manage-match";
import adminListBets from "./tools/admin-list-bets";
import adminManageBet from "./tools/admin-manage-bet";
import adminListMcpAudit from "./tools/admin-list-mcp-audit";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "e-football-competition-betting-platform",
  title: "E-FOOTBALL COMPETITION BETTING PLATFORM",
  version: "0.1.0",
  instructions:
    "OAuth-protected tools for the E-Football Competition Betting Platform. Player tools read only the signed-in player's permitted data. Admin tools verify the admin role before exposing platform data or changing matches and bet tickets. Every tool call is written to the MCP audit log with actor, role, outcome and timestamp. Human documentation and example prompts are available at https://efootballcompetitionbetting.lovable.app/mcp-docs.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    resourceDocumentation: "https://efootballcompetitionbetting.lovable.app/mcp-docs",
  }),
  tools: [
    getMyAccount, listMyBets, listMatches, listMyWagers,
    adminPlatformOverview, adminListMatches, adminManageMatch,
    adminListBets, adminManageBet, adminListMcpAudit,
  ],
});