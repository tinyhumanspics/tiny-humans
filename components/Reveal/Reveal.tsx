"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import styles from "./Reveal.module.css";

export const INTRO_DONE_EVENT = "tinyhumans:intro-done";

interface Props {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Extra delay (ms) before this element starts drawing. */
  delay?: number;
  style?: CSSProperties;
  id?: string;
}

/**
 * Entrance behavior:
 *  - When a page opens, whatever is on screen is chalk-drawn once
 *    (soft chalk wipe + chalk frames drawing their lines).
 *  - After that, elements simply fade in and out as they scroll
 *    into and out of view, in either direction.
 *
 * Without JavaScript, or with reduced motion, content is simply visible.
 */
export default function Reveal({ children, as: Tag = "div", className, delay = 0, style, id }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let io: IntersectionObserver | null = null;
    let firstCheck = true;
    el.dataset.reveal = "hidden";

    const start = () => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (firstCheck) {
            // On screen as the page opens: draw it once. Otherwise: fade later.
            firstCheck = false;
            el.dataset.revealMode = entry.isIntersecting ? "draw" : "fade";
          }
          if (entry.isIntersecting) {
            if (el.dataset.reveal !== "hidden") return;
            el.dataset.reveal = "shown";
          } else {
            if (el.dataset.reveal === "hidden") return;
            el.dataset.revealMode = "fade";
            el.dataset.reveal = "hidden";
          }
        },
        { threshold: 0, rootMargin: "-6% 0px -6% 0px" },
      );
      io.observe(el);
    };

    const onAnimationEnd = (e: AnimationEvent) => {
      if (e.target === el && el.dataset.reveal === "shown" && el.dataset.revealMode === "draw") el.dataset.reveal = "done";
    };
    el.addEventListener("animationend", onAnimationEnd);

    // Wait for the logo intro so nothing draws behind it.
    const introActive = document.documentElement.hasAttribute("data-intro");
    if (introActive) window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
    else start();

    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      el.removeEventListener("animationend", onAnimationEnd);
      io?.disconnect();
      delete el.dataset.reveal;
      delete el.dataset.revealMode;
    };
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      className={`${styles.reveal} ${className ?? ""}`}
      style={{ ...style, ...(delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : null) }}
    >
      {children}
    </Tag>
  );
}
