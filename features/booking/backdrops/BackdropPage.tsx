"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { backdropNames } from "@/lib/booking/backdrop-names";
import type { BackdropView } from "@/lib/booking/backdrop-page";
import { fill } from "@/lib/email/messages";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import BackdropPicker from "./BackdropPicker";
import pickerStyles from "./BackdropPicker.module.css";
import styles from "@/features/booking/reschedule/Reschedule.module.css";
import flowStyles from "@/features/booking/flow/Booking.module.css";
import requestStyles from "@/features/booking/request/RequestFlow.module.css";
import { cn } from "@/lib/cn";
import en from "@/messages/en.json";
import type { AppLocale } from "@/i18n/config";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { offeredOnly } from "@/config/backdrops";

const phone = { phone: site.contact.phone };

/**
 * "Prepare for your session" (/backdrop?t=<management token>, brief 02), opened from the confirmation and reminder
 * emails: their home's street and city, gate/parking notes, the baby's name, the backdrops (one per setup) and the
 * photo permission. Open until the day before the session.
 */
export default function BackdropPage({ locale = "en", messages = en.backdropPage, bookingMessages = en.bookingFlow }: { locale?: AppLocale; messages?: typeof en.backdropPage; bookingMessages?: typeof en.bookingFlow }) {
  const t = messages;
  const p = t.prep;
  const { getBundle } = useCatalog();
  const token = useSearchParams().get("t") ?? "";
  const [view, setView] = useState<BackdropView | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [home, setHome] = useState({ street: "", city: "", accessNotes: "" });
  const [names, setNames] = useState<string[]>([]);
  const [genders, setGenders] = useState<("boy" | "girl" | "")[]>([]);
  const [photos, setPhotos] = useState(false);
  const [state, setState] = useState<"loading" | "invalid" | "ready" | "saving" | "saved">(token ? "loading" : "invalid");
  const [message, setMessage] = useState(token ? "" : fill(t.invalid, phone));

  const show = (v: BackdropView) => {
    setView(v);
    setPicks(offeredOnly(v.picks));
    setHome({ street: v.home.street, city: v.home.city, accessNotes: v.home.accessNotes });
    setNames(v.babyNames);
    setGenders(v.babyGenders);
    setPhotos(v.photos);
  };

  useEffect(() => {
    if (!token) return;
    fetch(`/api/booking/backdrop?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as { backdrop?: BackdropView; code?: string } | null;
        if (!res.ok || !j?.backdrop) throw new Error(j?.code === "not_found" ? fill(t.invalid, phone) : fill(t.error, phone));
        show(j.backdrop);
        setState("ready");
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : fill(t.invalid, phone));
        setState("invalid");
      });
  }, [token, t]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (home.street.trim().length < 4 || home.city.trim().length < 2) return setMessage(p.missingHome);
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/booking/backdrop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, picks, home, babyNames: names, ...(genders.length ? { babyGenders: genders } : {}), photos }) });
      const j = (await res.json().catch(() => null)) as { backdrop?: BackdropView; code?: string } | null;
      if (!res.ok || !j?.backdrop) {
        if (j?.code === "reschedule_closed") setView((v) => (v ? { ...v, canChange: false } : v));
        throw new Error(j?.code === "not_found" ? fill(t.invalid, phone) : fill(t.error, phone));
      }
      show(j.backdrop);
      setState("saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : fill(t.error, phone));
      setState("ready");
    }
  };

  const many = (view?.setups ?? 1) > 1;
  const localizedNames = bookingMessages.details.backdrops.names;
  const date = view ? formatLongDate(view.date, locale) : "";
  const field = (id: string, label: string, input: React.ReactNode) => (
    <div className={flowStyles.field}>
      <label htmlFor={id} className={cn(flowStyles.label, "chalk-soft")}>
        {label}
      </label>
      {input}
    </div>
  );
  return (
    <section className={cn("container", styles.page)} aria-labelledby="bd-title">
      <ChalkBox className={styles.panel} seed={431} wobble={3.4} strokeWidth={2.8}>
        <h1 id="bd-title" className={cn(styles.title, "chalk")}>
          {p.title}
        </h1>
        {state === "loading" && <p className={cn(styles.muted, "chalk-soft")}>…</p>}
        {state === "invalid" && <p className={cn(styles.notice, "chalk-soft")}>{message}</p>}
        {view && state !== "invalid" && (
          <>
            <p className={cn(styles.text, "chalk-soft")}>{fill(p.intro, { name: view.firstName, bundle: getBundle(view.bundleId)?.name ?? view.bundleName, date: `${date}, ${formatTimeLabel(view.start, locale)}` })}</p>
            {view.status === "cancelled" ? (
              <p className={cn(styles.notice, "chalk-soft")}>{t.cancelled}</p>
            ) : !view.canChange ? (
              <>
                <p className={cn(styles.text, "chalk-soft")}>{view.picks.length ? fill(t.current, { list: backdropNames(view.picks, localizedNames, bookingMessages.review.and) }) : t.notChosen}</p>
                <p className={cn(styles.notice, "chalk-soft")}>{fill(p.closed, phone)}</p>
              </>
            ) : (
              <form onSubmit={save} noValidate>
                <fieldset className={cn(flowStyles.fieldset, requestStyles.fields)}>
                  <legend className={cn(styles.currentTitle, pickerStyles.sectionTitle, "chalk")}>{p.home}</legend>
                  {field("prep-street", p.street, <input id="prep-street" className={flowStyles.input} autoComplete="street-address" maxLength={200} value={home.street} onChange={(e) => setHome((h) => ({ ...h, street: e.target.value }))} />)}
                  {field("prep-city", p.city, <input id="prep-city" className={flowStyles.input} autoComplete="address-level2" maxLength={100} value={home.city} onChange={(e) => setHome((h) => ({ ...h, city: e.target.value }))} />)}
                  <p className={cn(styles.muted, "chalk-soft")}>{fill(p.zip, { zip: view.home.zip, ...phone })}</p>
                  {field("prep-access", p.access, <input id="prep-access" className={flowStyles.input} maxLength={300} value={home.accessNotes} onChange={(e) => setHome((h) => ({ ...h, accessNotes: e.target.value }))} />)}
                </fieldset>
                {names.length > 0 && (
                  <fieldset className={cn(flowStyles.fieldset, requestStyles.fields)}>
                    <legend className={cn(styles.currentTitle, pickerStyles.sectionTitle, "chalk")}>{p.baby}</legend>
                    {names.map((name, i) => (
                      <Fragment key={i}>
                        {field(`prep-baby-${i}`, names.length > 1 ? fill(p.babyNameN, { n: String(i + 1) }) : p.babyName, <input id={`prep-baby-${i}`} className={flowStyles.input} maxLength={80} value={name} onChange={(e) => setNames((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />)}
                        {/* boy or girl (owner, Nov 19), optional */}
                        {genders.length === names.length &&
                          field(
                            `prep-gender-${i}`,
                            names.length > 1 ? fill(p.babyGenderN, { n: String(i + 1) }) : p.babyGender,
                            <select id={`prep-gender-${i}`} className={flowStyles.input} value={genders[i]} onChange={(e) => setGenders((l) => l.map((x, j) => (j === i ? (e.target.value as "boy" | "girl" | "") : x)))}>
                              <option value="">{p.chooseGender}</option>
                              {(["boy", "girl"] as const).map((g) => (
                                <option key={g} value={g}>{bookingMessages.details.baby.genders[g]}</option>
                              ))}
                            </select>,
                          )}
                      </Fragment>
                    ))}
                  </fieldset>
                )}
                <h2 className={cn(styles.currentTitle, pickerStyles.sectionTitle, "chalk")}>{many ? t.titleMany : t.title}</h2>
                <p className={cn(styles.text, "chalk-soft")}>{many ? fill(t.pickMany, { n: String(view.setups) }) : t.pickOne}</p>
                <BackdropPicker max={view.setups} value={picks} onChange={setPicks} label={many ? t.titleMany : t.title} names={localizedNames} />
                <h2 className={cn(styles.currentTitle, pickerStyles.sectionTitle, "chalk")}>{p.photosTitle}</h2>
                <label className={cn(requestStyles.consent, "chalk-soft")}>
                  <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
                  <span>{bookingMessages.details.consents.photos}</span>
                </label>
                <p className={cn(styles.muted, "chalk-soft")}>{bookingMessages.details.consents.hint}</p>
                {message && (
                  <p className={cn(styles.error, "chalk-soft")} role="alert">
                    {message}
                  </p>
                )}
                {state === "saved" && (
                  <p className={cn(styles.notice, "chalk-soft")} role="status">
                    {fill(p.saved, { date })}
                  </p>
                )}
                <div className={styles.actions}>
                  <p className={cn(styles.muted, "chalk-soft")}>{t.later}</p>
                  <ChalkButton type="submit" variant="solid" disabled={state === "saving"} seed={432}>
                    {state === "saving" ? t.saving : p.save}
                  </ChalkButton>
                </div>
              </form>
            )}
          </>
        )}
      </ChalkBox>
    </section>
  );
}
