# State (Nov 14, 2026)

## Live now
- Site EN + /es (Spanish switch in /admin → Settings). Ad page: /home-sweet-home.
- /book: you → date → time → contact → details → review, $50 deposit on Stripe (30-min hold), trip days, unfinished-booking
  drafts. Also live: /due-date (Not born yet, 4 steps, $50), /quick (quick form), "Get a quick price" box (home + ad page).
- /admin: Dashboard, Leads, Quotes / Booking ("Book it for them": 48 h hold + pay link), Availability, Pricing, Photos,
  Theme, Seasonal Landing, Shoots, Unfinished bookings, Settings.
- Meta Pixel + CAPI: InitiateCheckout once when the form opens, Schedule once per booking (shared event id).
- Brief 00 done: AGENTS.md rules, this file, docs/DECISIONS.md; old docs in docs/archive/.

## In progress
Nothing on main. Branches never merged: `feat/shoot-waiver` (waiver inside each shoot folder, previewed Nov 11, not
approved) and `feat/details-message` (parked by the owner).

## Next brief
plan/briefs/01-safety-net.md. Its owner steps: (1) Entra → App registrations → Certificates & secrets: note the client
secret's expiry date; (2) which email address gets failure alerts.

## Waiting on owner
- plan/OWNER-ACTIONS.md now: 1 pause or cut the ads · 3 note each ad set's optimization event · 4 set the three newborn
  bundles in /admin (before brief 02 goes live) · 5 let the Thanksgiving offer end Nov 23. In parallel: 10–14.
- Run in Neon if not done: drizzle/0033_shoot_sections.sql, drizzle/0034_quick_requests.sql (safe twice).
- Spanish for a native reviewer: waiver + privacy wording.
- Feb 1: theme → Valentine's in /admin → Theme; switch back Mar 1.
- /admin → Photos: two photos are still described by file name ("IMG 7378", "IMG 6087").
- CSP is report-only since Oct 12: enforce once the Vercel `csp` log warnings are read.

## Fixed in AGENTS.md (brief 00)
Rule 5 listed em, ph, fn, zp, external_id; the live Pixel and CAPI also send hashed ln, ct, st, country
(lib/tracking/meta-capi.ts, lib/tracking/client.ts).

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Database-only objects, not in lib/db/schema.ts: bookings.blocked_until + bookings_no_overlap (0015), the waiver
  trigger (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Until brief 01 lands: run a migration in production BEFORE deploying code that adds columns to schema.ts.
- ADMIN_SESSION_SECRET also signs pay, due-date and waiver-copy links: never rotate it.
- The folder is on the iCloud Desktop: " 2" duplicates appear; never git stash/switch there (use a git worktree).
- The owner often runs `npm run dev` on :3000: stop only your own servers, by port.
- Before committing: `npx tsc --noEmit -p . --incremental false` (a stale tsbuildinfo can hide errors).
- Commit as tinyhumanspics <hello@tinyhumans.photography>, no AI co-author trailers.
