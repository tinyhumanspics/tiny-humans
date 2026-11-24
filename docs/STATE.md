# State (Nov 23, 2026: brief 05b built; Nov 24 checks the offer is gone, ticks acceptance)

From Nov 21 Carlos builds the site: wherever AGENTS.md or a brief says "ask the owner", ask Carlos.

## Live now
- Site EN + /es. Briefs 01–05 and 05b done. Ads relaunch after OWNER-ACTIONS 7–9.
- Owner (Nov 23–24): intro on every home load; Shoots: Signature poses, Family photos; no /admin footer;
  bundle looks (0048) on cards + /book; /book prop ideas → booking notes.
- Ad page /home-sweet-home (+/es): no menu, H1 by `?c=a|b|c`, 200 px photo, review capped at 2 lines on phones.
  /es price line: "Traslado gratis hasta 20 millas de Miami Beach" (20 free mi, Nov 24).
- /book: bundle radio rows, 2-column times, screen 2 a form. Help line: "Best at days 5–14, up to 4 weeks."
- Pay link (decision #22): the $50 first; after paying, the same
  page asks home + ages (required) + backdrops, each a form; saves rebuild the Outlook event. Both reminders ask for
  home + ages (button to the link) until saved. Owner email/text name the new order.
- Every Lead carries `lead_source` ("website" / "booking_link"): Conversions API, browser Pixel and the CAPI log line.
- Smooth scrolling only without reduced motion (lib/scroll.ts) on /book, cancel, reschedule, review and the logo.

## Next
- Nov 24 (after midnight Miami): on production, ad page, home, /bundles, /book, EN + ES: no "Offer ends", was/now,
  offer badge or cents price. No code change needed (task 11 audit, Nov 23): every surface goes through
  `activeOffer(bundle, today in Miami)`, pages render per request, no seasonal box renders any more. Then measure
  the 4 first screens at 390 × 664 and tick 05b's acceptance.
- Then wait for Carlos's updated brief 06 (+ pre-render/page speed).

## First phone screen at 390 × 664 (iPhone WebKit, production; fold 664)
- Nov 24 owner: /book looks box (~140 px): menu /book month header ~750 (below fold); from a card ~640.
- Nov 24 forecast (regular prices, new travel line): /es ad page 660 (2 lines),
  /es/book 655 (cents were what wrapped the rows); EN 660 / 635. All fit. Adrian's Pricing rows (05b owner step)
  forecast the same 655. 4–9 px to spare: re-measure after Spanish copy or bundle changes.

## Waiting on owner (Carlos)
- Adrian, /admin → Pricing (05b owner steps 1–2): new bundle prices/hours/photos; Spanish features.
- Spanish review: docs/spanish-review.md (Adrian or Alondra), session 2 strings + the travel line added.
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
