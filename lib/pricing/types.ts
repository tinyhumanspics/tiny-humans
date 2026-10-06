import type { Bundle } from "@/config/bundles";
import type { CodeTerms } from "./engine";

/** A discount code as the owner manages it (internal note is admin-only). */
export interface DiscountCode {
  id: string;
  code: string;
  type: "percent" | "fixed";
  /** percent: 1-100; fixed: dollars (may include cents) */
  value: number;
  bundleIds: string[];
  active: boolean;
  expiresOn: string | null;
  maxUses: number | null;
  onePerEmail: boolean;
  internalNote: string | null;
  usesCount: number;
  createdAt: string;
}

export type CodeCheck = { ok: true; terms: CodeTerms; codeId: string } | { ok: false; message: string };

/** Where providers get bundles + codes (Neon on the server, browser storage in the prototype). */
export interface PricingAdapter {
  bundles(): Promise<Bundle[]>;
  validateCode(code: string, bundleId: string, email?: string): Promise<CodeCheck>;
  /** Reserve one use (atomic). Returns a release function for rollbacks. */
  claimCode?(codeId: string, email: string): Promise<{ usageId: string; release: () => Promise<void> }>;
}

export const CODE_MESSAGES = {
  notFound: "We couldn't find that code. Please check the spelling and try again.",
  inactive: "That code isn't active right now.",
  expired: "That code has expired.",
  notForBundle: "That code doesn't apply to this bundle.",
  maxed: "That code has reached its limit and can't be used anymore.",
  usedByEmail: "That code has already been used with this email address.",
};
