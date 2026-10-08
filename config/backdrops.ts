/**
 * Backdrops families pick from (owner, Oct 7; Beige + Wooden added Oct 7). Shown as swatches on the booking form, the
 * backdrop page and the confirmation/reminder emails; names live in messages (emails.backdrops.names). A color swatch is
 * a soft glow from `glow` (center) to `edge` (email clients without gradients show the solid `color`); `image` is a
 * drawn texture (public/, also attached to emails).
 */
export interface Backdrop {
  id: string;
  color: string;
  glow: string;
  edge: string;
  image?: string;
}

export const BACKDROPS = [
  { id: "blueAura", color: "#93b6d9", glow: "#c7dcee", edge: "#6f98c2" },
  { id: "burgundy", color: "#75293a", glow: "#8e3a4a", edge: "#5c1f2b" },
  { id: "cream", color: "#efe3cc", glow: "#f7eedd", edge: "#e3d2b4" },
  { id: "white", color: "#f7f7f4", glow: "#ffffff", edge: "#e7e7e1" },
  { id: "beige", color: "#d3bc99", glow: "#e4d3b8", edge: "#bfa57f" },
  { id: "wooden", color: "#9a6a42", glow: "#b07e52", edge: "#7c5233", image: "/backdrops/wooden.jpg" },
] as const satisfies readonly Backdrop[];

export type BackdropId = (typeof BACKDROPS)[number]["id"];
export const BACKDROP_IDS = BACKDROPS.map((b) => b.id) as [BackdropId, ...BackdropId[]];

/** How many backdrops a bundle gets: one per setup ("2 setups" in its details), at least 1, at most 3. */
export function setupsOf(texts: (string | null | undefined)[]): number {
  for (const t of texts) {
    const n = Number(t?.match(/(\d+)\s*set-?ups?/i)?.[1]);
    if (n > 0) return Math.min(n, 3);
  }
  return 1;
}
