import { site } from "@/config/site";
import { formatLongDate } from "@/lib/booking/dates";
import type { SignedWaiver } from "@/lib/waiver/types";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import PrintButton from "./PrintButton";
import WaiverPaper, { Mark } from "./WaiverPaper";
import css from "./Waiver.module.css";

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
const contact = { phone: site.contact.phone, email: site.contact.email ?? "" };

function miami(iso: string, lang: "en" | "es") {
  const d = new Date(iso);
  return {
    day: formatLongDate(d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), lang),
    time: d.toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }),
  };
}

/** A link that isn't valid (or a release that isn't there): how to get a copy, in both languages. */
export function WaiverCopyInvalid() {
  return (
    <div className={css.kiosk}>
      <div className={css.bar}>
        <span className={css.brand}><span className={css.sun} aria-hidden="true" />Tiny Humans</span>
      </div>
      <div className={css.body}>
        <p className={css.notice} role="alert">{fill(en.waiverPage.invalid, contact)}</p>
        <p className={css.notice} lang="es">{fill(es.waiverPage.invalid, contact)}</p>
      </div>
    </div>
  );
}

/**
 * /waiver?w=…&s=…: the parent's own copy of the release they signed (owner, Nov 11), linked from the copy we email.
 * The exact words they signed (the stored snapshot), ✓/✗ on each choice, their signature and when, in the language
 * they signed in; "Print or save as PDF" uses the browser.
 */
export default function WaiverCopyPage({ waiver: w }: { waiver: SignedWaiver }) {
  const s = w.snapshot;
  const lang = s.language === "es" ? "es" : "en";
  const x = (lang === "es" ? es : en).waiverPage;
  const signed = miami(w.signedAt, lang);
  return (
    <div className={css.kiosk} lang={lang}>
      <div className={`${css.bar} ${css.noPrint}`}>
        <span className={css.brand}><span className={css.sun} aria-hidden="true" />{x.title}</span>
        <span className={css.ownerBox}>
          <PrintButton label={x.print} className={css.barButton} />
        </span>
      </div>
      <div className={css.body}>
        {w.status === "revoked" && <p className={`${css.notice} ${css.noPrint}`} role="note">{fill(x.revoked, { day: w.revokedAt ? miami(w.revokedAt, lang).day : "" })}</p>}
        {w.status === "superseded" && <p className={`${css.notice} ${css.noPrint}`} role="note">{x.superseded}</p>}
        <p className={`${css.summary} ${css.noPrint}`}>{x.lead}</p>
        <WaiverPaper
          snapshot={s}
          choices={
            <ul className={css.choices}>
              {s.uses.map((u) => (
                <Mark key={u.key} on={w.uses[u.key]} lang={lang}>{u.label}</Mark>
              ))}
            </ul>
          }
          firstName={
            s.firstName && (
              <ul className={css.choices}>
                <Mark on={w.firstNameOk} lang={lang}>{s.firstName.label}</Mark>
              </ul>
            )
          }
          you={
            <>
              <p>
                <b>{s.labels.fullName}:</b> {w.signerName}
                <br />
                <b>{s.labels.relationship}:</b> {w.relationship === "guardian" ? s.labels.guardian : s.labels.parent}
              </p>
              <ul className={css.choices}>
                <Mark on lang={lang}>{s.labels.agree}</Mark>
              </ul>
              <div className={css.signedBox}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the database, not an optimizable file */}
                <img src={w.signature} alt={fill((lang === "es" ? es : en).emails.waiverCopy.signatureAlt, { name: w.signerName })} />
              </div>
              <p className={css.paperMeta}>{fill(x.signed, signed)}</p>
              <p className={css.paperMeta}>{fill(x.record, { version: w.version, id: w.sha256.slice(0, 16), reference: w.reference })}</p>
            </>
          }
        />
        <p className={`${css.summary} ${css.noPrint}`}>{fill(x.change, contact)}</p>
      </div>
    </div>
  );
}
