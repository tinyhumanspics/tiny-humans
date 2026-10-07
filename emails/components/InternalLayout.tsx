import { Fragment, type ReactNode } from "react";
import { Head, Html } from "react-email";

/** Internal emails for Tiny Humans: plain, scannable, light background, no images. */
export const INTERNAL_COLORS = { green: "#183a22", yellow: "#fcd91c", red: "#b3261e", blue: "#2a6f9b", ink: "#1f2a22", muted: "#5b6b5f" };
const C = INTERNAL_COLORS;

export function InternalLayout({ banner, bannerBg, bannerFg, summary, rows, footer }: { banner: string; bannerBg: string; bannerFg: string; summary: ReactNode; rows: [string, string][]; footer: ReactNode }) {
  return (
    <Html>
      <Head />
      <body style={{ margin: 0, padding: 0, background: "#f2f2f2" }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ padding: "20px 10px", background: "#f2f2f2" }}>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ maxWidth: 600, background: "#ffffff", borderRadius: 10, overflow: "hidden", fontFamily: "Arial,Helvetica,sans-serif" }}>
                <tr>
                  <td bgcolor={bannerBg} style={{ background: bannerBg, padding: "16px 22px", color: bannerFg, fontSize: 20, fontWeight: "bold", letterSpacing: 1 }}>
                    {banner}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "16px 22px 6px", fontSize: 16, color: C.ink }}>{summary}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 22px 20px" }}>
                    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse" }}>
                      {rows.map(([label, value], i) => (
                        <tr key={label} style={{ background: i % 2 ? "#ffffff" : "#f6f8f6" }}>
                          <td style={{ padding: "8px 10px", width: 150, fontSize: 13, color: C.muted, verticalAlign: "top" }}>{label}</td>
                          <td style={{ padding: "8px 10px", fontSize: 15, color: C.ink, fontWeight: "bold" }}>
                            {value.split("\n").map((line, j) => (
                              <Fragment key={j}>
                                {j > 0 && <br />}
                                {line}
                              </Fragment>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "0 22px 20px", fontSize: 13, color: C.muted }}>{footer}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </Html>
  );
}
