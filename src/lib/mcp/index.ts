import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyAccount from "./tools/get-my-account";
import listMyBets from "./tools/list-my-bets";
import listMatches from "./tools/list-matches";
import listMyWagers from "./tools/list-my-wagers";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "e-football-competition-betting-platform",
  title: "E-FOOTBALL COMPETITION BETTING PLATFORM",
  version: "0.1.0",
  instructions:
    "Tools for the E-Football Competition Betting Platform. Act as the signed-in player: read their account and token balance with `get_my_account`, their bet tickets with `list_my_bets`, their player-vs-player wagers with `list_my_wagers`, and competition fixtures and results with `list_matches`.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyAccount, listMyBets, listMatches, listMyWagers],
});