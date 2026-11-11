# AGENTS.md — Tiny Humans

Working notes for AI coding sessions. **Start every session with: "Read AGENTS.md and PROGRESS.md and continue."**
PROGRESS.md holds the phase plan, status, decisions, open owner questions, research notes and the bug log. Its
"▶ Next session prompt" section always has the latest copy-paste prompt (written by `/handoff`).
**The owner switches between Codex (reads this file) and Claude Code (reads `CLAUDE.md`).** Both files hold the same
rules: whenever you change one, make the same change in the other (only the tool names and skill paths differ).

## What this is
Newborn & baby photography business (Miami Beach, travels anywhere in Florida up to Orlando). The photographers
(Alondra Jimenez, with Adrian Orozco) bring the studio to the family's home. Live site: https://www.tinyhumans.photography
(Vercel, auto-deploys every push to `main`). Contact hello@tinyhumans.photography, Instagram @tinyhumans.photography.
No online payment: "$0 today, pay after your session" (Stripe deposits may come later; keep a slot for a payment step).

## Stack
- Next.js 16.4 App Router (Turbopack), React 19.3, TypeScript 7 (strict; `typescript` = the TS 6 API alias for tools,
  `tsc` = TS 7), npm, ESLint 10 flat config. Root layout is an async server component.
- Neon Postgres + Drizzle ORM (`drizzle-orm/neon-http`, `lib/db`), migrations in `drizzle/`.
- Booking providers: `BOOKING_PROVIDER=mock|outlook` (Outlook = Microsoft Graph calendar only).
- Payments: card only, after the session, Stripe Checkout via `fetch` (`lib/payments`), exact booked amount.
- Email: React Email templates (`emails/`) rendered + sent with Resend (`lib/email`). Storage: Vercel Blob (theme +
  photos, `lib/settings`). Validation: Zod 4.
- Styling: CSS Modules + `styles/globals.css`; theme colors are CSS variables from `config/themes.ts`.

## Commands
```bash
npm run dev          # local dev (use BOOKING_PROVIDER=mock)
npm run typecheck    # tsc --noEmit
npm run build        # production build (what Vercel runs)
npm run db:generate  # SQL migration from lib/db/schema.ts
npm run lint         # ESLint flat config (0 problems expected since Oct 14)
npm run test:e2e     # Playwright booking-funnel tests (mock provider, production build)
```

## Rules (condensed from the owner's brief)
- **Ship small slices straight to `main`.** Before every push: typecheck, lint (once configured), build, tests (once they
  exist), and Playwright screenshots of affected pages at phone (iPhone 14) and desktop (1440) widths.
  After every push: confirm the Vercel deployment succeeded, then smoke-test production. If production breaks: revert first.
- **Stop and ask the owner before:** removing a feature; migrations that drop/rename columns or delete data; replacing a
  core library; anything that costs money; changing prices, offer terms, guarantees or legal wording.
- **Visual + motion parity is a hard requirement** through refactors. Additions only with before/after screenshots + owner yes.
- **Business data the owner edits in /admin lives in Neon (or Vercel Blob).** Code holds structure, types, true constants.
  In production never silently fall back to hardcoded business data.
- **Public repo:** never commit secrets, `.env*` (except `.env.example`), customer data, the owner's brief, or the
  marketing brief. New env vars go in `.env.example` with an empty value and a one-line comment.
- **Never run automated tests against production.** Local: `BOOKING_PROVIDER=mock` + local test database.
  A real production booking creates a real Outlook event and real emails.
- **Don't invent business facts** (reviews, counts, stats, guarantees, scarcity). Use `[PLACEHOLDER]`, list it in
  PROGRESS.md, keep the section hidden until the owner approves.
- **Children's privacy:** never send baby names/ages/notes/photos to Meta or any analytics tool — parent contact fields only.
  Session photos may appear in ads only when the family's signed photo waiver says yes to ads; the owner chooses
  and uploads them by hand, code never sends them.
- Research current official docs before each phase; note findings + links in PROGRESS.md. Every new dependency gets one
  line in PROGRESS.md (why, bundle impact, maintenance).
- The owner is not deeply technical: explain decisions in 1–2 plain sentences; give numbered one-line steps for anything
  he must do; after each phase send a 3–5 line summary.
- **End of every phase** (also when the chat is getting long, or the owner asks, e.g. "hand off to Claude"): follow the
  handoff steps in `.agents/skills/handoff/SKILL.md`. It updates PROGRESS.md, saves a copy-paste prompt for the next
  session in PROGRESS.md → "▶ Next session prompt" (it works in Claude Code and in Codex), and ends the reply with the
  summary + that prompt.

