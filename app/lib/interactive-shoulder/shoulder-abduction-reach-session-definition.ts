import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";

/** First production vertical slice — one Shoulder Abduction Reach movement block. */
export const SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION: SessionDefinition = {
  sessionId: "shoulder-abduction-reach-interactive-v1",
  title: "Shoulder reach session",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "shoulder-abduction-reach-main",
      movementId: "shoulder-abduction-reach",
      movementVersion: "v1",
      title: "Reach toward the glowing target",
      instructions:
        "Lift your arm out to the side and reach toward each glowing target. Move at a comfortable pace.",
      completionMode: "duration",
      targetDurationSeconds: 90,
      restAfterSeconds: 0,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 1,
      blockType: "movement-target",
      feedbackProfile: "shoulder-therapeutic-target",
      safetyRules: {
        trackerLossGraceSeconds: 0,
        maxCompensationEventsBeforePause: 5,
        blockTimeoutSeconds: 120,
      },
    },
  ],
};
