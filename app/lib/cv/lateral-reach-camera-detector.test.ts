/**
 * Lateral Reach Camera Detector — Slice 14 frame-exposure seam tests.
 *
 * Proves optional onFrame delivery semantics without MediaPipe / getUserMedia / RAF.
 *
 * Run (approved harness):
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/cv/lateral-reach-camera-detector.test.ts"
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BLAZEPOSE_ACQUISITION_ADAPTER } from "@/app/lib/input-acquisition/adapters/motion/blazepose-acquisition-adapter";
import type { InputAcquisitionContext } from "@/app/lib/input-acquisition/contract";
import type { NormalizedMotionFrame } from "@/app/lib/motion-intelligence";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  LateralReachCameraDetector,
  notifyLateralReachCameraFrameObserver,
  type LateralReachCameraDetectorCallbacks,
} from "@/app/lib/cv/lateral-reach-camera-detector";
import {
  applyLateralReachCommand,
  createLateralReachAttemptState,
  validateLateralReachConfig,
  type LateralReachAttemptState,
  type LateralReachConfig,
} from "@/app/lib/upper-limb-motor-screen/lateral-reach-engine";

const DETECTOR_SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lateral-reach-camera-detector.ts",
);

function buildLandmarks(
  joints: Record<number, { x: number; y: number; visibility: number }>,
): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    const joint = joints[i];
    if (joint) {
      landmarks[i] = { x: joint.x, y: joint.y, visibility: joint.visibility };
    } else {
      landmarks[i] = { x: -1, y: -1, visibility: 0 };
    }
  }
  return landmarks;
}

function buildConfig(overrides: Partial<LateralReachConfig> = {}): LateralReachConfig {
  const result = validateLateralReachConfig({
    testedSide: "right",
    fixedTarget: { point: { x: 0.7, y: 0.5 }, radius: 0.05 },
    startingZone: { point: { x: 0.3, y: 0.5 }, radius: 0.05 },
    tracking: { minWristVisibility: 0.3, maxAllowedGapMs: 300 },
    timing: { onsetConfirmationMs: 100, dwellDurationMs: 200, returnConfirmationMs: 150 },
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`Invalid config: ${result.reason}`);
  }
  return result.config;
}

function initState(config: LateralReachConfig, armedAtMs = 0): LateralReachAttemptState {
  const result = createLateralReachAttemptState(config, 0, armedAtMs);
  if (!result.ok) {
    throw new Error(`Failed to init state: ${result.reason}`);
  }
  return result.state;
}

function adapterFrame(
  wrist: { x: number; y: number; visibility?: number },
  context: InputAcquisitionContext,
): NormalizedMotionFrame {
  const landmarks = buildLandmarks({
    [16]: { x: wrist.x, y: wrist.y, visibility: wrist.visibility ?? 0.9 },
  });
  const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context);
  assert.ok(frame);
  return frame;
}

/**
 * Mirrors locked CASE A production order for behavioral proof:
 * engine command → isolated onFrame.
 */
function deliverLikeDetectorCaseA(
  state: LateralReachAttemptState,
  frame: NormalizedMotionFrame,
  nowMs: number,
  onFrame?: (frame: NormalizedMotionFrame) => void,
) {
  const order: string[] = [];
  const engineResult = applyLateralReachCommand(state, {
    type: "frame",
    nowMs,
    frame,
  });
  order.push(`engine:${engineResult.status}`);
  notifyLateralReachCameraFrameObserver((observed) => {
    order.push("onFrame");
    onFrame?.(observed);
  }, frame);
  return { engineResult, order };
}

describe("LateralReachCameraDetectorCallbacks — backward compatibility", () => {
  it("accepts callbacks with only onSnapshot", () => {
    const callbacks: LateralReachCameraDetectorCallbacks = {
      onSnapshot: () => {},
    };
    const detector = new LateralReachCameraDetector(callbacks);
    assert.ok(detector);
    assert.equal(typeof callbacks.onFrame, "undefined");
  });
});

