/**
 * Public exports for Lateral Reach interaction-calibration domain (Slice 1).
 * Capture/geometry runtime and engine bridging are intentionally not exported yet.
 */

export {
  LATERAL_REACH_CALIBRATION_SCHEMA_VERSION,
  LATERAL_REACH_CAPTURE_FAILURE_REASONS,
  LATERAL_REACH_GEOMETRY_BLOCKERS,
  LATERAL_REACH_INTERACTION_GEOMETRY_LABELS,
  LATERAL_REACH_NOISE_FLOOR_KIND,
  LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS,
  type LateralReachCalibrationCaptureFailedResult,
  type LateralReachCalibrationGeometryNotConstructibleResult,
  type LateralReachCalibrationGeometryReadyResult,
  type LateralReachCalibrationObservations,
  type LateralReachCalibrationResult,
  type LateralReachCalibrationSchemaVersion,
  type LateralReachCaptureFailureReason,
  type LateralReachDerivedMeasurements,
  type LateralReachGeometryBlocker,
  type LateralReachInteractionGeometryLabel,
  type LateralReachNoiseFloorConfig,
  type LateralReachTechnicalGeometryAdjustment,
  type LateralReachTechnicalGeometryAdjustmentKind,
  type NormalizedPoint,
  type UpperLimbSide,
} from "./types";
