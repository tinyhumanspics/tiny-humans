# PROGRESS.md — Tiny Humans

Living plan + log. Update after every slice. New session: "Read CLAUDE.md and PROGRESS.md and continue."
Legend: `[x]` done · `[~]` in progress · `[ ]` to do · `[?]` waiting on owner

## ▶ NEXT STEPS (handoff, Oct 7 evening, after Phase 2 + owner requests)
State: everything below is on `main` and live (last deploy `e0c285a` + this handoff's docs commit).
1. **1g production verification** with the owner (brief section 4: test event code → one real booking from
   `/home-sweet-home` → Events Manager, booking row source, emails, Outlook → cancel → remove the code), then the ads
   message (landing URL `https://www.tinyhumans.photography/home-sweet-home`, UTM template, optimize for `Schedule`).
   Checklist sent Oct 7; no results yet. His test booking is also the first real send of the new confirmation email.
2. ~~Check that migration 0010 (`booking_terms`) ran~~ — owner confirmed (Oct 7) and re-ran it to be sure (safe:
   `CREATE TABLE IF NOT EXISTS` + backfill `ON CONFLICT DO NOTHING`). Migration 0011 (`booking_access`) ran Oct 7.
3. **Phase 2 extras (the "rest" the owner wants finished before the deposit):** ~~address unit/gate/parking/concierge
   fields~~ (live Oct 7, see Phase 2 "Edge"); out-of-area flag (Phase 4 travel fee still undecided);
   Resend webhooks → bounced/complained emails flagged in /admin (+ SPF/DKIM/DMARC check); "block a day" in /admin +
   notify/reschedule every affected family; duplicate-booking flag (same email/phone); optional /admin "Today" view
   with tap-to-text (uses the SMS permission). Then BUG-5 overlap constraint (exclusion constraint, migration) and
   the DST Nov 1 calendar-UI check.
4. **Queued (owner, Oct 7) — $50 deposit**, build only after item 3: paid **while booking** (Stripe Checkout as the
   last step; the date is confirmed only once paid), **required for every booking** (min($50, total); $0 bookings
   skip it), **refunded automatically** when the family cancels online before the notice window; kept inside the
   window / no-show; carries over on reschedule; **one deposit amount editable in /admin** (new bookings only). The
   booking's payment link then charges the rest (total − deposit) automatically. Replaces "$0 today, pay after your
   session" everywhere (landing, booking form, emails, Terms, Meta event timing) → new wording needs the owner's OK.
   Open details to settle when building: how long a slot is held while Stripe is open; Meta `Schedule` fires after
   the deposit; refund mechanics (Stripe Refunds API, key needs "Refunds: Write").
5. After the first real reminder runs (Oct 8 onward): glance at /admin → Leads → details for "Reminder" lines, and at
   Vercel → Settings → Cron Jobs → View Logs if one says "Not sent". First real "Send sneak peek" = first live Stripe
   page from an email; confirm /admin shows "Paid" after payment (else Stripe Workbench → Webhooks → Event deliveries).
6. Ask the owner: privacy-policy line for Vercel Web Analytics/Speed Insights; `/portfolio` page (see "Owner requests").
7. Visual baselines in `.screenshots/parity/` are current (all 16 updated Oct 7 after the owner approved ages, step
   tracker and "Live now"). ⚠ The parity check allows 0.2% of a full page to differ, which missed the step tracker
   move (3 small circles): add element-level screenshots for key components in Phase 6. The old `.screenshots/baseline/`
   set was captured mid-animation → recapture before Phase 9 uses it.

## ▶ Next session prompt
(Replaced by `/handoff` at the end of every phase. Copy everything inside the code block into a new session.)
```
Read CLAUDE.md and PROGRESS.md and continue. (Brief: tiny-humans-claude-code-prompt.md, gitignored, never commit.)

State (Oct 7): main = e0c285a (+ handoff docs commit), live and smoke-tested: Phase 2 complete — React Email
templates, upgraded confirmation, daily reminders, after-session flow ("Send sneak peek" with Pixieset + choose N
favorites, "Gallery delivered" + review form, reviews in /admin), Stripe card payments (never-expiring payment link per
booking: text/copy/email from /admin; paid status via webhook), optional SMS/photo permissions, one cancel & reschedule
notice kept per booking and shown everywhere (booking_terms), email photo slot, theme photo fallback to Original.
Not on main yet: nothing.

Next: confirm with the owner that migration 0010 ran; then Phase 2 extras in PROGRESS → NEXT STEPS 3 (address
unit/gate/parking fields first). Research current official docs first (note links in PROGRESS.md).
Queued after that: the $50 deposit (decisions recorded in NEXT STEPS 4; wording needs owner approval).
Time-sensitive: BUG-5 overlap constraint, DST Nov 1 calendar check. (No Halloween: dropped by the owner.)
Waiting on the owner: 1g Meta test results, migration 0010 confirmation, privacy line for Vercel Analytics, /portfolio.
Watch out: iCloud Desktop folder (" 2"/" 3" duplicates; tsconfig ignores them in .next); .agents/ + AGENTS.md are
another tool's untracked files — leave them. Local testing: scripts/local-db + fake Graph/Resend/Stripe (see PROGRESS
→ Local test database). Never hard-code the 48-hour notice; never add bookings columns without migration-first.
```

## Owner requests (outside the original brief)
- [x] **Routes** (Oct 7, branch `wip/routes`): bundles page `/book` → **`/bundles`**, calendar `/book/schedule?bundle=` →
      **`/book?bundle=`** (`?inspiration=` kept). Owner: no redirects for the old URLs (new project). `/book` without a
      known bundle → the bundle opened earlier in this tab's visit (sessionStorage `th_last_bundle`, bundle id only),
      otherwise `/bundles`. Links go through `scheduleHref()` / `bundlesHref()` (`config/booking.ts`); the CAPI
      `event_source_url` fallback uses `scheduleHref()` too. ⚠ The Meta ads must point at `/home-sweet-home` (landing)
      or `/bundles`, never the old paths.
- [x] **404 page** (`app/not-found.tsx`, chalkboard style, copy in `messages/en.json` → `errors.notFound`).
- [x] **`/about`** (Oct 7, live): "Our story" page from the owner's answers (decisions 10, 11 + the landing
      bio), linked only in the footer (new "About us" column: 4 columns ≥1024 px, 2 at ≥720 px; every page's footer is
      117 px taller on phones; visual diff = footer only). Copy in `messages/en.json` → `about.*`. 4 photo placeholders
      (`components/PhotoPlaceholder`, same frame as PinnedPhoto). Owner approved publishing the copy (Oct 7).
      Later: editable in /admin with the "Meet the photographers" work (decision 18).
