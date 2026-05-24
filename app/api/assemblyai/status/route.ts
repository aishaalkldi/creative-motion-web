import { NextRequest, NextResponse } from "next/server";
import {
  isAssemblyAiEnabled,
  verifyTranscriptOwnership,
} from "@/app/lib/assemblyai-server";
import { requireClinicianSession } from "@/app/lib/api/require-clinician-session";
import { checkAssemblyAiLimit, rateLimitExceededResponse } from "@/app/lib/rate-limit";

const AAI_BASE = "https://api.assemblyai.com/v2";

export const runtime = "nodejs";

/**
 * GET without transcriptId: `{ configured: boolean }` for authenticated clinicians.
 * GET with `?transcriptId=...`: poll owned transcript only.
 * Disabled by default (ENABLE_ASSEMBLYAI=true to enable).
 */
export async function GET(req: NextRequest) {
  const session = await requireClinicianSession();
  if (!session.ok) return session.response;

  if (!isAssemblyAiEnabled()) {
    return NextResponse.json({ configured: false });
  }

  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  const transcriptId = req.nextUrl.searchParams.get("transcriptId")?.trim();

  if (!transcriptId) {
    return NextResponse.json({ configured: Boolean(key) });
  }

  const rate = checkAssemblyAiLimit(session.user.id);
  if (!rate.allowed) {
    return rateLimitExceededResponse(rate.retryAfterSec);
  }

  if (!key) {
    return NextResponse.json({ configured: false });
  }

  if (!verifyTranscriptOwnership(transcriptId, session.user.id)) {
    return NextResponse.json({ error: "Transcript not found." }, { status: 404 });
  }

  const res = await fetch(`${AAI_BASE}/transcript/${encodeURIComponent(transcriptId)}`, {
    headers: { authorization: key },
  });

  if (!res.ok) {
    console.error("[GET /api/assemblyai/status] upstream status failed");
    return NextResponse.json({ error: "Transcription status unavailable." }, { status: 502 });
  }

  const data = (await res.json()) as {
    status: string;
    text?: string;
    error?: string;
  };

  return NextResponse.json({
    configured: true,
    status: data.status,
    text: data.status === "completed" ? (data.text ?? null) : null,
    error: data.status === "error" ? "Transcription failed." : null,
  });
}
