"use client";

import { completeWeekly, defaultAvailabilityRules } from "./defaults";
import type { AvailabilityRules } from "./types";

/** Prototype only: the owner's availability is kept in this browser. */
export const PROTOTYPE_AVAILABILITY_KEY = "tinyhumans:prototype-availability";

export function readPrototypeAvailability(): AvailabilityRules {
  try {
    const raw = window.localStorage.getItem(PROTOTYPE_AVAILABILITY_KEY);
    if (!raw) return defaultAvailabilityRules();
    const r = JSON.parse(raw) as AvailabilityRules;
    return { ...defaultAvailabilityRules(), ...r, weekly: completeWeekly(r.weekly ?? []) };
  } catch {
    return defaultAvailabilityRules();
  }
}

export function writePrototypeAvailability(rules: AvailabilityRules): void {
  window.localStorage.setItem(PROTOTYPE_AVAILABILITY_KEY, JSON.stringify(rules));
}
