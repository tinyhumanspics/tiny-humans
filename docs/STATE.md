# State (Nov 15, 2026, brief 05 session 1 of 2 done)

## Live now
- Site EN + /es. Ads paused; they can relaunch after OWNER-ACTIONS 7–9.
- Briefs 01–04: migrations in every production build + alerts; one booking path /book (+/es) and /admin → Requests;
  Lead / Schedule / Contact to Meta (browser + CAPI); /quick, /due-date and unfinished bookings removed (due-date
  deposits pay at /pay?d=).
- Brief 05 part 1, ad page /home-sweet-home (+/es) rebuilt: photo first (/admin → Photos → Ad landing page → "Hero
  photo", else the first gallery photo), H1 + subhead by `?c=a|b|c` (default a), one label "Check dates" →
  /book?bundle=<middle bundle> plus the ad's own parameters (utm, th_ad…), price line from /admin (lowest bundle ·
  deposit · free miles), one real review, "Text us" sms link. Bundles: those with /admin → Pricing → "Show on the ad
  page" on (migration 0042, default on), cheapest first. "Orlando" only in "Where we go", with the fee. Empty photo
  slots render nothing; file-name and "(placeholder)" alts are replaced. Cut: quick price box, seasonal block,
  open-dates strip, backdrop bonus, "Miami to Orlando", "2-minute". Home JSON-LD keeps its Miami→Orlando cities
  (config/site.ts `areaServed`).

## Next: brief 05 session 2 (same brief; "Continue the plan")
- Nav "Book" → /book. Bundles page: same `showOnLanding` tiers in the same order; then the /admin switch label says
  "…and the bundles page" again.
- Chalk intro never on /book, /bundles, /about; at most once per visitor on home. Reveal: fade in once, never out.
- /es: English seasonal block, "Offerta de Accion de Gracias" typo, English review shown with "en inglés" in Reviews,
  React #418, check the es landing meta description.
- Images: real alts site-wide (home gallery has a "(placeholder)" alt); compress the header logo layers if simple.
- Acceptance: Lighthouse mobile LCP ≤ 2.5 s + axe on the live ad page; policy-checklist words; then STATE → brief 06.

## Waiting on owner
- /admin → Photos → Ad landing page: pick the "Hero photo" (owners' own photo or a setup shot until the release is
  signed). Rename "IMG 6087" (About: Adrian & Alondra; also the ad page's "Who's coming" photo), "IMG 7378",
  "UPDATED 10"; Spanish names: "manda" → "manta", accents (Cálido, Bebé, Detrás).
- /admin → Pricing: check each bundle's "Show on the ad page" switch and that the middle one says "Most loved".
- Little Moments' 10% Thanksgiving offer makes the ad page say "From $179.10": end it or give it a round price.
- Spanish for a native reviewer: all of es.json `landing` (new ad page copy, brief 05); the Privacy Policy's
  step-counter sentence; pay.reserved.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP report-only: enforce after reading `csp`
  logs. Parked branches: `feat/shoot-waiver`, `feat/details-message`.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf: no street yet), baby_age "". New UI: CSS modules + theme
  variables until brief 07. QuickPrice stays on the home page only.
- Database-only objects (not in lib/db/schema.ts): bookings.blocked_until + bookings_no_overlap (0015), waiver trigger
  (0023), shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- New migrations: `npm run db:generate`, safe to run twice, add-only (drops need the owner + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() before the first fill; scope alerts to `main`; request tests take their own day per browser;
  Spanish pages and the Pixel are off; the worktree's .env.local has no database (demo catalog).
- Local checks: scripts/local-db (fake Outlook, Stripe, Resend, Meta); seed deposit_settings, bundle_deposits and
  travel_settings for a full price line. Full-page screenshots hide Reveal sections: scroll first.
