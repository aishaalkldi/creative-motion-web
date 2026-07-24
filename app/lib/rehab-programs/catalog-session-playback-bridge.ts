/**
 * Catalog session DB rows -> ProgramSession/ProgramSessionBlock bridge
 * (rehab-program-types.ts) — pure, no I/O, no Supabase types.
 *
 * This is the thin mapping step between the database's persisted
 * rehabilitation catalog (migrations 014-016: program_sessions,
 * program_session_blocks) and the shape
 * rehab-program-runtime-adapter.ts's toSessionDefinition()/
 * toMovementBlock() already accept — those functions are untouched by
 * this module and are not called here; wiring a session through
 * SessionOrchestrator is a later, separate step.
 *
 * blockId is mapped from block_key (the catalog business identifier),
 * never from the block's database uuid: rehab-program-runtime-adapter
 * .ts's resolveSupportedPositions() keys its lookup table by exactly
 * these business-key strings (e.g.
 * "stroke-ulrf-v1-session-1-warm-up"), so mapping the database id
 * instead would silently break that lookup for every block.
 *
 * movementId / feedbackProfile / targetDurationSeconds are mapped from
 * SQL NULL to `undefined`, not passed through as `null`:
 * ProgramSessionBlock declares these as optional-absent properties
 * (`field?: T`), not `field: T | null` — a `null` value would not
 * structurally match the target type.
 */
import type {
  ProgramSession,
  ProgramSessionBlock,
} from "./rehab-program-types";
import type {
  ProgramSessionBlocksRow,
  ProgramSessionsRow,
} from "@/app/lib/supabase/database.types";

/**
 * Only the columns this bridge actually maps — deliberately narrower
 * than the full generated Row types, so a caller that `.select()`s
 * just these columns (as the loader does) can pass its query result
 * straight through without needing to select unrelated columns
 * (id/created_at/updated_at on blocks, created_at/updated_at on the
 * session) purely to satisfy a wider type this function never reads.
 */
export type ProgramSessionRowForBridge = Pick<
  ProgramSessionsRow,
  | "id"
  | "treatment_program_id"
  | "session_number"
  | "title"
  | "goal"
  | "estimated_duration_minutes_min"
  | "estimated_duration_minutes_max"
  | "requires_calibration"
  | "summary_mode"
>;

export type ProgramSessionBlockRowForBridge = Pick<
  ProgramSessionBlocksRow,
  | "block_key"
  | "block_type"
  | "title"
  | "instructions"
  | "movement_id"
  | "feedback_profile"
  | "target_duration_seconds"
>;

function toProgramSessionBlock(row: ProgramSessionBlockRowForBridge): ProgramSessionBlock {
  return {
    blockId: row.block_key,
    blockType: row.block_type as ProgramSessionBlock["blockType"],
    title: row.title,
    instructions: row.instructions,
    ...(row.movement_id !== null ? { movementId: row.movement_id } : {}),
    ...(row.feedback_profile !== null ? { feedbackProfile: row.feedback_profile } : {}),
    ...(row.target_duration_seconds !== null
      ? { targetDurationSeconds: row.target_duration_seconds }
      : {}),
  };
}

/**
 * Maps one program_sessions row and its (already ordered by the
 * caller) program_session_blocks rows into a ProgramSession. Does not
 * sort, filter, or validate — the loader is responsible for ordering
 * (block_order, via the query itself) and for rejecting
 * draft-program/empty-blocks/unrecognized-value states before calling
 * this function. This function trusts its input completely, matching
 * the same "pure, no defensive re-checking" posture as
 * rehab-program-runtime-adapter.ts's own toMovementBlock()/
 * toSessionDefinition().
 */
export function toProgramSession(
  sessionRow: ProgramSessionRowForBridge,
  blockRows: readonly ProgramSessionBlockRowForBridge[],
): ProgramSession {
  return {
    id: sessionRow.id,
    programId: sessionRow.treatment_program_id,
    sessionNumber: sessionRow.session_number,
    title: sessionRow.title,
    goal: sessionRow.goal,
    estimatedDurationMinutes: {
      min: sessionRow.estimated_duration_minutes_min,
      max: sessionRow.estimated_duration_minutes_max,
    },
    lifecycle: {
      requiresCalibration: sessionRow.requires_calibration,
      summaryMode: sessionRow.summary_mode as ProgramSession["lifecycle"]["summaryMode"],
    },
    blocks: blockRows.map(toProgramSessionBlock),
  };
}
