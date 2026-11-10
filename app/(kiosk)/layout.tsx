/**
 * Pages handed to a family on the iPad (the photo and video release): no site header, footer, admin menu or Meta
 * Pixel, so the parent sees only the form. The root layout still gives the fonts and theme colors.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <main id="top">{children}</main>;
}
