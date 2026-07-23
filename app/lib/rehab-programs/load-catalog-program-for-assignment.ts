import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import type { ProgramSessionSummaryMode } from "@/app/lib/rehab-programs/rehab-program-types";

/**
 * Server-only, read-only loader for a published catalog program, for use
 * by a future "create plan from catalog program" write path.
 *
 * Server-only by convention, not by package: this repo has no
 * `server-only` dependency installed (confirmed absent from
 * package.json/node_modules, and unused by any other file, including
 * the equally server-only app/api/plans/route.ts) — the existing
 * convention here is a doc-comment warning, not the `server-only`
 * import guard. This module must never be imported from a client
 * component; it takes a caller-supplied Supabase client precisely so
 * only a server-side caller (a route handler or another server module)
 * can construct and pass one in.
 *
 * This module never writes anything and never creates or persists a
 * treatment plan itself — see the migration 017 header comment for why
 * that write path is deliberately out of scope until a genuine atomic
 * persistence mechanism exists. It also never synthesizes an
 * instructional movementId, never converts a block into a
 * StoredExercise/PrescribedExerciseV1 entry, and never calls
 * rehab-program-runtime-adapter.ts — those are separate, TypeScript-
 * catalog-only concerns this DB-native loader has no reason to touch.
 *
 * Takes an already-constructed Supabase client rather than building one
 * internally (dependency injection), so this module stays testable with
 * a stub/mock client and so the caller — which already knows whether it
 * is running as service_role or on behalf of an authenticated provider —
 * controls which client is used.
 */

export type CatalogBlockForAssignment = {
  blockKey: string;
  blockOrder: number;
  blockType: SessionBlockType;
  title: string;
  instructions: string;
  movementId: string | null;
  feedbackProfile: string | null;
  targetDurationSeconds: number;
};

export type CatalogSessionForAssignment = {
  sourceProgramSessionId: string;
  sessionKey: string;
  sessionNumber: number;
  title: string;
  goal: string;
  estimatedDurationMinutes: {
    min: number;
    max: number;
  };
  requiresCalibration: boolean;
  summaryMode: ProgramSessionSummaryMode;
  blocks: readonly CatalogBlockForAssignment[];
};

export type CatalogProgramForAssignment = {
  sourceTreatmentProgramId: string;
  slug: string;
  name: string;
  version: number;
  sessions: readonly CatalogSessionForAssignment[];
};

export type LoadCatalogProgramErrorReason =
  | "not_found"
  | "not_published"
  | "load_failed"
  | "invalid_data";

/**
 * Thrown for every rejection path. Carries a stable `reason` for the
 * caller to branch on, and a message safe to surface — raw PostgREST/
 * Postgres error text is never included; it is only logged server-side
 * (console.error), matching the existing convention in
 * app/api/plans/route.ts.
 */
export class LoadCatalogProgramError extends Error {
  readonly reason: LoadCatalogProgramErrorReason;

  constructor(reason: LoadCatalogProgramErrorReason, message: string) {
    super(message);
    this.name = "LoadCatalogProgramError";
    this.reason = reason;
  }
}

const KNOWN_BLOCK_TYPES: readonly SessionBlockType[] = [
  "movement-target",
  "movement-pattern",
  "instructional",
];

const KNOWN_SUMMARY_MODES: readonly ProgramSessionSummaryMode[] = ["standard", "none"];

