# Tiny Humans website

Newborn & baby photography website. Next.js 15 (App Router) + TypeScript + React 19.
Two pages:

- **`/`** – hero + portfolio feed, with "Book a memory like this one" prompts between photo groups
- **`/book`** – the bundles (header "Bundles" and "Book" both go here)
- **`/book/schedule?bundle=<id>`** – the booking calendar for the chosen bundle (Date → Time → Details → Review), with a "Change bundle" link back

The header (and the logo intro) lives in the root layout, so moving between pages never replays the intro. A reload or first visit does.

## Run locally

Requires Node.js 18.18+ (Node 20 or 22 recommended).

```bash
npm install
cp .env.example .env.local   # BOOKING_PROVIDER=mock works with no other values
npm run dev
```

Open http://localhost:3000. Refresh the page to replay the chalk logo intro. In mock mode the whole site, including booking, works without any credentials.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (what Vercel runs) |
| `npm start` | Serve the production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run build:static` | Static export to `out/` for the click-through prototype (temporarily sets `app/api` aside; not used by Vercel) |
| `npm run db:generate` | Create a SQL migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (Neon) |
| `npm run db:studio` | Browse the database locally (Drizzle Studio) |

## Deploy

Push to GitHub and import the repo in Vercel, then follow **Owner area → One-time setup** below to enable theme switching and photo management.

## What is mocked

- **Portfolio photos are placeholders** (`public/portfolio/`), replaceable from `/admin`.
- **The click-through prototype** (single HTML file) always uses the in-browser mock booking provider. Nothing is saved or sent.
- **`BOOKING_PROVIDER=mock`** (the default) uses mock availability on the server too: closed Sundays, some days fully booked, fewer slots for longer bundles. The confirmation clearly says no calendar event or email was created.
- **`BOOKING_PROVIDER=outlook`** is the real system (Outlook Calendar + Outlook email via Microsoft Graph, stored in Neon). It needs the credentials below; until they exist it refuses bookings with a friendly message rather than pretending.

## Where to change things

| What | File |
| --- | --- |
| Bundle names, prices, features, buttons | `config/bundles.ts` |
| Baby-led session note (booking page) | `config/site.ts` (`babyLedNote`) |
| Instagram link, contact email (footer) | `config/site.ts` (`social`, `contact`) |
| Privacy Policy and Terms of Service text | `config/legal.ts` |
| Portfolio photos | **/admin** (or the built-in defaults in `config/portfolio.ts`) |
| "Book a memory like this one" prompt text | `config/portfolio.ts` (`portfolioCtas`, `portfolioCtaLabel`) |
| Hero text, section titles, intro timing | `config/site.ts` |
| Navigation | `config/site.ts` (`navigation`) |
| Home-session note, baby ages, booking window | `config/booking.ts` |
| Live theme | **/admin** |
| Theme colors, logos, decorations | `config/themes.ts` |

### Replacing portfolio photos

Drop real images into `public/portfolio/`, then update `config/portfolio.ts` with each file's path, real width/height and a short alt text. `next/image` handles optimization on Vercel.

## Home sessions

Tiny Humans brings the studio to every family's home, so there is no location choice. Families pick a bundle on `/book`, then book on `/book/schedule` (**Date → Time → Details → Review**); the details step collects the home address (street, city, ZIP), which appears on the review step and is passed to the booking provider as `address`. The promise appears under the hero text (`site.hero.promise`) and on every bundle card. Steps are referenced by name (`STEP` in `config/booking.ts`), so the flow can change without renumbering.

## Phone preview

`npm run build:static` plus the prototype tooling produces a single-file phone preview: the real site inside iPhone, iPhone Pro Max, small Android and iPad frames, at true size, so the phone layout can be checked from a desktop browser. On a real phone, just open the site.

## Footer and legal pages

The footer (`components/Footer`) has three parts: **The fine print** (Privacy Policy at `/privacy`, Terms of Service at `/terms`), **Follow us** (Instagram) and **Contact us** (shows "Email coming soon" until `site.contact.email` is set).

The legal text lives in `config/legal.ts` as plain sections, so it can be edited without touching layout code. It is a starting draft for a small Florida photography business: have it reviewed before launch, and update `lastUpdated` when it changes.

## Entrance animations

`components/Reveal` wraps headings, photos, prompts, bundle cards and the booking panel.

- **When a page opens**, whatever is on screen is chalk-drawn once: a soft chalk wipe plus chalk frames drawing their lines.
- **While scrolling** (up or down), elements simply fade in as they enter the screen and fade out as they leave. Nothing is redrawn.

Wrap any new element in `<Reveal>` to get the same behavior. Fade timing lives in `components/Reveal/Reveal.module.css`. Skipped entirely for reduced motion.

## "Book a memory like this one"

Each prompt links to `/book?inspiration=<photo id>` (the bundles page). The photo stays attached when a bundle is chosen (`scheduleHref` in `config/booking.ts`). It shows in a banner on the bundles page, next to the chosen bundle on the calendar page, on the review step and on the confirmation, and passes `inspirationPhotoId` to the booking provider (so the real backend can include it in the calendar event).

## Owner area (/admin)

A private page for the owner, not linked anywhere on the site. Sign in with one password to:

- **Switch the website theme**: Original, Thanksgiving, Christmas or New Year. This changes the logo, the opening animation, accent colors and decorations everywhere. Visitors see it on their next page load; no redeploy needed.
- **Switch the portfolio pictures**: Original, Thanksgiving, Christmas and New Year picture sets. Choosing a set (e.g. "Christmas Pictures") swaps every portfolio photo on the site, including the hero. It is chosen separately from the theme and never changes automatically.
- **Edit any picture set**: add, replace, reorder, rename and remove photos. A seasonal set can start as a copy of the Original pictures, so you only replace the ones you want. Photos are resized in the browser (max 2000px) before upload.

### One-time setup on Vercel

1. **Storage:** in your Vercel project, open *Storage → Create → Blob*, and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
2. **Password:** in *Settings → Environment Variables* add:
   - `ADMIN_PASSWORD`: the owner password
   - `ADMIN_SESSION_SECRET`: a long random string (at least 16 characters), e.g. from `openssl rand -base64 32`
3. Redeploy once. Then visit `https://your-domain/admin`.

