# Shoots: build spec for the owner area (/admin/shoots), v3.3 (simple + photo waiver)

Owner request (Adrian, Nov 9, 2026, final direction): keep it simple. **No timeline, no setups, no times to
plan.** Every booking gets a **shoot folder** with the family's info, what they asked for, the **inspo** (what
the family sends + our own) and our **BTS on phones** ideas. Each item gets a short description ("What's the
shot?") and is ticked off at the shoot. The **day sheet** shows, for that date: Who's on camera, Still to confirm,
each family's info + inspo + BTS ideas, and **What to bring** (backdrops from the bookings, extras, studio kit,
camera gear, wardrobe, plus any sections the owners add). Owner's words: "We drop the inspos and that's it" / "we know exactly which ones we're
doing, and we can mark whenever we're done."

**Build it in Next.js, inside the existing site and admin** (App Router, TypeScript, React components, CSS
modules, the chalk UI primitives, Drizzle + Neon, Vercel Blob), as normal pages and API routes of this project.

**Visual + behavior reference only:** `docs/shoots/shoots-template.html` (v3). Open it in a browser; it's a
working, self-contained prototype with sample families, made only to show the result. Match its layout, wording
and interactions. Do **not** copy its code into the project, do not serve the HTML file, and don't reuse its
vanilla JS or its localStorage state: everything is rebuilt as Next.js components with data saved in the database.

**What it must not change:** the public website, the booking flow, prices, emails, tracking and the existing
admin sections keep working exactly as they do. The only touches outside the new Shoots code are: one menu entry
in the admin nav, an "Open shoot folder" button in Leads, a Blob cleanup step when a lead is deleted, a new
rate-limit rule, new database tables (no change to the existing tables), and for the photo waiver (§10): the
lead's "Photo use" row + `booking_consents` update, and a privacy policy update (owner approval).

Follow CLAUDE.md, PROGRESS.md and the universal website workflow: small slices, tests after each one, PROGRESS.md
updated after each one, no push / migration on production / new paid usage without the owner's OK in chat.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Who sees it | Owner area only (Adri + Alo) |
| Timeline / setups / times | **None** (owner, Nov 9). Only the booking's session time is shown as info |
| Per family | Info from the booking, "What the family asked for", **Inspo** (family's + ours), **BTS on phones** (our ideas), Still to confirm, Bring extra |
| Each inspo / idea | Photo, video, link or text-only; one description field; one tick on the day sheet. **No "Goes with"** |
| Drop zone + paste a link | Exactly as in the template |
| What we always bring | **Sections the owners name and fill** (start: Studio kit, Camera gear, Wardrobe); "+ Add a section" (e.g. "Christmas props"), rename, remove. Backdrops come from each booking |
| Photo waiver | Parents sign a photo and video release **on the iPad, inside the admin**, per booking (§10). Signing updates the lead's "Photo use" |
| Shoots without a booking | Supported ("+ Shoot without a booking": title, day, start, place) |
| Videos | Links first; video uploads only after the owner approves Blob cost (§5) |
| Standard list contents | The template's lists are a draft; the owners edit them on "What we always bring" |

## 2. Where it lives

- `features/admin/nav.ts`: add `"shoots"` to `AdminSection` and an `ADMIN_NAV` entry **right after Leads**:
  `{ id: "shoots", label: "Shoots", href: "/admin/shoots", blurb: "Every shoot: the family's inspo and our BTS ideas, ticked off at the shoot." }`
- Pages (same pattern as `app/(admin)/admin/leads/page.tsx`, `robots: noindex`), sub-tabs **Shoot days | What we
  always bring**:
  - `app/(admin)/admin/shoots/page.tsx`: shoot days (coming up / done)
  - `app/(admin)/admin/shoots/bring/page.tsx`: What we always bring
  - `app/(admin)/admin/shoots/[date]/page.tsx`: day sheet (`YYYY-MM-DD`, studio time zone)
  - `app/(admin)/admin/shoots/folder/[id]/page.tsx`: a shoot's folder (`id` = shoot uuid, or
    `b-<bookingReference>` for a booking with no row yet; the row is created on first save)
  - Extend `AdminApp` the way the other sections work (e.g. a `view` prop) instead of a second shell.
