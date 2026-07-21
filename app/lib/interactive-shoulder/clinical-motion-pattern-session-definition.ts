import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";
import { PNF_D1_FLEXION_FEEDBACK_PROFILE } from "./motion-patterns/pnf-d1-flexion-pattern";
import { REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE } from "./motion-patterns/motion-pattern-registry";

/** Clinical Motion Pattern Engine — sequential pattern blocks for production. */
export const CLINICAL_MOTION_PATTERN_SESSION: SessionDefinition = {
  sessionId: "clinical-motion-pattern-v1",
  title: "Clinical motion pattern session",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "pnf-d1-flexion-main",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "PNF D1 Flexion",
      instructions:
        "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
      completionMode: "duration",
      targetDurationSeconds: 90,
      restAfterSeconds: 0,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      feedbackProfile: PNF_D1_FLEXION_FEEDBACK_PROFILE,
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 120,
      },
    },
  ],
};

/** Backward-compatible Reach the Light session — isolated target mode. */
export { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION as REACH_THE_LIGHT_SESSION } from "./shoulder-abduction-reach-session-definition";

/** Sequential session exercising pattern then legacy target mode for compatibility tests. */
export const CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION: SessionDefinition = {
  sessionId: "clinical-motion-pattern-sequence-v1",
  title: "Clinical motion pattern sequence session",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "pnf-d1-flexion-sequence",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "PNF D1 Flexion",
      instructions: "Follow the therapeutic path along the diagonal reach.",
      completionMode: "duration",
      targetDurationSeconds: 60,
      restAfterSeconds: 5,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      feedbackProfile: PNF_D1_FLEXION_FEEDBACK_PROFILE,
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
      feedbackProfile: REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 90,
      },
    },
  ],
};

/** Default interactive shoulder session — clinical motion pattern engine. */
export const INTERACTIVE_SHOULDER_DEFAULT_SESSION = CLINICAL_MOTION_PATTERN_SESSION;
