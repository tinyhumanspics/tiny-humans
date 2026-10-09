"use client";

import type { CSSProperties } from "react";
import { BACKDROPS, type Backdrop } from "@/config/backdrops";
import { backdropName } from "@/lib/booking/backdrop-names";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { cn } from "@/lib/cn";
import styles from "./BackdropPicker.module.css";

const swatchStyle = (b: Backdrop): CSSProperties =>
  b.image
    ? { backgroundColor: b.color, backgroundImage: `url(${b.image})`, backgroundSize: "cover" }
    : { backgroundColor: b.color, backgroundImage: `radial-gradient(circle at 50% 42%, ${b.glow} 0%, ${b.color} 55%, ${b.edge} 100%)` };

/**
 * Backdrop swatches to tap. One per setup: with room left a tap adds, when full it swaps out the oldest pick
 * (one setup: a tap replaces). Tapping a picked one removes it.
 */
export default function BackdropPicker({ max, value, onChange, label, names }: { max: number; value: string[]; onChange: (picks: string[]) => void; label: string; names?: Record<string, string> }) {
  const toggle = (id: string) => {
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    onChange(value.length >= max ? [...value.slice(value.length - max + 1), id] : [...value, id]);
  };
  return (
    <div role="group" aria-label={label} className={styles.grid}>
      {BACKDROPS.map((b) => {
        const on = value.includes(b.id);
        return (
          <button key={b.id} type="button" aria-pressed={on} className={cn(styles.item, on && styles.on)} onClick={() => toggle(b.id)}>
            <span className={styles.swatch} style={swatchStyle(b)} aria-hidden="true">
              {on && <ChalkDoodle name="check" size={30} color="var(--sun-yellow)" strokeWidth={4} className={styles.check} />}
            </span>
            <span className={cn(styles.name, "chalk-soft")}>{names?.[b.id] ?? backdropName(b.id)}</span>
          </button>
        );
      })}
    </div>
  );
}