- [x] **Instagram handle** → `@tinyhumans.photography` (owner, Oct 7): footer, legal contact line, CLAUDE.md.
- [x] **Vercel Web Analytics + Speed Insights** (owner, Oct 7): `components/layout/VercelInsights.tsx`, rendered only when
      `VERCEL=1`; `beforeSend` → `lib/tracking/safe-url.ts` keeps only `utm_*`, `bundle`, `inspiration` (strips the
      cancel/reschedule `?t=` token) and drops `/admin`. Cost: Hobby free (Analytics 50k events/mo then paused; Speed
      Insights 10k events/30 days then paused); Pro: Analytics $0.03 per 1k events, basic Speed Insights free.
- [x] **`cn()` helper** (`lib/cn.ts`, clsx + tailwind-merge) across components (owner's refactor, committed Oct 7;
      visual diff vs baseline = none besides the footer/handle).
- [x] **Admin photo slots for `/about` (4) and the landing page (2)** (owner, Oct 7). Extended
      `MEDIA_GROUPS` in `config/media.ts` (per-theme slots saved in Vercel Blob, same uploader as the home photos) with
      an "About" and a "Landing" group; `PhotoPlaceholder` shows until a slot has a photo, then `PinnedPhoto`. Alt text
      per photo is editable. Later, with decision 18: bio text editable in /admin too.
- [x] **Ages: newborns up to 2 years for now** (owner, Oct 7, live `fd5942f`; more ages later). Booking form age list:
      "1 year or older" → "1–2 years" ("Not born yet" kept), note under the age box ("Your little one is over 2? Email
      us at … and we'll let you know when we open more ages.", `booking.age.olderNote`), landing FAQ "up to 2 years
      old". Siblings still welcome with Our Family Story (owner). Server validation uses the same list.
- [x] **"Live now" centered** on /admin → Theme (owner, Oct 7, `9a929a0`): the Photos page badge (added Oct 6) shared
      the `liveTag` class and overrode the card's centered style → badge renamed `mediaLiveTag`/`mediaOffTag`.
- [x] **Booking step tracker evenly spread** (owner, Oct 7, `cbbacbd`): the grid still had 6 columns from the old
      6-step flow → one column per step (`--steps`), dashed line from the first circle's center to the last.
      Offered, not requested: steps not reached yet are see-through (`opacity` on the button), so the line shows
      faintly inside circles 2–4.
- **`/portfolio` page** (Oct 7): a standalone portfolio page "the same way as /book". Assumption until confirmed: the
  same photo feed as the home page's "Little moments" section (with the "Book a memory like this one" prompts and the
  lightbox), its own metadata, and the header "Portfolio" link pointing to `/portfolio` instead of `/#portfolio`.

## Status
- **Now:** Phase 1g waits on the owner; Phase 2 core (2a–2e) + owner requests live (Oct 7); Phase 2 extras in
  progress (unit/gate/parking fields live Oct 7; out-of-area flag next), then the queued $50 deposit.
- Baseline at `cd667b1`: `npm run typecheck` ✅, `npm run build` ✅, `npm run lint` ⚠️ (`next lint` deprecated + unconfigured,
  prompts interactively; fix in Phase 7 with ESLint flat config).
- Since `wip/next-16`: `npm run lint` = ESLint 10 flat config (0 errors, 28 warnings: unused imports + React Compiler advice).
- Oct 7: owner approved deleting the empty Finder/iCloud duplicate folders (`lib copy`, `components/* 2`, `lib/* 2`, …).
  All were empty (only `.DS_Store`), never in git. Removed with `rmdir` (refuses non-empty folders).

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
- [x] 1a BUG-2 stale prices: no hardcoded fallback with a DB; last-good copy (memory + content-hashed Blob file); with no
      copy the render throws so ISR keeps the last good page / a build fails (old deployment stays live); friendly
      global-error page; "booking paused" box when no bundles are bookable
- [x] 1a BUG-1 `in_progress` code: browser waits + retries with the same requestId (never "pick another time")
- [x] 1a BUG-4 "Miami time" on time step, review, confirmation, reschedule; calendar "today" = Miami date
- [x] Local test DB: `scripts/local-db` (embedded Postgres + Neon-HTTP shim, separate package; `.down` file simulates outage)
- [x] 1b Durable rate limiting (Upstash via Vercel Marketplace, `lib/rate-limit.ts`, fails open) on create/quote/
      availability/cancel/manage/reschedule + admin login (5/15 min per IP, 60/h overall). Owner connected Upstash ✅
- [x] 1b Spam protection on booking create: hidden honeypot field + "finished in < 4 s" check (near-zero false positives)
- [~] 1b Invisible bot check: **Vercel BotID tried and removed** — its client wraps `fetch` and, when its challenge script
      is blocked (content blockers; the script path is a public constant UUID), the booking request errors and every retry
      hangs forever. Revisit in Phase 6 (Turnstile, or BotID behind a timeout + fallback), monitor-mode first.
