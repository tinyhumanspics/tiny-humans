import type { LogoAsset, LogoDrawing } from "./logo/types";
import type { DoodleShape } from "@/components/ChalkDoodle/shapes";
import { defaultLogoDrawing } from "./logo/default-drawing";
import { christmasLogoDrawing } from "./logo/christmas-drawing";
import { thanksgivingLogoDrawing } from "./logo/thanksgiving-drawing";
import { newYearLogoDrawing } from "./logo/new-year-drawing";

/**
 * Seasonal theme system.
 * One website, one source of truth. The live theme is chosen by the
 * owner in /admin (saved server-side). DEFAULT_THEME is used until then.
 */
export type TinyHumansTheme = "default" | "thanksgiving" | "christmas" | "newYear";

export const DEFAULT_THEME: TinyHumansTheme = "default";

export const THEME_IDS: TinyHumansTheme[] = ["default", "thanksgiving", "christmas", "newYear"];

export interface ThemeColors {
  chalkboard: string;
  chalkboardDark: string;
  chalkboardLight: string;
  sunYellow: string;
  cloudBlue: string;
  chalkWhite: string;
  chalkMuted: string;
  chalkError: string;
  /** Seasonal accents: doodles, photo tape, small details. */
  accent: string;
  accent2: string;
  accent3: string;
}

export interface ScatterDoodle {
  shape: DoodleShape;
  /** Which accent to draw it in. */
  color: "accent" | "accent2" | "accent3" | "sun" | "cloud" | "white";
  /** Position in the side margins, as % of the screen. */
  side: "left" | "right";
  top: number;
  inset: number;
  size: number;
  rotate: number;
}

export type DoodleColor = ScatterDoodle["color"];

/** Places on the page where little chalk drawings sit on the board. */
export type BoardArea = "hero" | "heading" | "cta" | "card" | "note";

export interface BoardDoodle {
  shape: DoodleShape;
  color: DoodleColor;
  /** CSS offsets inside the area (any of top/right/bottom/left). */
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  size: number;
  rotate: number;
  /** Wide screens only (sits in space that doesn't exist on phones). */
  desktopOnly?: boolean;
}

type Palette = [DoodleShape, DoodleColor][];

/** A medium-sized drawing that fills an empty spot in the portfolio grid. */
export interface BoardScene {
  main: [DoodleShape, DoodleColor];
  accents: [[DoodleShape, DoodleColor], [DoodleShape, DoodleColor]];
}

/**
 * One shared layout of open spots on the board; each theme fills it with
 * its own palette of drawings. Spots were chosen so drawings never sit on
 * top of photos, text or buttons, on phones or desktop.
 */
function boardFrom(p: Palette): Record<BoardArea, BoardDoodle[]> {
  const at = (i: number) => ({ shape: p[i % p.length][0], color: p[i % p.length][1] });
  return {
    hero: [
      { ...at(0), top: "0px", right: "2%", size: 44, rotate: -8 },
      { ...at(1), bottom: "4px", right: "6%", size: 52, rotate: 4 },
      { ...at(4), top: "38%", right: "-2%", size: 31, rotate: 12, desktopOnly: true },
    ],
    heading: [
      { ...at(2), top: "2px", right: "0px", size: 39, rotate: 10 },
      { ...at(3), top: "46px", right: "2px", size: 29, rotate: -12 },
      { ...at(5), top: "6px", right: "16%", size: 34, rotate: 6, desktopOnly: true },
    ],
    cta: [
      { ...at(1), top: "-24px", left: "6%", size: 36, rotate: -6 },
      { ...at(3), top: "34%", left: "1%", size: 47, rotate: 8, desktopOnly: true },
      { ...at(5), bottom: "8%", right: "1%", size: 42, rotate: -10, desktopOnly: true },
      { ...at(2), bottom: "-30px", right: "10%", size: 31, rotate: 10 },
    ],
    // one per bundle card, in the gap just below it
    card: [
      { ...at(0), bottom: "-34px", left: "12%", size: 34, rotate: -10 },
      { ...at(3), bottom: "-36px", right: "14%", size: 31, rotate: 8 },
      { ...at(4), bottom: "-34px", left: "40%", size: 34, rotate: -4 },
    ],
    // beside the baby-led note on the booking page
    note: [
      { ...at(1), top: "50%", right: "-80px", size: 52, rotate: 6, desktopOnly: true },
      { ...at(2), bottom: "-30px", right: "8%", size: 31, rotate: -8 },
    ],
  };
}

export interface ThemeDefinition {
  id: TinyHumansTheme;
  label: string;
  /** Button text in the owner area. */
  buttonLabel: string;
  colors: ThemeColors;
  logo: LogoAsset;
  decorations: {
    heading: { portfolio: DoodleShape; bundles: DoodleShape; book: DoodleShape };
    hero: [DoodleShape, DoodleShape];
    cards: [DoodleShape, DoodleShape, DoodleShape];
    cta: [DoodleShape, DoodleShape];
    /** Small chalk doodles in the page margins (wide screens only). */
    scatter: ScatterDoodle[];
    /** Little drawings on the board around headings, the hero and prompts. */
    board: Record<BoardArea, BoardDoodle[]>;
    /** Medium drawings for empty spots in the portfolio grid (used in turn). */
    scenes: [BoardScene, BoardScene, BoardScene];
  };
}

