/**
 * RASQ Lateral Reach — patient interaction-calibration domain contracts (Slice 1).
 *
 * Foundational vocabulary only: closed `as const` enumerations, observation vs
 * derived-measurement boundaries, and outcome discriminants that make illegal
 * capture/geometry combinations unrepresentable at the TypeScript type level.
 *
 * This module does NOT:
 * - provide runtime JSON/object validators for speculative parsing
 * - capture start/endpoint samples
 * - build startingZone / fixedTarget
 * - call or alter lateral-reach-engine
 * - access camera / MediaPipe / React UI
 * - invent clinical ROM, impairment, or ability labels
 *
 * Coordinates remain raw camera-space normalized points (same convention as
 * NormalizedMotionFrame). No mirroring transforms here.
 */

import type { NormalizedPoint } from "@/app/lib/interactive-shoulder/types";
import type { UpperLimbSide } from "@/app/lib/upper-limb-motor-screen/types";

export type { NormalizedPoint, UpperLimbSide };

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const LATERAL_REACH_CALIBRATION_SCHEMA_VERSION = "lateral-reach-calibration/v1" as const;
export type LateralReachCalibrationSchemaVersion =
  typeof LATERAL_REACH_CALIBRATION_SCHEMA_VERSION;

// ---------------------------------------------------------------------------
// Capture failure reasons (technical observation invalidity only)
// ---------------------------------------------------------------------------

export const LATERAL_REACH_CAPTURE_FAILURE_REASONS = [
  "framing_not_acceptable",
  "wrist_tracking_invalid",
  "start_unstable",
  "start_timeout",
  "insufficient_start_samples",
  "wrong_direction_reach",
  "endpoint_hold_not_confirmed",
  "direction_aligned_magnitude_not_positive",
  "displacement_indistinguishable_from_noise",
  "calibration_timeout",
] as const;

export type LateralReachCaptureFailureReason =
  (typeof LATERAL_REACH_CAPTURE_FAILURE_REASONS)[number];

// ---------------------------------------------------------------------------
// Geometry blockers (valid capture, current constraints cannot build config)
// ---------------------------------------------------------------------------

export const LATERAL_REACH_GEOMETRY_BLOCKERS = [
  "insufficient_separation_for_current_geometry",
  "target_outside_camera_margin",
  "interaction_fraction_reduction_exhausted",
  "engine_config_invalid",
] as const;

export type LateralReachGeometryBlocker = (typeof LATERAL_REACH_GEOMETRY_BLOCKERS)[number];

// ---------------------------------------------------------------------------
// Interaction geometry labels (provisional; not clinical ability / ROM %)
// ---------------------------------------------------------------------------

export const LATERAL_REACH_INTERACTION_GEOMETRY_LABELS = ["short", "standard", "long"] as const;
export type LateralReachInteractionGeometryLabel =
  (typeof LATERAL_REACH_INTERACTION_GEOMETRY_LABELS)[number];

// ---------------------------------------------------------------------------
// Noise floor config (device-QA parameter shape; no validated numeric default)
// ---------------------------------------------------------------------------

export const LATERAL_REACH_NOISE_FLOOR_KIND = "direction_aligned_magnitude_noise_floor" as const;

/**
 * Device-QA configuration shape for distinguishing pose jitter from a
 * trustworthy observed interaction displacement. Numeric thresholds are NOT
 * clinically validated in Slice 1 and are not hardcoded as production defaults.
 */
export type LateralReachNoiseFloorConfig = {
  kind: typeof LATERAL_REACH_NOISE_FLOOR_KIND;
  minDirectionAlignedMagnitude: number;
};

// ---------------------------------------------------------------------------
// Technical geometry provenance (single canonical representation)
// ---------------------------------------------------------------------------

export const LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS = [
  "interaction_fraction_reduced_for_camera_margin",
] as const;

export type LateralReachTechnicalGeometryAdjustmentKind =
  (typeof LATERAL_REACH_TECHNICAL_GEOMETRY_ADJUSTMENT_KINDS)[number];

