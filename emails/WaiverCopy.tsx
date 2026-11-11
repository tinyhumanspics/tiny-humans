import { Img } from "react-email";
import { site } from "@/config/site";
import { formatLongDate } from "@/lib/booking/dates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { EmailAttachment, ImageMode, RenderedEmail } from "@/lib/email/types";
import { WAIVER_USES, type WaiverSnapshot, type WaiverUses } from "@/lib/waiver/text";
import { BODY_FONT, CHALK_FONT, ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

/** What the parent signed (lib/waiver/server.ts → getSignedWaiver). */
export interface WaiverCopyDetails {
  reference: string;
  signerName: string;
  relationship: "parent" | "guardian";
  /** ISO time it was signed. */
  signedAt: string;
  uses: WaiverUses;
  firstNameOk: boolean;
  /** The exact words they saw and signed (stored with the signature). */
  snapshot: WaiverSnapshot;
  sha256: string;
  /** The signature, PNG base64 (no data: prefix). */
  signaturePng: string;
  /** Their own copy on the website (print or save as PDF); null without ADMIN_SESSION_SECRET. */
  copyUrl?: string | null;
}

interface Options {
  themeId: string;
  images?: ImageMode;
}

const PAPER = { bg: "#fffdf7", ink: "#1f2a22", muted: "#5b6b5f", line: "#e4dccb", yes: "#1d6b3a", no: "#9b1029" };
const SIGNATURE_CID = "th-waiver-signature";

/** "Monday, November 16, 2026 at 10:42 AM (Miami time)" in the signed language. */
function signedWhen(iso: string, locale: EmailLocale): string {
  const d = new Date(iso);
  const day = formatLongDate(d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), locale);
  const time = d.toLocaleTimeString(locale === "es" ? "es-US" : "en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return fill(emailMessages(locale).waiverCopy.when, { day, time });
}

const lines = (d: WaiverCopyDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).waiverCopy;
  const s = d.snapshot;
  const choices = WAIVER_USES.map((key) => ({ on: Boolean(d.uses[key]), label: s.uses.find((u) => u.key === key)?.label ?? key }));
  return {
    x,
    intro: fill(x.intro, { name: d.signerName.split(" ")[0] }),
    choices,
    firstName: s.firstName ? { heading: s.firstName.heading, on: d.firstNameOk, label: s.firstName.label } : null,
    who: `${d.signerName} · ${d.relationship === "guardian" ? s.labels.guardian : s.labels.parent}`,
    when: signedWhen(d.signedAt, locale),
    record: fill(x.record, { version: s.version, id: d.sha256.slice(0, 16), reference: d.reference }),
    change: fill(x.change, { phone: site.contact.phone, email: site.contact.email ?? "" }),
  };
};

/** One ✓ / ✗ line of the paper. */
function Choice({ on, label, yes, no }: { on: boolean; label: string; yes: string; no: string }) {
  return (
    <tr>
      <td valign="top" style={{ padding: "5px 10px 5px 0", width: 52, fontFamily: BODY_FONT, fontSize: 14, fontWeight: "bold", color: on ? PAPER.yes : PAPER.no, whiteSpace: "nowrap" }}>
        {on ? yes : no}
      </td>
      <td valign="top" style={{ padding: "5px 0", fontFamily: BODY_FONT, fontSize: 15, lineHeight: 1.45, color: PAPER.ink }}>{label}</td>
    </tr>
  );
}

const h2 = { margin: "18px 0 6px", fontFamily: CHALK_FONT, fontWeight: "normal", fontSize: 20, color: PAPER.ink } as const;
const p = { margin: "0 0 8px", fontFamily: BODY_FONT, fontSize: 15, lineHeight: 1.55, color: PAPER.ink } as const;

