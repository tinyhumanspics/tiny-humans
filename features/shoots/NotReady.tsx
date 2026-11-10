import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";

/** Before migration 0023 has run in Neon: nothing can be saved yet (bookings and the rest of /admin work as usual). */
export default function NotReady() {
  return (
    <p className={cn(styles.bannerError, "chalk-soft")} role="alert">
      Shoots isn&apos;t set up in the database yet. Run the shoots migration (drizzle/0023_shoots.sql) in the Neon SQL
      editor, then reload this page.
    </p>
  );
}
