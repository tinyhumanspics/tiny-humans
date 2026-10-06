/** Owner area sections and navigation (shared by the admin shell and dashboard). */
export type AdminSection = "dashboard" | "leads" | "availability" | "photos" | "theme" | "settings";

/** Admin navigation: one place to move between sections. */
export const ADMIN_NAV: { id: AdminSection; label: string; href: string; blurb: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin", blurb: "Overview" },
  { id: "leads", label: "Leads", href: "/admin/leads", blurb: "Every booking: details, reschedule, cancel, delete." },
  { id: "availability", label: "Availability", href: "/admin/availability", blurb: "Weekly hours, booking rules, special dates, time blocks." },
  { id: "photos", label: "Photos / Media", href: "/admin/photos", blurb: "The pictures on the website, by section and theme." },
  { id: "theme", label: "Theme", href: "/admin/theme", blurb: "Which seasonal theme visitors see." },
  { id: "settings", label: "Settings", href: "/admin/settings", blurb: "Account and connections." },
];
