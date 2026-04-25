/**
 * gait-phase.ts — Protocol phase abstraction for the Gait Training Program.
 *
 * Derives the patient's current protocol phase entirely from existing
 * ProgressionSummary data — no new storage, no new clinical thresholds.
 *
 * Three phases map to the clinical rehabilitation arc:
 *
 *   Phase 1 — Foundation
 *     Working toward High Knee March progression criteria.
 *     Goal: establish bilateral gait baseline, confirm safe participation.
 *     Exit: 3 consecutive qualifying sessions (ROM ≥ 65, symmetry ≥ 75%, ≥ 28 reps).
 *
 *   Phase 2 — Development  (preparable now; full exercise content is future)
 *     High Knee March passed. Refining quality, cadence, bilateral coordination.
 *     Exit: ≥ 2 Phase 2 exercises (Rhythm March, Side Stepping) passed.
 *
 *   Phase 3 — Functional Integration  (future)
 *     Complex gait patterns and real-world applicable movement.
 *
 * Decision-support only. All phase conclusions are advisory.
 */

import type { ProgressionSummary } from "./gait-progression";

/* ── Public interface ─────────────────────────────────────────────────────── */

export interface GaitPhaseInfo {
  /** Current phase number (1, 2, or 3). */
  phaseNumber: 1 | 2 | 3;

  /** Human-readable phase name (e.g. "Foundation"). */
  phaseName: string;

  /** One-line clinical intent shown in the UI. */
  clinicalIntent: string;

  /**
   * One-line description of the exit condition for the current phase.
   * Shown as context below the progress indicator.
   */
  exitCondition: string;

  /** True when the current phase's progression criteria have been met. */
  isComplete: boolean;

  /**
   * Progress toward phase completion as a fraction 0–1.
   * Used to render the progress bar on the Program Hub strip.
   */
  progressFraction: number;

  /**
   * Short human-readable progress label (e.g. "2 / 3 qualifying sessions").
   * Shown alongside the progress bar.
   */
  progressLabel: string;

  /**
   * ISO-8601 date of the session that completed the phase, if applicable.
   * Derived from ProgressionStatus.sessionResults — the last result when eligible.
   * Null if the phase is still in progress or no sessions exist yet.
   */
  completionDate: string | null;
}

/* ── Exercise ID groupings ────────────────────────────────────────────────── */

/** Exercise IDs that constitute Phase 2 content. */
const PHASE_2_IDS = new Set(["rhythm_march", "side_stepping"]);

/* ══════════════════════════════════════════════════════════════════════════
   computeGaitPhase
══════════════════════════════════════════════════════════════════════════ */

/**
 * Derives the patient's current Gait Training Program phase from an existing
 * ProgressionSummary and total session count.
 *
 * Pure function — reads no storage. Call after buildProgressionSummary.
 *
 * @param progression  Output of buildProgressionSummary().
 * @param sessionCount Total recorded sessions for this patient.
 */
export function computeGaitPhase(
  progression: ProgressionSummary,
  sessionCount: number,
): GaitPhaseInfo {
  const { ladder, status } = progression;

  /* ── Check Phase 1 (High Knee March) completion ── */
  const hkmEntry = ladder.find(({ exercise }) => exercise.id === "high_knee_march");
  const hkmPassed = hkmEntry?.status === "passed";

  /* ── Phase 2: High Knee March done; working through next exercises ── */
  if (hkmPassed) {
    const phase2Passed = ladder.filter(
      ({ exercise, status: st }) => PHASE_2_IDS.has(exercise.id) && st === "passed",
    ).length;

    // Phase 3: both Phase 2 exercises complete
    if (phase2Passed >= 2) {
      return {
        phaseNumber:      3,
        phaseName:        "Functional Integration",
        clinicalIntent:   "Transition to complex, real-world applicable gait patterns.",
        exitCondition:    "All functional exercises completed — therapist review required",
        isComplete:       false, // defined when Phase 3 exercises are implemented
        progressFraction: 0,
        progressLabel:    "Phase 3 in progress",
        completionDate:   null,
      };
    }

    // Phase 2: working through Rhythm March / Side Stepping
    return {
      phaseNumber:      2,
      phaseName:        "Development",
      clinicalIntent:   "Refine movement quality, cadence control, and bilateral coordination.",
      exitCondition:    "Complete 2 of 2 Phase 2 exercises with therapist review",
      isComplete:       false,
      progressFraction: phase2Passed / 2,
      progressLabel:    `${phase2Passed} / 2 Phase 2 exercises completed`,
      completionDate:   null,
    };
  }

  /* ── Phase 1: working toward High Knee March progression ── */
  const consecutivePassing  = status?.consecutivePassing  ?? 0;
  const consecutiveRequired = status?.consecutiveRequired ?? 3;
  const isEligible          = status?.eligible ?? false;

  // Completion date: the last session in the qualifying window when eligible
  const sessionResults  = status?.sessionResults ?? [];
  const completionDate  = isEligible && sessionResults.length > 0
    ? sessionResults[sessionResults.length - 1].date
    : null;

  if (sessionCount === 0) {
    return {
      phaseNumber:      1,
      phaseName:        "Foundation",
      clinicalIntent:   "Establish bilateral gait baseline and confirm safe participation.",
      exitCondition:    `${consecutiveRequired} consecutive qualifying sessions — ROM ≥ 65, symmetry ≥ 75%, ≥ 28 reps`,
      isComplete:       false,
      progressFraction: 0,
      progressLabel:    "No sessions yet",
      completionDate:   null,
    };
  }

  return {
    phaseNumber:      1,
    phaseName:        "Foundation",
    clinicalIntent:   "Establish bilateral gait baseline and confirm safe participation.",
    exitCondition:    `${consecutiveRequired} consecutive qualifying sessions — ROM ≥ 65, symmetry ≥ 75%, ≥ 28 reps`,
    isComplete:       isEligible,
    progressFraction: Math.min(consecutivePassing / consecutiveRequired, 1),
    progressLabel:    `${consecutivePassing} / ${consecutiveRequired} qualifying sessions`,
    completionDate,
  };
}
