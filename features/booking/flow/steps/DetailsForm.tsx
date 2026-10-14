"use client";

import { useState } from "react";
import { site } from "@/config/site";
import { babyAgeOptions } from "@/config/booking";
import type { Bundle } from "@/config/bundles";
import { formatMoney, toCents } from "@/lib/pricing/engine";
import type { BookingConsents } from "@/lib/booking";
import { includesSiblings } from "@/lib/booking/bundle-traits";
import { fill } from "@/lib/email/messages";
import BackdropPicker from "@/features/booking/backdrops/BackdropPicker";
import type en from "@/messages/en.json";
import type { BabyDraft, ContactDraft, ContactErrors } from "../booking-state";
import styles from "../Booking.module.css";
import { cn } from "@/lib/cn";

/* ---------------- twins / triplets choice (after Baby 1 on the details step) ---------------- */

function ExtraBabiesPicker({ bundle, count, checking, onChange, messages }: { bundle: Bundle; count: number; checking: boolean; onChange: (count: number) => void; messages: typeof en.bookingFlow.details.extraBabies }) {
  const addon = bundle.extraBaby;
  const [expanded, setExpanded] = useState(count > 1);
  if (!addon?.active) return null;
  const max = Math.min(3, addon.maxBabies);
  const choices = [
    { count: 2, label: messages.two, price: addon.price, minutes: addon.extraMinutes, photos: addon.extraPhotos },
    { count: 3, label: messages.three, price: addon.price * 2, minutes: addon.extraMinutes * 2, photos: addon.extraPhotos * 2 },
  ].filter((choice) => choice.count <= max);
  return (
    <div className={styles.extraBabiesPrompt}>
      <p className={cn(styles.extraBabiesIncluded, "chalk-soft")}>{messages.included}</p>
      <button type="button" className={cn(styles.extraBabiesToggle, "chalk-soft")} aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
        {messages.question}
      </button>
      <p className={cn(styles.extraBabiesHint, "chalk-soft")}>
        {fill(messages.details, { price: formatMoney(toCents(addon.price)), minutes: String(addon.extraMinutes), photos: String(addon.extraPhotos) })} {messages.fullPrice}
      </p>
      {expanded && (
        <div className={styles.extraBabiesChoices} role="group" aria-label={messages.choose}>
          {choices.map((choice) => (
            <button
              key={choice.count}
              type="button"
              className={cn(styles.extraBabyChoice, count === choice.count ? styles.extraBabyChoiceSelected : "", "chalk-soft")}
              aria-pressed={count === choice.count}
              disabled={checking}
              onClick={() => onChange(choice.count)}
            >
              <strong>{choice.label}</strong>
              <span>{fill(messages.choice, { price: formatMoney(toCents(choice.price)), minutes: String(choice.minutes), photos: String(choice.photos) })}</span>
            </button>
          ))}
          {count > 1 && (
            <button type="button" className={cn(styles.oneBabyButton, "chalk-soft")} disabled={checking} onClick={() => onChange(1)}>
              {messages.one}
            </button>
          )}
        </div>
      )}
      {checking && <p className={cn(styles.extraBabiesChecking, "chalk-soft")} role="status">{messages.checking}</p>}
    </div>
  );
}

/* ---------------- details form ---------------- */