export async function loadCatalogProgramForAssignment(
  client: SupabaseClient<Database>,
  treatmentProgramId: string,
): Promise<CatalogProgramForAssignment> {
  const { data: program, error: programError } = await client
    .from("treatment_programs")
    .select("id, slug, name, version, status")
    .eq("id", treatmentProgramId)
    .maybeSingle();

  if (programError) {
    console.error("[loadCatalogProgramForAssignment] treatment_programs query failed:", programError.message);
    throw new LoadCatalogProgramError("load_failed", "Failed to load the treatment program.");
  }

  if (!program) {
    throw new LoadCatalogProgramError(
      "not_found",
      `No treatment program found for id "${treatmentProgramId}".`,
    );
  }

  if (program.status !== "published") {
    throw new LoadCatalogProgramError(
      "not_published",
      `Treatment program "${treatmentProgramId}" is not eligible for a new assignment (status: ${program.status}).`,
    );
  }

  const { data: sessionRows, error: sessionsError } = await client
    .from("program_sessions")
    .select(
      "id, session_key, session_number, title, goal, estimated_duration_minutes_min, estimated_duration_minutes_max, requires_calibration, summary_mode",
    )
    .eq("treatment_program_id", treatmentProgramId)
    .order("session_number", { ascending: true });

  if (sessionsError) {
    console.error("[loadCatalogProgramForAssignment] program_sessions query failed:", sessionsError.message);
    throw new LoadCatalogProgramError("load_failed", "Failed to load the program's sessions.");
  }

  if (!sessionRows || sessionRows.length === 0) {
    // A published program is guaranteed by migration 014's completeness
    // trigger to have at least one session — this should never happen.
    // Fail loudly rather than silently returning an empty session list.
    throw new LoadCatalogProgramError(
      "invalid_data",
      `Published treatment program "${treatmentProgramId}" has no sessions.`,
    );
  }

  const sessionIds = sessionRows.map((row) => row.id);

  const { data: blockRows, error: blocksError } = await client
    .from("program_session_blocks")
    .select(
      "program_session_id, block_key, block_order, block_type, title, instructions, movement_id, feedback_profile, target_duration_seconds",
    )
    .in("program_session_id", sessionIds)
    .order("block_order", { ascending: true });

  if (blocksError) {
    console.error("[loadCatalogProgramForAssignment] program_session_blocks query failed:", blocksError.message);
    throw new LoadCatalogProgramError("load_failed", "Failed to load the program's blocks.");
  }

  // Group by program_session_id. A single query ordered by block_order
  // ascending preserves that same relative order within any subsequence
  // filtered to one session_id, so no secondary sort is needed here.
  const blocksBySessionId = new Map<string, CatalogBlockForAssignment[]>();
  for (const row of blockRows ?? []) {
    if (!KNOWN_BLOCK_TYPES.includes(row.block_type as SessionBlockType)) {
      throw new LoadCatalogProgramError(
        "invalid_data",
        `program_session_blocks row "${row.block_key}" has an unrecognized block_type: "${row.block_type}".`,
      );
    }
    const bucket = blocksBySessionId.get(row.program_session_id) ?? [];
    bucket.push({
      blockKey: row.block_key,
      blockOrder: row.block_order,
      blockType: row.block_type as SessionBlockType,
      title: row.title,
      instructions: row.instructions,
      movementId: row.movement_id,
      feedbackProfile: row.feedback_profile,
      targetDurationSeconds: row.target_duration_seconds,
    });
    blocksBySessionId.set(row.program_session_id, bucket);
  }

  const sessions: CatalogSessionForAssignment[] = sessionRows.map((row) => {
    const blocks = blocksBySessionId.get(row.id) ?? [];
    if (blocks.length === 0) {
      // A published program's every session is guaranteed by migration
      // 014's completeness trigger to have at least one block — this
      // should never happen. Fail loudly rather than returning an
      // empty block list a future caller might render as a real,
      // intentionally-empty session.
      throw new LoadCatalogProgramError(
        "invalid_data",
        `Session "${row.session_key}" of treatment program "${treatmentProgramId}" has no blocks.`,
      );
    }
    if (!KNOWN_SUMMARY_MODES.includes(row.summary_mode as ProgramSessionSummaryMode)) {
      throw new LoadCatalogProgramError(
        "invalid_data",
        `Session "${row.session_key}" has an unrecognized summary_mode: "${row.summary_mode}".`,
      );
    }
    return {
      sourceProgramSessionId: row.id,
      sessionKey: row.session_key,
      sessionNumber: row.session_number,
      title: row.title,
      goal: row.goal,
      estimatedDurationMinutes: {
        min: row.estimated_duration_minutes_min,
        max: row.estimated_duration_minutes_max,
      },
      requiresCalibration: row.requires_calibration,
      summaryMode: row.summary_mode as ProgramSessionSummaryMode,
      blocks,
    };
  });

  return {
    sourceTreatmentProgramId: program.id,
    slug: program.slug,
    name: program.name,
    version: program.version,
    sessions,
  };
}
