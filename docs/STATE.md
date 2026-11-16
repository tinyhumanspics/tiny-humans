# State (Nov 16, 2026, brief 05 session 1 of 2 done + owner requests)

## Live now
- Site EN + /es. Ads paused; they can relaunch after OWNER-ACTIONS 7–9. Briefs 01–04 done (see DECISIONS.md).
- Ad page /home-sweet-home (+/es), brief 05 part 1: photo first (/admin → Photos), H1 by `?c=a|b|c`, one "Check
  dates" → /book?bundle=<middle bundle> + the ad's parameters, price line from /admin, one real review, "Text us".
  Bundles with "Show on the ad page" on (0042), cheapest first. Seasonal box under the hero, no button. "Orlando"
  only in "Where we go". Home JSON-LD keeps its own Miami→Orlando cities (config/site.ts `areaServed`).
- Trip days back (owner Nov 16): 70+ miles takes the day, same trip within 30 miles, next morning free until 12 PM
  (config/booking.ts `tripDays`, no /admin). /book's calendar applies them once the ZIP is typed; requests and
  family reschedules re-check (lib/booking/trips*.ts). The owner's own bookings and confirms aren't limited.

## In progress: preview branch `preview/home-designs` (owner reviewing)
- Home hero A (words left, photos right) or B (centered stage, price tag, portfolio as a photo wall), `?design=b`;
  title stays "Tiny moments. Big memories."; one "Check dates" + price line + review + "Text us" + due-date link.
- /book: bundles side by side with features and a check (owner picked B). /admin → Photos: "Big top photo" first.
- After the pick: delete the other design and the switch, SeasonalOffers' `cta` prop and its message, home.hero
  primaryCta/secondaryCta; quick price box per the owner; update tests; gates; push; delete the preview branch.

## Next: brief 05 session 2
- Nav "Book" → /book; bundles page = same `showOnLanding` tiers and order (then the switch label adds it).
- Chalk intro never on /book, /bundles, /about, once per visitor on home; Reveal fades in once, never out.
- /es: English seasonal block, "Offerta de Accion de Gracias", review "en inglés" in Reviews, React #418.
- Real alts site-wide; logo layers; Lighthouse LCP ≤ 2.5 s + axe on the ad page; policy words; → brief 06.

## Waiting on owner
- Pick home design A or B; keep or delete the "Get a quick price" box.
- /admin → Photos: "Big top photo" for the ad page; rename "IMG 6087", "IMG 7378", "UPDATED 10"; Spanish photo
  names ("manda" → "manta", Cálido, Bebé, Detrás). /admin → Pricing: check "Show on the ad page".
- "From $179.10" while the 10% Thanksgiving offer runs (ends Nov 23).
- Spanish review: es.json `landing`, bookingFlow.errors.tripDay, Privacy step-counter sentence, pay.reserved.
- plan/OWNER-ACTIONS.md 7–13. Feb 1 → Valentine's theme, back Mar 1. CSP: enforce after reading `csp` logs.

## Watch out (details: grep docs/archive/CLAUDE-2026-11.md)
- Request bookings: location_address "FL 33139" (homeOf), baby_age "". CSS modules + theme variables until brief 07.
- Database-only objects: bookings.blocked_until + bookings_no_overlap (0015), waiver trigger (0023),
  shoot_inspo.who (0025), shoot_sections + shoot_inspo.section_id (0033). Never `drizzle-kit push`.
- Migrations: `npm run db:generate`, add-only, safe twice (drops: owner OK + `-- destructive-ok:`).
- ADMIN_SESSION_SECRET signs pay, due-date and waiver-copy links: never rotate it.
- iCloud folder: never git stash/switch there (use a worktree). Owner's dev server on :3000: stop yours by port.
- e2e: hydrated() first; alerts scoped to `main`; a day per browser; no Spanish, no Pixel, no database.
- Local: scripts/local-db + fakes; seed deposit/travel settings for the price line; scroll before screenshots.
