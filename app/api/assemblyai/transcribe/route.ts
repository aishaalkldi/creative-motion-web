import { NextRequest, NextResponse } from "next/server";
import {
  ASSEMBLYAI_MAX_AUDIO_BYTES,
  isAssemblyAiEnabled,
  registerTranscriptOwnership,
} from "@/app/lib/assemblyai-server";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";
import { checkAssemblyAiLimit, rateLimitExceededResponse } from "@/app/lib/rate-limit";

const AAI_BASE = "https://api.assemblyai.com/v2";

export const runtime = "nodejs";

/**
 * Upload audio blob and create an AssemblyAI transcript job.
 * Disabled by default (ENABLE_ASSEMBLYAI=true to enable).
 * Clinician session required.
 */
export async function POST(req: NextRequest) {
  if (!isAssemblyAiEnabled()) {
    return NextResponse.json({ error: "Voice transcription is not available." }, { status: 503 });
  }

  const session = await requireClinicianSession();
  if (!session.ok) return session.response;

  const rate = checkAssemblyAiLimit(session.user.id);
  if (!rate.allowed) {
    return rateLimitExceededResponse(rate.retryAfterSec);
  }

  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "Voice transcription is not available." }, { status: 503 });
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
  if (blob.size > ASSEMBLYAI_MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file is too large." }, { status: 413 });
  }

  const languageCode = (form.get("language_code") as string | null)?.trim() || "auto";
  const buf = Buffer.from(await blob.arrayBuffer());

  const uploadRes = await fetch(`${AAI_BASE}/upload`, {
    method: "POST",
    headers: { authorization: key },
    body: buf,
  });

  if (!uploadRes.ok) {
    console.error("[POST /api/assemblyai/transcribe] upload failed");
    return NextResponse.json({ error: "Transcription request failed." }, { status: 502 });
  }

  const { upload_url } = (await uploadRes.json()) as { upload_url: string };

  const transcriptBody: Record<string, unknown> = { audio_url: upload_url };
  if (languageCode && languageCode !== "auto") {
    transcriptBody.language_code = languageCode;
  }

  const createRes = await fetch(`${AAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      authorization: key,
      "content-type": "application/json",
    },
    body: JSON.stringify(transcriptBody),
  });

  if (!createRes.ok) {
    console.error("[POST /api/assemblyai/transcribe] transcript create failed");
    return NextResponse.json({ error: "Transcription request failed." }, { status: 502 });
  }

  const { id } = (await createRes.json()) as { id: string };
  registerTranscriptOwnership(id, session.user.id);

  return NextResponse.json({ transcriptId: id });
}
