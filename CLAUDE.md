# CLAUDE.md — Tiny Humans

Working notes for AI coding sessions. **Start every session with: "Read CLAUDE.md and PROGRESS.md and continue."**
PROGRESS.md holds the phase plan, status, decisions, open owner questions, research notes and the bug log.

## What this is
Newborn & baby photography business (Miami Beach, travels anywhere in Florida up to Orlando). The photographers
(Alondra Jimenez, with Adrian Orozco) bring the studio to the family's home. Live site: https://www.tinyhumans.photography
(Vercel, auto-deploys every push to `main`). Contact hello@tinyhumans.photography, Instagram @tinyhumanspics.
No online payment: "$0 today, pay after your session" (Stripe deposits may come later; keep a slot for a payment step).

## Stack
- Next.js 15.5 App Router, React 19.1, TypeScript (strict), npm. Root layout is an async server component.
- Neon Postgres + Drizzle ORM (`drizzle-orm/neon-http`, `lib/db`), migrations in `drizzle/`.
- Booking providers: `BOOKING_PROVIDER=mock|outlook` (Outlook = Microsoft Graph calendar only).
- Email: Resend (`lib/email`). Storage: Vercel Blob (theme + photos, `lib/settings`). Validation: Zod 4.
- Styling: CSS Modules + `styles/globals.css`; theme colors are CSS variables from `config/themes.ts`.

## Commands
```bash
npm run dev          # local dev (use BOOKING_PROVIDER=mock)
npm run typecheck    # tsc --noEmit
npm run build        # production build (what Vercel runs)
npm run db:generate  # SQL migration from lib/db/schema.ts
npm run test:e2e     # Playwright booking-funnel tests (mock provider)
```
Lint: `next lint` is deprecated and unconfigured (prompts interactively) — ESLint flat config arrives in Phase 7.

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
- Research current official docs before each phase; note findings + links in PROGRESS.md. Every new dependency gets one
  line in PROGRESS.md (why, bundle impact, maintenance).
- The owner is not deeply technical: explain decisions in 1–2 plain sentences; give numbered one-line steps for anything
  he must do; after each phase send a 3–5 line summary.

## Project structure (target — confirmed in Phase 0)
New code goes here from Phase 1 on; existing code moves in Phase 8.
```
app/
  (site)/            public pages (+ [locale] segment if the i18n setup needs one)   [Phase 8]
  (admin)/admin/     owner area with its own root layout                              [Phase 8]
  api/               route handlers
components/
  ui/                chalk-styled primitives (buttons, inputs, cards, badges, dialogs)
  layout/            header, footer, seasonal decor, section wrappers
  form/              form fields, labels, errors, step layouts
  chalk/             doodles, filters, logo, texture effects
features/            booking/, landing/, seasonal/, admin/ — feature components + their own hooks
hooks/               shared client hooks
lib/                 logic: booking/, pricing/, db/, email/, tracking/ (Meta), i18n helpers, rate limiting, auth
emails/              React Email templates                                             [Phase 2]
messages/            en.json, es.json — every customer-facing string
i18n/                language config, routing, detection                               [Phase 3]
config/              true constants only (themes, booking rules) — no owner-editable business data
types/               shared TypeScript types
tests/               e2e/ and unit/
```
Rules: server-only modules `import "server-only"`; features don't reach into each other's internals (import from a
feature's `index.ts`); use the `@/` alias; customer-facing text lives in `messages/` (new code now, all code by Phase 3).
Route groups: `(site)` and `(admin)` will each get their own root layout; navigating between different root layouts is
a full page load (fine: /admin is separate). The root `app/layout.tsx` keeps only html/body/fonts after Phase 8.

## Environment / how this repo is worked on
- **On the owner's Mac (VS Code + Claude extension)** — the normal setup from Oct 7, 2026: full network access,
  push with the owner's own git credentials (`git push origin main`), Vercel CLI / Neon console reachable.
  Local run: `npm install` → `.env.local` (see below) → `npm run dev` → http://localhost:3000.
  - Safe `.env.local` for local work: `BOOKING_PROVIDER=mock`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
    `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (local values). No `DATABASE_URL` = built-in bundles (dev only).
  - For database work use a **Neon dev branch** (or `scripts/local-db`). **Never put the production `DATABASE_URL` in
    `.env.local`** and never run tests against production (a real booking = real Outlook event + real emails).
  - Don't load the Meta Pixel locally unless testing it (leave `NEXT_PUBLIC_META_PIXEL_ID` unset).
- **Earlier cloud sessions (Oct 6–7)** couldn't reach Vercel/Neon/Meta, so they built `scripts/local-db` (embedded
  Postgres + Neon-HTTP shim + fake Microsoft Graph) and pushed through the owner's folder. Those tools still work.
- Vercel deploy status: Vercel dashboard, or the GitHub commit status (`context: "Vercel"`) for the pushed SHA.
- Commit as the owner (his git config), conventional commit messages.

## Tests
- `npm run test:e2e` (Playwright; first time `npx playwright install`): starts its own dev server on :3100 in **mock**
  mode with tracking off, then books a session on iPhone Safari, Android Chrome, desktop Chrome and an Instagram
  in-app user agent. The booking API refuses forms finished in < 4 s (spam check), so tests wait on the review step.

## Gotchas
- Chalk grain is a texture mask (`.chalk-grain` in `styles/globals.css`), NOT a live SVG `feTurbulence` filter — keep it
  that way (scroll performance). Board doodle groups share one grain mask; `Reveal` layers use `will-change: opacity`.
- The intro animation = `components/Header/useIntroAnimation.ts` + the inline `introScript` in `app/layout.tsx`
  (sets `data-intro` before first paint; skipped under /admin). It must never replay between site pages.
- Drizzle inserts/selects list every schema column: **apply a migration to production BEFORE deploying code that adds
  columns to `lib/db/schema.ts`**, or bookings break. Migrations are applied in the Neon SQL editor (owner) for now;
  write them idempotent (`ADD COLUMN IF NOT EXISTS`).
- Tracking: `lib/tracking/` (attribution cookie via `middleware.ts`, Pixel client, CAPI server). Never send baby data.
- Ad landing page path lives in `config/landing.ts` (changing it sends live ads back to Meta review).
- `db.batch()` is a neon-http feature (atomic). Keep it for multi-statement writes.
- Studio time zone is `America/New_York` (`config/booking.ts`); server math uses `lib/booking/timezone.ts`.
  Browser-side date helpers in `lib/booking/dates.ts` use the visitor's local zone — show and label times as Miami time.
- `getPublicCatalog()` caches the bundle list (tag `catalog`, 5 min) and is read in the root layout.
- Admin auth: one password + HMAC-signed httpOnly cookie (`lib/admin/auth.ts`).
