# State (Nov 14, 2026, after brief 01)

## Live now
- Site EN + /es (Spanish switch in /admin → Settings). Ad page: /home-sweet-home. Ads paused by the owner (Nov 14).
- /book: you → date → time → contact → details → review, $50 deposit on Stripe (30-min hold), trip days, unfinished-booking
  drafts. Also live: /due-date (Not born yet, 4 steps, $50), /quick (quick form), "Get a quick price" box (home + ad page).
- /admin: Dashboard, Leads, Quotes / Booking ("Book it for them": 48 h hold + pay link), Availability, Pricing, Photos,
  Theme, Seasonal Landing, Shoots, Unfinished bookings, Settings.
- Meta Pixel + CAPI: InitiateCheckout once when the form opens, Schedule once per booking (shared event id).
- Brief 00: AGENTS.md rules, this file, docs/DECISIONS.md; old docs in docs/archive/.
- Brief 01: AGENTS.md rule 3 is now true. scripts/migrate.mjs runs in every production build (vercel.json buildCommand):
  build log of 5086c36 (owner, Nov 14): "recorded 33 migrations run by hand (through 0032)", "applied: 0033, 0034,
  0035"; 0036 came with the next deploy (036afbd). Failure log
  `system_events` (0036) + lib/monitoring: critical failures (Stripe webhook, calendar add/move, booking/request
  creation) email ALERT_EMAIL at most once per area per hour; /api/cron/health (daily 12:00 UTC) emails the last 24 h
  only when something failed or needs doing, plus "all good" on Mondays; warns 30 days before GRAPH_SECRET_EXPIRES.

## In progress
Nothing on main. Branches never merged: `feat/shoot-waiver` (waiver inside each shoot folder, previewed Nov 11, not
approved) and `feat/details-message` (parked by the owner).

## Next brief
plan/briefs/02-new-book-flow.md (2–3 sessions). Its owner items are done: ads paused, Ads Manager checked (the ad set
optimized for Schedule; switch to Lead at relaunch, after brief 03), bundles set in /admin (owner, Nov 14).

## Waiting on owner
- Vercel → Settings → Environment Variables (Production): ALERT_EMAIL=support@tinyhumans.photography and
  GRAPH_SECRET_EXPIRES=2028-10-04 (owner gave both Nov 14). They apply from the next deploy. Until then alerts go to
  BOOKING_NOTIFICATION_EMAIL and the daily email warns that GRAPH_SECRET_EXPIRES is missing.
- Thanksgiving 10% offer: turned off by the owner Nov 14; no % offers after it.
- plan/OWNER-ACTIONS.md in parallel: 10 lawyer · 11 Google Business Profile + reviews · 12 texting line · 13 landing facts.
- Spanish for a native reviewer: waiver + privacy wording.
- Feb 1: theme → Valentine's in /admin → Theme; switch back Mar 1.
- /admin → Photos: two photos are still described by file name ("IMG 7378", "IMG 6087").
- CSP is report-only since Oct 12: enforce once the Vercel `csp` log warnings are read.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Database-only objects, not in lib/db/schema.ts: bookings.blocked_until + bookings_no_overlap (0015), the waiver
  trigger (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, make them safe to run twice, and only add (a drop/rename needs the owner and a
  `-- destructive-ok:` line). They apply before `next build`, so code and schema ship together.
- ADMIN_SESSION_SECRET also signs pay, due-date and waiver-copy links: never rotate it.
- The folder is on the iCloud Desktop: " 2" duplicates appear; never git stash/switch there (use a git worktree).
- The owner often runs `npm run dev` on :3000: stop only your own servers, by port.
- Before committing: `npx tsc --noEmit -p . --incremental false` (a stale tsbuildinfo can hide errors).
- Commit as tinyhumanspics <hello@tinyhumans.photography>, no AI co-author trailers.
- CI green again at 20ecfa1: WebKit tests typed before React hydrated the box (use tests/e2e/fixtures/hydration.ts
  before the first fill) and stalled on route.continue() POSTs (use route.fetch()). Other WebKit flakes: rerun, fix
  any that fails twice. Repeating e2e (--repeat-each) fills the mock calendar and hits rate limits: don't judge by it.
