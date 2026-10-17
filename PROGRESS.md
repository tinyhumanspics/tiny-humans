# PROGRESS.md — Tiny Humans

Living plan + log. Update after every slice. New session: "Read CLAUDE.md and PROGRESS.md and continue."
Legend: `[x]` done · `[~]` in progress · `[ ]` to do · `[?]` waiting on owner

## ▶ LAUNCH — by Nov 15 (owner, Oct 12 late: "we need to launch this by November 15"; earlier that day "in 4 days")
**LAUNCHED Oct 15, 2026 (owner: "The launch is today").** Launch-day read-only check passed: 19 pages × iPhone WebKit
+ desktop Chromium OK, booking walked to "Pay $50 deposit" (never submitted), no console errors, CSS ties 0, travel
quote (33139: 6 mi, free; 30 free mi, $0.75/mi, 250 max) and deposit ($50, 48 h notice) answer, Vercel success. Fixes
only on `main` today; Phase 9 restyling resumes after launch with the Phase 8 checks.
Launch-critical owner items below. Phase 8 runs meanwhile in small invisible slices (full gates + parity each). Code
freeze on `main` the day before launch except fixes.
- [x] **Done (owner, Oct 12 late: "All the steps of stripe has been successfully done").** Owner, Stripe (guide sent Oct 12, checked against docs.stripe.com/keys + /webhooks): dashboard.stripe.com/apikeys
      → Restricted keys → the site's `rk_live_` key → ⋯ → Edit key → **Refunds: Write** (Checkout Sessions stays Write;
      the key value doesn't change). dashboard.stripe.com/webhooks → endpoint `/api/stripe/webhook` → Edit destination
      → add **`checkout.session.expired`** (keep `checkout.session.completed`; the signing secret doesn't change).
- [x] **Owner, Oct 12 late: done, refund issued in Stripe; Gmail light/dark check "all good" (Oct 15).** (it reaches the card in 5–10 business days). Still open: the
      Gmail-app light/dark check below (not mentioned). Owner + Claude: one real $50 deposit booking → confirmation email, Outlook event, /admin "Deposit paid" → cancel
      from the email link → Stripe shows the refund (~$1.75 Stripe fee is not returned). In the same test, open the
      family + studio emails in the **Gmail app in light and dark mode** (color-scheme fix `dc597da`), ideally with a
      @gmail.com address (Gmail's fix may need Google-hosted accounts).
- [ ] Owner (Oct 15: "I will"), /admin → Photos → Details: two photos are described by file name (screen readers/Google read these):
      "IMG 7378" (home "Little moments" photo captioned "Ten Tiny Toes", also on the landing page) and "IMG 6087"
      (About "Adrian & Alondra", also on the landing page).
- [x] **LIVE Oct 15 (`7f9049c`, owner "OK")**, privacy date now October 15, 2026 (Terms unchanged). Owner approval: privacy-policy sentence for Vercel Web Analytics + Speed Insights (re-explained Oct 15; the
      owner hadn't understood the Oct 12 note). Goes after the hosting sentence in Privacy → "Information we collect"
      (`legal.privacy.sections[0].body[4]` in en.json/es.json), Meta sentence unchanged. Facts from
      https://vercel.com/docs/analytics/privacy-policy + https://vercel.com/docs/speed-insights/privacy-policy.
      EN: "Our host also gives us anonymous visitor statistics (Vercel Web Analytics and Speed Insights) so we can count
      visits and see how quickly our pages load; they record things like the page, your type of device and browser and
      your approximate location, and they don't identify you."
      ES: "Nuestro proveedor de alojamiento también nos da estadísticas anónimas de visitas (Vercel Web Analytics y Speed
      Insights) para contar las visitas y ver qué tan rápido cargan nuestras páginas; registran datos como la página,
      tu tipo de dispositivo y navegador y tu ubicación aproximada, y no te identifican."
- [ ] Owner: Google Search Console + Business Profile (Google needs days to process; do before launch if possible).
      Step-by-step sent Oct 15 (DNS is at Squarespace Domains: TXT record from Search Console → domains.squarespace.com →
      DNS settings → Custom records; sitemap https://www.tinyhumans.photography/sitemap.xml; Business Profile at
      business.google.com/add as a service-area business with the address hidden). Owner, Oct 15: fine if the profile
      isn't a "place" as long as Tiny Humans shows up when people search. Google's guidelines
      (support.google.com/business/answer/3038177): businesses that travel to customers get one service-area profile
      with the address hidden, which fits. Site is indexable (robots allows, 12-page sitemap, canonical OK) but not
      listed yet on launch day: Search Console verify + sitemap + URL Inspection "Request indexing" speeds it up.
- [x] Claude: confirm Vercel deploys `cb5f472` (passkey recent-sign-in fix). **Deployed Oct 12** (Vercel success on
      `f2e329f` after the backlog cleared; read-only smoke: 6 pages 200, passkeys available true, travel 30 free
      miles, unauthenticated register → "Sign in first."). **Oct 12 finding:** the last Vercel
      deployment posted to GitHub is `ea899e2` (18:10 UTC); `f2e329f`, `5084bab`, `eddf4b2`, `7088435` have none —
      Vercel incident "Increased build and deployment failures" (Builds/Git Integrations partial outage) still open at
      18:33 UTC. So the passkey sign-in is live but the recent-sign-in rule probably is not yet. If no deployment appears
      after the incident: owner clicks Redeploy on the latest commit in the Vercel dashboard.
- [x] Oct 12 read-only production sweep (`launch-sweep.mjs`, iPhone 14 WebKit + 1440 Chromium, Meta/Vercel analytics
      blocked, no form submitted): 14 pages × 2 + 6 booking pages all 200 (404 page 404), 0 broken images, 0 sideways
      scroll, one h1 each, 27 internal links OK; booking calendar loads for all 3 bundles in EN + ES. Desktop
      "ERR_ABORTED _rsc" lines are Next.js prefetches that got 200 and were cancelled after reading (normal; client
      navigation works). Server time 0.25–0.8 s. Slow-4G + 4× CPU lab: landing text at 1.5 s; home/book text at ~3 s,
      the "LCP" there is the chalk logo finishing its intro (by design, not changed).

## ▶ NEXT STEPS (Oct 16: launched Oct 15; Phases 0–8 and 10 done; next Phase 9; CSP check ~Oct 19)
**Oct 17 (Claude Code):** optional baby gender (Boy / Girl) on the booking form, owner-approved, live (`bb63d63`),
migration 0021 run by the owner. **Seen Oct 17: production `/es` returns 404** (Spanish was published Oct 10). The gate
reads only /admin settings + content (switch, Spanish bundle rows, photo titles/alt, gallery prompts, enabled seasonal
offers), so a content gap (e.g. new photos without Spanish titles) or the switch being off hides all of /es; the
reason is listed in /admin → Settings → Spanish. **Owner re-published it Oct 17:** production `/es`, `/es/bundles`,
`/es/book`, `/es/home-sweet-home`, `/es/about`, `/es/privacy`, `/es/terms` return 200, hreflang en/es/x-default back on
the home page, and `/es/book` shows "Género (opcional)" with Niño / Niña (read-only check, booking API blocked).
**State Oct 16 (Claude Code):** main = `1021aac` + handoff docs, Vercel + CI green, production smoke-tested after every
slice. Since the Phase 8 handoff: launch (Oct 15); live-site price guard (`eff9e79`); arrival note in the confirmation
email, day-before reminder and confirmation screen (`59aade6`); privacy sentence for Vercel Analytics (`7f9049c`);
Phase 10 — dashboard data (`04ab1a2`) + chalk dashboard (`ca12524`), phone pass (`0ba63be`), AdminDialog (`1c1b8ad`) +
admin tests (`52b7ed4`). Owner items still open: photo descriptions (doing it), Search Console + Business Profile
(steps sent Oct 15; a service-area profile is fine), /portfolio, Terms review.
**State Oct 14 (Claude Code):** main = `f97c3e0` + handoff docs, Vercel + CI green, production smoke-tested after
every slice. Phase 8 complete (route groups, components/ + features/, booking form split, `config/bundles.ts` gone,
lint 0 problems, library evaluation: no switch, two stale-answer races fixed). Next: Phase 9 slice 1 (research +
parity tooling). Owner items below are unchanged except Stripe (done Oct 12).
**Update Oct 12 night (Claude Code):** main = `a3732e9` = Phase 8 slice 2 (route groups + SiteShell), Vercel + CI
green, production smoke-tested. The owner finished the Stripe steps and the refund test (refund reaches the card in
5–10 business days) and approved the seasonal themes as they are ("it looks great"). **Oct 13:** slice 3a live
(`b37fe12`, shared components moved; CSS tie fix) + `scripts/css-ties.mjs`; slice 3b live (`cbe95ae`, features;
no barrel index.ts). **Oct 14:** slice 4 live (`5835d78`, booking form split into a state hook + step components).
Slice 5 live (`604cdbf`, `config/bundles.ts` → `lib/pricing/types.ts` + `lib/pricing/dev-bundles.ts`).
Slice 6 live (`d51daa7`, lint warnings 22 → 4; the 4 data-loading effects wait for slice 7). Next: slice 7 (library
evaluation: forms, dialogs/lightbox, data fetching, animation; ask the owner before replacing any core library).
**State Oct 12 late (Claude Code):** main = `dc597da`, Vercel + CI green, production smoke-tested. Shipped today, all
live and checked: Dark Green backdrop + email swatch-grid fix (`c96a6ef`, `393715e`); deposit follow-up (owner deposit
link + re-hold, studio "Deposit not paid" alert, same-family retry, /admin settles overdue holds, "Cancelled · deposit
not paid", deposit wording on cards / /book / review: `f29618c`); seasonal board colors + Thanksgiving readability
(`8ff5143`, `d5a6fbf`; production still Original until the owner picks a theme); Phase 8 slice 1, prototype removed
(`cf73bdc` + `ac31f5c`); baby-only notes example (`f700d9d`, `d1468e2`); emails keep their colors in dark mode
(`dc597da`). Gates at `dc597da`: strict tsc, lint 0 errors/22 warnings, 44 units, build, 24/24 visual, 110 e2e (76
expected skips). Nothing unpushed; local worktrees/branches in the session scratchpad are disposable
(`wip/theme-backgrounds` holds only the preview-only theme switcher, never merge it).
**Passkeys live Oct 12:** Vercel published the passkey code during its incident without posting a GitHub deployment
status; production answers `/api/admin/passkeys/available` (200) and `/api/admin/session/others` (405 on GET), and the
live /admin JavaScript contains the new sign-in screens (password form unchanged). **The owner ran migration 0020 in
Neon Oct 12** and added Face ID on the iPhone and the Mac; the owner confirmed Oct 12 that it works. Lost phone: sign in with the password elsewhere → Remove it
→ "Sign out all other devices" (never rotate ADMIN_SESSION_SECRET: it signs every payment link).
**CSP:** report-only since Oct 12. Around Oct 19, read Vercel logs for `csp` warnings (Vercel dashboard → Logs, or
`npx vercel login` then `vercel logs` — the CLI on the Mac is logged out); if only expected noise, switch
`Content-Security-Policy-Report-Only` → enforced in `next.config.ts` (keep the report endpoint).
Earlier state (Oct 10): main included the Phase 6 CI/test and Spanish sitemap fixes through `2bd75b6`. The first Phase 6
security/quality slice added exact-origin checks for every admin mutation, bounded/validated login and photo uploads,
PII-safe recursive logging, Vitest security units, WCAG 2.2 axe/manual regression checks, element-level visual
baselines and the GitHub Actions gate (`ef5a6cf` + `2b6c84a`).
The complete `/es` public/customer route tree, explicit EN | ES
switcher, reciprocal hreflang, bilingual sitemap entries and locale-aware booking/email/payment/manage links are built.
`/admin/settings` now owns the Spanish publish/hide switch, shows every readiness gap and refuses to publish an
incomplete journey. Existing Vercel Blob saves default safely off; no environment variable, redeploy, SQL or dependency
is needed. The runtime still rechecks the complete live Spanish bundle rows plus owner photo/prompt/enabled-seasonal
copy, so a later content gap safely hides all Spanish routes even if the switch remains on. **The owner published
Spanish Oct 10:** production `/es` and all six checked Spanish public/customer routes return 200, the English page has
the ES switch, and both languages emit reciprocal alternates. The first live check found the deployment-frozen sitemap
still English-only; `2bd75b6` makes it dynamic so publication changes reach it without a redeploy. Strict nonincremental
tsc/build/lint passed (0 errors/23 known warnings), the SEO checks passed, all 16 English parity baselines matched, and
the Settings control was captured and inspected at iPhone 14 and 1440px.
The owner removed Christmas Cards Oct 9: `/admin/seasonal` and the landing contain only **Baby’s First Thanksgiving**
(Nov 23) and **Baby’s First Christmas** (Dec 21); old saved card data is ignored and disappears on the next seasonal
save. Seasonal offers, photos and home-gallery prompts accept optional matched Spanish copy; incomplete drafts cannot
leak English into the Spanish site. The landing FAQ heading remains centered while its rows stay left-aligned.
Phase 4 is complete: extra babies are live,
migration 0017 returned
3 bundle rows, and `/admin/seasonal` now edits the two remaining baby-first offers/cutoffs.
Vercel succeeded; production `/home-sweet-home` and `/admin/seasonal` returned 200. Seasonal offers remain safely hidden
until explicitly enabled and only appear under their matching theme through the inclusive cutoff. No seasonal SQL is
needed. Migrations 0010–0019 ran in Neon; the owner confirmed migration 0018 succeeded Oct 8 (the final language count
was empty because there are no production bookings yet) and migration 0019 succeeded Oct 8. Spanish bundle-copy
storage does not change today's English site.
Phase 5's core SEO is live: unique canonicals/Open Graph metadata, sitemap, robots, service-area business JSON-LD, and
noindex on the query-driven booking page. Photo descriptions were already editable in `/admin/photos`, so no migration
was needed. Strict tsc/build/lint (0 errors/26 known warnings), 51 e2e and all 16 visual-parity tests passed. Vercel
succeeded; production sitemap/robots, home canonical/OG/JSON-LD and `/book` noindex/canonical were checked read-only.
**Deposit $50 is on intentionally** (owner confirmed Oct 12); Terms, About and Home Sweet Home show the deposit copy
(rechecked read-only Oct 12). Left: the Stripe key permission + webhook event and one real refund test (NEXT STEPS 2). Deposits-off leads still support the automatic permanent payment link and existing sneak-peek/gallery
email tools; no SQL was needed for that behavior.
0. **Seasonal landing LIVE Oct 8:** in `/admin/seasonal`, enable the wanted offer(s) and save; in `/admin/theme`, choose
   the matching Thanksgiving or Christmas theme. Both are required, in either order. Once an offer is enabled, changing
   to its theme shows it automatically until the cutoff; changing away hides it without disabling it.
1. **DONE Oct 12 — travel fee:** owner confirmed **30 free miles** is intended; production answered `freeMiles 30,
   perMileCents 75, maxMiles 250` (read-only Oct 12). Earlier notes: **Owner: save the travel fee** in /admin → Availability → **Travel fee** (home-base ZIP, 30 free miles, $0.75 a
   mile, 250 farthest). Fees stay **off** until it's saved. **Oct 10 read-only check:** production
   `/api/booking/travel?zip=33139` answered `freeMiles 40, perMileCents 75, maxMiles 250`, so it looks saved (with 40
   free miles); owner to confirm 40 is intended. Then check that /home-sweet-home (FAQ "Which areas…") and
   /terms ("Packages and prices") show the numbers: saving revalidates both.
2. **Deposit go-live / confirm current switch** (see "Owner requests" → Deposit). Owner approved the wording (Oct 7).
   Production shows a $50 deposit, on intentionally (owner, Oct 12). Left:
   (a) **DONE Oct 8:** owner ran `drizzle/0014_booking_deposits.sql` in Neon; (b) **owner, in Stripe:** restricted key → **Refunds: Write**;
   webhook endpoint → add **`checkout.session.expired`** (owner asked Oct 12 what is left; steps sent); (c) **DONE Oct 12:**
   owner confirmed the $50 deposit is on intentionally; (d) one real booking with the owner (pay the deposit → event/emails/
   admin → cancel online → refund in Stripe), then check /home-sweet-home, /about and /terms show the deposit wording.
3. **1g production verification** with the owner (brief section 4: test event code → one real booking from
   `/home-sweet-home` → Events Manager, booking row source, emails, Outlook → cancel → remove the code), then the ads
   message (landing URL `https://www.tinyhumans.photography/home-sweet-home`, UTM template, optimize for `Schedule`).
   Checklist sent Oct 7. **Owner reported Oct 12: 1g is done and working.**
4. **Rest of the brief, in the owner's order (Oct 7 night: "time-sensitive first"; ship straight to main):**
   (a) **Phase 4 DONE Oct 8:** extra babies + editable seasonal landing offers. (b) **Phase 5 SEO core DONE Oct 8**;
   owner Search Console + Business Profile steps remain. (c) **Phase 3 DONE Oct 10: Spanish published**;
   (d) Phase 6 security/accessibility/tests/CI; (e) rest of Phase 7, then 8, 9, 10.
   Optional backlog: /admin "Today" view with tap-to-text.
   Done Oct 7 night: Resend bounce alerts, SPF/DKIM/DMARC check, BUG-5, DST check.
5. **Owner: finish SEO discovery setup:** verify `tinyhumans.photography` as a Domain property in Google Search Console
   (DNS verification), submit `https://www.tinyhumans.photography/sitemap.xml`, then claim/update Google Business
   Profile as a service-area business: hide the home address and select the real cities/ZIPs served (up to 20; no radius).
6. **Seasonal cutoffs** (decision 7, revised Oct 9): Baby’s First Thanksgiving Nov 23; Baby’s First Christmas Dec 21.
7. After the first real reminder runs (Oct 8 onward): glance at /admin → Leads → details for "Reminder" lines, and at
   Vercel → Settings → Cron Jobs → View Logs if one says "Not sent". If a payment ever shows "Not paid" after the family
   paid: lead → Payment → **Check with Stripe** (else Stripe Workbench → Webhooks → Event deliveries).
8. Ask the owner: privacy-policy line for Vercel Web Analytics/Speed Insights; `/portfolio` page (see "Owner
   requests"); have the new Terms travel paragraph reviewed with the rest of the Terms.
9. Visual baselines in `.screenshots/parity/` are current: 16 full pages plus 8 element checks (site header, bundle
   card, booking step tracker and landing FAQ × iPhone 14/1440), all passing Oct 10. The desktop landing-FAQ element
   baseline was updated Oct 10 after the owner asked for the centered FAQ (`2898be4`); the iPhone one Oct 11 when
   "Questions parents ask" began wrapping before the sun doodle (`f5dd838`). The old `.screenshots/baseline/`
   set was captured mid-animation → recapture before Phase 9.

**Spanish publication LIVE Oct 10:** production `/es` passed the all-or-nothing gate and the public Spanish routes,
EN | ES switch and reciprocal language metadata were verified. `/admin/settings` can hide it again at any time. If a
required owner translation later becomes incomplete, the runtime gate safely hides every `/es` route.

## ▶ Next session prompt
(Replaced by `/handoff` at the end of every phase. Copy everything inside the code block into a new session.)
```
Read CLAUDE.md (Claude Code) or AGENTS.md (Codex) and PROGRESS.md, and continue. (Brief: tiny-humans-claude-code-prompt.md, gitignored, never commit.)

State (Oct 16): main = 1021aac + handoff docs, live and smoke-tested. LAUNCHED Oct 15. Phase 10 done: /admin dashboard
(sessions coming up, chalk SVG charts, GET /api/admin/dashboard), phone pass (Leads Call/Text/Email/Directions,
Pricing layout, 26 px check boxes), native AdminDialog for confirmations, admin e2e tests. Also Oct 15: arrival note in
confirmation email / day-before reminder / confirmation screen, privacy sentence for Vercel Analytics, live-site guard
(built-in prices refused when VERCEL_ENV=production). /admin keeps the chalk design (owner: no light/dark mode).
Not on main yet: nothing.

Next: Phase 9 (Tailwind v4 + tokens), the last phase. Slice 1: read the current Tailwind v4 + Next 16 docs (note
links), rebuild the Phase 8 parity checks as scripts/parity/* (method in CLAUDE.md → Tests; only scripts/css-ties.mjs
exists), then one component per slice. Tailwind v4 uses cascade layers: unlayered CSS Modules/globals beat layered
utilities. The site is live with paying families: small verified slices only.
Time-sensitive: ~Oct 19 read Vercel `csp` warnings, then enforce the CSP; DST ends Nov 1 (check slots/reminders);
Thanksgiving last sessions Nov 23; First Christmas Dec 21.
Waiting on the owner: photo descriptions "IMG 7378" / "IMG 6087" (doing it); Search Console + Business Profile (steps
sent Oct 15); /portfolio; Terms review.
Watch out: never git stash/switch in the iCloud folder (scratchpad worktree + cp -Rc node_modules; link node_modules
with ln -sfn); stage exact existing paths; moving files can reorder Turbopack CSS (scripts/css-ties.mjs); no barrel
index.ts for client components; never submit a booking on production (block /api/booking/create in checks).
```

## Owner requests (outside the original brief)
- [x] **Baby gender on the booking form — LIVE Oct 17 (`bb63d63`)** (owner, Oct 17: "add gender on the steps of
      booking, only Male or Female"). Owner's picks: **optional**, words **Boy / Girl** (ES "Niño" / "Niña", label
      "Género"), **two tap buttons** under each baby's age (tap again = clear), shown on the review step, the
      confirmation screen, the family confirmation email, the studio email + Outlook event and /admin → Leads
      ("Luna (Girl, Newborn (0–2 weeks))"). Stored as `boy`/`girl` in its own best-effort table
      `booking_baby_genders` (migration `drizzle/0021_baby_gender.sql`, by `booking_babies.position`): a database
      without it keeps booking, only the gender is skipped (tested locally with the table renamed). Never sent to
      Meta/analytics; `gender` added to the log sanitizer. **Owner ran 0021 in the Neon SQL editor Oct 17.**
      Production check after deploy (read-only, booking API blocked): /book shows "Gender (optional)" + Boy / Girl,
      tap / tap again toggles. First real booking with a gender = the end-to-end proof (/admin + studio email). Checks: 56 units, 114 e2e, 24/24 visual, 0 CSS ties, local twins booking end to end
      (DB rows, both emails, fake Outlook event, /admin); owner approved the preview (artifact, Oct 17).
- [x] **Arrival note — LIVE Oct 15 (`59aade6`)** (owner, Oct 15: tell families we may arrive 30 min early to set up).
      Owner's picks: wording "We arrive up to 30 minutes before your session to set up our lights and backdrops, so
      everything is ready and looks just the way you imagined. Your session time stays the same." (ES: "Llegamos hasta
      30 minutos antes de tu sesión…"), right under the session details in the confirmation email, the day-before
      reminder and the website "Booking confirmed" screen (3-day reminder unchanged). Keys `emails.common.arrival` +
      `bookingFlow.confirmation.arrival`. The calendar already keeps `bufferMinutes` (default 45, /admin →
      Availability) free before and after each session; owner asked to confirm it's ≥ 30 (it also covers driving
      between back-to-back sessions). Checks: emails rendered before/after (text diff = only the note; 3-day reminder
      byte-identical), gallery `Claude outputs/arrival-note/index.html`, 47 units, 24/24 visual, 111 e2e; production
      booking pages (EN + ES) carry the note.
- [x] **Emails keep their own colors in phone dark mode** (owner, Oct 12: saw them change in the Gmail app; "keep
      them white too" for the studio emails; LIVE `dc597da`). Both layouts now declare
      `<meta name="color-scheme" content="light only">` + `supported-color-schemes` + `:root{color-scheme:light only}`
      (were `dark`). Rendered diff over 48 family emails: only those head lines. Gmail iOS/Android honor it since ~Oct
      2026 (maybe only Google-hosted accounts); Apple Mail honors it; Outlook mobile/web may still adjust (no
      `[data-ogsc]` overrides added; owner didn't see it there); classic Outlook for Windows can't be controlled.
      **Test with the owner** during the $50 deposit test (Gmail app, light + dark).
- [x] **Notes example without siblings for baby-only bundles** (owner, Oct 12; LIVE `f700d9d` + `d1468e2`): Little
      Moments / Our Little Story show "Favorite colors, a family heirloom to include, baby's usual feeding and nap
      times…" (ES matched); Our Family Story keeps "Siblings joining…". `includesSiblings()` (`lib/booking/
      bundle-traits.ts`) reads the bundle's `people` line **and features**: in production `people` is empty and "Baby
      + parents + siblings" is a feature (first push read `people` only and missed it; caught by the live check).
- [x] **Deposit follow-up + clearer deposit wording — LIVE Oct 12 (`f29618c`, owner: "Looks great, you can push it")** (owner, Oct 12: a family's wifi failed at the deposit step;
      /admin said "Waiting for deposit" and nobody got an email). Findings: by design no emails go out while pending;
      deleting a waiting lead closes its page silently; without Stripe's `checkout.session.expired` event the release
      waits for the sweep (calendar loads / daily cron); a family retrying the same time was blocked by its own hold.
      Owner answers: hold stays 30 min (a link works until the hold ends); a released time can be held again for 30
      min if still free; alert the owner when a deposit isn't paid; same family + same time → back to its payment page;
      opening /admin → Leads settles overdue holds; label "Cancelled · deposit not paid". Deposit wording: bundle cards
      + top of /book + review math ("part of your total, not an extra fee"), general early / exact at the end, small
      chalk line. **Built, NOT live:** local branch `wip/deposit-flow` (`b772fff`, from `9f904cc`): `ownerDepositLink`
      / `holdAgain` / `sendUnpaidAlert` / `heldForSameFamily` in `lib/deposit/flow.ts` (re-hold re-checks hours, blocks,
      Outlook + other bookings via `busyExcluding` + the overlap constraint; `session_start` re-listed so the trigger
      applies today's buffer; discount code use re-claimed best effort), `POST /api/admin/leads/deposit-link`,
      `DepositLinkPanel` in /admin, `emails/DepositLink.tsx` (EN/ES) + `internalDepositUnpaidEmail`, `publicDeposits()`
      (cached, tags `deposit` + `catalog`, expired on deposit save) → `CatalogProvider.depositFor` → `BundleCard`.
      No migration (booking_emails kinds `deposit_link` are free text). Checks: strict tsc, lint 0 errors/22 warnings,
      42 units; local Outlook-mode end-to-end (`deposit-flow-checks.mjs`, fake Graph/Resend/Stripe): 36/36. Review:
      `Claude outputs/deposit-link/index.html`. Shipped after the owner's OK: strict tsc, lint 0 errors, 42 units,
      build, 24/24 visual (deposits off in the test build), 110 e2e; Vercel success; production read-only: /bundles and
      the landing show the deposit line on all 3 cards (EN + ES), /book's bundle box shows it, the new admin action
      answers 401 unsigned, 7 pages 200. Home has no bundle cards (links to /bundles). Needs the Stripe
      `checkout.session.expired` event for on-time releases/alerts (otherwise the sweep: calendar loads, /admin, daily cron).
- [x] **Seasonal board colors — LIVE Oct 12 (`8ff5143`, `d5a6fbf`; owner approved: "move forward with the themes")** (owner, Oct 12: "only the background color… the whole site including admin but also
      emails… only when we switch the theme"; Christmas `#7E2E2E`, Thanksgiving `#8E4318`, New Year `#172647`; keep the
      chalkboard look and every drawing; preview before live). Owner answers: darker/lighter shades follow the color
      (OKLCH, same ratios as the green: Christmas dark `#5a2020`/light `#9a3d3c`, Thanksgiving `#663012`/`#ad5626`,
      New Year `#0e1931`/`#203158`; email page dark `#5a2423`/`#663318`/`#101a31`); readability judged after the
      preview; owner emails (white InternalLayout) unchanged; phone browser bar (`theme-color`, now `generateViewport`)
      follows; share picture (OG) stays green. **Built, NOT merged:** local branch `wip/theme-backgrounds` (worktree in
      the session scratchpad): `5c493c1` = the feature (`config/themes.ts`, `app/layout.tsx`, `lib/email/theme.ts`,
      `lib/email/assets.ts`: seasonal email logos re-composited from `public/brand/<theme>` layers at 440 px on the new
      color — validated against the old green JPGs, mean |Δ| ≈ 4/255; doodle strips lifted off the green with each
      theme's palette and put on the new color). `c2fab10` = **PREVIEW ONLY, never merge** (cookie theme switcher
      `/preview-theme/<id>` when Blob isn't configured, also enables the matching seasonal offer). Checks: strict tsc,
      lint 0 errors, 24/24 visual parity (Original unchanged), Original emails byte-identical (10 templates), seasonal
      emails differ only in the two board colors + logo/strip. `tests/unit/contrast.test.ts` fails for Thanksgiving
      only (muted 4.3, blue 3.7, error 4.1, form hints 4.0, offer cutoff line 3.1 vs 4.5) — owner to decide after the
      preview. Gallery: `Claude outputs/theme-backgrounds/index.html` (12 pages + 10 emails × 4 themes × phone/desktop).
      Not themed by design: `app/global-error.tsx` (crash screen), the prototype-only email frame, the admin dialog scrim.
      **Owner decisions (Oct 12, later):** Thanksgiving (b): lighten only its small text, cutoff line **white**,
      drawings **"just a little lighter"** (3:1), tape/icons follow the same colors, Thanksgiving emails too (logo
      unchanged). Values: chalkMuted `#cfd4c7`, cloudBlue `#94d7fd`, chalkError `#fdc5bd`, accent `#f69035`, accent2
      `#ff8778` (accent3 unchanged); Thanksgiving-only CSS (`:global(html[data-theme="thanksgiving"])`): hints 70%
      white, empty review stars 60% (not the selected yellow ones), `.seasonalCutoff` white. Email strip leaves
      shifted by the same amount. `contrast.test.ts` mirrors those overrides and passes for all 4 themes.
      Proof: Original/Christmas/New Year screenshots 44/44 pixel-identical and emails byte-identical before vs after.
- [x] **Dark Green backdrop — LIVE Oct 12 (`c96a6ef`)** (owner, Oct 12: "crucial … on all the areas"): forest green `#2e5a3d` (glow `#407050`,
      edge `#23462f`, same OKLCH relation as Burgundy), id `darkGreen`, "Dark Green" / "Verde Oscuro", right after
      Burgundy (`config/backdrops.ts` + both name maps in en/es.json; no migration: `booking_backdrops` stores ids
      without a check). Shows in the booking-form picker, /backdrop, confirmation + 72 h reminder swatches, "Your
      backdrops" lines, studio email, /admin lead, Outlook event (all read the one list).
- [x] **Email swatch grid bug — fixed LIVE Oct 12 (`393715e`, owner OK'd it with the backdrop):** one shared table + a short last row (7 backdrops = 3/3/1) stretched
      the columns, squeezing the third swatch column into thin strips (Pink, Beige) on phones and desktop. Fix: one
      table per row (`emails/components/blocks.tsx` `Swatches`). Only the swatch grid changes in the emails.
      **Ship set (branch `ship/theme-backdrops`, from main):** `b338b36` board colors, `189b0cd` Thanksgiving
      readability, `9cfd85f` Dark Green, `b5494a6` swatch fix (13 files). Preview-only switcher stays on
      `wip/theme-backgrounds`. **Owner, Oct 12: themes ON HOLD ("do not … publish the themes until I approve
      them"); ship only the backdrop.** Shipped `c96a6ef` + `393715e` (4 files) on top of `8558e7d`: strict tsc,
      lint 0 errors, 42 units, build, 24/24 visual, 110 e2e (76 skips); phone/desktop screenshots of the picker and
      email grid; Vercel success; production read-only: EN picker "Dark Green" and ES "Verde Oscuro" after
      Burgundy, board still `#183a22`, 7 pages 200. **Still on hold, not live:** the seasonal board colors
      (`5c493c1`) and the Thanksgiving readability commit (`5775ead`) on local branch `wip/theme-backgrounds`
      (cherry-pick both when the owner approves; Dark Green + grid fix are already on main).
      **Themes shipped Oct 12** as `8ff5143` + `d5a6fbf` (cherry-picks onto `f29618c`): strict tsc, lint 0 errors, 42
      units (contrast passes all 4 themes), build, 24/24 visual, 110 e2e, Original emails byte-identical (12 templates);
      Vercel + CI success; production still Original (`#183a22`, theme-color meta `#183a22`). The colors change only when
      the owner picks a theme in /admin → Theme. **Owner, Oct 12 late:** hadn't noticed the themes were live; after
      seeing them: "it looks great". No changes; switching stays manual in /admin → Theme (no schedule, no New Year offer).
- **Launch target (owner, Oct 12, later):** "we need to launch this by November 15"; after these changes go live,
  continue with the last phase(s).
- [x] **Keep chalk doodles off heading letters on every screen size** (owner, Oct 10: "Please do"; `f5dd838`). A strict
      scan (letter zones, not line boxes) found 20 live cases at 320–1024px in both languages, e.g. the sun on the "k"
      of "Questions parents ask" at iPhone 14 width with its heading heart alone on the next line, "Real homes, tiny
      humans" at 412–430px, five Spanish section titles, and the star on "pequeñitos." in the Spanish home hero
      (320–430 and 900–1024px). Fix: section titles leave 52px (centered: 104px) for the right-edge drawings and wrap
      before them; the last word and the heading's own doodle wrap together; the Spanish home hero is
      `clamp(1.5rem, 9cqi, 3.45rem)` below 1100px (Codex's size from 1100px). Live re-scan of 8 pages × 12 widths
      (320–1440): 0 overlaps. English changed only where a doodle touched letters (iPhone landing-FAQ element baseline
      updated with the owner's OK). New `tests/e2e/doodles.spec.ts` (English pages at 9 widths; Spanish landing titles
      at phone widths by swapping in es.json text).
- [x] **Center the About closing box and the landing FAQ; remove the heart over the Spanish landing heading** (owner,
      Oct 10). (1) About → "We'd love to meet your tiny human": the reveal wrapper (the centered grid item) sized itself
      to the unwrapped paragraph, so the 620px box sat at its left (desktop: 315px vs 505px of space in English, worse in
      Spanish). The wrapper now carries the box width; phones were already centered and are unchanged. (2) Landing FAQ:
      the 820px question list is centered under its centered heading; questions stay left-aligned (readable next to the
      "+"). (3) Spanish section headings no longer draw the desktop-only mid-heading board doodle (the heart at
      `right: 16%` that sat on "…protagonis**tas**" at 1024–1920px and on "Preguntas de otros padres" at 900–1024px).
      Titles over 30 characters (today only "Hogares reales, pequeños protagonistas") use `min(3.6rem, 4.8vw)` from 900px
      so they stay on one line clear of the right-edge sun/heart; Spanish desktop titles also wrap before those drawings.
      English section titles are all ≤ 24 characters, so English headings are unchanged. `SiteSettingsProvider` now
      exposes `locale`; `BoardDoodles` takes `desktopExtras={false}`. The phone-width sun overlaps were fixed next (above).
- [x] **Publish/hide Spanish from `/admin`** (owner, Oct 10; `627e8ea`): `/admin/settings` now shows whether the Spanish
      website is Hidden, Published, or On but safely hidden, lists missing live translations, and provides one protected
      publish/hide button. Enabling is refused until the live Spanish bundle rows and owner photo, gallery-prompt and
      enabled-seasonal copy all pass the readiness gate; disabling is always available. The switch lives in the existing
      Vercel Blob site settings, old saves default off, and normal theme/media/seasonal saves preserve it, so no Vercel
      environment change, redeploy, SQL or dependency is needed. If content later becomes incomplete, the runtime still
      fails closed and every `/es` route stays 404. Strict nonincremental tsc/build/lint passed (0 errors/23 known
      warnings), 88 e2e tests passed (26 expected skips), all 16 visual baselines matched, and the control was inspected
      at iPhone 14 and 1440px. Production stayed safely unpublished after deploy; `/es` remained 404.
- [x] **Center the landing FAQ heading** (owner, Oct 9; `d7f610c`): “Questions parents ask,” its doodle and underline
      are centered at phone and desktop widths; the accordion questions stay left-aligned for readability. Strict tsc,
      production build and lint passed (0 errors/24 known warnings); all 82 e2e tests passed (26 expected skips), and
      the changed section was captured and inspected at iPhone 14 and 1440px.
- [x] **Landing page refresh** (owner, Oct 7 night: "make sure the landing page is updated according to our main page and
      all the recent updates"; owner OK'd all 3 from `Claude outputs/landing-refresh/`, live `42d1229`). (1) Empty landing
      photo slots show the matching About Us photo (`LANDING_FROM_ABOUT` in `config/media.ts`: "Our set-up…" ← "Behind
      the scenes", "Adrian & Alondra" ← "Adrian & Alondra"; same frame shapes) until the owner uploads landing photos;
      /admin → Photos says "Using the About Us photo". Production had both landing slots empty and all 4 About photos
      filled. (2) Bonus box: backdrops are picked while booking or later from the confirmation email (was "we'll send
      you the options"); "Your prep guide arrives in your confirmation email, right after you book." (3) The theme's two
      hero doodles by the photos, as on the home page (seasonal themes now decorate both). Checked unchanged and current:
      ages (up to 2), sneak-peek promise (24 h / 72 h), notice hours, travel-fee FAQ, deposit wording (off), prices and
      bundle cards (same component), no Halloween, "up to 10 sessions a week", seasonal cutoffs, footer/header.
      ⚠ The About "Adrian & Alondra" photo's screen-reader description is "IMG 6087" (from the file name): owner can fix
      it in /admin → Photos → About Us Page → Details.
- [x] **Landing photos in /admin** (owner, Oct 7, live `543def3`): /admin → Photos → "Stay-Home Session Page
      (/home-sweet-home)" slots are now named like the page's cards: "Our set-up in a family's living room" (How it
      works) and "Adrian & Alondra" (Meet Adrian & Alondra). Same slots as before (saved photos unaffected).
- [x] **Halloween dates removed** from the landing page's final section (owner, Oct 7, `02ebc43`).
- [~] **Deposit while booking** (owner, Oct 7; wording approved; live `020eb27`…`543def3`; migration 0014 ran Oct 8,
      switched off during the Oct 8 verification; an Oct 9 production check found it **enabled at $50**, awaiting owner
      confirmation and the remaining Stripe steps; see NEXT STEPS 2). **How it works:** /admin → Pricing & Promotions → **Deposits**: on/off + one amount per
      bundle (`bundle_deposits`; a bundle without a row = $50; `deposit_settings` = the switch; off = today's flow).
      Booking form review step: "Deposit today $50 (holds your date)" + "Rest after the photoshoot", button "Pay $50
      deposit", note (30-min hold, refund rule). Create → booking saved **pending** (blocks the time like any booking) +
      `booking_deposits` row (pending, `hold_until` = Stripe page expiry, 31 min) → Stripe Checkout (`metadata.kind =
      "deposit"`, `expires_at`, message above the pay button) → back to `/book?bundle=…&deposit=<ref>&k=<HMAC>` which shows
      the confirmation / "Your date isn't confirmed yet" (+ Pay / Pick another time) / "no longer held". **Paid** (webhook
      `checkout.session.completed`, or the return page asking Stripe, or the sweep) → `confirmBookingRow`
      (`lib/booking/confirm.ts`: Outlook event → confirmed → emails) + Meta Schedule (CAPI after payment; fbc rebuilt from
      the saved fbclid when the webhook confirms). One request confirms (lease `confirming_at`, 2 min); calendar down →
      webhook 500 (Stripe retries), retried by the sweep. The manage token of such bookings is derived
      (`manageTokenFor`, HMAC of the booking id with `ADMIN_SESSION_SECRET`) so any request writes the same links.
      **Not paid** (webhook `checkout.session.expired`, or the sweep after `hold_until`) → booking cancelled ("Deposit not
      paid…", cancelled_by null), deposit `expired`, discount-code use given back, one "Your date isn't confirmed yet"
      email (skipped if they booked again). "Pick another time" → closes the page now, no email. **Sweep** =
      `sweepDeposits()` after every availability response, before saving a booking, and in the daily cron.
      **Refunds** (Refunds API, idempotent): automatic when the family cancels online; owner's cancel form has "Refund
      the $X deposit" (ticked unless inside the notice window); Delete Lead refunds a paid deposit and first closes an open
      page; failed refund → flagged on the lead + "Refund the deposit" button. **Stripe down while booking** → confirmed
      without it (`unpaid`, "Deposit not paid" pill, email says we'll send a link); the payment link then takes the
      deposit first (before the session), the rest after. Payment link / sneak peek / gallery charge total − paid deposit
      (Stripe line "… (after your $50 deposit)"). Dashboard "Paid this month" includes kept deposits. Reminders skip
      pending bookings; emails/reminders/event/studio email show "Deposit paid $50 · Rest $199". Marketing pages say "$50
      deposit holds your date", or "a deposit from $50" when bundles differ. Terms: booking paragraph + refund rules
      (only while on; "last updated" = when switched on). **Oct 8 deposits-off follow-up:** owner confirmed the switch
      applies to new bookings only. Saving it off was reproduced through the real Outlook provider against local
      Postgres/Graph/Resend/Stripe: the new booking was immediately `confirmed`, had no `booking_deposits` row or hold,
      and its lead had the automatic permanent signed payment link for the exact $149 total. Leads now explicitly say
      "Deposit: Not required for this booking ($0 paid today)"; the link says it was created automatically and never
      expires. Pricing & Promotions clearly distinguishes an unsaved toggle from "off and saved" and explains that the
      existing sneak-peek/gallery emails keep the link while unpaid. Existing older deposit bookings keep their original
      hold/terms. No migration and no new email. Two UI regressions pass at phone + desktop sizes; screenshots inspected.
      Full verification: strict tsc, build, lint (0 errors/26 known warnings), 59 e2e passed (4 expected Node-only skips),
      and all 16 visual-parity pages passed. Earlier deposit work: 97 local checks (`deposit-checks.mjs`, Outlook mode,
      fake Graph/Resend/Stripe), screenshots in `Claude outputs/deposit/` (phone + desktop; `-mixed` = $50/$50/$100).
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
- [x] **Sneak peek / gallery before the session + payment visibility** (owner, Oct 7, live `29a2cb5`): "Send sneak peek"
      and "Gallery delivered" work any time (not cancelled); before the session /admin asks "The session hasn't happened
      yet … Send anyway?". Lead cards show **"Paid $X"** (solid yellow) or **"Not paid"** once the session has ended;
      Dashboard: **Paid this month** (Miami month, `booking_payments.paid_at`) + **Sessions not paid yet** (ended, not
      cancelled, amount > 0, not paid). **"Check with Stripe"** (lead → Payment) = backup for a missed webhook: the saved
      Checkout page, then `GET /v1/checkout/sessions?customer_details[email]=…&status=complete` matched by
      `metadata.booking_id` (same key permission as today). Note: emails are keyed by session time, so a sneak peek sent
      before a reschedule shows "Not sent yet" again after it. 17 local checks (fake Stripe: `?nohook=1` = missed webhook).
- [x] **Backdrops: Beige + Wooden + Pink, picked on the site** (owner, Oct 7–8; original live `686dd5e`, Pink added
      in `a8719e7`; owner OK'd `Claude outputs/backdrops/` and ran migration `drizzle/0013_booking_backdrops.sql`, a separate best-effort table). 7 backdrops (`config/backdrops.ts`; Beige/Pink colors + a
      drawn wood-grain texture `public/backdrops/wooden.jpg`, also attached to emails as CID). **One per setup**
      (`setupsOf`: "N setups" in the bundle's details → Little Moments 1, Our Little Story 2, Our Family Story 3).
      Optional on the booking form (details step, after Notes); review + confirmation page show them. Confirmation
      email: picked → "Your backdrop(s): …" + **Change backdrop**; not picked → all swatches (rows of 3) + **Choose
      your backdrop**. 72 h reminder: same (its own link). **/backdrop?t=** (manage token, like /reschedule; no intro):
      pick/change until the day before the session (Miami date), then "text us". A change → studio "Backdrop update"
      email + the Outlook event's description rebuilt from the booking (`updateCalendarEventBody`). /admin lead:
      "Backdrop: … (changed by the family <date>)". Studio email + Outlook event: "Backdrop" line. 28 local checks.
- **`/portfolio` page** (Oct 7): a standalone portfolio page "the same way as /book". Assumption until confirmed: the
  same photo feed as the home page's "Little moments" section (with the "Book a memory like this one" prompts and the
  lightbox), its own metadata, and the header "Portfolio" link pointing to `/portfolio` instead of `/#portfolio`.

## Status
- **Now:** Phase 1g done (owner, Oct 12); **Phase 2, Phase 4 and Phase 5 are complete** (the optional Today view stays in
  the backlog). Phase 3 implementation is complete: the paired catalogs and gated `/es` tree cover customer emails,
  the public/customer journey, seasonal offers, photos, prompts, SEO alternates and locale-aware customer links. The
  owner published Spanish Oct 10 (`/admin/settings` can hide it again).
  Christmas Cards was removed Oct 9; only Baby’s First Thanksgiving and Baby’s First Christmas remain. Deposit code is
  live and on at $50 (owner confirmed Oct 12); the owner finished the Stripe key/webhook steps and the real refund test
  Oct 12. BUG-5 database rule and email bounce table are live; Resend webhook + secret verified.
  **Phase 6 (Oct 10–12) is done except time/owner-gated items:** second bug hunt, API audit, accessibility pass,
  report-only CSP, lighter public pages and passkey sign-in are live (owner added Face ID Oct 12); left: CSP enforce
  after a quiet week (~Oct 19), an optional VoiceOver listen-through. **Phases 7 and 8 are complete (Oct 14):** route
  groups, the components/ + features/ structure, the booking form split, `config/bundles.ts` removed, lint 0 problems,
  library evaluation (no switch). **Launched Oct 15.** **Phase 10 complete (Oct 15–16):** dashboard (sessions coming
  up, chalk charts), phone pass, native admin dialogs + admin tests; /admin keeps the chalk design. **Next: Phase 9**
  (Tailwind v4 + tokens), the last phase.
- **Tools (Oct 8):** the owner continues with **Codex** (VS Code on the Mac) while Claude credits are low, and may
  come back to Claude Code (e.g. Monday). `AGENTS.md` (Codex) mirrors `CLAUDE.md`; both handoff skills write one
  prompt that works in either tool. Keep the two rule files in sync.
- Baseline at `cd667b1`: `npm run typecheck` ✅, `npm run build` ✅, `npm run lint` ⚠️ (`next lint` deprecated + unconfigured,
  prompts interactively; fix in Phase 7 with ESLint flat config).
- Since `wip/next-16`: `npm run lint` = ESLint 10 flat config (0 errors, 27 warnings: unused imports + React Compiler advice).
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
- [x] 1g Production verification with owner (test event code → one real booking → verify → cancel → remove code);
      owner reported Oct 12 that it is done and working.

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
- [x] **DST check for Nov 1** (Oct 7 night): `zonedTimeToUtc`, `todayInZone` around midnight, slots on Oct 31 / Nov 1 /
      Nov 2 with Outlook events (UTC from Graph) and manual blocks, March 2027 too: all correct. Outlook events are written
      as Miami wall time + "Eastern Standard Time" (the Windows zone that follows DST); all formatting uses Intl with
      the studio zone; production availability shows 9:00–17:00 starts on both sides of Nov 1. Reminders were already
      tested across the DST night (2c). Nothing to change.
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
- [x] Edge: out-of-area → **travel fee** (owner, Oct 7, live `772e01f`; migration 0012 ran). Owner's terms: **$0.75 per
      road mile beyond 30 free miles**, online booking **up to 250 miles** (farther → "text us"), **non-Florida ZIPs
      stopped** (always, even with fees off), codes/offers lower the bundle only (fee always in full). All four numbers
      live in /admin → Availability → **Travel fee** (`travel_settings`; the home-base ZIP is typed there by the owner and
      never written in the repo); **fees are off until the owner saves them**. Distance = straight line between Florida
      ZIP centers (Census 2026 ZCTA gazetteer, `scripts/fl-zip-centroids.mjs` → `lib/travel/fl-zips.ts`, 1013 ZIPs,
      32 KB server-only) × 1.15; fee = floor((miles − free) × $/mile), whole dollars. Shown under the ZIP box as soon as
      it's typed (`GET /api/booking/travel?zip=`, rate limit "travel" 60/10 min), on the review step + confirmation page
      ("Travel fee $29 (about 69 miles)", "Total"), in the confirmation email, studio email, Outlook event and /admin.
      The server recomputes it at booking (never trusts the browser) and snapshots it on the booking
      (`bookings.travel_fee_cents/travel_miles`); amount due / payment link / Dashboard / Meta value = bundle + fee; the
      Stripe page shows a second line "Travel fee (about N miles)". FAQ (`aFee`) + Terms paragraph (`travelFeeTerms`)
      use the saved numbers; saving revalidates both. 26 local checks + a non-Florida e2e.
- [x] Edge: Resend webhooks → flag bounces/complaints in /admin (Oct 7 night, live `3876f16`; migration 0016 + Resend
      webhook/secret completed and verified Oct 8).
      `POST /api/resend/webhook` (Svix signature with `RESEND_WEBHOOK_SECRET`, 5-min tolerance, `lib/email/delivery.ts`)
      saves email.bounced / complained / suppressed / failed in `email_events` (migration 0016; id = webhook message id +
      recipient, so retries/replays add nothing). Every email now carries Resend tags `category` (send scope) and
      `booking` (reference). A problem shows on the lead when the recipient is the booking's own address and the tag is
      its reference (untagged older emails: by address, after the booking was made). /admin → Leads: red pill "Email
      bounced" / "Marked as spam" / "Email blocked" / "Email failed" + "Email problem" lines ("The confirmation email
      bounced … Text the family to check their email address."). Studio alert email ("EMAIL BOUNCED", red) the first time
      an address has a problem, never for the studio's own address. Table missing → leads load as before, webhook 500
      (Resend retries ~1 day). 26 local checks (Outlook mode, fake Resend sends signed webhooks for `bounce@`, `spam@`,
      `blocked@` addresses); screenshots `Claude outputs/email-bounces/`.
- [x] SPF/DKIM/DMARC check (Oct 7 night, public DNS): Resend DKIM `resend._domainkey` ✓, return-path `send.` subdomain
      SPF + MX ✓, root SPF `include:spf.protection.outlook.com -all` ✓ (Microsoft 365), DMARC `v=DMARC1; p=none;` ✓
      (monitoring only; Gmail/Yahoo accept it at our volume). Website emails pass DMARC through DKIM. Optional owner
      improvements: add `rua=mailto:…` to DMARC for reports, later `p=quarantine`; switch on Microsoft 365 DKIM
      (selector1/selector2 CNAMEs are missing, so emails sent from Outlook pass DMARC only through SPF). Replies to
      website emails go to `BOOKING_NOTIFICATION_EMAIL` (replyTo).
- [x] Edge: duplicate-booking flag (Oct 8, live `79ab33e`): active bookings with the same normalized email or phone
      show a yellow **Possible duplicate** pill + the other booking reference(s) on /admin lead cards. Email matching
      ignores case; US phone matching treats `+1 (305)…` and `(305)…` alike. Cancelled history is ignored, so a family
      booking again after cancelling is not flagged. No migration. Local Outlook-mode check: two active matches were
      both flagged; after cancelling one, both warnings cleared. 21 e2e passed; phone + desktop screenshots in
      `.screenshots/duplicate-booking/`.
- [x] Edge: block a day in /admin + notify/reschedule every affected family (Oct 8, live `fd98d3e`, Vercel + production
      smoke-tested; owner approved phone +
      desktop UI/email): /admin → Availability checks future confirmed/rescheduled/pending sessions before a whole-day
      closure. One action closes the date first, then sends every active family a branded schedule-change email with a
      private **reschedule-only** token (`booking_emails.kind = day_closed`, no migration); it bypasses the booking's
      normal notice cutoff, expires automatically when the session moves, and cannot open cancel/backdrop pages.
      Pending-deposit families have the open Stripe page expired and time released before receiving a fresh booking
      link; "Close without emailing" still closes those pages so a blocked date cannot confirm later. Sends are
      idempotent, failed emails can retry three times, partial failure never reopens the day, and /admin keeps email/
      phone links for manual contact. Family self-reschedule uses the existing Outlook PATCH → atomic Neon save/history
      → Outlook rollback-on-DB-failure path. Local Outlook/Neon/Resend/Stripe test: two families, partial failure + safe
      retry/no duplicate, 9999-hour cutoff bypass, other-purpose token rejection, event/row aligned after move, pending
      deposit email and no-email paths; 21 e2e passed. Screenshots: `.screenshots/close-day/`.

## Phase 3 — Spanish (owner: "same time, no rush" → after Phase 2)
- [x] Research i18n (Oct 8): use `next-intl` 4.14.9 (current App Router/server/client support, routing helpers,
      plurals and date/number formatting; npm unpacked size ~400 KB, updated Oct 2) rather than a home-grown context.
      Keep today's English URLs unprefixed and put Spanish under `/es`; explicit switch links, no browser-language
      redirect (`localeDetection: false`), and reciprocal self/English/Spanish `hreflang` plus `x-default`. Do not index
      or advertise a partly translated Spanish journey. Sources: [Next.js internationalization guide](https://nextjs.org/docs/app/guides/internationalization),
      [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router),
      [next-intl routing](https://next-intl.dev/docs/routing),
      [Google multilingual sites](https://developers.google.com/search/docs/advanced/crawling/managing-multi-regional-sites),
      [Google localized versions / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions).
      New dependency: `next-intl` 4.14.9 for typed messages, ICU plurals/date/number formatting and locale-aware links;
      installed footprint is ~2.3 MB across `next-intl`, `use-intl` and FormatJS (npm package itself ~400 KB unpacked),
      current Next 16/React 19 peers, maintained Oct 2, and `npm audit --omit=dev` reports 0 vulnerabilities. Only the
      messages needed by a client subtree will be provided, so the entire catalog is not shipped to every browser.
      Dormant foundation: shared `AppLocale`, the future `as-needed` URL policy (English unprefixed, Spanish `/es`,
      detection off), request config and Next plugin. It does not publish `/es` or change today's English site. Strict
      tsc/build/lint (0 errors/26 known warnings), 51 e2e and all 16 parity tests passed.
- [x] Move all customer strings to messages/en.json + es.json; booking `locale` column; Spanish emails. Migration
      `drizzle/0018_booking_locale.sql` is additive/idempotent, keeps existing bookings in English, and must run in Neon
      before app code reads the column. Local Postgres: ran the migration twice; 9 existing bookings remained `en`, the
      non-null default was `en`, and exactly one language constraint existed. **Oct 8 email slice (`a8719e7`):** every
      customer-email catalog entry now has an English/Spanish pair; confirmation, reschedule, cancellation, closed-day,
      reminders, deposit-abandoned and payment-link templates localize dates, times, babies, prices, policies and
      backdrops. The mock-only confirmation screen previews either language. A schema/placeholder test keeps both
      catalogs aligned; the booking test renders Spanish in Chromium, Android and iPhone/WebKit. The first full run
      caught WebKit's mixed Spanish/US date order, so Spanish long dates are now deterministic. Phone + desktop email
      renders were inspected; 53 e2e passed (4 expected Node-only skips), all 16 visual-parity pages passed, strict tsc/
      build/lint passed (0 errors/26 known warnings). **Oct 8 locale wiring (`7489399`):** the owner ran migration 0018
      successfully; its final count returned no rows because production has no bookings yet. New bookings save validated
      `en`/`es` (English by default), and that snapshot now selects the language for confirmation, reminders,
      cancellation, rescheduling, closed-day, deposit-abandoned, payment-link, sneak-peek and gallery emails. Internal
      studio emails remain English. An isolated local Outlook/Neon/Resend booking stored `es`, created its event and sent
      the customer a Spanish confirmation while the studio notification stayed English. Strict tsc/build/lint passed (0
      errors/26 known warnings), 60 e2e passed (6 expected cross-browser skips) and all 16 visual-parity pages passed.
      **Oct 8 page capture (`94eb193`):** the reusable booking page now carries its `AppLocale` into the real browser
      request (the live English route explicitly sends `en`; a regression test inspects the submitted request). Vercel
      succeeded and production `/book?bundle=little-moments` returned 200. Strict tsc/build/lint passed (0 errors/26
      known warnings), 60 e2e passed (6 expected cross-browser skips) and all 16 visual-parity pages passed. Spanish
      remains dormant until the fully translated public route calls this component with `es`. **Oct 8 About catalog
      (`43e10dc`):** the complete About copy now has an English/Spanish pair, the shared page accepts either catalog,
      and centralized path helpers keep English unprefixed while preparing `/es` links. The `/es/about` route remains
      unpublished. Catalog-shape and path tests were added; strict tsc/build/lint passed (0 errors/26 known warnings),
      62 e2e passed (10 expected cross-browser skips), all 16 visual-parity pages passed, Vercel succeeded and
      production `/about` returned 200. **Oct 8 catalog storage (`0173690`):** additive/idempotent migration 0019 adds
      separate Spanish rows for owner-editable bundle names, descriptions, badges, offer labels and inclusions; shared
      prices, minutes and photo counts stay language-neutral. No copy was invented or published, and missing Spanish
      rows will not silently fall back to English. The isolated migration ran twice, accepted Spanish rows and rejected
      unsupported locales/invalid inclusion positions. Strict tsc/build/lint passed (0 errors/26 known warnings), 62
      e2e passed (10 expected cross-browser skips), and all 16 visual-parity pages passed. Vercel succeeded; production
      home, About and booking returned 200. The owner ran migration 0019 successfully Oct 8. **Oct 8 public shell
      (`ee78e80`):** header navigation, screen-reader labels, footer links/contact/copyright and their URLs now accept a
      locale-specific catalog. English is still passed explicitly by the live root layout, while the complete Spanish
      pair and `/es` links stay dormant for the future Spanish layout. Only the small header/footer catalogs cross the
      server-to-client boundary. Catalog-shape/path tests passed; strict tsc/build/lint passed (0 errors/26 known
      warnings), 63 e2e passed (12 expected cross-browser skips), and all 16 visual-parity pages passed. Vercel
      succeeded; the live English shell text was present and home, bundles, About and booking returned 200. **Oct 8
      admin bundle editor (`c7ac181`):** `/admin/pricing` now loads and saves each bundle's Spanish name, description,
      badge, offer label and matching inclusions in the migration-0019 tables. A started draft must translate every
      matching English field; leaving every Spanish field blank keeps it off, and none of this copy is public yet.
      Inclusion add/delete/reorder actions keep both languages aligned. An isolated local Neon/HTTP round trip created,
      reloaded and deleted a translated bundle; strict tsc/build/lint passed (0 errors/25 known warnings), 66 e2e passed
      (15 expected cross-browser skips), all 16 visual-parity pages passed, and phone/desktop admin captures were
      inspected. Vercel succeeded; production home, bundles, booking, About and the protected admin-pricing page returned
      200, its API correctly returned 401 without an owner session, and the live English navigation remained intact.
      **Oct 8 localized catalog loader (`5265439`):** the public catalog can now be requested explicitly in Spanish;
      it combines the owner-saved migration-0019 rows with shared prices, timing and add-on facts, and localizes fixed
      duration/location/button/offer wording from the message catalog. Missing fields, missing inclusions or noncontiguous
      inclusion positions fail the Spanish publication gate instead of leaking English. English and Spanish last-good
      snapshots use separate Blob prefixes and memory slots, so an outage cannot mix languages. No live caller requests
      Spanish yet. Strict tsc/build/lint passed (0 errors/25 known warnings), 67 e2e passed (20 expected cross-browser
      skips), and all 16 visual-parity pages passed. Vercel succeeded; production home, bundles, booking, About and the
      protected admin-pricing page returned 200, `/es` remained an intentional 404, and live package cards kept their
      English names and calls to action.
      **Oct 8 bundle-page shell (`23724fd`):** bundle-page metadata, heading, inspiration banner, price/accessibility
      labels, offer cutoff, unavailable state and booking URLs now accept matched English/Spanish message catalogs and
      a locale. The live `/bundles` page and ad landing explicitly pass English; the future Spanish page can pass `es`
      without forking these components. Old duplicate bundle-page copy was removed from `config/site.ts`. Strict tsc/
      build/lint passed (0 errors/25 known warnings), 67 e2e passed (20 expected cross-browser skips), and all 16 visual-
      parity pages passed with the English bundle page and landing pixel-identical. Vercel succeeded; production
      bundles, ad landing and booking returned 200, `/es/bundles` remained an intentional 404, and the expected English
      bundle/offer/seasonal text was present. **Oct 8 booking date/time shell (`c23fe08`):** booking metadata and heading,
      the four-step tracker, calendar month/day/availability labels, date and time formatting, navigation actions,
      availability/submission fallbacks and the baby-led note now accept paired English/Spanish catalogs. The live
      booking page explicitly passes English; Spanish details/review/deposit completion still need their own slices, so
      no `/es/book` route is published. The calendar now says the grammatically correct singular “1 time available.”
      Strict tsc/build/lint passed (0 errors/25 known warnings), 67 e2e passed (20 expected cross-browser skips), and
      all 16 visual-parity pages passed with the live English booking appearance unchanged. Vercel succeeded;
      production booking, bundles and ad landing returned 200 with the expected English content, while `/es/book`
      remained an intentional 404. **Oct 8 booking family-details form (`14dc4cd`):** the selected-bundle summary,
      contact/address fields and validation, stored age options, twins/triplets choices, travel hints, notes, backdrop
      names and permissions now use paired English/Spanish catalogs. Translated age labels keep the stable English
      values expected by server validation. English remains the only live caller and `/es/book` stays unpublished.
      Strict tsc/build/lint passed (0 errors/25 known warnings), 67 e2e passed (20 expected cross-browser skips), all 16
      visual-parity pages passed, and the Details step was captured and inspected at iPhone and 1440px desktop widths.
      Vercel succeeded; production booking and bundles returned 200 with the expected English details-form content,
      while `/es/book` remained an intentional 404. **Oct 9 booking Review step (`0a1f90c`):** localized rows now cover
      bundle/offer/code pricing, full-price extra babies, travel, deposit or pay-after wording, inspiration, date/time,
      address, babies and ages, backdrops and permissions; Change/Edit controls and every discount-code outcome are
      paired too. Public formatting helpers now accept translated unit/backdrop/notice labels while defaulting to
      English for existing callers. The browser error contract now declares the `rate_limited` code already returned by
      booking APIs. Strict tsc/build/lint passed (0 errors/25 known warnings), 67 e2e passed (20 expected cross-browser
      skips), all 16 visual-parity pages passed, and the Review step was captured and inspected at iPhone and 1440px.
      Vercel succeeded; production booking returned 200 with the expected English review/payment/discount content,
      while `/es/book` remained an intentional 404. **Oct 9 booking confirmation + deposit return (`4685217`):** the
      final booking screen now localizes its reference/bundle/date/time/address, baby ages and names, backdrops,
      pricing/add-ons/travel, payment balance, change policy and email status. Every state after the optional Stripe
      deposit page (checking, confirming, waiting, expired and invalid) uses the selected language and keeps retry/
      restart links on that language's path; raw API errors are replaced with safe localized family copy. Shared page
      formatters keep Review and Confirmation aligned. Strict tsc/build/lint passed (0 errors/25 known warnings), 67
      e2e passed (20 expected cross-browser skips), all 16 visual-parity pages passed, and Confirmation was captured
      and inspected at iPhone and 1440px. Vercel succeeded; production booking and bundles returned 200 with the
      expected English completion catalogs, while `/es/book` remained an intentional 404. **Oct 9 cancel + reschedule
      pages (`6ca069f`):** every customer state and control on the email-linked cancel page and the three-step
      reschedule flow now accepts matched English/Spanish catalogs, including dates/times, localized bundle names,
      policy cutoffs, validation and safe API-error copy. The cancel API summary now includes the stable bundle id so a
      future Spanish page can show the owner-saved translated name rather than the English booking snapshot; the admin
      reschedule tool keeps its English defaults. A browser regression opens both mock manage links and completes a
      cancellation in all three browsers. Strict tsc/build/lint passed (0 errors/25 known warnings), 70 e2e passed (20
      expected cross-browser skips), all 16 visual-parity pages passed, and both manage pages were captured and
      inspected at iPhone and 1440px. Vercel succeeded; production cancel/reschedule returned 200 with expected English
      content, while `/es/cancel` and `/es/reschedule` remained intentional 404s. **Oct 9 customer email tools
      (`974cb10`):** the backdrop picker, review form and payment-status page now accept matched English/Spanish
      catalogs and locale-aware home/date/time links. Saved backdrop and bundle names use the localized public catalog,
      while raw API errors are replaced with safe family-facing copy. The live English routes still pass English
      explicitly, and no Spanish route is published yet. Strict tsc/build/lint passed (0 errors/25 known warnings), 73
      e2e passed (20 expected cross-browser skips), all 16 visual-parity pages passed, and all three states were captured
      and inspected at iPhone and 1440px. Vercel succeeded; production backdrop, review and paid-status pages returned
      200 with expected English content, while `/es/backdrop`, `/es/review` and `/es/pay/status` remained intentional
      404s. **Oct 9 legal pages (`558f860`):** Privacy and Terms now read their unchanged English text from the message
      catalog and have a structurally matched Spanish draft, including the legal-page shell, metadata descriptions and
      deposit terms. Stable language-neutral section ids apply the live notice, travel fee and deposit wording without
      depending on translated headings. A regression validates both languages' structures, placeholders and dynamic
      substitutions; an exact migration check confirmed every live English legal sentence stayed byte-for-byte
      unchanged. Strict tsc/build/lint passed (0 errors/25 known warnings), 74 e2e passed (22 expected cross-browser
      skips), and all 16 visual-parity pages passed; Terms and Privacy were inspected at iPhone and 1440px. Vercel
      succeeded; production Privacy and Terms returned 200, while `/es/privacy` and `/es/terms` remained intentional
      404s. The read-only Terms check also revealed that production deposits are currently enabled at $50; see NEXT
      STEPS 2. **Oct 9 home shell (`c8fb6ec`):** the hero, portfolio heading, default prompt text, CTA, photo-button
      labels and lightbox controls now use paired English/Spanish catalogs and locale-aware links. The live home route
      explicitly passes English; a future Spanish page uses the Spanish default prompts rather than leaking an owner-
      customized English prompt. The new gallery regression found that the fixed header intercepted the lightbox close
      button on iPhone; rendering the overlay through `document.body` keeps it above the header, and the close/next/
      previous controls now pass in iPhone WebKit, Android and desktop. Strict tsc/build/lint passed (0 errors/25 known
      warnings), 77 e2e passed (22 expected cross-browser skips), all 16 visual-parity pages passed, and the open
      lightbox was captured and inspected at iPhone and 1440px (`.screenshots/home-i18n/`). Vercel succeeded;
      production home returned 200 with expected English copy, while `/es` remained an intentional 404. **Oct 9 photo
      placeholders (`bb28a8a`):** the shared empty-photo state now accepts paired English/Spanish screen-reader and
      visible copy, and About passes the matched catalog to all four owner-managed photo slots. Existing English callers
      keep English by default; no Spanish route is public yet. Strict tsc/build/lint passed (0 errors/25 known warnings),
      80 e2e passed (22 expected cross-browser skips), all 16 visual-parity pages passed, and the complete About page was
      captured and inspected at iPhone and 1440px (`.screenshots/photo-placeholder-i18n/`). Vercel succeeded;
      production `/about` returned 200 with expected English copy, while `/es/about` remained an intentional 404.
      **Oct 9 Stay-Home landing (`c31917c`):** the full static landing shell and deposit-on/off variants now have a
      structurally matched Spanish draft; links, bundle/error components, photo placeholders, policy units, long dates
      and the real next-open-date labels all accept a locale. Spanish compact dates are deterministic across Chromium
      and WebKit. The live page passes English explicitly. Owner-editable seasonal titles/descriptions remain English-
      only, so a future Spanish caller hides those offer cards instead of leaking English until separate Spanish fields
      are added. Strict tsc/build/lint passed (0 errors/25 known warnings), 80 e2e passed (22 expected cross-browser
      skips), all 16 visual-parity pages passed, and the complete landing page was captured and inspected at iPhone and
      1440px (`.screenshots/landing-i18n/`). Vercel succeeded; production `/home-sweet-home` returned 200 with expected
      English copy, while `/es/home-sweet-home` remained an intentional 404.
      **Oct 9 seasonal copy editor (`889f94c`):** `/admin/seasonal` now saves an optional matched Spanish title and
      description for each owner-editable offer. Starting one Spanish field requires completing both; missing Spanish
      copy keeps that individual card hidden from the future Spanish landing page instead of leaking English. Existing
      Vercel Blob settings parse safely with no Spanish draft, so no SQL was needed and live English offers are
      unchanged. Strict tsc/build/lint passed (0 errors/25 known warnings), the focused seasonal suite passed 9 tests,
      the full e2e suite passed 80 tests (22 expected cross-browser skips), and all 16 visual-parity pages passed. The
      expanded editor was inspected at iPhone and 1440px (`.screenshots/seasonal-i18n/`). Vercel succeeded; production
      `/admin/seasonal` and `/home-sweet-home` returned 200, the protected settings API returned 401 without a session,
      and `/es/home-sweet-home` remained an intentional 404. **Oct 9 media editor (`10c64e7`):** `/admin/photos` now
      saves optional matched Spanish photo titles, screen-reader descriptions and captions for every theme, plus the
      Spanish title/text below each home-gallery group. Starting Spanish photo or prompt copy requires completing its
      matching fields; existing Vercel Blob settings safely parse with no drafts, so no SQL was needed and the live
      English site is unchanged. Strict tsc/build/lint passed (0 errors/24 known warnings), the focused editor test and
      full e2e suite passed (82 tests, 26 expected skips), and all 16 visual-parity pages passed. Photo and prompt forms
      were inspected at iPhone and 1440px (`.screenshots/admin-media-spanish/`). Vercel succeeded and production
      `/admin/photos` returned 200 while the settings API remained protected. **Oct 9 seasonal simplification
      (`aa00e69`):** at the owner’s request, Christmas Cards was removed from the landing model, defaults, admin editor
      and customer catalogs. Only **Baby’s First Thanksgiving** and **Baby’s First Christmas** remain, with their Nov 23
      and Dec 21 inclusive cutoffs and matching theme requirement. Previously saved Christmas Cards data is ignored and
      will be discarded on the next seasonal save; known old titles for the two retained offers normalize to the new
      exact names. No SQL was needed. Strict tsc/build/lint passed (0 errors/24 known warnings), the focused seasonal
      suite passed 9 tests, the full e2e suite passed 82 tests (26 expected skips), and all 16 visual-parity pages passed.
      Vercel succeeded; production `/home-sweet-home` and `/admin/seasonal` returned 200, the live landing HTML had no
      Christmas Cards text, the settings API returned 401 without a session, and `/es/home-sweet-home` stayed an
      intentional 404. **Oct 10 publication slice (`73c837a`):** a customer-string/readiness audit closed the remaining
      catalog gaps and found that live bundle rows plus owner photo, prompt and enabled-seasonal copy must be gated as
      one unit. The complete `/es` page tree now covers home, About, bundles, booking, landing, legal pages, email-linked
      cancel/reschedule/backdrop/review/payment pages and localized 404s. EN | ES links preserve query/hash state;
      indexable pages emit reciprocal English/Spanish/x-default alternates and the sitemap adds Spanish only after the
      gate passes. Booking, reminder, after-session, deposit and balance links/products follow the saved booking locale;
      public API failures map to catalog messages instead of leaking raw English errors. Publication requires the owner
      signoff plus complete live bundle and owner copy, so a failed gate keeps `/es` 404 and hides the switch/alternates.
      Strict nonincremental tsc/build/lint passed (0 errors/23 known warnings), 84 e2e passed (24 expected skips), all 16
      English parity screenshots matched, and 24 Spanish phone/desktop captures were inspected against an isolated
      local published state. Vercel succeeded; production English pages returned 200 while `/es` remained 404 with no
      visible switch, Spanish hreflang or sitemap entry. No SQL or new dependency was needed.
- [x] Owner completed the live Spanish copy/review gate and published through `/admin/settings` Oct 10. Production `/es`,
      `/es/bundles`, `/es/home-sweet-home`, `/es/about`, `/es/privacy`, `/es/terms` and `/es/book` returned 200; the
      English page exposed the ES switch and both homepages emitted reciprocal hreflang. The initial live check found
      `sitemap.xml` frozen to its deploy-time English-only state; `2bd75b6` makes the metadata route dynamic so the
      owner-controlled publication state reaches it without another settings-specific redeploy.

## Phase 4 — Add-ons + seasonal
- [x] Extra babies add-on: twins/triplets only, all bundles, max 3 babies total; **each baby after the first adds $75,
      30 minutes and 5 edited photos** (owner confirmed Oct 8; editable per bundle in /admin). Offers/discount codes
      reduce **only the bundle**; the add-on stays full price (owner confirmed Oct 8). Migration 0017 is on main in
      `be06303`; the owner ran it in Neon Oct 8 without errors and its check returned 3 bundle rows. The owner approved
      the revised screenshots Oct 8. App commit `d9eb50d` is live: Step 3 first
      shows only Baby name (optional) + Age (required); the prompt below Baby 1 reveals Twins/Triplets choices and only
      then shows Baby 2/3 fields. The calendar remains unchanged. Selecting a longer session rechecks the chosen time;
      if it no longer fits, all entered details and the date are preserved and the family returns only to Time. Separate
      price lines continue through review, deposits/balance/Stripe, Meta value, admin leads, Outlook events and customer/
      studio emails; booked values are snapshotted. Local isolated Outlook/Neon/Resend test booked twins for 2.5 h with
      a 20% bundle code: bundle $199.20 + unchanged $75 add-on = $274.20; DB/event/email matched and the email offered
      25 favorites. Migration ran twice safely and seeded 3 rows. Strict tsc/build/lint (0 errors/26 known warnings),
      27 e2e (including twins on 3 devices + preserved-details/time fallback) and all 16 visual-parity tests passed; the
      initial /book calendar is pixel-identical to the approved baseline. Revised review screenshots:
      `Claude outputs/extra-babies/phone-step3-{single,choices,twins}.png`, `phone-step4-review.png`, and matching desktop files.
      Vercel completed for `dea7272`; production `/` + `/book` returned 200 and a read-only `babies=2` availability
      request returned 90-minute Little Moments slots. No production booking was created.
- ~~Halloween theme~~ — **dropped by the owner (Oct 7): no Halloween anything; keep only the existing themes**
  (default, Thanksgiving, Christmas, New Year).
- [x] Seasonal landing variants with real cutoffs (Baby’s First Thanksgiving + Baby’s First Christmas), editable in
      `/admin/seasonal`. Title + description + on/off + cutoff live in the existing Vercel
      Blob settings (no migration); old settings parse with all offers off so production never silently publishes code
      defaults. An enabled offer appears only with its matching live theme and through its inclusive cutoff. The
      Thanksgiving offer ends after Nov 23 and First Christmas ends after Dec 21. The hard-coded final-card cutoff line
      is replaced by the active saved offers. Admin includes a client-side landing preview. Strict tsc/build/lint (0
      errors/26 known warnings), 36 e2e (seasonal logic + backward compatibility + admin editor on 3 devices), and all
      16 default-state visual parity checks passed. Approval screenshots: `Claude outputs/seasonal/phone-{admin,landing}.png`
      and matching desktop files. Owner approved the original visuals Oct 8. On Oct 9, the owner asked to remove the
      Christmas Cards offer entirely and keep only the two baby-first offers; `aa00e69` made that change, safely ignores
      the retired saved field, and preserves the two approved cutoffs. Vercel succeeded and production
      `/home-sweet-home` + `/admin/seasonal` returned 200.

## Phase 5 — SEO basics
- [x] Metadata/canonicals/OG, `app/sitemap.ts`, `app/robots.ts`, JSON-LD (service-area business), alt text editable.
      Six indexable public pages have their own canonical + OG URL/image; `/book` is
      canonicalized and noindexed so bundle query strings do not compete in search; sitemap contains only canonical
      public content; robots points to it and excludes admin/API/pay infrastructure. The home page has escaped
      `ProfessionalService` JSON-LD with only known facts (Miami Beach base, listed Miami-to-Orlando cities, phone,
      email and Instagram; no invented reviews/hours/prices/street address). Photo screen-reader descriptions were
      already editable under `/admin/photos` → Details. Strict tsc/build/lint (0 errors/26 known warnings), 51 e2e and
      all 16 visual-parity tests passed. Commits `f2cdb46` + `f864ea9` are live; production smoke passed.
- [?] Owner steps: Google Search Console Domain property + submit `/sitemap.xml`; claim/update Google Business Profile
      as a service-area business, hide the home address and enter the real cities/ZIPs served (up to 20, no radius).

## Phase 6 — Security + quality
- [x] Full audit (auth, CSRF/origin, Zod everywhere, error leakage, logs, upload validation, npm audit). **Oct 10 first
      security slice (`8a9be5b`):** every owner-area mutation now requires an exact same-origin `Origin`/fallback
      `Referer`; admin login has strict Zod input, a 2 KB request limit, no-store responses and a high-priority cookie;
      logout clears the cookie with the same attributes. Photo uploads reject oversized requests/files and verify JPG,
      PNG or WebP bytes instead of trusting the browser MIME type. The server logger now recursively removes secrets,
      contact/family data, IP/user-agent fields and all raw error messages while preserving safe database/API codes.
      Resend, Meta and delivery logs no longer pass vendor messages that can repeat customer data. `npm audit
      --omit=dev` = 0; the 9 remaining dev-only advisories are old esbuild through drizzle-kit and braces through
      eslint-config-next, whose npm force-fixes are breaking downgrades, so they were not applied.
      **Oct 10 API audit (`5327dbe`, Claude Code):** all 43 route files reviewed. Every owner handler checks the
      session first (only login/logout are public, by design); owner mutations get the exact-origin check in
      `proxy.ts`; the six per-lead actions share `leadAction` (session + Zod). Stripe/Resend webhooks verify HMAC
      signatures in constant time with a 5-minute replay window; the cron compares `CRON_SECRET` in constant time and
      ignores `?now=` in production. Public routes validate with Zod or strict patterns plus signed links/256-bit
      tokens, and carry no ambient authority, so cross-site requests gain nothing. Fixed: (1) public JSON bodies were
      unbounded (only login had a Content-Length check): `lib/security/body.ts` `readJson` counts bytes while
      reading (64 KB booking, 32 KB review, 16 KB cancel, 8 KB others → 413); (2) `/api/admin/settings` and
      `/api/admin/spanish` returned raw internal error text and didn't log: owner validation messages
      (`SettingsInputError`, readiness gaps) still show, anything else is logged and generic; (3) the deposit-offer and
      travel lookups didn't catch database errors: now logged + JSON 500. 5 unit tests + 1 e2e (413s and a normal
      quote). Strict tsc, lint 0 errors, 17 units, 106 e2e, 24 visual; Vercel + Actions green; production read-only
      smoke OK.
- [x] Owner login research + upgrade (passkeys/2FA, logout everywhere, lockout, recovery doc). Existing password/cookie
      flow is now origin-checked, bounded and no-store; choosing and implementing the replacement login/recovery model
      remains.
      **Oct 12: owner chose Face ID / Touch ID (passkeys), password kept as backup.** Built: `lib/admin/passkeys.ts`
      (SimpleWebAuthn 14; discoverable passkeys, user verification required for adding and signing in, attestation
      none, ES256/RS256, max 10 devices, excludeCredentials stops duplicates, signature counter + backup state saved),
      challenges in a signed httpOnly 5-minute single-use cookie (key derived from ADMIN_SESSION_SECRET, path
      /api/admin/passkeys), rpID `tinyhumans.photography` on the live site (www + bare domain), the request's own
      host elsewhere. Routes under `/api/admin/passkeys` (available, login options/verify — rate-limited `passkeyLogin`
      20/15 min + the global login limit; register options/verify, list, remove — owner only) and
      `/api/admin/session/others`. Sessions carry an epoch (`admin_auth`, `lib/admin/session-token.ts`,
      `session-epoch.ts`): "Sign out all other devices" raises it and re-issues this device's cookie; older two-part
      cookies read as epoch 0, so the deploy signs nobody out. Settings → Sign-in lists devices (added / last used /
      synced), adds this device, removes one, signs out other devices; the sign-in page offers Face ID / Touch ID once a
      device exists. Before migration 0020 everything stays password-only and Settings explains the update.
      Adding a device needs a sign-in from the last 15 minutes (OWASP re-authentication: a borrowed or stolen session
      can't plant its own passkey); re-issued cookies keep their original sign-in time, so "Sign out all other
      devices" can't freshen a session. Verified locally with `scripts/local-db` (all 21 migrations) + Chromium's
      virtual authenticator: 16/16 checks (add, duplicate refused, Face ID sign-in, failed user verification refused,
      last-used shown, other device signed out while this one stays, remove hides the button, replay without challenge
      401, cross-site 403, 20-minute-old session can't add a device, even after signing out other devices). 7 unit tests
      (`tests/unit/admin-session.test.ts`) + 1 CI e2e for the pre-migration state. Recovery: the password always works;
      lost the phone → sign in with the password on another device → Remove it + "Sign out all other devices".
      **Owner steps:** (1) Neon → SQL editor → run `drizzle/0020_admin_passkeys.sql`; (2) on the iPhone and the Mac:
      /admin → Settings → Sign-in → "Add Face ID / Touch ID on this device". Sources: https://simplewebauthn.dev/docs/packages/server ·
      https://simplewebauthn.dev/docs/packages/browser · https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html
- [~] WCAG 2.2 AA audit (axe + manual) and fixes; gitleaks history scan; CSP report-only → enforce. Axe reports no
      detectable WCAG 2.2 AA violations on 11 public/customer/admin entry pages; keyboard focus, 24px targets and 320px
      reflow checks pass. The audit found and fixed the hand-drawn Book circle overflowing at 320px (`86bbac3`). Gitleaks
      8.30.1 scanned all 171 commits/3.75 MB with no leaks. Remaining: full manual screen-reader/color/zoom pass and CSP
      report-only → enforce.
      **Oct 11 manual pass (`9ace2e5`, `5482c57`, `946b321`; Claude Code):** axe found 0 violations on 12 EN/ES pages
      × phone/desktop but could not judge 34–126 text items per page over the chalk texture, so contrast was computed
      from the theme tokens: body colors pass (white 11.2, yellow 9.1, muted 7.6, blue 6.6, error 7.4:1). Fixed: field
      hints 40% → 60% white (3.3 → 5.6:1; the cancel and review boxes had browser-default hints), empty review stars
      35% → 50% (2.7 → 4.0:1, a state indicator), the seasonal cutoff line lightened 60/40 toward chalk white
      (Thanksgiving red was 3.4:1 → 5.5:1); new `tests/unit/contrast.test.ts` checks every theme. Exempt by WCAG and
      left: faded booked days (inactive), EN|ES separator, bullets, tracker circles. `/bundles` and `/book` had no h1:
      `SectionHeading level={1}`, bundle cards h2 there (`BundleCard headingLevel`), booking steps/deposit return/
      confirmation h3 → h2; all public pages now have one h1 and no skipped levels (e2e). Closing the photo viewer now
      returns focus to the photo that opened it (WCAG 2.4.3). Text spacing (1.4.12): hero lines may wrap instead of
      being clipped (≥18px spare at every width, so normal rendering is unchanged); under that test the Spanish phone
      header needs sideways scrolling (still reachable, not lost). Checked OK: focus never hidden under the sticky
      header (2.4.11, `scroll-padding-top`), page language/titles/landmarks (navs labelled), booking errors
      (`aria-invalid`/`aria-describedby`, focus to the first problem field, `role=alert`), heading focus on each step,
      autocomplete on contact/address fields (1.3.5), the honeypot hidden from screen readers, reduced motion, the
      lightbox dialog (Escape, focus trap). New e2e: a whole booking with the keyboard only. The flaky CI WebKit 404
      test was a click aimed during the intro's scroll reset; it now waits for the intro to finish, and CI keeps failure
      traces 7 days (`actions/upload-artifact@v7`). Remaining here: CSP report-only → enforce; a real VoiceOver/TalkBack
      listen-through with the owner's phone is still worth doing once.
      **Oct 12 CSP report-only (`0abba30`):** `lib/security/csp.ts` builds the policy; `next.config.ts` sends it as
      `Content-Security-Policy-Report-Only` + `Reporting-Endpoints` (the enforced `frame-ancestors 'self'` is unchanged).
      No nonces (they force per-request rendering and drop ISR caching, per the Next 16 CSP guide), so scripts/styles
      keep `'unsafe-inline'`; restricted: script hosts (self + connect.facebook.net), img (self, data:, blob:, Vercel
      Blob, www.facebook.com), connect (self + Meta), no eval, `object-src 'none'`, `base-uri`/`form-action`
      'self'; dev adds `'unsafe-eval'`, previews add vercel.live. `/api/csp-report` (rate-limited, 16 KB, always 204)
      logs `csp` warnings as directive + blocked origin/path + page path (query strings dropped: manage links carry
      tokens; extension noise ignored). The first local run found Zod 4 probing `new Function` in the browser: client
      validation modules now import `z` from `lib/validation/zod.ts` (browser `jitless`). Local checks: 12 public
      pages, the 404 and all 8 /admin panels signed in report nothing; 5 unit + 1 e2e. **The Vercel deployment of
      `0abba30` failed during Vercel's Oct 12 incident** ("Increased build and deployment failures", partial outage of
      Build & Deploy and Git integrations from 13:35 UTC, partly an upstream GitHub incident; www.vercel-status.com);
      local `next build` with VERCEL=1/VERCEL_ENV=production passes and the routes manifest headers look normal.
      Production kept serving `946b321`. Docs-only commits don't deploy (no Vercel status). Next: confirm the next
      deployment succeeds (or Redeploy from the dashboard), then watch production `csp` warnings (Meta Pixel paths)
      for a week before enforcing. The Vercel CLI on the Mac is logged out (`npx vercel login` to read build logs).
      **Oct 12 perf (`25e9dcf`):** public pages imported `IS_PROTOTYPE`/`readPrototypeSettings` from
      `lib/admin/client`, pulling the whole owner-area client (mock provider, admin validation, Zod) into every page.
      They now come from `lib/admin/prototype.ts` (client.ts re-exports them). Measured same build settings: home
      323 → 225 KB gzipped JS (1150 → 736 KB raw), landing 326 → 228, booking 337 → 244. All gates passed. Sources:
      https://nextjs.org/docs/app/guides/content-security-policy · https://developers.facebook.com/docs/meta-pixel/get-started
- [x] Playwright e2e + Vitest units + CI + second bug hunt. `b47c5fc` adds five security unit tests, the axe/manual
      regression checks and four element-level visual baselines × iPhone 14/1440. Strict nonincremental tsc, production
      build and lint (0 errors/23 known warnings) passed; 5 units, 103 e2e (56 expected project skips) and all 24 visual
      checks passed. `ef5a6cf` adds the read-only GitHub Actions workflow; its first Ubuntu run found one clean-runner
      environment assumption and one WebKit locator ambiguity, fixed in `2b6c84a`. The corrected run passed clean npm
      install, browser install, strict tsc, lint, units and all e2e tests. A docs-push rerun exposed a redundant/flaky
      Instagram-user-agent check: `64e5da6` runs that custom Chromium context once, asserts the transition into the
      customer-details step, and keeps the three native browser journeys. Strict tsc/lint (0 errors/23 known warnings),
      5 units and the full 101-pass/58-expected-skip local matrix passed. **Oct 10 second bug hunt (started):** Codex's
      unpushed `0270dc5`/`ff549d4`/`5313150` were reviewed, verified and shipped (BUG-12, 14, 15), plus BUG-13 (Spanish
      header reflow) and the owner's centering/doodle requests. Strict tsc, lint (0 errors/22 known warnings), 12 units,
      103 e2e (62 expected project skips), 24 visual checks; Vercel + GitHub Actions green (`dc8e5c4`); production
      `/`, `/bundles`, `/home-sweet-home`, `/about` and their `/es` pages checked read-only at 320/360/390/1440 (tracking
      requests blocked). A first CI run flaked once on the WebKit 404 → home click (10/10 local passes); `dc8e5c4` waits
      for network idle first. **Test stability (`d9356fc`):** every e2e test shared one visitor address, so late tests
      could hit the server's per-address limits (120 calendar loads/10 min, 20 bookings/hour) and time out; each browser
      project now sends its own documentation-range `x-forwarded-for` (verified: the 121st call from one address gets
      429, another address is unaffected). Tests also counted calendar days before availability loaded and so jumped a
      month by accident; `pickFirstOpenDay` waits for the availability response, and the cancel-link test books a day
      weeks ahead (inside the notice window online cancellation is correctly refused). Two consecutive full runs: 105
      passed each. Remaining: API/Zod/auth audit, manual screen-reader/color/zoom pass, CSP report-only.

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
- [x] React Compiler lint rules (set-state-in-effect, purity, refs, immutability): fixed in Phase 8 slices 6–7; four
      data-loading effects keep explained line-level exceptions. `npm run lint`: 0 problems.
## Phase 8 — Structure move, route groups, split Booking.tsx, library evaluation, remove `config/bundles.ts`
Rules: small slices, each with strict tsc + lint + units + build + 24/24 visual parity + e2e before pushing; no visible
change. Docs read Oct 12 (see Research notes → Phase 8).
- [x] **Slice 1: remove the static click-through prototype** (owner OK Oct 12; `cf73bdc` + `ac31f5c`, −500 lines):
      `scripts/build-static.mjs`, `build:static`, the STATIC_EXPORT branch of `next.config.ts`, `lib/admin/prototype.ts`,
      `lib/pricing/prototype.ts`, `lib/availability/prototype.ts`, the in-browser admin API (`lib/admin/client.ts` is
      HTTP-only, `AdminApi.mode` gone), prototype branches in Footer / CatalogProvider / SiteSettingsProvider /
      AdminApp / Booking, the mock provider's browser storage (server memory only). **Kept:** mock mode
      (`BOOKING_PROVIDER=mock`) and its confirmation-email preview (`MockPreviews`, tested by e2e).
- [x] **Slice 2: route groups — LIVE Oct 12 (`a3732e9`).** One root layout (`app/layout.tsx`: html/body, fonts,
      theme CSS variables, intro script, generateViewport, ChalkFilters, Vercel Insights) + `app/(site)/layout.tsx`
      (public pages and /es) and `app/(admin)/admin/layout.tsx`, both drawing `components/layout/SiteShell.tsx`
      (SiteSettings/Catalog providers, SeasonalDecor, Header, Footer, MetaPixel; /admin keeps the site shell until
      Phase 10). `getPublicLocale()` (`i18n/publication.ts`) decides the language for both. 404s: `app/not-found.tsx`
      (unknown addresses, draws SiteShell itself), `app/(site)/not-found.tsx` (`notFound()` inside the site, e.g. the /es
      gate) and `app/(site)/es/not-found.tsx`, all rendering `components/NotFound`. **Found while checking:** (1) nested
      segments inherit the root 404, so without `(site)/not-found.tsx` the hidden-Spanish 404 drew two headers/footers;
      (2) CSS order changed (root layout CSS → group layout CSS → page): the footer copyright row's `margin-top`, always
      overridden by the global `.container { margin: 0 auto }` before, started to apply (+28 px phone / +40 px desktop).
      Removed the dead declaration; audited every element where the moved stylesheets (Header, Footer,
      LanguageSwitcher, Reveal, SeasonalDecor, TinyHumansLogo) meet a global class: no other tie. **Checks:** strict
      tsc, lint 0 errors/22 warnings, 44 units, build (route table identical), 24/24 visual, 110 e2e (76 skips);
      computed CSS of every element on 17 pages × iPhone 14/1440 identical to the old build (only React's generated
      logo-mask ids differ); 42 extra screenshots (404s, /about, landing, /es, admin pages) identical; Spanish published
      (local DB): 18 screenshots + HTML identical; intro plays once, header element survives client navigation; Vercel +
      CI success; production read-only smoke: 19 pages × WebKit iPhone/Chromium 1440 OK (status, one header/footer/main,
      lang, copyright margin 0, `(site)`/`(admin)` segments served), intro OK.
- [x] **Slice 3a: shared components — LIVE Oct 13 (`b37fe12`).** components/ui (ChalkBox, ChalkButton, PinnedPhoto,
      PhotoPlaceholder, SitePhotoSlot), components/chalk (ChalkDoodle, ChalkFilters, TinyHumansLogo, BoardDoodles),
      components/layout (Header, Footer, SeasonalDecor, LanguageSwitcher, Reveal, SectionHeading, NotFound),
      components/providers (Catalog + SiteSettings). **Found:** moving files changed Turbopack's merged CSS order, so
      the bundle-card button lost its 24 px top margin (ChalkButton's `margin: 0` and BundleCard's `.cta` tied at equal
      specificity). Fixed as `.card .cta`. New `scripts/css-ties.mjs` (read-only) lists every such tie: production
      had exactly that one; now 0 live and locally (16 pages × phone/desktop). Side effect: the home Hero's CSS
      (1.6 KB raw, ~0.5 KB gzipped) now sits in the shared stylesheet (re-check after 3b; Turbopack
      `experimental.cssChunking: 'graph'` is the documented knob). JS +1–8 bytes/page. **Checks:** strict tsc, lint 0
      errors, 44 units, build (route table identical), 24/24 visual, 42 extra screenshots, computed CSS of every element
      on 17 pages × 2 widths identical to the old build captured the same day (a Turbopack worktree build), 110 e2e;
      Vercel + CI success; production smoke 19 pages × 2 OK, ties 0, bundle buttons 24 px.
- [x] **Slice 3b: features — LIVE Oct 13 (`cbe95ae`).** features/admin (was components/Admin), features/booking
      ({flow,backdrops,cancel,reschedule,bundles}/ from Booking, Backdrops, Cancel, Reschedule, Bundles), features/home
      (Hero, Portfolio, PortfolioCta, PortfolioLightbox), features/legal (+ LegalPage). components/ now holds only ui,
      chalk, layout, providers. **Decision (measured):** no barrel `index.ts` for client components. Routing the four
      cross-feature imports through `features/booking/index.ts` added +16.5 KB JS to the home page, +10 KB to the ad
      landing page and +10.8 KB to /admin (each importer got every re-exported client component). Instead booking's
      shared components (BookingPaused, BundleCard, InspirationThumb, RescheduleFlow) sit at the feature root = its
      public API; subfolders are internal (rule updated in CLAUDE.md/AGENTS.md). The old `features/after-session`
      barrel made /pay/status load the review form: removed (/pay/status −5.9 KB; /review +3 KB because ChalkButton
      became its own shared chunk, not duplicated; all other pages ±30 bytes). **Checks:** strict tsc, lint 0 errors,
      44 units, build (route table identical), 24/24 visual, 42 extra screenshots, computed CSS of every element on 17
      pages × 2 widths identical to the old build the same day (only Chrome's flaky computed `margin: auto` readings,
      same in both builds, positions identical), CSS ties 0, 110 e2e; Vercel + CI success; production smoke 19 pages
      × 2 OK, ties 0, calendar + home portfolio viewer work, no page errors.
- [x] **Slice 4: booking form split — LIVE Oct 14 (`5835d78`).** `features/booking/flow/Booking.tsx` 1,204 → 177 lines:
      `booking-state.ts` (state, reducer, contact checks, helpers; no React), `useBookingFlow.ts` (availability,
      travel estimate, deposit, discount quote, language-switch draft, submit with the same requestId on retries;
      moved verbatim), `steps/TimeStep`, `steps/DetailsForm` (+ twins/triplets picker), `steps/ReviewStep` (+ discount
      field). Only code change: `loadMonth` lists `dispatch` + `setDays` (stable setters) because the React Compiler
      lint reports an error for them once the code is in a custom hook. **Checks:** strict tsc, lint 0 errors and the
      same 22 warnings, 44 units, build (route table identical), 24/24 visual, computed CSS identical (17 pages × 2),
      CSS ties 0, a 12-step booking walk-through (calendar → times → empty/invalid details → twins picker → filled →
      review → bad discount code → edit → booked) on the old vs new build: 24/24 screenshots identical and the booking
      HTML identical except the random reference; 110 e2e. /book JS +1.2 KB raw (module overhead), other pages ±0.
      Vercel + CI success; production: smoke OK, ties 0, the booking form walked to the review step (never submitted;
      booking requests blocked) on iPhone WebKit + desktop: 10 times, 7 empty-form errors, 14 review rows, "Pay $50
      deposit", no page errors.
- [x] **Slice 5: `config/bundles.ts` removed — LIVE Oct 14 (`604cdbf`).** Bundle, BundleTranslation, AdminBundle,
      ExtraBabyAddon and BundleOffer moved verbatim to `lib/pricing/types.ts`; the built-in bundles moved verbatim to
      `lib/pricing/dev-bundles.ts` (local development + the database-less CI tests only; `getCatalog()` uses them only
      without `DATABASE_URL`); unused `getBundle`/`formatPrice` removed; README + comments updated. `config/` now holds
      true constants only. **Checks:** strict tsc, lint 0 errors/22 warnings, 44 units, build (route table identical),
      24/24 visual, CSS ties 0, page bytes identical (−45/−52 bytes on /reschedule and /admin), 110 e2e; Vercel success;
      CI failed once on an unrelated WebKit click (see bug log), passed on rerun; production smoke OK, ties 0, /bundles
      shows the live $149/$249/$399. **Live-site guard (owner "Sure", Oct 15; `eff9e79`):** `builtInCatalog()` refuses
      on Vercel production (`VERCEL_ENV=production`); `getPublicCatalog()` then returns no bundles (status
      `unavailable`) and logs `pricing.catalog` "DATABASE_URL is missing on the live site", so pages load and booking
      shows "Booking is taking a short break"; previews/local/CI unchanged. Checked with a local production build
      (VERCEL_ENV=production, no DATABASE_URL): 6 pages 200, no prices, paused on /bundles, /book, landing, quote API
      refuses; 3 unit tests; 24/24 visual, 111 e2e; Vercel + CI success; live prices unchanged.
- [x] **Slice 6: lint warnings 22 → 4 — LIVE Oct 14 (`8ff09e8` chore + `d51daa7` refactor).** Unused imports removed
      (mock provider, email templates); `no-unused-vars` allows the `{ key: _k, ...rest }` omit pattern
      (`ignoreRestSiblings`). React Compiler fixes: Portfolio numbers prompts/photo groups before rendering; the intro
      hook syncs its image list from an effect declared before the intro effect; the booking form notes its opening
      time in a mount effect (the language-switch draft still restores its own) and clears cached availability where
      the baby count changes (twins picker, draft restore) instead of in an effect; cancel/reschedule links without a
      token show "couldn't open this link" at once (derived) instead of a brief loading state; the catalog reads the
      studio date with `useSyncExternalStore`. **Left (4, warnings):** the data-loading effects in LeadsPanel,
      RescheduleFlow, DepositReturn and useBookingFlow → slice 7 decides the data-fetching approach. **Checks:** strict
      tsc, lint 0 errors/4 warnings, 44 units, build (route table identical), 24/24 visual, 42 extra screenshots +
      intro checks, computed CSS identical, booking walk-through 24/24 identical, ties 0, 110 e2e; Vercel + CI success;
      production smoke + booking walk (not submitted) OK, no console/hydration errors on 7 key pages.
- [x] **Slice 7: library evaluation — decided Oct 14 (no library switch; `947bcb5` fix + `f97c3e0` lint).** Sources in
      Research notes → Phase 8 slice 7. **Data fetching:** keep fetch-in-Effect (React: fine when it ignores stale
      answers; Next.js: SWR/TanStack Query when components need a shared browser cache, which these pages don't).
      Fixed the two stale-answer races this review found: /admin Leads could show the previous filter's list after a
      quick switch (new `tests/e2e/admin-leads.spec.ts` fails on the old code, passes now); the booking calendar could
      merge availability for a baby count the family had just changed. The four data-loading effects keep a
      line-level lint exception with the reason → `npm run lint` is now 0 problems. Revisit TanStack Query (~13 KB gz)
      only in Phase 10 if the new /admin needs shared caching/mutations. **Dialogs:** no Radix/Base UI. The customer
      photo viewer already traps focus, closes on Escape, locks scroll and restores focus. The three /admin
      confirmations (`role="alertdialog"`) have no Escape/initial focus → Phase 10 uses native `<dialog>` +
      `showModal()` (inert page, Escape, initial focus from the browser; focus return stays manual per MDN).
      **Forms:** keep the hand-written booking form (multi-step, controlled fields, JSON API; React 19
      `useActionState` targets form actions) and server-side Zod; no React Hook Form. **Animation:** keep CSS
      keyframes + the small Reveal/intro hooks (Motion: `m` + LazyMotion ~4.6 KB, full `motion` ~34 KB; no visual gain).
      **Checks:** strict tsc, lint 0 problems, 44 units, build, 24/24 visual, booking walk-through identical, ties 0,
      111 e2e; Vercel + CI success; production smoke + booking walk (not submitted) + console OK.
- **Phase 8 DONE Oct 14.**
## Phase 9 — Tailwind v4 + tokens, one component per slice vs baseline screenshots
- [ ] Slice 1: research the current Tailwind v4 + Next 16 docs (install, `@theme` tokens, cascade layers, Turbopack),
      then decide how the theme tokens in `config/themes.ts` (CSS variables on `<html>`) map to Tailwind tokens. Watch:
      Tailwind v4 puts its styles in `@layer`s, and unlayered CSS (globals.css + every CSS Module today) beats layered
      CSS regardless of specificity, so mixed components can change silently; prove each slice with the Phase 8
      checks (computed-style diff vs an old-build worktree, `scripts/css-ties.mjs`, booking walk-through, page bytes).
      Only `scripts/css-ties.mjs` is in the repo; the other Phase 8 comparison scripts were session scratch files:
      rebuild them as `scripts/parity/*` first (method in CLAUDE.md → Tests).
- [ ] Then one component per slice (start with small ui/ primitives), each with 24/24 visual + the checks above.
- Launch freeze: no Phase 9 restyling on `main` from Nov 14 (the day before launch) until after launch.
## Phase 10 — Admin rebuild (dashboard, charts, phone-friendly) — started Oct 15 (before Phase 9, owner's choice)
**Owner decisions (Oct 15):** keep the current chalkboard design for /admin ("just keep the same design, do not change it
to either light or dark") → no light/dark mode (overrides the brief). Phone-friendly first for all four: Leads,
Pricing & offers, Availability, Photos. Dashboard wants all four groups: upcoming sessions (today + this week), bookings
& booked revenue over time + by bundle, where bookings come from (Meta ads vs the rest, `sourceLabel()` in
`lib/tracking/attribution.ts`), cancellations/reschedules + email delivery (`booking_emails`, `email_events`). No known
admin bugs to fix first.
**Decisions (research Oct 15):** no shadcn/ui (needs Tailwind = postponed Phase 9, and brings its own look; the owner
keeps the chalk design) → reuse the chalk primitives (ChalkBox/ChalkButton/ChalkDoodle) and native `<dialog>`
(`showModal()`) for confirmations. **Charts: no library** — a minimal Recharts 3.10.1 bar chart measured 361 KB minified
/ 106 KB gzipped (esbuild, React external), and its look would need heavy restyling to match the chalkboard; our charts
are simple (bars over time, share bars by bundle/source), so small chalk-style SVG chart components with text/table
equivalents for screen readers. Sources: https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026 ·
https://blog.logrocket.com/top-5-react-chart-libraries/ (sizes disagreed → measured locally).
- [x] **Slice 1: dashboard data — LIVE Oct 15 (`04ab1a2`).** `GET /api/admin/dashboard` (owner only, no-store):
      `lib/admin/dashboard.ts` (server-only queries) + `lib/admin/dashboard-summary.ts` (pure counting, 5 unit tests) +
      `lib/admin/dashboard-types.ts`. Definitions: upcoming = today + next 6 days, not cancelled (pending = deposit hold);
      weeks = last 12 Miami weeks (Monday first) of bookings made that are still on (confirmed/rescheduled), booked
      total = final price (or package price) + add-ons + travel fee; bundles/sources = same bookings (`sourceLabel`);
      changes = cancellations vs unpaid-deposit holds (`booking_deposits.status` expired/unpaid) + reschedule history,
      same weeks; emails = `booking_emails` sent/failed + `email_events` over 30 days. Checked on the local test DB
      (scripts/local-db): numbers match direct SQL (8 bookings on, $1,317.20; 1 cancelled + 2 unpaid holds; 1
      reschedule; 3 sent); upcoming from Oct 9 = 6 sessions in Miami time. 52 units, 24/24 visual, 111 e2e; Vercel + CI
      success; production endpoint 401 when signed out.
- [x] **Slice 2: dashboard UI — LIVE Oct 15 (`ca12524`, owner "ok" on the before/after gallery
      `Claude outputs/admin-dashboard/index.html`).** `features/admin/DashboardInsights.tsx` + `Dashboard.module.css`:
      Coming up (by day, tags for rescheduled/deposit holds, "See all bookings"), the six existing tiles, Bookings by
      week (chalk SVG bars via `roughRectPath`, toggle bookings/booked total, short bar labels "$423"/"$1.3k", exact
      totals in the summary, screen-reader table), By bundle + Where bookings come from (share bars; beside the chart
      at ≥ 960 px), Changes and emails (failed/problem tiles outlined in --chalk-error when > 0; `.block .statWarn` avoids
      a CSS order tie with Admin.module.css `.stat`), then the section links. Checked with the local test DB (session
      dates moved +7 days and booking dates spread over 6 weeks, local only): no page errors; 52 units, 24/24 visual,
      111 e2e; Vercel + CI success; production /admin scripts contain the new dashboard. Lead deep links from the
      session list (open one booking in Leads) are a possible follow-up.
- [x] **Slices 3–6: phone pass — LIVE Oct 16 (`0ba63be`, owner "ok" on `Claude outputs/admin-phone/index.html`).**
      Audit first (iPhone 14, signed in, local test DB): no sideways scrolling, no field under 16 px (no iOS zoom), all
      buttons ≥ 44 px except hidden 1×1 file inputs behind Photos' "Replace" buttons (fine); check boxes 22 px. Owner
      picked: Leads — Call / Text / Email / Directions buttons on every booking card (`tel:`/`sms:` share
      `dialNumber()`, Directions = Google Maps URL `api=1`), doubled "Leads" heading removed; Pricing — bundle details
      full width on ≤ 600 px, Active / Edit wrap underneath (flex, so the Active label keeps its size); check boxes
      26 px. Availability and Photos were already comfortable on a phone. 52 units, 24/24 visual, 111 e2e; Vercel + CI
      success; production /admin scripts contain the new buttons.
- [x] **Slice 7: dialogs + admin tests — LIVE Oct 16 (`1c1b8ad` fix + `52b7ed4` test).** `features/admin/AdminDialog.tsx`
      (native modal `<dialog>`, `showModal()` in a layout effect: inert page, Escape via `cancel`, focus starts on the
      first button = Cancel and returns to the opener, backdrop click closes, `busy` keeps it open) replaces the three
      createPortal overlays (delete lead, send before the session, delete bundle/code); no `autoFocus` on its buttons
      (React's autoFocus would move focus before the opener is remembered). `.dialog` keeps the old size
      (`max-width: none` over the UA cap) → pixel-identical at 1440, 27 px anti-aliasing at iPhone 14. Tests:
      `tests/e2e/admin-dialogs.spec.ts` (dialogs, pricing delete confirmation, dashboard render) on shared
      `tests/e2e/fixtures/admin.ts`; the dialog tests fail on the old overlay. Earlier: `admin-leads.spec.ts` (filter
      race). 52 units, 24/24 visual, 114 e2e; Vercel + CI success; production smoke OK, ties 0.
- **Phase 10 DONE Oct 16.** Not done by owner decision: light/dark mode (keep the chalk design), shadcn/ui and a chart
  library (measured, declined). Possible follow-ups: open one booking in Leads from the dashboard's "Coming up" list.

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
7. Seasonal: ~~run Halloween too~~ (**dropped Oct 7: no Halloween theme or offer**). ~~Christmas Cards, Dec 5~~ was
   removed entirely Oct 9. Remaining last sessions: Baby’s First Thanksgiving **Nov 23** and Baby’s First Christmas
   **Dec 21** (editable in `/admin/seasonal`).
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
15. Extra baby: **$75, +30 min, +5 photos, max 3 per booking** — all editable in /admin. Offers and discount codes
    apply to the **bundle only**; the extra-baby charge stays full price (owner confirmed Oct 8).
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
- ~~Meta Dataset (Pixel) ID; domain verification code; `META_CAPI_ACCESS_TOKEN` added in Vercel (Production + Preview).~~
  **Answered:** domain verified by DNS TXT (1d); 1g live test done (owner, Oct 12). Read-only check Oct 16 (Meta requests
  blocked): every public page loads fbevents.js and calls `fbq init 1027728456958311` + PageView.
- Landing URL pick (`/home-sweet-home` proposed) · travel-fee model + numbers.

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
- **CI flake (low, watch; Oct 14 on `604cdbf`):** `booking.spec.ts` › "mock management links…" on iphone-safari:
  clicking "Choose Little Moments" on /bundles didn't navigate within 15 s on the GitHub runner (109/110 passed). Same
  code: 5/5 local repeats pass, the CI rerun passed, no earlier CI failure in ~30 runs. If it repeats, look at clicks
  during the /bundles intro on slow WebKit (the test's first click lands right after page load).
- **BUG-16 (low, open; found Oct 12 in Phase 8 slice 2, same before and after it)** 404 tab titles: with Spanish
  published, `/es/<unknown>` shows the default English site title instead of "Página no encontrada"
  (`app/(site)/es/not-found.tsx` generateMetadata is not applied); with Spanish hidden, `/es/about` etc. return 404
  but keep the Spanish page's own `<title>`. Status codes, noindex and the page itself are correct.
- **Oct 12 iCloud + git stash (no harm):** stashing the slice-2 moves for a before/after build made iCloud restore 25
  " 2" copies of the moved files (all byte-identical to the session's own files; moved to the session scratchpad).
  Lesson (CLAUDE.md/AGENTS.md): before/after builds use a `git worktree` in the scratchpad, never stash in the folder.
- **Oct 12 push incident (fixed in minutes, production never affected):** `cf73bdc` contained only the four deleted
  prototype files: `git add -A -- … hooks …` failed on the missing `hooks` path (stderr hidden), so the edits weren't
  staged. Vercel's build of `cf73bdc` failed and kept serving the previous deployment; `ac31f5c` pushed the tested
  edits. Lesson (in CLAUDE.md/AGENTS.md): stage exact existing paths and check `git show --stat HEAD` before pushing.
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
- **BUG-5 (medium, fixed Oct 7 night; code live `6c61017`, database rule migration 0015 ran Oct 8)** Overlap
  race: DB only blocked two active bookings with the *same start*; overlapping sessions submitted at the same moment
  could both succeed. Fix: `bookings.blocked_until` (trigger: session end + the buffer in force when saved/moved; not in
  the Drizzle schema) + exclusion constraint `bookings_no_overlap` on `[session_start, blocked_until)` for active rows;
  lowering the buffer in /admin shrinks upcoming ranges (trigger on `booking_settings`), so the DB is never stricter than
  the app. Existing rows got `blocked_until = session_end`. App maps 23P01 → "slot taken" (booking + reschedule).
  Checked locally: 12 SQL scenarios (incl. two simultaneous transactions), the file run twice, the error through
  neon-http.
- **BUG-6 (medium, fixed 1b)** No security headers (HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **BUG-7 (low, fixed Oct 7)** Address form has no unit/apartment, gate, parking or concierge
  fields (Miami condos).
- **Phase 6 log leak (found Oct 7, fixed Oct 10 in `8a9be5b`):** a failed Drizzle query's error message repeats the
  query values, so the old `log.error(..., { error })` path could write family details into Vercel logs. The logger now
  drops every raw Error message recursively and keeps only safe error/driver metadata; explicit Resend/Meta/delivery
  message fields were removed too. Unit coverage proves names/contact values in both direct fields and nested Drizzle
  errors do not survive serialization.
- **BUG-8 (low)** Confirmation step is in-memory: browser Back/refresh shows an empty form (no double booking — OK), but
  the parent loses the reference on screen. Consider sessionStorage restore on the confirmation.
- **BUG-9 (low)** Console warning on `/`: a CSS chunk is preloaded but not used within a few seconds.
- **BUG-10 (low, data)** Live bundle features: "Baby Only" vs "Baby only" capitalization (owner data in /admin).
- **BUG-11 (medium, fixed Oct 9, `c8fb6ec`)** The home portfolio lightbox lived inside `main`'s stacking context, so the
  fixed header sat above it on iPhone and intercepted taps on the close button. The lightbox now portals to
  `document.body`; a three-browser regression opens it, advances a photo and closes it.
- **BUG-12 (medium, live Spanish, fixed Oct 10, `ff549d4`)** The Spanish home headline "Momentos pequeñitos. / Grandes
  recuerdos." was wider than its text column at every width, so both lines were cut off on phones and desktop; the
  desktop "Reservar" oval clipped its R. Spanish-only sizing (`data-locale="es"` on the header/hero); English unchanged.
  Checked on the live `/es` page before/after at iPhone 14, 1440 and 320px: no line overflow, no photo overlap.
- **BUG-13 (medium, live Spanish, WCAG 1.4.10 reflow, fixed Oct 10, `5850a47` + `9a6437a`)** At 320–374px (incl. common 360px Androids) the
  Spanish header ("Portafolio · Paquetes · Reservar") was 22–48px wider than the screen: every `/es` page scrolled
  sideways and the Reservar oval was cut off. Spanish-only at ≤374px (iPhone 14/15 sizes unchanged): 16px nav text, 10px gaps, snugger oval. Measured
  320–430px: no page overflow, oval on screen, 44px targets. New e2e check puts the real Spanish labels into the test
  build's header (Spanish routes are gated off there) at 320/340/351/360/374/375/390px. GitHub's Ubuntu run measured
  the oval 4px wider than macOS (321 vs 317 at 320px), so ≤350px Spanish nav text is 0.95rem: 12px spare on screen.
- **BUG-14 (low, fixed Oct 10, `5313150`)** Server validators accepted impossible dates such as `2026-02-30` (regex
  only) for booking, availability, customer/owner reschedule, overrides, close-day and price/discount end dates. One
  shared `lib/validation/date-key.ts` (`isDateKey`, `daysBetweenDateKeys`) now rejects them; 62-day ranges are counted
  in real calendar days. 4 unit tests.
- **BUG-15 (medium, live Spanish, fixed Oct 10, `0270dc5`)** (a) Tapping EN | ES mid-booking (a full page load) lost the
  step, details and backdrop picks. The tab now keeps the draft in `sessionStorage` for that one page load only
  (`lib/booking/language-draft.ts`: ≤2 min, matching route + bundle, read once then deleted; never sent anywhere; an
  applied discount code is re-checked by the server on the review step). (b) Spanish bundle details say "2 montajes",
  which `setupsOf` didn't recognize, so Spanish 2-setup bookings allowed only one backdrop; it now reads both.
- Checked OK: booking funnel completes on iPhone 14, desktop, Instagram + Facebook in-app user agents (mock); no
  hydration warnings; no horizontal overflow; user input is HTML-escaped in emails + Outlook body.

## Dependencies log
(one line per new dependency: why · bundle impact · maintenance)
- `scripts/local-db` (own package.json, NOT an app dependency, never installed by Vercel): `embedded-postgres`
  18.4.0-beta.17 + `pg` 8 — local Postgres for tests because the AI workspace can't reach Neon. 0 KB to the site.
- `@playwright/test` 1.63 (dev only) — e2e booking-funnel tests across iPhone Safari / Android / desktop / Instagram UA.
  Not shipped to the browser; browsers download separately (`npx playwright install`).
- `@axe-core/playwright` 4.13 (dev only) — WCAG 2.2 AA regression scans inside the existing Playwright suite. 0 KB to
  the site; maintained with axe-core and used only in tests.
- `vitest` 5.0 (dev only) — fast unit coverage for pure security boundaries; pulls Vite/esbuild only into the dev
  toolchain and adds 0 KB to the site. Current major, requires Node 22.12+ (CI is pinned to 22.12).
- `@upstash/ratelimit` 2.2 + `@upstash/redis` 1.39 — shared rate limits across serverless instances (official Upstash
  SDKs, updated Oct 2026). Server-only: 0 KB to the browser. Free tier.
- `@simplewebauthn/server` 14.0.3 + `@simplewebauthn/browser` 14.0.0 (Oct 12, owner chose Face ID / Touch ID sign-in) —
  the standard WebAuthn/passkey implementation (MIT, ~2.4k stars, released Sep 2026, commits weekly). Server package is
  server-only; the browser package loads only in the owner area (0 KB on public pages). Node 22+.
- `eslint` 10 + `eslint-config-next` 16.4 (dev only) — replaces the removed `next lint`. 0 KB to the site. Official.
- `clsx` 2 + `tailwind-merge` 3 — `cn()` class joining (owner's choice, ahead of Tailwind in Phase 9). ~1 KB + ~7 KB gz in
  the browser. Both widely used and maintained.
- `@vercel/analytics` 2 + `@vercel/speed-insights` 2 — owner request (Oct 7). Tiny client scripts served from
  `/_vercel/*`, loaded only on Vercel. Official Vercel packages.
- Stripe: no SDK (two REST calls + webhook signature check with `fetch`/`crypto`, `lib/payments/stripe.ts`). 0 KB.
- Florida ZIP centers (data, not a package): US Census 2026 ZCTA gazetteer, public domain → `lib/travel/fl-zips.ts`
  (1013 ZIPs, 32 KB, server-only, 0 KB to the browser). Regenerate yearly with `scripts/fl-zip-centroids.mjs`.
- `react-email` 6.11 — email templates as React components (brief Phase 2a). Server-side when sending; in the browser
  only in the lazy mock-mode email preview chunk (no page preloads it). It also installs its preview CLI's toolchain
  (esbuild, tailwindcss, socket.io…) into node_modules; none of that is bundled. Maintained by Resend, weekly releases.

## Research notes
- **Phase 8 slice 7 library evaluation** (official docs, Oct 14): Next.js 16 client-side data fetching guide — read-once
  server data: pass a Promise + `use()`; use SWR/TanStack Query "when Client Components need a shared browser cache"
  https://nextjs.org/docs/app/guides/client-side-data-fetching · React — fetching in an Effect is fine for keeping UI
  in sync with the network, with cleanup that ignores stale responses; prefer a custom hook/framework
  https://react.dev/learn/you-might-not-need-an-effect · MDN `<dialog>` — `showModal()` makes the page inert, focuses
  the first focusable element, Esc fires `cancel`; `closedby="any"` for light dismiss; focus return not specified
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog · Motion bundle sizes (useAnimate mini
  2.3 KB, `m` + LazyMotion ~4.6 KB, `motion` ~34 KB) https://motion.dev/docs/react-reduce-bundle-size · TanStack Query
  v5 supports React 19 (~13 KB gz per package comparisons) https://www.pkgpulse.com/guides/tanstack-query-vs-swr-2026 ·
  `useActionState` targets `<form action>` (multi-step/onSubmit not covered) https://github.com/reactjs/react.dev/issues/7310
- **Phase 8** (official docs, Oct 12): Next.js 16.4 route groups — groups only organize; *multiple* root layouts cause
  full page loads between them and need the home route inside a group; nested group layouts "nest within the existing
  app layout". https://nextjs.org/docs/app/api-reference/file-conventions/route-groups ·
  https://nextjs.org/docs/app/getting-started/project-structure (private `_folders`, project files outside `app`,
  split by feature). React Compiler lint rules (recommended preset: set-state-in-effect, set-state-in-render, purity,
  refs, immutability, globals, static-components, …; the compiler skips non-compliant components, so fix gradually):
  https://react.dev/reference/eslint-plugin-react-hooks
- **Email dark mode** (Oct 12): Gmail apps now honor `<meta name="color-scheme" content="light only">` (reported Oct 8,
  2026; real sends worked, Litmus previews didn't; possibly Google accounts only); Apple Mail reads it too; Outlook
  mobile/web use `[data-ogsc]`/`[data-ogsb]` hooks; classic Outlook for Windows has no supported fix.
  https://www.dyspatch.io/blog/gmail-now-respects-your-color-scheme-how-to-stop-forced-dark-mode-in-the-gmail-app/ ·
  https://www.courier.com/blog/dark-mode-email-design ·
  https://learn.microsoft.com/en-gb/answers/questions/2287935/how-can-i-stop-outlook-from-inverting-colors-in-da
- **Phase 6 security/quality** (official docs checked Oct 10): OWASP recommends application-wide sanitization that
  excludes session tokens, passwords and sensitive personal data from logs; same-origin verification for state-changing
  requests; allowlisted file extensions/types, server-side size limits and signature checks; and server-side allowlist
  validation. That drove the centralized log sanitizer, exact-origin admin guard, upload signature/size checks and the
  continuing Zod audit. Next's auth guidance keeps authorization checks close to data and treats cookies as one part of
  session security; OWASP's session/passkey/MFA guidance shows that the current seven-day signed cookie cannot support
  server-side revocation, so passkeys/2FA/recovery remain a separate owner-login slice instead of a cosmetic password
  change. Sources: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html ·
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html ·
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html ·
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html ·
  https://nextjs.org/docs/app/guides/authentication ·
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ·
  https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html ·
  https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- **Phase 6 accessibility/tests/CSP** (official docs checked Oct 10): WCAG 2.2 adds 24×24 CSS px minimum targets and
  stronger focus requirements; automated axe checks catch only part of accessibility, so they are paired with keyboard,
  target-size/reflow regressions and a remaining manual screen-reader/color/zoom pass. Playwright documents
  `@axe-core/playwright`; Vitest 5 requires Node 22.12+; GitHub's Node CI example uses setup-node, `npm ci` and npm cache.
  Gitleaks' full-history `git` scan found no leaks. Next warns that nonce-based strict CSP forces dynamic rendering, so
  CSP will follow the planned report-only → enforce rollout rather than being added blindly. Sources:
  https://www.w3.org/WAI/WCAG22/quickref/ · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ·
  https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html ·
  https://playwright.dev/docs/accessibility-testing · https://vitest.dev/guide/ ·
  https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs ·
  https://docs.npmjs.com/cli/v9/commands/npm-audit/ · https://github.com/gitleaks/gitleaks ·
  https://nextjs.org/docs/app/guides/content-security-policy ·
  https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- **Phase 3 Spanish publication routing** (official docs rechecked Oct 9–10): Next.js's current App Router i18n guide
  still recommends a locale segment around the app, server-loaded dictionaries and locale validation; it now documents
  `next/root-params` as the typed way to read a root `[lang]` param. Current next-intl guidance uses `proxy.ts` on Next
  16, supports `localePrefix: "as-needed"`, `localeDetection: false`, localized navigation helpers and automatic
  alternate-link headers (or disabling them in favor of explicit metadata/sitemap alternates). Because Tiny Humans does
  not move its root layouts into route groups until Phase 8, this slice uses an explicit `/es` tree plus a trusted
  proxy-injected request-locale header; the same all-or-nothing server gate controls routes, switcher, metadata and
  sitemap. This preserves the live English tree and avoids advertising partial translations. Sources:
  https://nextjs.org/docs/app/guides/internationalization · https://next-intl.dev/docs/routing/setup ·
  https://next-intl.dev/docs/routing/configuration · https://next-intl.dev/docs/routing/middleware ·
  https://next-intl.dev/docs/routing/navigation. **Oct 10 admin-control follow-up:** no routing-guidance change; the
  owner switch uses the existing immutable Vercel Blob settings and supported `revalidateTag(tag, { expire: 0 })`
  path already researched below, while the server readiness gate remains the single public source of truth.
- **Phase 5 SEO** (official docs checked Oct 8): Next.js recommends static `metadata` for fixed pages, a native
  `<script type="application/ld+json">` with `<` escaped for structured data, and its root `sitemap.ts`/`robots.ts`
  metadata conventions. Metadata objects merge shallowly, so each page must repeat the complete Open Graph group when
  changing its URL. Google says a root sitemap should list fully-qualified canonical URLs; submitting it is a hint, and
  `robots.txt` controls crawling rather than indexing. Google Local Business rich results require a physical address,
  while Business Profile tells service-area businesses that visit customers to hide their street address and choose
  specific cities/ZIPs rather than a radius. Therefore the site publishes truthful `ProfessionalService` JSON-LD with
  city/region only and does not invent a street address or claim rich-result eligibility. Sources:
  https://nextjs.org/docs/app/api-reference/functions/generate-metadata ·
  https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap ·
  https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots ·
  https://nextjs.org/docs/app/guides/json-ld ·
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ·
  https://developers.google.com/search/docs/crawling-indexing/robots/intro ·
  https://developers.google.com/search/docs/appearance/structured-data/local-business ·
  https://support.google.com/business/answer/9157481
- **Phase 4 seasonal landing settings** (official docs checked Oct 8): keep the new copy/dates in the existing immutable,
  timestamped Vercel Blob settings files instead of adding another store or dependency; Vercel recommends immutable blob
  pathnames to avoid stale CDN/browser copies, matching the project's current timestamped files. Saving already calls
  Next's supported Route Handler `revalidateTag(tag, { expire: 0 })`, so the next visitor receives the newly saved offers
  immediately. https://vercel.com/docs/vercel-blob · https://vercel.com/docs/vercel-blob/using-blob-sdk ·
  https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- **Phase 4 extra-baby add-on** (official docs checked Oct 8): Stripe Checkout accepts multiple `line_items` with
  inline `price_data` (up to 100 in payment mode), so the balance page can keep discounted bundle, full-price add-on
  and travel as separate lines; metadata is for internal identifiers, not sensitive data. Drizzle Kit `generate`
  compares the TypeScript schema with the prior snapshot and writes SQL + a new snapshot; SQL migrations remain the
  deploy artifact, so 0017 was reviewed, made idempotent and tested twice before the schema-reading app code. Zod 4
  schemas validate the 1–3 baby boundary and every baby's age at the API boundary. Next App Router route handlers use
  the Web `Request`/`Response` APIs, matching the existing JSON endpoints; the booking remains a client form with
  server-side validation/repricing. https://docs.stripe.com/api/checkout/sessions/create ·
  https://docs.stripe.com/api/metadata · https://orm.drizzle.team/docs/drizzle-kit-generate ·
  https://orm.drizzle.team/docs/migrations · https://zod.dev/ ·
  https://nextjs.org/docs/app/getting-started/route-handlers · https://nextjs.org/docs/app/guides/forms
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
- **Stripe deposit pieces** (checked Oct 7): Checkout `expires_at` = 30 min–24 h after creation (default 24 h);
  `POST /v1/checkout/sessions/:id/expire` closes an open page; `checkout.session.expired` fires when a page expires
  (Stripe's "limited inventory" guide: release the reserved item on that event); `custom_text[submit][message]` shows a
  note above the pay button. Refunds: `POST /v1/refunds` with `payment_intent` (+ optional `amount`, `reason`
  `requested_by_customer`, metadata), Idempotency-Key supported; refund `status` pending | requires_action | succeeded |
  failed | canceled. Restricted key needs "Refunds: Write".
  https://docs.stripe.com/api/checkout/sessions/create · https://docs.stripe.com/payments/checkout/managing-limited-inventory ·
  https://docs.stripe.com/api/checkout/sessions/expire · https://docs.stripe.com/api/refunds/create ·
  https://docs.stripe.com/api/refunds/object · https://docs.stripe.com/api/events/types
- **Resend webhooks** (checked Oct 7): events `email.bounced` (permanent rejection; `data.bounce.{type,subType,message}`),
  `email.complained`, `email.suppressed` (`data.suppressed.{type,message}`), `email.failed` (`data.failed.reason`),
  `email.delivery_delayed`, …; every payload has `type`, `created_at`, `data.{email_id,to[],from,subject,tags{}}` (tags as
  an object). Signed by Svix: headers `svix-id`, `svix-timestamp`, `svix-signature` ("v1,<base64>" list, space
  separated); HMAC-SHA256 over "id.timestamp.rawBody" with the base64 part of `whsec_…`. Retries: immediately, 5 s, 5 min,
  30 min, 2 h, 5 h, 10 h, 10 h; failing endpoints get disabled (owner emailed). Send-time tags: name/value of ASCII
  letters, numbers, "_" or "-", ≤ 256 chars. https://resend.com/docs/webhooks/event-types ·
  https://resend.com/docs/webhooks/verify-webhooks-requests · https://docs.svix.com/receiving/verifying-payloads/how-manual ·
  https://resend.com/docs/webhooks/retries-and-replays · https://resend.com/docs/api-reference/emails/send-email
- **Microsoft Graph calendar changes** (checked Oct 8): update one event with `PATCH /events/{id}` (send only changed
  fields; success returns 200), and delete with `DELETE /events/{id}` (204). JSON batches allow at most 20 requests,
  each can still be throttled; Outlook service limits batch concurrency to four. The closed-day workflow deliberately
  reuses the existing one-booking-at-a-time self-reschedule path instead of batching calendar writes, preserving its
  Outlook/Neon rollback guarantees. https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0 ·
  https://learn.microsoft.com/en-us/graph/api/event-delete?view=graph-rest-1.0 ·
  https://learn.microsoft.com/en-us/graph/json-batching?tabs=http · https://learn.microsoft.com/en-us/graph/throttling-limits
- **Meta Graph API:** v26.0 released 2026-07-29 (current). https://developers.facebook.com/docs/graph-api/changelog/version26.0
- **Meta domain verification:** Business Settings → Brand Safety → Domains → domain → Meta Tag Verification → Verify.
  https://developers.facebook.com/docs/sharing/domain-verification/verifying-your-domain

## Local test database
**Oct 15:** the local sample bookings were shifted for the dashboard preview (session dates +7 days, booking dates spread
over 6 weeks); local only. `--reset` restores the seed.
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
signed webhook to `FAKE_STRIPE_WEBHOOK_URL`; `/_expire/<id>` = page ran out (+ `checkout.session.expired`; `?nohook=1`
skips webhooks); `/_checkout/fail` = Stripe down for the next page; `/_refunds/fail` = next refund fails; `/_refunds`) + `STRIPE_SECRET_KEY=rk_test_local STRIPE_API_BASE=http://localhost:4747
STRIPE_WEBHOOK_SECRET=whsec_local`. Reminder runs: `GET /api/cron/reminders?now=<ISO>` with `Bearer $CRON_SECRET`.
