"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { site } from "@/config/site";
import type { LogoDrawState } from "@/components/TinyHumansLogo/TinyHumansLogo";
import { INTRO_DONE_EVENT } from "@/components/Reveal/Reveal";

/** Intrinsic width the logo is rendered at; the header scales it down. */
export const LOGO_BASE_WIDTH = 520;

function preload(srcs: string[], timeoutMs: number): Promise<void> {
  const loads = srcs.map(
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
        if (img.complete) resolve();
      }),
  );
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/**
 * Orchestrates the opening sequence:
 *   draw (~2.4s, logo centered and large) -> move into header (~1.1s).
 * The header logo element itself is transformed, so only one logo exists.
 * Waits until the active theme is known (`ready`), then runs once.
 */
export function useIntroAnimation(logoRef: RefObject<HTMLDivElement | null>, ready: boolean, assets: string[]) {
  const [drawState, setDrawState] = useState<LogoDrawState>("drawn");
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    const root = document.documentElement;
    const mode = root.getAttribute("data-intro");
    const el = logoRef.current;
    if (!mode || !el) return;
    started.current = true;

    const reduced = mode === "reduced";
    const timers: number[] = [];
    let cancelled = false;

    // The intro always starts and ends at the top of the page, unless the
    // visitor arrived on a section link (e.g. /book#book).
    const keepTop = !window.location.hash;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const toTop = () => keepTop && window.scrollTo({ top: 0, behavior: "instant" });
    toTop();

    // iOS ignores overflow:hidden for touch scrolling, so block it directly.
    const blockScroll = (e: Event) => e.preventDefault();
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("wheel", blockScroll, { passive: false });

    const finish = () => {
      window.removeEventListener("touchmove", blockScroll);
      window.removeEventListener("wheel", blockScroll);
      root.removeAttribute("data-intro");
      root.removeAttribute("data-intro-phase");
      if (keepTop) toTop();
      else document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ behavior: "instant", block: "start" });
      el.style.transition = "";
      el.style.transform = "";
      setDrawState("drawn");
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
    };

    // Place the header logo large and centered on screen.
    const slot = el.getBoundingClientRect();
    const aspect = slot.height / slot.width || 0.88;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetW = Math.min(vw * 0.82, LOGO_BASE_WIDTH, (vh * 0.52) / aspect);
    const scale = targetW / LOGO_BASE_WIDTH;
    const targetH = targetW * aspect;
    const tx = (vw - targetW) / 2 - slot.left;
    const ty = (vh - targetH) / 2 - vh * 0.03 - slot.top;
    el.style.transition = "none";
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    setDrawState(reduced ? "drawn" : "hidden");

    const drawMs = reduced ? site.intro.reducedMotionHoldMs : site.intro.drawMs;
    const moveMs = reduced ? site.intro.reducedMotionMoveMs : site.intro.moveMs;

    preload(assetsRef.current, 1800).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        root.setAttribute("data-intro-phase", "drawing");
        if (!reduced) setDrawState("drawing");
        timers.push(
          window.setTimeout(() => {
            toTop();
            root.setAttribute("data-intro-phase", "moving");
            root.style.setProperty("--intro-move-ms", `${moveMs}ms`);
            el.style.transition = `transform ${moveMs}ms var(--ease-chalk)`;
            el.style.transform = "";
            timers.push(window.setTimeout(finish, moveMs + 40));
          }, drawMs),
        );
      });
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      finish();
    };
  }, [ready, logoRef]);

  return drawState;
}
