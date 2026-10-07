"use client";

import type { ReactNode } from "react";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

interface Props {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: ReactNode;
  detail?: ReactNode;
  aside?: ReactNode;
  seed: number;
}

/** Accessible radio option drawn as a chalk box. */
export default function ChoiceCard({ name, value, checked, onSelect, title, detail, aside, seed }: Props) {
  const id = `${name}-${value}`;
  return (
    <div className={cn(styles.choice, checked ? styles.choiceChecked : "")}>
      <input
        id={id}
        className={styles.choiceInput}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
      />
      <label htmlFor={id} className={styles.choiceLabel}>
        <ChalkBox
          className={styles.choiceBox}
          seed={seed}
          wobble={2.2}
          strokeWidth={checked ? 3 : 2.2}
          color={checked ? "var(--sun-yellow)" : "var(--chalk-white)"}
          double={checked}
        >
          <span className={styles.choiceMark} aria-hidden="true">
            {checked && <ChalkDoodle name="check" size={26} color="var(--sun-yellow)" strokeWidth={3.6} />}
          </span>
          <span className={cn(styles.choiceText, "chalk-soft")}>
            <span className={styles.choiceTitle}>{title}</span>
            {detail && <span className={styles.choiceDetail}>{detail}</span>}
          </span>
          {aside && <span className={cn(styles.choiceAside, "chalk-soft")}>{aside}</span>}
        </ChalkBox>
      </label>
    </div>
  );
}
