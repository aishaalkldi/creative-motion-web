/**
 * POST /api/remote-assessments/[token]/transcribe
 *
 * Token-scoped patient assessment speech-to-text via ElevenLabs.
 * Audio is processed in memory only — not stored by RASQ.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";
import {
  createPendingPatientRemoteSession,
  markTranscriptionSessionCompleted,
  markTranscriptionSessionFailed,
} from "@/app/lib/speech-ai/transcription-session-persistence";
import {
  isAllowedAssessmentAudioMime,
  isElevenLabsSttEnabled,
  normalizeAssessmentSpeechLanguage,
  transcribeAssessmentAudio,
  validateAssessmentAudioUpload,
} from "@/app/lib/elevenlabs-server";

export const runtime = "nodejs";

let serviceRoleClientOverride: SupabaseClient | null = null;

/** Test-only hook for route tests — not used in production. */
export function __setServiceRoleClientForTests(client: SupabaseClient | null): void {
  serviceRoleClientOverride = client;
}

function adminClient() {
  if (serviceRoleClientOverride) return serviceRoleClientOverride;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type RequestRow = {
  id: string;
  patient_id: string;
  provider_id: string;
  status: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ configured: false }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "transcribe-status");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  return NextResponse.json({ configured: isElevenLabsSttEnabled() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const limited = checkRemoteAssessmentLimit(req, trimmed, "transcribe");
  if (!limited.allowed) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  if (!isElevenLabsSttEnabled()) {
    return NextResponse.json(
      { error: "Speech transcription is not available.", fallback: "manual" },
      { status: 503 },
    );
  }

  const admin = adminClient();
  if (!admin) {
    return serviceUnavailableResponse();
  }

  const { data: requestRow, error: fetchError } = await admin
    .from("remote_assessment_requests")
    .select("id, patient_id, provider_id, status")
    .eq("token", trimmed)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<RequestRow>();

  if (fetchError) {
    console.error("[POST /api/remote-assessments/[token]/transcribe] fetch failed");
    return NextResponse.json({ error: "Transcription request failed." }, { status: 500 });
  }

  if (!requestRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("audio") ?? form.get("file");
  if (!file || typeof (file as Blob).arrayBuffer !== "function") {
    return NextResponse.json({ error: "Missing audio file (use field name 'audio')." }, { status: 400 });
  }

  const blob = file as Blob;
  const mimeType = blob.type || "audio/webm";
  if (!isAllowedAssessmentAudioMime(mimeType)) {
    return NextResponse.json({ error: "Unsupported audio format.", fallback: "manual" }, { status: 400 });
  }

  const sizeError = validateAssessmentAudioUpload(blob.size);
  if (sizeError) {
    return NextResponse.json({ error: sizeError, fallback: "manual" }, { status: 400 });
  }

  const language = normalizeAssessmentSpeechLanguage(
    (form.get("language") as string | null) ?? (form.get("language_code") as string | null),
  );

  const audio = Buffer.from(await blob.arrayBuffer());

  const sessionId = await createPendingPatientRemoteSession(admin, {
    remoteRequest: requestRow,
    languageCode: language,
    byteSize: audio.length,
  });
  if (!sessionId) {
    console.warn(
      "[POST /api/remote-assessments/[token]/transcribe] transcription session pending insert skipped",
    );
  }

  const result = await transcribeAssessmentAudio({ audio, mimeType, language });

  if (!result.ok) {
    if (sessionId) {
      const markedFailed = await markTranscriptionSessionFailed(admin, sessionId);
      if (!markedFailed) {
        console.warn(
          "[POST /api/remote-assessments/[token]/transcribe] transcription session failed update skipped",
        );
      }
    }
    return NextResponse.json({ error: result.error, fallback: "manual" }, { status: 502 });
  }

  if (sessionId) {
    const markedCompleted = await markTranscriptionSessionCompleted(
      admin,
      sessionId,
      result.text,
    );
    if (!markedCompleted) {
      console.warn(
        "[POST /api/remote-assessments/[token]/transcribe] transcription session completed update skipped",
      );
    }
  }

  return NextResponse.json({ text: result.text });
}
