import type { NextConfig } from "next";

// A per-deploy build id the running app can compare against to detect a new
// deploy (see components/RegisterSW.tsx + app/api/build). Vercel sets
// VERCEL_GIT_COMMIT_SHA per commit; falls back to "dev" locally.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const nextConfig: NextConfig = {
  // Allow testing the dev server from a phone on the same Wi-Fi (LAN IP).
  allowedDevOrigins: ["192.168.2.67"],
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
