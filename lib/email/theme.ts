import { getTheme, type TinyHumansTheme } from "@/config/themes";
import { EMAIL_IMAGES } from "./assets";

/**
 * Email version of a website theme: same Tiny Humans chalkboard identity,
 * seasonal logo + chalk doodles. Emails use the theme that is active on the
 * website when the email is sent.
 */
export interface EmailTheme {
  id: TinyHumansTheme;
  label: string;
  board: string;
  boardDark: string;
  chalk: string;
  muted: string;
  yellow: string;
  blue: string;
  accent: string;
}

/** The darker page color around the email card, per theme (same relationship to the board as the Original's green). */
const EMAIL_BOARD_DARK: Record<TinyHumansTheme, string> = {
  default: "#10291a",
  thanksgiving: "#663318",
  christmas: "#5a2423",
  newYear: "#101a31",
  valentines: "#f6e6c8",
};

export function emailTheme(themeId: string | null | undefined): EmailTheme {
  const t = getTheme(themeId);
  return {
    id: t.id,
    label: t.label,
    board: t.colors.chalkboard,
    boardDark: EMAIL_BOARD_DARK[t.id],
    chalk: t.colors.chalkWhite,
    muted: t.colors.chalkMuted,
    yellow: t.colors.sunYellow,
    blue: t.colors.cloudBlue,
    accent: t.colors.accent,
  };
}

/**
 * The theme's writing color at an opacity, for dashed rules and frames: the off-white chalk on the dark boards
 * (rgba(244,242,234,…), as before) and deep wine on Valentine's pink, so the lines show on every board.
 */
export function chalkAlpha(t: EmailTheme, alpha: number): string {
  const hex = t.chalk.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function emailImages(themeId: TinyHumansTheme) {
  return EMAIL_IMAGES[themeId] ?? EMAIL_IMAGES.default;
}