Until storage is connected the site uses the built-in defaults, and the owner area explains what's missing.

### How it works

- `lib/settings/server.ts` stores a small settings file (live theme, live picture set, and every picture set) in Vercel Blob. Uploaded photos no picture set uses any more are deleted automatically. Public pages read it through a tagged cache; saving calls `revalidateTag`, so pages update without a rebuild.
- `lib/admin/auth.ts` checks the password and issues a signed, httpOnly session cookie (7 days). Every owner API route (`app/api/admin/*/route.ts`) verifies it on the server.
- API routes are standard App Router `route.ts` files. The static prototype build (`npm run build:static`, see `scripts/build-static.mjs`) temporarily sets `app/api` aside, since API routes can't be statically exported; it never affects `npm run build`.
- In the prototype (`npm run build:static`) the owner area saves to the browser instead (`lib/admin/client.ts`), password `tinyhumans`.

## Seasonal themes

`config/themes.ts` defines `default`, `thanksgiving`, `christmas` and `newYear`. Each theme sets:

- **Logo:** transparent layers in `public/brand/<theme>/` (sun, rays, cloud, decor, text) and chalk-drawing data in `config/logo/<theme>-drawing.ts`. The opening animation draws sun, rays and cloud, then the seasonal decorations, then the lettering, in the same 3.5 seconds.
- **Accent colors:** `--accent`, `--accent-2`, `--accent-3` (photo tape, doodles). The green board stays the same.
- **Decorations:** the doodles beside section headings, in the hero, on bundle cards and prompts, plus chalk doodles in the page margins on wide screens.
- **Board drawings:** little chalk drawings around the hero, headings, booking prompts, bundle cards and the baby-led note (`decorations.board`). Each theme supplies a palette of six drawings; one shared layout (`boardFrom` in `config/themes.ts`) places them in spots that never cover photos, text or buttons. They sketch themselves once, the first time they scroll into view (`components/BoardDoodles`).
- **Medium drawings for empty spots:** when a portfolio row isn't full (e.g. two photos per row on tablets, leaving a gap beside the third photo), the gap gets a medium chalk drawing from the theme (`decorations.scenes`, `components/BoardDoodles/BoardScene.tsx`).

To add a future theme, add its logo layers + drawing data and a new entry in `themes`. The owner area picks it up automatically.

## The logo intro

