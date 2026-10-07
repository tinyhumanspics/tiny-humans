import type { ReactNode } from "react";
import { Head, Html, Img, Preview } from "react-email";
import { site } from "@/config/site";
import type { EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import type { EmailTheme } from "@/lib/email/theme";
import { BODY_FONT } from "./blocks";

const HEAD_CSS = `@import url('https://fonts.googleapis.com/css2?family=Schoolbell&display=swap');
@media (max-width:620px){ .th-pad{padding-left:20px!important;padding-right:20px!important} .th-h1{font-size:28px!important} }`;

/**
 * Customer email layout: chalkboard green, chalk-white text, yellow/blue chalk accents, the active website theme's
 * logo and doodle strips. Children are block rows from ./blocks.
 */
export function ChalkLayout({ theme: t, images, locale, preheader, children }: { theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; preheader: string; children: ReactNode }) {
  const m = emailMessages(locale).layout;
  const logoW = 220;
  const logoH = Math.round((images.logo.height * logoW) / images.logo.width);
  const strip = <Img src={images.strip.src} width="600" height="48" alt="" style={{ display: "block", width: "100%", maxWidth: 600, height: "auto", border: 0, outline: "none", textDecoration: "none" }} />;
  const footerText = { margin: 0, fontFamily: BODY_FONT, fontSize: 13, lineHeight: 1.6, color: t.muted };
  const link = { color: t.blue, textDecoration: "underline" };
  const email = site.contact.email;
  return (
    <Html lang={locale}>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <title>{site.name}</title>
        <style dangerouslySetInnerHTML={{ __html: HEAD_CSS }} />
      </Head>
      <body style={{ margin: 0, padding: 0, background: t.boardDark }} bgcolor={t.boardDark}>
        <Preview useTitleTag={false}>{preheader}</Preview>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} bgcolor={t.boardDark} style={{ background: t.boardDark }}>
          <tr>
            <td align="center" style={{ padding: "24px 10px" }}>
              <table role="presentation" width="600" cellPadding="0" cellSpacing="0" border={0} bgcolor={t.board} style={{ width: "100%", maxWidth: 600, background: t.board, border: "2px dashed rgba(244,242,234,0.35)", borderRadius: 14 }}>
                <tr>
                  <td style={{ padding: "10px 0 0" }}>{strip}</td>
                </tr>
                <tr>
                  <td align="center" style={{ padding: "14px 20px 6px" }}>
                    <Img src={images.logo.src} width={logoW} height={logoH} alt={m.logoAlt} style={{ display: "block", width: logoW, maxWidth: "70%", height: "auto", border: 0, outline: "none", textDecoration: "none", margin: "0 auto" }} />
                  </td>
                </tr>
                {children}
                <tr>
                  <td className="th-pad" style={{ padding: "22px 36px 8px" }}>
                    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0}>
                      <tr>
                        <td style={{ borderTop: "2px dashed rgba(244,242,234,0.25)", fontSize: 0, lineHeight: 0 }}>{" "}</td>
                      </tr>
                    </table>
                    <p style={{ ...footerText, margin: "14px 0 4px" }}>{fill(m.footer, { location: site.location })}</p>
                    <p style={{ ...footerText, margin: "0 0 8px" }}>
                      {email && (
                        <>
                          <a href={`mailto:${email}`} style={link}>
                            {email}
                          </a>
                          {"  ·  "}
                        </>
                      )}
                      <a href={site.social.instagram.url} style={link}>
                        {site.social.instagram.handle ?? site.social.instagram.label}
                      </a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "0 0 12px" }}>{strip}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </Html>
  );
}
