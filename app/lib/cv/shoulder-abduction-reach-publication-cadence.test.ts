/**
 * Run: npx tsx --test app/lib/cv/shoulder-abduction-reach-publication-cadence.test.ts
 *
 * Issue #276 — CV interaction latency / delayed hand-marker response.
 *
 * Regression coverage for the snapshot PUBLICATION cadence of the Interactive
 * Shoulder detector, and for the reaction timing that cadence feeds. The
 * detector published one snapshot per 15 processed camera frames (the shared
 * `DEFAULT_STS_CONFIG.uiFrameUpdateInterval`), which at ~30 fps meant a fresh
 * wrist roughly every 500 ms even though MediaPipe had already computed one on
 * every frame. Shoulder Abduction Reach now overrides that locally to 1.
 *
 * Camera-free throughout, using the same private-access harness convention as
 * `shoulder-abduction-reach-pose-detector.test.ts`: a stub video, a stub 2D
 * canvas context and a stub PoseLandmarker are installed on the detector and
 * `tickLiveVideoFrame` is driven directly. Nothing here loads MediaPipe or
 * opens a camera, and nothing here touches the camera lifecycle (#273/#275).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  ShoulderAbductionReachPoseDetector,
  type ShoulderAbductionReachPoseDetectorSnapshot,
} from "./shoulder-abduction-reach-pose-detector";
import {
  createInitialTargetLifecycle,
  tickTargetLifecycle,
  type TargetLifecycleState,
} from "@/app/lib/interactive-shoulder/target-lifecycle";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "@/app/lib/interactive-shoulder/target-generator";
import { DEFAULT_TARGET_HIT_CONFIG } from "@/app/lib/interactive-shoulder/target-hit";

/* ── Landmark fixtures ─────────────────────────────────────────────────────── */

const R_SHOULDER = 12;
const R_ELBOW = 14;
const R_WRIST = 16;
const L_SHOULDER = 11;
const L_ELBOW = 13;
const L_WRIST = 15;
const R_HIP = 24;
const L_HIP = 23;

/**
 * A tracked pose whose RIGHT wrist sits exactly where the caller asks. Every
 * other joint is held still, so the only thing that varies frame to frame is
 * the measurement this issue is about.
 */
function landmarksWithRightWristAt(x: number, y: number): PoseLandmark[] {
  const lm: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  lm[R_HIP] = { x: 0.5, y: 0.6, visibility: 0.95 };
  lm[R_SHOULDER] = { x: 0.5, y: 0.35, visibility: 0.95 };
  lm[R_ELBOW] = { x: 0.6, y: 0.4, visibility: 0.95 };
  lm[R_WRIST] = { x, y, visibility: 0.9 };
  lm[L_HIP] = { x: 0.4, y: 0.6, visibility: 0.9 };
  lm[L_SHOULDER] = { x: 0.4, y: 0.35, visibility: 0.9 };
  lm[L_ELBOW] = { x: 0.4, y: 0.55, visibility: 0.9 };
  lm[L_WRIST] = { x: 0.4, y: 0.7, visibility: 0.9 };
  return lm;
}

/* ── Camera-free live-tick harness ─────────────────────────────────────────── */

type PoseLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, ts: number) => { landmarks?: PoseLandmark[][] };
  close?: () => void;
};

type LiveDetectInternals = {
  previewActive: boolean;
  videoEl: HTMLVideoElement | null;
  canvasEl: HTMLCanvasElement | null;
  poseLandmarker: PoseLandmarkerInstance | null;
  framesTotal: number;
  tickLiveVideoFrame: (options?: { scheduleNext?: boolean }) => void;
  resetSessionState: () => void;
};

function createMockVideo(currentTimeS: number): HTMLVideoElement {
  return {
    currentTime: currentTimeS,
    videoWidth: 640,
    videoHeight: 480,
    paused: false,
    play: async () => {},
    addEventListener: () => {},
    srcObject: null,
    // `as unknown as` (not a direct assertion) because the stub deliberately carries
    // only the members the live tick reads — the same shape the canvas stub below uses.
  } as unknown as HTMLVideoElement;
}

