"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import css from "./InspoLightbox.module.css";

export interface LightboxPhoto {
  id: string;
  src: string;
  caption: string;
}

/**
 * A photo full screen (folder and day sheet): previous / next (buttons, arrow keys, swipe), the caption, and on the
 * day sheet "Mark as done". A native modal <dialog> like AdminDialog: the page behind is inert, Escape closes,
 * focus goes back to the photo that opened it.
 */
export default function InspoLightbox({
  photos,
  index,
  onIndex,
  onClose,
  done,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Day sheet only: whether this photo is ticked, and the toggle. */
  done?: { isDone: (id: string) => boolean; toggle: (id: string) => void };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const photo = photos[index];
  const many = photos.length > 1;
  const go = (step: number) => onIndex((index + step + photos.length) % photos.length);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!many) return;
      if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, many, onIndex, photos.length]);

  if (!photo) return null;
  const ticked = done?.isDone(photo.id) ?? false;

  return (
    <dialog
      ref={ref}
      className={css.lightbox}
      aria-label={photo.caption || "Photo"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (many && start !== null && end !== undefined && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
      }}
    >
      <div className={css.top}>
        <span className={css.count}>{many ? `${index + 1} of ${photos.length}` : ""}</span>
        <button type="button" className={css.close} onClick={onClose}>
          Close
        </button>
      </div>
      <figure className={css.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photos: never through the public image optimizer */}
        <img src={photo.src} alt={photo.caption || "Inspo photo"} className={ticked ? css.doneImage : undefined} />
        <figcaption className={css.caption}>{photo.caption || "No description yet"}</figcaption>
      </figure>
      <div className={css.bottom}>
        {many && (
          <button type="button" className={css.nav} onClick={() => go(-1)}>
            ← Previous
          </button>
        )}
        {done && (
          <button type="button" className={ticked ? css.markOn : css.mark} aria-pressed={ticked} onClick={() => done.toggle(photo.id)}>
            {ticked ? "Done ✓" : "Mark as done"}
          </button>
        )}
        {many && (
          <button type="button" className={css.nav} onClick={() => go(1)}>
            Next →
          </button>
        )}
      </div>
    </dialog>
  );
}
