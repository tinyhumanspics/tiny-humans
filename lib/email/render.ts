import type { ReactElement } from "react";
import { render } from "react-email";

/** Outlook desktop ignores font fallbacks: without this it shows Times New Roman when the chalk font is missing. */
const OUTLOOK_FONTS = "<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->";

/** Renders a React Email template to the HTML we send (React can't write conditional comments, so they're added here). */
export async function renderHtml(email: ReactElement): Promise<string> {
  const html = await render(email);
  return html.replace("</head>", `${OUTLOOK_FONTS}</head>`);
}

/** Plain-text version: one entry per line; false/undefined entries (optional lines) are left out. */
export function textLines(lines: (string | false | undefined)[]): string {
  return lines.filter((l) => l !== false && l !== undefined).join("\n");
}
