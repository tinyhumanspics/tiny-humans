import type { NextConfig } from "next";

/**
 * Normal builds (Vercel) use the full Next.js server, the owner-area API
 * (files named route.server.ts) and the image optimizer.
 * `npm run build:static` produces a static export for the click-through
 * prototype: the owner-area API is left out and the owner area saves to the
 * browser instead.
 */
const isStatic = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: isStatic ? ["tsx", "ts"] : ["tsx", "ts", "server.ts"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  ...(isStatic ? { output: "export", images: { unoptimized: true }, trailingSlash: true } : {}),
};

export default nextConfig;
