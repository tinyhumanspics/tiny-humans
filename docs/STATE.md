# State (Nov 14, 2026, brief 02 session 2 of 3)

## Live now
- Site EN + /es. Ad page /home-sweet-home. Ads paused (owner, Nov 14). /book = old 6-step form with Stripe deposit,
  trip days, drafts; /due-date, /quick; InitiateCheckout on form open, Schedule per booking.
- Brief 00 docs; brief 01: migrations in every production build, `system_events` alerts, /api/cron/health daily.
- Brief 02, hidden from families: /book/new (+/es) = RequestFlow (When → Your details → Request sent), 12 h holds,
  owner + parent emails (part 1). /admin → Requests (part 2, first in the menu): Text (hello sms), Confirm & send pay
  link (date → owner booking, 48 h hold, family link /book?…&deposit=&k=, deposit email; due date → due-date
  reservation, link /due-date/done?r=&k=, its deposit email counts as the reminder), Other time (owner calendar),
  Decline (optional kind email). Paid deposit → request `booked` (confirmPaid, dueDepositPaid).
- /backdrop?t= is now "Prepare for your session": street, city, gate notes, baby name(s), backdrops, photo OK, until
  the day before. Confirmation email shows a "Prepare" button while the street is missing; a save rebuilds the
  Outlook event (body + location).

## Next: brief 02 session 3 (the switch)
- /book + /es/book → RequestFlow; delete the old steps, drafts, trip days (incl. tripConflict in createBooking),
  in-flow deposit + DEPOSIT_HOLD_MINUTES, InitiateCheckout, intro skip entry. Tick the brief's acceptance list.
- Keep working: owner-booked pay links /book?…&deposit=&k= (OwnerBookedSteps: the link texted from Requests) and
  /book?due= schedule links (reservations made from Requests have no street: that form must ask for it).

## Waiting on owner
- Vercel Production env: ALERT_EMAIL=support@tinyhumans.photography, GRAPH_SECRET_EXPIRES=2028-10-04 (then redeploy).
- Before session 3 goes live: Privacy Policy wording for requests and the lawyer's text-consent wording
  (TEXT_CONSENT_VERSION in lib/requests/types.ts; OWNER-ACTIONS 10).
- Waiver link on the prepare page: the release is signed at the session today; signing from home is a new legal flow.
- Spanish for a native reviewer: bookingRequest (+texts), emails.requestReceived/requestDeclined/prepare,
  backdropPage.prep; waiver + privacy wording.
- plan/OWNER-ACTIONS.md 10–13. Feb 1 → Valentine's theme, back Mar 1. /admin → Photos: "IMG 7378", "IMG 6087".
  CSP report-only: enforce after reading `csp` logs. Parked branches: `feat/shoot-waiver`, `feat/details-message`.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Quotes / Booking keeps the quick form's list until brief 04 deletes /quick. New UI: CSS modules + theme
  variables until brief 07 (Tailwind).
- Request bookings: location_address "FL 33139" (homeOf: no street yet), baby_age "". Confirm prices at today's
  offer, not the request's snapshot.
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() before the first fill; route.fetch() for POSTs in WebKit; scope alerts to `main`; request tests
  take their own day per browser; Spanish pages are off in e2e. Commit as tinyhumanspics <hello@tinyhumans.photography>.
