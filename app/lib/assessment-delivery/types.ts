import type { AssessmentMode } from "@/app/lib/domain-types";

/**
 * Motion input sources supported by RASQ v0.
 * Registry and adapter implementations are defined in a separate task.
 */
export type MotionInputAdapterId =
  | "web_camera_pose"
  | "remote_questionnaire"
  | "manual_clinician";

export const MOTION_INPUT_ADAPTER_IDS = [
  "web_camera_pose",
  "remote_questionnaire",
  "manual_clinician",
] as const satisfies readonly MotionInputAdapterId[];

/**
 * Assessment payload categories that share one delivery spine.
 * Distinct from DB `type` strings; used for delivery-context routing only.
 */
export type AssessmentDeliveryKind =
  | "general_msk"
  | "remote_questionnaire"
  | "structured"
  | "cv_motion_capture";

export type MotionInputFlowRef = {
  label: string;
  modulePath: string;
  routeOrApi?: string;
};

/**
 * Metadata descriptor for a motion-input source.
 * Maps to existing flows only — no capture, assessment, or reporting logic here.
 */
export type MotionInputAdapterDescriptor = {
  id: MotionInputAdapterId;
  label: string;
  description: string;
  supportedModes: readonly AssessmentMode[];
  assessmentKinds: readonly AssessmentDeliveryKind[];
  existingFlowRefs: readonly MotionInputFlowRef[];
  metadata?: Record<string, unknown>;
};

/**
 * Shared context for clinic and remote assessment delivery.
 *
 * `patientId` remains `string` so both Supabase UUID patients and numeric demo
 * patients continue to route through existing `isUuidPatientId()` boundaries.
 */
export type AssessmentDeliveryContext = {
  patientId: string;
  assessmentId: string;
  mode: AssessmentMode;
  assessmentKind?: AssessmentDeliveryKind;
  motionInputSource?: MotionInputAdapterId;
};

/** Optional provenance key for assessments.structured_data (no DB migration). */
export const MOTION_INPUT_SOURCE_METADATA_KEY = "motionInputSource" as const;

export function isMotionInputAdapterId(value: unknown): value is MotionInputAdapterId {
  return (
    value === "web_camera_pose" ||
    value === "remote_questionnaire" ||
    value === "manual_clinician"
  );
}