/**
 * A COMPLETE no-op 2D context. The live tick draws the framing overlay and the
 * landmark dots before it processes the frame, and the whole tick body sits in
 * a try/catch — a context missing any of those methods would throw, be
 * swallowed, and silently skip frame processing, making a cadence assertion
 * meaningless. Every method the two overlay helpers call is stubbed here.
 */
function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    strokeRect: () => {},
    setLineDash: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
  };
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

type CadenceHarness = {
  internals: LiveDetectInternals;
  video: HTMLVideoElement;
  snapshots: ShoulderAbductionReachPoseDetectorSnapshot[];
  inferenceCount: () => number;
  /** Advances the video clock (a newly decoded camera frame) and runs one tick. */
  decodeFrame: (wrist: { x: number; y: number }) => void;
  /** Runs a tick WITHOUT advancing the video clock — a duplicate rAF tick. */
  repeatRafTick: () => void;
};

function createCadenceHarness(): CadenceHarness {
  let inferences = 0;
  let nextWrist = { x: 0.5, y: 0.5 };

  const landmarker: PoseLandmarkerInstance = {
    detectForVideo: () => {
      inferences += 1;
      return { landmarks: [landmarksWithRightWristAt(nextWrist.x, nextWrist.y)] };
    },
  };

  const snapshots: ShoulderAbductionReachPoseDetectorSnapshot[] = [];
  const detector = new ShoulderAbductionReachPoseDetector(
    { onSnapshot: (snap) => snapshots.push(snap) },
    "right",
  );

  const video = createMockVideo(0);
  const internals = detector as unknown as LiveDetectInternals;
  internals.resetSessionState();
  internals.videoEl = video;
  internals.canvasEl = createMockCanvas();
  internals.previewActive = true;
  internals.poseLandmarker = landmarker;

  let videoClockS = 0;
  return {
    internals,
    video,
    snapshots,
    inferenceCount: () => inferences,
    decodeFrame: (wrist) => {
      nextWrist = wrist;
      videoClockS += 1 / 30;
      video.currentTime = videoClockS;
      internals.tickLiveVideoFrame({ scheduleNext: false });
    },
    repeatRafTick: () => {
      internals.tickLiveVideoFrame({ scheduleNext: false });
    },
  };
}

/* ── A. Publication cadence ────────────────────────────────────────────────── */

