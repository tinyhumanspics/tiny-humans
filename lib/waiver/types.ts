import type { WaiverLanguage, WaiverSnapshot, WaiverUses } from "./text";

/** /admin → Leads → photo and video release: what the pages and API routes exchange. */

export interface WaiverChild {
  name: string | null;
  age: string;
}

/** The latest release of a booking, for Leads (no signature image, no text). */
export interface WaiverSummary {
  id: string;
  status: "signed" | "superseded" | "revoked";
  signedAt: string;
  signerName: string;
  relationship: "parent" | "guardian";
  uses: WaiverUses;
  firstNameOk: boolean;
  language: WaiverLanguage;
  revokedAt: string | null;
}

/** What the signing screen needs to know about the booking. */
export interface WaiverContext {
  reference: string;
  status: "pending" | "confirmed" | "rescheduled" | "cancelled";
  parentName: string;
  children: WaiverChild[];
  sessionDate: string;
  /** The language they booked in (the screen starts in it). */
  locale: WaiverLanguage;
  /** The active release, if one was signed already ("Sign again" replaces it). */
  signed: WaiverSummary | null;
}

/** A signed release as the owners see it ("See signed waiver"). */
export interface SignedWaiver extends WaiverSummary {
  reference: string;
  familyName: string;
  children: WaiverChild[];
  sessionDate: string | null;
  version: string;
  snapshot: WaiverSnapshot;
  sha256: string;
  /** data:image/png;base64,… */
  signature: string;
  revokeNote: string | null;
  /** False once the lead was deleted (the release is kept as the business's record). */
  bookingExists: boolean;
}
