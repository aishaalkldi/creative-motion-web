/**
 * Shoulder Abduction Reach — dev-only capture reader/redactor for labeling.
 * RASQ ML bridge, First Labeling Slice (2026-08-19).
 *
 * NODE-ONLY. Reads existing local capture JSONL files under
 * `dev-data/rasq-ml/shoulder-abduction/` (written by
 * `local-jsonl-writer.ts` / the capture lab) and produces the therapist-blind
 * view served to the labeling UI: raw landmark frames (needed for the
 * skeleton replay) plus enough bookkeeping to submit a label, with
 * `simulationCondition`, `derivedFeatures`, and `participantId` stripped —
 * see `label-schema.ts` for why. This module never writes anything; it only
 * reads the existing, already-captured files as-is (including any known
 * upstream oddities, e.g. the repetitionId-collision-across-sides issue —
 * this reader works around that at read time via `sourceLineIndex` rather
 * than "fixing" the capture files themselves, which is out of scope here).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ML_RESEARCH_DEV_DATA_DIR, resolveDevSessionJsonlPath } from "./local-jsonl-writer";
import type {
  ShoulderAbductionReachCapturedFrame,
  ShoulderAbductionReachRepCaptureRecord,
  ShoulderAbductionReachTrackingQualitySummary,
} from "./capture-schema";
import type { ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";

export type ShoulderAbductionCaptureSessionSummary = {
  devSessionId: string;
  repCount: number;
};

/**
 * Neutral, technical-quality-only threshold for the "REVIEW WITH CAUTION"
 * badge — reuses the exact heuristic already applied when manually
 * inspecting `dev-session-2026-08-18T23-18-39-738Z` (frame count < 20, or
 * usable-angle tracking ratio < 1.0), kept here as one documented,
 * consistent definition rather than re-derived ad hoc each time. Computed
 * ONLY from capture-quality metadata — never from trunk drift, angle, or
 * any compensation-relevant value. See `label-schema.ts`'s doc comment for
 * why that separation matters.
 */
const REVIEW_CAUTION_MIN_FRAMES = 20;
const REVIEW_CAUTION_MIN_USABLE_RATIO = 1.0;

export function computeReviewCautionFlag(
  frameCount: number,
  usableFrameRatio: number | null,
): boolean {
  if (frameCount < REVIEW_CAUTION_MIN_FRAMES) return true;
  if (usableFrameRatio !== null && usableFrameRatio < REVIEW_CAUTION_MIN_USABLE_RATIO) return true;
  return false;
}

/** The redacted, labeling-safe view of one captured repetition. */
export type ShoulderAbductionReachRepForLabeling = {
  devSessionId: string;
  /** Bonus robustness key — see `label-schema.ts`'s doc comment on `sourceLineIndex`. */
  sourceLineIndex: number;
  repetitionId: string;
  repetitionIndex: number;
  side: ShoulderAbductionReachSide;
  frameCount: number;
  movementDurationMs: number;
  trackingQuality: ShoulderAbductionReachTrackingQualitySummary;
  /** Neutral technical-quality flag — see `computeReviewCautionFlag`. Never a movement-content judgment. */
  reviewCaution: boolean;
  frames: ShoulderAbductionReachCapturedFrame[];
};

function isJsonlFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".jsonl");
}

function devSessionIdFromFileName(fileName: string): string {
  return fileName.replace(/\.jsonl$/i, "");
}

/** Lists available capture sessions by scanning the capture directory. Empty array if none yet. */
export async function listShoulderAbductionCaptureSessions(): Promise<
  ShoulderAbductionCaptureSessionSummary[]
> {
  let entries: string[];
  try {
    entries = await readdir(ML_RESEARCH_DEV_DATA_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const jsonlFiles = entries.filter(isJsonlFile).sort();
  const summaries: ShoulderAbductionCaptureSessionSummary[] = [];
  for (const fileName of jsonlFiles) {
    const raw = await readFile(join(ML_RESEARCH_DEV_DATA_DIR, fileName), "utf8");
    const lineCount = raw.split("\n").filter((line) => line.trim().length > 0).length;
    summaries.push({ devSessionId: devSessionIdFromFileName(fileName), repCount: lineCount });
  }
  return summaries;
}

function normalizeTrackingQualityForLabeling(
  trackingQuality: ShoulderAbductionReachTrackingQualitySummary,
): ShoulderAbductionReachTrackingQualitySummary {
  return {
    framesTotal: trackingQuality.framesTotal,
    framesWithUsableAngle: trackingQuality.framesWithUsableAngle,
    usableFrameRatio: trackingQuality.usableFrameRatio,
    minCoreJointVisibility: trackingQuality.minCoreJointVisibility ?? null,
  };
}

function redactRecordForLabeling(
  record: ShoulderAbductionReachRepCaptureRecord,
  sourceLineIndex: number,
): ShoulderAbductionReachRepForLabeling {
  return {
    devSessionId: record.context.devSessionId,
    sourceLineIndex,
    repetitionId: record.context.repetitionId,
    repetitionIndex: record.context.repetitionIndex,
    side: record.context.side,
    frameCount: record.frames.length,
    movementDurationMs: record.derivedFeatures.movementDurationMs,
    trackingQuality: normalizeTrackingQualityForLabeling(record.derivedFeatures.trackingQuality),
    reviewCaution: computeReviewCautionFlag(
      record.frames.length,
      record.derivedFeatures.trackingQuality.usableFrameRatio,
    ),
    frames: record.frames,
  };
}

/**
 * Reads and redacts every repetition in one capture session's JSONL file, in file order.
 * Returns an empty array if the session file does not exist.
 */
export async function readShoulderAbductionCaptureSessionForLabeling(
  devSessionId: string,
): Promise<ShoulderAbductionReachRepForLabeling[]> {
  const filePath = resolveDevSessionJsonlPath(devSessionId);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const reps: ShoulderAbductionReachRepForLabeling[] = [];
  lines.forEach((line, index) => {
    let parsed: ShoulderAbductionReachRepCaptureRecord;
    try {
      parsed = JSON.parse(line) as ShoulderAbductionReachRepCaptureRecord;
    } catch {
      return; // skip an unparsable line rather than fail the whole session
    }
    reps.push(redactRecordForLabeling(parsed, index));
  });
  return reps;
}

/**
 * Server-only lookup used exclusively by the label POST route to stamp
 * `participantId` onto a label record — the browser payload never carries
 * participantId (see `label-schema.ts`'s `ShoulderAbductionReachLabelSubmission`),
 * so this is the one place it's ever read back out of the capture file.
 * Returns null if the session or line index doesn't exist.
 */
export async function lookupParticipantIdForRepetition(
  devSessionId: string,
  sourceLineIndex: number,
): Promise<string | null> {
  const filePath = resolveDevSessionJsonlPath(devSessionId);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const line = lines[sourceLineIndex];
  if (!line) return null;
  try {
    const parsed = JSON.parse(line) as ShoulderAbductionReachRepCaptureRecord;
    return parsed.context.participantId;
  } catch {
    return null;
  }
}