- [x] 1b Baseline security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options SAMEORIGIN,
      CSP `frame-ancestors 'self'` only)
- [x] 1c First-touch source: `middleware.ts` sets httpOnly first-party cookie `th_src` (utm_*, fbclid, landing path,
      referring-site ORIGIN only, 90 days; a "direct" first touch is upgraded by a later campaign touch) + `th_fbc`
      (latest Meta click id, `_fbc` format). The create route reads the cookie (never the request body).
- [x] 1c Migration `drizzle/0006_booking_source.sql` (ADD COLUMN IF NOT EXISTS ×9) — owner ran it in Neon (Oct 7)
- [x] 1c Source in /admin leads (card line + details: label, campaign/ad set/ad, medium, first page, referring site)
- [x] Local fake Microsoft Graph (`scripts/local-db/fake-graph.mjs`) → the real `outlook` booking path runs end to end locally
- [x] 1d `lib/tracking/client.ts` (provider-neutral functions, Meta adapter) + `components/layout/MetaPixel.tsx`: site pages
      only (never /admin); `disablePushState` + manual PageView per pathname (one per page, verified with a stub);
      `autoConfig` off (no automatic page scraping)
- [x] 1d Events: ViewContent (bundle selected: card / CTA), InitiateCheckout (schedule step, once per bundle per session),
      Schedule (booking created; `eventID` = requestId; advanced matching re-init with parent data; once per requestId)
- [x] 1d CAPI `lib/tracking/meta-capi.ts`: Schedule via `after()` in the create route; Graph v26.0; hashed em/ph/fn/ln/ct/
      st/zp/country/external_id; ip/UA/fbp/fbc (`_fbc` → `th_fbc` fallback); test_event_code from env; never throws.
      Verified payload + hashing locally; live check in 1g. Baby data never sent (checked).
- [x] 1d Domain verification: owner already verified by DNS TXT record → no meta tag needed
- [x] 1e Privacy policy + terms updated (Meta Pixel/CAPI section, cookies list, Upstash, source tracking, baby data never
      shared; terms: approved 48 h reschedule/cancel + no-show wording). Owner told to have it reviewed by someone qualified.
- [x] 1f Landing page `/home-sweet-home` ("The Stay-Home Session", owner-approved name + URL) built on branch
      `wip/landing-page`: blueprint order, copy in `messages/en.json` (`landing.*`), CTAs → calendar with the "most
      loved" bundle preselected + ViewContent, phone bundle order (Family Story first, Our Little Story highlighted),
      real next open dates, reviews hidden. [?] owner approval of copy from screenshots
- [~] 1f Intro on landing: skipped by default; `?intro=short` (logo slides in) / `?intro=full` previews. [?] owner pick
- [~] 1f Metadata (title, description, canonical, OG text; reuses the brand OG image)
- [ ] 1g Production verification with owner (test event code → one real booking → verify → cancel → remove code)

