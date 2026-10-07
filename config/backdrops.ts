/**
 * Backdrops families pick from (owner, Oct 7). Shown as color swatches in the confirmation and reminder emails;
 * names live in messages (emails.backdrops.names). Each swatch is a soft glow from `glow` (center) to `edge`;
 * email clients without gradients (Outlook) show the solid `color`.
 */
export const BACKDROPS = [
  { id: "blueAura", color: "#93b6d9", glow: "#c7dcee", edge: "#6f98c2" },
  { id: "burgundy", color: "#75293a", glow: "#8e3a4a", edge: "#5c1f2b" },
  { id: "cream", color: "#efe3cc", glow: "#f7eedd", edge: "#e3d2b4" },
  { id: "white", color: "#f7f7f4", glow: "#ffffff", edge: "#e7e7e1" },
] as const;

export type BackdropId = (typeof BACKDROPS)[number]["id"];
