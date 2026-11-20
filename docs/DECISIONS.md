# Decisions
One line per standing decision: `date · decision · source`. Newer lines win. History: docs/archive/.

## Booking path
- 2026-11-14 · One booking path: /book and /es/book. Every landing page, ad button, nav "Book" link and "Not born yet?" link goes there · Carlos
- 2026-11-14 · /book is three screens: When (day + start time, or due date; bundle preselected, changeable; twins) → Your details (first name, mobile, email, ZIP, all required; consent box unticked; "Send request" here, no review) → Request sent · Carlos
- 2026-11-14 · Request first: nothing is paid in the flow. The owner confirms by text (by hand for now) and sends the $50 pay link · Carlos
- 2026-11-14 · A "Baby is here" request holds its slot 12 h. Once the owner confirms, the owner-booking 48 h hold and pay link take over · Carlos
- 2026-11-14 · Due-date $50: if the session can't happen, the parent chooses a refund or moving it to a later session · Carlos
- 2026-11-14 · /quick and /due-date (+ /es) are retired with no redirects and their code deleted, after the link checklist in brief 04 · Carlos
- 2026-11-15 · Due-date deposits pay at /pay?d=; Not born yet → /book?when=due · brief 04
- 2026-11-15 · Ad page bundles: on in /admin, cheapest first · brief 05
- 2026-11-16 · Trip days: 70+ mi takes the day (same trip ≤30 mi; next day from 12 PM), no /admin · owner
- 2026-11-16 · Sessions after week 2; a due date moves there too · owner
- 2026-11-16 · Pay link asks the home address before the deposit · owner
- 2026-11-14 · Delete what the new path leaves unused: unfinished-booking capture and follow-ups, the in-flow Stripe deposit and its 30-min hold, the in-flow backdrop step, the in-flow discount box · Carlos
- 2026-11-14 · Requests may share a minute, bookings never · brief 02
- 2026-11-14 · "Questions? Text us" (sms:) is a secondary link on landing pages; it fires Contact and isn't a booking path · Carlos

## Tracking
- 2026-11-14 · Meta's checkout-start event is retired: nothing fires when /book merely opens · Carlos
- 2026-11-14 · Lead fires when a request is saved: browser + Conversions API with a shared event_id, once per person per 30 days. It's the optimization event · Carlos
- 2026-11-14 · Every request saves full attribution (first and last touch, Meta ad / ad set / campaign IDs from URL parameters, fbp/fbc/IP/user agent); bookings link to their request · Carlos
- 2026-11-14 · Schedule stays as the booking event: it fires when the pay-link deposit is paid or the owner marks a booking booked, and reuses the request's match data · Carlos
- 2026-11-14 · Nothing-to-pay Schedule: action_source chat · brief 03

## Offer
- 2026-11-14 · Focus: in-home newborn sessions, bookable before birth with a due date. Milestone sessions come later as a separate offer to existing families · Carlos
- 2026-11-14 · Three newborn tiers (Newborn Mini · Newborn at Home "Most loved" · Newborn & Family), middle one highlighted. Prices, hours, setups and photo counts are the owner's, set in /admin. No % discounts · Carlos
- 2026-11-14 · Service area: Miami first; the site says plainly they travel across Florida up to Orlando, and the travel fee shows before paying · Carlos
- 2026-10-06 · Free return visit if the baby can't settle · owner
- 2026-10-06 · Safety practices for the FAQ: warm room, washed/sanitized hands, no unsupported poses (composites), parent within arm's reach, no fragrance · owner
- 2026-10-07 · Ages: newborns up to 2 years for now · owner
- 2026-10-08 · Extra baby: price, time, photos and maximum set in /admin. Offers and codes apply to the bundle only, never to the extra baby · owner
- 2026-10-07 · Payment: card only, Stripe Checkout created by the site for the exact booked amount · owner
- 2026-10-07 · Cancel and reschedule share one notice setting in /admin; changes apply to new bookings only. Never hard-code the hours · owner
- 2026-10-07 · Galleries and prints: Pixieset · owner

## Build
- 2026-11-14 · Keep the custom site, trimmed · Carlos
- 2026-11-14 · Admin goes down to 5 screens: Today/This week · Requests · Availability · Prices · Settings (theme picker in Settings) · Carlos
- 2026-11-14 · Tailwind v4 migration, tokens first, after the cuts · Carlos
- 2026-11-14 · Texting is manual. Automation waits for a business texting line, carrier registration and lawyer-approved consent wording · Carlos
- 2026-11-14 · Spanish stays live; fix the /es defects · Carlos
- 2026-11-14 · Seasonal themes stay, rebuilt to be reusable: one theme = one small data entry (color tokens, optional logo overlay/decorations, optional landing hero photo), switched by hand in Settings. One photo set for the site. Seasonal offer boxes go; the one-line offer in Prices replaces them · Carlos
- 2026-11-14 · Migrations run in the production build; a failure stops the deploy · brief 01
- 2026-11-14 · Failure alerts + daily health email → ALERT_EMAIL (support@) · owner
- 2026-10-15 · /admin keeps the chalkboard design, no light/dark mode · owner
- 2026-10-22 · Chalk drawings: always whole, never on letters, buttons or photos · owner
- 2026-11-09 · Empty Spanish fields fill from the English on save (owner marketing text only, never family data); typed Spanish is kept · owner
- 2026-11-10 · Shoot videos are links that play in the site's own player; no video uploads · owner
- 2026-11-11 · A signed photo release is never edited or deleted; new wording = a new version. Bundles with siblings get the family release · owner
- 2026-11-16 · Home = ad page + own title; portfolio = /portfolio (photo wall) · owner
- 2026-11-13 · Customer wording never says we're shooting elsewhere; a closed day is "not available" · owner
- 2026-11-19 · Leads: sessions move to Past 10 days after their date · owner
- 2026-11-11 · Valentine's theme runs Feb 1 – Mar 1 each year, switched by hand by the owner · owner
- 2026-11-14 · Confirmed requests book with the ZIP; the rest comes on /backdrop · brief 02
- 2026-11-14 · "Text me" wording owner-approved (no lawyer); release signed at the session · owner
