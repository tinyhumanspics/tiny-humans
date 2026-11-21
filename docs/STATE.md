# State (Nov 20, 2026, brief 05 session 1 of 2 done + owner requests)

## Live now
- Site EN + /es. Briefs 01–04 done (DECISIONS.md). Ads relaunch after OWNER-ACTIONS 7–9.
- Ad page /home-sweet-home (+/es): H1 by `?c=a|b|c`, "Check dates" → /book?bundle=<middle>&compare=1 + ad params.
- Home (owner Nov 16) = the ad page (`heading`): "Tiny moments. Big memories.", animated top.
- /portfolio (+/es): photo wall. Menu: Home · Portfolio · Bundles · Book. /bundles: "Not born yet?" link.
- /book: bundles side by side (middle checked, calendar showing); a bundle card's link shows that pick + Change.
- Pay link: 1) home + baby name, boy/girl (optional) 2) backdrops 3) deposit (Pay unlocks once the home is saved).
- Trip days (Nov 16, `tripDays`): 70+ miles takes the day; /book, requests and reschedules check it; not owner bookings.
- /admin → Leads opens on Confirmed: next session first, then "Date passed"; Past 10 days after. Each lead: "Emails
  sent to …" = every family email (sendEmail logs it, `sent_emails` 0044) + Resend's delivered/bounced (webhook).
- /admin → Quotes / Booking → "Send a booking link" (Nov 19): bundle, babies, ZIP, day, time → /book?link= (0043).
- Day-before email (Nov 20): "Before we arrive" (night before, on the day, numbered steps; family line for family bundles).
- Photo extras (owner Nov 20, 0045): sneak-peek + gallery emails → signed /extras → Stripe (kind photo_extras) → order
  paid, family + studio emails. Extra photos (capped) come with the finished gallery, after it in their own hours; full
  gallery (− extras paid); RAW files. Prices/promises/open days: /admin → Pricing. Lead block: totals, Delivered tick.

## Next: brief 05 session 2
- Bundles page = same `showOnLanding` tiers and order (then the /admin switch label adds it).
- Chalk intro never on /book, /bundles, /about, once per visitor on home; Reveal fades in once, never out.
- /es: English seasonal block, "Offerta de Accion de Gracias", review "en inglés" in Reviews, React #418.
- Real alts site-wide; logo layers; Lighthouse LCP ≤ 2.5 s + axe on the ad page and home; policy words → brief 06.
- Brief 06: /api/booking/quote + HttpBookingClient.quote have no UI caller.

## Waiting on owner
- /admin → Photos: "Big top photo"; rename "IMG 6087", "IMG 7378", "UPDATED 10"; Spanish photo names.
- Geraldine (Dec 10): her address via her link/Prepare page, or an /admin "Edit address" (owner to pick).
  Spanish offer label "Offerta de Accion de Gracias" → "Oferta de Acción de Gracias" (/admin → Pricing).
- "From $179.10" while the 10% Thanksgiving offer runs (ends Nov 23).
- Spanish review: es.json `landing`, home.hero.eyebrow, portfolioPage, header.home, bundlesPage.section.due,
  bookingRequest.when (twinsPerks, hereHelp, notBornHelp, bundle, change), bookingRequest.link + texts.link, prep gender,
  bookingFlow.errors.tripDay, Privacy step-counter sentence, pay.reserved, emails.reminder24.before + prepGuide 2–3,
  extras, emails.extrasPaid + afterSession.extras*, Terms photos + Privacy Stripe line.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf), baby_age "". CSS modules + theme variables until brief 07.
- Database-only objects: bookings.blocked_until + bookings_no_overlap (0015), waiver trigger (0023),
  shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Migrations: `npm run db:generate`, add-only, safe twice (drops: owner OK + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date, extras and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
  `next dev` may append to AGENTS.md (agent rules): revert it.
- e2e: hydrated() first; calendarReady() (one grid); a day per browser; no Spanish, no Pixel, no database.
