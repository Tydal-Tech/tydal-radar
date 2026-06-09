import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow testing the dev server from a phone on the same Wi-Fi (LAN IP).
  allowedDevOrigins: ["192.168.2.67"],
};

export default nextConfig;
