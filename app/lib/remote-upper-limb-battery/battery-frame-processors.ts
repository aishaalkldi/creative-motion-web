/**
 * Remote battery frame processors — thin wrappers over existing/new CV modules.
 */

import { BLAZEPOSE_ACQUISITION_ADAPTER, type InputAcquisitionContext } from "@/app/lib/input-acquisition";
import {
  computeReachExtentForSide,
  FunctionalReachRepCounter,
} from "@/app/lib/cv/functional-reach-detector";
import type { SagittalHipRepPhase } from "@/app/lib/cv/sagittal-hip-rep-core";
import { PATIENT_FUNCTIONAL_REACH_REP_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { computeTorsoSpan } from "@/app/lib/cv/sagittal-hip-rep-core";
import {
  createShoulderAbductionReachDetectorState,
  updateShoulderAbductionReachDetector,
  type ShoulderAbductionReachDetectorState,
} from "@/app/lib/shoulder-rehabilitation/shoulder-abduction-reach-detector";
import {
  DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS,
  type ShoulderAbductionReachSide,
} from "@/app/lib/shoulder-rehabilitation/shoulder-abduction-reach-contract";
import { computeShoulderAbductionReachSideMetrics } from "@/app/lib/shoulder-rehabilitation/shoulder-abduction-reach-metrics";
import {
  createShoulderFlexionPhaseState,
  tickShoulderFlexionPhase,
  type ShoulderFlexionPhaseState,
} from "./shoulder-flexion-phase";
import { computeShoulderFlexionElevationDegrees, computeShoulderFlexionElevationFromPoseLandmarks, canObserveShoulderFlexionArm } from "./shoulder-flexion-metrics";
import { DEFAULT_SHOULDER_FLEXION_THRESHOLDS } from "./shoulder-flexion-contract";
import {
  createElbowFlexionPhaseState,
  tickElbowFlexionPhase,
  type ElbowFlexionPhaseState,
} from "./elbow-flexion-phase";
import { computeElbowFlexionInteriorAngleDegrees } from "./elbow-flexion-metrics";
import { DEFAULT_ELBOW_FLEXION_THRESHOLDS } from "./elbow-flexion-contract";
import {
  blazeIndicesForSide,
  evaluateBatteryArmTracking,
  readArmVisibility,
  visibilityQualityFromValues,
} from "./battery-tracking";
import type { RemoteUpperLimbBatterySide } from "./types";

export type BatteryTrackingQuality = "good" | "fair" | "poor" | "unknown";

export type BatteryFrameProcessorSnapshot = {
  trackingReady: boolean;
  trackingQuality: BatteryTrackingQuality;
  trackingRejectionReason?: string | null;
  landmarkVisibility?: {
    testedSide: RemoteUpperLimbBatterySide;
    right: { shoulder: number; elbow: number; wrist: number };
    left: { shoulder: number; elbow: number; wrist: number };
  };
  repCount: number;
  lastRepPeak: number | null;
  completedPeaksDeg: number[];
  movementPhase: string;
  peakReachExtent: number | null;
};

/**
 * Every battery processor is armed explicitly (#295 / CV-1).
 *
 * Frames keep flowing during positioning and countdown so the patient sees a
 * live preview and the orchestrator can gate on tracking readiness, but the
 * clinical rep FSM stays frozen until `beginMovementTracking()` is called at
 * the transition into `test_active`. Only frames captured during the actual
 * test may contribute a repetition or a completed peak.
 */
export type BatteryTestProcessor = {
  reset: () => void;
  /** Arm + reset the measurement state — call once, at the transition into test_active. */
  beginMovementTracking: () => void;
  isMovementTrackingEnabled: () => boolean;
  processFrame: (
    landmarks: readonly PoseLandmark[],
    context: InputAcquisitionContext,
  ) => BatteryFrameProcessorSnapshot;
};

/** Functional reach shares the base contract; kept as a named alias for call sites. */
export type BatteryFunctionalReachProcessor = BatteryTestProcessor;

/**
 * Battery functional reach counts one attempt only after baseline + forward excursion + return.
 * Raw counter repCount can increment at peak entry; orchestrator must see repCount 0 until rest.
 */
export function resolveFunctionalReachCompletedAttempts(input: {
  movementTrackingEnabled: boolean;
  baselineReachExtent: number | null;
  internalRepCount: number;
  repPhase: SagittalHipRepPhase;
}): number {
  if (!input.movementTrackingEnabled) return 0;
  if (input.baselineReachExtent === null) return 0;
  if (input.internalRepCount < 1) return 0;
  if (input.repPhase !== "rest") return 0;
  return 1;
}

function mapSide(side: RemoteUpperLimbBatterySide): ShoulderAbductionReachSide {
  return side;
}

function normalizeFrame(landmarks: readonly PoseLandmark[], context: InputAcquisitionContext) {
  return BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context);
}

