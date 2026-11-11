import type { ReactNode } from "react";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

/**
 * One part of the website in Photos / Media, folded to a single line until opened (owner, Nov 11: the page was "a bit
 * complicated to understand"): its name, a short summary ("2 pictures · both yours"), then where it shows and the
 * pictures. Native <details>, so it works with the keyboard and screen readers without extra code.
 */
export default function MediaFold({ title, summary, where, open = false, children }: { title: string; summary: string; where: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className={cn(styles.mediaGroup, styles.mediaFold)} open={open}>
      <summary className={styles.mediaFoldHead}>
        <h3 className={cn(styles.mediaGroupTitle, styles.mediaFoldTitle, "chalk")}>{title}</h3>
        <span className={cn(styles.mediaFoldSummary, "chalk-soft")}>{summary}</span>
      </summary>
      <div className={styles.mediaFoldBody}>
        <p className={cn(styles.hintSmall, "chalk-soft")}>{where}</p>
        {children}
      </div>
    </details>
  );
}
