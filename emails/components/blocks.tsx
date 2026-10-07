import { Fragment, type ReactNode } from "react";
import type { EmailTheme } from "@/lib/email/theme";

/**
 * Chalkboard email blocks: each one is a full-width table row inside ChalkLayout.
 * Email-safe: tables, inline styles, bulletproof buttons (work in Outlook). Compose new emails from these.
 */
export const CHALK_FONT = "'Schoolbell','Chalkboard SE','Segoe Print','Comic Sans MS',cursive";
export const BODY_FONT = "Arial,Helvetica,sans-serif";
const ROW_RULE = "1px dashed rgba(244,242,234,0.22)";

/** "a\nb" → a<br>b */
function lines(value: string): ReactNode {
  return value.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

export function Heading({ theme: t, eyebrow, title }: { theme: EmailTheme; eyebrow: string; title: string }) {
  return (
    <tr>
      <td className="th-pad" align="center" style={{ padding: "10px 36px 4px" }}>
        <p style={{ margin: "0 0 6px", fontFamily: BODY_FONT, fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", color: t.blue }}>{eyebrow}</p>
        <h1 className="th-h1" style={{ margin: 0, fontFamily: CHALK_FONT, fontWeight: "normal", fontSize: 34, lineHeight: 1.15, color: t.chalk }}>
          {title}
        </h1>
        <table role="presentation" align="center" cellPadding="0" cellSpacing="0" border={0} style={{ margin: "10px auto 0" }}>
          <tr>
            <td width="130" height="4" bgcolor={t.yellow} style={{ width: 130, height: 4, background: t.yellow, borderRadius: 3, fontSize: 0, lineHeight: 0 }}>
              {" "}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  );
}

export function Paragraph({ theme: t, children, align = "left", muted }: { theme: EmailTheme; children: ReactNode; align?: "left" | "center"; muted?: boolean }) {
  return (
    <tr>
      <td className="th-pad" align={align} style={{ padding: "12px 36px 0", fontFamily: BODY_FONT, fontSize: 16, lineHeight: 1.6, color: muted ? t.muted : t.chalk }}>
        {children}
      </td>
    </tr>
  );
}

/** Label / value rows with chalk dashed dividers. Values may contain line breaks ("\n"). */
export function Details({ theme: t, rows }: { theme: EmailTheme; rows: [string, string][] }) {
  return (
    <tr>
      <td className="th-pad" style={{ padding: "16px 36px 0" }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ borderTop: `2px dashed ${t.blue}`, borderBottom: `2px dashed ${t.blue}` }}>
          {rows.map(([label, value], i) => (
            <tr key={label}>
              <td valign="top" style={{ padding: "9px 10px 9px 0", width: 130, fontFamily: BODY_FONT, fontSize: 13, color: t.muted, borderTop: i ? ROW_RULE : undefined }}>
                {label}
              </td>
              <td valign="top" style={{ padding: "9px 0", fontFamily: CHALK_FONT, fontSize: 18, lineHeight: 1.35, color: t.chalk, borderTop: i ? ROW_RULE : undefined }}>
                {lines(value)}
              </td>
            </tr>
          ))}
        </table>
      </td>
    </tr>
  );
}

/** A framed chalk box (e.g. Payment). */
export function ChalkBox({ theme: t, title, rows, note, color }: { theme: EmailTheme; title: string; rows: [string, string][]; note: string; color?: string }) {
  const c = color ?? t.yellow;
  return (
    <tr>
      <td className="th-pad" style={{ padding: "18px 36px 0" }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ border: `2px dashed ${c}`, borderRadius: 10 }}>
          <tr>
            <td style={{ padding: "14px 18px" }}>
              <p style={{ margin: "0 0 6px", fontFamily: CHALK_FONT, fontSize: 22, color: c }}>{title}</p>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: "5px 10px 5px 0", width: 130, fontFamily: BODY_FONT, fontSize: 13, color: t.muted }}>{label}</td>
                    <td style={{ padding: "5px 0", fontFamily: CHALK_FONT, fontSize: 18, color: t.chalk }}>{value}</td>
                  </tr>
                ))}
              </table>
              <p style={{ margin: "10px 0 0", fontFamily: BODY_FONT, fontSize: 14, lineHeight: 1.55, color: t.chalk }}>{note}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  );
}

/** Bulletproof button (works in Outlook): "solid" yellow or "outline" chalk. */
export function ChalkButton({ theme: t, label, href, variant = "solid", caption }: { theme: EmailTheme; label: string; href: string; variant?: "solid" | "outline"; caption?: string }) {
  const solid = variant === "solid";
  const bg = solid ? t.yellow : t.board;
  return (
    <tr>
      <td className="th-pad" align="center" style={{ padding: "20px 36px 0" }}>
        <table role="presentation" cellPadding="0" cellSpacing="0" border={0} align="center">
          <tr>
            <td align="center" bgcolor={bg} style={{ background: bg, border: `2px solid ${solid ? t.yellow : t.chalk}`, borderRadius: 8 }}>
              <a href={href} target="_blank" style={{ display: "inline-block", padding: "12px 28px", fontFamily: CHALK_FONT, fontSize: 19, lineHeight: 1.2, color: solid ? t.boardDark : t.chalk, textDecoration: "none" }}>
                {label}
              </a>
            </td>
          </tr>
        </table>
        {caption && <p style={{ margin: "8px 0 0", fontFamily: BODY_FONT, fontSize: 12, color: t.muted }}>{caption}</p>}
      </td>
    </tr>
  );
}