## Project structure (target — confirmed in Phase 0)
New code goes here from Phase 1 on; existing code moves in Phase 8.
```
app/
  (site)/            public pages + /es; its layout draws the site shell              [done Oct 12]
  (admin)/admin/     owner area; nested layout, same site shell (owner keeps chalk)  [done Oct 12]
  api/               route handlers
components/
  ui/                chalk-styled primitives (buttons, boxes, photo cards)            [done Oct 13]
  layout/            SiteShell, header, footer, seasonal decor, Reveal, 404           [done Oct 13]
  form/              form fields, labels, errors, step layouts
  chalk/             doodles, filters, logo, board drawings                           [done Oct 13]
  providers/         site settings + catalog React contexts                           [done Oct 13]
features/            admin/, booking/, home/, landing/, about/, legal/, after-session/ (seasonal/ later) —
                     feature components + their own hooks                             [done Oct 13]
hooks/               shared client hooks
lib/                 logic: booking/, pricing/, db/, email/, tracking/ (Meta), i18n helpers, rate limiting, auth
emails/              React Email templates                                             [Phase 2]
messages/            en.json, es.json — every customer-facing string
i18n/                language config, routing, detection                               [Phase 3]
config/              true constants only (themes, booking rules) — no owner-editable business data
types/               shared TypeScript types
tests/               e2e/ and unit/
```
Rules: server-only modules `import "server-only"`; features don't reach into each other's internals: another feature
imports only a feature's root files (e.g. `@/features/booking/BundleCard`), never its subfolders (`flow/`,
`reschedule/`, …), and never through a barrel `index.ts` (measured Oct 13: an index re-exporting client components
added 10–16 KB of JS to the home, landing and /admin pages); use the `@/` alias; customer-facing text lives in
`messages/` (new code now, all code by Phase 3).
Route groups (Phase 8 decision, Oct 12, from the Next.js docs): ONE top-level root layout (html/body/fonts, theme CSS
variables on `<html>`, intro script, viewport) with nested `(site)` and `(admin)` layouts, not multiple root layouts (no
full reloads; the 404 keeps working). The shell (providers, SeasonalDecor, Header, Footer, MetaPixel) is
`components/layout/SiteShell.tsx`. `app/not-found.tsx` (unknown addresses) renders inside the root layout only, so
it draws SiteShell itself; `notFound()` inside the site needs `app/(site)/not-found.tsx` (no shell), otherwise the
inherited root 404 renders inside the (site) layout = two headers. CSS order is root layout → group layout → page:
where a global class (`globals.css`, e.g. `.container`) and a module class on one element set the same property,
moving an import between layouts flips which wins (Oct 12: footer copyright margin), so don't set both. The same
goes for two CSS modules on one element (a component's own class + a `className` passed in): Turbopack's merged
chunks can order them either way and moving files changes it (Oct 13: bundle-card button). After moving or
restyling components run `node scripts/css-ties.mjs <base URL>` (read-only; expect 0 ties).

## Environment / how this repo is worked on
- **On the owner's Mac (VS Code + Claude extension)** — the normal setup from Oct 7, 2026: full network access,
  push with the owner's own git credentials (`git push origin main`), Vercel CLI / Neon console reachable.
  Local run: `npm install` → `.env.local` (see below) → `npm run dev` → http://localhost:3000.
  - Safe `.env.local` for local work: `BOOKING_PROVIDER=mock`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
    `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (local values). No `DATABASE_URL` = built-in bundles (dev/CI only;
    `builtInCatalog()` refuses them when `VERCEL_ENV=production`, so the live site shows booking as paused instead).
  - For database work use a **Neon dev branch** (or `scripts/local-db`). **Never put the production `DATABASE_URL` in
    `.env.local`** and never run tests against production (a real booking = real Outlook event + real emails).
  - Don't load the Meta Pixel locally unless testing it (leave `NEXT_PUBLIC_META_PIXEL_ID` unset).
- **Earlier cloud sessions (Oct 6–7)** couldn't reach Vercel/Neon/Meta, so they built `scripts/local-db` (embedded
  Postgres + Neon-HTTP shim + fake Microsoft Graph) and pushed through the owner's folder. Those tools still work.
- Vercel deploy status: Vercel dashboard, or the GitHub commit status (`context: "Vercel"`) for the pushed SHA.
- Commit as `tinyhumanspics <hello@tinyhumans.photography>`. Conventional Commits (`feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`, `test:` …, optional scope), one type per commit, **no AI co-author/session trailers**.
- **Stage exact paths, never `git add -A`:** other tools may be editing this folder at the same time. `next-env.d.ts`
  flips between `.next/types` and `.next/dev/types` when the dev server runs; don't commit that change.
- GitHub CLI: `/opt/homebrew/bin/gh` (signed in as tinyhumanspics; not on the AI shell's PATH); `git push` works.

## Tests
- `npm run test:e2e` (Playwright; first time `npx playwright install chromium webkit`): builds and starts a production
  server on :3100 in **mock** mode with tracking off (Next 16 allows one `next dev` per project), then books a session
  on iPhone Safari, Android Chrome, desktop Chrome and an Instagram in-app user agent, and checks /book fallbacks + 404.
  The booking API refuses forms finished in < 4 s (spam check), so tests wait on the review step.
- Visual parity: `npm run build && npx playwright test -c playwright.visual.config.ts` (8 pages × iPhone 14/1440 vs
  `.screenshots/parity/`, gitignored; `--update-snapshots` only after the owner approves a visual change).
- Refactor parity method (Phase 8): build the old commit in a scratchpad `git worktree` (`cp -Rc node_modules`), serve
  old and new side by side (`next start -p`), then compare the computed CSS of every element (17 pages × iPhone/1440),
  a booking walk-through (12 steps, screenshots + HTML), page JS/CSS bytes and `scripts/css-ties.mjs`. Capture both
  builds the same day (the calendar's "today" moves). Chrome sometimes reports `margin: auto` as `0px` in
  `getComputedStyle`; compare element positions before calling that a change.

## Gotchas
- Chalk grain is a texture mask (`.chalk-grain` in `styles/globals.css`), NOT a live SVG `feTurbulence` filter — keep it
  that way (scroll performance). Board doodle groups share one grain mask; `Reveal` layers use `will-change: opacity`.
- A mask (`.chalk`, `.chalk-soft`, `.chalk-grain`) paints only inside its own element's box: anything drawn past it is cut
  (owner, Oct 22: "drawings must be fully drawn"; WebKit ignores `mask-clip: no-clip`). Board drawing layers reach
  `--board-reach` (96px) past their area (`.spots` = the area), and `SectionHeading` titles have padding + negative margins +
  `mask-origin: content-box`. Keep new drawings inside a masked box, never on letters or under buttons/photos; check with
  `tests/e2e/doodles.spec.ts` (heading letters) and a phone-to-desktop look.
- The intro animation = `components/layout/Header/useIntroAnimation.ts` + the inline `introScript` in `app/layout.tsx`
  (sets `data-intro` before first paint; skipped under /admin). It must never replay between site pages.
- Drizzle inserts/selects list every schema column: **apply a migration to production BEFORE deploying code that adds
  columns to `lib/db/schema.ts`**, or bookings break. Migrations are applied in the Neon SQL editor (owner) for now;
  write them idempotent (`ADD COLUMN IF NOT EXISTS`).
- Tracking: `lib/tracking/` (attribution cookie via `proxy.ts`, Pixel client, CAPI server). Never send baby data.
- Ad landing page path lives in `config/landing.ts` (changing it sends live ads back to Meta review).
- `db.batch()` is a neon-http feature (atomic). Keep it for multi-statement writes.
- `bookings.blocked_until` + the exclusion constraint `bookings_no_overlap` live only in the database (migration 0015,
  triggers fill the column; it's deliberately not in `lib/db/schema.ts`). Overlapping active bookings fail with 23P01
  (`isOverlapViolation`). Never `drizzle-kit push` (it would drop the column).
- The project lives on the iCloud-synced Desktop: Finder/iCloud " 2"/" 3" duplicates appear (seen Oct 7 in
  `.next/types/*.d 3.ts`, and as old copies of a regenerated migration). iCloud can also bring back files git just
  removed (after `git switch` or `git stash`; Oct 12 a stash left 25 " 2" copies of moved files): compare them
  with git before deleting. Never stash/switch here for before/after builds: use `git worktree add` in the
  scratchpad + `cp -Rc node_modules` (APFS clone, seconds). `tsconfig.json` excludes `.next/**/* ?.ts` so they no longer break `npm run typecheck`;
  duplicates inside `.next/` are safe to delete; ask before touching any elsewhere.
- Links in customer emails carry a 256-bit token; only its hash is stored (`bookings.cancel_token_hash` for the booking's
  own manage link, `booking_emails.link_token_hash` per reminder/after-session email). Which pages accept which kind
  is deliberate (reminders → manage pages; after_session → /pay; gallery_delivered → /pay + /review).
- Closed-day emails use `booking_emails.kind = day_closed`: that token is **reschedule-only**, bypasses the normal notice
  cutoff, and expires when the session time changes. Do not let it reach cancel/backdrop pages. Closing a date must also
  expire any pending deposit Checkout page before releasing its time, even when the owner skips the email.
- Cancel/reschedule notice: never hard-code "48". Use the booking's `booking_terms.notice_hours` (falls back to the
  /admin setting) and the wording helpers in `lib/booking/reschedule-policy.ts`; pages use `getNoticeHoursSetting()`.
- Payment links (`/pay?b=<reference>&s=…`) are signed with `ADMIN_SESSION_SECRET`: changing that secret changes every
  booking's payment link (links already sent stop working). The chalk logo intro is skipped on `NO_INTRO_PATHS`
  (`app/layout.tsx`: /review, /pay, /cancel, /reschedule — pages opened from emails) and the ad landing page.
- `NEXT_PUBLIC_SITE_URL` is baked in at build time (also in server code): local test servers on other ports still
  write `http://localhost:3000` links into emails.
- Reminders: `vercel.json` cron (daily, Hobby) → `/api/cron/reminders` → `lib/booking/reminders.ts`; table
  `booking_emails` claims each email. Manage links are found by token hash on `bookings` OR `booking_emails`
  (`findByCancelToken`). Never send reminders from a test against production; test locally with `?now=` + fake Resend.
- Email delivery problems: `/api/resend/webhook` → `email_events` (`lib/email/delivery.ts`). `sendEmail` tags every
  email with `category` (scope) + `booking` (reference): always pass `reference` so a bounce lands on the right lead.
- Emails: React adds `<!-- -->` between adjacent text pieces in JSX (`{a} {b}`) — build one string per text run.
  Check email changes with screenshots of the rendered HTML (old vs new) before sending anything real.
- Studio time zone is `America/New_York` (`config/booking.ts`); server math uses `lib/booking/timezone.ts`.
  Browser-side date helpers in `lib/booking/dates.ts` use the visitor's local zone — show and label times as Miami time.
- Theme changes in /admin reach the site and every customer email at once (settings cache tag expired on save; emails
  read the active theme when sent). Photos are per theme; empty slots in non-default themes show the default
  ("Original") theme's picture (`config/media.ts` → `resolveMedia`).
- Home "Little moments" = `ThemeMedia.sections` (`config/media.ts`): each section's pictures in rows of 3, then its
  optional box; `null` = follow the Original theme (built-in for Original). `landingPicks` (max 6, else the first 6)
  feed the landing gallery. Old saves (`groups`/`extra`) convert on read; `storedSettings()` also writes those old
  fields so a revert keeps the owner's pictures. Changing the settings shape: bump the `unstable_cache` key in
  `lib/settings/server.ts` (Vercel's data cache outlives deployments).
- `getPublicCatalog()` caches the bundle list (tag `catalog`, 5 min) and is read in the root layout.
- Spanish publication is all-or-nothing: `/es`, the language switcher, reciprocal hreflang and Spanish sitemap entries
  appear only when the switch in `/admin/settings` is on **and** `getSpanishPublication()` passes the live Spanish
  bundle + owner-copy audit. The switch is stored in the existing Vercel Blob settings (old saves default off); it does
  not need an environment variable or redeploy. Only `/api/admin/spanish` may change it because that endpoint validates
  readiness; the general settings save preserves its previous value. `proxy.ts` supplies the trusted request-locale
  header, and booking/email/payment/manage links follow the saved booking locale. A failed gate makes every `/es` route
  a 404 without exposing partial English copy.
- Admin auth: the password or a passkey (Face ID / Touch ID: `lib/admin/passkeys.ts`, SimpleWebAuthn, rpID
  `tinyhumans.photography`) → HMAC-signed httpOnly cookie carrying the owner's session epoch (`admin_auth`, migration
  0020; `lib/admin/auth.ts`). "Sign out all other devices" raises the epoch: never rotate `ADMIN_SESSION_SECRET` to sign
  someone out (it also signs every payment link). `proxy.ts` rejects every mutating
  `/api/admin/*` request unless its `Origin` exactly matches the request URL (Referer only when Origin is absent); local
  API tests/curl must send the exact local origin. Passkeys need the database: test them with `scripts/local-db` +
  Chromium's virtual authenticator (CDP `WebAuthn.*`); CI has no database and covers only the pre-migration state.
- The owner often has `npm run dev` running on :3000. Stop only your own servers, by port → PID
  (`lsof -nP -t -iTCP:<port> -sTCP:LISTEN`), never `pkill` by name (every Next server is called `next-server`).
  Test servers: :3100 (e2e) and :3200 (visual parity, local Outlook mode with `scripts/local-db`).
- A local `next build` can reuse the previous build's prerendered ISR pages (with the database data of that time):
  re-save the setting in /admin (it revalidates) or `rm -rf .next` before judging a page. Playwright WebKit drops the
  Secure admin cookie on http://localhost → use Chromium for /admin screenshots.
- Failed Drizzle error messages repeat query values (customer data). All server logs must go through `lib/log.ts`, whose
  recursive sanitizer drops raw Error messages, secrets, contact/family fields, IPs and user agents; pass the Error plus
  safe identifiers/codes, never copy vendor/error messages into another field. New per-booking extras go in their own
  table with a best-effort insert (`booking_access`, `booking_backdrops`, `booking_consents`, `booking_terms`,
  `booking_baby_genders`) so a missing migration never breaks bookings; anything that changes money (e.g.
  `travel_fee_cents`) stays on `bookings`, migration-first.
- `npm run typecheck` (TS 7, `incremental: true`) can report "clean" from a stale `tsconfig.tsbuildinfo` and miss new
  errors (seen Oct 7): before committing run `npx tsc --noEmit -p . --incremental false` (or delete the tsbuildinfo).
- The owner sometimes records new decisions in PROGRESS.md (own commits) while a session is working: check `git log`
  before building on an old decision, and again before committing.
- **Deposits** (`lib/deposit/`): a `pending` booking = waiting on its deposit's Stripe page (it blocks its time; no
  Outlook event, no emails, no reminders, no /admin cancel/reschedule yet). It's confirmed by `confirmBookingRow`
  (`lib/booking/confirm.ts`) from the webhook, the return page or `sweepDeposits()`, never twice (lease on
  `booking_deposits.confirming_at`). Deposit Checkout pages carry `metadata.kind = "deposit"`: never record them as the
  session's payment (`booking_payments`). Amounts due = total − paid deposit (`amountDueCents(row, paid)`,
  `nextCharge`). Local test: fake Stripe `/_pay`, `/_expire`, `/_checkout/fail`, `/_refunds/fail` + `.graph-down`.
