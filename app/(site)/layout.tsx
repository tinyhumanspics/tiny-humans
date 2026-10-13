import SiteShell from "@/components/layout/SiteShell";

/** Every public page (English + /es) shares one shell, so the header stays mounted between pages. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
