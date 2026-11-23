# Decisions
One line per standing decision: `date · decision · source`. Newer lines win. History: docs/archive/.

## Booking path
- 2026-11-14 · One booking path: /book (+ /es); every page, ad, menu and "Not born yet?" link goes there · Carlos
- 2026-11-14 · /book: When (day + time, or due date; bundle preselected; twins) → Your details (first name, mobile, email, ZIP; consent unticked; no review) → Request sent · Carlos
- 2026-11-14 · Request first: nothing paid in the flow; the owner confirms by text and sends the $50 pay link · Carlos
- 2026-11-14 · A "Baby is here" request holds its slot 12 h; once confirmed, the 48 h owner hold and pay link take over · Carlos
- 2026-11-14 · Due-date $50: if the session can't happen, the parent chooses a refund or moving it to a later session · Carlos
- 2026-11-14 · /quick and /due-date (+ /es) retired, no redirects, code deleted · Carlos
- 2026-11-15 · Due-date deposits pay at /pay?d=; Not born yet → /book?when=due · brief 04
- 2026-11-15 · Ad page bundles: on in /admin, cheapest first · brief 05
- 2026-11-21 · /bundles shows the same bundles as home and the ad page, cheapest first · brief 05
- 2026-11-16 · Trip days: 70+ mi takes the day (same trip ≤30 mi; next day from 12 PM), no /admin · owner
- 2026-11-21 · Session timing: best days 5–14, up to 4 weeks; a due date moves into days 5–14 · Carlos
- 2026-11-22 · Pay link: the $50 first; home, ages, backdrops after (#22); both reminders ask till saved · Carlos
- 2026-11-14 · Delete what the new path leaves unused · Carlos
- 2026-11-14 · Requests may share a minute, bookings never · brief 02
- 2026-11-14 · "Questions? Text us" (sms:) is a secondary link; it fires Contact, not a booking path · Carlos
- 2026-11-21 · /book bundles: a radio group, one row each on phones, "Most loved" badge on the border; screen 2 is a form · Carlos
- 2026-11-21 · Ad page: no menu (plain logo, EN | ES only); no eyebrows on public pages · Carlos

## Tracking
- 2026-11-14 · Meta's checkout-start event is retired: nothing fires when /book merely opens · Carlos
- 2026-11-14 · Lead fires when a request is saved (browser + CAPI, shared event_id, once per person per 30 days); the optimization event · Carlos
- 2026-11-14 · Every request saves full attribution (first/last touch, Meta ad ids, fbp/fbc/IP/UA); bookings link to it · Carlos
- 2026-11-14 · Schedule = the booking event: pay-link deposit paid or owner marks booked; reuses the request's match data · Carlos
- 2026-11-14 · Nothing-to-pay Schedule: action_source chat · brief 03

## Offer
- 2026-11-14 · Focus: in-home newborn sessions, bookable before birth by due date; milestones later, for existing families · Carlos
- 2026-11-14 · Three newborn tiers, middle one "Most loved" and highlighted; prices, hours, setups, photos set in /admin; no % discounts · Carlos
- 2026-11-14 · Service area: Miami first; travel across Florida up to Orlando, the fee shown before paying · Carlos
- 2026-10-06 · Free return visit if the baby can't settle · owner
- 2026-10-06 · FAQ safety: warm room, clean hands, no unsupported poses (composites), parent within arm's reach, no fragrance · owner
- 2026-10-07 · Ages: newborns up to 2 years for now · owner
- 2026-10-08 · Extra baby: price, time, photos, maximum in /admin; offers and codes never apply to it · owner
- 2026-10-07 · Payment: card only, Stripe Checkout created by the site for the exact booked amount · owner
- 2026-10-07 · Cancel and reschedule share one notice setting in /admin, for new bookings only · owner
- 2026-10-07 · Galleries and prints: Pixieset · owner

## Build
- 2026-11-14 · Keep the custom site, trimmed · Carlos
- 2026-11-14 · Admin: 5 screens (Today/This week, Requests, Availability, Prices, Settings with the theme picker) · Carlos
- 2026-11-14 · Tailwind v4 migration, tokens first, after the cuts · Carlos
- 2026-11-14 · Texting stays manual until a business line, carrier registration and lawyer-approved consent · Carlos
- 2026-11-14 · Spanish stays live; fix the /es defects · Carlos
- 2026-11-14 · Seasonal themes stay: one theme = one data entry (colors, logo overlay, hero photo), switched by hand · Carlos
- 2026-11-14 · Migrations run in the production build; a failure stops the deploy · brief 01
- 2026-11-14 · Failure alerts + daily health email → ALERT_EMAIL (support@) · owner
- 2026-10-15 · /admin keeps the chalkboard design, no light/dark mode · owner
- 2026-10-22 · Chalk drawings: always whole, never on letters, buttons or photos · owner
- 2026-11-09 · Empty Spanish fields fill from the English on save (owner marketing text, never family data) · owner
- 2026-11-10 · Shoot videos are links that play in the site's own player; no video uploads · owner
- 2026-11-11 · A signed photo release is never edited or deleted; new wording = a new version. Bundles with siblings get the family release · owner
- 2026-11-16 · Home = ad page + own title; portfolio = /portfolio · owner
- 2026-11-13 · Customer wording never says we're shooting elsewhere; a closed day is "not available" · owner
- 2026-11-19 · Leads: opens on Confirmed; Past after 10 days; emails + delivery · owner
- 2026-11-19 · DMs: prefilled booking link · owner
- 2026-11-19 · Pay link: baby's age required (11-20); boy/girl optional, required on link form · owner
- 2026-11-20 · Day-before "Before we arrive" steps; photo extras after the session (RAW too) · owner
- 2026-11-11 · Valentine's theme Feb 1 – Mar 1 yearly, switched by hand · owner
- 2026-11-21 · Carlos builds the site; "ask the owner" means ask Carlos · Carlos
- 2026-11-21 · Chalk intro only on home, once per visitor; entrance animations never fade out · brief 05
- 2026-11-21 · Seasonal offer boxes are cut from public pages (#26); /admin Seasonal goes in brief 06 · Carlos
- 2026-11-14 · Confirmed requests book with the ZIP; the rest comes on /backdrop · brief 02
- 2026-11-14 · "Text me" wording owner-approved (no lawyer); release signed at the session · owner
