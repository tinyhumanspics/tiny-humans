"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import { site } from "@/config/site";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";
import { deliveryText, lineName } from "@/lib/photo-extras/format";
import type { ExtrasView } from "@/lib/photo-extras/types";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import styles from "./Extras.module.css";

type Open = Extract<ExtrasView, { state: "open" | "nothing" | "paid" }>;
type View = { state: "loading" } | ExtrasView;

/**
 * /extras?b=…&s=… (owner, Nov 20; link in the sneak-peek email): the family adds extra edited photos, the full gallery
 * and/or the unedited files and pays on Stripe. The total shown here is a preview: the server prices it again.
 */
export default function ExtrasPage({ locale = "en", messages = en.extras }: { locale?: AppLocale; messages?: typeof en.extras }) {
  const m = messages;
  const q = useSearchParams();
  const [b, s, paid] = [q.get("b") ?? "", q.get("s") ?? "", q.get("paid") === "1"];
  const [view, setView] = useState<View>(b && s ? { state: "loading" } : { state: "invalid" });
  const [extras, setExtras] = useState(0);
  const [full, setFull] = useState(false);
  const [raw, setRaw] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phone = { phone: site.contact.phone };

  const load = (afterPay: boolean) =>
    fetch(`/api/extras?${new URLSearchParams({ b, s, ...(afterPay ? { paid: "1" } : {}) })}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setView((await res.json()) as ExtrasView);
      })
      .catch(() => setView({ state: "invalid" }));

  useEffect(() => {
    if (b && s) void load(paid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once, from the link
  }, []);

  const title = (text: string) => <h1 id="extras-title" className={cn(styles.title, "chalk")} tabIndex={-1}>{text}</h1>;
  const home = <ChalkButton href={localePath("/", locale)} variant="outline" seed={432}>{m.home}</ChalkButton>;
  const notice = (t: string, text: string, good = false) => (
    <div className={styles.done} role="status">
      {good && <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />}
      {title(t)}
      <p className={cn(styles.text, "chalk-soft")}>{text}</p>
      <div className={styles.actions}>{home}</div>
    </div>
  );

  let body: React.ReactNode;
  if (view.state === "loading") body = <p className={cn(styles.text, "chalk-soft")}>{m.loading}</p>;
  else if (view.state === "invalid") body = notice(m.invalidTitle, fill(m.invalidText, phone));
  else if (view.state === "closed") body = notice(m.closedTitle, fill(m.closedText, phone));
  else if (view.state === "nothing") body = notice(m.nothingTitle, m.nothingText, true);
  else if (view.state === "paid") body = <Paid view={view} m={m} home={home} again={() => (setView({ state: "loading" }), window.history.replaceState(null, "", `?${new URLSearchParams({ b, s })}`), void load(false))} title={title} />;
  else {
    const { prices: p, left } = view;
    // when each option arrives (owner, Nov 20): the full gallery in its days; extra photos with the finished gallery
    // until it's delivered, then in their own hours
    const arrives = (key: keyof typeof view.delivery) => <span className={cn(styles.when, "chalk-soft")}>{fill(m.arrives, { when: deliveryText(view.delivery[key], m) })}</span>;
    const fullPrice = p.fullGalleryCents - left.fullCreditCents;
    const count = full ? 0 : extras;
    const total = count * p.extraPhotoCents + (full ? fullPrice : 0) + (raw ? p.rawFilesCents : 0);
    const pay = async (e: FormEvent) => {
      e.preventDefault();
      if (total <= 0) return setError(m.pickSomething);
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/extras", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ b, s, extras: count, full, raw, note }) });
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (data?.url) return window.location.assign(data.url);
        if (data?.error === "invalid") return setView({ state: "invalid" });
        if (data?.error === "closed") return setView({ state: "closed" });
        if (res.status === 409) {
          setError(m.changed);
          void load(false);
        } else setError(fill(m.failed, phone));
      } catch {
        setError(fill(m.failed, phone));
      }
      setBusy(false);
    };
    const extrasHint = full ? m.extra.inFull : left.extrasLeft === 0 ? (left.canFull ? m.extra.noneLeft : m.extra.inFull) : fill(m.extra.moreThan, { max: String(p.maxExtras) });
    body = (
      <form onSubmit={pay} noValidate>
        {title(fill(m.title, { name: view.firstName }))}
        <p className={cn(styles.text, "chalk-soft")}>{view.included ? fill(m.intro, { bundle: view.bundleName, count: view.included }) : m.introNoCount}</p>

        <div className={styles.options}>
          <section className={cn(styles.option, count > 0 && styles.chosen)} aria-labelledby="extras-extra">
            <div className={styles.optionHead}>
              <h2 id="extras-extra" className={cn(styles.optionTitle, "chalk")}>{m.extra.title}</h2>
              <span className={cn(styles.price, "chalk-soft")}>{fill(m.extra.price, { price: formatMoney(p.extraPhotoCents) })}</span>
            </div>
            <div className={styles.stepper}>
              <button type="button" className={styles.step} aria-label={m.extra.less} disabled={full || count <= 0} onClick={() => (setExtras((n) => Math.max(0, n - 1)), setError(null))}>−</button>
              <output className={cn(styles.count, "chalk")} aria-live="polite" aria-label={fill(m.extra.count, { n: String(count) })}>{count}</output>
              <button type="button" className={styles.step} aria-label={m.extra.more} disabled={full || count >= left.extrasLeft} onClick={() => (setExtras((n) => Math.min(left.extrasLeft, n + 1)), setError(null))}>+</button>
              {!full && left.extrasLeft > 0 && <span className={cn(styles.hint, "chalk-soft")}>{fill(m.extra.left, { n: String(left.extrasLeft) })}</span>}
            </div>
            <p className={cn(styles.hint, "chalk-soft")}>{extrasHint}</p>
            {!full && left.extrasLeft > 0 && arrives("extras")}
          </section>

          <label className={cn(styles.option, styles.check, full && styles.chosen)}>
            <input type="checkbox" checked={full} disabled={!left.canFull} onChange={(e) => (setFull(e.target.checked), e.target.checked && setExtras(0), setError(null))} />
            <span className={styles.checkText}>
              <span className={styles.optionHead}>
                <span className={cn(styles.optionTitle, "chalk")}>{m.full.title}</span>
                <span className={cn(styles.price, "chalk-soft")}>{left.canFull ? formatMoney(fullPrice) : m.owned}</span>
              </span>
              <span className={cn(styles.hint, "chalk-soft")}>{m.full.text}</span>
              {left.canFull && arrives("full")}
              {left.canFull && left.fullCreditCents > 0 && <span className={cn(styles.credit, "chalk-soft")}>{fill(m.full.credit, { amount: formatMoney(left.fullCreditCents) })}</span>}
            </span>
          </label>

          <label className={cn(styles.option, styles.check, raw && styles.chosen)}>
            <input type="checkbox" checked={raw} disabled={!left.canRaw} onChange={(e) => (setRaw(e.target.checked), setError(null))} />
            <span className={styles.checkText}>
              <span className={styles.optionHead}>
                <span className={cn(styles.optionTitle, "chalk")}>{m.raw.title}</span>
                <span className={cn(styles.price, "chalk-soft")}>{left.canRaw ? formatMoney(p.rawFilesCents) : m.owned}</span>
              </span>
              <span className={cn(styles.hint, "chalk-soft")}>{m.raw.text}</span>
              {left.canRaw && arrives("raw")}
            </span>
          </label>
        </div>

        <label htmlFor="extras-note" className={cn(styles.label, "chalk-soft")}>{m.noteLabel}</label>
        <textarea id="extras-note" className={styles.textarea} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

        <div className={styles.totalRow}>
          <span className={cn(styles.totalLabel, "chalk-soft")}>{m.total}</span>
          <span className={cn(styles.total, "chalk")}>{formatMoney(total)}</span>
        </div>
        {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
        <div className={styles.actions}>
          <span className={cn(styles.hint, "chalk-soft")}>{m.secure}</span>
          <ChalkButton type="submit" variant="solid" disabled={busy || total <= 0} seed={431}>{busy ? m.paying : fill(m.pay, { total: formatMoney(total) })}</ChalkButton>
        </div>
      </form>
    );
  }

  return (
    <section className={cn("container", styles.page)} aria-labelledby="extras-title">
      <ChalkBox className={styles.panel} seed={430} wobble={3.4} strokeWidth={2.8}>
        {body}
      </ChalkBox>
    </section>
  );
}

/** Back from Stripe: what they added, when each arrives, what they paid. */
function Paid({ view, m, home, again, title }: { view: Open; m: typeof en.extras; home: React.ReactNode; again: () => void; title: (t: string) => React.ReactNode }) {
  const o = view.paidOrder!;
  return (
    <div className={styles.done} role="status">
      <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />
      {title(m.paidTitle)}
      <p className={cn(styles.text, "chalk-soft")}>{m.paidText}</p>
      <dl className={styles.receipt}>
        {o.lines.map((l) => (
          <div key={l.kind}>
            <dt className="chalk-soft">{lineName(l, m)}</dt>
            <dd className="chalk-soft">{fill(m.paidLine, { amount: formatMoney(l.totalCents), when: deliveryText(l.delivery, m) })}</dd>
          </div>
        ))}
        {o.creditCents > 0 && (
          <div>
            <dt className="chalk-soft">{m.paidCredit}</dt>
            <dd className="chalk-soft">−{formatMoney(o.creditCents)}</dd>
          </div>
        )}
        <div className={styles.receiptTotal}>
          <dt className="chalk-soft">{m.paidTotal}</dt>
          <dd className="chalk">{formatMoney(o.totalCents)}</dd>
        </div>
      </dl>
      <p className={cn(styles.hint, "chalk-soft")}>{m.paidNote}</p>
      <div className={styles.actions}>
        {home}
        {!view.left.nothingLeft && (
          <ChalkButton variant="outline" onClick={again} seed={433}>{m.addMore}</ChalkButton>
        )}
      </div>
    </div>
  );
}
