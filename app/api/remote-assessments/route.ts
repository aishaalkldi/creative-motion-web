import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatientOwnership } from "@/app/lib/validate-patient-ownership";

async function buildClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) return null;

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* Route Handler context */
        }
      },
    },
  });

  const adminClient = serviceKey
    ? createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : sessionClient;

  return { sessionClient, adminClient };
}

/**
 * POST /api/remote-assessments
 * Clinician creates a tokenized remote assessment link.
 */
export async function POST(req: NextRequest) {
  const clients = await buildClients();
  if (!clients) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }
  const { sessionClient, adminClient } = clients;

  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser();
  if (authError ?? !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    patientId?: string;
    assessmentType?: string;
    includedSections?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patientId = body.patientId?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required." }, { status: 400 });
  }

  const ownership = await validatePatientOwnership(adminClient, patientId, user.id);
  if (!ownership.ok) {
    const status = ownership.httpStatus === 404 ? 403 : ownership.httpStatus;
    return NextResponse.json({ error: ownership.message }, { status });
  }

  const token = crypto.randomUUID();
  const assessmentType = body.assessmentType?.trim() || "remote_questionnaire";
  const includedSections = Array.isArray(body.includedSections) ? body.includedSections : [];

  const { data: row, error: insertError } = await adminClient
    .from("remote_assessment_requests")
    .insert({
      token,
      patient_id: patientId,
      provider_id: user.id,
      assessment_type: assessmentType,
      included_sections: includedSections,
      status: "pending",
    })
    .select("token, expires_at")
    .single();

  if (insertError) {
    if (insertError.code === "42P01") {
      return NextResponse.json(
        { error: "remote_assessment_requests table missing. Apply migration 006." },
        { status: 500 },
      );
    }
    console.error("[POST /api/remote-assessments] insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to create remote assessment." }, { status: 500 });
  }

  return NextResponse.json({
    token: row.token,
    url: `/assessment/${row.token}`,
    expiresAt: row.expires_at,
  });
}
