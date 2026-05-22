import type { NextConfig } from "next";

/**
 * Vercel adapter modifyConfig writes preview-comment tooling under `.vercel/`
 * using `ctx.projectDir`. Next.js 16.2.x only passes `{ phase, nextVersion }`,
 * so `path.join(undefined, ".vercel/")` crashes production builds when
 * VERCEL_PREVIEW_COMMENTS_ENABLED=1.
 */
if (process.env.VERCEL === "1") {
  process.env.VERCEL_PREVIEW_COMMENTS_ENABLED = "0";
}

/** Resolve a safe rewrite target URL (never undefined/empty for Vercel config processing). */
function resolveBackendUrl(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim().replace(/\/$/, "");
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/** Creative Motion main backend (FastAPI on 8000). */
const backendUrl = resolveBackendUrl(
  process.env.BACKEND_URL,
  "http://127.0.0.1:8000",
);

/** Gait AI service (separate FastAPI on 8001). */
const gaitAiUrl = resolveBackendUrl(
  process.env.GAIT_AI_URL,
  "http://127.0.0.1:8001",
);

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
