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

export function emailTheme(themeId: string | null | undefined): EmailTheme {
  const t = getTheme(themeId);
  return {
    id: t.id,
    label: t.label,
    board: "#183a22",
    boardDark: "#10291a",
    chalk: t.colors.chalkWhite,
    muted: t.colors.chalkMuted,
    yellow: t.colors.sunYellow,
    blue: t.colors.cloudBlue,
    accent: t.colors.accent,
  };
}

export function emailImages(themeId: TinyHumansTheme) {
  return EMAIL_IMAGES[themeId] ?? EMAIL_IMAGES.default;
}
