## 1. Create Account page — add "E" for E-Football, rename Server → Region

- Add `E` option to the affiliation selector alongside `F` (Faction) and `G` (Gang).
- When `E` is selected, show a text input to enter the E-Football team name manually (same UX as gang/faction name).
- Rename the "Server" field to "Region" everywhere on the form and use `region` as the stored value.
- Store `E`, `G`, or `F` in `gang_type`; the entered name goes into `gang_name` (works for all three).
- **DB migration:** widen the `profiles.gang_type` check constraint (currently allows `G`/`F` only) to also allow `E`; rename `profiles.server` → `profiles.region` (with a compatibility view if code references `server` elsewhere).
- Update code that references `profiles.server` (leaderboard, admin panels, ticket, etc.) to use `region`.

## 2. Push blast — show subscribed users' names

- In the Push Broadcast panel, load the recipient list from `push_subscriptions` and join `profiles` on `user_id` so each row shows in-game name / full name plus device UA, last seen, and endpoint tail.
- Add a searchable, scrollable "Subscribed devices" section under the send controls (paginated at ~200 rows).

## 3. Instant Virtual — only one match visible

- Investigate: check whether the list is filtered too aggressively (status filter, single-round fetch, missing `is_visible`), whether the seeder generates only one round, or whether the tick isn't spawning additional matches.
- Fix the query / spawner so the "select a match" screen shows all active instant matches for the current round, not just the first.

## 4. Championship Virtual — add odds, cashout, voucher settlement

- Add real odds to each championship virtual match:
  - Compute pre-match odds from participant strength (same style as the standard match markets), stored on the tournament match row.
  - Recompute live odds each round tick while a match is in progress.
- Wire betting the same way as regular matches:
  - Championship bets go through the standard `bets` / `bet_selections` pipeline with the match ID and market/odds locked in at slip time.
  - Cash-out: allow partial settlement against current live odds while the match is still running (same rule as standard matches).
  - On championship match finish, settle every open ticket referencing that match as win/loss and update the voucher (ticket) status accordingly.
- Update the Championship Bet panel UI to show odds per selection, potential payout, and a cashout button on in-play tickets.

## 5. Matches page — style the "All matches" heading

- Replace the plain `"All matches"` text block with the same gold-gradient headline treatment used elsewhere (e.g. gradient title + subtitle line + count badge + subtle divider).

## Technical notes

- Register: constraint change is `ALTER TABLE profiles DROP CONSTRAINT ... ; ADD CONSTRAINT profiles_gang_type_check CHECK (gang_type IN ('G','F','E'))`. `server` → `region` uses `ALTER TABLE ... RENAME COLUMN`.
- Championship odds: extend `tournament_matches` with `home_odds`, `draw_odds`, `away_odds`, `odds_updated_at`; reuse existing bet-settlement RPC by making it recognize championship-match IDs, or add a parallel settle function keyed on `tournament_match_id`.
- Cashout: mirror the RPC used for regular in-play cashout, keyed on `bets.match_id` OR `bets.tournament_match_id`.
- Push panel: single `supabase.from("push_subscriptions").select("*, profile:profiles(full_name, ingame_name)")` — no schema change needed.

## Order of execution

1. DB migration (register schema + championship odds columns).
2. Register UI + affiliated code paths using `server` → `region`.
3. Push broadcast panel joins + list.
4. Instant virtual query fix.
5. Championship virtual odds computation, betting, cashout, settlement.
6. Matches page heading.

Confirm and I'll implement in that order.
