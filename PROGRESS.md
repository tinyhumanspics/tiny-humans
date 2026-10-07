# PROGRESS.md — Tiny Humans

Living plan + log. Update after every slice. New session: "Read CLAUDE.md and PROGRESS.md and continue."
Legend: `[x]` done · `[~]` in progress · `[ ]` to do · `[?]` waiting on owner

## Status
- **Now:** Phase 0 → Phase 1 (launch blockers for tonight's Meta ads, 2026-10-06).
- Baseline at `cd667b1`: `npm run typecheck` ✅, `npm run build` ✅, `npm run lint` ⚠️ (`next lint` deprecated + unconfigured,
  prompts interactively; fix in Phase 7 with ESLint flat config).

## Phase 0 — Kickoff
- [x] Read README + codebase; baseline typecheck/build; lint status noted above
- [x] Workflow set up (see CLAUDE.md → Environment): cloud workspace can't reach Vercel/Neon/Meta → mock provider +
      local DB; push via owner's linked folder; deploy status via GitHub commit statuses; prod checks via built-in browser
- [x] Owner decisions requested (19) — answers recorded below
- [x] Project structure confirmed → CLAUDE.md
- [x] Bug hunt (Playwright, iPhone 14 / desktop 1440 / Instagram + Facebook in-app UAs) → Bug log
- [x] Baseline screenshots (all public pages + admin, phone + desktop) → `.screenshots/baseline/` (gitignored; a copy
      lives in the owner's local folder `tiny-humans-live/.screenshots/baseline/`)

## Phase 1 — Launch blockers (tonight)
- [ ] 1a Fix booking bugs: BUG-1 in-progress retry, BUG-2 stale-price fallback, BUG-4 Miami time labels
- [ ] 1b Durable rate limiting (Upstash, `@upstash/ratelimit`) on create/quote/availability/cancel/manage/reschedule + strict admin login
- [ ] 1b Bot protection (Vercel BotID basic — decision pending research) on booking create
- [ ] 1b Baseline security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors/XFO)
- [ ] 1c First-touch source cookie (utm_*, fbclid, landing path, referrer, 90 days) → booking request
- [ ] 1c Additive migration: nullable source columns on `bookings` (apply in Neon BEFORE deploying the code)
- [ ] 1c Show source in /admin leads
- [ ] 1d `lib/tracking` (Meta only; pluggable): Pixel on site pages only (never /admin), PageView without double-firing
- [ ] 1d Events: ViewContent (bundle viewed/selected), InitiateCheckout (schedule step), Schedule (booking created)
- [ ] 1d CAPI `Schedule` from booking-create via `after()`; dedup `event_id` = booking `requestId`; hashed user_data
- [ ] 1d Domain verification meta tag  [?] code from owner
- [ ] 1e Privacy policy + terms: Pixel/CAPI, `_fbp`/`_fbc`, hashed contact data to Meta, source tracking, Resend; lastUpdated
- [ ] 1f Landing page `/newborn-photos-at-home` (blueprint order, copy in `messages/en.json`, CTA → booking w/ bundle)
- [ ] 1f Intro on landing: prototype short vs skipped; owner picks
- [ ] 1f Metadata + OG image; screenshots to owner before push
- [ ] 1g Production verification with owner (test event code → one real booking → verify → cancel → remove code)

## Phase 2 — Show rate (next 24–48h)
- [ ] 2a React Email + Resend; recreate every template with identical branding (+ plain text); `locale` param
- [ ] 2b Confirmation email upgrade (photographers intro, prep guide, sneak peek, pay after, manage links, backdrop question)
- [ ] 2c Reminders 72h (prep + reschedule) and 24h (logistics); idempotent; reschedule/cancel aware; backfill; failures in /admin
- [ ] 2c Optional /admin "Today" view with tap-to-text
- [ ] 2d After-session (thank you + how to pay) and gallery-delivered (review + referral) emails
- [ ] 2e Optional SMS consent checkbox (+ timestamp); photo-use permission checkbox
- [ ] Edge: unit/gate/parking/concierge fields → Outlook event + 24h reminder
- [ ] Edge: flag addresses ≥2h drive (travel fee, editable in /admin)
- [ ] Edge: Resend webhooks → flag bounces/complaints in /admin; SPF/DKIM/DMARC check
- [ ] Edge: block a day in /admin + notify/reschedule every affected family; duplicate-booking flag

## Phase 3 — Spanish (owner: "same time, no rush" → after Phase 2)
- [ ] Research i18n (next-intl vs alternatives), URLs (/es), detection rules, switcher, hreflang
- [ ] Move all customer strings to messages/en.json + es.json; booking `locale` column; Spanish emails
- [ ] Native-speaker review before Spanish ads [?] reviewer (Adrian or Alondra?)

## Phase 4 — Add-ons + seasonal
- [ ] Extra babies add-on ($75 each, editable per bundle in /admin; extra minutes/photos/max TBD) end to end
- [ ] Halloween theme (`config/themes.ts` pattern) — owner wants Halloween
- [ ] Seasonal landing variants with real cutoffs (Halloween, Thanksgiving, Christmas cards + First Christmas), editable in /admin

## Phase 5 — SEO basics
- [ ] Metadata/canonicals/OG, `app/sitemap.ts`, `app/robots.ts`, JSON-LD (service-area business), alt text editable
- [ ] Owner steps: Google Search Console, Google Business Profile (service-area)

## Phase 6 — Security + quality
- [ ] Full audit (auth, CSRF/origin, Zod everywhere, error leakage, logs, upload validation, npm audit)
- [ ] Owner login research + upgrade (passkeys/2FA, logout everywhere, lockout, recovery doc)
- [ ] WCAG 2.2 AA audit (axe + manual) and fixes; gitleaks history scan; CSP report-only → enforce
- [ ] Playwright e2e + Vitest units + GitHub Actions CI; second bug hunt

## Phase 7 — Upgrade everything (Next 16.x, ESLint flat config, …) one family per slice
## Phase 8 — Structure move, route groups, split Booking.tsx, library evaluation, remove `config/bundles.ts`
## Phase 9 — Tailwind v4 + tokens, one component per slice vs baseline screenshots
## Phase 10 — Admin rebuild (light/dark, dashboard, charts, phone-friendly)

---

## Owner decisions (2026-10-06)
1. Offer name **"The Stay-Home Newborn Session"** — keep.
2. Bonuses: **all three** — Home Session Prep Guide (draft for approval), sneak peek (with 24–72h delivery → "3 sneak-peek
   photos within 24 hours" — confirm wording), "Pick your backdrop" at booking.
3. Baby-led promise (free return visit if baby can't settle): **yes** (within 14 days — confirm).
4. Ages: **up to 5 years old, flexible on age**; booking before birth OK (flexible).
5. Capacity: **10–15 sessions a week** [?] publish "up to 15 home sessions a week"?
6. Gallery delivery: **24–72 hours** from shoot to fully edited.
7. Seasonal: **run Halloween too**. [?] cutoffs — proposed Halloween Oct 28, Thanksgiving Nov 23, Christmas cards Dec 5,
   First Christmas Dec 21.
8. "Most loved" is true and recommended. Mobile order (owner: "you choose"): **Family Story first, highlight Our Little Story ($249)**.
9. Service area: **anywhere in Florida**, based in Miami Beach, up to Orlando. **Travel fee for drives ≥ 2 hours**, amount
   editable in /admin [?] amount.
10. Safety practices for FAQ: **yes** to warm room, washed/sanitized hands, no unsupported poses (composites), parent within
    arm's reach, no fragrance.
11. "Meet the photographers": **Alondra Jimenez (photographer) and Adrian Orozco**. Photo uploaded in /admin; bio editable
    in /admin. [?] answers to bio questions.
12. Photo-use permission checkbox at booking: **yes**; first reviews: Google review request at gallery delivery: **yes**.
13. SMS consent wording approved ("OK to text me about my session (reminders, arrival updates). Reply STOP anytime.")
    [?] texting phone number.
14. Landing URL: owner wants it universal (travels statewide) → **`/newborn-photos-at-home`**.
15. Extra baby: **$75**, editable in /admin. [?] extra minutes/photos, max per booking, codes apply?
16. Payment after session: **Zelle, card link or cash** (any).
17. Cancellation/no-show wording approved: "Free to reschedule or cancel online up to 48 hours before. Inside 48 hours,
    just text us. If you miss a session without telling us, we may ask for a deposit to rebook."
18. Editable in /admin: seasonal offers + cutoffs, FAQ, reviews, "Meet the photographers". Layouts stay in code.
19. Spanish: "same time, no rush" → Phase 3 after Phase 2. [?] who reviews the Spanish copy.

## Open owner questions
- Meta Dataset (Pixel) ID; domain verification code; `META_CAPI_ACCESS_TOKEN` added in Vercel (Production + Preview).
- Texting phone number · weekly cap wording · travel fee amount · extra-baby time/photos/max · seasonal cutoffs ·
  bio answers · Spanish reviewer.

## Placeholders (must be approved before showing)
- Weekly cap number, seasonal cutoff dates, travel fee amount, photographers' bio + photo, reviews (hidden until real),
  prep guide text, texting number.

## Bug log
Severity: critical / high / medium / low. Found in Phase 0 unless noted.
- **BUG-1 (high)** `outlook-provider.createBooking`: a retry while the first request is still saving hits the unique
  `request_id` → returns code `slot_unavailable` ("already being saved"). `Booking.tsx` treats `slot_unavailable` as
  "time taken": drops the slot, clears the requestId and sends the parent back to pick another time — while the first
  request may still succeed → a second booking with a new requestId. Fix: distinct `in_progress` code; client waits and
  retries with the same requestId.
- **BUG-2 (high)** Stale-price fallback: `getPublicCatalog()`/`getCatalog()` return hardcoded `config/bundles.ts`
  ($99/$199/$249) on DB errors / empty table. Ad visitors could see prices the server won't honor.
- **BUG-3 (high)** Rate limiting: in-memory only (useless across serverless instances); none on `POST /api/booking/create`,
  `GET /api/booking/availability`, `POST /api/admin/login` (only a 700 ms delay → brute-forceable).
- **BUG-4 (medium)** Times aren't labeled as Miami time anywhere (calendar, time step, review, confirmation); the calendar's
  "today" and month math use the visitor's local zone. Relatives booking from other states see unlabeled ET times.
- **BUG-5 (medium)** Overlap race: DB only blocks two active bookings with the *same start*; overlapping sessions
  submitted at the same moment can both succeed. Fix: exclusion constraint on a stored blocked range (start → end+buffer).
- **BUG-6 (medium)** No security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **BUG-7 (low)** Address form has no unit/apartment, gate, parking or concierge fields (Miami condos).
- **BUG-8 (low)** Confirmation step is in-memory: browser Back/refresh shows an empty form (no double booking — OK), but
  the parent loses the reference on screen. Consider sessionStorage restore on the confirmation.
- **BUG-9 (low)** Console warning on `/`: a CSS chunk is preloaded but not used within a few seconds.
- **BUG-10 (low, data)** Live bundle features: "Baby Only" vs "Baby only" capitalization (owner data in /admin).
- Checked OK: booking funnel completes on iPhone 14, desktop, Instagram + Facebook in-app user agents (mock); no
  hydration warnings; no horizontal overflow; user input is HTML-escaped in emails + Outlook body.

## Dependencies log
(one line per new dependency: why · bundle impact · maintenance)

## Research notes
- **Next.js:** latest stable 16.4.0 (2026-10); 15.5.27 is the "backport" tag. Next 16 deprecates/renames `middleware` →
  `proxy` and removes `next lint` (we're on 15.5 until Phase 7). Route groups with separate root layouts → full page load
  between them.
- **Vercel BotID** (`botid` 1.5.11): `withBotId()` in next.config, `initBotId({ protect: [{ path, method }] })` in
  `instrumentation-client.ts` (Next 15.3+), `checkBotId()` in the route. Basic = free on all plans; Deep Analysis (Kasada)
  Pro/Enterprise and billed. Invisible. https://vercel.com/docs/botid · https://vercel.com/kb/guide/vercel-botid-vs-cloudflare-turnstile
- **Upstash:** `@upstash/ratelimit` 2.2.0, `@upstash/redis` 1.39.0 (both updated 2026-10).
- **Meta Graph API:** v26.0 released 2026-07-29 (current). https://developers.facebook.com/docs/graph-api/changelog/version26.0
- **Meta domain verification:** Business Settings → Brand Safety → Domains → domain → Meta Tag Verification → Verify.
  https://developers.facebook.com/docs/sharing/domain-verification/verifying-your-domain

## Local test database
(Phase 1c) Embedded Postgres + a tiny Neon-HTTP-compatible shim so `drizzle-orm/neon-http` code runs unchanged locally.
