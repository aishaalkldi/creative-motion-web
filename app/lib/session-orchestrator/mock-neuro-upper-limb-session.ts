/**
 * Mock Neuro Upper-Limb session definition — TEST FIXTURE ONLY.
 *
 * Mirrors the 8-block session model shape (preparation, calibration,
 * warm-up, main movement, rest, functional challenge, cool-down,
 * completion) using entirely generic movement ids and no shoulder-specific
 * detector logic. This proves the Orchestrator can run the target session
 * shape without depending on any real tracker.
 */
import type { SessionDefinition } from "./types";

export const MOCK_NEURO_UPPER_LIMB_SESSION: SessionDefinition = {
  sessionId: "mock-neuro-upper-limb-session",
  title: "Mock Neuro Upper-Limb Session (test fixture)",
  recalibrationGraceSeconds: 5,
  blocks: [
    {
      blockId: "warm-up",
      movementId: "mock-forward-reach",
      movementVersion: "v0",
      title: "Warm-up",
      instructions: "Small, slow reaches to warm up.",
      completionMode: "duration",
      targetDurationSeconds: 30,
      restAfterSeconds: 10,
      supportedPositions: ["seated", "standing"],
      side: "bilateral",
      intensityLevel: 1,
    },
    {
      blockId: "main-movement",
      movementId: "mock-shoulder-movement",
      movementVersion: "v0",
      title: "Main movement",
      instructions: "Reach up and out, then return with control.",
      completionMode: "validRepetitions",
      prescribedRepetitions: 10,
      restAfterSeconds: 15,
      supportedPositions: ["seated", "standing"],
      side: "right",
      intensityLevel: 2,
      safetyRules: { maxCompensationEventsBeforePause: 3, blockTimeoutSeconds: 180 },
    },
    {
      blockId: "functional-challenge",
      movementId: "mock-target-touch",
      movementVersion: "v0",
      title: "Functional challenge",
      instructions: "Reach toward the target, hold, and return.",
      completionMode: "holdDuration",
      prescribedHoldSeconds: 3,
      restAfterSeconds: 0,
      supportedPositions: ["seated"],
      side: "right",
      intensityLevel: 2,
    },
    {
      blockId: "cool-down",
      movementId: "mock-cool-down-reach",
      movementVersion: "v0",
      title: "Cool-down",
      instructions: "Slow, reduced-range movement and breathing.",
      completionMode: "duration",
      targetDurationSeconds: 20,
      supportedPositions: ["seated", "standing"],
      side: "bilateral",
      intensityLevel: 1,
    },
  ],
};
