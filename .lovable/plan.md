# Migrate the app to your own Supabase project

Target project: `udwsxqdegrtaqlbwnrqg`. The app currently runs against the old, paused Lovable Cloud database (`sqaesmhqhzojinprofha`), which is why signup fails with "Failed to fetch".

## Current state (verified)

- The generated `.env` and the sandbox runtime env still point at the OLD project. Only the pasted `dot-env.txt` contains the new project's URL/keys.
- `supabase/config.toml` still pins the old project ref.
- There are 115 migration files in `supabase/migrations` that describe the full schema (profiles, roles, matches, bets, wagers, wallets, chat, push, MCP audit, tasks, lucky wheel, popup ads, etc.).
- App-level secrets currently live on the old project: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET`, `LOVABLE_API_KEY`, plus a Google Search Console connector.

## Step 1 — Point the platform at the new project

Rebind the project's Supabase environment so `SUPABASE_URL`, publishable key and service-role key all resolve to `udwsxqdegrtaqlbwnrqg`, and update `supabase/config.toml` to the new ref.

If the integration binding still resolves to the old ref after rebinding, you'll need to re-authorize Supabase in project settings and re-select `udwsxqdegrtaqlbwnrqg` — I'll tell you exactly when that's the blocker rather than guessing around it.

## Step 2 — Rebuild the schema on the new project

Replay the full schema into the empty project as one consolidated migration set:
- All tables in `public`, with GRANTs, RLS enabled and every policy.
- Enums (`app_role`, wager/bet status types, etc.), functions and triggers — including `has_role`, `handle_new_user`, `resolve_open_bets`, `resolve_auto_championship`, `credit_championship_payouts`, `recalculate_open_bet_totals`, `search_opponents`.
- Realtime publication + `REPLICA IDENTITY FULL` on the tables the leaderboard and live feeds depend on.
- Storage buckets (avatars, banners, ads, emblems, evidence) and their policies.
- Cron/scheduled jobs used by push reminders and the virtual tick.

## Step 3 — Copy the old data across

Export from the old project and import into the new one, in dependency order:
1. Auth users (`auth.users`) — recreated via the Admin API so IDs are preserved; existing passwords cannot be exported, so affected users sign in via password reset / OTP unless you accept re-registration.
2. `profiles`, `user_roles`, wallets and `token_transactions`.
3. Matches, categories, odds/markets, bets and bet legs, wagers and disputes.
4. Chat, notifications, tasks/quests, leaderboard-feeding tables, ads/banners/events, MCP audit logs.
5. Storage objects (uploaded images) re-uploaded to the new buckets, with URLs rewritten to the new project host.

The old project is paused, so it must be resumed first for the export to run. Data copy happens after the schema is verified, so foreign keys land cleanly.

## Step 4 — Secrets and auth config

- Re-add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET` to the new project (reusing the same VAPID pair so existing push subscriptions keep working).
- Re-apply auth settings: email/password on, signup enabled, anonymous off, HIBP as currently configured, plus the SMS/OTP template.
- Re-point the MCP OAuth issuer, which derives from `VITE_SUPABASE_PROJECT_ID`, and update `/mcp-docs` references.
- Re-link the Google Search Console connector if you still want it.

## Step 5 — Verify end to end

- Sign up a fresh account, confirm the `profiles` row and default role are created by the trigger.
- Sign in, check token balance, leaderboard, matches, bet placement and a wager flow.
- Fire a push broadcast and hit `/api/public/virtual-tick` to confirm server routes and the service-role client work.
- Run the security linter on the new project and fix anything it flags.

## Technical notes

- No application code needs rewriting: every client reads `VITE_SUPABASE_*` / `SUPABASE_*`, so the swap is environment + data, not source. The only literal refs are `supabase/config.toml` and the MCP issuer, which is already derived from the env var.
- Table-level data copy uses CSV export/import per table rather than a full dump.
- Row counts are compared per table after import so nothing silently drops.