- Components: `features/shoots/` (`ShootsList.tsx`, `BringLists.tsx`, `DaySheet.tsx`, `ShootFolder.tsx`,
  `InspoDrop.tsx` (used twice: inspo and BTS), `InspoLightbox.tsx` + `.module.css`). Respect the feature-import
  rule in CLAUDE.md.
- Logic: `lib/shoots/` (`types.ts`, `server.ts` (`import "server-only"`), `from-bookings.ts`, `lists.ts`
  (defaults), `validation.ts` (zod), `ticks.ts`, `sunset.ts`, `links.ts`).
- Leads: each lead that isn't cancelled gets an **"Open shoot folder"** button in `LeadsPanel`.

## 3. What a booking feeds in (`lib/shoots/from-bookings.ts`)

Bookings with status `pending`, `confirmed` or `rescheduled` appear automatically (no row until the first edit).
Cancelled bookings never show on a day sheet. Reschedules move the shoot to the new date.

| Shown | From |
|---|---|
| Title ("The Morales family"), tab label ("Morales") | `parentName` (last word), editable |
| Session time, date | `sessionStart` / `sessionEnd` in `timezone` (info only) |
| Bundle chip ("Our Little Story · 2 h · 2 backdrops"), who's in the photos | the booked bundle (`durationMinutes`, `setupsOf()`, `people`) |
| Babies + ages (Who's on camera) | `babyName`/`babyAge` + `booking_babies` |
| Backdrops | `booking_backdrops.picks`; fewer picks than the bundle allows → automatic "Still to confirm" line |
| Booked add-ons | `booking_addons` → chips + "What to bring" |
| Their pick when booking | `inspirationPhotoId` → site photo |
| What the family asked for | prefilled from `notes`, then editable |
| Address + Map link, reference, deposit status | `locationAddress`, `bookingReference`, deposit fields |

## 4. Data model (new migration, e.g. `drizzle/0023_shoots.sql`; check the next free number)

Separate tables so a missing migration can never break bookings: on `isUndefinedTable` the Shoots page shows
"Run the shoots migration" (same pattern as passkeys / session epoch).

- `shoot_bring_sections`: `id` uuid, `name` text, `items` jsonb string[], `sort` int, `updated_at`. Seeded with
  Studio kit, Camera gear, Wardrobe (Adri and Alo) from `lib/shoots/lists.ts` the first time the page loads.
- `shoots`: `id` uuid, `kind` (`booking` | `styled`), `booking_id` uuid **unique** nullable FK `bookings.id` **on
  delete cascade**, `date`, `start_time` / `place` (styled only), `title`, `tab_label`, `said`, `confirm` jsonb
  string[], `bring_extra` jsonb string[], `created_at`, `updated_at`.
- `shoot_inspo`: `id`, `shoot_id` FK cascade, `group` (`inspo` | `bts`), `type` (`image` | `video` | `link` |
  `note`), `blob_url`, `blob_pathname`, `content_type`, `bytes`, `width`, `height`, `link_url`, `platform`,
  `caption`, `sort`, `created_at`.
- `shoot_ticks`: `date`, `key` text, `ticked_at`, PK `(date, key)`. Keys: `inspo:<id>` and
  `bring:<date>:<sectionId>:<hash of the item>` (backdrops `bring:<date>:bd:<shootId>:<backdropId>`, extras
  `bring:<date>:<shootId>:<hash>`). "Clear all ticks" deletes by date.
- Deleting a lead or a styled shoot must also delete its Blob files.

Owner step: run the SQL in the **Neon SQL editor on a dev branch first**, then production once approved. Give
him the exact steps and the expected result.

## 5. Uploads (Vercel Blob)

- **Photos**: resize in the browser (long edge ≤ 2000 px) before upload, then the same checks as
  `app/api/admin/photos/route.ts` (`isAdmin`, `PHOTO_TYPES`, `matchesPhotoSignature`, size). Many at once; drag and
  drop on desktop, file picker on the phone.
- **Videos**: Vercel Functions reject request bodies over ~4.5 MB, so videos need **client uploads**
  (`@vercel/blob/client` `upload()` + a `handleUpload` token route that checks `isAdmin()`, content types
  `video/mp4` / `video/quicktime`, max size). Check the current @vercel/blob docs. **Owner approval first** (Blob
  storage/transfer can cost money); until then the folder accepts photos, links and text.
- Paths `shoots/<shootId>/<random>`, `addRandomSuffix`; never linked from public pages (inspo can include
  clients' own photos). Use private access if the installed @vercel/blob supports it. Removing an item deletes its
  blob.

## 6. API (all `isAdmin()` first, zod-validated, a new `adminShoots` rule in `lib/rate-limit.ts`)

- `GET /api/admin/shoots?from=&to=`: days with their shoots (list).
- `GET /api/admin/shoots/bring`, `POST` (new section), `PATCH|DELETE /api/admin/shoots/bring/[id]` (name, items,
  sort): what we always bring.
- `GET /api/admin/shoots/day/[date]`: everything the day sheet needs (shoots, inspo, ticks, sunset, bring lists).
- `GET|PATCH /api/admin/shoots/[id]` (said, confirm, bring_extra, title); `POST /api/admin/shoots` (styled shoot,
  or the row for a booking); `DELETE` (styled only).
- `POST /api/admin/shoots/[id]/inspo` (`group` + photo upload, `{ link }` or `{ note }`), `PATCH|DELETE
  .../inspo/[inspoId]` (caption). Video token route only after approval.
- `GET|POST /api/admin/shoots/ticks` `{ date, key, on }`; `DELETE ?date=`.

## 7. Screens (match the template)

**What we always bring:** one card per section (Section name, What to bring = one per line, "Remove this section"
with a two-tap confirm), then "+ Add a section" (adds an empty card with the name field focused). Autosave.

**Shoot days:** cards per date ("2 shoots · sunset 5:31", progress, each shoot: start time, family, bundle, "6
inspo · 3 BTS ideas" or "No inspo yet"), "Open day sheet". "+ Shoot without a booking".

**Folder:** header (date + session time, title, chips: bundle · hours · backdrops, babies + ages, who's in the
photos, backdrops, add-ons, city, reference; their pick; "Open the day sheet").
1. **Inspo for {baby names}** ("Inspo for the set" on styled shoots): drop zone, "Or paste a link", "+ A shot with
   no photo"; cards = tile + **What's the shot?** + Remove (horizontal on phones).
2. **BTS on phones**: same drop / link, "+ Write an idea (no photo)"; cards = tile + **What's the idea?** + Remove.
3. Side **Notes**: What the family asked for (prefilled from booking notes), Still to confirm (one per line),
   Bring extra (one per line). Autosave with "Saved / Saving… / Not saved, retrying".

**Day sheet (phone first):** header (date, shoots · places, "9 inspo · 4 BTS ideas · sunset", ticked + bar),
sticky chips (one per family + "What to bring"), **Who's on camera** (auto), **Still to confirm** (owners' lines +
automatic backdrop line), then per family: "Shoot 1 · 9:00 to 11:00", title, address · Map · bundle · reference,
backdrop swatches, What the family asked for + their pick, **Inspo for {names}** grid (tick on each card, caption
under it, tap a photo for full screen with prev/next and "Mark as done", link tiles open the link), **BTS on
phones** grid (same), link to the folder. **What to bring:** backdrops (with family), extras (booked add-ons +
Bring extra), then every section from What we always bring that has items, in order, all tickable; "Clear all ticks" (two taps, no `confirm()`).
**Ticks sync** between both phones: optimistic update + POST, poll the day every ~10 s while visible and on
`visibilitychange`/`focus`; on failure keep the tick and show "Not saved yet, retrying…".
Sunset from `lib/shoots/sunset.ts` (NOAA formula, Miami by default). 44 px targets, labels, keyboard and screen
reader friendly, `prefers-reduced-motion`.

## 8. Slices, tests and owner gates

1. Plan in PROGRESS.md. Schema + migration + `lib/shoots` server functions + unit tests (booking adapter, backdrop
   check, platform detection, tick keys). **Owner runs the migration on a Neon dev branch.**
2. Nav + Shoot days + What we always bring (sections: add, rename, fill, remove) + Leads button.
3. Folder: links, text items, captions, notes.
4. Photo uploads (Blob) + cleanup on remove and on lead delete.
5. Day sheet + ticks sync + lightbox + sunset + What to bring.
6. Video uploads **only after owner approval**.
7. Checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, Playwright in mock mode (sign in → open a
   booking's folder → paste a link + caption → add a BTS idea → tick on the day sheet → reload keeps it; axe on the
   pages; iPhone 14 + 1440 screenshots), `node scripts/css-ties.mjs`.
8. Owner review on his phone. **Push to `main` and the production migration only with his OK in chat.**

## 9b. Slice for the waiver

After slice 5: the photo waiver (§10): table + signing page + thank-you + signed view + Leads update + tests
(sign with a drawn signature in Playwright, check the lead's Photo use row, check the record can't be edited).

## 10. Photo waiver (signed by the parent on the iPad)

Owner request (Nov 9): "a button that says waiver signature. We click on it and then we give the iPad to the
parents so they read through it and then they sign at the bottom… whenever they click on done, show a page that
says thank you… we grab the iPad and click next at the top and we close it. And then it will automatically update
on the lead… so we have a backup… make sure we're able to preview their signature."

**The wording in the template is a draft.** Before real families sign it: (1) the owner has it reviewed by a
Florida lawyer (consent for minors' images in paid ads especially), (2) "Tiny Humans" is replaced with the legal
business name if the business is an LLC, (3) Alondra checks the Spanish. Keep the text in `lib/shoots/waiver.ts`
(or messages) with a **version string**; any wording change = new version; old signatures keep the text they
signed.

**Where the button is:** the folder (card in the side column; a compact line in the header on phones), each
family on the day sheet ("Photo waiver: not signed yet · Waiver signature" / "Photo waiver signed ✓ · Website,
IG + FB, Ads… · See it"), and Leads (the "Photo use" row + "See signed waiver"). Shoot days list shows "Waiver ✓"
or "No waiver yet". Only bookings get a waiver (not shoots without a booking).

**The signing screen** (`/admin/shoots/waiver/[bookingRef]`, admin-only, full screen, **no admin menu or links**,
so the parent can't wander into the admin):
- Top bar: Tiny Humans · "Español/English" toggle · "For Adri & Alo: Cancel" (two taps).
- Cream "paper" card: title, short intro, the family/baby/date line, **Where we may share them** (5 tick boxes:
  website + portfolio; Tiny Humans Instagram + Facebook posts, Stories, Reels; ads on Instagram + Facebook;
  behind-the-scenes videos that can show the parents and home; Adri and Alo's personal Instagram) with a **"Yes to
  all"** button and "Leave them all unticked to keep your photos private", **OK to use {baby}'s first name**,
  **What we promise**, **The fine print**, **About you** (full name, Parent / Legal guardian; no free-text "anything
  else" field: the owner removed it on Nov 9), **I've read this and I agree**, **Sign here with your finger** (canvas with
  pointer events, `touch-action: none`, Clear button, redraws on rotation), today's date, **Done** (says "Done:
  keep our photos private" when nothing is ticked; if something is missing it says what, e.g. "To finish: your
  name, your signature").
- **Thank-you screen:** "Thank you, {first name}! You're all set. Please hand the iPad back to Adri or Alo." (+
  "we'll keep your photos private" when nothing was ticked) and, top right, "For Adri & Alo: **Next →**", which
  goes back to where the owners started (folder or day sheet) with a toast "Waiver saved".
- Signed view ("See signed waiver"): the same paper read-only, with ✓/✗ on every choice, name, relationship,
  the **signature image**, signed date and time, version and language. Print-friendly CSS so "Save as PDF"
  from the browser gives a clean copy (a generated PDF download can come later).
- 18 px+ text, 52 px+ touch targets, labels, works in portrait and landscape on iPad, keyboard friendly.

**Data** (new table in the same migration, never deleted by app code):
`photo_waivers`: `id` uuid, `booking_id` FK `bookings.id` **on delete set null** (the waiver is the business's
backup, so it survives a deleted lead), `booking_reference` + `family_name` + `children` (snapshots), `version`,
`language`, `text_snapshot` (the exact text and choice labels shown), `text_sha256`, `uses` jsonb
`{website, social, ads, bts, personal}`, `first_name_ok`, `signer_name`, `relationship` (`parent` |
`guardian`), `signature_png` (bytea or base64, validated PNG, ≤ 100 KB; or a private Blob), `signed_at`
(server time), `user_agent`, `status` (`signed` | `superseded` | `revoked`), `revoked_at`, `revoke_note`,
`created_at`. Signed rows are **immutable**: "Sign again" inserts a new row and marks the old one `superseded`;
no route updates a signed row's content.

**Updates the lead:** on save, upsert `booking_consents.photos = uses.website || uses.social` and `photos_at =
signed_at`. LeadsPanel's "Photo use" row shows "Waiver signed {date}: {uses}" with "See signed waiver". If the
owners later tap "Keep their photos private" on a lead with a signed waiver, mark that waiver `revoked` with the
date (the family changed their mind) and keep the row.

**API:** `POST /api/admin/shoots/waiver` (`isAdmin`, zod: booking reference, version, language, uses, names,
notes, signature PNG data URL; size + PNG signature check; rate limit), `GET /api/admin/shoots/waiver/[id]`
(signed view). Never on public routes, never in emails to anyone but the family.

**Privacy policy update (owner approved, Nov 9, 2026):** do it in the same build, English and Spanish
(`messages/en.json` + `messages/es.json`, `privacy` sections; bump the policy's "last updated" date; Alondra checks
the Spanish). The current Meta section says "We never send your baby's name, age, notes or photos to Meta or any
other advertising service." That sentence goes away because session photos can now appear in our ads. Replace, don't
just delete: the part about tracking data is still true and should stay. Suggested wording (adjust to the policy's
style):
- **"Photos of your family" section:** "Your photos belong in your family's memories first. We only use photos
  and videos from your session on this website and in our portfolio, on our social media (such as Instagram and
  Facebook) or in our ads on Facebook and Instagram if a parent or legal guardian gives us permission. At your
  session we ask you to sign a short photo and video release on our iPad, where you choose exactly where we may use
  them. We never share your last name or your address, and we never tag your location. You can change your mind at
  any time: text or email us, and we'll stop using them in anything new and take them off our website and any
  running ads within 7 days."
- **Meta section, replacing the sentence above:** "The information our website sends to Meta to measure our ads
  never includes your baby's name, age or notes. Photos or videos from your session appear in our ads on Facebook
  and Instagram only if you said yes to ads in the photo release you signed."
- The booking form's photo checkbox stays as the first signal; the signed waiver is the record that counts.

**Optional (owner OK first):** email the family a copy of what they signed (Resend; real emails), and a "Has a
signed waiver with ads ✓" filter when choosing photos for Meta ads.

## 11. Later options (each needs the owner's OK)

- Family inspo link (token page like `/backdrop?t=…`) so families add their own inspo.
- AdrocMedia: keep `features/shoots` + `lib/shoots` free of Tiny Humans-only imports except `from-bookings.ts`,
  theme tokens and chalk primitives, so the module can be copied with a new adapter.
- Link thumbnails via public oEmbed (TikTok, YouTube); print view of the day sheet.
