import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      "https://api.dsmart.digislashagency.com",
      "https://dsmart.digislashagency.com",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
      ...(process.env.STOREFRONT_API_BASE_URL ? [process.env.STOREFRONT_API_BASE_URL] : []),
      ...(process.env.CMS_IMAGE_ORIGINS || "").split(",").filter(Boolean),
    ]
      .filter((origin): origin is string => typeof origin === "string" && origin.trim().length > 0)
      .map((origin) => {
        try {
          const url = new URL(origin.trim());
          return {
            protocol: url.protocol.slice(0, -1) as "http" | "https",
            hostname: url.hostname,
            port: url.port || undefined,
            pathname: "/**",
          };
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
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
