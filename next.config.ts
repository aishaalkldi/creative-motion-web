import type { NextConfig } from "next";

/** FastAPI base URL (rewrite target). Browser calls same-origin `/api/v1/*` to avoid CORS. */
const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  /** Hostnames only (no protocol). Required for HMR when using LAN URL, e.g. http://192.168.x.x:3000 */
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.8.145"],

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