export default function DetailsForm({
  contact,
  errors,
  onChange,
  babies,
  babyErrors,
  onBabyChange,
  bundle,
  checkingBabyCount,
  onBabyCountChange,
  consents,
  onConsent,
  hp,
  onHp,
  zipNote,
  backdrops,
  onBackdrops,
  setups,
  messages,
}: {
  contact: ContactDraft;
  errors: ContactErrors;
  onChange: (field: keyof ContactDraft, value: string) => void;
  babies: BabyDraft[];
  babyErrors: string[];
  onBabyChange: (index: number, field: keyof BabyDraft, value: string) => void;
  bundle: Bundle;
  checkingBabyCount: boolean;
  onBabyCountChange: (count: number) => void;
  consents: BookingConsents;
  onConsent: (field: keyof BookingConsents, value: boolean) => void;
  hp: string;
  onHp: (v: string) => void;
  /** Travel fee line under the ZIP box. */
  zipNote: { text: string; blocking: boolean } | null;
  backdrops: string[];
  onBackdrops: (picks: string[]) => void;
  /** Backdrops they can pick (one per setup). */
  setups: number;
  messages: typeof en.bookingFlow.details;
}) {
  /** Newborns up to 2 years for now: the note under the age box, split around the email link. */
  const olderNote = messages.baby.olderNote.split("{email}");
  const field = (
    name: keyof ContactDraft,
    label: string,
    opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" | "text" | "numeric"; maxLength?: number } = {},
  ) => {
    const errId = `field-${name}-error`;
    return (
      <div className={styles.field}>
        <label htmlFor={`field-${name}`} className={cn(styles.label, "chalk-soft")}>
          {label}
          {opts.optional && <span className={styles.optional}>{messages.optional}</span>}
        </label>
        <input
          id={`field-${name}`}
          className={styles.input}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          maxLength={opts.maxLength}
          value={contact[name]}
          onChange={(e) => onChange(name, e.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errId : undefined}
          required={!opts.optional}
        />
        {errors[name] && (
          <p id={errId} className={cn(styles.fieldError, "chalk-soft")}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  const babyCard = (baby: BabyDraft, index: number) => {
    const nameId = index === 0 ? "field-babyName" : `field-baby-${index}-name`;
    const ageId = index === 0 ? "field-babyAge" : `field-baby-${index}-age`;
    const errorId = `${ageId}-error`;
    return (
      <div key={index} className={styles.babyCard}>
        {babies.length > 1 && <p className={cn(styles.babyTitle, "chalk-soft")}>{fill(messages.baby.number, { number: String(index + 1) })}</p>}
        <label htmlFor={nameId} className={cn(styles.label, "chalk-soft")}>{messages.baby.name}<span className={styles.optional}>{messages.optional}</span></label>
        <input id={nameId} className={styles.input} value={baby.name} maxLength={80} autoComplete="off" onChange={(e) => onBabyChange(index, "name", e.target.value)} />
        <label htmlFor={ageId} className={cn(styles.label, "chalk-soft")}>{messages.baby.age}</label>
        <select id={ageId} className={styles.input} value={baby.age} onChange={(e) => onBabyChange(index, "age", e.target.value)} aria-invalid={Boolean(babyErrors[index])} aria-describedby={[babyErrors[index] && errorId, site.contact.email && "field-babyAge-hint"].filter(Boolean).join(" ") || undefined} required>
          <option value="">{messages.baby.chooseAge}</option>
          {babyAgeOptions.map((a, optionIndex) => <option key={a} value={a}>{messages.baby.ageOptions[optionIndex]}</option>)}
        </select>
        {babyErrors[index] && <p id={errorId} className={cn(styles.fieldError, "chalk-soft")}>{babyErrors[index]}</p>}
      </div>
    );
  };

  return (
    <div className={styles.form}>
      {/* Honeypot: hidden from people and screen readers; automated form-fillers tend to fill it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="th-leave-empty">{messages.honeypot}</label>
        <input id="th-leave-empty" name="th-leave-empty" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => onHp(e.target.value)} />
      </div>
      {field("parentName", messages.parentName, { autoComplete: "name" })}
      {field("email", messages.email, { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("phone", messages.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      <div className={cn(styles.fieldWide, styles.homeBlock)}>
        <p className={cn(styles.homeTitle, "chalk-soft")}>{messages.address.title}</p>
        <p className={cn(styles.homeText, "chalk-soft")}>{messages.address.help}</p>
      </div>
      <div className={cn(styles.fieldWide, styles.streetRow)}>
        {field("street", messages.address.street, { autoComplete: "address-line1" })}
        {field("unit", messages.address.unit, { optional: true, autoComplete: "address-line2", maxLength: 40 })}
      </div>
      {field("city", messages.address.city, { autoComplete: "address-level2" })}
      <div className={styles.field}>
        {field("zip", messages.address.zip, { autoComplete: "postal-code", inputMode: "numeric" })}
        {zipNote && !errors.zip && (
          <p id="field-zip-travel" className={cn(zipNote.blocking ? styles.fieldError : styles.optional, "chalk-soft")} aria-live="polite">
            {zipNote.text}
          </p>
        )}
      </div>
      <div className={cn(styles.field, styles.fieldWide)}>
        <label htmlFor="field-access" className={cn(styles.label, "chalk-soft")}>
          {messages.address.access}
          <span className={styles.optional}>{messages.optional}</span>
        </label>
        <textarea
          id="field-access"
          className={cn(styles.input, styles.textareaShort)}
          rows={2}
          maxLength={300}
          value={contact.access}
          onChange={(e) => onChange("access", e.target.value)}
          placeholder={messages.address.accessPlaceholder}
        />
      </div>
      <fieldset className={cn(styles.fieldset, styles.fieldWide, styles.babiesForm)}>
        <legend className={cn(styles.label, "chalk-soft")}>{babies.length > 1 ? messages.baby.many : messages.baby.one}</legend>
        <div className={styles.babiesGrid}>
          {babyCard(babies[0], 0)}
          <ExtraBabiesPicker bundle={bundle} count={babies.length} checking={checkingBabyCount} onChange={onBabyCountChange} messages={messages.extraBabies} />
          {babies.length > 1 && <div className={styles.extraBabiesGrid}>{babies.slice(1).map((baby, index) => babyCard(baby, index + 1))}</div>}
        </div>
        {site.contact.email && (
          <p id="field-babyAge-hint" className={cn(styles.optional, "chalk-soft")}>
            {olderNote[0]}<a href={`mailto:${site.contact.email}`} className={styles.inlineLink}>{site.contact.email}</a>{olderNote[1]}
          </p>
        )}
      </fieldset>
      <div className={cn(styles.field, styles.fieldWide)}>
        <label htmlFor="field-notes" className={cn(styles.label, "chalk-soft")}>
          {messages.notes.label}<span className={styles.optional}>{messages.optional}</span>
        </label>
        <textarea
          id="field-notes"
          className={cn(styles.input, styles.textarea)}
          rows={3}
          value={contact.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          // siblings only appear in the example when this bundle includes them
          placeholder={includesSiblings(bundle) ? messages.notes.placeholder : messages.notes.placeholderBabyOnly}
        />
      </div>
      <div className={cn(styles.field, styles.fieldWide)}>
        <p className={cn(styles.label, styles.flush, "chalk-soft")}>
          {setups > 1 ? messages.backdrops.titleMany : messages.backdrops.title}
        </p>
        <p className={cn(styles.optional, styles.flush, "chalk-soft")}>{setups > 1 ? fill(messages.backdrops.hintMany, { n: String(setups) }) : messages.backdrops.hint}</p>
        <BackdropPicker max={setups} value={backdrops} onChange={onBackdrops} label={setups > 1 ? messages.backdrops.titleMany : messages.backdrops.title} names={messages.backdrops.names} />
      </div>
      <fieldset className={cn(styles.fieldset, styles.field, styles.fieldWide)} aria-describedby="consents-hint">
        <legend className={cn(styles.label, "chalk-soft")}>
          {messages.consents.title}
          <span className={styles.optional}>{messages.optional}</span>
        </legend>
        {(["sms", "photos"] as const).map((key) => (
          <label key={key} className={cn(styles.consent, "chalk-soft")}>
            <input id={`field-consent-${key}`} type="checkbox" checked={consents[key]} onChange={(e) => onConsent(key, e.target.checked)} />
            <span>{messages.consents[key]}</span>
          </label>
        ))}
        <p id="consents-hint" className={cn(styles.optional, "chalk-soft")}>{messages.consents.hint}</p>
      </fieldset>
    </div>
  );
}
