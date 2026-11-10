/**
 * Chalk-drawing data for the VALENTINE'S logo (owner, Nov 10): the Original logo with little chalk hearts around it
 * (public/brand/valentines/decor.webp, drawn on the Original logo's 1012 x 896 canvas). Same sequence as the Original,
 * plus a "decor" step that draws the hearts before the lettering (the lettering starts 0.3 s later). Times in seconds.
 */
import { defaultLogoDrawing } from "./default-drawing";
import type { LogoDrawing } from "./types";

const HEARTS_TIME = 0.3;

export const valentinesLogoDrawing: LogoDrawing = {
  ...defaultLogoDrawing,
  layers: {
    ...defaultLogoDrawing.layers,
    decor: [
      { id: "decor0", d: "M7.0 25.0 L34.3 211.0 L61.6 25.0 L88.9 211.0 L116.2 25.0 L143.5 211.0 L170.8 25.0", length: 1128, width: 44, start: 1.36, duration: 0.214 },
      { id: "decor1", d: "M765.7 15.7 L793.0 220.3 L820.3 15.7 L847.6 220.3 L874.9 15.7 L902.2 220.3 L929.5 15.7 L956.8 220.3", length: 1445, width: 44, start: 1.395, duration: 0.24 },
      { id: "decor2", d: "M678.6 2.6 L705.9 89.4 L733.2 2.6 L760.5 89.4", length: 273, width: 44, start: 1.43, duration: 0.143 },
      { id: "decor3", d: "M264.0 6.0 L291.3 78.0 L318.6 6.0", length: 154, width: 44, start: 1.465, duration: 0.133 },
      { id: "decor4", d: "M940.0 264.0 L967.3 336.0 L994.6 264.0", length: 154, width: 44, start: 1.5, duration: 0.133 },
      { id: "decor5", d: "M11.2 509.2 L38.5 610.8 L65.8 509.2 L93.1 610.8", length: 316, width: 44, start: 1.535, duration: 0.146 },
      { id: "decor6", d: "M926.3 556.3 L953.6 635.7 L980.9 556.3", length: 168, width: 44, start: 1.57, duration: 0.134 },
    ],
    text: (defaultLogoDrawing.layers.text ?? []).map((stroke) => ({ ...stroke, start: +(stroke.start + HEARTS_TIME).toFixed(3) })),
  },
};
