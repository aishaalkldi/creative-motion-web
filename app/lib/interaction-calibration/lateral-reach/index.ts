/**
 * Public exports for Lateral Reach interaction-calibration domain.
 * Slice 1: vocabulary / outcome contracts.
 * Slice 2: stable start capture reducer.
 * Slice 3: held-endpoint capture reducer.
 */

export {
  LATERAL_REACH_CALIBRATION_SCHEMA_VERSION,
  LATERAL_REACH_CAPTURE_FAILURE_REASONS,
  LATERAL_REACH_GEOMETRY_BLOCKERS,
  LATERAL_REACH_NOISE_FLOOR_KIND,
  type LateralReachCalibrationCaptureFailedResult,
  type LateralReachCalibrationGeometryNotConstructibleResult,
  type LateralReachCalibrationGeometryReadyResult,
  type LateralReachCalibrationObservations,
  type LateralReachCalibrationResult,
  type LateralReachCalibrationSchemaVersion,
  type LateralReachCaptureFailureReason,
  type LateralReachDerivedMeasurements,
  type LateralReachGeometryBlocker,
  type LateralReachNoiseFloorConfig,
  type NormalizedPoint,
  type UpperLimbSide,
} from "./types";

export {
  createLateralReachStartCaptureState,
  updateLateralReachStartCapture,
  validateLateralReachStartCaptureConfig,
  type LateralReachStartCaptureConfig,
  type LateralReachStartCaptureSample,
  type LateralReachStartCaptureState,
  type LateralReachStartCaptureUpdateResult,
} from "./start-capture";

export {
  createLateralReachEndpointCaptureState,
  updateLateralReachEndpointCapture,
  validateLateralReachEndpointCaptureConfig,
  type LateralReachEndpointCaptureConfig,
  type LateralReachEndpointCaptureSample,
  type LateralReachEndpointCaptureState,
  type LateralReachEndpointCaptureUpdateResult,
} from "./endpoint-capture";
