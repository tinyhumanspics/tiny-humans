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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  ...(isStatic ? { output: "export", images: { unoptimized: true }, trailingSlash: true } : {}),
};

export default nextConfig;
