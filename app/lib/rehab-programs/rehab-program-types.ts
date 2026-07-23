/**
 * Neuro Rehabilitation program catalog — types (additive, code-only).
 *
 * Defines the condition -> pathway -> treatment program -> session
 * hierarchy as static, in-code catalog data. No database, no runtime
 * session execution — SessionOrchestrator/SessionDefinition remain the
 * only thing that actually runs a session; this module only describes
 * what a catalog entry looks like before it is ever assembled into one.
 *
 * ProgramSessionBlock deliberately does not duplicate MovementBlock
 * (session-orchestrator/types.ts). It reuses SessionBlockType for
 * blockType and carries only the persisted catalog fields needed to
 * describe an executable block — no live runtime state, refs, detector
 * state, or measured results. Those belong to MovementBlockResult once
 * a session actually runs, not to a static catalog entry.
 *
 * Calibration and Session Summary are SessionOrchestrator lifecycle
 * states (SessionState: "calibrating", "completed" —
 * session-orchestrator/types.ts), not executable blocks. They are
 * represented here only as ProgramSessionLifecycleConfig metadata on
 * ProgramSession, never as entries in a session's block array. A
 * session's `blocks` are exactly the blocks a Block Runner would tick;
 * calibration and summary are never ticked by a Block Runner, so they
 * never appear there — no marker blocks, no fake SessionBlockType
 * values, no registry-resolved runner for either.
 */
import type { SessionBlockType } from "@/app/lib/session-orchestrator/types";

export type Condition = {
  readonly id: string;
  readonly name: string;
};

export type RehabPathway = {
  readonly id: string;
  readonly conditionId: string;
  readonly name: string;
};

/**
 * Catalog-only description of one executable block. Not a MovementBlock:
 * this is what the static catalog persists about a block before it is
 * ever assembled into a real SessionDefinition. A future bridge step
 * maps this onto MovementBlock, adding the fields (completionMode,
 * supportedPositions, safetyRules, etc.) that only make sense once a
 * clinician/session-assembly step is involved — deliberately out of
 * scope here.
 */
export type ProgramSessionBlock = {
  readonly blockId: string;
  /** Reuses SessionBlockType from session-orchestrator/types.ts — not re-declared here. */
  readonly blockType: SessionBlockType;
  readonly title: string;
  readonly instructions: string;
  /** Foreign key into the exercise/pattern library (e.g. exercise-cv-registry, motion-pattern-registry). Absent for blocks that need no such reference. */
  readonly movementId?: string;
  /** Key into a feedback layer/target sequence registry — same convention as MovementBlock.feedbackProfile. */
  readonly feedbackProfile?: string;
  /** Catalog-level target duration, in seconds. Absent for acknowledgement-only instructional blocks. */
  readonly targetDurationSeconds?: number;
};

export type ProgramSessionSummaryMode = "standard" | "none";

/**
 * Calibration and summary are SessionOrchestrator lifecycle states, not
 * blocks. This carries only enough metadata to say whether this session
 * requires calibration and what kind of summary it produces — never a
 * fake block, marker, SessionBlockType value, or registry-resolved
 * runner standing in for either.
 */
export type ProgramSessionLifecycleConfig = {
  readonly requiresCalibration: boolean;
  readonly summaryMode: ProgramSessionSummaryMode;
};

export type ProgramSessionEstimatedDurationMinutes = {
  readonly min: number;
  readonly max: number;
};

export type ProgramSession = {
  readonly id: string;
  readonly programId: string;
  readonly sessionNumber: number;
  readonly title: string;
  readonly goal: string;
  readonly estimatedDurationMinutes: ProgramSessionEstimatedDurationMinutes;
  readonly lifecycle: ProgramSessionLifecycleConfig;
  /** Exactly the blocks a Block Runner would tick — never includes calibration or summary. */
  readonly blocks: readonly ProgramSessionBlock[];
};

export type TreatmentProgram = {
  readonly id: string;
  readonly pathwayId: string;
  readonly name: string;
  readonly version: number;
  readonly sessions: readonly ProgramSession[];
};
