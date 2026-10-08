import "server-only";
import { eq } from "drizzle-orm";
import type { Bundle } from "@/config/bundles";
import { portfolio } from "@/config/portfolio";
import { getDb } from "@/lib/db/client";
import { bookingConsents, type Booking } from "@/lib/db/schema";
import type { PriceQuote } from "@/lib/pricing/engine";
import { getCatalog } from "@/lib/pricing/server";
import { getSiteSettings } from "@/lib/settings/server";
import { allMediaPhotos } from "@/lib/settings/defaults";
import { depositInfoOf, depositOf } from "@/lib/deposit/server";
import { accessFor } from "./access";
import { backdropsFor } from "./backdrops";
import type { BookingDetails } from "./templates";
import type { SessionAddress } from "./types";
import { addonsFor, babiesFor } from "./addons";
import type { AddonLine, BookingBaby } from "./extra-babies";

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** Price snapshot stored on a booking (older bookings fall back to package_price). */
export function snapshotOf(row: Booking, addons: AddonLine[] = []): PriceQuote {
  const legacy = row.packagePrice * 100;
  const addonsCents = row.addonsTotalCents ?? addons.reduce((sum, a) => sum + a.totalCents, 0);
  return {
    bundleId: row.packageId,
    bundleName: row.packageName,
    regularCents: row.regularPriceCents ?? legacy,
    offerCents: row.offerPriceCents,
    offerLabel: row.offerLabel,
    offerEndsOn: null,
    discountCode: row.discountCode,
    discountCents: row.discountAmountCents ?? 0,
    finalCents: row.finalPriceCents ?? legacy,
    addons,
    addonsCents,
    totalCents: (row.finalPriceCents ?? legacy) + addonsCents,
    pricingType: (row.pricingType as PriceQuote["pricingType"]) ?? "regular",
  };
}

/** Title of the portfolio/site photo a family picked as inspiration. */
export async function photoTitle(id: string): Promise<string | undefined> {
  try {
    const settings = await getSiteSettings();
    const all = [...allMediaPhotos(settings), ...portfolio];
    return all.find((p) => p?.id === id)?.title;
  } catch {
    return portfolio.find((p) => p.id === id)?.title;
  }
}

/** Splits a saved address line ("1 Main St, Unit 4, Miami, FL 33139") back into the parts formatAddress() joins. */
export function addressOf(line: string, accessNotes?: string): SessionAddress {
  const m = line.match(/^(.*), ([^,]+), FL (\d{5}(?:-\d{4})?)$/);
  return m ? { street: m[1], city: m[2].trim(), zip: m[3], accessNotes } : { street: line, city: "", zip: "", accessNotes };
}

/**
 * Everything the calendar event and the emails show, rebuilt from the saved booking and its extras (permissions,
 * gate notes, backdrops, deposit): the same rows as when it was booked.
 */
export async function detailsFromRow(row: Booking): Promise<BookingDetails> {
  const [catalog, [consent], [access], [picks], deposit, inspirationTitle, babiesByBooking, addonsByBooking] = await Promise.all([
    getCatalog().catch(() => [] as Bundle[]),
    getDb().select().from(bookingConsents).where(eq(bookingConsents.bookingId, row.id)).limit(1).catch(() => []),
    accessFor([row.id]),
    backdropsFor([row.id]),
    depositOf(row.id),
    row.inspirationPhotoId ? photoTitle(row.inspirationPhotoId) : Promise.resolve(undefined),
    babiesFor([row.id]),
    addonsFor([row.id]),
  ]);
  const babies: BookingBaby[] = babiesByBooking.get(row.id) ?? [{ name: row.babyName ?? undefined, age: row.babyAge }];
  const addons = addonsByBooking.get(row.id) ?? [];
  const bundle = catalog.find((b) => b.id === row.packageId) ?? ({ id: row.packageId, name: row.packageName, features: row.packageInclusions ?? [] } as unknown as Bundle);
  return {
    reference: row.bookingReference,
    bundle: { ...bundle, name: row.packageName },
    date: row.sessionDate,
    start: localTime(row.sessionStart, row.timezone),
    end: localTime(row.sessionEnd, row.timezone),
    contact: { parentName: row.parentName, email: row.email, phone: row.phone, babyName: row.babyName ?? undefined, babyAge: row.babyAge, notes: row.notes ?? undefined },
    babies,
    address: addressOf(row.locationAddress, access?.notes),
    location: row.locationAddress,
    inspirationTitle,
    pricing: snapshotOf(row, addons),
    consents: consent ? { sms: consent.sms, photos: consent.photos } : undefined,
    travel: { feeCents: row.travelFeeCents, miles: row.travelMiles },
    backdrops: picks?.picks,
    deposit: depositInfoOf(deposit),
  };
}
