/**
 * Validate motion_quality JSONB on CV metric POST (pilot smtPilot only).
 */

import {
  findForbiddenKeysInHeelRaisePilotRecord,
  HEEL_RAISE_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type HeelRaiseMotionPilotRecord,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  findForbiddenKeysInFunctionalReachPilotRecord,
  FUNCTIONAL_REACH_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type FunctionalReachMotionPilotRecord,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
import {
  findForbiddenKeysInLateralStepPilotRecord,
  LATERAL_STEP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type LateralStepMotionPilotRecord,
} from "@/app/lib/cv/lateral-step-motion-pilot-record";
import {
  findForbiddenKeysInStepUpPilotRecord,
  STEP_UP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type StepUpMotionPilotRecord,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import {
  findForbiddenKeysInMiniSquatPilotRecord,
  MINI_SQUAT_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type MiniSquatMotionPilotRecord,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import {
  findForbiddenKeysInStsPilotRecord,
  STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS,
  type CvMotionQualityPayload,
  type StsMotionPilotRecord,
} from "@/app/lib/cv/sts-motion-pilot-record";

const TRACKING_SIGNALS = new Set(["good", "fair", "poor", "unknown", "lost", "mixed"]);
const STS_PHASE_RATIO_KEYS = new Set([
  "seated",
  "rising",
  "standing",
  "returning",
  "rest",
  "unknown",
]);

const MINI_SQUAT_PHASE_RATIO_KEYS = new Set([
  "standing",
  "lowering",
  "bottom",
  "rising",
  "rest",
  "unknown",
]);

const HEEL_RAISE_PHASE_RATIO_KEYS = new Set([
  "standing",
  "rising",
  "peak_raise",
  "lowering",
  "rest",
  "unknown",
]);

const STEP_UP_PHASE_RATIO_KEYS = new Set([
  "standing",
  "step_ascent",
  "top_position",
  "step_descent",
  "rest",
  "unknown",
]);

const LATERAL_STEP_PHASE_RATIO_KEYS = new Set([
  "standing",
  "lateral_shift",
  "step_out",
  "return_to_center",
  "rest",
  "unknown",
]);

const FUNCTIONAL_REACH_PHASE_RATIO_KEYS = new Set([
  "standing",
  "reaching_forward",
  "peak_reach",
  "returning",
  "rest",
  "unknown",
]);

function isNullableDurationS(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isPctInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isMotionPilotPhaseRatios(
  value: unknown,
  allowedKeys: Set<string>,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const [key, ratio] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) return false;
    if (!isPctInt(ratio)) return false;
  }
  return true;
}

function isStsMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, STS_PHASE_RATIO_KEYS);
}

function isMiniSquatMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, MINI_SQUAT_PHASE_RATIO_KEYS);
}

function isHeelRaiseMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, HEEL_RAISE_PHASE_RATIO_KEYS);
}

function isStepUpMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, STEP_UP_PHASE_RATIO_KEYS);
}

function isLateralStepMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, LATERAL_STEP_PHASE_RATIO_KEYS);
}

function isFunctionalReachMotionPilotPhaseRatios(value: unknown): boolean {
  return isMotionPilotPhaseRatios(value, FUNCTIONAL_REACH_PHASE_RATIO_KEYS);
}

function isStsMotionPilotRepTimings(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const timings = value as Record<string, unknown>;
  return (
    isNullableDurationS(timings.avgS) &&
    isNullableDurationS(timings.fastestS) &&
    isNullableDurationS(timings.slowestS)
  );
}

function isStsMotionPilotVisibilityRatios(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ratios = value as Record<string, unknown>;
  return isPctInt(ratios.hip) && isPctInt(ratios.knee) && isPctInt(ratios.ankle);
}

function isStsMotionPilotRecord(value: unknown): value is StsMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...STS_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "smt-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "sit-to-stand") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isStsMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  if (r.attemptSummaries !== undefined) {
    if (!Array.isArray(r.attemptSummaries)) return false;
    for (const attempt of r.attemptSummaries) {
      if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) return false;
      const a = attempt as Record<string, unknown>;
      if (!Number.isInteger(a.attemptIndex) || (a.attemptIndex as number) < 1) return false;
      if (a.attemptType !== "complete" && a.attemptType !== "partial" && a.attemptType !== "unclear") {
        return false;
      }
      if (typeof a.risingDetected !== "boolean") return false;
      if (typeof a.standingReached !== "boolean") return false;
      if (typeof a.returningDetected !== "boolean") return false;
      if (typeof a.seatedReturnReached !== "boolean") return false;
      if (a.confidence !== "high" && a.confidence !== "medium" && a.confidence !== "low") {
        return false;
      }
      if (a.reason !== null && typeof a.reason !== "string") return false;
    }
  }
  return findForbiddenKeysInStsPilotRecord(r as StsMotionPilotRecord).length === 0;
}

