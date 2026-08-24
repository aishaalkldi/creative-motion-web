/**
 * GET/POST /api/dev/ml-research/shoulder-abduction-reach-label
 *
 * DEV-ONLY. RASQ ML bridge, First Labeling Slice (2026-08-19).
 *
 * GET  (no query)                          -> { sessions: ShoulderAbductionCaptureSessionSummary[] }
 * GET  ?devSessionId=...&raterId=...        -> { reps: ShoulderAbductionReachRepForLabeling[], labels: ShoulderAbductionReachLabelRecord[] }
 *      `raterId` is REQUIRED once `devSessionId` is given — this is the
 *      structural enforcement of rater independence (test category #11):
 *      the route can only ever return the REQUESTING rater's own labels,
 *      because it has no code path that returns any other rater's.
 * POST { ShoulderAbductionReachLabelSubmission } -> appends one label line locally
 *      Server stamps `participantId`, `labelSchemaVersion`, and `datasetVersion`.
 *      Server verifies `devSessionId`, `sourceLineIndex`, `repetitionId`, and
 *      `side` together against the capture JSONL (`resolveCaptureIdentityForLabel`)
 *      before accepting a label. `raterId` is normalized via
 *      `normalizeResearchRaterId` (trim only — not auth). `labeledAtMs` is
 *      server-authoritative (`Date.now()` at accept time).
 *
 * Same posture as `/api/dev/ml-research/shoulder-abduction-reach-capture`:
 *  - Refuses to run at all outside development.
 *  - No Supabase client, no database import, no `cv_session_metrics` write.
 *  - No auth/session/patient-token handling.
 *  - Rejects any payload carrying a raw-video/image-shaped key, as
 *    defense-in-depth independent of the schema guarantee that neither
 *    `ShoulderAbductionReachRepForLabeling` nor `ShoulderAbductionReachLabelRecord`
 *    ever includes one.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  listShoulderAbductionCaptureSessions,
  resolveCaptureIdentityForLabel,
  readShoulderAbductionCaptureSessionForLabeling,
} from "@/app/lib/ml-research/shoulder-abduction-reach/capture-reader";
import { readShoulderAbductionCaptureSessionLabelsForRater } from "@/app/lib/ml-research/shoulder-abduction-reach/label-reader";
import { appendShoulderAbductionReachLabelLocally } from "@/app/lib/ml-research/shoulder-abduction-reach/local-label-writer";
import {
  buildPersistedShoulderAbductionReachLabelRecord,
  isValidShoulderAbductionReachLabelRecord,
  isValidShoulderAbductionReachLabelSubmission,
  normalizeResearchRaterId,
  type ShoulderAbductionReachLabelRecord,
} from "@/app/lib/ml-research/shoulder-abduction-reach/label-schema";

const FORBIDDEN_PAYLOAD_KEY_PATTERN = /video|image|frame_blob|base64|dataurl/i;

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => FORBIDDEN_PAYLOAD_KEY_PATTERN.test(key) || containsForbiddenKey(nested),
    );
  }
  return false;
}

function devOnlyGate(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gated = devOnlyGate();
  if (gated) return gated;

  const devSessionId = request.nextUrl.searchParams.get("devSessionId");

  if (!devSessionId) {
    const sessions = await listShoulderAbductionCaptureSessions();
    return NextResponse.json({ sessions });
  }

  const raterId = request.nextUrl.searchParams.get("raterId");
  const normalizedRaterId = raterId ? normalizeResearchRaterId(raterId) : null;
  if (!normalizedRaterId) {
    return NextResponse.json({ error: "rater_id_required" }, { status: 400 });
  }

  const [reps, labels] = await Promise.all([
    readShoulderAbductionCaptureSessionForLabeling(devSessionId),
    readShoulderAbductionCaptureSessionLabelsForRater(devSessionId, normalizedRaterId),
  ]);
  return NextResponse.json({ reps, labels });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gated = devOnlyGate();
  if (gated) return gated;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidShoulderAbductionReachLabelSubmission(body)) {
    return NextResponse.json({ error: "invalid_record_shape" }, { status: 400 });
  }

  const normalizedRaterId = normalizeResearchRaterId(body.raterId);
  if (!normalizedRaterId) {
    return NextResponse.json({ error: "invalid_rater_id" }, { status: 400 });
  }

  const verifiedCapture = await resolveCaptureIdentityForLabel({
    devSessionId: body.devSessionId,
    sourceLineIndex: body.sourceLineIndex,
    repetitionId: body.repetitionId,
    side: body.side,
  });
  if (verifiedCapture === null) {
    return NextResponse.json({ error: "repetition_not_found" }, { status: 400 });
  }

  const record: ShoulderAbductionReachLabelRecord = buildPersistedShoulderAbductionReachLabelRecord(
    verifiedCapture,
    normalizedRaterId,
    {
      compensationLabel: body.compensationLabel,
      exclusionFlag: body.exclusionFlag,
      raterConfidence: body.raterConfidence,
      note: body.note,
    },
    Date.now(),
  );

  if (!isValidShoulderAbductionReachLabelRecord(record)) {
    return NextResponse.json({ error: "invalid_record_shape" }, { status: 400 });
  }

  if (containsForbiddenKey(record)) {
    return NextResponse.json({ error: "forbidden_payload_key" }, { status: 400 });
  }

  try {
    const { filePath } = await appendShoulderAbductionReachLabelLocally(record);
    return NextResponse.json({ ok: true, filePath });
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