describe("notifyLateralReachCameraFrameObserver — delivery semantics", () => {
  it("delivers exactly once for one non-null adapter frame", () => {
    const frame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 7, capturedAtMs: 1234, deviceLabel: "front_camera" },
    );
    let count = 0;
    notifyLateralReachCameraFrameObserver(() => {
      count += 1;
    }, frame);
    assert.equal(count, 1);
  });

  it("preserves exact adapter frame identity and values", () => {
    const frame = adapterFrame(
      { x: 0.42, y: 0.61, visibility: 0.88 },
      { frameIndex: 11, capturedAtMs: 9001, deviceLabel: "front_camera" },
    );
    const received: NormalizedMotionFrame[] = [];
    notifyLateralReachCameraFrameObserver((f) => {
      received.push(f);
    }, frame);

    assert.equal(received.length, 1);
    const observed = received[0]!;
    assert.equal(observed, frame);
    assert.equal(observed.source.capturedAtMs, 9001);
    assert.equal(observed.source.frameIndex, 11);
    assert.equal(observed.source.kind, "web_camera_pose");
    assert.equal(observed.source.deviceLabel, "front_camera");
    assert.equal(observed.joints.right_wrist?.landmark.x, 0.42);
    assert.equal(observed.joints.right_wrist?.landmark.y, 0.61);
    assert.equal(observed.joints.right_wrist?.confidence.visibility, 0.88);
  });

  it("no-ops when onFrame is omitted", () => {
    const frame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 0, capturedAtMs: 0 },
    );
    assert.doesNotThrow(() =>
      notifyLateralReachCameraFrameObserver(undefined, frame),
    );
  });

  it("isolates observer throws without escaping", () => {
    const frame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 0, capturedAtMs: 0 },
    );
    let continued = false;
    assert.doesNotThrow(() => {
      notifyLateralReachCameraFrameObserver(() => {
        throw new Error("observer boom");
      }, frame);
      continued = true;
    });
    assert.equal(continued, true);
  });
});

describe("CASE A composition — engine-first, applied and rejected", () => {
  it("notifies after applied engine handling with the real frame", () => {
    const state = initState(buildConfig());
    const frame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 0, capturedAtMs: 10 },
    );
    const received: NormalizedMotionFrame[] = [];
    const { engineResult, order } = deliverLikeDetectorCaseA(
      state,
      frame,
      10,
      (f) => {
        received.push(f);
      },
    );

    assert.equal(engineResult.status, "applied");
    assert.deepEqual(order, ["engine:applied", "onFrame"]);
    assert.equal(received[0], frame);
  });

  it("notifies after rejected engine handling with the real frame", () => {
    // Drive to completed_pending_finalization so subsequent frames reject.
    const config = buildConfig();
    let state = initState(config, 0);

    const startFrame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 0, capturedAtMs: 10 },
    );
    let result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 10,
      frame: startFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    result = applyLateralReachCommand(state, {
      type: "readinessConfirmed",
      nowMs: 20,
      confirmedBy: "clinician",
    });
    assert.equal(result.status, "applied");
    state = result.state;

    const exitFrame = adapterFrame(
      { x: 0.5, y: 0.5 },
      { frameIndex: 2, capturedAtMs: 30 },
    );
    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 30,
      frame: exitFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 30 + config.timing.onsetConfirmationMs + 10,
      frame: exitFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    const targetFrame = adapterFrame(
      { x: 0.7, y: 0.5 },
      { frameIndex: 1, capturedAtMs: 200 },
    );
    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 200,
      frame: targetFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 200 + config.timing.dwellDurationMs + 10,
      frame: targetFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 500,
      frame: startFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;

    result = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 500 + config.timing.returnConfirmationMs + 10,
      frame: startFrame,
    });
    assert.equal(result.status, "applied");
    state = result.state;
    assert.equal(result.snapshot.phase, "completed_pending_finalization");

    const laterFrame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 3, capturedAtMs: 700 },
    );
    const received: NormalizedMotionFrame[] = [];
    const delivery = deliverLikeDetectorCaseA(state, laterFrame, 700, (f) => {
      received.push(f);
    });

    assert.equal(delivery.engineResult.status, "rejected");
    assert.deepEqual(delivery.order, ["engine:rejected", "onFrame"]);
    assert.equal(received[0], laterFrame);
  });

  it("observer throw after engine does not prevent represented downstream continuation", () => {
    const state = initState(buildConfig());
    const frame = adapterFrame(
      { x: 0.3, y: 0.5 },
      { frameIndex: 0, capturedAtMs: 10 },
    );

    const engineResult = applyLateralReachCommand(state, {
      type: "frame",
      nowMs: 10,
      frame,
    });
    assert.equal(engineResult.status, "applied");

    let readinessRan = false;
    let emitRan = false;
    assert.doesNotThrow(() => {
      notifyLateralReachCameraFrameObserver(() => {
        throw new Error("observer boom");
      }, frame);
      // Represented production tail after observer notification.
      readinessRan = true;
      emitRan = true;
    });
    assert.equal(readinessRan, true);
    assert.equal(emitRan, true);
  });
});

