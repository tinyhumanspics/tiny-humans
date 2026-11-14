# Tiny Humans: rules for coding sessions
In-home newborn & baby photography, Miami. Live: www.tinyhumans.photography (Vercel; main auto-deploys).
Start every session with docs/STATE.md, then the brief you were given (plan/briefs/NN-*.md). Read nothing else unless the brief says so. docs/archive/ is history: grep it, never read it whole.

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · CSS Modules → Tailwind v4 + styles/theme.css tokens (brief 07) · Neon Postgres + Drizzle (drizzle/) · Stripe Checkout (lib/payments) · Resend + React Email (emails/) · Microsoft Graph, Outlook calendar only · Vercel Blob · next-intl (messages/en.json + es.json) · Meta Pixel + Conversions API (lib/tracking).

## Commands
npm run dev · typecheck · lint · build · test:unit · test:e2e (mock provider; never against production)

## How work arrives
- Work comes as briefs in plan/briefs/ (git-ignored, written by Carlos), run in number order. The owner telling you to run a brief is his approval for everything it lists under Change and Remove.
- "Continue the plan" means: read docs/STATE.md, then do the next brief (or the next session of the current one). Brief 08 starts only when the owner says Carlos gave the go-ahead.
- Before building, check the brief's "Before you start (owner)" items with the owner. If one isn't done, tell him how to do it in plain numbered steps, and wait.
- One brief per session unless the brief says it takes several. Stay inside its scope. Anything else goes in STATE.md under "Waiting on owner"; don't build it.
- plan/research/ is background. Read only the sections a brief points to. plan/DECISIONS-from-Carlos.md and the briefs win over research.

## Rules
1. Small slices to main. Before push: typecheck, lint, build, unit + e2e. After push: check the Vercel deploy and smoke-test changed pages at 390×844. If production breaks: revert first, fix second.
2. No unused code. When a change leaves a route, component, message key, email, test, env var, config or table unused, delete it in the same brief. Drop a table only after the owner confirms it holds no open records.
3. Migrations run through the deploy pipeline (from brief 01 on), never by hand in the Neon console: scripts/migrate.mjs applies pending drizzle/ migrations in one transaction before `next build`, on production builds only. A drop/rename/delete needs a `-- destructive-ok: <reason>` line in the file, or the deploy stops.
4. Business data the owner edits (prices, bundles, hours, photo counts, offers) lives in the database. Never hardcode it.
5. Meta gets parent contact data only, hashed (em, ph, fn, ln, ct, st, zp, country, external_id), plus fbp/fbc/IP/user agent. Never baby names, ages, notes or photos. Never send secret-token URLs (pay, cancel, reschedule, prepare, unsubscribe links) to the Pixel.
6. The repo is public. Never commit plan/, research, ad strategy, competitor names, customer data, secrets or .env* (except .env.example).
7. Customer text lives in messages/*.json; EN and ES change together. Spanish copy from a brief is a draft for a native reviewer: ship it and list it in STATE.md for review.
8. Don't invent business facts (reviews, counts, credentials, guarantees). If one is missing, leave the slot out and ask.
9. Styling: new UI uses Tailwind utilities with tokens only (no raw hex/px). Never mix a module class and utilities on one element. During brief 07, follow its slice rules.
10. Security patch releases (npm audit high/critical, Next.js patches): apply without waiting, as their own slice.
11. Stage exact paths (never git add -A). Conventional Commits.
12. Ask the owner before: a new paid service, changing legal wording (waiver, privacy, terms, consent), or anything the current brief doesn't cover.

## Where things are
app/(site) public pages · app/(admin) owner area · app/api routes · features/<feature> UI · lib/<domain> logic · emails/ templates · config/ constants only · drizzle/ migrations.

## End of session
Replace docs/STATE.md (≤ 1 page: live / in progress / next brief / waiting on owner). Add one line to docs/DECISIONS.md for any new decision. Reply to the owner in 3–5 plain lines, then:
- the numbered steps he must do before the next session, including any plan/OWNER-ACTIONS.md items that are now due;
- a 3-line summary for Carlos, under the heading "Send this to Carlos".