function buildLandmarkVisibilityDebug(
  landmarks: readonly PoseLandmark[],
  side: RemoteUpperLimbBatterySide,
) {
  return {
    testedSide: side,
    right: readArmVisibility(landmarks, "right"),
    left: readArmVisibility(landmarks, "left"),
  };
}

function armTrackingSnapshot(input: {
  landmarks: readonly PoseLandmark[];
  side: RemoteUpperLimbBatterySide;
  requiredParts: readonly ("shoulder" | "elbow" | "wrist")[];
  metricReady: boolean;
}) {
  const evaluation = evaluateBatteryArmTracking(input);
  return {
    trackingReady: evaluation.ready,
    trackingQuality: evaluation.quality,
    trackingRejectionReason: evaluation.rejectionReason,
    landmarkVisibility: buildLandmarkVisibilityDebug(input.landmarks, input.side),
  };
}

export function createShoulderAbductionProcessor(side: RemoteUpperLimbBatterySide): BatteryTestProcessor {
  let state: ShoulderAbductionReachDetectorState = createShoulderAbductionReachDetectorState();
  let movementTrackingEnabled = false;
  let lastRepCount = 0;
  let lastRepPeak: number | null = null;
  let completedPeaks: number[] = [];

  const resetTrackingState = () => {
    state = createShoulderAbductionReachDetectorState();
    movementTrackingEnabled = false;
    lastRepCount = 0;
    lastRepPeak = null;
    completedPeaks = [];
  };

  return {
    reset: resetTrackingState,
    beginMovementTracking() {
      resetTrackingState();
      movementTrackingEnabled = true;
    },
    isMovementTrackingEnabled: () => movementTrackingEnabled,
    processFrame(landmarks, context) {
      const trackingQuality = visibilityQualityFromValues(
        blazeIndicesForSide(side, ["shoulder", "elbow", "wrist"]).map(
          (index) => landmarks[index]?.visibility ?? 0,
        ),
      );
      const landmarkVisibility = buildLandmarkVisibilityDebug(landmarks, side);

      if (!movementTrackingEnabled) {
        // Readiness only — the angle is read without advancing the rep FSM.
        const frame = normalizeFrame(landmarks, context);
        const angle = frame
          ? computeShoulderAbductionReachSideMetrics(
              frame,
              mapSide(side),
              DEFAULT_SHOULDER_ABDUCTION_REACH_THRESHOLDS.minJointConfidence,
            ).abductionAngleDegrees
          : null;
        const previewReady = angle !== null;
        return {
          trackingReady: previewReady,
          trackingQuality,
          trackingRejectionReason: previewReady ? null : "abduction_angle_unavailable",
          landmarkVisibility,
          repCount: 0,
          lastRepPeak: null,
          completedPeaksDeg: [],
          movementPhase: "idle",
          peakReachExtent: null,
        };
      }

      const result = updateShoulderAbductionReachDetector(state, landmarks, context);
      const primary = side === "right" ? result.right : result.left;
      const trackingReady = primary.abductionAngleDegrees !== null;
      if (primary.repCount > lastRepCount) {
        lastRepPeak = primary.peakAngleDegrees;
        if (primary.peakAngleDegrees !== null) {
          completedPeaks.push(primary.peakAngleDegrees);
        }
        lastRepCount = primary.repCount;
      }
      return {
        trackingReady,
        trackingQuality,
        trackingRejectionReason: trackingReady ? null : "abduction_angle_unavailable",
        landmarkVisibility,
        repCount: primary.repCount,
        lastRepPeak,
        completedPeaksDeg: [...completedPeaks],
        movementPhase: primary.phase,
        peakReachExtent: null,
      };
    },
  };
}

