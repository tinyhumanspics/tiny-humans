"use client";

import type { CSSProperties } from "react";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import type en from "@/messages/en.json";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

interface Props {
  current: number;
  maxReached: number;
  onGo: (step: number) => void;
  messages: typeof en.bookingFlow;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

export default function StepTracker({ current, maxReached, onGo, messages }: Props) {
  const steps = messages.steps;
  return (
    <nav aria-label={messages.tracker.label} className={styles.trackerNav}>
      <p className={cn(styles.trackerMobile, "chalk-soft")}>
        {fill(messages.tracker.mobile, { current: String(current + 1), total: String(steps.length), label: steps[current].label })}
      </p>
      <ol className={styles.tracker} style={{ "--steps": steps.length } as CSSProperties}>
        {steps.map((step, i) => {
          const done = i < current && i <= maxReached;
          const reachable = i <= maxReached;
          return (
            <li key={step.id} className={cn(styles.trackerItem, i === current ? styles.trackerCurrent : "", done ? styles.trackerDone : "")}>
              <button
                type="button"
                className={styles.trackerButton}
                onClick={() => onGo(i)}
                disabled={!reachable}
                aria-current={i === current ? "step" : undefined}
                aria-label={fill(messages.tracker.step, { current: String(i + 1), label: step.label, done: done ? messages.tracker.done : "" })}
              >
                <span className={cn(styles.trackerNum, "chalk-soft")}>
                  {done ? <ChalkDoodle name="check" size={22} color="var(--sun-yellow)" strokeWidth={3.6} /> : i + 1}
                  <ChalkDoodle name="circle" size="100%" strokeWidth={3.5} className={styles.trackerCircle} stretch />
                </span>
                <span className={cn(styles.trackerLabel, "chalk-soft")}>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
