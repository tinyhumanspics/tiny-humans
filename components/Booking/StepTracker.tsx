"use client";

import { bookingSteps } from "@/config/booking";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./Booking.module.css";

interface Props {
  current: number;
  maxReached: number;
  onGo: (step: number) => void;
}

export default function StepTracker({ current, maxReached, onGo }: Props) {
  return (
    <nav aria-label="Booking steps" className={styles.trackerNav}>
      <p className={`${styles.trackerMobile} chalk-soft`}>
        Step {current + 1} of {bookingSteps.length}: {bookingSteps[current].label}
      </p>
      <ol className={styles.tracker}>
        {bookingSteps.map((step, i) => {
          const done = i < current && i <= maxReached;
          const reachable = i <= maxReached;
          return (
            <li key={step.id} className={`${styles.trackerItem} ${i === current ? styles.trackerCurrent : ""} ${done ? styles.trackerDone : ""}`}>
              <button
                type="button"
                className={styles.trackerButton}
                onClick={() => onGo(i)}
                disabled={!reachable}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Step ${i + 1}, ${step.label}${done ? ", done" : ""}`}
              >
                <span className={`${styles.trackerNum} chalk-soft`}>
                  {done ? <ChalkDoodle name="check" size={22} color="var(--sun-yellow)" strokeWidth={3.6} /> : i + 1}
                  <ChalkDoodle name="circle" size="100%" strokeWidth={3.5} className={styles.trackerCircle} stretch />
                </span>
                <span className={`${styles.trackerLabel} chalk-soft`}>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
