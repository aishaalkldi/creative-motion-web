/**
 * RASQ Input Acquisition Layer — generic contract (v0).
 *
 * Defines how raw sensor/device data is normalized into Motion Intelligence Core
 * types (or a future physiological/kinetic sample type). Motion Intelligence Core
 * (`app/lib/motion-intelligence`) has no knowledge that this layer exists — it only
 * ever sees a `NormalizedMotionFrame`, never a capture-technology-specific type.
 *
 * Speech AI is intentionally excluded from this layer. It remains part of the
 * existing communication and clinical documentation pipeline (ElevenLabs,
 * browser speech-to-text, voice clinical assistant) and does not feed Motion
 * Intelligence Core or a future Sensor Fusion Engine the way movement and
 * physiological sensors do.
 *
 * Digital Twin classification is deferred until its concrete role (synthetic
 * input source vs. rendered consumer of fused data) is defined.
 */

import type { MotionCaptureSourceKind, NormalizedMotionFrame } from "@/app/lib/motion-intelligence";

/**
 * Acquisition families group adapters by the shape of data they normalize into.
 *
 * - "motion" — spatial joint-position data (`NormalizedMotionFrame`). Implemented.
 * - "physiological" — biosignal/vitals streams. Reserved; no sample type yet.
 * - "kinetic" — ground-reaction-force / center-of-pressure data (e.g. Force Plate).
 *   Reserved name only; no source kinds, sample type, or adapter contract exist yet.
 */
export type InputAcquisitionFamily = "motion" | "physiological" | "kinetic";

/**
 * Source kinds belonging to the motion family (normalize into `NormalizedMotionFrame`).
 * Includes Motion Intelligence Core's existing `MotionCaptureSourceKind` values plus
 * acquisition-layer-only reserved kinds (IMU, Reference Sensor, XR) that the core has
 * no reason to know about.
 */
export const MOTION_ACQUISITION_SOURCE_KINDS = [
  "web_camera_pose",
  "depth_camera",
  "phone_camera",
  "imu_sensor",
  "reference_sensor",
  "xr_input",
] as const;

export type MotionAcquisitionSourceKind = (typeof MOTION_ACQUISITION_SOURCE_KINDS)[number];

/** Compile-time check: every core MotionCaptureSourceKind must be representable here. */
type _AssertCoreKindsCovered = MotionCaptureSourceKind extends MotionAcquisitionSourceKind
  ? true
  : never;
const _assertCoreKindsCovered: _AssertCoreKindsCovered = true;
void _assertCoreKindsCovered;

/** Source kinds belonging to the physiological family (biosignal/vitals streams). */
export const PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS = [
  "rasq_watch",
  "emg_sensor",
  "eeg_sensor",
] as const;

export type PhysiologicalAcquisitionSourceKind = (typeof PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS)[number];

export type InputAcquisitionSourceKind =
  | MotionAcquisitionSourceKind
  | PhysiologicalAcquisitionSourceKind;

/** Generic per-sample capture context, independent of any acquisition technology. */
export type InputAcquisitionContext = {
  /** Zero-based sample/frame sequence index within a capture session. */
  frameIndex: number;
  /** Monotonic capture timestamp in milliseconds. */
  capturedAtMs: number;
  /** Optional non-PHI device label for debugging. */
  deviceLabel?: string;
};

/**
 * Adapter contract for sources that normalize into a spatial joint-position frame
 * (Motion Intelligence Core's `NormalizedMotionFrame`). Camera (BlazePose — built
 * this sprint), IMU, Reference Sensor, and XR belong to this family. Only the
 * BlazePose adapter is implemented; the others are reserved source kinds with no
 * adapter yet.
 */
export type MotionAcquisitionAdapter<TRawSample> = {
  readonly family: "motion";
  readonly sourceKind: MotionAcquisitionSourceKind;
  normalize(raw: TRawSample, context: InputAcquisitionContext): NormalizedMotionFrame | null;
};

/**
 * Reserved placeholder for the physiological sample shape (RASQ Watch ECG/vitals,
 * EMG, EEG). The normalized shape is not yet designed — this type exists only to
 * reserve the family boundary for a future sprint. `never` means no adapter can
 * actually be implemented against this type yet, by construction.
 */
export type NormalizedPhysiologicalSample = never;

/**
 * Adapter contract for physiological/biosignal sources. Reserved — no adapter
 * implements this yet, and `NormalizedPhysiologicalSample` is not yet defined.
 */
export type PhysiologicalAcquisitionAdapter<TRawSample> = {
  readonly family: "physiological";
  readonly sourceKind: PhysiologicalAcquisitionSourceKind;
  normalize(raw: TRawSample, context: InputAcquisitionContext): NormalizedPhysiologicalSample | null;
};

/**
 * Reserved name for the kinetic family's future adapter contract (e.g. Force
 * Plate: ground-reaction-force, center-of-pressure). No source kinds, sample
 * type, or usable shape are defined yet — `never` reserves the name only, per
 * architecture decision, without implying a design that hasn't been made.
 */
export type KineticAcquisitionAdapter = never;

export function isMotionAcquisitionSourceKind(value: unknown): value is MotionAcquisitionSourceKind {
  return (
    typeof value === "string" &&
    (MOTION_ACQUISITION_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function isPhysiologicalAcquisitionSourceKind(
  value: unknown,
): value is PhysiologicalAcquisitionSourceKind {
  return (
    typeof value === "string" &&
    (PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS as readonly string[]).includes(value)
  );
}
