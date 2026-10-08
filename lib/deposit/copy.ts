import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";

/** The site's deposit wording: one amount for every bundle ("$50 deposit"), or "from" the smallest when they differ. */
export interface SiteDeposit {
  cents: number;
  varies: boolean;
}

export const depositText = (v: { one: string; from: string }, d: SiteDeposit) => fill(d.varies ? v.from : v.one, { deposit: formatMoney(d.cents) });
