import SiteShell from "@/components/layout/SiteShell";

/** The owner area draws inside the site's shell (header, theme) without the website's footer (owner, Nov 24). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell footer={false}>{children}</SiteShell>;
}
