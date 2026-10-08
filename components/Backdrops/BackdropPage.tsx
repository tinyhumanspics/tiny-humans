"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { backdropNames } from "@/lib/booking/backdrop-names";
import { fill } from "@/lib/email/messages";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import BackdropPicker from "./BackdropPicker";
import styles from "@/components/Reschedule/Reschedule.module.css";
import { cn } from "@/lib/cn";
import en from "@/messages/en.json";

interface BackdropView {
  bundleName: string;
  date: string;
  start: string;
  firstName: string;
  setups: number;
  picks: string[];
  canChange: boolean;
  status: "active" | "cancelled" | "past";
}

const t = en.backdropPage;
const phone = { phone: site.contact.phone };

/** Backdrop page (/backdrop?t=<management token>): the family picks or changes their backdrops, one per setup. */
export default function BackdropPage() {
  const token = useSearchParams().get("t") ?? "";
  const [view, setView] = useState<BackdropView | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "invalid" | "ready" | "saving" | "saved">(token ? "loading" : "invalid");
  const [message, setMessage] = useState(token ? "" : fill(t.invalid, phone));

  useEffect(() => {
    if (!token) return;
    fetch(`/api/booking/backdrop?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.backdrop) throw new Error(j?.error ?? fill(t.invalid, phone));
        setView(j.backdrop);
        setPicks(j.backdrop.picks);
        setState("ready");
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : fill(t.invalid, phone));
        setState("invalid");
      });
  }, [token]);

  const save = async () => {
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/booking/backdrop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, picks }) });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.backdrop) {
        if (j?.code === "reschedule_closed") setView((v) => (v ? { ...v, canChange: false } : v));
        throw new Error(j?.error ?? fill(t.error, phone));
      }
      setView(j.backdrop);
      setState("saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : fill(t.error, phone));
      setState("ready");
    }
  };

  const many = (view?.setups ?? 1) > 1;
  return (
    <section className={cn("container", styles.page)} aria-labelledby="bd-title">
      <ChalkBox className={styles.panel} seed={431} wobble={3.4} strokeWidth={2.8}>
        <h1 id="bd-title" className={cn(styles.title, "chalk")}>
          {many ? t.titleMany : t.title}
        </h1>
        {state === "loading" && <p className={cn(styles.muted, "chalk-soft")}>…</p>}
        {state === "invalid" && <p className={cn(styles.notice, "chalk-soft")}>{message}</p>}
        {view && state !== "invalid" && (
          <>
            <p className={cn(styles.text, "chalk-soft")}>
              {fill(t.intro, { bundle: view.bundleName, date: `${formatLongDate(view.date)}, ${formatTimeLabel(view.start)}` })}
            </p>
            {view.status === "cancelled" ? (
              <p className={cn(styles.notice, "chalk-soft")}>{t.cancelled}</p>
            ) : !view.canChange ? (
              <>
                <p className={cn(styles.text, "chalk-soft")}>{view.picks.length ? fill(t.current, { list: backdropNames(view.picks) }) : t.notChosen}</p>
                <p className={cn(styles.notice, "chalk-soft")}>{fill(t.closed, phone)}</p>
              </>
            ) : state === "saved" ? (
              <p className={cn(styles.notice, "chalk-soft")} role="status">
                {view.picks.length ? fill(t.saved, { list: backdropNames(view.picks) }) : t.notChosen}
              </p>
            ) : (
              <>
                <p className={cn(styles.text, "chalk-soft")}>{many ? fill(t.pickMany, { n: String(view.setups) }) : t.pickOne}</p>
                <BackdropPicker max={view.setups} value={picks} onChange={setPicks} label={many ? t.titleMany : t.title} />
                {message && (
                  <p className={cn(styles.error, "chalk-soft")} role="alert">
                    {message}
                  </p>
                )}
                <div className={styles.actions}>
                  <p className={cn(styles.muted, "chalk-soft")}>{t.later}</p>
                  <ChalkButton variant="solid" onClick={save} disabled={state === "saving" || !picks.length} seed={432}>
                    {state === "saving" ? t.saving : many ? t.saveMany : t.save}
                  </ChalkButton>
                </div>
              </>
            )}
          </>
        )}
      </ChalkBox>
    </section>
  );
}
