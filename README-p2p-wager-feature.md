# P2P Wager System (feature/p2p-wager-system)

This branch adds the scaffolding and core assets for a Player-vs-Player (P2P) Wager system and a prominent Admin "WAGER" quick-action. The implementation is intentionally delivered as skeletons so your team can integrate into your specific stack conventions and DB helpers.

What's included (initial commit)
- migrations/20260719_create_wager_tables.sql — Postgres migration to create wager tables and ledger
- src/server/routes/wagers.ts — Express route skeleton for challenges, responses, payments
- src/server/services/wagerService.ts — Service skeleton (TODO: implement database specifics)
- src/server/jobs/wagerTimeoutJob.ts — Cron job to auto-cancel unpaid wagers past deadline
- src/client/components/admin/QuickActions/WagerQuickAction.tsx (+ CSS) — Prominent admin quick-action button (label: WAGER)
- src/client/pages/admin/WagersPage.tsx — Admin Wager Queue page skeleton
- src/client/components/Wager/BetSlip.tsx — Premium bet slip component with QR code

What I will do next
- Implement full service logic to match your DB client and auth middleware
- Add admin endpoints (verify payment, settle, manual updates) and their UI flows
- Add websocket events and client subscriptions for real-time updates
- Add tests and E2E flows

How to apply locally
1. Checkout the branch feature/p2p-wager-system
2. Run database migration (Postgres):
   psql -d <your_db> -f migrations/20260719_create_wager_tables.sql
3. Wire the new routes into your Express app (import and use src/server/routes/wagers.ts)
4. Add the WagerQuickAction component into your Admin Quick Actions UI and import the CSS

If you'd like, I will continue and implement the backend wiring, admin endpoints, and websocket support next. If you prefer to stop here and integrate with your exact DB client/auth stack, I will wait for your feedback.
