import Image from "next/image";
import type { PortfolioPhoto } from "@/config/portfolio";
import styles from "./Booking.module.css";

/** Small taped-on photo used wherever the inspiration photo is shown. */
export default function InspirationThumb({ photo, size = 72 }: { photo: PortfolioPhoto; size?: number }) {
  return (
    <span className={styles.thumb} style={{ width: size }}>
      <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes={`${size * 2}px`} className={styles.thumbImg} />
    </span>
  );
}
