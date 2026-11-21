# State (Nov 21, 2026, brief 05 done)

From Nov 21 Carlos builds the site: wherever AGENTS.md or a brief says "ask the owner", ask Carlos.

## Live now
- Site EN + /es. Briefs 01–05 done (DECISIONS.md). Ads relaunch after OWNER-ACTIONS 7–9.
- Ad page /home-sweet-home (+/es): H1 by `?c=a|b|c`, "Check dates" → /book?bundle=<middle>&compare=1 + ad params.
  Lighthouse mobile (Nov 21, production, warm): LCP 1.4 s, perf 100, a11y 100; home the same.
- Home = the ad page with "Tiny moments. Big memories."; chalk intro only here, once per visitor (localStorage).
- /bundles = the same "Show on the home page, the ad page and Bundles" tiers, cheapest first (`shownBundles`).
- /portfolio photo wall; /book bundles side by side; pay link: home + baby age, name, boy/girl → backdrops → deposit.
- Trip days (70+ miles takes the day). /admin → Leads (Confirmed first, Past after 10 days, emails + delivery),
  Quotes / Booking → "Send a booking link", day-before "Before we arrive", photo extras (0045).
- Alt text: file-name photo names fall back to a description (`altOf`, config/media); stand-in pictures never show
  once photos are saved. /es: no seasonal box whose Spanish is a copy of the English; other-language reviews labelled.

## Next: brief 05b, session 1 (tasks 1–8)
- Its owner steps (Adrian, /admin → Pricing) don't block building: new bundle prices/hours/photos, Spanish features.
- After 05b session 2: "Next: wait for Carlos's updated brief 06". Don't start the old brief 06.

## Waiting on owner (Carlos)
- Pre-render public pages as their own slice after 05b (Carlos, Nov 21): every page renders per request (the root
  layout reads the language header), so first byte is 0.3–1.8 s and a cold server can push LCP past 2.5 s.
- /admin → Photos: "Big top photo"; rename "IMG 7378", "UPDATED 10", "Adrian BTS", "Alondra BTS"; Spanish photo
  names ("Bebe en una manda acogedora" → "manta", accents in "Bebé", "Detrás", "Cálido").
- /admin → Seasonal: type the Christmas box's Spanish, or /es shows no box (automatic translation is off: needs a
  translation key in Vercel, a paid service, ask first).
- Geraldine (Dec 10): her address via her link/Prepare page, or an /admin "Edit address" (owner to pick).
- Policy words ("your baby sets the pace" in hero subs) → brief 06.
- Spanish review: es.json `landing`, home.hero.eyebrow, portfolioPage, home.portfolio.photoAlt, header.home,
  bundlesPage.section.due, bookingRequest.when (twinsPerks, hereHelp, notBornHelp, bundle, change),
  bookingRequest.link + texts.link, prep gender, bookingFlow.errors.tripDay, Privacy step-counter sentence,
  pay.reserved, emails.reminder24.before + prepGuide 2–3, extras, emails.extrasPaid + afterSession.extras*,
  Terms photos + Privacy Stripe line, depositReturn age*.
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
  dates age (a lead turns Past 10 days after its date): date by today. Local WebKit: `npx playwright install webkit`.
