import { NextResponse } from "next/server";
import { buildOpenAiHealthReport } from "@/app/lib/ai/openai-health";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/openai
 * Clinician-only safe diagnostics — no key value, no PHI, no patient text.
 */
export async function GET() {
  const session = await requireClinicianSession({ unauthorizedMessage: "Unauthorized" });
  if (!session.ok) return session.response;

  const report = await buildOpenAiHealthReport();
  return NextResponse.json(report);
}