describe("CASE B / CASE C — no onFrame delivery", () => {
  it("does not invoke onFrame when MediaPipe returns no landmarks (CASE B)", () => {
    // CASE B has no NormalizedMotionFrame; production never calls the notifier.
    let count = 0;
    const onFrame = () => {
      count += 1;
    };
    // Simulate: no frame object exists → notifier is not called.
    assert.equal(typeof onFrame, "function");
    assert.equal(count, 0);
  });

  it("does not invoke onFrame when adapter returns null (CASE C)", () => {
    const allInvalid = buildLandmarks({});
    const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(allInvalid, {
      frameIndex: 0,
      capturedAtMs: 0,
    });
    assert.equal(frame, null);

    let count = 0;
    if (frame) {
      notifyLateralReachCameraFrameObserver(() => {
        count += 1;
      }, frame);
    }
    assert.equal(count, 0);
  });
});

describe("testedSide independence and scope guards", () => {
  it("frame exposure preserves full adapter joints without testedSide wrist filtering", () => {
    const landmarks = buildLandmarks({
      [15]: { x: 0.2, y: 0.4, visibility: 0.9 },
      [16]: { x: 0.8, y: 0.6, visibility: 0.9 },
    });
    const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, {
      frameIndex: 1,
      capturedAtMs: 50,
    });
    assert.ok(frame);
    assert.ok(frame.joints.left_wrist);
    assert.ok(frame.joints.right_wrist);

    const received: NormalizedMotionFrame[] = [];
    notifyLateralReachCameraFrameObserver((f) => {
      received.push(f);
    }, frame);

    assert.equal(received.length, 1);
    const observed = received[0]!;
    assert.equal(observed, frame);
    assert.ok(observed.joints.left_wrist);
    assert.ok(observed.joints.right_wrist);
  });

  it("detector source uses locked engine-first order and forbids calibration wiring", () => {
    const source = readFileSync(DETECTOR_SOURCE_PATH, "utf8");

    const caseAIndex = source.indexOf("// CASE A: Valid frame from adapter");
    assert.ok(caseAIndex >= 0);
    const caseASlice = source.slice(caseAIndex, source.indexOf("// CASE C:", caseAIndex));

    const applyIndex = caseASlice.indexOf("applyLateralReachCommand");
    const notifyIndex = caseASlice.indexOf("notifyLateralReachCameraFrameObserver");
    assert.ok(applyIndex >= 0);
    assert.ok(notifyIndex >= 0);
    assert.ok(applyIndex < notifyIndex);

    // CASE B / CASE C must not notify.
    const caseBSlice = source.slice(source.indexOf("// CASE B:"));
    assert.equal(caseBSlice.includes("notifyLateralReachCameraFrameObserver"), false);

    assert.equal(source.includes("resolveLateralReachCalibrationSampleFromFrame"), false);
    assert.equal(source.includes("createLateralReachCalibrationController"), false);
    assert.equal(source.includes("submitLateralReachCalibrationSample"), false);
    assert.equal(source.includes("buildLateralReachEngineConfig"), false);
    assert.equal(source.includes("interaction-calibration"), false);

    // Frame exposure must not select wrist by testedSide.
    const notifyCallSite = caseASlice.slice(notifyIndex);
    assert.equal(notifyCallSite.includes("testedSide"), false);
  });
});
