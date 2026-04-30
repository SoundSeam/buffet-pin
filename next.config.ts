import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep dev output isolated from regular build artifacts to avoid stale
    // server chunk references during hot reloads.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    outputFileTracingRoot: process.cwd(),
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "media.base44.com",
        },
      ],
    },
  };
}
