import {
  isJointId,
  isMotionCaptureSourceKind,
  JOINT_IDS,
  MOTION_INTELLIGENCE_SCHEMA_VERSION,
  type JointConfidence,
  type JointId,
  type NormalizedMotionFrame,
} from "./types";

export type FrameValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

function isNormalizedCoord(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isJointConfident(
  confidence: JointConfidence,
  minVisibility = 0,
): boolean {
  return (
    confidence.present &&
    Number.isFinite(confidence.visibility) &&
    confidence.visibility >= minVisibility &&
    confidence.visibility <= 1
  );
}

export function validateNormalizedMotionFrame(
  frame: unknown,
): FrameValidationResult {
  const errors: string[] = [];

  if (typeof frame !== "object" || frame === null) {
    return { valid: false, errors: ["Frame must be an object."] };
  }

  const candidate = frame as Partial<NormalizedMotionFrame>;

  if (candidate.schemaVersion !== MOTION_INTELLIGENCE_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be "${MOTION_INTELLIGENCE_SCHEMA_VERSION}".`,
    );
  }

  if (typeof candidate.source !== "object" || candidate.source === null) {
    errors.push("source metadata is required.");
  } else {
    const { kind, capturedAtMs, frameIndex, coordinateSpace } = candidate.source;

    if (!isMotionCaptureSourceKind(kind)) {
      errors.push("source.kind must be a supported MotionCaptureSourceKind.");
    }

    if (!Number.isFinite(capturedAtMs) || capturedAtMs < 0) {
      errors.push("source.capturedAtMs must be a finite number >= 0.");
    }

    if (!Number.isInteger(frameIndex) || frameIndex < 0) {
      errors.push("source.frameIndex must be an integer >= 0.");
    }

    if (coordinateSpace !== "normalized_2d" && coordinateSpace !== "normalized_3d") {
      errors.push("source.coordinateSpace must be normalized_2d or normalized_3d.");
    }
  }

  if (
    typeof candidate.joints !== "object" ||
    candidate.joints === null ||
    Array.isArray(candidate.joints)
  ) {
    errors.push("joints must be an object map.");
  } else {
    const jointEntries = Object.entries(candidate.joints);

    if (jointEntries.length === 0) {
      errors.push("joints must contain at least one joint.");
    }

    for (const [jointId, joint] of jointEntries) {
      if (!isJointId(jointId)) {
        errors.push(`Unknown joint id "${jointId}".`);
        continue;
      }

      validateJointEntry(jointId, joint, errors);
    }

    const unknownIds = jointEntries
      .map(([jointId]) => jointId)
      .filter((jointId) => !isJointId(jointId));
    if (unknownIds.length > 0) {
      const allowed = JOINT_IDS.join(", ");
      errors.push(`Allowed joint ids: ${allowed}.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

function validateJointEntry(
  jointId: JointId,
  joint: unknown,
  errors: string[],
): void {
  if (typeof joint !== "object" || joint === null) {
    errors.push(`Joint "${jointId}" must be an object.`);
    return;
  }

  const { landmark, confidence } = joint as {
    landmark?: { x?: unknown; y?: unknown; z?: unknown };
    confidence?: { visibility?: unknown; present?: unknown };
  };

  if (typeof landmark !== "object" || landmark === null) {
    errors.push(`Joint "${jointId}" landmark is required.`);
  } else {
    if (!isNormalizedCoord(landmark.x)) {
      errors.push(`Joint "${jointId}" landmark.x must be in [0, 1].`);
    }
    if (!isNormalizedCoord(landmark.y)) {
      errors.push(`Joint "${jointId}" landmark.y must be in [0, 1].`);
    }
    if (
      landmark.z !== undefined &&
      (typeof landmark.z !== "number" || !Number.isFinite(landmark.z))
    ) {
      errors.push(`Joint "${jointId}" landmark.z must be finite when provided.`);
    }
  }

  if (typeof confidence !== "object" || confidence === null) {
    errors.push(`Joint "${jointId}" confidence is required.`);
  } else {
    if (
      typeof confidence.visibility !== "number" ||
      !Number.isFinite(confidence.visibility) ||
      confidence.visibility < 0 ||
      confidence.visibility > 1
    ) {
      errors.push(`Joint "${jointId}" confidence.visibility must be in [0, 1].`);
    }
    if (typeof confidence.present !== "boolean") {
      errors.push(`Joint "${jointId}" confidence.present must be a boolean.`);
    }
  }
}
