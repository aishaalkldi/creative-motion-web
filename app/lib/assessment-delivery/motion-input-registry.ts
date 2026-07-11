import type { AssessmentMode } from "@/app/lib/domain-types";
import { MANUAL_CLINICIAN_ADAPTER } from "./adapters/manual-clinician-adapter";
import { REMOTE_QUESTIONNAIRE_ADAPTER } from "./adapters/remote-questionnaire-adapter";
import { WEB_CAMERA_POSE_ADAPTER } from "./adapters/web-camera-pose-adapter";
import {
  MOTION_INPUT_SOURCE_METADATA_KEY,
  type MotionInputAdapterDescriptor,
  type MotionInputAdapterId,
} from "./types";

const MOTION_INPUT_ADAPTERS: Record<MotionInputAdapterId, MotionInputAdapterDescriptor> = {
  web_camera_pose: WEB_CAMERA_POSE_ADAPTER,
  remote_questionnaire: REMOTE_QUESTIONNAIRE_ADAPTER,
  manual_clinician: MANUAL_CLINICIAN_ADAPTER,
};

export function listMotionInputAdapters(): readonly MotionInputAdapterDescriptor[] {
  return Object.values(MOTION_INPUT_ADAPTERS);
}

export function getMotionInputAdapter(
  adapterId: MotionInputAdapterId,
): MotionInputAdapterDescriptor {
  return MOTION_INPUT_ADAPTERS[adapterId];
}

export function getMotionInputAdapterOrNull(
  adapterId: string,
): MotionInputAdapterDescriptor | null {
  if (!isKnownMotionInputAdapterId(adapterId)) {
    return null;
  }
  return MOTION_INPUT_ADAPTERS[adapterId];
}

export function isKnownMotionInputAdapterId(
  adapterId: string,
): adapterId is MotionInputAdapterId {
  return adapterId in MOTION_INPUT_ADAPTERS;
}

export function isMotionInputCompatibleWithMode(
  adapterId: MotionInputAdapterId,
  mode: AssessmentMode,
): boolean {
  const adapter = getMotionInputAdapter(adapterId);
  return adapter.supportedModes.includes(mode);
}

export function validateMotionInputModeCompatibility(
  adapterId: MotionInputAdapterId,
  mode: AssessmentMode,
): { ok: true } | { ok: false; reason: string } {
  if (isMotionInputCompatibleWithMode(adapterId, mode)) {
    return { ok: true };
  }

  const adapter = getMotionInputAdapter(adapterId);
  return {
    ok: false,
    reason: `Motion input "${adapterId}" supports modes [${adapter.supportedModes.join(", ")}] but received "${mode}".`,
  };
}

export function extractMotionInputSourceFromStructuredData(
  structuredData: unknown,
): MotionInputAdapterId | null {
  if (typeof structuredData !== "object" || structuredData === null) {
    return null;
  }

  const source = (structuredData as Record<string, unknown>)[MOTION_INPUT_SOURCE_METADATA_KEY];
  if (typeof source !== "string" || !isKnownMotionInputAdapterId(source)) {
    return null;
  }

  return source;
}

export {
  MOTION_INPUT_SOURCE_METADATA_KEY,
  type AssessmentDeliveryContext,
  type AssessmentDeliveryKind,
  type MotionInputAdapterDescriptor,
  type MotionInputAdapterId,
  MOTION_INPUT_ADAPTER_IDS,
  isMotionInputAdapterId,
} from "./types";

export { WEB_CAMERA_POSE_ADAPTER } from "./adapters/web-camera-pose-adapter";
export { REMOTE_QUESTIONNAIRE_ADAPTER } from "./adapters/remote-questionnaire-adapter";
export { MANUAL_CLINICIAN_ADAPTER } from "./adapters/manual-clinician-adapter";
