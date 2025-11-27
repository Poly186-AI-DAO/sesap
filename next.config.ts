import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude problematic packages from client-side bundling
  serverExternalPackages: [
    "pino",
    "thread-stream",
    "@accordproject/concerto-core",
    "@accordproject/concerto-cto",
    "@accordproject/concerto-util",
    "@accordproject/concerto-vocabulary",
  ],
  webpack: (config, { isServer }) => {
    // Fix pino issues for client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
