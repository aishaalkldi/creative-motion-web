/**
 * adaptive-targets.ts
 *
 * Computes per-patient adaptive rehabilitation targets from session history.
 *
 * Progression rules (conservative / safety-first):
 * ─────────────────────────────────────────────────
 *  INCREASE  — last 2 sessions: movementQualityScore ≥ 75 AND no unsafe warning
 *              AND no therapistLabel of "unsafe"
 *  DECREASE  — any session in last 3 has unsafe warning or therapistLabel "unsafe"
 *  STABLE    — everything else (inconsistent performance or insufficient data)
 *
 * These targets are advisory.  The therapist must approve target changes
 * before they are communicated to the patient as a goal.
 *
 * Decision-support only · Not a clinical diagnosis.
 */

import type { SessionRecord } from "../session-store";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

export type TargetDirection = "increasing" | "stable" | "decreasing";

/** A single target-change event recorded in the progression history. */
export interface ProgressionEvent {
  date:      string;
  metric:    "reps" | "rom" | "symmetry";
  direction: TargetDirection;
  from:      number;
  to:        number;
  reason:    string;
}

/** Adaptive targets computed for one patient from their session history. */
export interface AdaptiveTargets {
  patientId: string;
  /** Established during the first 1–2 sessions. */
  baseline: {
    reps:      number;
    romScore:  number;
    symmetry:  number;
    movQuality: number;
  };
  /** Current recommended targets — updated after each session. */
  current: {
    targetReps:     number;
    targetROM:      number;
    targetSymmetry: number;
  };
  direction:  TargetDirection;
  rationale:  string;
  sessionBasis: number;
  /** Whether both last 2 sessions met the quality threshold for advancement. */
  readyToAdvance: boolean;
  progressionEvents: ProgressionEvent[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════════════════ */

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length);
}

/** Coefficient of variation — measures consistency. */
function cv(arr: number[]): number {
  const m = mean(arr);
  return m > 0 ? stdDev(arr) / m : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main computation
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute adaptive targets from a patient's chronologically sorted sessions.
 * Returns null for empty input.
 *
 * Calling this with the latest session list after each save will keep the
 * targets current without a separate storage layer — targets are derived,
 * not stored.
 */
export function computeAdaptiveTargets(sessions: SessionRecord[]): AdaptiveTargets | null {
  if (sessions.length === 0) return null;

  const patientId = sessions[0].patientId;

  /* ── Baseline: first 1–2 sessions ── */
  const baseSessions = sessions.slice(0, Math.min(2, sessions.length));
  const baseReps     = Math.round(mean(baseSessions.map((s) => s.totalSteps)));
  const baseROMs     = baseSessions.filter((s) => s.biomechanics).map((s) => s.biomechanics!.romScore).filter((v): v is number => v !== null);
  const baseROM      = baseROMs.length > 0 ? Math.round(mean(baseROMs)) : 50;
  const baseSymVals  = baseSessions.map((s) => s.symmetryPct).filter((v) => v >= 0);
  const baseSym      = baseSymVals.length > 0 ? Math.round(mean(baseSymVals)) : 75;
  const baseQuals = baseSessions
    .map((s) => s.biomechanics?.movementQualityScore)
    .filter((q): q is number => q != null);
  const baseQual = baseQuals.length > 0 ? Math.round(mean(baseQuals)) : 50;

  /* ── Recent performance window (last 3 sessions or all if fewer) ── */
  const recent  = sessions.slice(-3);
  const last2   = sessions.slice(-2);

  /* ── Safety gate: unsafe signal in last 3 sessions ── */
  const hasUnsafe = recent.some(
    (s) =>
      s.therapistLabel === "unsafe" ||
      (s.warnings ?? []).some((w) => w.toLowerCase().includes("unsafe")),
  );

  /* ── Readiness check: last 2 sessions both meet quality threshold ── */
  const last2Qualities = last2
    .map((s) => s.biomechanics?.movementQualityScore)
    .filter((q): q is number => q != null);

  const readyToAdvance =
    !hasUnsafe &&
    sessions.length >= 2 &&
    last2Qualities.length >= 1 &&
    last2Qualities.every((q) => q >= 75);

  /* ── Consistency check ── */
  const recentSteps = recent.map((s) => s.totalSteps);
  const isConsistent = cv(recentSteps) < 0.25; // CV < 25 % = consistent

  /* ── Progression direction ── */
  let direction: TargetDirection;
  let rationale: string;

  if (hasUnsafe) {
    direction = "decreasing";
    rationale = "Target reduced: unsafe signal detected in recent sessions. Therapist review required.";
  } else if (readyToAdvance && isConsistent) {
    direction = "increasing";
    rationale = "Movement quality ≥ 75 across last two sessions with consistent output. Gradual target increase applied.";
  } else if (sessions.length < 2) {
    direction = "stable";
    rationale = "Baseline phase — targets will update after the second session.";
  } else if (!isConsistent) {
    direction = "stable";
    rationale = "Performance is variable. Targets held stable until consistency improves.";
  } else {
    direction = "stable";
    rationale = "Movement quality below 75 in recent sessions. Maintain current targets and focus on quality.";
  }

  /* ── Apply multiplier to current averages ── */
  const avgRecentReps = mean(recent.map((s) => s.totalSteps));
  const avgRecentROMs = mean(recent.filter((s) => s.biomechanics).map((s) => s.biomechanics!.romScore).filter((v): v is number => v !== null));
  const recentSymVals = recent.map((s) => s.symmetryPct).filter((v) => v >= 0);
  const avgRecentSym  = recentSymVals.length > 0 ? mean(recentSymVals) : baseSym;

  const mult =
    direction === "increasing" ? 1.08 :   // +8 % increment
    direction === "decreasing" ? 0.90 :   // −10 % decrement (safety margin)
                                  1.00;

  const targetReps     = Math.max(5,  Math.min(120, Math.round(Math.max(avgRecentReps, baseReps) * mult * 1.05)));
  const targetROM      = Math.max(30, Math.min(100, Math.round(Math.max(avgRecentROMs || baseROM, baseROM) * mult)));
  const targetSymmetry = Math.max(50, Math.min(100, Math.round(Math.max(avgRecentSym, baseSym) * mult)));

  /* ── Build progression event log ── */
  const progressionEvents: ProgressionEvent[] = [];
  if (sessions.length >= 2) {
    const prev = sessions[sessions.length - 2];
    const curr = sessions[sessions.length - 1];
    if (prev.totalSteps !== curr.totalSteps) {
      progressionEvents.push({
        date:      curr.date,
        metric:    "reps",
        direction: curr.totalSteps > prev.totalSteps ? "increasing" : "decreasing",
        from:      prev.totalSteps,
        to:        curr.totalSteps,
        reason:    `Session ${sessions.length}: step count changed`,
      });
    }
  }

  return {
    patientId,
    baseline: { reps: baseReps, romScore: baseROM, symmetry: baseSym, movQuality: baseQual },
    current:  { targetReps, targetROM, targetSymmetry },
    direction,
    rationale,
    sessionBasis: sessions.length,
    readyToAdvance,
    progressionEvents,
  };
}