function isMiniSquatMotionPilotRecord(value: unknown): value is MiniSquatMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...MINI_SQUAT_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "msm-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "mini-squat") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isMiniSquatMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  return findForbiddenKeysInMiniSquatPilotRecord(r as MiniSquatMotionPilotRecord).length === 0;
}

function isHeelRaiseMotionPilotRecord(value: unknown): value is HeelRaiseMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...HEEL_RAISE_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "hrm-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "heel-raise") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isHeelRaiseMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  return findForbiddenKeysInHeelRaisePilotRecord(r as HeelRaiseMotionPilotRecord).length === 0;
}

function isStepUpMotionPilotRecord(value: unknown): value is StepUpMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...STEP_UP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "sum-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "step-up") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isStepUpMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  return findForbiddenKeysInStepUpPilotRecord(r as StepUpMotionPilotRecord).length === 0;
}

function isLateralStepMotionPilotRecord(value: unknown): value is LateralStepMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...LATERAL_STEP_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "lsm-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "lateral-step") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isLateralStepMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  return findForbiddenKeysInLateralStepPilotRecord(r as LateralStepMotionPilotRecord).length === 0;
}

function isFunctionalReachMotionPilotRecord(value: unknown): value is FunctionalReachMotionPilotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r).sort();
  const allowed = [...FUNCTIONAL_REACH_PILOT_RECORD_ALLOWED_TOP_LEVEL_KEYS].sort();
  if (keys.join(",") !== allowed.join(",")) return false;
  if (r.pilotVersion !== "frm-1") return false;
  if (r.isPilot !== true) return false;
  if (r.exerciseId !== "functional-reach") return false;
  if (r.reviewRequired !== true) return false;
  if (typeof r.reviewReason !== "string" || r.reviewReason.length === 0) return false;
  if (typeof r.disclaimer !== "string" || r.disclaimer.length === 0) return false;
  if (!TRACKING_SIGNALS.has(String(r.trackingSignal))) return false;
  if (typeof r.movementDetected !== "boolean") return false;
  for (const key of [
    "snapshotCount",
    "durationS",
    "repCount",
    "completeReps",
    "unclearReps",
  ] as const) {
    if (!Number.isInteger(r[key]) || (r[key] as number) < 0) return false;
  }
  if (!isFunctionalReachMotionPilotPhaseRatios(r.phaseRatios)) return false;
  if (!isStsMotionPilotRepTimings(r.repTimings)) return false;
  if (!isStsMotionPilotVisibilityRatios(r.visibilityRatios)) return false;
  if (!Array.isArray(r.clinicianFlags)) return false;
  if (!r.clinicianFlags.every((flag) => typeof flag === "string" && flag.length > 0)) {
    return false;
  }
  return findForbiddenKeysInFunctionalReachPilotRecord(r as FunctionalReachMotionPilotRecord).length === 0;
}

/** Returns null when valid; error message when invalid. */
export function validateCvMotionQualityPayload(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return "motion_quality must be an object.";
  }
  if (findForbiddenKeysInSummaryPayload(value).length > 0) {
    return "motion_quality contains forbidden keys.";
  }
  const payload = value as CvMotionQualityPayload;
  if (payload.smtPilot !== undefined && !isStsMotionPilotRecord(payload.smtPilot)) {
    return "motion_quality.smtPilot is invalid.";
  }
  if (payload.msPilot !== undefined && !isMiniSquatMotionPilotRecord(payload.msPilot)) {
    return "motion_quality.msPilot is invalid.";
  }
  if (payload.hrPilot !== undefined && !isHeelRaiseMotionPilotRecord(payload.hrPilot)) {
    return "motion_quality.hrPilot is invalid.";
  }
  if (payload.suPilot !== undefined && !isStepUpMotionPilotRecord(payload.suPilot)) {
    return "motion_quality.suPilot is invalid.";
  }
  if (payload.lsPilot !== undefined && !isLateralStepMotionPilotRecord(payload.lsPilot)) {
    return "motion_quality.lsPilot is invalid.";
  }
  if (payload.frPilot !== undefined && !isFunctionalReachMotionPilotRecord(payload.frPilot)) {
    return "motion_quality.frPilot is invalid.";
  }
  return null;
}
