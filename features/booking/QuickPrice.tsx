"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { scheduleHref } from "@/config/booking";
import { activeOffer, formatMoney, toCents, type PriceQuote } from "@/lib/pricing/engine";
import { travelHint } from "@/lib/travel/format";
import type { TravelQuote } from "@/lib/travel/types";
import { cn } from "@/lib/cn";
import styles from "./QuickPrice.module.css";

// the booking form's code box, loaded only when "Have a discount code?" is pressed (keeps the home page light)
const DiscountField = dynamic(() => import("./flow/steps/ReviewStep").then((m) => m.DiscountField), { ssr: false });

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
const shortDate = (key: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
const isZip = (z: string) => /^\d{5}$/.test(z);

export interface QuickPriceMessages {
  price: typeof en.quickPrice;
  discount: typeof en.bookingFlow.review.discount;
  travel: typeof en.bookingFlow.details.travel;
}

/**
 * "Get a quick price" (owner, Nov 13; home page under the hero, ad page under the bundle cards): a bundle + ZIP code →
 * today's price (the running offer, or a code when it saves more: only one counts), the travel fee for that ZIP, the
 * total and the deposit, with a button to book that bundle. The booking form prices it again (twins, family, code).
 * Nothing here is sent to Meta or analytics.
 */
export default function QuickPrice({ messages, locale, headingLevel = 2, inline = false }: { messages: QuickPriceMessages; locale: AppLocale; headingLevel?: 2 | 3; inline?: boolean }) {
  const t = messages.price;
  const Title = headingLevel === 3 ? "h3" : "h2";
  const { bundles, today, depositFor, available } = useCatalog();
  const active = bundles.filter((b) => b.active !== false);
  // the middle bundle to start (the one most families pick); any bundle can be chosen
  const [picked, setPicked] = useState<string | null>(null);
  const [zipText, setZipText] = useState("");
  const [travel, setTravel] = useState<{ zip: string; quote: TravelQuote | null } | null>(null);
  const [code, setCode] = useState<{ bundleId: string; applied: string; quote: PriceQuote } | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const zip = zipText.trim().slice(0, 5);

  useEffect(() => {
    if (!isZip(zip)) return;
    const ctrl = new AbortController();
    fetch(`/api/booking/travel?zip=${zip}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { travel?: TravelQuote } | null) => setTravel({ zip, quote: j?.travel ?? null }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [zip]);

  if (!available || !active.length) return null;
  const bundle = active.find((b) => b.id === picked) ?? active[Math.min(1, active.length - 1)];
  const regular = toCents(bundle.price);
  const offer = activeOffer(bundle, today);
  const codeNow = code?.bundleId === bundle.id && code.quote.pricingType === "discount" ? code : null;
  const priceCents = codeNow ? codeNow.quote.finalCents : (offer?.cents ?? regular);
  const zipReady = isZip(zip);
  const tq = zipReady && travel?.zip === zip ? travel.quote : null;
  const blocked = tq?.status === "too_far" || tq?.status === "outside_florida";
  const travelCents = tq?.status === "fee" ? tq.feeCents : 0;
  const total = priceCents + travelCents;
  const deposit = Math.min(depositFor(bundle.id) ?? 0, total);
  // the note under the ZIP box only when something needs saying (the receipt already shows miles and the fee)
  const hint = tq && (tq.status === "too_far" || tq.status === "outside_florida" || tq.status === "unknown_zip") ? travelHint(tq, messages.travel) : null;
  const travelValue = !zipReady ? (
    <span className={styles.small}>{t.addZip}</span>
  ) : !tq ? (
    <span className={styles.small}>…</span>
  ) : blocked ? (
    "—"
  ) : tq.status === "unknown_zip" ? (
    <span className={styles.small}>{t.confirm}</span>
  ) : tq.status === "fee" ? (
    <>
      <b>{formatMoney(tq.feeCents)}</b>
      {tq.miles != null && <span className={styles.small}>{fill(t.miles, { miles: String(tq.miles) })}</span>}
    </>
  ) : (
    <b>{t.free}</b>
  );

  return (
    <section className={cn(!inline && "container", inline ? styles.inline : styles.section)} aria-labelledby={`quick-price-${headingLevel}`}>
      <ChalkBox className={styles.box} seed={131} wobble={2.4} strokeWidth={2.6} color="var(--sun-yellow)">
        <ChalkDoodle name="star" size={30} color="var(--sun-yellow)" className={styles.doodle} />
        <div className={styles.head}>
          <Title id={`quick-price-${headingLevel}`} className={cn(styles.title, "chalk")}>{t.title}</Title>
          <p className={cn(styles.sub, "chalk-soft")}>{t.sub}</p>
        </div>
        <div className={styles.grid}>
          <div className={styles.inputs}>
            <div role="group" aria-labelledby={`quick-price-bundle-${headingLevel}`} className={styles.group}>
              <p id={`quick-price-bundle-${headingLevel}`} className={cn(styles.label, "chalk-soft")}>{t.bundle}</p>
              <div className={styles.chips}>
                {active.map((b) => {
                  const o = activeOffer(b, today);
                  return (
                    <button key={b.id} type="button" className={cn(styles.chip, b.id === bundle.id && styles.chipOn)} aria-pressed={b.id === bundle.id} onClick={() => setPicked(b.id)}>
                      <span className={styles.chipName}>{b.name}</span>
                      <span className={styles.chipPrice}>
                        {o ? <><s>{formatMoney(toCents(b.price))}</s> {formatMoney(o.cents)}</> : formatMoney(toCents(b.price))}
                        {b.duration ? ` · ${b.duration}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.zipRow}>
              <label htmlFor={`quick-price-zip-${headingLevel}`} className={cn(styles.label, "chalk-soft")}>{t.zip}</label>
              <input id={`quick-price-zip-${headingLevel}`} className={styles.zip} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="33139"
                value={zipText} onChange={(e) => setZipText(e.target.value.replace(/\D/g, ""))} aria-describedby={hint ? `quick-price-zip-note-${headingLevel}` : undefined} />
              {hint && <p id={`quick-price-zip-note-${headingLevel}`} className={cn(styles.note, hint.blocking && styles.noteBad, "chalk-soft")} aria-live="polite">{hint.text}</p>}
            </div>
            {codeOpen ? (
              <div className={styles.code}>
                <DiscountField
                  applied={codeNow?.applied ?? null}
                  offerLabel={offer?.label ?? ""}
                  messages={messages.discount}
                  onApply={async (raw) => {
                    const { HttpBookingClient } = await import("@/lib/booking/http-client");
                    const q = await new HttpBookingClient().quote(bundle.id, raw);
                    setCode(q.pricingType === "discount" && q.discountCode ? { bundleId: bundle.id, applied: q.discountCode, quote: q } : null);
                    return q;
                  }}
                  onRemove={async () => setCode(null)}
                />
              </div>
            ) : (
              <button type="button" className={cn(styles.codeLink, "chalk-soft")} onClick={() => setCodeOpen(true)}>{t.codeLink}</button>
            )}
          </div>

          <div className={styles.receipt} aria-live="polite">
            <p className={cn(styles.receiptTitle, "chalk")}>{bundle.name}</p>
            <dl className={styles.lines}>
              <div>
                <dt className="chalk-soft">{codeNow ? fill(t.codeLine, { code: codeNow.applied }) : offer ? offer.label : t.bundleLine}</dt>
                <dd className="chalk-soft">
                  {priceCents < regular && <s className={styles.was}>{formatMoney(regular)}</s>}
                  <b>{formatMoney(priceCents)}</b>
                  {!codeNow && offer?.endsOn && <span className={styles.small}>{fill(t.until, { date: shortDate(offer.endsOn, locale) })}</span>}
                </dd>
              </div>
              <div>
                <dt className="chalk-soft">{zipReady ? fill(t.travelTo, { zip }) : t.travel}</dt>
                <dd className="chalk-soft">{travelValue}</dd>
              </div>
            </dl>
            <div className={cn(styles.totalRow, "chalk")}>
              <span>{t.total}</span>
              <span className={styles.total}>{blocked ? "—" : formatMoney(total)}</span>
            </div>
            {!blocked && (
              <p className={cn(styles.small, styles.depositLine, "chalk-soft")}>
                {deposit > 0 ? fill(t.deposit, { deposit: formatMoney(deposit), rest: formatMoney(total - deposit) }) : t.payAfter}
              </p>
            )}
            {!blocked && <p className={cn(styles.small, "chalk-soft")}>{t.fine}</p>}
            <ChalkButton variant="solid" href={scheduleHref(bundle.id, null, locale)} seed={132} className={styles.book}>{fill(t.book, { bundle: bundle.name })}</ChalkButton>
          </div>
        </div>
      </ChalkBox>
    </section>
  );
}
