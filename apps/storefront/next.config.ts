import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1",
      ...(process.env.CMS_IMAGE_ORIGINS || "").split(",").filter(Boolean),
    ].map((origin) => {
      const url = new URL(origin.trim());
      return { protocol: url.protocol.slice(0, -1) as "http" | "https", hostname: url.hostname, port: url.port, pathname: "/**" };
    }),
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    agentUpgrade: 'security',
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
