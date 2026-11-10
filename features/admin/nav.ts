/** Owner area sections and navigation (shared by the admin shell and dashboard). */
export type AdminSection = "dashboard" | "leads" | "shoots" | "unfinished" | "availability" | "pricing" | "quotes" | "seasonal" | "photos" | "theme" | "settings";

/** Admin navigation: one place to move between sections. */
export const ADMIN_NAV: { id: AdminSection; label: string; href: string; blurb: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin", blurb: "Overview" },
  { id: "leads", label: "Leads", href: "/admin/leads", blurb: "Every booking: details, reschedule, cancel, delete." },
  { id: "shoots", label: "Shoots", href: "/admin/shoots", blurb: "Every shoot: the family's inspo and our BTS ideas, ticked off at the shoot." },
  { id: "unfinished", label: "Unfinished bookings", href: "/admin/unfinished", blurb: "Families who started booking but didn't finish, where they stopped and why." },
  { id: "availability", label: "Availability", href: "/admin/availability", blurb: "Weekly hours, booking rules, special dates, time blocks." },
  { id: "pricing", label: "Pricing & Promotions", href: "/admin/pricing", blurb: "Bundles, prices, special offers and discount codes." },
  { id: "quotes", label: "Quotes", href: "/admin/quotes", blurb: "A family's ZIP code or address: every bundle's price with travel, ready to send." },
  { id: "seasonal", label: "Seasonal Landing", href: "/admin/seasonal", blurb: "Seasonal offer boxes on the ad page and the home page: Thanksgiving, Christmas and your own." },
  { id: "photos", label: "Photos / Media", href: "/admin/photos", blurb: "The pictures on the website, by section and theme." },
  { id: "theme", label: "Theme", href: "/admin/theme", blurb: "Which seasonal theme visitors see." },
  { id: "settings", label: "Settings", href: "/admin/settings", blurb: "Spanish publication, account and connections." },
];