/**
 * Factual technical provenance when an interaction-fraction value is reduced
 * under camera-margin constraints during geometry construction attempts.
 * Not clinical adjustment, ROM interpretation, exercise prescription, or
 * patient-ability classification.
 */
export type LateralReachTechnicalGeometryAdjustment = {
  kind: "interaction_fraction_reduced_for_camera_margin";
  from: number;
  to: number;
};

// ---------------------------------------------------------------------------
// Observations vs derived measurements
// ---------------------------------------------------------------------------

/** Factual captured points only. No interactionFraction, zones, or geometry labels. */
export type LateralReachCalibrationObservations = {
  startWrist: NormalizedPoint;
  comfortableEndpoint: NormalizedPoint;
};

/**
 * Derived measurement math from observations + expected horizontal direction.
 * Not clinical ROM. Field names intentionally avoid ambiguous "signed displacement".
 *
 * rawDeltaX = endpoint.x - start.x
 * directionAlignedMagnitude = expectedHorizontalDirectionSign * rawDeltaX
 * (valid capture paths require directionAlignedMagnitude > 0)
 */
export type LateralReachDerivedMeasurements = {
  rawDeltaX: number;
  expectedHorizontalDirectionSign: 1 | -1;
  directionAlignedMagnitude: number;
};

// ---------------------------------------------------------------------------
// Outcome discriminants — illegal combinations are unrepresentable
//
// Allowed only:
//   A) capture failed  + geometry not_applicable
//   B) capture valid   + geometry not_constructible
//   C) capture valid   + geometry ready
//
// No stored top-level convenience "status". No "degraded" calibration state.
// startingZone / fixedTarget / LateralReachConfig arrive in Slice 4 — not here.
// ---------------------------------------------------------------------------

type LateralReachCalibrationResultBase = {
  schemaVersion: LateralReachCalibrationSchemaVersion;
  testedSide: UpperLimbSide;
};

export type LateralReachCalibrationCaptureFailedResult = LateralReachCalibrationResultBase & {
  captureOutcome: "failed";
  geometryOutcome: "not_applicable";
  failureReasons: LateralReachCaptureFailureReason[];
  /** Optional factual scraps only; never invented geometry. */
  observations?: Partial<LateralReachCalibrationObservations>;
};

/**
 * Capture succeeded, but current interaction-geometry constraints could not
 * produce a validated engine config. Fraction fields describe the construction
 * attempt only — not a value used by an engine attempt.
 */
export type LateralReachCalibrationGeometryNotConstructibleResult =
  LateralReachCalibrationResultBase & {
    captureOutcome: "valid";
    geometryOutcome: "not_constructible";
    observations: LateralReachCalibrationObservations;
    derivedMeasurements: LateralReachDerivedMeasurements;
    geometryBlockers: LateralReachGeometryBlocker[];
    requestedInteractionFraction: number;
    attemptedInteractionFraction: number;
    technicalAdjustments: LateralReachTechnicalGeometryAdjustment[];
    interactionGeometryLabel?: LateralReachInteractionGeometryLabel;
  };

/**
 * Capture succeeded and interaction geometry is ready for a frozen engine config
 * in a later slice. effectiveInteractionFraction is the fraction associated with
 * that successfully constructed geometry.
 */
export type LateralReachCalibrationGeometryReadyResult = LateralReachCalibrationResultBase & {
  captureOutcome: "valid";
  geometryOutcome: "ready";
  observations: LateralReachCalibrationObservations;
  derivedMeasurements: LateralReachDerivedMeasurements;
  requestedInteractionFraction: number;
  effectiveInteractionFraction: number;
  technicalAdjustments: LateralReachTechnicalGeometryAdjustment[];
  interactionGeometryLabel?: LateralReachInteractionGeometryLabel;
};

export type LateralReachCalibrationResult =
  | LateralReachCalibrationCaptureFailedResult
  | LateralReachCalibrationGeometryNotConstructibleResult
  | LateralReachCalibrationGeometryReadyResult;
