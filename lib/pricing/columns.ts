import type { CSSProperties } from "react";

/**
 * How many bundle cards sit side by side (owner, Nov 10: "in case I add another bundle, these 3 move to the left and
 * I can add another one to the right… on the phone at the bottom"). Phones: one under the other (CSS). Tablets and
 * small laptops (900 px+): up to 3, four as 2 × 2. Laptops and up (1180 px+): up to 4 in one row; more wrap.
 * Returned as CSS variables for the grid (`--cols-md`, `--cols-lg`); each card is at most 380 px wide, centered, so
 * one or two bundles never stretch across the page.
 */
export function bundleColumns(count: number): CSSProperties {
  const n = Math.max(1, Math.trunc(count));
  const md = n === 4 ? 2 : Math.min(n, 3);
  const lg = Math.min(n, 4);
  return { "--cols-md": md, "--cols-lg": lg } as CSSProperties;
}
