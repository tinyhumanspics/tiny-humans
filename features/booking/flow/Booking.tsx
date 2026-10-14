"use client";

import Link from "next/link";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import { bookingSteps, bundlesHref, STEP } from "@/config/booking";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import Reveal from "@/components/layout/Reveal/Reveal";
import { isFloridaZip } from "@/lib/travel/types";
import { travelHint } from "@/lib/travel/format";
import { fill } from "@/lib/email/messages";
import { addPhotos, sessionMinutes } from "@/lib/booking/extra-babies";
import InspirationThumb from "@/features/booking/InspirationThumb";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import BabyLedNote from "./BabyLedNote";
import Calendar from "./Calendar";
import StepTracker from "./StepTracker";
import Confirmation from "./Confirmation";
import TimeStep from "./steps/TimeStep";
import DetailsForm from "./steps/DetailsForm";
import ReviewStep from "./steps/ReviewStep";
import { flowDurationLabel } from "./booking-state";
import { useBookingFlow } from "./useBookingFlow";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

/** The booking calendar for one bundle (chosen on the bundles page). State and actions live in useBookingFlow. */
export default function Booking({ bundleId, locale = "en", messages }: { bundleId: string; locale?: AppLocale; messages: typeof en.bookingFlow }) {
  const id = "book";
  const flow = useBookingFlow(bundleId, locale, messages);
  const {
    state, dispatch, router, selection, headingRef, panelRef, hp, setHp, days, loadingDays, studioToday, month, setMonth,
    inspiration, bundle, today, addon, zip, travel, travelChecking, backdrops, setBackdrops, setups, checkingBabyCount,
    changeBabyCount, depositOffer, redirecting, depositCents, deposit, goTo, goBack, next, submit, daySlots,
  } = flow;

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.section.title} subtitle={messages.section.subtitle} slot="book" level={1} />
        {state.status !== "done" && bundle && (
          <div className={styles.bundleSummary}>
            {inspiration && <InspirationThumb photo={inspiration} size={44} />}
            <div className={styles.summaryText}>
              <p className="chalk-soft">
                <span className={styles.chipLabel}>{messages.summary.yourBundle}</span>{" "}
                <span className={styles.bundleName}>{bundle.name}</span>
                <span className={styles.bundleMeta}>
                  {formatMoney(activeOffer(bundle, today)?.cents ?? toCents(bundle.price))} · {bundle.duration}{bundle.photos ? ` · ${fill(messages.summary.editedPhotos, { count: bundle.photos })}` : ""}
                </span>
                {depositOffer?.amountCents ? <span className={styles.bundleMeta}>{fill(messages.summary.deposit, { deposit: formatMoney(depositOffer.amountCents) })}</span> : null}
                {addon && <span className={styles.bundleMeta}>{addon.quantity === 1 ? messages.summary.extraBaby : messages.summary.extraBabies}: +{formatMoney(addon.totalCents)} · {fill(messages.summary.totalDuration, { duration: flowDurationLabel(sessionMinutes(bundle, state.babies.length), messages.summary) })} · {fill(messages.summary.editedPhotos, { count: addPhotos(bundle.photos, addon.extraPhotos) })}</span>}
              </p>
              {inspiration && (
                <p className={cn(styles.summaryPhoto, "chalk-soft")}>
                  <span className={styles.chipLabel}>{messages.summary.inspiredBy}</span> {inspiration.title}{" "}
                  <button type="button" className={cn(styles.inlineLink, "chalk-soft")} onClick={() => selection.setInspirationId(null)} aria-label={messages.summary.removeInspiration}>
                    {messages.summary.remove}
                  </button>
                </p>
              )}
            </div>
            <Link href={bundlesHref(selection.inspirationId, locale)} className={cn(styles.linkButton, "chalk-soft")}>
              {messages.summary.changeBundle}
            </Link>
          </div>
        )}
        <BabyLedNote messages={messages.babyLed} multiple={state.babies.length > 1} />

        <Reveal>
        <div ref={panelRef} className={styles.panelAnchor} data-booking-panel>
          <ChalkBox className={styles.panel} seed={7} wobble={4} strokeWidth={3}>
            {state.status === "done" && state.result ? (
              <Confirmation
                result={state.result}
                travelEstimate={travel ? { feeCents: travel.status === "fee" ? travel.feeCents : 0, miles: travel.miles } : undefined}
                headingRef={headingRef}
                onReset={() => router.push(bundlesHref(undefined, locale))}
                locale={locale}
                messages={messages}
              />
            ) : (
              <>
                <StepTracker current={state.step} maxReached={state.maxStep} onGo={goTo} messages={messages} />

                <div className={styles.stepBody}>
                  <h2 ref={headingRef} tabIndex={-1} className={cn(styles.stepTitle, "chalk")}>
                    {messages.steps[state.step].title}
                  </h2>

                  {state.step === STEP.date && (
                    <Calendar
                        todayKey={studioToday}
                        month={month}
                        onMonthChange={setMonth}
                        days={days}
                        loading={loadingDays}
                        selected={state.date}
                        onSelect={(d) => dispatch({ type: "date", date: d })}
                        messages={messages.calendar}
                        locale={locale}
                      />
                  )}

                  {state.step === STEP.time && state.date && (
                    <TimeStep date={state.date} slots={daySlots} selectedId={state.slot?.id} onSelect={(slot) => dispatch({ type: "slot", slot })} locale={locale} messages={messages.time} />
                  )}

                  {state.step === STEP.details && (
                    <DetailsForm
                      contact={state.contact}
                      errors={state.fieldErrors}
                      onChange={(field, value) => dispatch({ type: "contact", field, value })}
                      babies={state.babies}
                      babyErrors={state.babyErrors}
                      onBabyChange={(index, field, value) => dispatch({ type: "baby", index, field, value })}
                      bundle={bundle!}
                      checkingBabyCount={checkingBabyCount}
                      onBabyCountChange={changeBabyCount}
                      consents={state.consents}
                      onConsent={(field, value) => dispatch({ type: "consent", field, value })}
                      hp={hp}
                      onHp={setHp}
                      backdrops={backdrops}
                      onBackdrops={setBackdrops}
                      setups={setups}
                      messages={messages.details}
                      zipNote={
                        /^\d{5}$/.test(zip) && !isFloridaZip(zip)
                          ? { text: messages.details.travel.outsideFlorida, blocking: true }
                          : travelChecking
                            ? { text: messages.details.travel.checking, blocking: false }
                            : travel
                              ? travelHint(travel, messages.details.travel)
                              : null
                      }
                    />
                  )}

                  {state.step === STEP.review && <ReviewStep flow={flow} locale={locale} messages={messages} />}

                  {state.stepError && (
                    <p className={cn(styles.error, "chalk-soft")} role="alert">
                      {state.stepError}
                    </p>
                  )}
                </div>

                <div className={styles.actions}>
                  {state.step > 0 ? (
                    <ChalkButton variant="outline" onClick={goBack} seed={81}>
                      {messages.actions.back}
                    </ChalkButton>
                  ) : (
                    <span />
                  )}
                  {state.step < bookingSteps.length - 1 ? (
                    <ChalkButton variant="solid" onClick={next} seed={82}>
                      {fill(messages.actions.next, { label: messages.steps[state.step + 1].label })}
                    </ChalkButton>
                  ) : (
                    <ChalkButton variant="solid" onClick={submit} disabled={state.status === "submitting"} seed={83}>
                      {redirecting ? messages.review.deposit.opening : state.status === "submitting" ? messages.actions.booking : depositCents > 0 ? fill(messages.review.deposit.button, { deposit }) : messages.actions.book}
                    </ChalkButton>
                  )}
                </div>
              </>
            )}
          </ChalkBox>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