describe("#276 Interactive Shoulder snapshot publication cadence", () => {
  it("publishes a snapshot on every processed camera frame", () => {
    const h = createCadenceHarness();

    for (let i = 0; i < 20; i += 1) {
      h.decodeFrame({ x: 0.5 + i * 0.01, y: 0.5 });
    }

    assert.equal(h.internals.framesTotal, 20, "every decoded frame must be processed");
    assert.equal(
      h.snapshots.length,
      20,
      "one snapshot per processed camera frame — the #276 fix",
    );
  });

  it("cannot silently return to the old 15-frame publication delay", () => {
    // The regression this issue was filed for. At ~30 fps the previous cadence
    // published nothing until the 15th processed frame (~500 ms). A single frame
    // must now be enough to publish, and 14 frames must not still be silent.
    const h = createCadenceHarness();

    h.decodeFrame({ x: 0.6, y: 0.4 });
    assert.equal(h.snapshots.length, 1, "the first processed frame must publish");

    for (let i = 0; i < 13; i += 1) {
      h.decodeFrame({ x: 0.6, y: 0.4 });
    }
    assert.equal(
      h.snapshots.length,
      14,
      "14 processed frames must have produced 14 snapshots, not 0",
    );
  });

  it("emits the wrist measured on the latest processed frame", () => {
    const h = createCadenceHarness();

    const path = [
      { x: 0.30, y: 0.50 },
      { x: 0.45, y: 0.45 },
      { x: 0.60, y: 0.40 },
      { x: 0.75, y: 0.35 },
    ];
    path.forEach((point) => h.decodeFrame(point));

    assert.equal(h.snapshots.length, path.length);
    path.forEach((point, index) => {
      const wrist = h.snapshots[index]?.primaryWristNormalized;
      assert.ok(wrist, `snapshot ${index} must carry a wrist`);
      assert.ok(
        Math.abs(wrist.x - point.x) < 1e-6 && Math.abs(wrist.y - point.y) < 1e-6,
        `snapshot ${index} must carry frame ${index}'s wrist, not an earlier one`,
      );
    });
  });

  it("keeps decoded-frame dedup intact — no publication on a duplicate rAF tick", () => {
    const h = createCadenceHarness();

    h.decodeFrame({ x: 0.5, y: 0.5 });
    assert.equal(h.snapshots.length, 1);
    assert.equal(h.internals.framesTotal, 1);

    // Several rAF ticks with the video clock unchanged: the #258 dedup guard must
    // still skip them entirely — no processing and no publication.
    h.repeatRafTick();
    h.repeatRafTick();
    h.repeatRafTick();

    assert.equal(h.snapshots.length, 1, "duplicate rAF ticks must not publish");
    assert.equal(h.internals.framesTotal, 1, "duplicate rAF ticks must not process");
  });

  it("does not increase MediaPipe inference beyond one per decoded camera frame", () => {
    const h = createCadenceHarness();

    for (let i = 0; i < 10; i += 1) {
      h.decodeFrame({ x: 0.5, y: 0.5 });
      // Two extra rAF ticks per decoded frame, as a real 60 Hz rAF against a
      // 30 fps camera produces.
      h.repeatRafTick();
      h.repeatRafTick();
    }

    assert.equal(
      h.inferenceCount(),
      10,
      "inference must run once per DECODED frame — publication cadence must not drive it",
    );
    assert.equal(h.snapshots.length, 10, "and publication must follow decoded frames too");
  });
});

/* ── B. Reaction timing ────────────────────────────────────────────────────── */

/**
 * Replays a wrist path through the real detector and feeds each published
 * snapshot's wrist into the real target lifecycle, exactly as the orchestrator
 * loop does: gameplay consumes `primaryWristNormalized` from the most recently
 * published snapshot. Returns the frame index at which the hit registered.
 *
 * `publishEveryNFrames` models the publication cadence, so the same replay can
 * be run against the old 15-frame behaviour and the new per-frame behaviour.
 */
function replayReachAndFindHitFrame(
  path: Array<{ x: number; y: number }>,
  target: { x: number; y: number },
  publishEveryNFrames: number,
): { hitFrame: number | null; reactionTimeMs: number | null } {
  const h = createCadenceHarness();

  // Spawn a target at a known position, then hold it: the lifecycle is driven
  // with the published wrist only, so the hit frame is a pure function of when a
  // wrist inside the target reaches it.
  let state: TargetLifecycleState = createInitialTargetLifecycle();
  const spawn = tickTargetLifecycle(state, {
    wrist: null,
    nowMs: 1_000,
    side: "right",
    bounds: DEFAULT_SAFE_TARGET_BOUNDS,
    hitConfig: DEFAULT_TARGET_HIT_CONFIG,
    random: () => 0.5,
    preferredTargetPosition: target,
  });
  state = spawn.state;
  assert.ok(state.currentTarget, "a target must be active before the replay starts");

  let published: { x: number; y: number } | null = null;
  let hitFrame: number | null = null;
  let reactionTimeMs: number | null = null;

  path.forEach((point, frameIndex) => {
    h.decodeFrame(point);
    // Model the publication cadence: only every Nth processed frame reaches the UI.
    if ((frameIndex + 1) % publishEveryNFrames === 0) {
      const latest = h.snapshots[h.snapshots.length - 1];
      published = latest?.primaryWristNormalized ?? null;
    }

    const tick = tickTargetLifecycle(state, {
      wrist: published,
      nowMs: 1_000 + (frameIndex + 1) * 33,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitConfig: DEFAULT_TARGET_HIT_CONFIG,
      random: () => 0.5,
    });
    state = tick.state;
    if (tick.hitEvent && hitFrame === null) {
      hitFrame = frameIndex;
      reactionTimeMs = tick.hitEvent.reactionTimeMs;
    }
  });

  return { hitFrame, reactionTimeMs };
}