- The official logo is split into four transparent layers in `public/brand/default/`.
- `components/TinyHumansLogo` reveals each layer through SVG masks whose chalk strokes animate with `stroke-dashoffset`. Pure CSS + SVG, no animation library.
- `components/Header/useIntroAnimation.ts` positions the header logo large in the center, lets it draw (~2.4s), then transitions the same element into the header (~1.1s). There is only ever one logo element.
- Plays on first visit and every reload, never when moving between sections. Respects `prefers-reduced-motion` (skips the drawing, quick move). Without JavaScript the page simply shows normally.

## Scrolling to the booking box

`lib/scroll/booking.ts` (`scrollToBooking`) scrolls so the whole booking box is visible, bottom border included, without hiding its top under the header. It runs when a family arrives on the calendar from a bundle's "Choose …" button. The chosen bundle sits above the box so the box fits on one screen.

## Booking system (production architecture)

```
Browser (booking form)                 Server (Vercel functions)
  lib/booking/index.ts  ──fetch──▶  app/api/booking/availability   ─┐
  HttpBookingClient                 app/api/booking/create          ├─▶ lib/booking/server.ts
                                    (Zod validation, friendly errors)│     BOOKING_PROVIDER
                                                                     │     ├─ mock    → MockBookingProvider
                                                                     │     └─ outlook → OutlookBookingProvider
                                                                     │          ├─ Microsoft Graph (lib/microsoft/*)
                                                                     │          │    calendar: busy times, create/move/delete events
                                                                     │          │    mail: confirmation from hello@tinyhumans.photography
                                                                     │          └─ Neon PostgreSQL (lib/db/*, Drizzle ORM)
```

- `lib/booking/types.ts`: `BookingClient` (what the form uses) and `BookingProvider` (adds `cancelBooking`, `rescheduleBooking`).
- `lib/booking/mock-provider.ts`, `lib/booking/outlook-provider.ts`: the two providers.
- `lib/booking/availability.ts`: real-calendar slot engine (business hours, lead time, booking window, travel buffers).
- `lib/booking/validation.ts`: Zod schemas. The server takes the price and session length from `config/bundles.ts`, never from the browser.
- `lib/booking/templates.ts`: calendar event text and the confirmation email (inline styles, table layout for Outlook/mobile).
- `lib/microsoft/`: `auth.ts` (client-credentials token, cached server-side), `graph.ts`, `calendar.ts`, `mail.ts`, `config.ts`.
- `lib/db/`: `schema.ts` (bookings table), `client.ts` (Neon HTTP driver). Migrations live in `drizzle/`.
- `lib/log.ts`: structured server logs (Graph auth, calendar, database, email failures). Secrets and tokens are never logged.
- `config/booking.ts`: **booking rules** (time zone `America/New_York`, business hours, minimum lead time, booking window, start times per session length, slot interval, travel buffers).

### Booking provider modes

| | `BOOKING_PROVIDER=mock` (default) | `BOOKING_PROVIDER=outlook` |
|---|---|---|
| Availability | Mock (deterministic) | Outlook calendar of `OUTLOOK_CALENDAR_USER` + active bookings in Neon, minus travel buffers |
| Booking saved | No | Yes, in Neon |
| Calendar event | No | Yes, in Outlook |
| Confirmation email | No | Yes, from `OUTLOOK_MAILBOX` |
| Needs credentials | No | `DATABASE_URL`, `MICROSOFT_*` |

### What happens when a family books (outlook mode)

1. The request is validated on the server (Zod).
2. Availability is re-checked against the live calendar and Neon.
3. The booking is saved in Neon as `pending` (a unique index stops two active bookings at the same start time; a `request_id` stops double-clicks creating duplicates).
4. The Outlook event is created (Graph `transactionId` makes retries safe). **If this fails, the pending booking is deleted**, so nothing ever looks confirmed without a calendar event.
5. The event id is saved and the booking becomes `confirmed`. If that save fails, the event is deleted again.
6. The confirmation email is sent through Graph. **If the email fails, the booking stays confirmed** and the failure is recorded (`confirmation_email_sent = false`, `confirmation_email_error`). The family is told their session is booked and an email will follow.
7. The browser receives the booking reference (e.g. `TH-20261005-4821`).

Calendar event subject: `Tiny Humans - {Package} - {Parent name}`. The body holds the reference, contact details, baby details, package, price, address, inspiration photo and notes.

