/**
 * CV evidence integrity gate — decides whether captured session data is sufficient
 * for joint-level or biomechanical interpretation. Uses existing motion pilot/report
 * fields only. No detectors, landmarks, or video storage.
 */

import type { MotionAnalysisSummaryLabel } from "@/app/lib/cv/motion-analysis-report";
import type { MotionAnalysisMotionPilotSummary } from "@/app/lib/cv/motion-analysis-report";
import { NO_TIMELINE_SNAPSHOTS_FLAG } from "@/app/lib/cv/patient-cv-capture-reliability";

const UNKNOWN_PHASE_HIGH_PCT = 25;
const VISIBILITY_LOW_PCT = 50;

const LOWER_BODY_EXERCISE_IDS = new Set([
  "sit-to-stand",
  "mini-squat",
  "heel-raise",
  "step-up",
  "lateral-step",
  "single-leg-stance",
]);

export const CV_EVIDENCE_LIMITED_HEADLINE = "Limited camera evidence";
export const CV_EVIDENCE_UNABLE_JOINT_NOTE =
  "Unable to assess joint-level movement from this capture";
export const CV_EVIDENCE_REP_ASSISTIVE_NOTE = "Rep count is assistive only";
export const CV_EVIDENCE_CLINICIAN_REVIEW_NOTE = "Clinician review required";

export type CvEvidenceIntegrityStatus = "sufficient" | "limited" | "unable_to_assess";

export type CvEvidenceIntegrityGate = {
  status: CvEvidenceIntegrityStatus;
  sufficientForBiomechanicalInterpretation: boolean;
  reasons: string[];
  headline: string;
  jointAssessmentNote: string | null;
  repCountNote: string | null;
  clinicianReviewNote: string;
};

export type EvaluateCvEvidenceIntegrityInput = {
  exerciseId?: string | null;
  completedReps?: number;
  trackingSignal?: string | null;
  summaryLabel?: MotionAnalysisSummaryLabel;
  motionPilot?: MotionAnalysisMotionPilotSummary | null;
  /** When motion pilot was synthesized from rep count without timeline snapshots. */
  evidenceSynthesized?: boolean;
};

function hasFlag(flags: string[] | null | undefined, flag: string): boolean {
  return flags?.includes(flag) ?? false;
}

function isLowerBodyExercise(exerciseId: string | null | undefined): boolean {
  if (!exerciseId) return false;
  return LOWER_BODY_EXERCISE_IDS.has(exerciseId.trim().toLowerCase());
}

function lowerBodyJointVisibilityInsufficient(
  visibility: MotionAnalysisMotionPilotSummary["visibilityRatios"] | null | undefined,
  hasTimelineSnapshots: boolean,
): boolean {
  if (!visibility) return false;
  const { hip, knee, ankle } = visibility;
  if (hasTimelineSnapshots && hip === 0 && knee === 0 && ankle === 0) return true;
  const lows = [hip, knee, ankle].filter((pct) => pct < VISIBILITY_LOW_PCT).length;
  return lows >= 2;
}

function phaseEvidenceInsufficient(
  pilot: MotionAnalysisMotionPilotSummary | null | undefined,
): boolean {
  if (!pilot) return true;
  const unknownPct = pilot.phaseRatios?.unknown ?? 0;
  if (unknownPct >= UNKNOWN_PHASE_HIGH_PCT) return true;
  if (hasFlag(pilot.clinicianFlags, "incomplete_cycle")) return true;
  if (pilot.unclearReps > 0 && pilot.completeReps > 0 && pilot.unclearReps >= pilot.completeReps) {
    return true;
  }
  if (!pilot.phaseRatios) return pilot.snapshotCount > 0;
  const meaningfulPhases = Object.entries(pilot.phaseRatios).filter(
    ([phase, pct]) =>
      phase !== "rest" &&
      phase !== "unknown" &&
      typeof pct === "number" &&
      pct > 0,
  );
  return meaningfulPhases.length === 0 && pilot.snapshotCount > 0;
}

function snapshotEvidenceMissing(
  pilot: MotionAnalysisMotionPilotSummary | null | undefined,
  evidenceSynthesized: boolean,
): boolean {
  if (evidenceSynthesized) return true;
  if (!pilot) return false;
  if (pilot.snapshotCount <= 0) return true;
  if (hasFlag(pilot.clinicianFlags, NO_TIMELINE_SNAPSHOTS_FLAG)) return true;
  return false;
}

/**
 * Evaluate whether session evidence supports joint-level / biomechanical interpretation.
 */
export function evaluateCvEvidenceIntegrity(
  input: EvaluateCvEvidenceIntegrityInput = {},
): CvEvidenceIntegrityGate {
  const exerciseId = input.exerciseId?.trim().toLowerCase() ?? null;
  const pilot = input.motionPilot ?? null;
  const tracking = pilot?.trackingSignal ?? input.trackingSignal?.trim().toLowerCase() ?? null;
  const reasons: string[] = [];

  const snapshotsMissing = snapshotEvidenceMissing(pilot, input.evidenceSynthesized === true);
  if (snapshotsMissing) {
    reasons.push("no_motion_timeline_snapshots");
  }

  const hasTimelineSnapshots = (pilot?.snapshotCount ?? 0) > 0 && !snapshotsMissing;
  if (
    isLowerBodyExercise(exerciseId) &&
    lowerBodyJointVisibilityInsufficient(pilot?.visibilityRatios, hasTimelineSnapshots)
  ) {
    reasons.push("lower_body_joint_visibility_insufficient");
  }

  if (phaseEvidenceInsufficient(pilot)) {
    reasons.push("phase_evidence_incomplete_or_unclear");
  }

  if (
    input.summaryLabel === "Limited visibility" ||
    tracking === "poor" ||
    tracking === "lost"
  ) {
    reasons.push("weak_camera_signal");
  }

  if (tracking === "unknown" && snapshotsMissing) {
    reasons.push("camera_signal_unverified_without_snapshots");
  }

  let status: CvEvidenceIntegrityStatus = "sufficient";
  if (snapshotsMissing || reasons.includes("lower_body_joint_visibility_insufficient")) {
    status = "unable_to_assess";
  } else if (reasons.length > 0) {
    status = "limited";
  }

  const sufficientForBiomechanicalInterpretation = status === "sufficient";

  const showRepNote =
    (input.completedReps ?? 0) > 0 || (pilot?.completeReps ?? 0) > 0;

  return {
    status,
    sufficientForBiomechanicalInterpretation,
    reasons,
    headline:
      status === "sufficient" ? "Adequate camera evidence" : CV_EVIDENCE_LIMITED_HEADLINE,
    jointAssessmentNote:
      sufficientForBiomechanicalInterpretation ? null : CV_EVIDENCE_UNABLE_JOINT_NOTE,
    repCountNote:
      !sufficientForBiomechanicalInterpretation && showRepNote
        ? CV_EVIDENCE_REP_ASSISTIVE_NOTE
        : null,
    clinicianReviewNote: CV_EVIDENCE_CLINICIAN_REVIEW_NOTE,
  };
}
