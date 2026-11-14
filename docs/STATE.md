# State (Nov 14, 2026, brief 02 session 1 of 3)

## Live now
- Site EN + /es. Ad page /home-sweet-home. Ads paused (owner, Nov 14). /book = old 6-step form with Stripe deposit,
  trip days, drafts; /due-date, /quick, quick-price box; InitiateCheckout on form open, Schedule per booking.
- Brief 00: AGENTS.md, this file, docs/DECISIONS.md; old docs in docs/archive/.
- Brief 01: scripts/migrate.mjs applies migrations in every production build (confirmed in the build log). Failure log
  `system_events` + lib/monitoring: critical alerts to ALERT_EMAIL (1/area/hour); /api/cron/health daily.

## In progress: brief 02 (new /book)
- Session 1 done: /book/new + /es/book/new (hidden: noindex, not linked, no intro) = RequestFlow
  (features/booking/request): When (Baby is here: day + time / Not born yet: due date; bundle row + change; twins) →
  Your details (4 boxes, text consent unticked, "Send request") → Request sent. POST /api/booking/request →
  lib/requests (table booking_requests, 0037): price snapshot, travel, 12 h hold (both providers' availability skip held
  times), owner + parent emails, onRequestCreated hook (empty: brief 03), funnel ids when_viewed/when_done/
  details_viewed/request_sent. Tests: tests/e2e/book-request.spec.ts, tests/unit/requests.test.ts.
- Session 2: /admin → Requests (Text, Confirm & send pay link via the owner booking path: it must ignore the request's
  own hold; Other time; Decline), request → booked when the deposit is paid, "Prepare for your session" (extend /backdrop).
- Session 3: /book → RequestFlow, delete the old steps, drafts, trip days, in-flow deposit, InitiateCheckout; keep
  working: /book?due= links and owner-booked links (/book?…&deposit=, OwnerBookedSteps) or move them first.
- New UI uses CSS modules + theme variables: Tailwind arrives with brief 07 (AGENTS rule 9).
- Branches never merged: `feat/shoot-waiver`, `feat/details-message` (parked).

## Waiting on owner
- Vercel Production env: ALERT_EMAIL=support@tinyhumans.photography, GRAPH_SECRET_EXPIRES=2028-10-04 (then redeploy).
- Before session 3 goes live: the Privacy Policy wording for requests (first name, mobile, email, ZIP, text consent)
  and the lawyer's text-consent wording (TEXT_CONSENT_VERSION in lib/requests/types.ts; OWNER-ACTIONS 10).
- Spanish for a native reviewer: bookingRequest + emails.requestReceived; waiver + privacy wording.
- plan/OWNER-ACTIONS.md 10–13 in parallel. Feb 1 → Valentine's theme, back Mar 1.
- /admin → Photos: "IMG 7378", "IMG 6087" still named by file. CSP report-only: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- Commit: `npx tsc --noEmit -p . --incremental false` first; as tinyhumanspics <hello@tinyhumans.photography>.
- e2e: wait for hydration before the first fill (tests/e2e/fixtures/hydration.ts); route.fetch(), not continue(),
  for POSTs in WebKit; request tests take their own day per browser (holds are shared). Don't judge by --repeat-each.