To find bookings whose email didn't go out (until the admin booking list exists), run in the Neon SQL editor:

```sql
select booking_reference, parent_name, email, confirmation_email_error
from bookings where status <> 'cancelled' and confirmation_email_sent = false;
```

## Environment variables

See `.env.example`. Add the same names in Vercel (Production, and Preview if wanted).

| Variable | Where | Purpose |
|---|---|---|
| `BOOKING_PROVIDER` | server | `mock` or `outlook` |
| `DATABASE_URL` | server | Neon pooled connection string |
| `MICROSOFT_TENANT_ID` | server | Entra tenant (directory) ID |
| `MICROSOFT_CLIENT_ID` | server | Entra app (client) ID |
| `MICROSOFT_CLIENT_SECRET` | server | Entra client secret **value** |
| `OUTLOOK_MAILBOX` | server | Sends confirmations: `hello@tinyhumans.photography` |
| `OUTLOOK_CALENDAR_USER` | server | Calendar that holds sessions: `hello@tinyhumans.photography` |
| `NEXT_PUBLIC_SITE_URL` | public | `https://www.tinyhumans.photography` (links in emails, metadata) |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | server | Owner area |
| `BLOB_READ_WRITE_TOKEN` | server | Theme + photos storage |

Only `NEXT_PUBLIC_SITE_URL` is visible in the browser. Microsoft secrets and the database URL are only read in server code (`server-only` modules).

## Neon database setup

