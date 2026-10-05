"use client";

import { useRef } from "react";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import { colorVar, useDrawOnce } from "./BoardDoodles";
import styles from "./BoardDoodles.module.css";

/** A medium-sized chalk drawing (theme-based) that fills an empty spot on the board. */
export default function BoardScene({ index }: { index: number }) {
  const { theme } = useSiteSettings();
  const ref = useRef<HTMLDivElement>(null);
  const scene = theme.decorations.scenes[index % theme.decorations.scenes.length];
  useDrawOnce(ref, theme.id);
  const [[aShape, aColor], [bShape, bColor]] = scene.accents;
  return (
    <div ref={ref} className={`${styles.scene} chalk-grain`} aria-hidden="true" key={theme.id}>
      <span className={styles.sceneMain} style={{ "--i": 0 } as React.CSSProperties}>
        <ChalkDoodle name={scene.main[0]} size="100%" color={colorVar[scene.main[1]]} strokeWidth={2.2} drawable grain={false} />
      </span>
      <span className={styles.sceneAccentA} style={{ "--i": 3 } as React.CSSProperties}>
        <ChalkDoodle name={aShape} size="100%" color={colorVar[aColor]} strokeWidth={2.6} drawable grain={false} />
      </span>
      <span className={styles.sceneAccentB} style={{ "--i": 5 } as React.CSSProperties}>
        <ChalkDoodle name={bShape} size="100%" color={colorVar[bColor]} strokeWidth={2.6} drawable grain={false} />
      </span>
    </div>
  );
}
