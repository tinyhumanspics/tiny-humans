"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./Admin.module.css";

/**
 * A confirmation pop-up on the browser's native modal <dialog> (`showModal()`): the page behind is inert, Escape
 * closes it, focus starts on its first button (put "Cancel" first) and returns to whatever opened it; a click on the
 * dimmed backdrop closes it too. `busy` keeps it open while its action runs.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
 */
export default function AdminDialog({ labelledBy, describedBy, onClose, busy = false, children }: { labelledBy: string; describedBy?: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
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
      className={styles.dialog}
      role="alertdialog"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // a click on the backdrop lands on the <dialog> itself, outside its box
        if (busy || e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