export function createShoulderFlexionProcessor(side: RemoteUpperLimbBatterySide): BatteryTestProcessor {
  let state: ShoulderFlexionPhaseState = createShoulderFlexionPhaseState();
  let movementTrackingEnabled = false;
  let lastRepCount = 0;
  let lastRepPeak: number | null = null;

  const resetTrackingState = () => {
    state = createShoulderFlexionPhaseState();
    movementTrackingEnabled = false;
    lastRepCount = 0;
    lastRepPeak = null;
  };

  return {
    reset: resetTrackingState,
    beginMovementTracking() {
      resetTrackingState();
      movementTrackingEnabled = true;
    },
    isMovementTrackingEnabled: () => movementTrackingEnabled,
    processFrame(landmarks, context) {
      const frame = normalizeFrame(landmarks, context);
      const elevationFromFrame = frame
        ? computeShoulderFlexionElevationDegrees(frame, mapSide(side), DEFAULT_SHOULDER_FLEXION_THRESHOLDS.minJointConfidence)
        : null;
      const elevation =
        elevationFromFrame ??
        computeShoulderFlexionElevationFromPoseLandmarks(
          landmarks,
          mapSide(side),
          DEFAULT_SHOULDER_FLEXION_THRESHOLDS.minJointConfidence,
        );
      if (movementTrackingEnabled) {
        tickShoulderFlexionPhase(state, elevation, DEFAULT_SHOULDER_FLEXION_THRESHOLDS);
        if (state.repCount > lastRepCount) {
          lastRepPeak = state.completedPeaksDeg.at(-1) ?? state.peakElevationDegrees;
          lastRepCount = state.repCount;
        }
      }
      const tracking = armTrackingSnapshot({
        landmarks,
        side,
        requiredParts: ["shoulder", "elbow"],
        metricReady:
          canObserveShoulderFlexionArm(
            landmarks,
            mapSide(side),
            DEFAULT_SHOULDER_FLEXION_THRESHOLDS.minJointConfidence,
          ) || elevation !== null,
      });
      return {
        ...tracking,
        repCount: movementTrackingEnabled ? state.repCount : 0,
        lastRepPeak,
        completedPeaksDeg: movementTrackingEnabled ? [...state.completedPeaksDeg] : [],
        movementPhase: movementTrackingEnabled ? state.phase : "idle",
        peakReachExtent: null,
      };
    },
  };
}

export function createElbowFlexionProcessor(side: RemoteUpperLimbBatterySide): BatteryTestProcessor {
  let state: ElbowFlexionPhaseState = createElbowFlexionPhaseState();
  let movementTrackingEnabled = false;
  let lastRepCount = 0;
  let lastRepPeak: number | null = null;

  const resetTrackingState = () => {
    state = createElbowFlexionPhaseState();
    movementTrackingEnabled = false;
    lastRepCount = 0;
    lastRepPeak = null;
  };

  return {
    reset: resetTrackingState,
    beginMovementTracking() {
      resetTrackingState();
      movementTrackingEnabled = true;
    },
    isMovementTrackingEnabled: () => movementTrackingEnabled,
    processFrame(landmarks, context) {
      const frame = normalizeFrame(landmarks, context);
      const interiorAngle = frame
        ? computeElbowFlexionInteriorAngleDegrees(
            frame,
            mapSide(side),
            DEFAULT_ELBOW_FLEXION_THRESHOLDS.minJointConfidence,
          )
        : null;
      if (movementTrackingEnabled) {
        tickElbowFlexionPhase(state, interiorAngle, DEFAULT_ELBOW_FLEXION_THRESHOLDS);
        if (state.repCount > lastRepCount) {
          lastRepPeak = state.completedPeaksDeg.at(-1) ?? state.peakFlexionAngleDegrees;
          lastRepCount = state.repCount;
        }
      }
      const tracking = armTrackingSnapshot({
        landmarks,
        side,
        requiredParts: ["shoulder", "elbow", "wrist"],
        metricReady: interiorAngle !== null,
      });
      return {
        ...tracking,
        repCount: movementTrackingEnabled ? state.repCount : 0,
        lastRepPeak,
        completedPeaksDeg: movementTrackingEnabled ? [...state.completedPeaksDeg] : [],
        movementPhase: movementTrackingEnabled ? state.phase : "idle",
        peakReachExtent: null,
      };
    },
  };
}