/** The signed photo and video release, mailed to the parent the moment they sign (owner, Nov 11). */
export function WaiverCopy({ details: d, theme: t, images, locale, signatureSrc }: { details: WaiverCopyDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; signatureSrc: string }) {
  const { x, intro, choices, firstName, who, when, record, change } = lines(d, locale);
  const s = d.snapshot;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={s.title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      {d.copyUrl && <ChalkButton theme={t} label={x.button} href={d.copyUrl} variant="solid" />}
      <tr>
        <td className="th-pad" style={{ padding: "18px 36px 0" }}>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} bgcolor={PAPER.bg} style={{ background: PAPER.bg, borderRadius: 10, border: `1px solid ${PAPER.line}` }}>
            <tr>
              <td style={{ padding: "20px 22px 18px" }} lang={s.language}>
                <p style={{ ...p, fontFamily: CHALK_FONT, fontSize: 15, color: PAPER.muted, margin: "0 0 2px" }}>Tiny Humans</p>
                <p style={{ ...h2, fontSize: 24, margin: "0 0 8px" }}>{s.title}</p>
                <p style={p}>{s.intro}</p>
                <p style={{ ...p, color: PAPER.muted, fontSize: 14 }}>{s.facts}</p>
                <p style={h2}>{s.whereHeading}</p>
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
                  {choices.map((c) => (
                    <Choice key={c.label} on={c.on} label={c.label} yes={x.yes} no={x.no} />
                  ))}
                </table>
                {firstName && (
                  <>
                    <p style={h2}>{firstName.heading}</p>
                    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
                      <Choice on={firstName.on} label={firstName.label} yes={x.yes} no={x.no} />
                    </table>
                  </>
                )}
                <p style={h2}>{s.promisesHeading}</p>
                {s.promises.map((line) => (
                  <p key={line} style={{ ...p, paddingLeft: 14 }}>• {line}</p>
                ))}
                <p style={h2}>{s.fineHeading}</p>
                <p style={{ ...p, fontSize: 14 }}>{s.fine}</p>
                <p style={h2}>{s.youHeading}</p>
                <p style={p}>{who}</p>
                <Img src={signatureSrc} width="260" alt={fill(x.signatureAlt, { name: d.signerName })} style={{ display: "block", width: 260, maxWidth: "100%", height: "auto", border: `1px solid ${PAPER.line}`, borderRadius: 6, background: "#ffffff", margin: "4px 0 8px" }} />
                <p style={{ ...p, color: PAPER.muted, fontSize: 13 }}>{when}</p>
                <p style={{ ...p, color: PAPER.muted, fontSize: 12, margin: 0 }}>{record}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <Paragraph theme={t} align="center">
        {change}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function waiverCopyEmail(d: WaiverCopyDetails, opts: Options): Promise<RenderedEmail> {
  const locale: EmailLocale = d.snapshot.language === "es" ? "es" : "en";
  const theme = emailTheme(opts.themeId);
  const mode = opts.images ?? "cid";
  const images = emailImageSet(theme.id, mode);
  const signature: EmailAttachment = { filename: "signature.png", content: d.signaturePng, contentType: "image/png", contentId: SIGNATURE_CID };
  const signatureSrc = mode === "cid" ? `cid:${SIGNATURE_CID}` : `data:image/png;base64,${d.signaturePng}`;
  const { x, intro, choices, firstName, who, when, record, change } = lines(d, locale);
  const s = d.snapshot;
  const html = await renderHtml(<WaiverCopy details={d} theme={theme} images={images} locale={locale} signatureSrc={signatureSrc} />);
  const text = textLines([
    intro,
    ...(d.copyUrl ? [fill(x.buttonText, { url: d.copyUrl })] : []),
    "",
    s.title,
    s.facts,
    "",
    s.whereHeading,
    ...choices.map((c) => `${c.on ? x.yes : x.no}  ${c.label}`),
    ...(firstName ? ["", firstName.heading, `${firstName.on ? x.yes : x.no}  ${firstName.label}`] : []),
    "",
    s.promisesHeading,
    ...s.promises.map((line) => `• ${line}`),
    "",
    s.fineHeading,
    s.fine,
    "",
    s.youHeading,
    who,
    when,
    record,
    "",
    change,
    fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: x.subject, html, text, attachments: mode === "cid" ? [...images.attachments, signature] : images.attachments };
}
