# Plan: Desktop-first redesign + 6 targeted fixes

This is a large batch. Confirm the plan (or trim it) before I start; I'll then ship it across a few sequential edits.

## 1. Responsive redesign — mobile shows the desktop layout, scaled

Goal: on a phone, every page renders the current desktop composition (same columns, cards, tables, spacing). The user should not need to pinch or side-scroll.

**How:**
- Set a viewport meta with `initial-scale` computed from device width vs a fixed design width (1280px). We already have `viewport-fit=cover`; switch the site to a **fixed-width design canvas** approach: wrap `<body>` content in a shell that is `min-width: 1280px` and let the browser scale via `<meta name="viewport" content="width=1280">`. This forces mobile Chrome to render the page at 1280px and fit-to-screen, which is exactly "mobile looks like desktop, no pinch".
- Add a runtime hook in `__root.tsx` that reads `window.innerWidth` / `window.screen.width` to detect true desktop-site mode (>= ~1400 effective px) and swaps the viewport tag to `width=device-width` so real desktops and "Desktop Site" get the wider expanded layout.
- Introduce a new Tailwind breakpoint tier used by containers:
  - default (mobile with viewport=1280): current `md/lg` desktop layout.
  - `xl:` (≥1400): wider max-width (e.g. `max-w-[1600px]`), extra column on grids, larger gaps.
- Remove `useIsMobile()` gated hiding on major pages (matches, home, dashboard, sidebar, admin) — anything currently hidden `<md` becomes always-visible. `useIsMobile` stays for genuine touch-only affordances (drawer vs sidebar).
- Sidebar: on the fixed 1280 canvas it can render as the desktop sidebar by default; keep the hamburger only for the "expanded desktop" tier if the design prefers.

**Risk / caveats I want you to confirm:**
- `width=1280` viewport means text is physically smaller on phones (readable but small). This is the tradeoff you asked for.
- Any component that used `100vw`/`100dvh` for full-screen overlays will still fill the viewport correctly.
- Admin panels tuned with `useIsMobile` drawers will now show desktop tables on phones — that's the intent.

## 2. Team Wizard → single form

Rewrite `MatchWizard` (5-step) in `src/routes/admin.tsx` as one form matching the ShooterMatchWizard shape: home team, away team, kickoff, odds, featured toggle, image + fit/position, confirmation dialog. Reuse the existing confirmation dialog pattern. Restyle both wizards with the gold/emerald glass tokens (cards, gradient header, section headings) so they no longer look plain.

## 3. Login gate — guests can't reach `/`

- Wrap `Outlet` (or add `beforeLoad` on `__root`) so that if `!session` and route isn't in a public allow-list (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/about`, `/faq`, `/guides/how-it-works`, `/api/*`, `/sitemap.xml`), redirect to `/login`.
- Login/register: if session exists, redirect to `/`.
- Keep SEO-critical public pages (about/faq/guides) reachable so crawlers still index — confirm if you want those gated too.

## 4. Recurring push not firing

- Verify the `pg_cron` job actually calls `/api/public/hooks/recurring-push` (check `cron.job` / `cron.job_run_details`). If missing or failing, reinstall the schedule.
- Fix the motivational/encouragement selector: currently it may reuse a fixed row instead of rotating; store `last_sent_index` per type in `recurring_push_settings` and advance by 1 each run, wrapping at total count.
- Log each dispatch to `push_broadcasts` so we can see what actually went out.

## 5. Guests subscribe to push

- Change `PushPermissionPrompt` + `subscribeToPush` to not require `user_id`. Insert into `push_subscriptions` with `user_id = null` for guests; RLS: add anon INSERT policy scoped to own endpoint. Audience filtering already tolerates null `user_id` for "any / anonymous" audience.

## 6. Date demarcations on ended matches

- In `src/routes/matches.tsx` (ended tab) and the admin Ended tab, group the list by `ended_at`/`date` day. Insert a sticky separator row (`── July 18, 2026 ──`) between groups. Use `Intl.DateTimeFormat` in project locale, sorted newest first.

## Order of shipping (sequential to reduce blast radius)
1. Login gate + guest push subscribe (small, safe).
2. Date demarcations (small, isolated).
3. Recurring push fix + verification.
4. Team Wizard single-form + wizard UI polish.
5. Responsive viewport switch + `useIsMobile` audit — done last because it affects every page.

Reply "go" to ship, or tell me which items to drop / reorder.
