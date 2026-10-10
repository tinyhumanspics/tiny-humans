"use client";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { site } from "@/config/site";

/** Last-resort error page (replaces the root layout, so it carries its own minimal styling). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = typeof window !== "undefined" && (window.location.pathname === "/es" || window.location.pathname.startsWith("/es/")) ? "es" : "en";
  const t = (locale === "es" ? es : en).errors.global;
  const email = site.contact.email;
  return (
    <html lang={locale}>
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#183a22", color: "#f4f2ea", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <main style={{ maxWidth: 520, border: "2px dashed rgba(244,242,234,.6)", borderRadius: 14, padding: 28 }}>
          <h1 style={{ marginTop: 0, fontSize: "1.8rem" }}>{t.title}</h1>
          <p style={{ lineHeight: 1.6, opacity: 0.9 }}>{t.body}</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 0 }}>
            <button type="button" onClick={() => reset()} style={{ background: "#f2c94c", color: "#183a22", border: 0, borderRadius: 10, padding: "10px 18px", fontSize: "1rem", cursor: "pointer" }}>
              {t.retry}
            </button>
            {email && (
              <a href={`mailto:${email}`} style={{ color: "#f4f2ea", padding: "10px 4px" }}>
                {email}
              </a>
            )}
          </p>
        </main>
      </body>
    </html>
  );
}
