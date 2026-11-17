# State (Nov 16, 2026, brief 05 session 1 of 2 done + owner requests)

## Live now
- Site EN + /es. Ads paused; they can relaunch after OWNER-ACTIONS 7–9. Briefs 01–04 done (see DECISIONS.md).
- Ad page /home-sweet-home (+/es): photo first, H1 by `?c=a|b|c`, "Check dates" → /book?bundle=<middle>&compare=1 +
  the ad's parameters, price line from /admin, review, "Text us", seasonal box (no button). Bundles with "Show on the
  ad page" on (0042). "Orlando" only in "Where we go".
- Home (owner Nov 16) = the ad page (LandingPage `heading`): "Miami to Orlando" + "Tiny moments. Big memories.",
  animated top; same photos as the ad page. JSON-LD keeps its own Miami→Orlando cities.
- /portfolio (+/es): the theme's "Little moments" as a photo wall + "Check dates". Menu: Home (a chalk house on
  phones) · Portfolio · Bundles · Book (→ /book). Quick price box deleted. /bundles: "Not born yet? Book with your
  due date →" under the heading (the box is gone).
- /book: bundles side by side with features; a bundle card's link shows that pick + Change; Check dates, the menu
  and Not born yet open the comparison with the middle bundle checked (calendar showing). Twins line shows the
  bundle's extra minutes/photos. Timing copy everywhere: "after baby's first two weeks" (owner).
- Pay link (owner Nov 16): 1) the family's home (street, city, gate notes; the request's ZIP) 2) backdrops 3) deposit;
  Pay unlocks once it's saved (location_address + booking_access) → /admin Directions, calendar, emails.
- Trip days (owner Nov 16): 70+ miles takes the day, same trip within 30 miles, next morning free until 12 PM
  (config/booking.ts `tripDays`, no /admin); /book's calendar applies them once the ZIP is typed; requests and family
  reschedules re-check. The owner's own bookings and confirms aren't limited.
- /admin → Photos by page (Home and Ad Page · Portfolio · About Us · Emails) + "Copy all pictures from" a theme.

## Next: brief 05 session 2
- Bundles page = same `showOnLanding` tiers and order (then the /admin switch label adds it).
- Chalk intro never on /book, /bundles, /about, once per visitor on home; Reveal fades in once, never out.
- /es: English seasonal block, "Offerta de Accion de Gracias", review "en inglés" in Reviews, React #418.
- Real alts site-wide; logo layers; Lighthouse LCP ≤ 2.5 s + axe on the ad page and home; policy words → brief 06.
- Brief 06: /api/booking/quote + HttpBookingClient.quote have no UI caller (quick price box gone).

## Waiting on owner
- /admin → Photos: "Big top photo"; rename "IMG 6087", "IMG 7378", "UPDATED 10"; Spanish photo names.
- Geraldine (Dec 10): she types her address on her link or Prepare page, or we add an /admin "Edit address" (owner to pick).
  Spanish offer label "Offerta de Accion de Gracias" → "Oferta de Acción de Gracias" (/admin → Pricing).
- "From $179.10" while the 10% Thanksgiving offer runs (ends Nov 23).
- Spanish review: es.json `landing`, home.hero.eyebrow, portfolioPage, header.home, bundlesPage.section.due,
  bookingRequest.when (twinsPerks, hereHelp, notBornHelp, bundle, change), bookingFlow.errors.tripDay, Privacy
  step-counter sentence, pay.reserved.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf), baby_age "". CSS modules + theme variables until brief 07.
- Database-only objects: bookings.blocked_until + bookings_no_overlap (0015), waiver trigger (0023),
  shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Migrations: `npm run db:generate`, add-only, safe twice (drops: owner OK + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() first; calendarReady() (one grid); a day per browser; no Spanish, no Pixel, no database.
