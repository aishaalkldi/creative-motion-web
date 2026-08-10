/**
 * Lateral Reach interaction-calibration — Slice 6: calibration result assembly.
 *
 * Assembles LateralReachCalibrationResult from stage outcomes of Slices 2–5.
 * Interaction calibration only — not clinical ROM, maximal/comfortable/safe
 * reach, strength, impairment, ability, diagnosis, prognosis, or outcome.
 *
 * Does NOT:
 * - build full engine attempt configuration
 * - call engine config validation
 * - emit engine-config blockers
 * - derive expected direction from testedSide or observations
 * - import MediaPipe, camera, React, or the Lateral Reach engine
 */

import type { NormalizedPoint } from "@/app/lib/interactive-shoulder/types";
import {
  isValidUpperLimbSide,
  type UpperLimbSide,
} from "@/app/lib/upper-limb-motor-screen/types";
import { deriveLateralReachMeasurements } from "./derived-measurements";
import { constructLateralReachFrozenGeometry } from "./frozen-geometry";
import {
  LATERAL_REACH_CALIBRATION_SCHEMA_VERSION,
  type LateralReachCalibrationResult,
  type LateralReachCaptureFailureReason,
  type LateralReachNoiseFloorConfig,
} from "./types";

export type LateralReachResultAssemblyInput =
  | {
      testedSide: UpperLimbSide;
      stage: "start_failed";
      failureReasons: LateralReachCaptureFailureReason[];
    }
  | {
      testedSide: UpperLimbSide;
      stage: "endpoint_failed";
      startWrist: NormalizedPoint;
      failureReasons: LateralReachCaptureFailureReason[];
    }
  | {
      testedSide: UpperLimbSide;
      stage: "captured";
      startWrist: NormalizedPoint;
      heldEndpoint: NormalizedPoint;
      expectedHorizontalDirectionSign: 1 | -1;
      noiseFloor: LateralReachNoiseFloorConfig;
      zoneRadii: {
        startingZoneRadius: number;
        fixedTargetRadius: number;
      };
    };

function clonePoint(point: NormalizedPoint): NormalizedPoint {
  return { x: point.x, y: point.y };
}

function assertTestedSide(testedSide: unknown): asserts testedSide is UpperLimbSide {
  if (!isValidUpperLimbSide(testedSide)) {
    throw new RangeError('testedSide must be exactly "left" or "right"');
  }
}

/**
 * Assemble a LateralReachCalibrationResult from stage-level calibration inputs.
 *
 * Captured path call order is locked: constructLateralReachFrozenGeometry first
 * (preserves Slice 5 validation precedence), then deriveLateralReachMeasurements
 * only when geometry is not_constructible or ready.
 */
export function assembleLateralReachCalibrationResult(
  input: LateralReachResultAssemblyInput,
): LateralReachCalibrationResult {
  assertTestedSide(input.testedSide);

  const schemaVersion = LATERAL_REACH_CALIBRATION_SCHEMA_VERSION;

  if (input.stage === "start_failed") {
    return {
      schemaVersion,
      testedSide: input.testedSide,
      captureOutcome: "failed",
      geometryOutcome: "not_applicable",
      failureReasons: [...input.failureReasons],
    };
  }

  if (input.stage === "endpoint_failed") {
    return {
      schemaVersion,
      testedSide: input.testedSide,
      captureOutcome: "failed",
      geometryOutcome: "not_applicable",
      failureReasons: [...input.failureReasons],
      observations: {
        startWrist: clonePoint(input.startWrist),
      },
    };
  }

  // stage === "captured" — Slice 5 first (locked precedence).
  const geometryResult = constructLateralReachFrozenGeometry(
    input.startWrist,
    input.heldEndpoint,
    input.expectedHorizontalDirectionSign,
    input.noiseFloor,
    input.zoneRadii,
  );

  if (!geometryResult.ok && geometryResult.kind === "calibration_invalid") {
    return {
      schemaVersion,
      testedSide: input.testedSide,
      captureOutcome: "failed",
      geometryOutcome: "not_applicable",
      failureReasons: [geometryResult.reason],
      observations: {
        startWrist: clonePoint(input.startWrist),
        heldEndpoint: clonePoint(input.heldEndpoint),
      },
    };
  }

  const derivedMeasurements = deriveLateralReachMeasurements(
    input.startWrist,
    input.heldEndpoint,
    input.expectedHorizontalDirectionSign,
  );

  const observations = {
    startWrist: clonePoint(input.startWrist),
    heldEndpoint: clonePoint(input.heldEndpoint),
  };

  if (!geometryResult.ok && geometryResult.kind === "geometry_not_constructible") {
    return {
      schemaVersion,
      testedSide: input.testedSide,
      captureOutcome: "valid",
      geometryOutcome: "not_constructible",
      observations,
      derivedMeasurements,
      geometryBlockers: geometryResult.geometryBlockers,
    };
  }

  if (!geometryResult.ok) {
    // Exhaustiveness guard — unreachable under locked Slice 5 result kinds.
    throw new Error("unexpected frozen-geometry failure kind");
  }

  const frozenGeometry = Object.freeze({
    startingZone: geometryResult.startingZone,
    fixedTarget: geometryResult.fixedTarget,
  });

  return {
    schemaVersion,
    testedSide: input.testedSide,
    captureOutcome: "valid",
    geometryOutcome: "ready",
    observations,
    derivedMeasurements,
    frozenGeometry,
  };
}
