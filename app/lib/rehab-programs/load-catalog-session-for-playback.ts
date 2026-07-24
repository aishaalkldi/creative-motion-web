import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";
import type { ProgramSession } from "@/app/lib/rehab-programs/rehab-program-types";
import type { ProgramSessionSummaryMode } from "@/app/lib/rehab-programs/rehab-program-types";
import { toProgramSession } from "./catalog-session-playback-bridge";

/**
 * Server-only, read-only loader for an already-assigned catalog
 * session's runtime data, keyed by plan_sessions.source_program_
 * session_id (migration 017's provenance column).
 *
 * Server-only by convention, not by package — same as
 * load-catalog-program-for-assignment.ts (PR 6): this repo has no
 * `server-only` dependency installed. This module must never be
 * imported from a client component.
 *
 * This is a PLAYBACK loader, not an assignment-eligibility loader —
 * it answers a different question than
 * load-catalog-program-for-assignment.ts (PR 6, which gates whether a
 * NEW plan may be created from a program and requires status =
 * published). Here, the plan already exists; the source program's
 * status may have changed since assignment, and migrations 017/018
 * both establish that a plan sourced from a program that is later
 * archived must remain fully usable. Accordingly this loader accepts
 * an owning treatment_programs row whose status is 'published' OR
 * 'archived', and rejects only 'draft' (structurally unreachable given
 * the provenance triggers only ever allow assignment from a published
 * program, but checked defensively) or missing.
 *
 * Never writes anything. Never calls toSessionDefinition() or
 * instantiates SessionOrchestrator — this module only produces the
 * ProgramSession data another, later step would need to do that; that
 * wiring is deliberately out of scope here.
 *
 * Takes an already-constructed Supabase client rather than building one
 * internally (dependency injection), so this module stays testable
 * with a stub/mock client and so the caller controls which client is
 * used, matching the convention established in
 * load-catalog-program-for-assignment.ts.
 */

export type LoadCatalogSessionForPlaybackErrorReason =
  | "not_found"
  | "not_eligible"
  | "load_failed"
  | "invalid_data";

/**
 * Thrown for every rejection path. Carries a stable `reason` for the
 * caller to branch on, and a message safe to surface — raw DB error
 * text is never included; it is only logged server-side (console.error
 * with structured context), matching the convention established in
 * load-catalog-program-for-assignment.ts.
 */
export class LoadCatalogSessionForPlaybackError extends Error {
  readonly reason: LoadCatalogSessionForPlaybackErrorReason;

  constructor(reason: LoadCatalogSessionForPlaybackErrorReason, message: string) {
    super(message);
    this.name = "LoadCatalogSessionForPlaybackError";
    this.reason = reason;
  }
}

const KNOWN_BLOCK_TYPES: readonly SessionBlockType[] = [
  "movement-target",
  "movement-pattern",
  "instructional",
];

const KNOWN_SUMMARY_MODES: readonly ProgramSessionSummaryMode[] = ["standard", "none"];

const ELIGIBLE_PROGRAM_STATUSES: readonly string[] = ["published", "archived"];

function logFailure(context: string, sourceProgramSessionId: string, detail: string): void {
  console.error(
    "[loadCatalogSessionForPlayback]",
    JSON.stringify({ context, sourceProgramSessionId, detail }),
  );
}

export async function loadCatalogSessionForPlayback(
  client: SupabaseClient<Database>,
  sourceProgramSessionId: string,
): Promise<ProgramSession> {
  if (!sourceProgramSessionId?.trim()) {
    throw new LoadCatalogSessionForPlaybackError(
      "not_found",
      "sourceProgramSessionId is required.",
    );
  }

  const { data: sessionRow, error: sessionError } = await client
    .from("program_sessions")
    .select(
      "id, treatment_program_id, session_key, session_number, title, goal, estimated_duration_minutes_min, estimated_duration_minutes_max, requires_calibration, summary_mode",
    )
    .eq("id", sourceProgramSessionId)
    .maybeSingle();

  if (sessionError) {
    logFailure("program_sessions query failed", sourceProgramSessionId, sessionError.message);
    throw new LoadCatalogSessionForPlaybackError("load_failed", "Failed to load the session.");
  }

  if (!sessionRow) {
    throw new LoadCatalogSessionForPlaybackError(
      "not_found",
      `No program_sessions row found for id "${sourceProgramSessionId}".`,
    );
  }

  if (!KNOWN_SUMMARY_MODES.includes(sessionRow.summary_mode as ProgramSessionSummaryMode)) {
    throw new LoadCatalogSessionForPlaybackError(
      "invalid_data",
      `Session "${sessionRow.session_key}" has an unrecognized summary_mode: "${sessionRow.summary_mode}".`,
    );
  }

  const { data: programRow, error: programError } = await client
    .from("treatment_programs")
    .select("status")
    .eq("id", sessionRow.treatment_program_id)
    .maybeSingle();

  if (programError) {
    logFailure("treatment_programs query failed", sourceProgramSessionId, programError.message);
    throw new LoadCatalogSessionForPlaybackError("load_failed", "Failed to load the source program.");
  }

  if (!programRow || !ELIGIBLE_PROGRAM_STATUSES.includes(programRow.status)) {
    // Generic on purpose: does not distinguish missing / draft, matching
    // the same non-disclosure posture as load-catalog-program-for-
    // assignment.ts and migration 017/018's own trigger error wording.
    throw new LoadCatalogSessionForPlaybackError(
      "not_eligible",
      `Session "${sourceProgramSessionId}" is not eligible for playback.`,
    );
  }

  const { data: blockRows, error: blocksError } = await client
    .from("program_session_blocks")
    .select(
      "program_session_id, block_key, block_order, block_type, title, instructions, movement_id, feedback_profile, target_duration_seconds",
    )
    .eq("program_session_id", sourceProgramSessionId)
    .order("block_order", { ascending: true });

  if (blocksError) {
    logFailure("program_session_blocks query failed", sourceProgramSessionId, blocksError.message);
    throw new LoadCatalogSessionForPlaybackError("load_failed", "Failed to load the session's blocks.");
  }

  if (!blockRows || blockRows.length === 0) {
    // A published-or-archived program is guaranteed by migration 014's
    // publish-time completeness trigger to have at least one block per
    // session — this should never happen. Fail loudly rather than
    // silently returning an empty block list.
    throw new LoadCatalogSessionForPlaybackError(
      "invalid_data",
      `Session "${sourceProgramSessionId}" has no blocks.`,
    );
  }

  for (const row of blockRows) {
    if (!KNOWN_BLOCK_TYPES.includes(row.block_type as SessionBlockType)) {
      throw new LoadCatalogSessionForPlaybackError(
        "invalid_data",
        `program_session_blocks row "${row.block_key}" has an unrecognized block_type: "${row.block_type}".`,
      );
    }
  }

  return toProgramSession(sessionRow, blockRows);
}
