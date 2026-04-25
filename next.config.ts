import type { NextConfig } from "next";

/** Creative Motion main backend (FastAPI on 8000). */
const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

/** Gait AI service (separate FastAPI on 8001). */
const gaitAiUrl =
  process.env.GAIT_AI_URL?.replace(/\/$/, "") || "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  /** Hostnames only (no protocol). Required for HMR when using LAN URL, e.g. http://192.168.x.x:3000 */
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.8.145"],

  async rewrites() {
    return [
      // Main backend — all /api/v1/* calls
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // Gait AI service — /api/gait/* → http://127.0.0.1:8001/api/v1/gait/*
      {
        source: "/api/gait/:path*",
        destination: `${gaitAiUrl}/api/v1/gait/:path*`,
      },
    ];
  },
};

export default nextConfig;
