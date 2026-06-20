/**
 * POST /api/remote-assessments/[token]/transcribe
 *
 * Token-scoped patient assessment speech-to-text via ElevenLabs.
 * Audio is processed in memory only — not stored by RASQ.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRemoteAssessmentLimit,
  rateLimitExceededResponse,
} from "@/app/lib/rate-limit";
import { serviceUnavailableResponse } from "@/app/lib/api/safe-errors";
import {
  isAllowedAssessmentAudioMime,
  isElevenLabsSttEnabled,
  normalizeAssessmentSpeechLanguage,
  transcribeAssessmentAudio,
  validateAssessmentAudioUpload,
} from "@/app/lib/elevenlabs-server";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createAdminClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type RequestRow = {
  id: string;
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
    .select("id, status")
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
  const result = await transcribeAssessmentAudio({ audio, mimeType, language });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, fallback: "manual" }, { status: 502 });
  }

  return NextResponse.json({ text: result.text });
}
