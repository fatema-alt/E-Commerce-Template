import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // AdminShell intentionally withholds pages until the browser verifies the
    // session. Validate instant navigation only on routes that explicitly opt in.
    instantInsights: {
      validationLevel: 'manual-warning',
    },
    agentUpgrade: 'security',
  },
};

export default nextConfig;