1. Create a Neon project (region close to Vercel's, e.g. US East). Copy the **pooled** connection string.
2. Locally, put it in `.env.local` as `DATABASE_URL=...`.
3. Apply the migration (creates the `booking_status` type and the `bookings` table; nothing is dropped):

```bash
npm run db:migrate
```

Alternative: paste `drizzle/0000_create_bookings.sql` into the Neon SQL editor and run it once.

When the schema changes later: edit `lib/db/schema.ts`, run `npm run db:generate` to create a new migration file, review it, then `npm run db:migrate`. Never run destructive migrations against production without a backup/branch (Neon branches make this easy).

## Microsoft Entra app setup

1. In the Microsoft Entra admin center: **App registrations → New registration**. Name: `Tiny Humans Website`. Supported account types: *this organizational directory only*. No redirect URI needed.
2. Copy the **Application (client) ID** → `MICROSOFT_CLIENT_ID`, and **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`.
3. **Certificates & secrets → New client secret.** Copy the secret **value** (shown once) → `MICROSOFT_CLIENT_SECRET`. Note its expiry date and rotate it before then.
4. Add the Graph permissions below and grant admin consent.
5. Restrict the app to the Tiny Humans mailbox (see below).

The website authenticates with the **client-credentials flow** (app-only). Tokens are requested and cached only on the server; nothing Microsoft-related reaches the browser.

## Microsoft Graph permissions

**API permissions → Add a permission → Microsoft Graph → Application permissions:**

| Permission | Used for |
|---|---|
| `Calendars.ReadWrite` | Reading busy times; creating, moving and deleting session events |
| `Mail.Send` | Sending confirmation (and later reminder) emails |

These are application permissions, so **a Global Administrator must click "Grant admin consent"**. Do not assume consent exists until the status column shows a green check.

**Scope access to the Tiny Humans mailbox.** By default, application permissions apply to every mailbox in the tenant. Limit them to `hello@tinyhumans.photography` with Exchange Online (RBAC for Applications is Microsoft's current recommendation; the older Application Access Policy also works):

```powershell
# RBAC for Applications (Exchange Online PowerShell), outline:
New-ServicePrincipal -AppId <MICROSOFT_CLIENT_ID> -ObjectId <enterprise-app-object-id> -DisplayName "Tiny Humans Website"
New-ManagementScope -Name "Tiny Humans mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'hello@tinyhumans.photography'"
New-ManagementRoleAssignment -App <MICROSOFT_CLIENT_ID> -Role "Application Calendars.ReadWrite" -CustomResourceScope "Tiny Humans mailbox"
New-ManagementRoleAssignment -App <MICROSOFT_CLIENT_ID> -Role "Application Mail.Send" -CustomResourceScope "Tiny Humans mailbox"
```

When using RBAC for Applications, the scoped Exchange role assignments replace the tenant-wide Entra grants for these permissions (remove the broad Entra consent once the scoped roles work). Test with `Test-ServicePrincipalAuthorization`. Check Microsoft's current documentation before running these, as names and steps change over time.

## Outlook Calendar integration

- Availability reads `GET /users/{OUTLOOK_CALENDAR_USER}/calendarView` for the requested dates. Anything marked busy/tentative/out-of-office blocks time; events marked **Free** and cancelled events don't. Personal blocks (e.g. "Day off") placed on that calendar automatically close slots.
- Each candidate start time (from `config/booking.ts`) must be at least `minimumLeadTimeHours` away, inside business hours, and clear of busy time plus `sessionBuffers` (travel/setup before and after).
- New sessions are created with `POST /users/{user}/events` in the `Eastern Standard Time` zone, shown as Busy, category "Tiny Humans", reminder 2 hours before.
- `rescheduleBooking` moves the event (`PATCH`); `cancelBooking` deletes it. They're ready for the future admin booking screens (no public routes yet).

## Outlook email integration

- `POST /users/{OUTLOOK_MAILBOX}/sendMail`, saved to Sent Items; replies go to the mailbox.
- Template: `confirmationEmail()` in `lib/booking/templates.ts`. Brand colors, inline styles, table layout, no external CSS. The header logo loads from `${NEXT_PUBLIC_SITE_URL}/brand/default/logo-full.jpg`, so set the real site URL in production.
- Reminders can reuse `sendMail` plus a scheduled job (e.g. Vercel Cron) later.

## Vercel deployment

1. Push to GitHub and import the repository in Vercel.
2. Add all environment variables from the table above (start with `BOOKING_PROVIDER=mock`).
3. Connect the Blob store (owner area) and run the Neon migration.
4. Deploy, check the site, then switch to `BOOKING_PROVIDER=outlook` once Microsoft and Neon are set up, and redeploy.
5. Add the domain `www.tinyhumans.photography` in Vercel when ready (DNS changes are done at the domain registrar).

## Mock mode vs production mode

- **Mock (`BOOKING_PROVIDER=mock`)**: safe default for development and previews. The UI is identical; the confirmation says it's a preview.
- **Production (`BOOKING_PROVIDER=outlook`)**: real availability, real bookings, real emails. If something isn't configured, families see "Online booking isn't available right now. Please email hello@tinyhumans.photography" and the server log says exactly what's missing.
- The single-file prototype is always mock.

## Project structure

```
app/            layout (settings, theme, header, footer), page (home), book/, admin/, api/admin/*, api/booking/*
components/     Header (+ intro), TinyHumansLogo, Hero, Portfolio, PortfolioLightbox,
                PortfolioCta, Reveal, Bundles, BundleCard, Booking, ChalkBox, ChalkButton, ChalkDoodle, ...
config/         site, bundles, portfolio, booking, themes, logo drawing data
lib/booking/    contracts, mock + Outlook providers, slot engine, validation, templates, HTTP client
lib/microsoft/  Microsoft Graph: auth (client credentials), calendar, mail
lib/db/         Neon + Drizzle: schema, client (migrations in drizzle/)
lib/settings/   site settings (theme + photos): validation, Vercel Blob storage
lib/admin/      owner login (server) and owner-area API client
lib/chalk/      hand-drawn shape helpers
public/         brand (logo layers), portfolio (placeholders), textures (chalk + board)
styles/         globals.css (theme-variable based)
```

## Performance notes

Scrolling was profiled with Chrome tracing (CPU slowed 4× to mimic a phone):

- **Chalk grain on drawn lines** comes from a small texture mask (`.chalk-grain` in `styles/globals.css`), not a live SVG noise filter. The old `feTurbulence` filter was the biggest scroll cost; please don't reintroduce it on large elements.
- Groups of board doodles share **one** grain mask (on their layer), and doodles inside already-chalked text skip their own (`grain={false}` on `ChalkDoodle`).
- Fading sections keep their own GPU layer (`will-change: opacity` in `Reveal.module.css`), so fades don't repaint them.

Result on the home page: drawing (raster) work while scrolling down ~60%, total rendering work roughly halved, with the same look.

## Fonts

Schoolbell (headings, chalk lettering) and Patrick Hand (small text), both SIL Open Font License, self-hosted via `next/font/local` in `app/fonts/`.

