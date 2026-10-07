"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import styles from "./AfterSession.module.css";

const m = en.review;
type View = "loading" | "invalid" | "form" | "done";
type Field = "rating" | "body" | "name";

/** /review?t=… (link in the gallery email): a short review form; saved with the booking for the owner in /admin. */
export default function ReviewForm() {
  const token = useSearchParams().get("t") ?? "";
  const [view, setView] = useState<View>(token ? "loading" : "invalid");
  const [firstName, setFirstName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/review?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { firstName: string; suggestedName: string; review: { rating: number; body: string; displayName: string; consentPublic: boolean } | null };
        setFirstName(data.firstName);
        setDisplayName(data.review?.displayName ?? data.suggestedName);
        if (data.review) {
          setUpdating(true);
          setRating(data.review.rating);
          setBody(data.review.body);
          setConsent(data.review.consentPublic);
        }
        setView("form");
      })
      .catch(() => setView("invalid"));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (rating < 1) next.rating = m.errors.rating;
    if (body.trim().length < 3) next.body = m.errors.body;
    if (!displayName.trim()) next.name = m.errors.name;
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(next.rating ? "review-star-5" : next.body ? "review-body" : "review-name")?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, rating, body: body.trim(), displayName: displayName.trim(), consentPublic: consent }) });
      if (res.status === 404) return setView("invalid");
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? m.errors.failed);
      setView("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : m.errors.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("container", styles.page)} aria-labelledby="review-title">
      <ChalkBox className={styles.panel} seed={421} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={cn(styles.text, "chalk-soft")}>{m.loading}</p>}

        {view === "invalid" && (
          <>
            <h1 id="review-title" className={cn(styles.title, "chalk")}>{m.invalidTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.invalidText}</p>
            <ChalkButton href="/" variant="outline" seed={422}>{m.home}</ChalkButton>
          </>
        )}

        {view === "form" && (
          <form onSubmit={submit} noValidate>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{m.eyebrow.replace("{name}", firstName)}</p>
            <h1 id="review-title" className={cn(styles.title, "chalk")}>{m.title}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.intro}</p>

            <fieldset className={styles.stars} aria-describedby={errors.rating ? "review-rating-error" : undefined}>
              <legend className={cn(styles.label, "chalk-soft")}>{m.ratingLabel}</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={styles.star}>
                  <input id={`review-star-${n}`} type="radio" name="rating" value={n} checked={rating === n} onChange={() => { setRating(n); setErrors((x) => ({ ...x, rating: undefined })); }} aria-label={m.stars[n - 1]} />
                  <span aria-hidden="true" data-on={n <= rating}>★</span>
                </label>
              ))}
            </fieldset>
            {errors.rating && <p id="review-rating-error" className={cn(styles.error, "chalk-soft")} role="alert">{errors.rating}</p>}

            <label htmlFor="review-body" className={cn(styles.label, "chalk-soft")}>{m.bodyLabel}</label>
            <textarea id="review-body" className={styles.textarea} rows={5} maxLength={2000} value={body} placeholder={m.bodyPlaceholder} onChange={(e) => { setBody(e.target.value); setErrors((x) => ({ ...x, body: undefined })); }} aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? "review-body-error" : undefined} />
            {errors.body && <p id="review-body-error" className={cn(styles.error, "chalk-soft")} role="alert">{errors.body}</p>}

            <label htmlFor="review-name" className={cn(styles.label, "chalk-soft")}>{m.nameLabel}</label>
            <input id="review-name" className={styles.input} maxLength={60} value={displayName} autoComplete="off" onChange={(e) => { setDisplayName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "review-name-error" : "review-name-hint"} />
            <p id="review-name-hint" className={cn(styles.hint, "chalk-soft")}>{m.nameHint}</p>
            {errors.name && <p id="review-name-error" className={cn(styles.error, "chalk-soft")} role="alert">{errors.name}</p>}

            <label className={cn(styles.consent, "chalk-soft")}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{m.consent}</span>
            </label>

            {errors.form && <p className={cn(styles.error, "chalk-soft")} role="alert">{errors.form}</p>}
            <div className={styles.actions}>
              <span />
              <ChalkButton type="submit" variant="solid" disabled={busy} seed={423}>{busy ? m.sending : updating ? m.update : m.submit}</ChalkButton>
            </div>
          </form>
        )}

        {view === "done" && (
          <div className={styles.done} role="status">
            <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />
            <h1 id="review-title" className={cn(styles.title, "chalk")} tabIndex={-1}>{m.doneTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{m.doneText}</p>
            <div className={styles.actions}>
              <ChalkButton href="/" variant="outline" seed={424}>{m.home}</ChalkButton>
            </div>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
