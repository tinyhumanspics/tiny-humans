import type { NextConfig } from "next";

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
 * Baseline security headers (the full Content-Security-Policy comes in Phase 6).
 * frame-ancestors 'self' / SAMEORIGIN: nobody else can frame the site (clickjacking); same-origin frames still work.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: isStatic ? { unoptimized: true } : { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  ...(isStatic ? { output: "export", trailingSlash: true } : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
};

export default nextConfig;
