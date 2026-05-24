import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildOpenAiHealthReport } from "@/app/lib/ai/openai-health";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/openai
 * Clinician-only safe diagnostics — no key value, no PHI, no patient text.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return serviceUnavailableResponse();
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        /* read-only */
      },
    },
  });

  const {
    data: { user },
    error: authErr,
  } = await sessionClient.auth.getUser();
  if (authErr ?? !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await buildOpenAiHealthReport();
  return NextResponse.json(report);
}