export function createFunctionalReachProcessor(
  side: RemoteUpperLimbBatterySide,
): BatteryFunctionalReachProcessor {
  const counter = new FunctionalReachRepCounter(PATIENT_FUNCTIONAL_REACH_REP_CONFIG);
  let movementTrackingEnabled = false;
  let baselineStarted = false;
  let peakReachExtent: number | null = null;
  let lastCompletedAttempts = 0;

  const resetTrackingState = () => {
    counter.resetBaseline();
    counter.resetReps();
    movementTrackingEnabled = false;
    baselineStarted = false;
    peakReachExtent = null;
    lastCompletedAttempts = 0;
  };

  const beginMovementTracking = () => {
    resetTrackingState();
    movementTrackingEnabled = true;
  };

  return {
    reset: resetTrackingState,
    beginMovementTracking,
    isMovementTrackingEnabled: () => movementTrackingEnabled,
    processFrame(landmarks, context) {
      const nowMs = context.capturedAtMs;
      const testedVisibility = readArmVisibility(landmarks, side);
      const trackingReady =
        testedVisibility.shoulder >= PATIENT_FUNCTIONAL_REACH_REP_CONFIG.minShoulderVisibility &&
        testedVisibility.wrist >= PATIENT_FUNCTIONAL_REACH_REP_CONFIG.minWristVisibility;
      const quality = visibilityQualityFromValues([
        testedVisibility.shoulder,
        testedVisibility.wrist,
      ]);

      // CV-3: an unusable frame must not begin or move the measurement. The
      // baseline window, the rep FSM, and the peak all stay exactly where the
      // last usable frame left them — a dropout is never a clinical zero.
      if (movementTrackingEnabled && trackingReady) {
        if (!baselineStarted) {
          counter.startBaselineWindow(nowMs);
          baselineStarted = true;
        }
        const reachExtent = computeReachExtentForSide(landmarks as PoseLandmark[], side, {
          minVisibility: Math.min(
            PATIENT_FUNCTIONAL_REACH_REP_CONFIG.minShoulderVisibility,
            PATIENT_FUNCTIONAL_REACH_REP_CONFIG.minWristVisibility,
          ),
        });
        const torsoSpan = computeTorsoSpan(landmarks as PoseLandmark[]);
        if (reachExtent !== null) {
          peakReachExtent =
            peakReachExtent === null ? reachExtent : Math.max(peakReachExtent, reachExtent);
          counter.driveFrame(reachExtent, nowMs, torsoSpan);
        }
      }

      const snapshot = counter.getSnapshot();
      const completedAttempts = resolveFunctionalReachCompletedAttempts({
        movementTrackingEnabled,
        baselineReachExtent: snapshot.baselineReachExtent,
        internalRepCount: snapshot.repCount,
        repPhase: snapshot.repPhase,
      });
      const lastRepPeak =
        completedAttempts > lastCompletedAttempts ? peakReachExtent : null;
      if (completedAttempts > lastCompletedAttempts) {
        lastCompletedAttempts = completedAttempts;
      }

      return {
        trackingReady,
        trackingQuality: quality,
        trackingRejectionReason: trackingReady
          ? quality === "poor"
            ? "visibility_poor"
            : null
          : "reach_landmarks_not_visible",
        landmarkVisibility: buildLandmarkVisibilityDebug(landmarks, side),
        repCount: completedAttempts,
        lastRepPeak,
        completedPeaksDeg: peakReachExtent !== null ? [peakReachExtent] : [],
        movementPhase: movementTrackingEnabled ? snapshot.repPhase : "idle",
        peakReachExtent,
      };
    },
  };
}

export function createPreviewPositionProcessor(side: RemoteUpperLimbBatterySide): BatteryTestProcessor {
  return {
    reset() {},
    // Positioning preview only — it never measures, so arming is a no-op.
    beginMovementTracking() {},
    isMovementTrackingEnabled: () => false,
    processFrame(landmarks) {
      const tracking = armTrackingSnapshot({
        landmarks,
        side,
        requiredParts: ["shoulder", "elbow"],
        metricReady: landmarks.length > 0,
      });
      return {
        ...tracking,
        repCount: 0,
        lastRepPeak: null,
        completedPeaksDeg: [],
        movementPhase: "preview",
        peakReachExtent: null,
      };
    },
  };
}

export function createBatteryTestProcessor(
  testId: "shoulderAbduction" | "shoulderFlexion" | "elbowFlexion" | "functionalReach",
  side: RemoteUpperLimbBatterySide,
): BatteryTestProcessor {
  switch (testId) {
    case "shoulderAbduction":
      return createShoulderAbductionProcessor(side);
    case "shoulderFlexion":
      return createShoulderFlexionProcessor(side);
    case "elbowFlexion":
      return createElbowFlexionProcessor(side);
    case "functionalReach":
      return createFunctionalReachProcessor(side);
  }
}
