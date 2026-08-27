/**
 * RASQ Interactive Shoulder — clinician Analysis Report DTO (O3).
 *
 * Read + display only. Maps a persisted
 * interactive_shoulder_movement_outcomes row (O1 schema, O2 write
 * path) to a strict clinician-facing shape — nothing here recomputes
 * results from camera frames, nothing infers a clinical score, and
 * blockResults' own interaction/measured/interpreted separation
 * (session-orchestrator/types.ts) is preserved rather than collapsed.
 *
 * Reuses validateMovementBlockResult (movement-outcome-request-
 * validation.ts) to parse each persisted block, rather than
 * duplicating that same structural check for the read path. This is
 * a read path over an immutable, append-only table — parsing is
 * deliberately tolerant: a malformed or future-schema-version payload
 * degrades to safe defaults / omitted blocks, never a thrown error
 * that would take down the whole Progress & Outcomes hub over one row.
 *
 * Deliberately does NOT compute blocksCompleted/blocksTotal into a
 * completion percentage — O2 documented that those two values are not
 * independently authoritative, so no derived percentage may be shown
 * here or anywhere downstream. Deliberately does NOT compute any
 * recovery/impairment/movement-quality/accuracy/symmetry score,
 * clinical grade, risk classification, or diagnostic conclusion — only
 * durationSeconds is derived, and only as a literal arithmetic
 * difference of two already-persisted timestamps (startedAtMs/
 * completedAtMs), not an interpretation.
 */
import type { ClinicalPrescribedSide } from "@/app/lib/clinical/clinical-prescribed-side";
import { serializeClinicalPrescribedSideFromDb } from "@/app/lib/clinical/clinical-prescribed-side";
import type {
  InteractionPerformance,
  InterpretedObservations,
  MeasuredMovementPerformance,
  MovementBlockCompletionReason,
} from "@/app/lib/session-orchestrator/types";
import { validateMovementBlockResult } from "./movement-outcome-request-validation";
import { INTERACTIVE_SHOULDER_MOVEMENT_OUTCOME_SCHEMA_VERSION } from "./movement-outcome-types";
import type { InteractiveShoulderOutcomeReportRow } from "./movement-outcome-persistence";

export type InteractiveShoulderOutcomeBlockReport = {
  blockId: string;
  movementId: string;
  completionReason: MovementBlockCompletionReason | null;
  /** Literal (completedAtMs - startedAtMs) in seconds; null when the block has no completedAtMs. Not an estimate. */
  durationSeconds: number | null;
  interaction: InteractionPerformance;
  measured: MeasuredMovementPerformance;
  interpreted: InterpretedObservations;
};

export type InteractiveShoulderOutcomeReportEntry = {
  id: string;
  planSessionId: string | null;
  planId: string;
  prescribedSide: ClinicalPrescribedSide | null;
  totalElapsedSeconds: number;
  blocksCompleted: number;
  blocksTotal: number;
  schemaVersion: string;
  /** False for a schema_version this build does not recognize — the UI must still render session-level facts safely. */
  recognizedSchemaVersion: boolean;
  createdAt: string;
  blocks: InteractiveShoulderOutcomeBlockReport[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function safeBlockDurationSeconds(startedAtMs: number, completedAtMs: number | null): number | null {
  if (completedAtMs === null || completedAtMs < startedAtMs) return null;
  return Math.round((completedAtMs - startedAtMs) / 1000);
}

function buildBlockReport(raw: unknown, index: number): InteractiveShoulderOutcomeBlockReport | null {
  const result = validateMovementBlockResult(raw, index);
  if (!result.ok) return null;
  const block = result.value;
  return {
    blockId: block.blockId,
    movementId: block.movementId,
    completionReason: block.completionReason,
    durationSeconds: safeBlockDurationSeconds(block.startedAtMs, block.completedAtMs),
    interaction: block.interaction,
    measured: block.measured,
    interpreted: block.interpreted,
  };
}

/**
 * Parses one persisted row into a clinician report entry. A block that
 * fails its shape check is omitted from `blocks` (never fabricated,
 * never crashes the entry) — session-level facts are still returned.
 */
export function buildInteractiveShoulderOutcomeReportEntry(
  row: InteractiveShoulderOutcomeReportRow,
): InteractiveShoulderOutcomeReportEntry {
  const payload = isRecord(row.outcome_payload) ? row.outcome_payload : {};
  const schemaVersion = typeof row.schema_version === "string" ? row.schema_version : "";
  const rawBlockResults = Array.isArray(payload.blockResults) ? payload.blockResults : [];

  const blocks = rawBlockResults
    .map((raw, index) => buildBlockReport(raw, index))
    .filter((block): block is InteractiveShoulderOutcomeBlockReport => block !== null);

  return {
    id: row.id,
    planSessionId: row.plan_session_id,
    planId: row.plan_id,
    prescribedSide: serializeClinicalPrescribedSideFromDb(row.prescribed_side),
    totalElapsedSeconds: safeNonNegativeInt(payload.totalElapsedSeconds),
    blocksCompleted: safeNonNegativeInt(payload.blocksCompleted),
    blocksTotal: safeNonNegativeInt(payload.blocksTotal),
    schemaVersion,
    recognizedSchemaVersion: schemaVersion === INTERACTIVE_SHOULDER_MOVEMENT_OUTCOME_SCHEMA_VERSION,
    createdAt: row.created_at,
    blocks,
  };
}

export function buildInteractiveShoulderOutcomeReportEntries(
  rows: readonly InteractiveShoulderOutcomeReportRow[],
): InteractiveShoulderOutcomeReportEntry[] {
  return rows.map(buildInteractiveShoulderOutcomeReportEntry);
}