- Vercel Analytics + Speed Insights render only when `VERCEL=1` (their `/_vercel/*` scripts don't exist locally); URLs
  pass through `lib/tracking/safe-url.ts` first. Next 16: `proxy.ts` (not middleware), `revalidateTag(tag, { expire: 0 })`.
- SEO: every indexable page uses `pageMetadata()` from `lib/seo/metadata.ts` so its canonical and Open Graph URL stay
  in sync; `app/sitemap.ts` lists only canonical public content. `/book` is noindex. The service-area JSON-LD must not
  gain a street address, reviews, hours or prices unless the owner supplies/approves those facts.
- CSP: `lib/security/csp.ts` (sent from `next.config.ts`, Report-Only since Oct 12; reports → `/api/csp-report` →
  `csp` log warnings). No eval in browsers: code that also runs client-side imports `z` from `lib/validation/zod.ts`
  (browser `jitless`). A new third-party script, image, font or connection host must be added to the policy.
- Public pages must not import `lib/admin/client` (it pulls the whole owner-area client into every page, ~100 KB
  gzipped). The old static click-through prototype was removed in Phase 8 (owner OK, Oct 12).
- Rate limits are per visitor address, so each Playwright project sends its own `x-forwarded-for`; booking tests pick
  calendar days with `pickFirstOpenDay` (waits for the availability response before deciding to change month).
- Commits: stage exact, existing paths (one missing path makes `git add` stage nothing) and check `git show --stat HEAD`
  before pushing (Oct 12: a push carried only the deletions; Vercel's failed build kept the old version live).
- Emails declare `color-scheme: light only` (meta + `:root`, both layouts) so dark-mode mail apps (Gmail apps, Apple
  Mail) keep our colors; never set it back to `dark`. Classic Outlook for Windows can't be controlled.
- Themes: each theme's board colors (`chalkboard`/`Dark`/`Light`) and Thanksgiving's lighter text/accents are in
  `config/themes.ts`; Thanksgiving-only CSS uses `:global(html[data-theme="thanksgiving"])` and
  `tests/unit/contrast.test.ts` mirrors it. Seasonal email logos/strips in `lib/email/assets.ts` are generated images on
  each board color (logo = the theme's `public/brand` layers composited at 440 px wide); no generator in the repo.
- Production bundles have an empty `people` line; who can join lives in `features` (use `includesSiblings()`).
- /admin deposit link: `ownerDepositLink()` re-holds a released time for 30 min only if still free (hours, blocks,
  Outlook, other bookings + the overlap constraint). Opening /admin → Leads runs `sweepDeposits()` (releases overdue
  holds and sends the family + studio emails).
- Owner area (Phase 10, Oct 15–16): /admin keeps the chalkboard design (owner: no light/dark mode). Confirmations use
  `features/admin/AdminDialog.tsx` (native modal `<dialog>`: inert page, Escape, focus back to the opener); never a
  createPortal overlay, and no `autoFocus` on its buttons. Dashboard numbers: `lib/admin/dashboard.ts` (server-only
  queries) + `lib/admin/dashboard-summary.ts` (pure counting, unit tested); charts are small chalk SVG components
  (`features/admin/DashboardInsights.tsx`, no chart library: Recharts measured 106 KB gzipped). Admin e2e tests fake the
  owner APIs with `tests/e2e/fixtures/admin.ts` (signed-in session + a sample lead).
- Owner menu (owner, Nov 10): `features/admin/AdminMenu.tsx`. Laptop/desktop (`min-width: 1200px` + hover + fine
  pointer): menu always shown at the far left, no Hide, and the page, header and topbar use the full width (Admin.module.css
  lifts `main.container`/`header .container` with `:has(.shellWide)` and hides `[data-margin-decor]`, the SeasonalDecor
  doodles that live in the side margins). iPad sideways / narrower windows (900 px+): sticky column beside the centered
  page with "« Hide" (localStorage `tinyhumans.adminMenu`). Phone / iPad upright: "☰ Menu" opens a panel from the left
  on a native modal `<dialog>`. Keep `<nav aria-label="Owner area">` and the ADMIN_NAV order (e2e tests use both); on
  phone sizes the nav only exists while the panel is open.
- Production checks with Playwright: abort `facebook.(net|com)` and `/_vercel/(insights|speed-insights)` requests so a
  test visit never reaches the Meta Pixel or Vercel Analytics. A failed or missing Vercel deploy: check
  https://www.vercel-status.com first (an Oct 12 incident failed/delayed builds that passed locally).
- Unfinished bookings (`lib/unfinished/`, migration 0022, /admin → Unfinished bookings): the booking form saves the
  parent's contact details when they leave a contact box (`POST /api/booking/draft`, always 204, never baby details)
  and anonymous step counts (`/api/booking/funnel`; "booked" is counted server-side in the create route). Everything is
  best effort: a missing table must never reach the form. The "What stopped you?" email is marketing (CAN-SPAM):
  ChalkLayout `marketing` footer (ad note, mailing address, unsubscribe) + `List-Unsubscribe` one-click headers; it
  can't be sent without the mailing address and never to `email_unsubscribes`. /unsubscribe needs a button press
  (link scanners). Changing what's saved means changing the Privacy Policy and the note under the email box.
- Website reviews ("What families say", home after the photos + ad page section 7): `getPublicReviews()`
  (`lib/reviews/server.ts`, cache tag `reviews`) = the 6 newest reviews with `approved` AND `consent_public`. Anything
  that changes a review, its pick or deletes a lead calls `expireReviews()`. No picked reviews = no section (pages stay
  exactly as before). Never add review JSON-LD or star ratings to search data without the owner's approval.
- Photo waivers (`lib/waiver/`, `features/waiver/`, migration 0023_photo_waivers, /admin → Leads → "Waiver signature" /
  "See signed waiver"): the iPad screen and the signed copy live in route group `app/(kiosk)` (no site shell, admin
  menu or Meta Pixel, so a parent can't wander into the admin). A signed row is the business's record: code never
  edits or deletes it, and a trigger (only in the migration, like 0015) refuses changes to what was signed; "Sign
  again" supersedes, "Keep their photos private" revokes, deleting a lead keeps it (`booking_id` → null). The server
  rebuilds the text from `WAIVER_VERSION` + language (never from the browser) and stores it + its SHA-256. Wording
  lives in `lib/waiver/text.ts`: any change = a new `WAIVER_VERSION` (`tests/unit/waiver.test.ts` pins the
  fingerprint). Signing updates `booking_consents.photos` (website or social = yes).
- Spanish fills itself in on save (owner, Nov 9): the settings and bundle routes run `lib/i18n/spanish-autofill.ts`
  before saving, so every EMPTY Spanish field gets its English pair translated (`lib/i18n/autotranslate.ts`, Claude,
  only with `ANTHROPIC_API_KEY`; otherwise the English is copied). Never overwrite Spanish the owner typed, never make
  a save fail because of translation, and only send owner-written marketing words (never baby/family data). A new
  owner-editable text with a Spanish twin must be added to the autofill and to `i18n/publication-audit.ts`.
- Shoots (`/admin/shoots`, `lib/shoots/`, `features/shoots/`, migration 0024_shoots): booking shoots take date/time from
  the booking (no copy), tick keys use the stable shoot key `b-<reference>`, ticks sync by polling every 10 s. Shoot
  photos go to the PUBLIC Blob store under `shoots/<shoot id>/…` with random suffixes (private access needs a separate
  private store): show them only in /admin with `<img>` (never next/image or public pages), delete files BEFORE rows
  (`removeShootFiles`, only "shoots/" paths), and the lead delete route removes them first. No video uploads (owner, Nov
  10: videos are added as links, which open Instagram/TikTok/YouTube). Pure logic is unit tested; server code needs `scripts/local-db` (Blob faked).
- Family members + who's in each shot (owner, Nov 10; migration 0025_family): bundles whose people/features mention
  siblings (`asksFamily()`, today Our Family Story) ask "Who else is in the photos?" (`config/booking.ts` familyRoles;
  all optional (owner, Nov 10): the list starts empty, an empty row is left out, a name without a role is kept as
  "other" — `filledFamily()` in features/booking/flow/booking-state.ts; only a row past the bundle's maximum stops it). FAMILY_INCLUDED_PEOPLE = 5 counting the babies; each person over that is the bundle's
  `extra_person` add-on (`bundle_addons`, /admin → Pricing, $75, max extra 1–9; `extraPersonLine`/`familyLimit`/`withAddons`
  in `lib/booking/extra-babies.ts`), priced on the server like the extra baby (quote sends `familyCount`; booking_addons
  keeps one row per kind; the Stripe page lists each add-on). Saved best effort in `booking_family_members`
  (`saveBookingFamily`/`familyFor` in `lib/booking/addons.ts`) and shown in review, confirmation, both emails, the Outlook
  event, Leads and Shoots. Shot ideas keep `shoot_inspo.who` keys ("all", "baby:<n>", "fam:<n>"; `lib/shoots/people.ts`):
  a database-only column like `bookings.blocked_until` (not in `lib/db/schema.ts` or the 0025 snapshot; read/written
  with raw SQL best effort in `lib/shoots/server.ts`), so Shoots keeps working where 0025 hasn't run. The extra_person
  bundle row is saved outside the bundle batch for the same reason. Family names are parent data: never to
  Meta/analytics, never in the unfinished-booking draft.
- Bundle cards (/bundles and the ad landing page): columns come from `bundleColumns(count)` (`lib/pricing/columns.ts`,
  CSS vars `--cols-md`/`--cols-lg`): phones one under the other, 900 px+ up to 3 (4 bundles = 2 × 2), 1180 px+ up to 4
  in a row, each card at most 380 px and centered. /bundles keeps 48–72 px under the tallest card so it never reaches
  the footer's dashed line (owner, Nov 10).
- Special offers (owner, Nov 10): an offer is still one price per bundle (`bundles.offer_price_cents`); "% off" is saved as
  that exact price (`percentOffCents`, cents like a % discount code) and read back with `offerPercent()` (a price that is
  exactly a whole % off = a % offer), so there's no percent column. /admin → Pricing → "Same offer on every bundle"
  (`applyOfferToAll`, `/api/admin/pricing/offer`) puts one %/label/last day on every ACTIVE bundle in one batch and
  writes the Spanish label on existing `bundle_translations` rows (a label without its Spanish pair hides /es). The line
  under the Bundles heading on /bundles and the ad page (`lib/pricing/promo.ts`, `features/booking/OfferLine.tsx`) is
  written from the offers themselves and disappears with them; no offers = pages exactly as before.
- Quotes (/admin/quotes, `lib/quotes/`): a family's ZIP code (read from a pasted address in the browser; the address is
  never sent) → every active bundle priced with the booking form's own functions (offer, twins, extra people, travel,
  deposit) + a ready-to-send EN/ES message. Optional owner "% off" (`&percent=`) is priced like a % discount code
  (`quotePercentTerms`): only the bigger of it and a running offer counts. Owner-only GET `/api/admin/quote`.
- "Not born yet" (owner, Nov 10; migration 0026, table `due_date_reservations`): /due-date reserves a bundle with a due
  date (today to 9 months ahead, `dueWindow`), keeps today's bundle price (offer included) and takes the deposit on
  Stripe (`metadata.kind = "due_deposit"`, the id in `metadata.booking_id` is the RESERVATION's; `handleStripeEvent`
  routes it to `lib/due-date/server.ts` first). It blocks no time and makes no Outlook event. The family's email link is
  `/book?bundle=…&due=<token>` (token = HMAC of the id with `ADMIN_SESSION_SECRET`, only its hash stored: rotating the
  secret breaks these links too). `createBooking` with `dueToken` (or the server-only `dueReservationId` from /admin →
  Leads → Due dates → "Book their session") uses the kept price (`keptPriceBundle`), no code, NO new deposit, claims the
  reservation (`claimDue`, 5-minute lease), copies the paid deposit into `booking_deposits` (`carryDueDeposit`) so the
  balance/refunds count it, then marks it scheduled. The mock provider refuses due bookings (needs the database), so CI
  has no coverage: test with `scripts/local-db` + fake Stripe (`/_pay/<id>`). Never send the due date to Meta/analytics.
- Seasonal offer boxes (owner, Nov 10): `settings.seasonalOffers` is a LIST (the built-in `thanksgiving` and
  `firstChristmas`, never deletable, then the owner's own `offer-…` ones, max 12), each with `themeId` (one theme or
  "any"). Saved as `seasonalOfferList` plus the old { thanksgiving, firstChristmas } record so a code revert keeps the
  built-in two (settings cache key `site-settings-v3`). `features/seasonal/SeasonalOffers.tsx` draws them on the ad page
  AND the home page (after the hero), with the running bundle offer line inside the box. The bundle card's discounted
  price is 0.82em of a regular price (owner, Nov 10).
- Valentine's theme (owner, Nov 10–11; after Raspberry, light pink, coral and two pinks the owner chose SOFT CREAM
  #fff5e1): theme id `valentines`, the only light board, so its "chalk" is deep wine (`chalkWhite` #3d0a1c = the
  writing, `sunYellow` #a3154a = raspberry highlights and buttons, whose text is `chalkboardDark`; form placeholders at 85%,
  `LIGHTER` in the contrast test); anything drawn in a fixed
  off-white disappears on it, so use the theme variables (emails: `chalkAlpha()` in `lib/email/theme.ts` for dashed
  lines and frames). Check new colors with the contrast test before showing the owner. The Original logo layers + a heart `decor` layer
  (`public/brand/valentines/decor.webp`; intro strokes in `config/logo/valentines-drawing.ts`, lettering 0.3 s later)
  + its own dark lettering (`public/brand/valentines/text.webp`), drawings `heartArrow`/`loveLetter`/`rose`/`twoHearts`/
  `xo`. The thanksgiving placeholder/star overrides also apply to it (contrast test `LIGHTER`). Its artwork and email
  logo/strip come from `scripts/theme-assets-valentines.mjs` (the email JPEGs are base64 in `lib/email/assets.ts`). Built-in seasonal offer
  `valentines` ("Show love to your tiny human", last sessions Feb 28, off by default). The owner switches the theme in
  /admin → Theme on Feb 1 and back on Mar 1.
- Booking order + trip days (owner, Nov 10; migration 0027_trip_settings): the steps are `you` (contact + home address)
  → `date` → `time` → `details` (babies, family, notes, backdrops, permissions) → `review` (`STEP` in `config/booking.ts`;
  `DetailsForm` `part`). Step one shows "Fill in your details first…" (`bookingFlow.firstStep`) under the baby-led note.
  The calendar loads only after step one and sends the ZIP (`/api/booking/availability?zip=`). Trip days
  (`lib/booking/trips.ts` pure + unit tested, `trips-server.ts`): a session more than `tripMiles` (60) road miles from the
  travel-fee base ZIP takes its day: only families within `sameTripMiles` (30) of every trip session that day can book
  it; a far family can't take a day with sessions near home or whose next morning (before `nextDayUntil`, 12:00) is
  booked; the day after a trip opens at `nextDayUntil`. Miles come from `travelQuote` (no travel settings saved = miles
  unknown = local, so no trip days). Enforced in availability, create (`tripConflict` → `slot_unavailable` with
  `bookingFlow.errors.tripDay`) and reschedule. /admin → Availability → Trip days saves `trip_settings` (best effort:
  no row or table = the defaults). Unfinished bookings: the draft is saved from step one (no date yet) and again on
  reaching details (with date/time); funnel step "calendar" = the booking form opened ("Opened the booking form").
  Older saved form drafts (`lib/booking/language-draft.ts` v1) are ignored.
- Discount code categories (owner, Nov 10; migration 0028_code_categories): an optional owner-only campaign label per
  code ("Thanksgiving offer", "Christmas offer", "Happy Valentine's offer" presets in `lib/pricing/code-categories.ts`,
  or "Other…" typed; typed ones join the list). Its own table `discount_code_categories` (code_id → category), read
  and written best effort like the per-booking extras: before the migration codes, checkout and leads work and only
  saving a category explains the SQL. Shown in /admin → Pricing (label under the code + "Show" filter) and on leads
  ("Code category", looked up by the booking's code text, so it's the code's CURRENT category). Never sent to
  customers, emails or analytics, and never part of a price.
- Photos / Media layout (owner, Nov 11: "a bit complicated to understand"): each part of the website is a `MediaFold`
  (native <details>, closed by default, summary like "3 sections · 9 pictures · 3 boxes showing"); each picture is a
  `MediaSlot` card (picture, source, tags, ONE "Edit" button) whose `PhotoEditor` dialog (AdminDialog) holds replace /
  remove, the section tools (passed as children: move, use in the box, show on the ad page) and the words + Spanish;
  a section's box is one line + "Edit box" (`BoxEditor` dialog). Spanish is never required in the owner area: empty
  Spanish is filled at save (`lib/i18n/spanish-autofill.ts`) and "Fill in Spanish for me" (`features/admin/FillSpanish.tsx`,
  also in Seasonal Landing) calls owner-only `/api/admin/translate` (same translator; GET = is ANTHROPIC_API_KEY set,
  shown by `TranslationStatus`). `settings.portfolioBoxes` (settings cache key v4) false hides every "Book a memory like
  this one" box (`withoutBoxes` in `liveMedia`) and the Spanish audit stops asking for their wording.
