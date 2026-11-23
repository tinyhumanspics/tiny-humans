# State (Nov 23, 2026, brief 05b session 2 of 2 done; task 11 waits for Nov 24)

From Nov 21 Carlos builds the site: wherever AGENTS.md or a brief says "ask the owner", ask Carlos.

## Live now
- Site EN + /es. Briefs 01–05 and 05b done (05b task 11 on Nov 24). Ads relaunch after OWNER-ACTIONS 7–9.
- Ad page /home-sweet-home (+/es): no menu, H1 by `?c=a|b|c`, 200 px photo, review capped at 2 lines on phones.
- /book: bundle radio rows, 2-column times, screen 2 a form. Help line: "Best at days 5–14, up to 4 weeks."
- Pay link (decision #22): the $50 first (total with travel, refund line above the button); after paying, the same
  page asks home + ages (required) + backdrops, each a form; saves rebuild the Outlook event. Both reminders ask for
  home + ages (button to the link) until saved. Owner email/text name the new order.
- Every Lead carries `lead_source` ("website" / "booking_link"): Conversions API, browser Pixel and the CAPI log line.
- Smooth scrolling only without reduced motion (lib/scroll.ts) on /book, cancel, reschedule, review and the logo.

## Next
- Nov 24: check the offer is gone (task 11): ad page, home, /bundles, /book, EN + ES: no offer box, was/now, "Offer
  ends" or cents prices. Then re-measure /es at 390 × 664 and tick 05b's acceptance.
- Then wait for Carlos's updated brief 06. Pre-render/page speed goes into brief 06 (Carlos).

## Spanish first screen at 390 × 664 (iPhone WebKit, production; fold 664)
- Before (Nov 22, 05b s1 live): /es ad page review ends 680 px (price line 3 lines with "$179.10");
  /es/book month header 719 px (help 3 lines; rows end 589 px, names wrap beside offer cents). EN: 660 / 655.
- After (Nov 23, session 2 live): /es ad page review 680 px (unchanged; price line still 3 lines); /es/book month
  header 699 px (help 2 lines; rows end 569 px). EN: 660 / 635. Both /es screens still don't fit.
- Review was already 2 lines; what's left is the price line and the bundle rows. The offer's cents end Nov 23 and
  Adrian's Pricing step changes the rows: measure again on Nov 24 before changing any layout.

## Waiting on owner (Carlos)
- Adrian, /admin → Pricing (05b owner steps 1–2): new bundle prices/hours/photos; Spanish features.
- Spanish review: docs/spanish-review.md (Adrian or Alondra), session 2 strings added.
- /admin → Photos: "Big top photo"; rename "IMG 7378", "UPDATED 10", "Adrian BTS", "Alondra BTS"; Spanish photo
  names ("manda" → "manta"; accents in "Bebé", "Detrás", "Cálido").
- Geraldine (Dec 10): her address via her link/Prepare page, or an /admin "Edit address" (owner to pick).
- Policy words ("your baby sets the pace" in hero subs) → brief 06. /admin Seasonal screen → brief 06.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf), baby_age "". CSS modules + theme variables until brief 07.
- Pay-link bookings confirm before the home is saved: the confirmation email shows its "Prepare" block (no ages).
- Database-only objects: bookings.blocked_until + bookings_no_overlap (0015), waiver trigger (0023),
  shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Migrations: `npm run db:generate`, add-only, safe twice (drops: owner OK + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date, extras and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
  `next dev` may append to AGENTS.md (agent rules): revert it. docs/DECISIONS.md is at 6 KB: shorten as you add.
- e2e: reduced motion (intro spec opts out); hydrated() first; calendarReady(); a day per browser; no Spanish, Pixel
  or database. Fixture dates age: date by today. Run unit tests after docs edits too.
