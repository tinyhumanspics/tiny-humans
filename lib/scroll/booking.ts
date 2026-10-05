"use client";

/**
 * Scrolls so the whole booking box is on screen, including its bottom
 * border. If the box is taller than the screen, its top is shown just
 * below the header instead.
 */
export function scrollToBooking(behavior: ScrollBehavior = "smooth"): boolean {
  const section = document.getElementById("book");
  const panel = document.querySelector<HTMLElement>("[data-booking-panel]");
  if (!section || !panel) return false;
  const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  const y = window.scrollY;
  const vh = window.innerHeight;
  const sectionTop = section.getBoundingClientRect().top + y - header - 12;
  const box = panel.getBoundingClientRect();
  const panelTop = box.top + y;
  const panelBottom = box.bottom + y;
  // prefer the section heading at the top, but scroll further if needed to show the box's bottom line
  let target = Math.max(sectionTop, panelBottom + 14 - vh);
  // never push the top of the box under the header
  target = Math.min(target, panelTop - header - 8);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, target), behavior: reduced ? "auto" : behavior });
  return true;
}

let pending = false;

/** Ask the booking page to scroll to the booking box once it has opened. */
export function requestBookingScroll() {
  pending = true;
}

export function consumeBookingScroll(): boolean {
  const p = pending;
  pending = false;
  return p;
}
