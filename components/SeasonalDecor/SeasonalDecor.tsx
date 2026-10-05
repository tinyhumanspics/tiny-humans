"use client";

import type { CSSProperties } from "react";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import type { ScatterDoodle } from "@/config/themes";
import styles from "./SeasonalDecor.module.css";

const colorVar: Record<ScatterDoodle["color"], string> = {
  accent: "var(--accent)",
  accent2: "var(--accent-2)",
  accent3: "var(--accent-3)",
  sun: "var(--sun-yellow)",
  cloud: "var(--cloud-blue)",
  white: "var(--chalk-white)",
};

/** Seasonal chalk doodles in the page margins (wide screens only, never over content). */
export default function SeasonalDecor() {
  const { theme } = useSiteSettings();
  if (!theme.decorations.scatter.length) return null;
  return (
    <div className={styles.layer} aria-hidden="true" key={theme.id}>
      {theme.decorations.scatter.map((d, i) => (
        <span
          key={i}
          className={styles.item}
          style={{ top: `${d.top}%`, [d.side]: `${d.inset}%`, rotate: `${d.rotate}deg` } as CSSProperties}
        >
          <ChalkDoodle name={d.shape} size={d.size} color={colorVar[d.color]} strokeWidth={2.6} />
        </span>
      ))}
    </div>
  );
}
