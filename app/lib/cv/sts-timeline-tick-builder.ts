/**
 * SMT-1 / PR3a — Derive STS MotionTimeline tick input from detector capture snapshots.
 * No detector edits, landmarks, video, or persistence.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { MotionSnapshot, StsMotionSnapshotEvent } from "@/app/lib/cv/motion-summary-types";
import { findForbiddenKeysInSummaryPayload } from "@/app/lib/cv/motion-summary-types";
import {
  stsTimelineTickFromDetectorSnapshot,
  type StsMotionTimelineTickInput,
} from "@/app/lib/cv/motion-timeline-accumulator";
import type { SitToStandDetectorSnapshot } from "@/app/lib/cv/sit-to-stand-detector";
import {
  classifyStsMovementPhase,
  type StsPhaseClassifierState,
} from "@/app/lib/cv/sts-phase-classifier";

/** Optional capture-side hints (stand phase when available from caller). */
export type StsTimelineTickCaptureContext = {
  bodyFraming?: BodyFramingProfileId;
  standPhase?: "up" | "down";
  events?: readonly StsMotionSnapshotEvent[];
  /** Stateful STS phase classifier — enables rising/standing/returning inference. */
  phaseClassifier?: StsPhaseClassifierState;
};

/** Assistive visibility scalars from tracking signal — not per-landmark truth. */
const TRACKING_VISIBILITY_SCALAR: Record<CvTrackingQuality | "lost", number> = {
  good: 0.8,
  fair: 0.55,
  poor: 0.3,
  unknown: 0.35,
  lost: 0,
};

/** Map STS stand phase to timeline movement phase. */
export function stsMovementPhaseFromStandPhase(
  standPhase: "up" | "down",
): MotionSnapshot["movementPhase"] {
  return standPhase === "up" ? "standing" : "seated";
}

function resolveTrackingQualityForVisibility(
  snap: SitToStandDetectorSnapshot,
): CvTrackingQuality | "lost" {
  if (snap.trackingStatus === "pose-lost") return "lost";
  return snap.trackingQuality ?? "unknown";
}

/** Derive assistive joint visibility scalars from snapshot tracking (no raw landmarks). */
export function stsVisibilityFromCaptureSnapshot(
  snap: SitToStandDetectorSnapshot,
): MotionSnapshot["visibility"] {
  let scalar = TRACKING_VISIBILITY_SCALAR[resolveTrackingQualityForVisibility(snap)];
  if (snap.bodyFramingState === "low_visibility") {
    scalar = Math.min(scalar, 0.35);
  }
  return { hip: scalar, knee: scalar, ankle: scalar };
}

/** Infer movement phase from capture snapshot when stand phase is not supplied. */
export function stsMovementPhaseFromCaptureSnapshot(
  snap: SitToStandDetectorSnapshot,
  standPhase?: "up" | "down",
): MotionSnapshot["movementPhase"] {
  if (standPhase !== undefined) {
    return stsMovementPhaseFromStandPhase(standPhase);
  }
  if (snap.trackingStatus === "pose-lost") return "unknown";
  if (snap.isBaselineCalibrating) return "rest";
  if (snap.poseReadiness === "checking" || snap.poseReadiness === "not_ready") return "rest";
  if (snap.bodyFramingState === "checking") return "rest";
  return "seated";
}

/**
 * Build a timeline tick from an STS detector snapshot and derived capture fields.
 * Sit-to-stand only — caller must pass an STS snapshot.
 */
export function buildStsTimelineTickFromCaptureState(
  snap: SitToStandDetectorSnapshot,
  context: StsTimelineTickCaptureContext = {},
): StsMotionTimelineTickInput {
  const bodyFraming =
    context.bodyFraming ?? PATIENT_STS_CONFIG.bodyFramingProfileId ?? "seated-rise";

  const movementPhase = context.phaseClassifier
    ? classifyStsMovementPhase(snap, context.phaseClassifier)
    : stsMovementPhaseFromCaptureSnapshot(snap, context.standPhase);

  return stsTimelineTickFromDetectorSnapshot(snap, {
    movementPhase,
    visibility: stsVisibilityFromCaptureSnapshot(snap),
    bodyFraming,
    events: context.events,
  });
}

/** Privacy guard for serialized tick payloads. */
export function findForbiddenKeysInStsTimelineTick(value: unknown): string[] {
  return findForbiddenKeysInSummaryPayload(value);
}
