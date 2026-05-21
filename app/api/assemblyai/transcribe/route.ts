import { NextRequest, NextResponse } from "next/server";

const AAI_BASE = "https://api.assemblyai.com/v2";

export const runtime = "nodejs";

/**
 * Upload audio blob and create an AssemblyAI transcript job.
 * Requires ASSEMBLYAI_API_KEY (server-only). Body: multipart form with field `audio` (Blob/File).
 * Optional form field: `language_code` (e.g. en, ar). Omit or `auto` for automatic detection where supported.
 */
export async function POST(req: NextRequest) {
  const key = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "AssemblyAI is not configured on the server." }, { status: 503 });
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
  const languageCode = (form.get("language_code") as string | null)?.trim() || "auto";
  const buf = Buffer.from(await blob.arrayBuffer());

  const uploadRes = await fetch(`${AAI_BASE}/upload`, {
    method: "POST",
    headers: { authorization: key },
    body: buf,
  });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    return NextResponse.json({ error: "AssemblyAI upload failed.", detail }, { status: 502 });
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
    const detail = await createRes.text();
    return NextResponse.json({ error: "AssemblyAI transcript create failed.", detail }, { status: 502 });
  }

  const { id } = (await createRes.json()) as { id: string };
  return NextResponse.json({ transcriptId: id });
}
