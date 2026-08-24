/**
 * Volunteer Shoulder Abduction Reach — Slice 8A in-memory capture sink.
 *
 * Wires detector frame callbacks to the existing rep-recorder and capture schema.
 * In-memory only — no API calls, no persistence.
 */

import type { NormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import type { ShoulderAbductionReachFrameResult, ShoulderAbductionReachSide } from "@/app/lib/shoulder-rehabilitation";
import {
  ML_RESEARCH_CAPTURED_JOINT_IDS,
  ML_RESEARCH_CAPTURE_SCHEMA_VERSION,
  ML_RESEARCH_FEATURE_SCHEMA_VERSION,
  type MlResearchCapturedJoints,
  type ShoulderAbductionReachRepCaptureRecord,
} from "@/app/lib/ml-research/shoulder-abduction-reach/capture-schema";
import {
  createShoulderAbductionReachRepRecorderState,
  tickShoulderAbductionReachRepRecorder,
  type ShoulderAbductionReachRejectedCapture,
} from "@/app/lib/ml-research/shoulder-abduction-reach/rep-recorder";

/** Picks the eight bilateral joints recorded for this exercise from a full motion frame. */
function pickCapturedJoints(frame: NormalizedMotionFrame): MlResearchCapturedJoints {
  const picked: MlResearchCapturedJoints = {};
  for (const jointId of ML_RESEARCH_CAPTURED_JOINT_IDS) {
    const joint = frame.joints[jointId];
    if (joint) {
      picked[jointId] = joint;
    }
  }
  return picked;
}

export type VolunteerCaptureFrameInput = {
  frame: NormalizedMotionFrame;
  capturedAtMs: number;
  phase: ShoulderAbductionReachFrameResult["left"]["phase"];
  repCount: number;
};

export type VolunteerInMemoryCaptureSinkOptions = {
  participantId: string;
  sessionId: string;
  side: ShoulderAbductionReachSide;
  /** Protocol metadata only — never therapist ground truth. */
  protocolCondition?: string;
  onRepCaptured: (record: ShoulderAbductionReachRepCaptureRecord) => void;
  onRepRejected?: (rejected: ShoulderAbductionReachRejectedCapture) => void;
};

export type VolunteerInMemoryCaptureSink = {
  handleFrame: (input: VolunteerCaptureFrameInput) => void;
};

export function createVolunteerInMemoryCaptureSink(
  options: VolunteerInMemoryCaptureSinkOptions,
): VolunteerInMemoryCaptureSink {
  const state = createShoulderAbductionReachRepRecorderState();

  return {
    handleFrame(input: VolunteerCaptureFrameInput) {
      const { completedRep, rejectedCapture } = tickShoulderAbductionReachRepRecorder(
        state,
        {
          joints: pickCapturedJoints(input.frame),
          phase: input.phase,
          repCount: input.repCount,
          capturedAtMs: input.capturedAtMs,
        },
        {
          captureSchemaVersion: ML_RESEARCH_CAPTURE_SCHEMA_VERSION,
          featureSchemaVersion: ML_RESEARCH_FEATURE_SCHEMA_VERSION,
          participantId: options.participantId,
          devSessionId: options.sessionId,
          side: options.side,
          movementType: "shoulder_abduction_reach",
          ...(options.protocolCondition !== undefined
            ? { simulationCondition: options.protocolCondition }
            : {}),
        },
      );
      if (completedRep) {
        options.onRepCaptured(completedRep);
      }
      if (rejectedCapture) {
        options.onRepRejected?.(rejectedCapture);
      }
    },
  };
}
