# State (Nov 15, 2026, brief 04 done)

## Live now
- Site EN + /es. Ad page /home-sweet-home. Ads paused; they can relaunch after OWNER-ACTIONS 7–9 (Meta check done
  Nov 15 on the live site: Lead browser + server, deduplicated).
- Brief 01: migrations in every production build, `system_events` alerts, /api/cron/health daily.
- Brief 02: one booking path, /book (+/es) = RequestFlow; /admin → Requests (Text, Confirm & send pay link, Other
  time, Decline, Delete); /backdrop = "Prepare for your session".
- Brief 03: Lead per request (browser + CAPI, 1 per person per 30 days), first/last touch + Meta ad ids on requests,
  server-only Schedule, Contact on sms/tel, no Pixel on token pages, owner booking Source, CAPI v27.
- Brief 04: /quick, /due-date (+done), /feedback, /unsubscribe and /admin/unfinished are gone (404, no redirects).
  Due-date deposits pay at /pay?d=<ref>&k=<sig> (lib/due-date duePayment; Stripe returns to /pay/status?s=reserved).
  "Not born yet?" buttons open /book?when=due. The step counter stays (lib/funnel, config/funnel, funnel_counts).
  Migration 0041 copied open due-date reservations into Requests (reference TH-R-D-…, due_id) and dropped
  quick_requests, booking_drafts, booking_draft_forms, email_unsubscribes, marketing_settings, trip_settings (owner OK
  Nov 15). Privacy Policy: unfinished-booking sentences removed (owner-approved Nov 15).
- Checklist (brief 04): ads use no /quick or /due-date links (owner); Instagram bio → landing page, Google → home (fine);
  emails/cron repointed (deposit reminders link /pay?d=); open records: Daniela Fabelo and Gueldine Dor (due-date
  reservations, deposit not paid) now show in Requests as "Waiting on the deposit".

## Next: brief 05 (landing page)
- Read plan/briefs/05-*.md.

## Waiting on owner
- Daniela Fabelo and Gueldine Dor: their old /due-date/done links stopped working. Send each a new one: /admin → Leads
  → Not paid → "Email deposit reminder" (it links /pay?d=…).
- Spanish for a native reviewer: the Privacy Policy's new step-counter sentence; pay.reserved ("Your spot is reserved").
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. /admin → Photos: "IMG 7378", "IMG 6087".
  CSP report-only: enforce after reading `csp` logs. Parked branches: `feat/shoot-waiver`, `feat/details-message`.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf: no street yet), baby_age "". New UI: CSS modules + theme
  variables until brief 07. QuickPrice (home price box) is separate from the retired /quick and stays.
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() before the first fill; route.fetch() for POSTs in WebKit; scope alerts to `main`; request tests
  take their own day per browser (dayFor); Spanish pages are off; the Pixel is off (stub window.fbq to test events).
- Local checks: scripts/local-db (fake Outlook, Stripe, Resend, Meta: META_GRAPH_BASE_URL; never on Vercel).
