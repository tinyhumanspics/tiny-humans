import { site } from "@/config/site";
import type { EmailAttachment, ImageMode } from "./types";
import { emailImages, type EmailTheme } from "./theme";

/**
 * Reusable Tiny Humans transactional layout: chalkboard green, chalk-white
 * text, yellow/blue chalk accents, seasonal logo and doodles.
 * Email-safe: tables, inline styles, no JS, Outlook fallbacks.
 * New emails (reminders, announcements...) should compose these blocks.
 */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CHALK_FONT = "'Schoolbell','Chalkboard SE','Segoe Print','Comic Sans MS',cursive";
const BODY_FONT = "Arial,Helvetica,sans-serif";

export interface LayoutInput {
  theme: EmailTheme;
  /** Hidden preview line shown in the inbox list. */
  preheader: string;
  /** Inner content (use the block helpers below). */
  body: string;
  images: ImageMode;
}

export function renderLayout({ theme: t, preheader, body, images }: LayoutInput): { html: string; attachments: EmailAttachment[] } {
  const imgs = emailImages(t.id);
  const attachments: EmailAttachment[] = [];
  const src = (key: "logo" | "strip") => {
    const im = imgs[key];
    if (images === "inline") return `data:${im.contentType};base64,${im.base64}`;
    const contentId = `th-${key}-${t.id}`;
    if (!attachments.some((a) => a.contentId === contentId)) attachments.push({ filename: im.filename, content: im.base64, contentType: im.contentType, contentId });
    return `cid:${contentId}`;
  };
  const logoW = 220;
  const logoH = Math.round((imgs.logo.height * logoW) / imgs.logo.width);
  const strip = `<img src="${src("strip")}" width="600" height="48" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none">`;
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>Tiny Humans</title>
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>@import url('https://fonts.googleapis.com/css2?family=Schoolbell&display=swap');
@media (max-width:620px){ .th-pad{padding-left:20px!important;padding-right:20px!important} .th-h1{font-size:28px!important} }</style>
</head>
<body style="margin:0;padding:0;background:${t.boardDark}" bgcolor="${t.boardDark}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${t.boardDark}">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.boardDark}" style="background:${t.boardDark}">
<tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.board}" style="width:100%;max-width:600px;background:${t.board};border:2px dashed rgba(244,242,234,0.35);border-radius:14px">
  <tr><td style="padding:10px 0 0">${strip}</td></tr>
  <tr><td align="center" style="padding:14px 20px 6px">
    <img src="${src("logo")}" width="${logoW}" height="${logoH}" alt="Tiny Humans" style="display:block;width:${logoW}px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto">
  </td></tr>
  ${body}
  <tr><td class="th-pad" style="padding:22px 36px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px dashed rgba(244,242,234,0.25);font-size:0;line-height:0">&nbsp;</td></tr></table>
    <p style="margin:14px 0 4px;font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${t.muted}">Tiny Humans · Newborn &amp; baby photography in ${esc(site.location)}. We bring the studio to you.</p>
    <p style="margin:0 0 8px;font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${t.muted}">
      <a href="mailto:${site.contact.email}" style="color:${t.blue};text-decoration:underline">${site.contact.email}</a> &nbsp;·&nbsp;
      <a href="${site.social.instagram.url}" style="color:${t.blue};text-decoration:underline">${site.social.instagram.handle ?? "Instagram"}</a>
    </p>
  </td></tr>
  <tr><td style="padding:0 0 12px">${strip}</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { html, attachments };
}

/* ---------------- blocks ---------------- */

export function heading(t: EmailTheme, eyebrow: string, title: string): string {
  return `<tr><td class="th-pad" align="center" style="padding:10px 36px 4px">
    <p style="margin:0 0 6px;font-family:${BODY_FONT};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${t.blue}">${esc(eyebrow)}</p>
    <h1 class="th-h1" style="margin:0;font-family:${CHALK_FONT};font-weight:normal;font-size:34px;line-height:1.15;color:${t.chalk}">${esc(title)}</h1>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 0"><tr><td width="130" height="4" bgcolor="${t.yellow}" style="width:130px;height:4px;background:${t.yellow};border-radius:3px;font-size:0;line-height:0">&nbsp;</td></tr></table>
  </td></tr>`;
}

export function paragraph(t: EmailTheme, html: string, opts: { align?: "left" | "center"; muted?: boolean } = {}): string {
  return `<tr><td class="th-pad" align="${opts.align ?? "left"}" style="padding:12px 36px 0;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${opts.muted ? t.muted : t.chalk}">${html}</td></tr>`;
}

/** Label / value rows with chalk dashed dividers. */
export function details(t: EmailTheme, rows: [string, string][]): string {
  const r = rows
    .map(
      ([k, v], i) => `<tr>
      <td valign="top" style="padding:9px 10px 9px 0;width:130px;font-family:${BODY_FONT};font-size:13px;color:${t.muted};${i ? "border-top:1px dashed rgba(244,242,234,0.22);" : ""}">${esc(k)}</td>
      <td valign="top" style="padding:9px 0;font-family:${CHALK_FONT};font-size:18px;line-height:1.35;color:${t.chalk};${i ? "border-top:1px dashed rgba(244,242,234,0.22);" : ""}">${esc(v).replace(/\n/g, "<br>")}</td>
    </tr>`,
    )
    .join("");
  return `<tr><td class="th-pad" style="padding:16px 36px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px dashed ${t.blue};border-bottom:2px dashed ${t.blue}">${r}</table>
  </td></tr>`;
}

/** A framed chalk box (e.g. Payment). */
export function chalkBox(t: EmailTheme, title: string, rows: [string, string][], note: string, color?: string): string {
  const c = color ?? t.yellow;
  const r = rows
    .map(
      ([k, v]) => `<tr><td style="padding:5px 10px 5px 0;width:130px;font-family:${BODY_FONT};font-size:13px;color:${t.muted}">${esc(k)}</td><td style="padding:5px 0;font-family:${CHALK_FONT};font-size:18px;color:${t.chalk}">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<tr><td class="th-pad" style="padding:18px 36px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed ${c};border-radius:10px"><tr><td style="padding:14px 18px">
      <p style="margin:0 0 6px;font-family:${CHALK_FONT};font-size:22px;color:${c}">${esc(title)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${r}</table>
      <p style="margin:10px 0 0;font-family:${BODY_FONT};font-size:14px;line-height:1.55;color:${t.chalk}">${esc(note)}</p>
    </td></tr></table>
  </td></tr>`;
}

/** Bulletproof button (works in Outlook): "solid" yellow or "outline" chalk. */
export function button(t: EmailTheme, label: string, href: string, variant: "solid" | "outline" = "solid", caption?: string): string {
  const solid = variant === "solid";
  const bg = solid ? t.yellow : t.board;
  const fg = solid ? t.boardDark : t.chalk;
  const border = solid ? t.yellow : t.chalk;
  return `<tr><td class="th-pad" align="center" style="padding:20px 36px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
      <td align="center" bgcolor="${bg}" style="background:${bg};border:2px solid ${border};border-radius:8px">
        <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${CHALK_FONT};font-size:19px;line-height:1.2;color:${fg};text-decoration:none">${esc(label)}</a>
      </td>
    </tr></table>
    ${caption ? `<p style="margin:8px 0 0;font-family:${BODY_FONT};font-size:12px;color:${t.muted}">${esc(caption)}</p>` : ""}
  </td></tr>`;
}

/** Plain-text version helper. */
export function textLines(lines: (string | false | undefined)[]): string {
  return lines.filter((l) => l !== false && l !== undefined).join("\n");
}
