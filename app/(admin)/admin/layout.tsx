import SiteShell from "@/components/layout/SiteShell";

/** The owner area still draws inside the site's shell (header, footer, theme) until its own redesign (Phase 10). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
