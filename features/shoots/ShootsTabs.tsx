import Link from "next/link";
import css from "./Shoots.module.css";

/** Shoots sub-tabs: Shoot days | What we always bring. */
export default function ShootsTabs({ current }: { current: "days" | "bring" }) {
  const tabs = [
    { id: "days", label: "Shoot days", href: "/admin/shoots" },
    { id: "bring", label: "What we always bring", href: "/admin/shoots/bring" },
  ] as const;
  return (
    <nav className={css.subtabs} aria-label="Shoots">
      <ul>
        {tabs.map((t) => (
          <li key={t.id}>
            <Link href={t.href} className={css.subtab} aria-current={t.id === current ? "page" : undefined}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
