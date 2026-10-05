export type LogoLayerName = "sun" | "rays" | "cloud" | "decor" | "text";

/** Drawing order for the opening animation. */
export const LOGO_LAYER_ORDER: LogoLayerName[] = ["sun", "rays", "cloud", "decor", "text"];

/** One chalk stroke used to reveal part of a logo layer. */
export interface LogoStroke {
  id: string;
  /** SVG path data in logo viewBox coordinates. */
  d: string;
  /** Pre-computed path length (avoids pathLength quirks in Safari). */
  length: number;
  /** Stroke thickness in viewBox units. */
  width: number;
  /** Seconds after the drawing begins. */
  start: number;
  /** Seconds this stroke takes to draw. */
  duration: number;
}

export interface LogoDrawing {
  width: number;
  height: number;
  /** "decor" is optional: seasonal logos use it for hats, leaves, snowflakes... */
  layers: Partial<Record<LogoLayerName, LogoStroke[]>>;
  /** Where the little chalk dust falls from under the lettering. */
  dust: { y: number; x0: number; x1: number };
}

export interface LogoAsset {
  /** Accessible name. */
  alt: string;
  /** Transparent artwork for each layer (same size as the viewBox). */
  layers: Partial<Record<LogoLayerName, string>>;
  drawing: LogoDrawing;
}
