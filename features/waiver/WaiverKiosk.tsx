"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { waiverFacts } from "@/lib/waiver/facts";
import { waiverApi, WaiverApiError } from "@/lib/waiver/client";
import { fillWords, waiverSnapshot, waiverVersionFor, waiverWords, WAIVER_USES, type WaiverLanguage, type WaiverUse, type WaiverUses } from "@/lib/waiver/text";
import type { WaiverContext } from "@/lib/waiver/types";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import WaiverPaper from "./WaiverPaper";
import css from "./Waiver.module.css";

const NONE: WaiverUses = { website: false, social: false, ads: false, bts: false, personal: false };
/** A signature needs more than a dot or a tap. */
const MIN_INK = 12;

/**
 * /admin/waiver/[reference]: the screen the parent reads and signs on the iPad. Full screen, no admin menu or
 * links (the parent can't wander into the owner area); only "For Adri & Alo: Cancel" (two taps) leaves it.
 * Done → thank-you screen → the owners tap "Next →" back to Leads.
 */
export default function WaiverKiosk({ reference }: { reference: string }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<WaiverContext | null>(null);
  const [problem, setProblem] = useState<{ kind: "signedOut" | "notReady" | "error"; text: string } | null>(null);
  const [lang, setLang] = useState<WaiverLanguage>("en");
  const [uses, setUses] = useState<WaiverUses>(NONE);
  const [firstNameOk, setFirstNameOk] = useState(false);
  const [name, setName] = useState("");
  const [rel, setRel] = useState<"parent" | "guardian">("parent");
  const [agree, setAgree] = useState(false);
  const [ink, setInk] = useState(0);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState<{ first: string; private: boolean } | null>(null);
  const [cancelArmed, setCancelArmed] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const cancelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        if (!(await waiverApi.session())) return !stale && setProblem({ kind: "signedOut", text: "Sign in to the owner area first, then open the waiver again from Leads." });
        const c = await waiverApi.context(reference);
        if (stale) return;
        setCtx(c);
        setLang(c.locale);
      } catch (err) {
        if (stale) return;
        const e = err as WaiverApiError;
        setProblem({ kind: e.notReady ? "notReady" : e.status === 401 ? "signedOut" : "error", text: e.message });
      }
    })();
    return () => {
      stale = true;
      clearTimeout(cancelTimer.current);
    };
  }, [reference]);

  useEffect(() => {
    if (done) thanksRef.current?.focus();
  }, [done]);

  const words = waiverWords(lang);
  // Our Family Story gets the family release (owner, Nov 11); the server rebuilds the same words when saving
  const snapshot = useMemo(() => (ctx ? waiverSnapshot(lang, waiverFacts(ctx, lang), ctx.kind) : null), [ctx, lang]);
  const back = "/admin/leads";

  if (problem || !ctx || !snapshot) {
    return (
      <div className={css.kiosk}>
        <div className={css.bar}>
          <span className={css.brand}><span className={css.sun} aria-hidden="true" />Tiny Humans</span>
        </div>
        <div className={css.body}>
          <p className={css.notice} role={problem ? "alert" : "status"}>{problem?.text ?? "Opening the photo release…"}</p>
          {problem && <Link className={css.ownerLink} href={problem.kind === "signedOut" ? "/admin" : back}>{problem.kind === "signedOut" ? "Go to the owner area" : "Back to Leads"}</Link>}
        </div>
      </div>
    );
  }

  const nothing = !WAIVER_USES.some((k) => uses[k]);
  const missing = [name.trim().length < 2 && words.mName, !agree && words.mAgree, ink < MIN_INK && words.mSign].filter((m): m is string => Boolean(m));

  if (ctx.status === "cancelled") {
    return (
      <div className={css.kiosk}>
        <div className={css.bar}>
          <span className={css.brand}><span className={css.sun} aria-hidden="true" />Tiny Humans</span>
          <Link className={css.ownerLink} href={back}>Back to Leads</Link>
        </div>
        <div className={css.body}>
          <p className={css.notice} role="alert">This booking was cancelled, so it can&apos;t get a photo release.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={css.kiosk}>
        <div className={css.bar}>
          <span className={css.brand}><span className={css.sun} aria-hidden="true" />Tiny Humans</span>
          <span className={css.ownerBox}>
            <span className={css.ownerTag}>{words.owner}:</span>
            <button type="button" className={css.nextButton} onClick={() => router.push(`${back}?waiver=saved&ref=${encodeURIComponent(ctx.reference)}`)}>
              {words.next}
            </button>
          </span>
        </div>
        <div className={`${css.body} ${css.thanks}`} lang={lang}>
          <div className={css.bigSun} aria-hidden="true" />
          <h1 ref={thanksRef} tabIndex={-1} className={css.thanksTitle}>{fillWords(words.thanks, { name: done.first })}</h1>
          <p className={css.thanksSub}>
            {done.private ? `${words.thanksPrivate} ` : ""}
            {words.thanksSub}
          </p>
        </div>
      </div>
    );
  }

  const cancel = () => {
    if (!cancelArmed) {
      setCancelArmed(true);
      cancelTimer.current = setTimeout(() => setCancelArmed(false), 4000);
      return;
    }
    router.push(back);
  };

  const submit = async () => {
    if (saving) return;
    setTried(true);
    setSaveError(null);
    const signature = pad.current?.toPng() ?? null;
    if (missing.length || !signature) return;
    setSaving(true);
    try {
      await waiverApi.sign({
        reference: ctx.reference,
        version: waiverVersionFor(ctx.kind),
        language: lang,
        uses,
        firstNameOk: snapshot.firstName ? firstNameOk : false,
        signerName: name.trim(),
        relationship: rel,
        agree: true,
        signature,
      });
      setDone({ first: name.trim().split(/\s+/)[0], private: nothing });
      window.scrollTo(0, 0);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const today = new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date());
  const setUse = (key: WaiverUse, on: boolean) => setUses((u) => ({ ...u, [key]: on }));

  return (
    <div className={css.kiosk}>
      <div className={css.bar}>
        <span className={css.brand}><span className={css.sun} aria-hidden="true" />Tiny Humans</span>
        <span className={css.ownerBox}>
          <button type="button" className={css.barButton} onClick={() => setLang(lang === "en" ? "es" : "en")} lang={lang === "en" ? "es" : "en"}>
            {words.lang}
          </button>
          <span className={css.ownerTag}>{words.owner}:</span>
          <button type="button" className={css.ownerLink} onClick={cancel}>
            {cancelArmed ? words.cancelSure : words.cancel}
          </button>
        </span>
        {ctx.signed && <p className={css.ownerNote}>For Adri &amp; Alo: signing again replaces the release signed {new Date(ctx.signed.signedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}.</p>}
      </div>
      <div className={css.body}>
        <WaiverPaper
          snapshot={snapshot}
          choices={
            <>
              <button type="button" className={css.paperButton} onClick={() => setUses({ website: true, social: true, ads: true, bts: true, personal: true })}>
                {words.yesAll}
              </button>
              <ul className={css.choices}>
                {snapshot.uses.map((u) => (
                  <li key={u.key}>
                    <label className={css.choice}>
                      <input type="checkbox" className={css.tick} checked={uses[u.key]} onChange={(e) => setUse(u.key, e.target.checked)} />
                      <span>{u.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className={css.paperHint}>{snapshot.noneHint}</p>
            </>
          }
          firstName={
            snapshot.firstName && (
              <ul className={css.choices}>
                <li>
                  <label className={css.choice}>
                    <input type="checkbox" className={css.tick} checked={firstNameOk} onChange={(e) => setFirstNameOk(e.target.checked)} />
                    <span>{snapshot.firstName.label}</span>
                  </label>
                </li>
              </ul>
            )
          }
          you={
            <>
              <label className={css.paperLabel} htmlFor="w-name">{snapshot.labels.fullName}</label>
              <input id="w-name" className={css.field} autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              <fieldset className={css.relation}>
                <legend className={css.paperLabel}>{snapshot.labels.relationship}</legend>
                <div className={css.segment}>
                  {(["parent", "guardian"] as const).map((r) => (
                    <label key={r} className={rel === r ? css.segmentOn : css.segmentOff}>
                      <input type="radio" name="w-rel" className={css.srOnly} checked={rel === r} onChange={() => setRel(r)} />
                      {r === "parent" ? snapshot.labels.parent : snapshot.labels.guardian}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={`${css.choice} ${css.agree}`}>
                <input type="checkbox" className={css.tick} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{snapshot.labels.agree}</span>
              </label>
              <div className={css.signHead}>
                <span className={css.paperLabel} id="w-sign-label">{snapshot.labels.sign}</span>
                <button type="button" className={`${css.paperButton} ${css.paperButtonSmall}`} onClick={() => pad.current?.clear()}>
                  {words.clear}
                </button>
              </div>
              <div className={css.signBox}>
                <SignaturePad ref={pad} label={snapshot.labels.sign} onInk={setInk} />
                <span className={css.signX} aria-hidden="true">✕</span>
              </div>
              <p className={css.paperMeta}>
                {snapshot.labels.date}: {today}
              </p>
              <p className={css.missing} role="status">
                {tried && missing.length ? fillWords(words.missing, { list: missing.join(", ") }) : ""}
              </p>
              {saveError && <p className={css.missing} role="alert">{saveError}</p>}
              <button type="button" className={css.doneButton} aria-disabled={missing.length > 0 || saving} onClick={submit}>
                {saving ? (lang === "es" ? "Guardando…" : "Saving…") : nothing ? words.donePrivate : words.done}
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
