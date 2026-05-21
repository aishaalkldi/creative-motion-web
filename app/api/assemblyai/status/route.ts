import { NextRequest, NextResponse } from "next/server";

const AAI_BASE = "https://api.assemblyai.com/v2";

export const runtime = "nodejs";

/**
 * GET without transcriptId: `{ configured: boolean }` — safe for browser (no secrets).
 * GET with `?transcriptId=...`: poll transcript status; returns `status`, `text` when completed, or `error`.
 */
export async function GET(req: NextRequest) {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  const transcriptId = req.nextUrl.searchParams.get("transcriptId")?.trim();

  if (!transcriptId) {
    return NextResponse.json({ configured: Boolean(key) });
  }

  if (!key) {
    return NextResponse.json({ configured: false, error: "AssemblyAI is not configured." }, { status: 503 });
  }

  const res = await fetch(`${AAI_BASE}/transcript/${encodeURIComponent(transcriptId)}`, {
    headers: { authorization: key },
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ configured: true, error: "Status request failed.", detail }, { status: 502 });
  }

  const data = (await res.json()) as {
    status: string;
    text?: string;
    error?: string;
  };

  return NextResponse.json({
    configured: true,
    status: data.status,
    text: data.text ?? null,
    error: data.error ?? null,
  });
}
