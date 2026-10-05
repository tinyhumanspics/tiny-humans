import Image from "next/image";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import type { PortfolioPhoto } from "@/config/portfolio";
import styles from "./PinnedPhoto.module.css";

interface Props {
  photo: PortfolioPhoto;
  seed?: number;
  sizes: string;
  priority?: boolean;
  showCaption?: boolean;
  tape?: "yellow" | "blue" | "white";
}

/** A photo "taped" onto the chalkboard with a chalk-drawn frame. */
export default function PinnedPhoto({ photo, seed = 1, sizes, priority, showCaption = true, tape }: Props) {
  return (
    <figure className={styles.figure}>
      <ChalkBox className={styles.frame} seed={seed} wobble={2.4} strokeWidth={2.4}>
        {tape && <span className={`${styles.tape} ${styles[tape]}`} aria-hidden="true" />}
        <Image
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          sizes={sizes}
          priority={priority}
          className={styles.image}
        />
        {showCaption && photo.caption && <figcaption className={`${styles.caption} chalk-soft`}>{photo.caption}</figcaption>}
      </ChalkBox>
    </figure>
  );
}
