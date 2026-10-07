# PROGRESS.md — Tiny Humans

Living plan + log. Update after every slice. New session: "Read CLAUDE.md and PROGRESS.md and continue."
Legend: `[x]` done · `[~]` in progress · `[ ]` to do · `[?]` waiting on owner

## ▶ NEXT STEPS (handoff, Oct 7, after 2a–2c)
State: everything below is on `main` and live (last deploy `7f4113f` + this handoff's docs commit).
1. **1g production verification** with the owner (brief section 4: test event code → one real booking from
   `/home-sweet-home` → check Events Manager, booking row source, emails, Outlook → cancel → remove the code), then send
   him the ads message (landing URL `https://www.tinyhumans.photography/home-sweet-home`, UTM template, optimize for
   `Schedule`). The owner got the 7-step checklist on Oct 7 and hasn't reported results yet. Pixel ID is confirmed in
   the live bundle; `META_CAPI_ACCESS_TOKEN` can only be confirmed by the owner (step 1) or by server `Schedule`
   events showing up in Test Events. His test booking will also be the first real send of the new confirmation email.
2. Vercel Web Analytics + Speed Insights are live (both `/_vercel/*/script.js` return 200 in production, Oct 7). Data
   appears in the Vercel dashboard → Analytics / Speed Insights after a few visits.
3. **Phase 2 (show rate)**: 2a, 2b, 2c **live** (Oct 7, `7f4113f`; owner approved the screenshots, ran migration 0007
   in Neon and added `CRON_SECRET`). First automatic reminder run: Oct 8, 14:00–14:59 UTC. Card-only payment copy
   live (`5097fe8`). **2d live** (`548aeac`, Oct 7): owner approved the screenshots + privacy Stripe line, ran migration
   0008 and added `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; /privacy visual baseline updated. Not yet exercised
   for real: the first "Session done" after a real session is the first live Stripe payment page (check /admin shows
   "Paid" afterwards; if not, Stripe Workbench → Webhooks → Event deliveries). Left in Phase 2: 2e SMS + photo-use
   checkboxes, edge items.
4. **Time-sensitive:** Halloween (cutoff Oct 28: theme + seasonal page + Halloween email logo/strip in
   `lib/email/assets.ts`), BUG-5 overlap constraint, DST (Nov 1): reminders + Outlook-mode slot times across the change
   were checked locally Oct 7 (Nov 2/5 9:00 am stored as 14:00 UTC, day-before reminder on Nov 1 correct); still to
   check: the calendar UI and availability on Nov 1 itself.
5. After the first real reminder runs (Oct 8 onward): glance at /admin → Leads → details for "Reminder" lines, and at
   Vercel → Settings → Cron Jobs → View Logs if one says "Not sent".
6. Ask the owner: privacy policy line for Vercel Web Analytics/Speed Insights (cookieless; the hosting-provider sentence
   partly covers it) — legal wording needs his OK. `/portfolio` page (see "Owner requests").
7. Admin photo slots for the 6 placeholders are complete (About ×4, landing ×2); the owner can upload them in
   `/admin/photos`, with editable alt text and per-theme versions.
8. Visual baselines in `.screenshots/parity/` were re-captured after the owner approved the new footer/About (Oct 7).
   The old `.screenshots/baseline/` set was captured mid-animation → recapture before Phase 9 uses it.

## ▶ Next session prompt
(Replaced by `/handoff` at the end of every phase. Copy everything inside the code block into a new session.)
```
Read CLAUDE.md and PROGRESS.md and continue. (Brief: tiny-humans-claude-code-prompt.md, gitignored, never commit.)

State (Oct 7): main = 7f4113f (+ handoff docs commit), live and smoke-tested: Phase 2a React Email (pixel-identical
templates in emails/), 2b upgraded confirmation (backdrop swatches, prep guide, what happens next, meet the
photographers), 2c daily reminder cron (/api/cron/reminders, table booking_emails, migration 0007 applied by the owner,
CRON_SECRET set). First real reminder run: Oct 8, 10–11 am Miami.
Not on main yet: nothing.

Next: Phase 1g with the owner if he has results (checklist in PROGRESS → NEXT STEPS 1), then the ads message. Then
Phase 2d: after-session emails (owner marks "session done" / "gallery delivered" in /admin; needs his payment details:
Zelle name/number, card link; review + referral ask), then 2e (SMS consent + photo-use checkboxes, migration first).
Research current official docs first (note links in PROGRESS.md).
Time-sensitive: Halloween cutoff Oct 28 (theme, seasonal page, email images), BUG-5 overlap constraint, DST Nov 1 UI check.
Waiting on the owner: 1g results, payment details for 2d, privacy-policy line for Vercel Analytics, /portfolio page.
Watch out: the folder is on the iCloud Desktop: " 2"/" 3" duplicate files appear (e.g. .next/types/routes.d 3.ts
breaks typecheck: delete the duplicates in .next). .agents/ + AGENTS.md are untracked files from another tool: leave
them. Email changes: compare old vs new renders with screenshots before sending anything real.
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
- **`/portfolio` page** (Oct 7): a standalone portfolio page "the same way as /book". Assumption until confirmed: the
  same photo feed as the home page's "Little moments" section (with the "Book a memory like this one" prompts and the
  lightbox), its own metadata, and the header "Portfolio" link pointing to `/portfolio` instead of `/#portfolio`.

## Status
- **Now:** Phase 1g (production verification) waits on the owner; Phase 2: 2a–2d live (Oct 7), 2e next.
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
- [x] 2d After-session (Oct 7, live; owner did migration 0008 + Stripe key + webhook): /admin → Leads → details →
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
4. Ages: **up to 5 years old, flexible on age**; booking before birth OK (flexible).
5. Capacity: 10–15 sessions a week; publish **"up to 10 home sessions a week"** (owner: 10 builds scarcity).
6. Gallery delivery: **24–72 hours** from shoot to fully edited.
7. Seasonal: **run Halloween too**. Last sessions: Halloween **Oct 28**, Thanksgiving **Nov 23**, Christmas cards **Dec 5**,
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
- **BUG-7 (low)** Address form has no unit/apartment, gate, parking or concierge fields (Miami condos).
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
