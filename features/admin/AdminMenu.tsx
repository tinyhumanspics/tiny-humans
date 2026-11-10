"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ADMIN_NAV, type AdminSection } from "./nav";
import styles from "./Admin.module.css";

/** Below this width there's no room beside the page: the menu opens as a panel from the left instead. */
const PHONE_QUERY = "(max-width: 899px)";
const STORAGE_KEY = "tinyhumans.adminMenu";

const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isPhoneNow = () => window.matchMedia(PHONE_QUERY).matches;

/** "Hide menu" is remembered on this device (each section is its own page, so the menu is drawn again on every click). */
let hiddenCache: boolean | null = null;
function readHidden(): boolean {
  if (hiddenCache !== null) return hiddenCache;
  try {
    hiddenCache = window.localStorage.getItem(STORAGE_KEY) === "hidden";
  } catch {
    hiddenCache = false;
  }
  return hiddenCache;
}
function writeHidden(hidden: boolean) {
  hiddenCache = hidden;
  try {
    if (hidden) window.localStorage.setItem(STORAGE_KEY, "hidden");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private window or blocked storage: it just isn't remembered
  }
}

/**
 * The owner area's frame (owner, Nov 10): the sections as a menu on the left instead of a row that scrolls sideways.
 * Computer: a column beside the page that stays in view while scrolling; "Hide" folds it away (remembered on this
 * device) and "☰ Menu" brings it back. Phone and small tablet: "☰ Menu" opens the same list as a panel from the left
 * (native modal <dialog>: the page behind is inert, Escape or a tap outside closes it, focus returns to the button).
 */
export default function AdminMenu({ section, onSignOut, children }: { section: AdminSection; onSignOut: () => void; children: ReactNode }) {
  const phone = useSyncExternalStore(subscribePhone, isPhoneNow, () => false);
  const [hidden, setHidden] = useState(readHidden);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"menu" | "hide" | null>(null);
  const sidebar = !phone && !hidden;

  useEffect(() => {
    if (focusNext.current === "menu") menuButton.current?.focus();
    if (focusNext.current === "hide") hideButton.current?.focus();
    focusNext.current = null;
  });
  // the window got wider while the phone panel was open: the column takes over
  if (open && !phone) setOpen(false);

  const toggle = (hide: boolean) => {
    writeHidden(hide);
    focusNext.current = hide ? "menu" : "hide";
    setHidden(hide);
  };

  const links = (
    <nav className={styles.menuNav} aria-label="Owner area">
      <ul>
        {ADMIN_NAV.map((n) => (
          <li key={n.id}>
            <Link href={n.href} className={cn(styles.menuLink, "chalk-soft")} aria-current={n.id === section ? "page" : undefined} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.topbarStart}>
          {!sidebar && (
            <button
              ref={menuButton}
              type="button"
              className={cn(styles.menuButton, "chalk-soft")}
              aria-expanded={phone ? open : false}
              aria-haspopup={phone ? "dialog" : undefined}
              onClick={() => (phone ? setOpen(true) : toggle(false))}
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
          )}
          <p className={cn(styles.areaName, "chalk-soft")}>Owner area</p>
        </div>
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={onSignOut}>Sign out</button>
      </div>
      <div className={cn(styles.shell, sidebar ? styles.shellWithMenu : "")}>
        {sidebar && (
          <aside id="admin-sidebar" className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <span className={cn(styles.sidebarTitle, "chalk-soft")} aria-hidden="true">Menu</span>
              <button ref={hideButton} type="button" className={cn(styles.linkButton, styles.hideButton, "chalk-soft")} aria-expanded="true" aria-controls="admin-sidebar" onClick={() => toggle(true)}>
                <span aria-hidden="true">«</span> Hide<span className={styles.visuallyHidden}> menu</span>
              </button>
            </div>
            {links}
          </aside>
        )}
        <div className={styles.shellMain}>{children}</div>
      </div>
      {phone && open && (
        <MenuPanel onClose={() => setOpen(false)} onSignOut={onSignOut}>
          {links}
        </MenuPanel>
      )}
    </>
  );
}

/** The phone panel: slides in from the left on the browser's native modal <dialog>. */
function MenuPanel({ onClose, onSignOut, children }: { onClose: () => void; onSignOut: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.menuPanel}
      aria-label="Owner area menu"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // the inner box fills the panel, so a click that lands on the <dialog> itself is on the dimmed backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.menuPanelInner}>
        <div className={styles.sidebarHead}>
          <span className={cn(styles.areaName, "chalk-soft")}>Owner area</span>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={onClose}>
            <span aria-hidden="true">✕</span> Close<span className={styles.visuallyHidden}> menu</span>
          </button>
        </div>
        {children}
        <button type="button" className={cn(styles.linkButton, styles.menuSignOut, "chalk-soft")} onClick={onSignOut}>Sign out</button>
      </div>
    </dialog>
  );
}
