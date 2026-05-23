import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOpenAiKeyDiagnostics } from "@/app/lib/openai/server-env";

/**
 * GET /api/assessments/translate-health
 * Clinician-only safe diagnostics — no key value, no OpenAI call, no PHI.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
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

  return NextResponse.json(getOpenAiKeyDiagnostics());
}
