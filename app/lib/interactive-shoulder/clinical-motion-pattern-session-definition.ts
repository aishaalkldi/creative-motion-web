import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "./motion-patterns/d1-inspired-diagonal-reach-pattern";
import { REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE } from "./motion-patterns/motion-pattern-registry";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "./shoulder-abduction-reach-session-definition";

/** Clinical Motion Pattern Engine — diagonal reach pattern session (feature-flag gated). */
export const CLINICAL_MOTION_PATTERN_SESSION: SessionDefinition = {
  sessionId: "clinical-motion-pattern-v1",
  title: "Clinical motion pattern session",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "d1-inspired-diagonal-reach-main",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "D1-Inspired Diagonal Reach",
      instructions:
        "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
      completionMode: "duration",
      targetDurationSeconds: 90,
      restAfterSeconds: 0,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      blockType: "movement-pattern",
      feedbackProfile: D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE,
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 120,
      },
    },
  ],
};

/** Production-safe default — Reach the Light target session. */
export const REACH_THE_LIGHT_SESSION = SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION;

/** Sequential session exercising pattern then legacy target mode for compatibility tests. */
export const CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION: SessionDefinition = {
  sessionId: "clinical-motion-pattern-sequence-v1",
  title: "Clinical motion pattern sequence session",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "d1-inspired-diagonal-reach-sequence",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "D1-Inspired Diagonal Reach",
      instructions: "Follow the therapeutic path along the diagonal reach.",
      completionMode: "duration",
      targetDurationSeconds: 60,
      restAfterSeconds: 5,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      blockType: "movement-pattern",
      feedbackProfile: D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE,
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 90,
      },
    },
    {
      blockId: "reach-the-light-sequence",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "Reach the Light",
      instructions:
        "Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.",
      completionMode: "duration",
      targetDurationSeconds: 60,
      restAfterSeconds: 0,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      blockType: "movement-target",
      feedbackProfile: REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 90,
      },
    },
  ],
};
