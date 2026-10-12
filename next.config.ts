import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { CSP_REPORT_PATH, contentSecurityPolicy } from "./lib/security/csp";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Standard Next.js App Router configuration (what Vercel builds with
 * `npm run build`).
 *
 * `npm run build:static` (scripts/build-static.mjs) produces a static export
 * for the click-through prototype. It sets STATIC_EXPORT=1 and temporarily
 * moves app/api aside, because API routes can't be part of a static export.
 */
const isStatic = process.env.STATIC_EXPORT === "1";

/**
 * Security headers. frame-ancestors 'self' / SAMEORIGIN (enforced): nobody else can frame the site (clickjacking);
 * same-origin frames still work. The full policy (lib/security/csp.ts) is Report-Only for now: browsers report what it
 * would block to /api/csp-report without blocking anything. Enforce it once production reports stay quiet.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy({ dev: process.env.NODE_ENV === "development", preview: process.env.VERCEL_ENV === "preview" }),
  },
  { key: "Reporting-Endpoints", value: `csp="${CSP_REPORT_PATH}"` },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: isStatic ? { unoptimized: true } : { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  ...(isStatic ? { output: "export", trailingSlash: true } : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
};

export default withNextIntl(nextConfig);
