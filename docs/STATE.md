# State (Nov 14, 2026, brief 03 done)

## Live now
- Site EN + /es. Ad page /home-sweet-home. Ads paused (owner, Nov 14): they can relaunch once the owner's checks below
  are done (OWNER-ACTIONS 7–9).
- Brief 00 docs; brief 01: migrations in every production build, `system_events` alerts, /api/cron/health daily.
- Brief 02: /book (+/es) = RequestFlow; /admin → Requests (Text, Confirm & send pay link, Other time, Decline,
  Delete); /backdrop = "Prepare for your session"; due-date links and ?inspiration= go through requests.
- Brief 03 (lib/tracking): Lead on each saved request, browser + Conversions API, event_id = request reference, one per
  person (email or mobile) per 30 days (claimLead). Requests save first touch (th_src), last touch (th_last: latest
  landing with tags/ad ids/click id/other site), Meta ad/ad set/campaign ids (?th_ad=&th_adset=&th_campaign=),
  fbp/fbc/IP/UA. Schedule is server-only (lib/tracking/schedule.ts): pay-link deposit paid ("website"), owner-confirmed
  with nothing to pay ("chat"), due-date deposit paid (the reservation's later session isn't counted again); uses the
  request's match data. Contact on sms:/tel: taps. No Pixel on token pages (pixelAllowed). CAPI v27.0. Owner bookings
  ("Book it for them") get a Source (bookings.owner_source; Leads → Source). Request ↔ booking link =
  booking_requests.booking_id. Privacy Policy updated (owner-approved Nov 14).
- Local checks: scripts/local-db/fake-meta.mjs (META_GRAPH_BASE_URL, never on Vercel) records server events.

## Next: brief 04 (remove /quick, /due-date, unfinished bookings)
- Read plan/briefs/04-*.md; its checklist needs the owner (ads, links, open records).

## Waiting on owner
- Meta Test Events check on a preview (never Production): see the owner steps in the last session reply.
- Spanish for a native reviewer: the new Privacy Policy sentences (information + advertising + cookies).
- Brief 04 (with the owner's OK): drop `trip_settings` and the draft tables; rewrite the Privacy Policy's
  unfinished-booking sentences (drafts are no longer captured).
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. /admin → Photos: "IMG 7378", "IMG 6087".
  CSP report-only: enforce after reading `csp` logs. Parked branches: `feat/shoot-waiver`, `feat/details-message`.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- /quick and /due-date still live until brief 04. Requests texts /due-date/done?r=&k= as the due-date deposit link:
  brief 04 must keep it working or move it. Quotes keeps the quick form's list.
- Request bookings: location_address "FL 33139" (homeOf: no street yet), baby_age "". New UI: CSS modules + theme
  variables until brief 07.
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() before the first fill; route.fetch() for POSTs in WebKit; scope alerts to `main`; request tests
  take their own day per browser (dayFor); Spanish pages are off; the Pixel is off (stub window.fbq to test events).