describe("#276 reaction timing consumes the fresher published measurement", () => {
  const TARGET = { x: 0.72, y: 0.34 };

  /** Approaches the target from outside it and arrives on frame 3. */
  const REACH_PATH = [
    { x: 0.30, y: 0.60 },
    { x: 0.42, y: 0.53 },
    { x: 0.55, y: 0.45 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
    { x: 0.72, y: 0.34 },
  ];

  it("registers the hit on the frame the hand physically arrives", () => {
    const { hitFrame } = replayReachAndFindHitFrame(REACH_PATH, TARGET, 1);
    assert.equal(
      hitFrame,
      3,
      "with per-frame publication the hit must register on the arrival frame",
    );
  });

  it("proves the old 15-frame cadence inflated reaction timing", () => {
    // Guards the fix by contrast: the same physical reach, replayed against the
    // old cadence, cannot register until the 15th processed frame. If this ever
    // stops differing from the per-frame result above, the throttle is back.
    const fresh = replayReachAndFindHitFrame(REACH_PATH, TARGET, 1);
    const throttled = replayReachAndFindHitFrame(REACH_PATH, TARGET, 15);

    assert.equal(throttled.hitFrame, 14, "the old cadence could not react before frame 14");
    assert.ok(fresh.hitFrame !== null && throttled.hitFrame !== null);
    assert.ok(
      fresh.hitFrame < throttled.hitFrame,
      "the shipped cadence must react strictly sooner than the old one",
    );
    assert.ok(
      fresh.reactionTimeMs !== null && throttled.reactionTimeMs !== null,
      "both replays must produce a reaction time",
    );
    assert.ok(
      fresh.reactionTimeMs < throttled.reactionTimeMs,
      "reported reaction time must no longer carry the publication delay",
    );
  });

  it("does not undersample a fast target crossing", () => {
    // A hand that passes THROUGH the target and back out within the old
    // publication window. Under the old cadence no published sample ever landed
    // inside the target, so the crossing was missed entirely.
    const crossing = [
      { x: 0.30, y: 0.60 },
      { x: 0.50, y: 0.45 },
      { x: 0.72, y: 0.34 },
      { x: 0.50, y: 0.45 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
      { x: 0.30, y: 0.60 },
    ];

    const fresh = replayReachAndFindHitFrame(crossing, TARGET, 1);
    const throttled = replayReachAndFindHitFrame(crossing, TARGET, 15);

    assert.equal(fresh.hitFrame, 2, "the crossing must be seen on the frame it happened");
    assert.equal(throttled.hitFrame, null, "the old cadence missed this crossing entirely");
  });

  it("keeps exactly-once hit semantics at the higher publication cadence", () => {
    const h = createCadenceHarness();

    let state: TargetLifecycleState = createInitialTargetLifecycle();
    const spawn = tickTargetLifecycle(state, {
      wrist: null,
      nowMs: 1_000,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitConfig: DEFAULT_TARGET_HIT_CONFIG,
      random: () => 0.5,
      preferredTargetPosition: TARGET,
    });
    state = spawn.state;

    let hitEvents = 0;
    // Hold the wrist inside the target for many consecutive published frames.
    for (let frame = 0; frame < 30; frame += 1) {
      h.decodeFrame(TARGET);
      const latest = h.snapshots[h.snapshots.length - 1];
      const tick = tickTargetLifecycle(state, {
        wrist: latest?.primaryWristNormalized ?? null,
        nowMs: 1_000 + (frame + 1) * 33,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        hitConfig: DEFAULT_TARGET_HIT_CONFIG,
        random: () => 0.5,
      });
      state = tick.state;
      if (tick.hitEvent) hitEvents += 1;
    }

    assert.equal(
      hitEvents,
      1,
      "30 published frames inside one target must still count exactly one hit",
    );
  });

  it("keeps attempt timeout behaviour correct at the higher publication cadence", () => {
    const h = createCadenceHarness();

    let state: TargetLifecycleState = createInitialTargetLifecycle();
    const spawn = tickTargetLifecycle(state, {
      wrist: null,
      nowMs: 1_000,
      side: "right",
      bounds: DEFAULT_SAFE_TARGET_BOUNDS,
      hitConfig: DEFAULT_TARGET_HIT_CONFIG,
      random: () => 0.5,
      preferredTargetPosition: TARGET,
      blockElapsedSeconds: 0,
      attemptTimeoutMs: 1_000,
    });
    state = spawn.state;
    assert.ok(state.currentTarget, "a target must be active");

    // The hand never reaches the target. Publication is now per-frame, but
    // expiration is driven by the attempt clock, not by publication cadence.
    let timeouts = 0;
    let elapsedS = 0;
    for (let frame = 0; frame < 45; frame += 1) {
      h.decodeFrame({ x: 0.30, y: 0.60 });
      elapsedS += 1 / 30;
      const latest = h.snapshots[h.snapshots.length - 1];
      const tick = tickTargetLifecycle(state, {
        wrist: latest?.primaryWristNormalized ?? null,
        nowMs: 1_000 + (frame + 1) * 33,
        side: "right",
        bounds: DEFAULT_SAFE_TARGET_BOUNDS,
        hitConfig: DEFAULT_TARGET_HIT_CONFIG,
        random: () => 0.5,
        blockElapsedSeconds: elapsedS,
        attemptTimeoutMs: 1_000,
      });
      state = tick.state;
      if (tick.attemptTimeoutEvent) timeouts += 1;
    }

    assert.equal(timeouts, 1, "the unreached attempt must time out exactly once");
  });
});

/* ── C. Ancestor-callback safeguard ────────────────────────────────────────── */

describe("#276 capture-readiness is not re-emitted unchanged at the new cadence", () => {
  // `reportReadiness` runs once per published snapshot, so raising publication from
  // one snapshot per 15 frames to one per frame multiplies these ancestor callbacks
  // 15x. Readiness is a slow, framing-derived value, so the payload is almost always
  // identical. Asserted against the component source, matching the convention
  // `orchestrator-cv-session-core.test.ts` already uses for this component.
  const source = readFileSync(
    join(
      process.cwd(),
      "app/components/patient/interactive-shoulder/OrchestratorCvSessionCore.tsx",
    ),
    "utf8",
  );

  it("keeps the last emitted readiness payload for comparison", () => {
    assert.match(
      source,
      /lastReadinessPayloadRef\s*=\s*useRef<CaptureReadinessPayload \| null>\(null\)/,
      "the change-on-value guard needs the previously emitted payload",
    );
  });

  it("compares every readiness field before calling the ancestor", () => {
    ["primaryGuidance", "canStartTracking", "minimumMet", "previewActive"].forEach(
      (field) => {
        assert.match(
          source,
          new RegExp(`previous\\.${field} === payload\\.${field}`),
          `readiness dedup must compare ${field} — a field left out would suppress a real change`,
        );
      },
    );
  });

  it("still delivers the payload whenever a field changed", () => {
    assert.match(
      source,
      /lastReadinessPayloadRef\.current = payload;\s*\n\s*onCaptureReadinessChange\(payload\);/,
      "a changed payload must still reach the ancestor, and be recorded as the new baseline",
    );
  });
});
