"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import type { PortfolioPhoto } from "@/config/portfolio";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./PortfolioLightbox.module.css";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/email/messages";
import en from "@/messages/en.json";

interface Props {
  photos: PortfolioPhoto[];
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
  messages?: typeof en.home.portfolio.viewer;
}

export default function PortfolioLightbox({ photos, index, onChange, onClose, messages = en.home.portfolio.viewer }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const open = index !== null;

  const next = () => index !== null && onChange((index + 1) % photos.length);
  const prev = () => index !== null && onChange((index - 1 + photos.length) % photos.length);

  // keyboard: arrows + escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // focus + scroll lock
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || index === null) return null;
  const photo = photos[index];

  // keep Tab inside the dialog
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = dialogRef.current.querySelectorAll<HTMLElement>("button");
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  return createPortal(
    <div
      ref={dialogRef}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={messages.label}
      onKeyDown={trapFocus}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button ref={closeRef} type="button" className={cn(styles.control, styles.close)} onClick={onClose} aria-label={messages.close}>
        <ChalkDoodle name="close" size={30} />
      </button>

      <figure className={styles.figure}>
        <div className={styles.imageWrap}>
          <Image
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            sizes="(min-width: 1024px) 900px, 94vw"
            className={styles.image}
          />
        </div>
        <figcaption className={cn(styles.caption, "chalk-soft")}>
          {photo.caption && <span>{photo.caption}</span>}
          <span className={styles.count} aria-live="polite">
            {fill(messages.count, { current: String(index + 1), total: String(photos.length) })}
          </span>
        </figcaption>
      </figure>

      <button type="button" className={cn(styles.control, styles.prev)} onClick={prev} aria-label={messages.previous}>
        <ChalkDoodle name="arrowLeft" size={34} />
      </button>
      <button type="button" className={cn(styles.control, styles.next)} onClick={next} aria-label={messages.next}>
        <ChalkDoodle name="arrowRight" size={34} />
      </button>
    </div>,
    document.body,
  );
}
