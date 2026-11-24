import type { BundleLooks as Looks } from "@/lib/pricing/looks";
import { cn } from "@/lib/cn";
import styles from "./BundleLooks.module.css";

/**
 * What a bundle includes, look by look (owner, Nov 24): on its card (bundles page, home, ad page) and under the bundle
 * picked on /book (`picked`: its own box, read out when the pick changes). `heading` replaces the looks' own title
 * (e.g. "Our Little Story · 2 looks" on /book).
 */
export default function BundleLooks({ looks, heading, picked = false }: { looks: Looks; heading?: string; picked?: boolean }) {
  const title = heading ?? looks.title;
  return (
    <div className={cn(styles.looks, picked ? styles.picked : "")} aria-live={picked ? "polite" : undefined}>
      {title && <p className={styles.title}>{title}</p>}
      <ul className={styles.list}>
        {looks.items.map((item, i) => (
          <li key={i}>
            {item.name ? (
              <>
                <b className={styles.name}>{item.name}</b>
                {item.text ? `: ${item.text}` : ""}
              </>
            ) : (
              item.text
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
