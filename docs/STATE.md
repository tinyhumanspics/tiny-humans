# State (Nov 21, 2026, brief 05b session 1 of 2 done)

From Nov 21 Carlos builds the site: wherever AGENTS.md or a brief says "ask the owner", ask Carlos.

## Live now
- Site EN + /es. Briefs 01–05 done; 05b session 1 (tasks 1–8). Ads relaunch after OWNER-ACTIONS 7–9.
- Ad page /home-sweet-home (+/es): no menu (plain logo, EN | ES), H1 by `?c=a|b|c`, 200 px photo on phones;
  photo, H1, line, Check dates, price and a 2-line review fit 390 × 664. No eyebrows on any public page.
- Home = the ad page with "Tiny moments. Big memories."; chalk intro only here, once per visitor.
- /bundles: the ad page's tiers, cheapest first; cards say "Check dates" → /book?bundle=<id>.
- /book: bundles as a radio group (phone rows, "Most loved" badge on the border, includes line), 2-column times,
  screen 2 a form (Enter on ZIP sends), new Request sent screen; month header fits 390 × 664.
- Timing everywhere: best days 5–14, up to 4 weeks. Seasonal offer boxes are off public pages (Carlos #26).
- Pay link: home + ages → backdrops → deposit (session 2 reorders it). Trip days, Leads, booking links, extras.

## Next: brief 05b, session 2 (tasks 9–12)
- 9 pay link $50 first; 10 lead_source; 11 Thanksgiving offer gone (ends Nov 23); 12 Spanish list.
- Spanish strings go in docs/spanish-review.md with key + EN + ES (Carlos, Nov 21); STATE.md only points there.
- docs/DECISIONS.md is 6.0 of 6 KB (doc-sizes test): shorten a line for each one you add.
- After session 2: "Next: wait for Carlos's updated brief 06". Pre-render/page speed goes into brief 06 (Carlos).

## Waiting on owner (Carlos)
- Adrian, /admin → Pricing (05b owner steps 1–2): new bundle prices/hours/photos; Spanish features.
- Spanish review: docs/spanish-review.md (Adrian or Alondra).
- /admin → Photos: "Big top photo"; rename "IMG 7378", "UPDATED 10", "Adrian BTS", "Alondra BTS"; Spanish photo
  names ("manda" → "manta"; accents in "Bebé", "Detrás", "Cálido").
- Geraldine (Dec 10): her address via her link/Prepare page, or an /admin "Edit address" (owner to pick).
- Policy words ("your baby sets the pace" in hero subs) → brief 06. /admin Seasonal screen → brief 06.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf), baby_age "". CSS modules + theme variables until brief 07.
- Database-only objects: bookings.blocked_until + bookings_no_overlap (0015), waiver trigger (0023),
  shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Migrations: `npm run db:generate`, add-only, safe twice (drops: owner OK + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date, extras and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
  `next dev` may append to AGENTS.md (agent rules): revert it.
- e2e: hydrated() first; calendarReady() (one grid); a day per browser; no Spanish, no Pixel, no database. Fixture
  dates age: date by today. Local WebKit: `npx playwright install webkit`. Run unit tests after docs edits too.
