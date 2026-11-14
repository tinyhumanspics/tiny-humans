/** The quick form (/quick, owner Nov 13): what a family sends so the owners can book for them. */
export interface QuickRequest {
  id: string;
  parentName: string;
  email: string;
  phone: string;
  zip: string;
  babyName: string | null;
  /** One of config/booking.ts babyAgeOptions ("Not born yet" included). */
  babyAge: string | null;
  /** "YYYY-MM-DD" when the baby isn't born yet. */
  dueDate: string | null;
  bundleId: string | null;
  bundleName: string | null;
  bestTime: string | null;
  message: string | null;
  locale: "en" | "es";
  status: "new" | "booked" | "done";
  bookingReference: string | null;
  createdAt: string;
}
