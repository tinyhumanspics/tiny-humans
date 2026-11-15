# State (Nov 14, 2026, brief 02 done)

## Live now
- Site EN + /es. Ad page /home-sweet-home. Ads paused (owner, Nov 14) until brief 03 is live.
- Brief 00 docs; brief 01: migrations in every production build, `system_events` alerts, /api/cron/health daily.
- Brief 02: /book (+/es) = RequestFlow (features/booking/request): When → Your details → Request sent; nothing paid,
  12 h holds, owner + parent emails, onRequestCreated hook (empty: brief 03). /book also opens the owner's pay links
  (?deposit=&k= → DepositReturn/OwnerBookedSteps) and due-date schedule links (?due= → RequestFlow for that
  reservation: kept price, paid deposit; the owner confirms it like any request). ?inspiration= goes with the request.
- /admin → Requests: Text, Confirm & send pay link (owner booking 48 h / due-date reservation), Other time, Decline,
  Delete (owner, Nov 14: tests). Paid deposit → request `booked`. /backdrop = "Prepare for your session".
- Deleted: old steps + state, /api/booking/create, in-form deposit (openDeposit, release route, pending-tab resume),
  draft capture (/api/booking/draft, saveDraft), trip days (lib, admin, availability zip), InitiateCheckout, /book/new.
- Privacy Policy: request paragraph (owner-approved Nov 14). Text consent wording owner-approved (version 2026-11-14).

## Next: brief 03 (lead + attribution)
- Read plan/briefs/03-*.md. Ads stay paused until it's live.

## Waiting on owner
- Spanish for a native reviewer: the new Privacy Policy paragraph and line (privacy.sections[0]).
- Brief 04 (with the owner's OK): drop `trip_settings` and the draft tables; rewrite the Privacy Policy's
  unfinished-booking sentences (drafts are no longer captured; the old ones stay until brief 04 deletes them).
- plan/OWNER-ACTIONS.md 10–13. Feb 1 → Valentine's theme, back Mar 1. /admin → Photos: "IMG 7378", "IMG 6087".
  CSP report-only: enforce after reading `csp` logs. Parked branches: `feat/shoot-waiver`, `feat/details-message`.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- /quick and /due-date still live until brief 04 (Quotes keeps the quick form's list). The due form's deposit link
  /due-date/done?r=&k= is also what Requests texts for due dates: brief 04 must keep it working or move it.
- Request bookings: location_address "FL 33139" (homeOf: no street yet), baby_age "". Confirm prices at today's
  offer; a due-date link request keeps the reservation's price. New UI: CSS modules + theme variables until brief 07.
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() before the first fill; route.fetch() for POSTs in WebKit; scope alerts to `main`; request tests
  take their own day per browser (dayFor); Spanish pages are off in e2e. Commit as tinyhumanspics.
