"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import { FEEDBACK_REASONS, unfinishedRules, type FeedbackReason } from "@/config/unfinished";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/email/messages";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import styles from "@/features/after-session/AfterSession.module.css";
import own from "./Unfinished.module.css";

type View = "loading" | "invalid" | "form" | "done";

/** /feedback?t=… (link in the "What stopped you?" email): tap the reasons, add a comment; the owner sees it in /admin. */
export default function FeedbackForm({ locale = "en", messages = en.feedback }: { locale?: AppLocale; messages?: typeof en.feedback }) {
  const m = messages;
  const token = useSearchParams().get("t") ?? "";
  const [view, setView] = useState<View>(token ? "loading" : "invalid");
  const [firstName, setFirstName] = useState("");
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/feedback?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { firstName: string; reasons: FeedbackReason[]; comment: string };
        setFirstName(data.firstName);
        setReasons(data.reasons);
        setComment(data.comment);
        setView("form");
      })
      .catch(() => setView("invalid"));
  }, [token]);

  const toggle = (reason: FeedbackReason) => {
    setReasons((now) => (now.includes(reason) ? now.filter((r) => r !== reason) : [...now, reason]));
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reasons.length && !comment.trim()) {
      setError(m.errors.reason);
      document.getElementById(`feedback-${FEEDBACK_REASONS[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, reasons, comment: comment.trim() }) });
      if (res.status === 404) return setView("invalid");
      if (!res.ok) throw new Error(m.errors.failed);
      setView("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : m.errors.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("container", styles.page)} aria-labelledby="feedback-title">
      <ChalkBox className={styles.panel} seed={431} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={cn(styles.text, "chalk-soft")}>{m.loading}</p>}

        {view === "invalid" && (
          <>
            <h1 id="feedback-title" className={cn(styles.title, "chalk")}>{m.invalidTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.invalidText}</p>
          </>
        )}

        {view === "form" && (
          <form onSubmit={submit} noValidate>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{m.eyebrow}</p>
            <h1 id="feedback-title" className={cn(styles.title, "chalk")}>{firstName ? fill(m.title, { name: firstName }) : m.titleNoName}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.intro}</p>

            <fieldset className={own.reasons} aria-describedby={error ? "feedback-error" : undefined}>
              <legend className={cn(styles.label, "chalk-soft")}>{m.reasonsLabel}</legend>
              {FEEDBACK_REASONS.map((reason) => (
                <label key={reason} className={cn(styles.consent, "chalk-soft")}>
                  <input id={`feedback-${reason}`} type="checkbox" checked={reasons.includes(reason)} onChange={() => toggle(reason)} />
                  <span>{m.reasons[reason]}</span>
                </label>
              ))}
            </fieldset>

            <label htmlFor="feedback-comment" className={cn(styles.label, "chalk-soft")}>{m.commentLabel}</label>
            <textarea id="feedback-comment" className={styles.textarea} rows={4} maxLength={unfinishedRules.maxCommentLength} value={comment} onChange={(e) => { setComment(e.target.value); setError(null); }} />

            {error && <p id="feedback-error" className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
            <div className={styles.actions}>
              <span />
              <ChalkButton type="submit" variant="solid" disabled={busy} seed={432}>{busy ? m.sending : m.submit}</ChalkButton>
            </div>
          </form>
        )}

        {view === "done" && (
          <div className={styles.done} role="status">
            <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />
            <h1 id="feedback-title" className={cn(styles.title, "chalk")} tabIndex={-1}>{firstName ? fill(m.doneTitle, { name: firstName }) : m.doneTitleNoName}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.doneText}</p>
            <div className={styles.actions}>
              <ChalkButton href={localePath("/bundles", locale)} variant="outline" seed={433}>{m.bundlesLink}</ChalkButton>
            </div>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
