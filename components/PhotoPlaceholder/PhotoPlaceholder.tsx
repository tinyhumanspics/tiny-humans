import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./PhotoPlaceholder.module.css";
import { cn } from "@/lib/cn";

interface Props {
  /** What the real photo will show, e.g. "Adrian & Alondra". */
  label: string;
  /** width / height of the photo that will replace it */
  ratio?: number;
  seed?: number;
  tape?: "yellow" | "blue" | "white";
  caption?: string;
}

/**
 * [PLACEHOLDER] A taped-on chalk frame where a real photo goes (same frame as PinnedPhoto). Swap it for PinnedPhoto
 * once the owner uploads the photo. Listed in PROGRESS.md → Placeholders.
 */
export default function PhotoPlaceholder({ label, ratio = 4 / 5, seed = 1, tape, caption }: Props) {
  return (
    <figure className={styles.figure}>
      <ChalkBox className={styles.frame} seed={seed} wobble={2.4} strokeWidth={2.4}>
        {tape && <span className={cn(styles.tape, styles[tape])} aria-hidden="true" />}
        <div className={styles.slot} style={{ aspectRatio: ratio }} role="img" aria-label={`Photo coming soon: ${label}`}>
          <ChalkDoodle name="sun" size={40} color="var(--sun-yellow)" strokeWidth={3} grain={false} />
          <span className={cn(styles.label, "chalk-soft")}>{label}</span>
          <span className={styles.soon}>photo coming soon</span>
        </div>
        {caption && <figcaption className={cn(styles.caption, "chalk-soft")}>{caption}</figcaption>}
      </ChalkBox>
    </figure>
  );
}
