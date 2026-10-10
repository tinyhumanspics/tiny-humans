"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { themes, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";
import { getAdminApi, PROTOTYPE_PASSWORD } from "@/lib/admin/client";
import type { LeadList } from "@/lib/leads/types";
import { formatMoney } from "@/lib/pricing/engine";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import TinyHumansLogo from "@/components/TinyHumansLogo/TinyHumansLogo";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import AvailabilityPanel from "./AvailabilityPanel";
import LeadsPanel from "./LeadsPanel";
import MediaPanel from "./MediaPanel";
import PricingPanel from "./PricingPanel";
import SeasonalPanel from "./SeasonalPanel";
import { ADMIN_NAV, type AdminSection } from "./nav";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Status = "loading" | "signedOut" | "ready";
type Note = { kind: "ok" | "error"; text: string } | null;

/** Where the admin menu was scrolled to (kept while moving between sections). */
let navScrollLeft = 0;

/** Owner area shell: sign-in, settings, navigation, then one section. */
export default function AdminApp({ section = "dashboard" }: { section?: AdminSection }) {
  const api = useMemo(() => getAdminApi(), []);
  const { applySettings } = useSiteSettings();
  const [status, setStatus] = useState<Status>("loading");
  const [storageReady, setStorageReady] = useState(true);
  const [authReady, setAuthReady] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [spanishStatus, setSpanishStatus] = useState<SpanishPublicationStatus | null>(null);
  const navRef = useRef<HTMLElement>(null);
  // Each section is its own page, so the menu is rebuilt on every click: put it back where it was.
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollLeft = navScrollLeft;
  }, [status]);

  const load = async () => {
    const [s, publication] = await Promise.all([
      api.getSettings(),
      section === "settings" ? api.getSpanishPublication() : Promise.resolve(null),
    ]);
    setSettings(s);
    setSpanishStatus(publication);
    applySettings(s);
    setStatus("ready");
  };

  useEffect(() => {
    api
      .session()
      .then((s) => {
        setStorageReady(s.storageConfigured);
        setAuthReady(s.authConfigured);
        if (s.authenticated) return load();
        setStatus("signedOut");
      })
      .catch(() => setStatus("signedOut"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") return <p className={cn(styles.loading, "chalk-soft")}>Opening the owner area…</p>;
  if (status === "signedOut" || !settings) return <Login api={api} authReady={authReady} onSignedIn={load} />;

  const save = async (next: SiteSettings) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    applySettings(saved);
    return saved;
  };
  const signOut = async () => {
    await api.logout();
    setStatus("signedOut");
  };
  const setSpanishPublication = async (enabled: boolean) => {
    const result = await api.setSpanishPublication(enabled);
    setSettings(result.settings);
    setSpanishStatus(result.status);
    applySettings(result.settings);
    return result.status;
  };
  const current = ADMIN_NAV.find((n) => n.id === section)!;

  return (
    <div className={cn(styles.page, section === "leads" ? styles.pageWide : "")}>
      <div className={styles.topbar}>
        <p className={cn(styles.areaName, "chalk-soft")}>Owner area</p>
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={signOut}>Sign out</button>
      </div>
      <nav ref={navRef} className={styles.adminNav} aria-label="Owner area" onScroll={(e) => (navScrollLeft = e.currentTarget.scrollLeft)}>
        <ul>
          {ADMIN_NAV.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className={cn(styles.navLink, "chalk-soft")} aria-current={n.id === section ? "page" : undefined}>{n.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <h1 className={cn(styles.h1, "chalk")}>{current.label}</h1>

      {api.mode === "prototype" && (
        <p className={cn(styles.banner, "chalk-soft")}>Prototype: changes are saved in this browser only, so you can preview them. On the real site they go live for every visitor.</p>
      )}
      {api.mode === "live" && !storageReady && (section === "photos" || section === "theme" || section === "seasonal") && (
        <p className={cn(styles.bannerError, "chalk-soft")} role="alert">Storage isn&apos;t connected yet, so changes can&apos;t be saved. Connect a Vercel Blob store to this project (see README).</p>
      )}

      {section === "dashboard" && <Dashboard api={api} settings={settings} />}
      {section === "leads" && <LeadsPanel api={api} />}
      {section === "availability" && <AvailabilityPanel api={api} />}
      {section === "pricing" && <PricingPanel api={api} />}
      {section === "seasonal" && <SeasonalPanel settings={settings} onSave={save} />}
      {section === "photos" && <MediaPanel settings={settings} onSave={save} upload={(b) => api.uploadPhoto(b)} />}
      {section === "theme" && <ThemePanel settings={settings} onSave={save} prototype={api.mode === "prototype"} />}
      {section === "settings" && spanishStatus && (
        <SettingsPanel
          api={api}
          storageReady={storageReady}
          spanishStatus={spanishStatus}
          onSetSpanishPublication={setSpanishPublication}
          onSignOut={signOut}
        />
      )}
    </div>
  );
}

/* ---------------- dashboard ---------------- */

function Dashboard({ api, settings }: { api: ReturnType<typeof getAdminApi>; settings: SiteSettings }) {
  const [leads, setLeads] = useState<LeadList | null>(null);
  const [leadsError, setLeadsError] = useState(false);
  useEffect(() => {
    api.listLeads("all").then(setLeads).catch(() => setLeadsError(true));
  }, [api]);
  const theme = themes[settings.themeId];
  const stat = (n: number | undefined) => (leads ? String(n ?? 0) : leadsError ? "–" : "…");
  const money = (show: (m: NonNullable<LeadList["money"]>) => string) => (leads ? (leads.money ? show(leads.money) : "–") : leadsError ? "–" : "…");
  return (
    <section className={styles.section} aria-label="Dashboard">
      <div className={styles.stats}>
        <div className={styles.stat}><span className={cn(styles.statNum, "chalk")}>{stat(leads?.counts.all)}</span><span className="chalk-soft">Active leads</span></div>
        <div className={styles.stat}><span className={cn(styles.statNum, "chalk")}>{stat(leads?.counts.rescheduled)}</span><span className="chalk-soft">Rescheduled</span></div>
        <div className={styles.stat}><span className={cn(styles.statNum, "chalk")}>{stat(leads?.counts.cancelled)}</span><span className="chalk-soft">Cancelled</span></div>
        <div className={styles.stat}><span className={cn(styles.statNum, "chalk")}>{money((m) => formatMoney(m.paidThisMonthCents))}</span><span className="chalk-soft">Paid this month</span></div>
        <div className={styles.stat}><span className={cn(styles.statNum, "chalk")}>{money((m) => String(m.unpaidCount))}</span><span className="chalk-soft">Sessions not paid yet</span></div>
        <div className={styles.stat}><span className={cn(styles.statNum, styles.statTheme, "chalk")}>{theme.label}</span><span className="chalk-soft">Current theme</span></div>
      </div>
      {leadsError && <p className={cn(styles.hintSmall, "chalk-soft")}>Lead numbers appear once the database is connected.</p>}
      <ul className={styles.dashCards}>
        {ADMIN_NAV.filter((n) => n.id !== "dashboard").map((n) => (
          <li key={n.id}>
            <Link href={n.href} className={styles.dashCard}>
              <span className={cn(styles.dashTitle, "chalk")}>{n.label}</span>
              <span className={cn(styles.dashBlurb, "chalk-soft")}>{n.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- settings ---------------- */

function SettingsPanel({
  api,
  storageReady,
  spanishStatus,
  onSetSpanishPublication,
  onSignOut,
}: {
  api: ReturnType<typeof getAdminApi>;
  storageReady: boolean;
  spanishStatus: SpanishPublicationStatus;
  onSetSpanishPublication: (enabled: boolean) => Promise<SpanishPublicationStatus>;
  onSignOut: () => void;
}) {
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [publicationNote, setPublicationNote] = useState<Note>(null);

  const changePublication = async () => {
    setPublicationBusy(true);
    setPublicationNote(null);
    try {
      const status = await onSetSpanishPublication(!spanishStatus.enabled);
      setPublicationNote({
        kind: "ok",
        text: status.published ? "Spanish website is published." : "Spanish website is hidden.",
      });
    } catch (error) {
      setPublicationNote({ kind: "error", text: error instanceof Error ? error.message : "Couldn't change Spanish publication." });
    } finally {
      setPublicationBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-label="Settings">
      <h2 className={cn(styles.h2, "chalk")}>Spanish website</h2>
      <ChalkBox className={styles.publicationCard} seed={965} wobble={2.2} strokeWidth={2.2} color={spanishStatus.published ? "var(--sun-yellow)" : "var(--chalk-white)"}>
        <div className={styles.publicationHead}>
          <div>
            <p className={cn(styles.publicationState, spanishStatus.published ? styles.publicationLive : "", "chalk") }>
              {spanishStatus.published ? "Published" : spanishStatus.enabled ? "On, but safely hidden" : "Hidden"}
            </p>
            <p className={cn(styles.hintSmall, "chalk-soft")}>
              {spanishStatus.published
                ? "Families can use /es and the EN | ES switcher."
                : spanishStatus.enabled
                  ? "The switch is on, but a missing translation is keeping every Spanish route hidden."
                  : "English stays live. Spanish routes, links and search listings stay hidden."}
            </p>
          </div>
          <ChalkButton
            variant={spanishStatus.enabled ? "outline" : "solid"}
            onClick={changePublication}
            disabled={publicationBusy || (api.mode === "live" && !storageReady)}
            seed={966}
          >
            {publicationBusy ? "Saving…" : spanishStatus.enabled ? "Hide Spanish website" : "Publish Spanish website"}
          </ChalkButton>
        </div>
        {spanishStatus.issues.length > 0 && (
          <div className={styles.publicationIssues}>
            <p className={cn(styles.hintSmall, "chalk-soft")}>Before Spanish can be published, complete:</p>
            <ul>
              {spanishStatus.issues.map((issue) => <li key={issue} className="chalk-soft">{issue}</li>)}
            </ul>
          </div>
        )}
        <p className={cn(styles.hintSmall, "chalk-soft")}>No Vercel setting or redeploy is needed. Changes take effect for the next visitor.</p>
        {publicationNote && (
          <p className={cn(publicationNote.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={publicationNote.kind === "error" ? "alert" : "status"}>
            {publicationNote.text}
          </p>
        )}
      </ChalkBox>

      <h2 className={cn(styles.h2, "chalk")}>Account</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        {api.mode === "prototype" ? `Prototype password: ${PROTOTYPE_PASSWORD}. Changes stay in this browser.` : "The owner password is set with ADMIN_PASSWORD in Vercel. To change it, update the variable and redeploy."}
      </p>
      <ChalkButton variant="outline" onClick={onSignOut} seed={970}>Sign out</ChalkButton>
      <h2 className={cn(styles.h2, "chalk")}>Connections</h2>
      <ul className={styles.connList}>
        <li className="chalk-soft"><b>Photos &amp; theme storage (Vercel Blob):</b> {api.mode === "prototype" ? "this browser (prototype)" : storageReady ? "connected" : "not connected yet"}</li>
        <li className="chalk-soft"><b>Bookings &amp; availability:</b> Neon database (DATABASE_URL)</li>
        <li className="chalk-soft"><b>Calendar:</b> Outlook via Microsoft Graph (MICROSOFT_* variables)</li>
        <li className="chalk-soft"><b>Booking emails:</b> Resend (RESEND_API_KEY, BOOKING_FROM_EMAIL, BOOKING_INTERNAL_FROM_EMAIL, BOOKING_NOTIFICATION_EMAIL)</li>
      </ul>
      <p className={cn(styles.hintSmall, "chalk-soft")}>These are set in Vercel → Settings → Environment Variables. The README explains each one.</p>
    </section>
  );
}

/* ---------------- login ---------------- */

function Login({ api, authReady, onSignedIn }: { api: ReturnType<typeof getAdminApi>; authReady: boolean; onSignedIn: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Enter the owner password.");
    setBusy(true);
    setError(null);
    const res = await api.login(password);
    if (res.ok) await onSignedIn();
    else setError(res.error ?? "That password isn't right.");
    setBusy(false);
  };

  return (
    <ChalkBox className={styles.login} seed={801} wobble={3} strokeWidth={2.6}>
      <h1 className={cn(styles.h1, "chalk")}>Owner area</h1>
      <p className={cn(styles.muted, "chalk-soft")}>Sign in to change the website theme and photos.</p>
      {!authReady && (
        <p className={cn(styles.bannerError, "chalk-soft")}>The owner password isn&apos;t set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel (see README).</p>
      )}
      <form onSubmit={submit} className={styles.loginForm} noValidate>
        <label htmlFor="admin-password" className={cn(styles.label, "chalk-soft")}>
          Password
        </label>
        <input
          id="admin-password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "admin-password-error" : undefined}
        />
        {error && (
          <p id="admin-password-error" className={cn(styles.error, "chalk-soft")} role="alert">
            {error}
          </p>
        )}
        <ChalkButton type="submit" variant="solid" disabled={busy} seed={802}>
          {busy ? "Signing in…" : "Sign in"}
        </ChalkButton>
      </form>
      {api.mode === "prototype" && <p className={cn(styles.hint, "chalk-soft")}>Prototype password: {PROTOTYPE_PASSWORD}</p>}
    </ChalkBox>
  );
}

/* ---------------- theme ---------------- */

function ThemePanel({ settings, onSave, prototype }: { settings: SiteSettings; onSave: (s: SiteSettings) => Promise<SiteSettings>; prototype: boolean }) {
  const [busy, setBusy] = useState<TinyHumansTheme | null>(null);
  const [note, setNote] = useState<Note>(null);

  const choose = async (id: TinyHumansTheme) => {
    setBusy(id);
    setNote(null);
    try {
      await onSave({ ...settings, themeId: id });
      setNote({ kind: "ok", text: `${themes[id].label} theme is live.` });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "Couldn't change the theme." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="theme-title">
      <h2 id="theme-title" className={cn(styles.h2, "chalk")}>Website theme</h2>
      <p className={cn(styles.muted, "chalk-soft")}>Changes the logo, the opening animation, colors and decorations across the whole site.</p>
      <div className={styles.themes}>
        {THEME_IDS.map((id, i) => {
          const t = themes[id];
          const live = settings.themeId === id;
          return (
            <ChalkBox key={id} className={cn(styles.themeCard, live ? styles.themeLive : "")} seed={820 + i} wobble={2.4} strokeWidth={live ? 3 : 2.2} color={live ? "var(--sun-yellow)" : "var(--chalk-white)"}>
              <div className={styles.themeLogo}>
                <TinyHumansLogo logo={t.logo} state="drawn" />
              </div>
              {live ? (
                <p className={cn(styles.liveTag, "chalk-soft")} aria-live="polite">Live now</p>
              ) : (
                <ChalkButton variant="outline" onClick={() => choose(id)} disabled={busy !== null} seed={830 + i} className={styles.themeButton}>
                  {busy === id ? "Switching…" : t.buttonLabel}
                </ChalkButton>
              )}
            </ChalkBox>
          );
        })}
      </div>
      {note && (
        <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}{" "}
          {note.kind === "ok" &&
            (prototype ? (
              <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>
                See the opening animation
              </button>
            ) : (
              <span>Visitors see it on their next page load.</span>
            ))}
        </p>
      )}
    </section>
  );
}
