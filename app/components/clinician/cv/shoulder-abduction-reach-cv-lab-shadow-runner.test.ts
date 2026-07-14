/**
 * Run: npx tsx --test app/components/clinician/cv/shoulder-abduction-reach-cv-lab-shadow-runner.test.ts
 *
 * Tests the lifecycle logic (gate short-circuiting, start/stop, cleanup
 * races) with injected fakes — no browser, no DOM, no real MediaPipe model.
 * The actual detectForVideo/RAF loop against a real <video> element is not
 * testable this way; see docs/shoulder-abduction-reach-shadow-mode.md for
 * the manual browser verification step this requires instead.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  createShoulderAbductionReachCvLabShadowRunner,
  type ShoulderAbductionReachCvLabShadowRunnerDeps,
  type ShoulderAbductionReachLandmarkerLike,
} from "./shoulder-abduction-reach-cv-lab-shadow-runner";

const FAKE_VIDEO = {} as HTMLVideoElement;

function fullSyntheticLandmarks(): PoseLandmark[] {
  const landmarks: PoseLandmark[] = [];
  for (let i = 0; i < 33; i += 1) {
    landmarks.push({ x: 0.5, y: 0.5, visibility: 0.9 });
  }
  return landmarks;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type FakeState = {
  loadCalls: number;
  detectCalls: number;
  closeCalls: number;
  rafCalls: number;
  cancelCalls: number;
  queuedCallback: FrameRequestCallback | null;
};

function createFakeDeps(options: {
  enabled?: boolean;
  landmarksPerFrame?: PoseLandmark[];
} = {}): { deps: ShoulderAbductionReachCvLabShadowRunnerDeps; state: FakeState; fireNextFrame: (ts?: number) => void } {
  const state: FakeState = {
    loadCalls: 0,
    detectCalls: 0,
    closeCalls: 0,
    rafCalls: 0,
    cancelCalls: 0,
    queuedCallback: null,
  };

  const landmarker: ShoulderAbductionReachLandmarkerLike = {
    detectForVideo: () => {
      state.detectCalls += 1;
      const landmarks = options.landmarksPerFrame ?? fullSyntheticLandmarks();
      return { landmarks: landmarks.length > 0 ? [landmarks] : [] };
    },
    close: () => {
      state.closeCalls += 1;
    },
  };

  let clock = 0;

  const deps: ShoulderAbductionReachCvLabShadowRunnerDeps = {
    isEnabled: () => options.enabled ?? true,
    loadLandmarker: async () => {
      state.loadCalls += 1;
      return landmarker;
    },
    requestAnimationFrame: (callback) => {
      state.rafCalls += 1;
      state.queuedCallback = callback;
      return state.rafCalls;
    },
    cancelAnimationFrame: () => {
      state.cancelCalls += 1;
    },
    now: () => {
      clock += 16;
      return clock;
    },
  };

  const fireNextFrame = (ts = 0): void => {
    const callback = state.queuedCallback;
    state.queuedCallback = null;
    callback?.(ts);
  };

  return { deps, state, fireNextFrame };
}

describe("createShoulderAbductionReachCvLabShadowRunner — disabled (zero cost)", () => {
  it("does not load a landmarker or schedule a frame when disabled", () => {
    const { deps, state } = createFakeDeps({ enabled: false });
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);

    assert.equal(state.loadCalls, 0);
    assert.equal(state.rafCalls, 0);
    assert.equal(runner.isRunning, false);
  });
});

describe("createShoulderAbductionReachCvLabShadowRunner — enabled lifecycle", () => {
  it("loads a landmarker and schedules the first frame", async () => {
    const { deps, state } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    assert.equal(runner.isRunning, true);

    await flushAsync();

    assert.equal(state.loadCalls, 1);
    assert.equal(state.rafCalls, 1);
  });

  it("calls detectForVideo and re-schedules itself on each fired frame", async () => {
    const { deps, state, fireNextFrame } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    await flushAsync();

    fireNextFrame();
    assert.equal(state.detectCalls, 1);
    assert.equal(state.rafCalls, 2);

    fireNextFrame();
    assert.equal(state.detectCalls, 2);
    assert.equal(state.rafCalls, 3);
  });

  it("does not call the shadow hook for a frame with zero detected landmarks", async () => {
    const { deps, fireNextFrame } = createFakeDeps({ landmarksPerFrame: [] });
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    await flushAsync();
    fireNextFrame();

    assert.equal(runner.shadowState.log.frameCount, 0);
  });

  it("does not double-start on a second start() call while already running", async () => {
    const { deps, state } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    runner.start(FAKE_VIDEO);
    await flushAsync();

    assert.equal(state.loadCalls, 1);
  });
});

describe("createShoulderAbductionReachCvLabShadowRunner — cleanup", () => {
  it("cancels the scheduled frame and closes the landmarker on stop()", async () => {
    const { deps, state } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    await flushAsync();
    runner.stop();

    assert.equal(state.cancelCalls, 1);
    assert.equal(state.closeCalls, 1);
    assert.equal(runner.isRunning, false);
  });

  it("does not schedule further frames after stop()", async () => {
    const { deps, state, fireNextFrame } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    runner.start(FAKE_VIDEO);
    await flushAsync();
    const rafCallsBeforeStop = state.rafCalls;
    runner.stop();
    fireNextFrame(); // simulates a frame that was already queued before stop()

    assert.equal(state.rafCalls, rafCallsBeforeStop);
  });

  it("is safe to call stop() when never started", () => {
    const { deps, state } = createFakeDeps();
    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);

    assert.doesNotThrow(() => runner.stop());
    assert.equal(state.cancelCalls, 0);
    assert.equal(state.closeCalls, 0);
  });

  it("closes the landmarker once loading resolves, if stop() was called while loading", async () => {
    let resolveLoad!: (landmarker: ShoulderAbductionReachLandmarkerLike) => void;
    const state = { closeCalls: 0, rafCalls: 0 };
    const landmarker: ShoulderAbductionReachLandmarkerLike = {
      detectForVideo: () => ({ landmarks: [] }),
      close: () => {
        state.closeCalls += 1;
      },
    };

    const deps: ShoulderAbductionReachCvLabShadowRunnerDeps = {
      isEnabled: () => true,
      loadLandmarker: () => new Promise((resolve) => (resolveLoad = resolve)),
      requestAnimationFrame: () => {
        state.rafCalls += 1;
        return 1;
      },
      cancelAnimationFrame: () => {},
      now: () => 0,
    };

    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);
    runner.start(FAKE_VIDEO);
    runner.stop(); // stop before the load resolves

    resolveLoad(landmarker);
    await flushAsync();

    assert.equal(state.closeCalls, 1);
    assert.equal(state.rafCalls, 0, "must not schedule a frame after being stopped mid-load");
  });
});

describe("createShoulderAbductionReachCvLabShadowRunner — end-to-end rep detection", () => {
  it("drives a real rep count through the full pipeline across a synthetic session", async () => {
    const angleSequence: (0 | 90 | 180)[] = [0, 0, 90, 180, 180, 90, 0, 0];
    let frame = 0;

    const landmarksForAngle = (angleDeg: 0 | 90 | 180): PoseLandmark[] => {
      const landmarks = fullSyntheticLandmarks();
      landmarks[23] = { x: 0.5, y: 0.7, visibility: 0.9 }; // left_hip
      landmarks[11] = { x: 0.5, y: 0.5, visibility: 0.9 }; // left_shoulder
      if (angleDeg === 0) landmarks[13] = { x: 0.5, y: 0.68, visibility: 0.9 };
      else if (angleDeg === 90) landmarks[13] = { x: 0.7, y: 0.5, visibility: 0.9 };
      else landmarks[13] = { x: 0.5, y: 0.3, visibility: 0.9 };
      return landmarks;
    };

    const landmarker: ShoulderAbductionReachLandmarkerLike = {
      detectForVideo: () => {
        const landmarks = landmarksForAngle(angleSequence[Math.min(frame, angleSequence.length - 1)]);
        frame += 1;
        return { landmarks: [landmarks] };
      },
    };

    let clock = 0;
    const queuedRef: { current: FrameRequestCallback | null } = { current: null };
    const deps: ShoulderAbductionReachCvLabShadowRunnerDeps = {
      isEnabled: () => true,
      loadLandmarker: async () => landmarker,
      requestAnimationFrame: (cb) => {
        queuedRef.current = cb;
        return 1;
      },
      cancelAnimationFrame: () => {},
      now: () => (clock += 16),
    };

    const runner = createShoulderAbductionReachCvLabShadowRunner(deps);
    runner.start(FAKE_VIDEO);
    await flushAsync();

    for (let i = 0; i < angleSequence.length; i += 1) {
      const cb = queuedRef.current;
      queuedRef.current = null;
      cb?.(0);
    }

    assert.equal(runner.shadowState.log.repCompletedCount.left, 1);
    assert.equal(runner.shadowState.log.frameCount, angleSequence.length);

    runner.stop();
  });
});
