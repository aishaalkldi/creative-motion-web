/**
 * Shoulder Abduction Reach shadow mode — CV Lab per-frame runner (Option A).
 *
 * An independent, CV-Lab-only pose landmarker loop. Deliberately does not
 * touch `sit-to-stand-detector.ts` or read landmarks from
 * `SitToStandDetector` (that class's `onSnapshot` callback never exposes
 * raw landmarks, and the class itself is shared with
 * `PatientCvCapture.tsx`, `AssessmentCvCaptureSession.tsx`, and
 * `AssessmentTimedCaptureSession.tsx` — editing it would not actually be
 * "CV Lab only"). Instead this bootstraps its own, second MediaPipe
 * PoseLandmarker instance and reads frames from the same already-live
 * `<video>` element CV Lab owns.
 *
 * Tradeoff, accepted deliberately: when shadow mode is enabled, two pose
 * models run concurrently against the same camera feed (this runner's own
 * landmarker, plus `SitToStandDetector`'s existing one). This is only ever
 * paid when a developer explicitly opts in via `?cvDebug=1&shoulderShadow=1`
 * on an internal, non-patient-facing tool — see
 * `docs/shoulder-abduction-reach-shadow-mode.md` for the full rationale.
 *
 * This module has no React dependency so its lifecycle (start/stop/cleanup,
 * gate short-circuiting, load-then-immediately-stopped races) can be unit
 * tested with injected fakes, without a browser or DOM. The thin React hook
 * (`useShoulderAbductionReachCvLabShadow.ts`) is the only browser-glue layer
 * on top of this.
 */

import { createPoseLandmarker, withSitToStandTimeout } from "@/app/lib/cv/sit-to-stand-detector";
import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  createShoulderAbductionReachShadowState,
  isShoulderAbductionReachShadowEnabled,
  runShoulderAbductionReachShadowFrame,
  type ShoulderAbductionReachShadowState,
} from "@/app/lib/shoulder-rehabilitation";

export type ShoulderAbductionReachLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

export type ShoulderAbductionReachCvLabShadowRunnerDeps = {
  isEnabled: () => boolean;
  loadLandmarker: () => Promise<ShoulderAbductionReachLandmarkerLike>;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
  now: () => number;
};

async function loadDefaultLandmarker(): Promise<ShoulderAbductionReachLandmarkerLike> {
  const { PoseLandmarker, FilesetResolver } = await withSitToStandTimeout(
    import("@mediapipe/tasks-vision"),
    DEFAULT_STS_CONFIG.initTimeoutMs,
    "Shoulder shadow pose library load",
  );
  const filesetResolver = await withSitToStandTimeout(
    FilesetResolver.forVisionTasks(DEFAULT_STS_CONFIG.wasmUrl),
    DEFAULT_STS_CONFIG.initTimeoutMs,
    "Shoulder shadow pose runtime load",
  );
  return createPoseLandmarker(PoseLandmarker, filesetResolver, DEFAULT_STS_CONFIG);
}

export const DEFAULT_SHOULDER_ABDUCTION_REACH_CV_LAB_SHADOW_RUNNER_DEPS: ShoulderAbductionReachCvLabShadowRunnerDeps =
  {
    isEnabled: isShoulderAbductionReachShadowEnabled,
    loadLandmarker: loadDefaultLandmarker,
    requestAnimationFrame: (callback) => requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
    now: () => performance.now(),
  };

export type ShoulderAbductionReachCvLabShadowRunner = {
  /** No-ops immediately (does not even load a landmarker) unless deps.isEnabled() is true. */
  start: (video: HTMLVideoElement) => void;
  /** Safe to call any number of times, including when never started. */
  stop: () => void;
  readonly isRunning: boolean;
  readonly shadowState: ShoulderAbductionReachShadowState;
};

export function createShoulderAbductionReachCvLabShadowRunner(
  deps: ShoulderAbductionReachCvLabShadowRunnerDeps = DEFAULT_SHOULDER_ABDUCTION_REACH_CV_LAB_SHADOW_RUNNER_DEPS,
): ShoulderAbductionReachCvLabShadowRunner {
  const shadowState = createShoulderAbductionReachShadowState();

  let landmarker: ShoulderAbductionReachLandmarkerLike | null = null;
  let frameHandle: number | null = null;
  let frameIndex = 0;
  let lastTimestampMs = -1;
  let stopped = true;

  function scheduleTick(video: HTMLVideoElement): void {
    frameHandle = deps.requestAnimationFrame(() => tick(video));
  }

  function tick(video: HTMLVideoElement): void {
    if (stopped || !landmarker) return;

    // Monotonic timestamp guard, matching the existing SitToStandDetector
    // convention (MediaPipe VIDEO mode requires strictly increasing values).
    lastTimestampMs = Math.max(lastTimestampMs + 1, deps.now());

    const result = landmarker.detectForVideo(video, lastTimestampMs);
    const landmarks = (result.landmarks?.[0] ?? []) as PoseLandmark[];

    if (landmarks.length > 0) {
      runShoulderAbductionReachShadowFrame(
        shadowState,
        landmarks,
        { frameIndex, capturedAtMs: lastTimestampMs },
        undefined,
        deps.isEnabled,
      );
      frameIndex += 1;
    }

    scheduleTick(video);
  }

  function start(video: HTMLVideoElement): void {
    if (!deps.isEnabled()) return;
    if (!stopped) return;

    stopped = false;

    void deps
      .loadLandmarker()
      .then((loaded) => {
        if (stopped) {
          // stop() was called while the model was still loading.
          loaded.close?.();
          return;
        }
        landmarker = loaded;
        scheduleTick(video);
      })
      .catch(() => {
        stopped = true;
      });
  }

  function stop(): void {
    stopped = true;
    if (frameHandle !== null) {
      deps.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    landmarker?.close?.();
    landmarker = null;
  }

  return {
    start,
    stop,
    get isRunning() {
      return !stopped;
    },
    get shadowState() {
      return shadowState;
    },
  };
}
