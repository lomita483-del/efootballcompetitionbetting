# Build Plan

Three chunks in one turn. Given the P2P surface, expect this to be a large diff (~25 files). I'll ship it end-to-end; the follow-up turn will be for polish/bug fixes you find while using it.

## 1. Top nav fixes

- **Pin Balance + Profile + Logout** to the right of the top nav on every page (non-scrollable anchor group).
- Middle nav links (Matches, Virtual, Lottery, Arcade, Shop, Leaderboard, Tournament, Dashboard, Tasks, etc.) become horizontally scrollable inside the remaining space, sliding under the pinned group with a soft gradient fade so nothing gets clipped off-screen.
- Remove the top nav row entirely from the **home page** (`/`) on ALL viewports since the home already has its own quick menu / sidebar.

## 2. Admin quick-action buttons

Bump tile size in the Admin Quick Actions grid (~10-15% larger padding + icon), keep column count on desktop, avoid regressing mobile density.

## 3. P2P Wager System (full spec)

### Data model (one migration)

```text
wager_wallets           user_id, balance, locked_balance
wager_wallet_txns       wallet_id, kind, amount, ref_type, ref_id, admin_id, notes
wagers                  id, public_id (WGR-XXXXXX), challenger_id, opponent_id,
                        match_id/event_ref, category, bet_type, stake, total_pot,
                        platform_fee, agreement, status, expires_at, funded_at,
                        activated_at, settled_at, winner_id, loser_id, is_draw,
                        settlement_notes, final_score_home, final_score_away
wager_rounds            wager_id, round_no, home_score, away_score, winner_id, ended_at
wager_payments          wager_id, user_id, amount, method, receipt_url, status,
                        verified_by, verified_at, notes
wager_live_events       wager_id, ts, kind (score|round|status|commentary|stat),
                        payload jsonb
wager_termination_reqs  wager_id, requested_by, reason, opponent_response,
                        admin_status, admin_id, admin_notes
wager_disputes          wager_id, opened_by, reason, evidence_urls[], status,
                        admin_id, resolution_notes, messages jsonb
wager_notifications     reuses existing notifications table with kind='wager_*'
wager_audit_log         actor_id, action, prev jsonb, next jsonb, ref_id, reason,
                        ip, ua
```

Status enum: `pending_approval, awaiting_payment, awaiting_funding, funded, active, live, awaiting_settlement, settled, cancelled, refunded, disputed, terminated`.

RLS: challenger/opponent see their own wagers + slips; admin role sees all. Every table has `GRANT` + policies scoped to `auth.uid()` or `has_role`.

DB functions:
- `p2p_create_wager`, `p2p_accept_wager`, `p2p_reject_wager`
- `p2p_verify_payment` (admin) → credits Wager Wallet, transitions status
- `p2p_settle_wager` (admin) → pays winner from pot, records txn, marks settled
- `p2p_request_termination`, `p2p_respond_termination`, `p2p_admin_terminate`
- `p2p_open_dispute`, `p2p_resolve_dispute`
- Audit trigger writes to `wager_audit_log` on every mutation.

### User-facing routes

- `/wagers` — Wager History with tabs (All / Pending / Awaiting Funding / Active / Live / Won / Lost / Draw / Cancelled / Refunded), search + filter.
- `/wagers/new` — Challenge creator (opponent search, match picker, category, bet type, stake, expiration, agreement).
- `/wagers/$publicId` — Premium bet slip: QR, countdown, status timeline, funding CTA, terminate/dispute actions.
- `/wagers/$publicId/live` — Live match UI (scoreboard, round scores, timer, timeline, commentary, live badge), realtime via Supabase channel.
- Inbox banner on `/notifications` + toast for incoming challenges.

### Admin

New **Wagers** button in Admin Quick Actions → `/admin/wagers` panel (component: `src/components/admin/WagersAdminPanel.tsx`) with:

- Stat header: Total / Pending / Awaiting Payment / Awaiting Funding / Active / Live / Awaiting Settlement / Settled / Cancelled / Refunded / Disputed / Platform Revenue (D/W/M).
- Tabbed queue mirroring status enum + Search/Filter/Sort by Bet ID, user, match, stake, date, status.
- Wager detail drawer: full review (payments, wallet balances, evidence, notes, audit log) + action bar:
  - Approve / Decline / Request changes / Cancel / Reopen / Lock / Unlock / Freeze / Resume
  - Verify payment / Reject payment / Credit / Deduct / Refund one / Refund both / Partial refund
  - Assign match / Change match / Edit kickoff / Postpone / Restart / Force start / Force end / Lock match
  - Live update panel: score, round score, timer, current round, round winner, stat, commentary, timeline, status (realtime broadcast)
  - Settle: final score, round results, winner/loser/draw/split/void; Approve / Reject / Reverse / Recalc payout + notes
  - Override: correct final score, correct round, change winner, reverse wallet, re-credit, deduct — requires reason + confirm, writes audit entry
  - Terminate (admin emergency) with reason enum
  - Dispute panel: evidence viewer, chat with players, request more evidence, approve/reject, modify settlement, refund, close
  - Notifications: send payment reminder, wager approved/declined, match cancelled/postponed, settlement complete, refund issued, dispute update, custom announcement.
- Read-only Audit Log tab with search.

### Notifications & realtime

- New `notifications.kind` values covering all 15 wager events.
- Live match page subscribes to `wager_live_events` and `wagers` row updates via Supabase Realtime (`REPLICA IDENTITY FULL` for both).
- Recurring push adds "Wager awaiting your action" reminder.

### Security & roles

- Super Admin: full (payment approval, wallet adjust, settlement override, user management).
- Admin: manage wagers, verify payments, live updates, settle, disputes (no wallet override).
- Moderator: view + live match data only.
- All privileged server fns use `requireSupabaseAuth` + `has_role` check before importing `supabaseAdmin`.

### UI/UX

- Glassmorphism cards, gold/emerald accents matching current sportsbook theme.
- Animated status badges, countdown timers (reuses `Countdown`), trophy celebration on settlement (reuses `GlobalWinAnimation`), QR via `qrcode.react`.
- Fully responsive under the existing 1280 canvas.

## Technical notes

- Single migration file for all P2P schema + GRANTs + policies + triggers + functions.
- Client files: `src/lib/wagers.ts` (queries/helpers), `src/lib/wagers.functions.ts` (server fns), `src/components/wager/*` (BetSlip, LiveMatch, ChallengeForm, StatusBadge, ActionBar), route files under `src/routes/wagers.*`, admin panel + wired into `admin.tsx` Quick Actions.
- Nav pinning done in `src/components/Layout.tsx` with `flex` + `overflow-x-auto` for the scroll region and `sticky right-0` for the pinned group with a `bg-gradient-to-l` mask; home-page suppression via a `hideTopNav` prop or route check.
- Admin tile size change is a single class swap in the Quick Actions grid.

## What's NOT in this turn

- SMS/email delivery for the new notification kinds beyond the existing push/in-app channels.
- Custom payment-provider integration (spec says manual admin verification — I'll build that flow, no Stripe/Paddle).
- Automated fraud detection heuristics (admin can still terminate manually).

Reply "go" to build, or tell me what to cut/add before I start.