## Phase 2 — Show rate (next 24–48h)
- [x] 2a React Email + Resend (Oct 7): `react-email` 6.11 templates in `emails/` (`components/ChalkLayout`, `blocks`,
      `InternalLayout`; `BookingConfirmation`, `BookingCancellation`, `BookingRescheduled`, `Internal`), rendered by
      `lib/email/render.ts` (adds the Outlook font fix React can't write), same CID logo/strip attachments, hand-written
      plain text kept (React Email's auto text merged the detail tables into one line). Customer copy in
      `messages/en.json` → `emails.*` with `{name}` placeholders (`lib/email/messages.ts`); every customer template takes
      `locale` (English only until Phase 3). Internal emails stay English in code (they go to the owner). Parity: 16
      emails × 4 themes/pricing variants × phone + desktop screenshots **pixel-identical** to the old string templates;
      plain text, subjects and attachments byte-identical. Real send path checked locally (Outlook mode + fake Graph +
      fake Resend via `RESEND_BASE_URL`): book → reschedule → cancel sent all 6 emails with the right idempotency keys.
      Mock-mode "Preview the confirmation email" now renders in the browser (new e2e test, passes on WebKit too).
- [x] 2b Confirmation email upgrade (Oct 7, live, owner approved the screenshots): "Pick your backdrop" swatches (Blue Aura,
      Burgundy, Cream, White; colors designed by Claude in `config/backdrops.ts`, reply with your pick), Home Session
      Prep Guide (owner-approved text), "What happens next" (3 sneak peeks within 24 h, gallery in 24–72 h, pay after),
      "Meet your photographers" (+ the /admin About "Adrian & Alondra" photo once uploaded), baby-led promise (landing
      wording). Copy in `messages/en.json` → `emails.*`.
- [x] 2c Reminders (Oct 7, live; migration 0007 + `CRON_SECRET` done by the owner): Vercel Hobby cron once a day at 14:00 UTC (fires 10–11 am
      EDT / 9–10 am EST) → `GET /api/cron/reminders` (Bearer `CRON_SECRET`; `?dryRun=1` lists due references).
      `lib/booking/reminders.ts` decides at send time from the booking as it is now: "72h" (prep guide, backdrops, big
      "Need another time?" button while online rescheduling is open, else "text us") when the session is 2–3 Miami days
      away and was confirmed ≥ 72 h before; "24h" (logistics + texting number) when today/tomorrow, ≥ 3 h away and
      confirmed ≥ 24 h before. "Confirmed" = booked or last rescheduled. Table `booking_emails` (migration 0007): one row
      claims each email (unique booking + kind + session time) → no doubles from duplicate cron runs; reschedule = new
      session time = due again; cancelled = never due; failures retried by later runs (max 3 attempts) and shown in
      /admin → Leads → details ("Not sent (code). Text the family."). Backfill is automatic. Reminder links: own token
      per email (HMAC of the row id with `CRON_SECRET`, only the hash stored), valid while the booking keeps that session
      time; confirmation links keep working. Tested locally end to end (21 scenarios incl. DST night Nov 1).
- [ ] 2c Optional /admin "Today" view with tap-to-text
- [x] 2d After-session (Oct 7, live; owner did migration 0008 + Stripe key + webhook). Fix (Oct 7, owner report): the
      chalk logo intro covered /review and /pay/status on a fresh visit (3–4 s green screen) → both are now in
      `NO_INTRO_PATHS` (`app/layout.tsx`) and show at once; owner approved the same for /cancel + /reschedule.
- [x] Cancel & reschedule notice + sneak peek (owner request, Oct 7; live `e0c285a`, owner approved the wording;
      confirm he ran migration 0010): **one setting** (/admin → Availability → "Cancel & reschedule notice", ≥ 1 h) now closes
      online **cancelling and rescheduling**; inside it families see "text us at (786) 222-7194" (+ tap-to-text). Each
      booking keeps the hours in force when it was made (table `booking_terms`, also the bundle's photo count; the
      migration backfills existing bookings with today's setting). The number is never hard-coded: Terms ("{notice}"),
      landing FAQ, confirmation + reminder emails, cancel/reschedule pages (`lib/booking/reschedule-policy.ts`);
      saving the setting revalidates /terms and the landing page. **Sneak peek replaces "Session done"** and the
      "3 sneak peeks in 24 h" promise: /admin → Send sneak peek (Pixieset link + favorites, pre-filled from the bundle:
      8/20/35) → email "Choose your N favorites" + Pay button only if unpaid. New promise everywhere: photos to choose
      from within 24 h of the session, edited favorites within 72 h of the pick. 21 local checks.
- [x] Email photo slot (owner request, Oct 7): /admin → Photos → **Emails** → "Meet your photographers" (round preview).
      The confirmation email uses: theme's email photo → Original's email photo → "Adrian & Alondra" About Us photo
      (theme's, then Original's) → no photo. `photographersEmailPhoto()` in `config/media.ts`; `ThemeMedia.email`
      (older saved settings load with an empty slot; email photos count as "in use" so they're never cleaned up).
- [x] Theme photos fall back to the Original theme (owner request, Oct 7): in Thanksgiving / Christmas / New Year,
      an empty photo slot (title, landing, About, "Little moments" + prompts, extras) shows the Original (default)
      theme's picture, then the built-in picture / "photo coming soon". `resolveMedia(media, fallbackMediaFor(...))`
      in `config/media.ts`; /admin → Photos labels such slots "Same as the Original theme".
- [x] Payment link before (or after) the session (owner request, Oct 7): `/pay?b=<reference>&s=<signature>`
      (`lib/payments/link.ts`, HMAC with `ADMIN_SESSION_SECRET`, purpose "pay-link:v1"), never expires, same link every
      time, survives reschedules, invalid once cancelled, "already paid" once paid. /admin → Leads → details →
      **Payment**: status + Text the link (sms: with the message filled in) / Copy link / Email the link (new
      "payment link" email, can be resent). Session done + gallery emails use the same link; old `/pay?t=` links still
      work. Tested locally (15 checks). /admin → Leads → details →
      "After the Session": **Session done** (enabled once the session started) → thank-you email with "Pay $X" →
      `/pay?t=` (`app/pay/route.ts`) → Stripe Checkout for the booking's price snapshot (`finalPriceCents`, so codes and
      offers are exact; an open Checkout page is reused, a new one made after 24 h) → `/pay/status?s=…`. "Paid" from
      the signed webhook `/api/stripe/webhook` (or checked when the link is opened again) → table `booking_payments`.
      **Gallery delivered** (optional Pixieset link) → email with review button (`/review?t=`), referral line, and a
      pay button while unpaid. Reviews (table `reviews`): rating, text, display name, family's OK to show publicly;
      studio gets a "New review" email; owner can "Use on the website" only with the family's OK (withdrawing the OK
      un-picks it). Stripe via fetch (`lib/payments/stripe.ts`), no SDK. Tokens: `booking_emails.link_token_hash` per
      email kind (after_session → /pay; gallery_delivered → /pay + /review; reminders → manage pages only).
      Tested locally with fake Stripe + fake Resend (28 checks).
- [x] 2e (Oct 7, live; owner approved + ran migration 0009): "Two quick permissions (optional)"
      at the end of the details step, both unticked by default: SMS (approved wording, decision 13) and photo use
      ("OK to feature our photos on the Tiny Humans website and social media", brief wording, decision 12). Shown on
      the review step, in the Outlook event body and the studio email ("OK to text" / "OK to feature photos"), and in
      /admin lead details with change buttons ("They replied STOP: don't text", "Keep their photos private", …).
      Stored in table `booking_consents` (migration 0009) with a timestamp per answer — a separate table and a
      best-effort insert, so bookings keep working even before the migration runs. Screenshots:
      `Claude outputs/permissions/`.
- [x] Edge: unit/gate/parking/concierge fields (BUG-7; live Oct 7 `0329225`, owner approved the wording from
      `Claude outputs/address-fields/` and ran migration `drizzle/0011_booking_access.sql`). Booking form: "Apt /
      unit (optional)" next to the street (`address-line1` / `address-line2` autofill; stacked on phones) + "Gate code,
      parking or concierge (optional)" box under City/ZIP (max 40 / 300 characters, also checked on the server). The
      unit becomes part of the address line (`formatAddress`: "1204" → "Unit 1204", "Apt 4B" stays as typed), so it
      shows everywhere the address does with no new bookings column. The notes go in table `booking_access`
      (best effort, like `booking_consents`: bookings, /admin and reminders keep working before the migration runs)
      and show in: review step ("Getting in"), Outlook event + studio email ("Gate / parking / concierge"), /admin lead
      details, and the **24 h reminder only** ("Getting in"; not the confirmation or 72 h emails, not on the
      cancel/reschedule pages). Never sent to Meta (only city/ZIP are). Without a unit or notes everything is
      pixel-identical to before. Tested: 18 e2e, 16 visual parity, 29 local Outlook-mode checks (fake Graph/Resend,
      incl. the table missing).
- [~] Edge: out-of-area flag (owner, Oct 7: flag bookings over **30 road miles** from the home-base ZIP; both editable in
      /admin → Availability → Travel; the ZIP is entered there by the owner and never written in the repo). Distance =
      straight line between Florida ZIP centers (Census 2026 ZCTA gazetteer, `scripts/fl-zip-centroids.mjs` →
      `lib/travel/fl-zips.ts`, 1013 ZIPs, 32 KB server-only) × 1.2 road factor (rough Florida highway trips from Miami
      Beach run ~1.15–1.2×; an estimate, labeled as such). Flag only: shown to the owner in /admin, the studio email and
      the Outlook event; families see nothing (FAQ already says a fee is confirmed before the session). In progress,
      uncommitted. Owner asked (Oct 7) whether it can calculate the price automatically → answer pending.
- [ ] Edge: Resend webhooks → flag bounces/complaints in /admin; SPF/DKIM/DMARC check
- [ ] Edge: block a day in /admin + notify/reschedule every affected family; duplicate-booking flag

## Phase 3 — Spanish (owner: "same time, no rush" → after Phase 2)
- [ ] Research i18n (next-intl vs alternatives), URLs (/es), detection rules, switcher, hreflang
- [ ] Move all customer strings to messages/en.json + es.json; booking `locale` column; Spanish emails
- [ ] Native-speaker review before Spanish ads [?] reviewer (Adrian or Alondra?)

## Phase 4 — Add-ons + seasonal
- [ ] Extra babies add-on ($75 each, editable per bundle in /admin; extra minutes/photos/max TBD) end to end
- ~~Halloween theme~~ — **dropped by the owner (Oct 7): no Halloween anything; keep only the existing themes**
  (default, Thanksgiving, Christmas, New Year).
- [ ] Seasonal landing variants with real cutoffs (Thanksgiving, Christmas cards + First Christmas), editable in /admin

## Phase 5 — SEO basics
- [ ] Metadata/canonicals/OG, `app/sitemap.ts`, `app/robots.ts`, JSON-LD (service-area business), alt text editable
- [ ] Owner steps: Google Search Console, Google Business Profile (service-area)

## Phase 6 — Security + quality
- [ ] Full audit (auth, CSRF/origin, Zod everywhere, error leakage, logs, upload validation, npm audit)
- [ ] Owner login research + upgrade (passkeys/2FA, logout everywhere, lockout, recovery doc)
- [ ] WCAG 2.2 AA audit (axe + manual) and fixes; gitleaks history scan; CSP report-only → enforce
- [~] Playwright e2e started early (`tests/e2e/booking.spec.ts`, `npm run test:e2e`); Vitest units + GitHub Actions CI;
      second bug hunt

## Phase 7 — Upgrade everything (Next 16.x, ESLint flat config, …) one family per slice
- [x] (pulled forward, owner request Oct 7; branch `wip/next-16`) Next 15.5.27 → **16.4.0**, React 19.1 → **19.3.0**,
      TypeScript 5.9 → **7.0.2** (`tsc` = TS 7 via the `@typescript/native` alias; the `typescript` package name =
      `@typescript/typescript6` because TS 7 has no programmatic API and typescript-eslint/Next need one — Microsoft's
      documented side-by-side setup; drop the alias once typescript-eslint supports TS 7), ESLint flat config (`eslint` 10 + `eslint-config-next` 16.4). Changes: `middleware.ts` →
      `proxy.ts` (Node runtime; cookie behavior re-verified with curl), `revalidateTag(tag, { expire: 0 })` (keeps "next
      visitor sees the new price"; the `'max'` profile would serve one stale copy), `lint` script → `eslint .`, Next added
      `jsx: react-jsx` + `.next/dev/types` to tsconfig. Turbopack is now the build tool: visual parity checked with
      `tests/visual/parity.spec.ts` (8 pages × iPhone 14/1440, Next 15 baseline vs 16: all identical within 0.2%).
      e2e now runs on a production build (`next build && next start`; Next 16 allows one `next dev` per project).
      `npm audit --omit=dev`: 0 (Next 16 fixed the postcss advisories). Remaining 9 are dev-only (drizzle-kit's
      esbuild-kit, eslint's braces chain); "fixes" are downgrades → ignore. Kept `@types/node` 22 (match Vercel's Node).
- [ ] React Compiler lint rules are warnings for now (set-state-in-effect, purity, refs, immutability) → fix in Phase 8.
## Phase 8 — Structure move, route groups, split Booking.tsx, library evaluation, remove `config/bundles.ts`
## Phase 9 — Tailwind v4 + tokens, one component per slice vs baseline screenshots
## Phase 10 — Admin rebuild (light/dark, dashboard, charts, phone-friendly)

---

## Owner decisions (2026-10-06)
1. Offer name **"The Stay-Home Newborn Session"** — keep.
2. Bonuses: **all three** — Home Session Prep Guide (draft for approval), sneak peek (with 24–72h delivery → "3 sneak-peek
   photos within 24 hours" — confirm wording), "Pick your backdrop" at booking.
3. Baby-led promise (free return visit if baby can't settle): **yes** (within 14 days — confirm).
4. Ages: ~~up to 5 years old~~ → **newborn up to 2 years for now** (owner, Oct 7; more ages later); booking before
   birth OK (flexible).
5. Capacity: 10–15 sessions a week; publish **"up to 10 home sessions a week"** (owner: 10 builds scarcity).
6. Gallery delivery: **24–72 hours** from shoot to fully edited.
7. Seasonal: ~~run Halloween too~~ (**dropped Oct 7: no Halloween theme or offer**). Last sessions: Thanksgiving **Nov 23**, Christmas cards **Dec 5**,
   First Christmas **Dec 21** (editable in /admin later).
8. "Most loved" is true and recommended. Mobile order (owner: "you choose"): **Family Story first, highlight Our Little Story ($249)**.
9. Service area: **anywhere in Florida**, based in Miami Beach, up to Orlando. Travel fee idea (owner, still deciding):
   **free up to N miles (e.g. 50) from his address, then $X per mile for the extra miles only** (60 mi → 10 billable);
   free miles + per-mile price editable in /admin. Distance: estimate without paid APIs (ZIP centroid × road factor) —
   confirm approach + cost before building (Phase 4).
10. Safety practices for FAQ: **yes** to warm room, washed/sanitized hands, no unsupported poses (composites), parent within
    arm's reach, no fragrance.
11. "Meet the photographers": **Adrian Orozco** (photography + editing) and his wife **Alondra Jimenez** (creative: set-up,
    styling, decorating). Story: they wanted a home session for their own newborn and couldn't find anyone who came to the
    home; home is the most comfortable place for baby AND parents (feeding, attention, nothing to carry). ~2 years shooting
    (other subjects before babies). Parents themselves. Photo uploaded in /admin; bio editable in /admin.
12. Photo-use permission checkbox at booking: **yes**; first reviews: Google review request at gallery delivery: **yes**.
13. SMS consent wording approved ("OK to text me about my session (reminders, arrival updates). Reply STOP anytime.")
    Texting number: **(786) 222-7194**.
14. Landing URL: owner wants it short, universal (newborns up to 5 years, statewide) and memorable/punny → proposed
    `/home-sweet-home` [?] owner pick.
15. Extra baby: **$75, +30 min, +5 photos, max 3 per booking** — all editable in /admin. [?] do discount codes apply to add-ons
    (default: codes apply to the bundle price only).
16. Payment after session: ~~Zelle, card link or cash~~ → **card only, Stripe** (owner, Oct 7; see below).
17. Cancellation/no-show wording approved: "Free to reschedule or cancel online up to 48 hours before. Inside 48 hours,
    just text us. If you miss a session without telling us, we may ask for a deposit to rebook."
18. Editable in /admin: seasonal offers + cutoffs, FAQ, reviews, "Meet the photographers". Layouts stay in code.
19. Spanish: "same time, no rush" → Phase 3 after Phase 2. Adrian/Alondra review the Spanish copy.

Oct 7 (evening): cancel + reschedule share one notice setting; changes apply to new bookings only. Sneak peek = Pixieset
gallery where families choose their favorites (as many as the bundle's edited photos); promise: 24 h to choose,
edited favorites within 72 h of the pick (replaces "3 sneak peeks in 24 hours" + "gallery in 24–72 hours").

Oct 7 (later): **payment = card only, through Stripe** (no Zelle for now; no cash). Owner's Stripe Payment Links:
Little Moments $149 · Our Little Story $249 · Our Family Story (`forever-little`) $399 (checked: prices match the site).
Discounted/offer bookings must pay the **exact booked amount, automatically** → the site creates the Stripe payment
itself (from the booking's price snapshot). "Thank you + how to pay" email goes out when the owner taps **"Session
done"** in /admin. Reviews: galleries are delivered with Pixieset; owner wants an **internal review form** whose answers
are saved per lead in /admin, to use later on the landing page / portfolio.

Oct 7 answers: Vercel plan = **Hobby** (reminders once a day). Backdrops: **Blue Aura, Burgundy, Cream, White** (owner:
"create the colors yourself"). Sneak-peek wording "3 sneak peeks within 24 hours" OK. Prep guide draft approved, without
a temperature ("just warm the room"); space + pets lines use the approved landing FAQ wording.

## Open owner questions
- Meta Dataset (Pixel) ID; domain verification code; `META_CAPI_ACCESS_TOKEN` added in Vercel (Production + Preview).
- Landing URL pick (`/home-sweet-home` proposed) · travel-fee model + numbers · codes on add-ons.

## Placeholders (must be approved before showing)
- Photo placeholders (`PhotoPlaceholder`, "photo coming soon"): /about → "Adrian & Alondra", "Behind the scenes at a
  home session", "Adrian at work", "Alondra styling a set"; landing → see 1f. Each swaps to `PinnedPhoto` when the owner
  uploads its per-theme replacement in `/admin/photos`.
- About copy (`about.*`): "husband-and-wife team", "about two years… photographing all kinds of things", "Hablamos
  español" → owner approval.
- Travel fee numbers, photographers' photo (owner uploads in /admin; the confirmation email uses it too), bio text
  (drafted from owner's answers → approval), reviews (hidden until real).

## Bug log
Severity: critical / high / medium / low. Found in Phase 0 unless noted.
- **BUG-1 (high, fixed 1a)** `outlook-provider.createBooking`: a retry while the first request is still saving hits the unique
  `request_id` → returns code `slot_unavailable` ("already being saved"). `Booking.tsx` treats `slot_unavailable` as
  "time taken": drops the slot, clears the requestId and sends the parent back to pick another time — while the first
  request may still succeed → a second booking with a new requestId. Fix: distinct `in_progress` code; client waits and
  retries with the same requestId.
- **BUG-2 (high, fixed 1a)** Stale-price fallback: `getPublicCatalog()`/`getCatalog()` return hardcoded `config/bundles.ts`
  ($99/$199/$249) on DB errors / empty table. Ad visitors could see prices the server won't honor.
- **BUG-3 (high, fixed 1b)** Rate limiting: in-memory only (useless across serverless instances); none on `POST /api/booking/create`,
  `GET /api/booking/availability`, `POST /api/admin/login` (only a 700 ms delay → brute-forceable).
- **BUG-4 (medium, fixed 1a)** Times aren't labeled as Miami time anywhere (calendar, time step, review, confirmation); the calendar's
  "today" and month math use the visitor's local zone. Relatives booking from other states see unlabeled ET times.
- **BUG-5 (medium)** Overlap race: DB only blocks two active bookings with the *same start*; overlapping sessions
  submitted at the same moment can both succeed. Fix: exclusion constraint on a stored blocked range (start → end+buffer).
- **BUG-6 (medium, fixed 1b)** No security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **BUG-7 (low, fixed Oct 7)** Address form has no unit/apartment, gate, parking or concierge
  fields (Miami condos).
- **Phase 6 note (found Oct 7):** a failed Drizzle query's error message repeats the query's values, so the existing
  `log.error(..., { error })` calls after failed inserts (e.g. "Insert failed" in `outlook-provider.ts`) would write
  the family's name, email, phone, address and baby name into the Vercel logs. `lib/booking/access.ts` logs only the
  database's own reason (`err.cause.message`); do the same everywhere in the Phase 6 audit.
- **BUG-8 (low)** Confirmation step is in-memory: browser Back/refresh shows an empty form (no double booking — OK), but
  the parent loses the reference on screen. Consider sessionStorage restore on the confirmation.
- **BUG-9 (low)** Console warning on `/`: a CSS chunk is preloaded but not used within a few seconds.
- **BUG-10 (low, data)** Live bundle features: "Baby Only" vs "Baby only" capitalization (owner data in /admin).
- Checked OK: booking funnel completes on iPhone 14, desktop, Instagram + Facebook in-app user agents (mock); no
  hydration warnings; no horizontal overflow; user input is HTML-escaped in emails + Outlook body.

## Dependencies log
(one line per new dependency: why · bundle impact · maintenance)
- `scripts/local-db` (own package.json, NOT an app dependency, never installed by Vercel): `embedded-postgres`
  18.4.0-beta.17 + `pg` 8 — local Postgres for tests because the AI workspace can't reach Neon. 0 KB to the site.
- `@playwright/test` 1.63 (dev only) — e2e booking-funnel tests across iPhone Safari / Android / desktop / Instagram UA.
  Not shipped to the browser; browsers download separately (`npx playwright install`).
- `@upstash/ratelimit` 2.2 + `@upstash/redis` 1.39 — shared rate limits across serverless instances (official Upstash
  SDKs, updated Oct 2026). Server-only: 0 KB to the browser. Free tier.
- `eslint` 10 + `eslint-config-next` 16.4 (dev only) — replaces the removed `next lint`. 0 KB to the site. Official.
- `clsx` 2 + `tailwind-merge` 3 — `cn()` class joining (owner's choice, ahead of Tailwind in Phase 9). ~1 KB + ~7 KB gz in
  the browser. Both widely used and maintained.
- `@vercel/analytics` 2 + `@vercel/speed-insights` 2 — owner request (Oct 7). Tiny client scripts served from
  `/_vercel/*`, loaded only on Vercel. Official Vercel packages.
- Stripe: no SDK (two REST calls + webhook signature check with `fetch`/`crypto`, `lib/payments/stripe.ts`). 0 KB.
- `react-email` 6.11 — email templates as React components (brief Phase 2a). Server-side when sending; in the browser
  only in the lazy mock-mode email preview chunk (no page preloads it). It also installs its preview CLI's toolchain
  (esbuild, tailwindcss, socket.io…) into node_modules; none of that is bundled. Maintained by Resend, weekly releases.

## Research notes
- **Next.js:** latest stable 16.4.0 (2026-10); 15.5.27 is the "backport" tag. Next 16 deprecates/renames `middleware` →
  `proxy` and removes `next lint`. Route groups with separate root layouts → full page load between them.
- **Next 16 upgrade guide** (https://nextjs.org/docs/app/guides/upgrading/version-16, checked Oct 7): Turbopack default
  for dev + build (custom webpack config fails the build), sync request APIs removed, `proxy` = Node runtime only (edge
  stays on `middleware`), `revalidateTag` needs a 2nd arg (`'max'` = stale-while-revalidate, `{ expire: 0 }` = old
  immediate behavior; https://nextjs.org/docs/app/api-reference/functions/revalidateTag), image defaults (qualities
  [75], minimumCacheTTL 4 h, max 3 redirects), `next dev` writes to `.next/dev` + one dev server per project,
  `data-scroll-behavior="smooth"` needed to keep the old scroll override (we already have it).
  Note: the very first Turbopack build right after the upgrade failed prerendering `/` (hidden prod error) while a
  `next dev` was starting in the same folder; every build since (incl. a clean clone + `npm ci`) passes.
- **Vercel BotID** (`botid` 1.5.11): `withBotId()` in next.config, `initBotId({ protect: [{ path, method }] })` in
  `instrumentation-client.ts` (Next 15.3+), `checkBotId()` in the route. Basic = free on all plans; Deep Analysis (Kasada)
  Pro/Enterprise and billed. Invisible. https://vercel.com/docs/botid · https://vercel.com/kb/guide/vercel-botid-vs-cloudflare-turnstile
- **Upstash:** `@upstash/ratelimit` 2.2.0, `@upstash/redis` 1.39.0 (both updated 2026-10). Marketplace store injects
  `KV_REST_API_URL`, `KV_REST_API_TOKEN` (+ read-only token, `KV_URL`, `REDIS_URL`); `Redis.fromEnv()` reads
  `UPSTASH_REDIS_REST_*` then `KV_REST_API_*`. We read those plus `STORAGE_REST_API_*` (custom prefix).
- **BotID internals (1.5.11):** client patches `window.fetch`/XHR for protected paths and awaits a challenge from
  `/149e9513-…/a-4-a/c.js`; if that script fails to load, the first call rejects and later calls await forever.
  Server `checkBotId()` needs `VERCEL_OIDC_TOKEN`; returns HUMAN when NODE_ENV ≠ production.
- **Vercel Web Analytics / Speed Insights** (checked Oct 7): `<Analytics />` from `@vercel/analytics/next`,
  `<SpeedInsights />` from `@vercel/speed-insights/next` in the root layout; both send full URLs incl. query →
  `beforeSend` to redact (returns null to skip). Analytics must be enabled in the dashboard (adds `/_vercel/insights/*`
  on the next deploy). https://vercel.com/docs/analytics/quickstart · https://vercel.com/docs/analytics/redacting-sensitive-data ·
  https://vercel.com/docs/analytics/limits-and-pricing · https://vercel.com/docs/speed-insights/limits-and-pricing
- **React Email 6** (checked Oct 7; latest 6.11.1, 2026-10-06): one package `react-email` (components + `render`);
  `@react-email/components` is deprecated. `render()` is async; `toPlainText()` exists but flattens layout tables.
  Resend's `react:` param renders for you; we render ourselves to keep CID images + hand-written text.
  https://react.email/docs/getting-started/updating-react-email · https://react.email/docs/utilities/render ·
  https://resend.com/docs/send-with-nextjs
- **Vercel Cron** (checked Oct 7): Hobby = once per day per job, fires anytime within the scheduled hour; Pro = per
  minute, on time. Cron runs a normal function (same pricing). Schedules are UTC.
  https://vercel.com/docs/cron-jobs/usage-and-pricing
- **Vercel Cron security/delivery** (checked Oct 7): set `CRON_SECRET` and Vercel sends `Authorization: Bearer <it>`
  (GET). Delivery is best effort: a run can be missed or arrive twice, no retries → jobs must be idempotent and catch up.
  Doesn't follow redirects. https://vercel.com/docs/cron-jobs/manage-cron-jobs
- **Stripe Checkout** (checked Oct 7): Checkout Sessions expire 30 min–24 h after creation (default 24 h) → emails link
  to our `/pay`, which makes or reuses one. Inline `line_items[0][price_data]` (currency, unit_amount,
  product_data[name]) works without creating Products/Prices. Webhook: `Stripe-Signature: t=…,v1=…`, HMAC-SHA256 of
  `"<t>.<raw body>"` with the endpoint's `whsec_` secret, 5-min tolerance, retries for 3 days in live mode; listen to
  `checkout.session.completed` (+ `checkout.session.async_payment_succeeded`). Restricted keys `rk_live_…` are
  recommended over secret keys. https://docs.stripe.com/api/checkout/sessions/create ·
  https://docs.stripe.com/webhooks#verify-manually · https://docs.stripe.com/keys#limit-access
- **Address autofill** (checked Oct 7): with a separate apartment/unit field use `address-line1` (street) +
  `address-line2` (unit); `street-address` is meant for one multi-line box and the two styles shouldn't be mixed.
  https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill ·
  https://web.dev/articles/payment-and-address-form-best-practices
- **ZIP code centers** (checked Oct 7): US Census Bureau Gazetteer Files, newest = 2026, ZCTA national file (pipe-
  delimited: GEOID, …, INTPTLAT, INTPTLONG; ZCTAs approximate USPS ZIPs; PO-box-only ZIPs have no ZCTA).
  https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html ·
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
- **Meta Graph API:** v26.0 released 2026-07-29 (current). https://developers.facebook.com/docs/graph-api/changelog/version26.0
- **Meta domain verification:** Business Settings → Brand Safety → Domains → domain → Meta Tag Verification → Verify.
  https://developers.facebook.com/docs/sharing/domain-verification/verifying-your-domain

## Local test database
`cd scripts/local-db && npm install && node start.mjs` (add `--reset` to start over; as root set `LOCAL_DB_DIR=/var/tmp/th-pg/data` — a dir the `postgres` user owns, NOT the scratchpad).
Applies every `drizzle/*.sql` in journal order, seeds a mirror of production's bundles, and serves a Neon-HTTP-compatible
endpoint. `.env.local`: `DATABASE_URL=postgres://tiny:tiny@localhost:5433/tinyhumans`,
`NEON_LOCAL_FETCH_ENDPOINT=http://localhost:4444/sql` (ignored on Vercel). `touch scripts/local-db/.down` = simulated outage.
Note: pages are static ISR (revalidate 5 min); `next start` keeps its data cache in `.next/cache/fetch-cache`.
Fake Graph: `node scripts/local-db/fake-graph.mjs` (port 4545) + `.env.local`: `BOOKING_PROVIDER=outlook`,
`MICROSOFT_TENANT_ID/CLIENT_ID/CLIENT_SECRET=local`, `MICROSOFT_GRAPH_BASE_URL=http://localhost:4545/v1.0`,
`MICROSOFT_LOGIN_BASE_URL=http://localhost:4545` (both ignored on Vercel). `GET :4545/_events` lists created events.
Booking spam check refuses forms finished in < 4 s: automated tests must wait on the review step.
Fake Resend: `node scripts/local-db/fake-resend.mjs` (port 4646; emails saved to `scripts/local-db/.emails/`;
addresses containing `fail@` are rejected) + `RESEND_API_KEY=re_local RESEND_BASE_URL=http://localhost:4646`.
Fake Stripe: `node scripts/local-db/fake-stripe.mjs` (port 4747; `POST /_pay/<session id>` marks it paid and sends a
signed webhook to `FAKE_STRIPE_WEBHOOK_URL`) + `STRIPE_SECRET_KEY=rk_test_local STRIPE_API_BASE=http://localhost:4747
STRIPE_WEBHOOK_SECRET=whsec_local`. Reminder runs: `GET /api/cron/reminders?now=<ISO>` with `Bearer $CRON_SECRET`.
