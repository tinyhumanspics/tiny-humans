"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { INTRO_DONE_EVENT } from "@/components/Reveal/Reveal";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import type { BoardArea, DoodleColor } from "@/config/themes";
import styles from "./BoardDoodles.module.css";

export const colorVar: Record<DoodleColor, string> = {
  accent: "var(--accent)",
  accent2: "var(--accent-2)",
  accent3: "var(--accent-3)",
  sun: "var(--sun-yellow)",
  cloud: "var(--cloud-blue)",
  white: "var(--chalk-white)",
};

/**
 * Little chalk drawings on the board (which ones depends on the theme).
 * Place inside a positioned parent. Each set sketches itself once, the
 * first time it scrolls into view.
 */
export default function BoardDoodles({ area, only }: { area: BoardArea; /** show just one drawing from the area */ only?: number }) {
  const { theme } = useSiteSettings();
  const ref = useRef<HTMLDivElement>(null);
  const all = theme.decorations.board[area];
  const items = only === undefined ? all : [all[only % all.length]];

  useDrawOnce(ref, theme.id);

  return (
    <div ref={ref} className={`${styles.layer} chalk-grain`} aria-hidden="true" key={theme.id}>
      {items.map((d, i) => (
        <span
          key={i}
          className={`${styles.item} ${d.desktopOnly ? styles.desktopOnly : ""}`}
          style={{ top: d.top, right: d.right, bottom: d.bottom, left: d.left, rotate: `${d.rotate}deg`, "--i": i } as CSSProperties}
        >
          <ChalkDoodle name={d.shape} size={d.size} color={colorVar[d.color]} strokeWidth={2.6} drawable grain={false} />
        </span>
      ))}
    </div>
  );
}

/**
 * Marks an element "pending" and then "drawn" the first time it scrolls
 * into view (after the logo intro). CSS turns that into a chalk sketch.
 */
export function useDrawOnce(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.draw = "pending";
    let io: IntersectionObserver | null = null;
    const start = () => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.dataset.draw = "drawn";
          io?.disconnect();
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
    };
    if (document.documentElement.hasAttribute("data-intro")) window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
    else start();
    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      io?.disconnect();
    };
  }, [ref, key]);
}