const board = {
  chalkboard: "#183a22",
  chalkboardDark: "#0f2817",
  chalkboardLight: "#22492d",
  sunYellow: "#fcd91c",
  cloudBlue: "#6cc6f7",
  chalkWhite: "#f4f2ea",
  chalkMuted: "#c6cbbd",
  chalkError: "#ffb3a8",
};

function logo(layers: LogoAsset["layers"], drawing: LogoDrawing): LogoAsset {
  return { alt: "Tiny Humans", layers, drawing };
}

export const themes: Record<TinyHumansTheme, ThemeDefinition> = {
  default: {
    id: "default",
    label: "Original",
    buttonLabel: "Original Theme",
    colors: { ...board, accent: board.sunYellow, accent2: board.cloudBlue, accent3: board.chalkWhite },
    logo: logo(
      { sun: "/brand/default/sun.webp", rays: "/brand/default/rays.webp", cloud: "/brand/default/cloud.webp", text: "/brand/default/text.webp" },
      defaultLogoDrawing,
    ),
    decorations: {
      heading: { portfolio: "heart", bundles: "star", book: "sparkle" },
      hero: ["heart", "sparkle"],
      cards: ["star", "heart", "sparkle"],
      cta: ["star", "heart"],
      scatter: [
        { shape: "sun", color: "sun", side: "left", top: 20, inset: 2.5, size: 55, rotate: 0 },
        { shape: "heart", color: "cloud", side: "left", top: 56, inset: 4, size: 36, rotate: -10 },
        { shape: "star", color: "white", side: "left", top: 84, inset: 2.5, size: 34, rotate: 12 },
        { shape: "cloud", color: "cloud", side: "right", top: 28, inset: 2, size: 70, rotate: 0 },
        { shape: "star", color: "sun", side: "right", top: 62, inset: 4, size: 36, rotate: -8 },
        { shape: "sparkle", color: "white", side: "right", top: 88, inset: 3, size: 31, rotate: 0 },
      ],
      board: boardFrom([
        ["star", "sun"],
        ["cloud", "cloud"],
        ["sun", "sun"],
        ["heart", "cloud"],
        ["sparkle", "white"],
        ["heart", "white"],
      ]),
      scenes: [
        { main: ["sun", "sun"], accents: [["cloud", "cloud"], ["star", "sun"]] },
        { main: ["cloud", "cloud"], accents: [["heart", "white"], ["sparkle", "sun"]] },
        { main: ["heart", "cloud"], accents: [["star", "sun"], ["sparkle", "white"]] },
      ],
    },
  },
  thanksgiving: {
    id: "thanksgiving",
    label: "Thanksgiving",
    buttonLabel: "Thanksgiving Theme",
    colors: { ...board, accent: "#f08b2e", accent2: "#e0574a", accent3: "#f2c14e" },
    logo: logo(
      {
        sun: "/brand/thanksgiving/sun.webp",
        rays: "/brand/thanksgiving/rays.webp",
        cloud: "/brand/thanksgiving/cloud.webp",
        decor: "/brand/thanksgiving/decor.webp",
        text: "/brand/thanksgiving/text.webp",
      },
      thanksgivingLogoDrawing,
    ),
    decorations: {
      heading: { portfolio: "mapleLeaf", bundles: "leaf", book: "pumpkin" },
      hero: ["mapleLeaf", "pumpkin"],
      cards: ["leaf", "mapleLeaf", "pumpkin"],
      cta: ["leaf", "mapleLeaf"],
      scatter: [
        { shape: "mapleLeaf", color: "accent2", side: "left", top: 22, inset: 2.5, size: 55, rotate: -18 },
        { shape: "leaf", color: "accent", side: "left", top: 58, inset: 4, size: 41, rotate: 24 },
        { shape: "swirl", color: "white", side: "left", top: 82, inset: 2, size: 36, rotate: 0 },
        { shape: "leaf", color: "accent3", side: "right", top: 30, inset: 3, size: 46, rotate: -30 },
        { shape: "pumpkin", color: "accent", side: "right", top: 66, inset: 2.5, size: 53, rotate: 6 },
        { shape: "mapleLeaf", color: "accent", side: "right", top: 88, inset: 4.5, size: 36, rotate: 20 },
      ],
      board: boardFrom([
        ["mapleLeaf", "accent2"],
        ["acorn", "accent3"],
        ["leaf", "accent"],
        ["pumpkin", "accent"],
        ["swirl", "white"],
        ["leaf", "accent3"],
      ]),
      scenes: [
        { main: ["pumpkin", "accent"], accents: [["leaf", "accent3"], ["mapleLeaf", "accent2"]] },
        { main: ["mapleLeaf", "accent2"], accents: [["acorn", "accent3"], ["swirl", "white"]] },
        { main: ["acorn", "accent3"], accents: [["leaf", "accent"], ["pumpkin", "accent"]] },
      ],
    },
  },
  christmas: {
    id: "christmas",
    label: "Christmas",
    buttonLabel: "Christmas Theme",
    colors: { ...board, accent: "#ee4b46", accent2: "#f4f2ea", accent3: "#5cba6c" },
    logo: logo(
      {
        sun: "/brand/christmas/sun.webp",
        rays: "/brand/christmas/rays.webp",
        cloud: "/brand/christmas/cloud.webp",
        decor: "/brand/christmas/decor.webp",
        text: "/brand/christmas/text.webp",
      },
      christmasLogoDrawing,
    ),
    decorations: {
      heading: { portfolio: "snowflake", bundles: "star", book: "candyCane" },
      hero: ["snowflake", "candyCane"],
      cards: ["snowflake", "holly", "star"],
      cta: ["snowflake", "holly"],
      scatter: [
        { shape: "snowflake", color: "white", side: "left", top: 18, inset: 3, size: 53, rotate: 0 },
        { shape: "candyCane", color: "accent", side: "left", top: 52, inset: 2.5, size: 48, rotate: -12 },
        { shape: "snowflake", color: "white", side: "left", top: 80, inset: 4.5, size: 34, rotate: 15 },
        { shape: "snowflake", color: "white", side: "right", top: 26, inset: 2.5, size: 41, rotate: 10 },
        { shape: "holly", color: "accent3", side: "right", top: 58, inset: 3, size: 50, rotate: -8 },
        { shape: "snowflake", color: "white", side: "right", top: 86, inset: 4, size: 48, rotate: -10 },
      ],
      board: boardFrom([
        ["snowflake", "white"],
        ["tree", "accent3"],
        ["ornament", "accent"],
        ["star", "sun"],
        ["candyCane", "accent"],
        ["snowflake", "white"],
      ]),
      scenes: [
        { main: ["tree", "accent3"], accents: [["star", "sun"], ["snowflake", "white"]] },
        { main: ["snowflake", "white"], accents: [["ornament", "accent"], ["candyCane", "accent"]] },
        { main: ["ornament", "accent"], accents: [["holly", "accent3"], ["snowflake", "white"]] },
      ],
    },
  },
  newYear: {
    id: "newYear",
    label: "New Year",
    buttonLabel: "New Year Theme",
    colors: { ...board, accent: "#ff74b1", accent2: "#7fe0a7", accent3: "#6cc6f7" },
    logo: logo(
      {
        sun: "/brand/newYear/sun.webp",
        rays: "/brand/newYear/rays.webp",
        cloud: "/brand/newYear/cloud.webp",
        decor: "/brand/newYear/decor.webp",
        text: "/brand/newYear/text.webp",
      },
      newYearLogoDrawing,
    ),
    decorations: {
      heading: { portfolio: "firework", bundles: "star", book: "partyHat" },
      hero: ["firework", "star"],
      cards: ["star", "firework", "sparkle"],
      cta: ["firework", "star"],
      scatter: [
        { shape: "firework", color: "accent", side: "left", top: 20, inset: 2.5, size: 60, rotate: 0 },
        { shape: "star", color: "sun", side: "left", top: 50, inset: 4.5, size: 31, rotate: 12 },
        { shape: "confetti", color: "accent2", side: "left", top: 78, inset: 2.5, size: 48, rotate: 0 },
        { shape: "firework", color: "accent3", side: "right", top: 28, inset: 3, size: 53, rotate: 0 },
        { shape: "confetti", color: "accent", side: "right", top: 60, inset: 2.5, size: 46, rotate: 30 },
        { shape: "star", color: "accent2", side: "right", top: 86, inset: 4.5, size: 34, rotate: -14 },
      ],
      board: boardFrom([
        ["firework", "accent"],
        ["balloon", "accent3"],
        ["star", "sun"],
        ["confetti", "accent2"],
        ["partyHat", "accent"],
        ["sparkle", "white"],
      ]),
      scenes: [
        { main: ["firework", "accent"], accents: [["star", "sun"], ["confetti", "accent2"]] },
        { main: ["balloon", "accent3"], accents: [["star", "sun"], ["sparkle", "white"]] },
        { main: ["partyHat", "accent"], accents: [["firework", "accent2"], ["confetti", "accent"]] },
      ],
    },
  },
};

export function getTheme(id: string | null | undefined): ThemeDefinition {
  return themes[(THEME_IDS as string[]).includes(id ?? "") ? (id as TinyHumansTheme) : DEFAULT_THEME];
}

/** CSS custom properties for a theme, applied on <html>. */
export function themeCssVariables(theme: ThemeDefinition): Record<string, string> {
  const c = theme.colors;
  return {
    "--chalkboard": c.chalkboard,
    "--chalkboard-dark": c.chalkboardDark,
    "--chalkboard-light": c.chalkboardLight,
    "--sun-yellow": c.sunYellow,
    "--cloud-blue": c.cloudBlue,
    "--chalk-white": c.chalkWhite,
    "--chalk-muted": c.chalkMuted,
    "--chalk-error": c.chalkError,
    "--accent": c.accent,
    "--accent-2": c.accent2,
    "--accent-3": c.accent3,
  };
}
