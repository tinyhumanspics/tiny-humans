"use client";

import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { poseTitle } from "@/lib/shoots/poses";
import type { SignaturePose } from "@/lib/shoots/types";
import type { LightboxPhoto } from "./InspoLightbox";
import css from "./Shoots.module.css";

/** Every pose's photos in order, for the full-screen viewer: the caption says the pose and how to set it up. */
export function posePhotos(poses: SignaturePose[]): LightboxPhoto[] {
  return poses.flatMap((p) => {
    const caption = p.steps.length ? `${poseTitle(p)}: ${p.steps.join(" · ")}` : poseTitle(p);
    return p.photos.map((photo) => ({ id: photo.id, src: photo.url, caption }));
  });
}

/**
 * The signature poses as cards (shoot folder, day sheet): the first photo (tap = full screen), the name and how to set
 * it up. On the day sheet each card also gets its tick.
 */
export default function PoseGrid({
  poses,
  onOpen,
  tick,
}: {
  poses: SignaturePose[];
  /** A photo was tapped (its id). */
  onOpen: (photoId: string) => void;
  /** Day sheet only: whether a pose is done for this shoot, and the toggle. */
  tick?: { isDone: (poseId: string) => boolean; toggle: (poseId: string) => void };
}) {
  return (
    <ul className={css.poseGrid}>
      {poses.map((p) => {
        const title = poseTitle(p);
        const cover = p.photos[0];
        const done = tick?.isDone(p.id) ?? false;
        return (
          <li key={p.id} className={cn(css.poseCard, done ? css.shotDone : "")}>
            {cover ? (
              <button type="button" className={css.thumb} onClick={() => onOpen(cover.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photos: never through the public image optimizer */}
                <img src={cover.url} alt="" loading="lazy" />
                {p.photos.length > 1 && <span className={css.photoCount} aria-hidden="true">{p.photos.length} photos</span>}
                <span className={styles.visuallyHidden}>
                  See {title} big{p.photos.length > 1 ? ` (${p.photos.length} photos)` : ""}
                </span>
              </button>
            ) : (
              <div className={cn(css.linkVis, css.noteVis)}>
                {title}
                <small>no photo yet</small>
              </div>
            )}
            {tick && (
              <button type="button" className={css.phTick} aria-pressed={done} onClick={() => tick.toggle(p.id)}>
                <span className={styles.visuallyHidden}>Done: {title}</span>
              </button>
            )}
            <p className={cn(css.cap, css.poseName, "chalk-soft")}>{title}</p>
            {p.steps.length > 0 && (
              <ul className={cn(css.poseSteps, "chalk-soft")} aria-label={`How to set up ${title}`}>
                {p.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
