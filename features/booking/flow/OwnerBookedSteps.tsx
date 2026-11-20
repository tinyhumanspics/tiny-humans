"use client";

import { useState, type RefObject } from "react";
import { site } from "@/config/site";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import BackdropPicker from "@/features/booking/backdrops/BackdropPicker";
import { formatLongDate, formatTimeLabel } from "@/lib/booking";
import type { DepositReturnState, LinkBaby, LinkHome } from "@/lib/deposit/types";
import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import styles from "./Booking.module.css";

type Waiting = Extract<DepositReturnState, { state: "waiting" }>;

const miamiDateTime = (iso: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * A family's link for a session the owner confirmed for them (/admin → Requests): 1) their home address (owner Nov 16: no
 * texting it; the ZIP is the request's) and, optional, each baby's name and boy or girl (owner Nov 19), 2) their backdrops
 * (as many as the bundle's setups, or "not sure yet"), 3) the deposit on Stripe, which confirms it.
 */
export default function OwnerBookedSteps({ state, reference, signature, locale, messages, headingRef }: { state: Waiting; reference: string; signature: string; locale: AppLocale; messages: typeof en.bookingFlow; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = messages.depositReturn;
  const names = messages.details.backdrops.names as Record<string, string>;
  const allowed = state.backdrops?.allowed ?? 1;
  const savedAtStart = state.backdrops?.picks ?? [];
  const [picks, setPicks] = useState<string[]>(savedAtStart);
  // null = still choosing; [] = "not sure yet"; else what was saved
  const [saved, setSaved] = useState<string[] | null>(savedAtStart.length ? savedAtStart : null);
  // the home: saved when it has a street (a request books with the ZIP only)
  const [home, setHome] = useState({ street: state.home?.street ?? "", city: state.home?.city ?? "", accessNotes: state.home?.accessNotes ?? "" });
  const [homeSaved, setHomeSaved] = useState<LinkHome | null>(state.home?.street ? state.home : null);
  // their babies (optional): asked with the home, saved with it
  const [babies, setBabies] = useState<LinkBaby[]>(state.babies ?? []);
  const genders = messages.details.baby.genders;
  const [busy, setBusy] = useState<"home" | "save" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deposit = formatMoney(state.amountCents);
  const intro = fill(t.bookedText, {
    bundle: state.bundleName,
    date: formatLongDate(state.date, locale),
    time: formatTimeLabel(state.start, locale),
    deposit,
    until: state.holdUntil ? miamiDateTime(state.holdUntil, locale) : "",
  });

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ b: reference, k: signature, ...body }) });
    const data = (await res.json().catch(() => null)) as { error?: string; picks?: string[]; url?: string; home?: LinkHome; babies?: LinkBaby[] } | null;
    if (!res.ok || !data) throw new Error(data?.error || t.error);
    return data;
  };

  const saveHome = async () => {
    if (home.street.trim().length < 4 || home.city.trim().length < 2) return setError(t.missingHome);
    setBusy("home");
    setError(null);
    try {
      const data = await post("/api/booking/deposit/home", { home, ...(babies.length ? { babies } : {}) });
      if (data.babies) setBabies(data.babies);
      setHomeSaved(data.home ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const homeLine = (h: LinkHome) => [h.street, h.city, h.zip ? `FL ${h.zip}` : ""].filter(Boolean).join(", ");
  // "Mia · Girl", "Baby 2 · Boy": only what they told us
  const babyLine = babies
    .map((b, i) => [b.name.trim() || (b.gender && babies.length > 1 ? fill(t.babyN, { n: String(i + 1) }) : ""), b.gender ? genders[b.gender] : ""].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join(", ");
  const field = (id: string, label: string, input: React.ReactNode) => (
    <div className={styles.field}>
      <label htmlFor={id} className={cn(styles.label, "chalk-soft")}>
        {label}
      </label>
      {input}
    </div>
  );

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      setSaved((await post("/api/booking/deposit/backdrops", { picks })).picks ?? picks);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    setBusy("pay");
    setError(null);
    try {
      const url = state.payUrl ?? (await post("/api/booking/deposit/pay", {})).url;
      if (!url) throw new Error(t.error);
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className={styles.confirm}>
      <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.bookedTitle}</h2>
      <p className={cn(styles.confirmText, "chalk-soft")}>{intro}</p>

      <div className={styles.ownerStep}>
        <h3 className={cn(styles.ownerStepTitle, "chalk")}>{t.stepHome}</h3>
        {homeSaved === null ? (
          <div className={styles.ownerHome}>
            {field("link-street", t.street, <input id="link-street" className={styles.input} autoComplete="street-address" maxLength={200} value={home.street} onChange={(e) => setHome((h) => ({ ...h, street: e.target.value }))} />)}
            {field("link-city", t.city, <input id="link-city" className={styles.input} autoComplete="address-level2" maxLength={100} value={home.city} onChange={(e) => setHome((h) => ({ ...h, city: e.target.value }))} />)}
            {state.home?.zip && <p className={cn(styles.ownerStepNote, "chalk-soft")}>{fill(t.zip, { zip: state.home.zip, phone: site.contact.phone })}</p>}
            {field("link-access", t.access, <input id="link-access" className={styles.input} maxLength={300} value={home.accessNotes} onChange={(e) => setHome((h) => ({ ...h, accessNotes: e.target.value }))} />)}
            {babies.length > 0 && (
              <fieldset className={styles.ownerBabies}>
                <legend className={cn(styles.label, "chalk-soft")}>{t.baby}</legend>
                {babies.map((b, i) => (
                  <div key={i} className={styles.ownerBaby}>
                    {field(`link-baby-${i}`, babies.length > 1 ? fill(t.babyNameN, { n: String(i + 1) }) : t.babyName, <input id={`link-baby-${i}`} className={styles.input} maxLength={80} value={b.name} onChange={(e) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />)}
                    {field(
                      `link-gender-${i}`,
                      babies.length > 1 ? fill(t.genderN, { n: String(i + 1) }) : t.gender,
                      <select id={`link-gender-${i}`} className={styles.input} value={b.gender} onChange={(e) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, gender: e.target.value as LinkBaby["gender"] } : x)))}>
                        <option value="">{t.chooseGender}</option>
                        {(["boy", "girl"] as const).map((g) => (
                          <option key={g} value={g}>{genders[g]}</option>
                        ))}
                      </select>,
                    )}
                  </div>
                ))}
              </fieldset>
            )}
            <div className={styles.depositActions}>
              <ChalkButton variant="solid" onClick={saveHome} disabled={busy !== null} seed={100}>
                {busy === "home" ? t.savingHome : t.saveHome}
              </ChalkButton>
            </div>
          </div>
        ) : (
          <p className={cn(styles.confirmText, "chalk-soft")}>
            {fill(t.homeSaved, { address: homeLine(homeSaved) })}
            {babyLine && ` ${fill(t.babySaved, { list: babyLine })}`}{" "}
            <button type="button" className={styles.ownerStepChange} onClick={() => setHomeSaved(null)}>
              {t.changeHome}
            </button>
          </p>
        )}
      </div>

      <div className={styles.ownerStep}>
        <h3 className={cn(styles.ownerStepTitle, "chalk")}>{allowed > 1 ? t.stepBackdrops : t.stepBackdrop}</h3>
        {saved === null ? (
          <>
            <BackdropPicker max={allowed} value={picks} onChange={setPicks} label={allowed > 1 ? messages.details.backdrops.titleMany : messages.details.backdrops.title} names={names} />
            <div className={styles.depositActions}>
              <ChalkButton variant="solid" onClick={save} disabled={busy !== null || !picks.length} seed={101}>
                {busy === "save" ? t.savingBackdrops : t.saveBackdrops}
              </ChalkButton>
              <ChalkButton variant="outline" onClick={() => (setSaved([]), setError(null))} disabled={busy !== null} seed={102}>
                {t.skipBackdrops}
              </ChalkButton>
            </div>
          </>
        ) : (
          <p className={cn(styles.confirmText, "chalk-soft")}>
            {saved.length ? fill(t.backdropsSaved, { list: saved.map((id) => names[id] ?? id).join(", ") }) : t.backdropsLater}{" "}
            <button type="button" className={styles.ownerStepChange} onClick={() => setSaved(null)}>
              {t.changeBackdrops}
            </button>
          </p>
        )}
      </div>

      <div className={styles.ownerStep}>
        <h3 className={cn(styles.ownerStepTitle, "chalk")}>{fill(t.stepPay, { deposit })}</h3>
        <ChalkButton variant="solid" onClick={pay} disabled={busy !== null || saved === null || homeSaved === null} seed={103}>
          {busy === "pay" ? t.opening : fill(t.pay, { deposit })}
        </ChalkButton>
        <p className={cn(styles.ownerStepNote, "chalk-soft")}>{homeSaved === null ? t.payNeedsHome : t.payNote}</p>
      </div>

      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      <p className={cn(styles.ownerStepNote, "chalk-soft")}>{fill(t.otherTime, { phone: site.contact.phone })}</p>
    </div>
  );
}
