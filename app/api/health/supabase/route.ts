import { NextResponse } from "next/server";
import { runSupabaseHealthChecks } from "@/app/lib/health/supabase-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/supabase
 *
 * Public readiness probe — env booleans and pilot table reachability only.
 * No secrets, no row data, no PHI.
 */
export async function GET() {
  const report = await runSupabaseHealthChecks();
  const httpStatus = report.status === "error" ? 503 : 200;
  return NextResponse.json(report, { status: httpStatus });
}
