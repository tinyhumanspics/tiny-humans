# Tiny Humans website

In-home newborn & baby photography, Miami. Live at https://www.tinyhumans.photography.
Next.js 16 (App Router) · React 19 · TypeScript · Neon Postgres + Drizzle · Stripe · Resend · Microsoft Graph (Outlook
calendar) · Vercel Blob. Rules for coding sessions: [AGENTS.md](AGENTS.md). Current state: [docs/STATE.md](docs/STATE.md).

## Run locally

Node.js 22 (what CI uses).

```bash
npm install
cp .env.example .env.local   # BOOKING_PROVIDER=mock needs no other values
npm run dev                  # http://localhost:3000
```

In mock mode the whole site, booking included, works without credentials and creates no calendar event, email or
payment. For database work, use a Neon dev branch or `scripts/local-db` (embedded Postgres with fake Microsoft Graph,
Resend and Stripe). Never put the production `DATABASE_URL` in `.env.local`.

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (what Vercel runs) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright tests on a local production build in mock mode (never against production) |
| `npm run db:generate` | SQL migration from `lib/db/schema.ts` into `drizzle/` |

## Deploy

Vercel builds and deploys every push to `main` (GitHub Actions runs typecheck, lint, unit and e2e tests on the same
push). Check the Vercel status of the pushed commit, then look at the changed pages on the live site.

## Environment variables

Every variable is listed with a one-line comment in [.env.example](.env.example). Set real values in Vercel → Settings →
Environment Variables (Production, and Preview if needed). Only `NEXT_PUBLIC_*` values reach the browser. Never commit
real values. A new variable goes in `.env.example` with an empty value and a comment.

Older setup notes (Entra app, Graph permissions, Neon, Resend, how booking works): [docs/archive/README-2026-11.md](docs/archive/README-2026-11.md).
