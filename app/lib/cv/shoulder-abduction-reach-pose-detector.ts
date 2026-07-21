/**
 * Shoulder Abduction Reach — live pose-detector wrapper (PR1: live CV wiring).
 *
 * Owns the MediaPipe/camera/canvas capture lifecycle and drives the existing
 * shoulder-rehabilitation pure-function module (contract/metrics/phase/
 * detector — unmodified by this file) frame by frame. This is the first
 * real camera wiring that module has ever had; its own header comment says
 * so directly ("not wired into any live capture loop, component, or API
 * route"). Camera/MediaPipe lifecycle code below mirrors
 * `single-leg-stance-pose-detector.ts` — the same proven shell every other
 * patient-portal CV exercise already uses.
 *
 * Measurement source only. This class has no knowledge of session duration,
 * blocks, work/rest schedule, or completion — it emits discrete measured
 * events and exposes a snapshot. A future Session Orchestrator (PR2) and
 * Session Environment (PR3) decide what happens with that information.
 */

import {
  createShoulderAbductionReachDetectorState,
  updateShoulderAbductionReachDetector,
  SHOULDER_ABDUCTION_REACH_BONUS_JOINTS,
  type ShoulderAbductionReachDetectorState,
  type ShoulderAbductionReachFrameResult,
  type ShoulderAbductionReachSide,
} from "@/app/lib/shoulder-rehabilitation";
import { BLAZEPOSE_ACQUISITION_ADAPTER, type InputAcquisitionContext } from "@/app/lib/input-acquisition";
import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { drawPoseLandmarkDots } from "@/app/lib/cv/pose-landmark-overlay";
import {
  createShoulderAbductionReachCompensationState,
  updateShoulderAbductionReachCompensation,
  type ShoulderAbductionReachCompensationState,
} from "@/app/lib/cv/shoulder-abduction-reach-compensation";
import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import { UPPER_LIMB_REACH_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import { drawBodyFramingOverlay, evaluateBodyFraming, type BodyFramingState } from "@/app/lib/cv/body-framing-evaluator";
import {
  PATIENT_CAMERA_NO_FRAMES_ERROR,
  releaseMediaStream,
  waitForVideoElementLayout,
} from "@/app/lib/cv/patient-camera-stream";
import {
  createPoseLandmarker,
  getSitToStandBrowserSupportError,
  mapSitToStandStartError,
  needsSitToStandSecureContext,
  startVideoPlayback,
  withSitToStandTimeout,
  type PoseReadiness,
  type SitToStandInitPhase,
} from "@/app/lib/cv/sit-to-stand-detector";

export { mapSitToStandStartError as mapShoulderAbductionReachStartError };
export type { SitToStandInitPhase as ShoulderAbductionReachInitPhase };

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

export type ShoulderAbductionReachTrackingQuality = "good" | "fair" | "poor" | "unknown";
export type ShoulderAbductionReachTrackingStatus = "idle" | "tracking" | "lost" | "error";

export type ShoulderAbductionReachPoseDetectorSnapshot = {
  trackingStatus: ShoulderAbductionReachTrackingStatus;
  trackingQuality: ShoulderAbductionReachTrackingQuality;
  bodyFramingState: BodyFramingState;
  primarySide: ShoulderAbductionReachSide;
  primaryPhase: ShoulderAbductionReachFrameResult["left"]["phase"];
  primaryRepCount: number;
  primaryPeakAngleDegrees: number | null;
  bilateralAngleDifferenceDegrees: number | null;
  compensationFlagged: boolean;
  framesWithPose: number;
  framesTotal: number;
  initPhase: SitToStandInitPhase;
  previewActive: boolean;
  trackingError: string | null;
  /** Primary-side wrist in normalized preview coordinates for interactive target UI. */
  primaryWristNormalized: { x: number; y: number } | null;
};

/**
 * Discrete measured events, emitted on state transitions only (never once
 * per frame). Concrete to this detector — a future adapter (PR3) is
 * responsible for translating these into the Session Orchestrator's
 * generic input-event vocabulary; this file does not import or know about
 * that vocabulary.
 */
export type ShoulderAbductionReachMeasuredEvent =
  | {
      type: "repCompleted";
      side: ShoulderAbductionReachSide;
      repCount: number;
      peakAngleDegrees: number | null;
      capturedAtMs: number;
    }
  | { type: "compensationDetected"; side: ShoulderAbductionReachSide; capturedAtMs: number }
  | { type: "compensationCleared"; side: ShoulderAbductionReachSide; capturedAtMs: number }
  | { type: "trackerLost"; capturedAtMs: number }
  | { type: "trackerRecovered"; capturedAtMs: number };

export type ShoulderAbductionReachDerivedMetrics = {
  exerciseId: "shoulder-abduction-reach";
  primarySide: ShoulderAbductionReachSide;
  repCount: number;
  sessionDurationS: number;
  trackingQuality: ShoulderAbductionReachTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type ShoulderAbductionReachPoseDetectorCallbacks = {
  onSnapshot: (snapshot: ShoulderAbductionReachPoseDetectorSnapshot) => void;
  /** Optional — PR1 exposes the event stream; nothing subscribes to it in production yet. */
  onMeasuredEvent?: (event: ShoulderAbductionReachMeasuredEvent) => void;
};

const TRACKER_LOST_CONSECUTIVE_FRAMES = 10;
const MIN_SAVE_DURATION_S = 3;

/** MediaPipe shell — reuses the already-configured STS wasm/model URLs, not new values. */
const SHOULDER_ABDUCTION_REACH_POSE_SHELL = {
  wasmUrl: DEFAULT_STS_CONFIG.wasmUrl,
  modelUrl: DEFAULT_STS_CONFIG.modelUrl,
  canvasWidth: DEFAULT_STS_CONFIG.canvasWidth,
  canvasHeight: DEFAULT_STS_CONFIG.canvasHeight,
  initTimeoutMs: DEFAULT_STS_CONFIG.initTimeoutMs,
  uiFrameUpdateInterval: DEFAULT_STS_CONFIG.uiFrameUpdateInterval,
  prototypeVersion: "cv-neuro-1-shoulder-abduction-reach",
} as const;

/**
 * Patient portal Shoulder Abduction Reach CV detector — bilateral angle
 * tracking via MediaPipe Pose. On-device only, no landmarks or video
 * persisted. Tracks both sides simultaneously (the underlying detector
 * state is inherently bilateral); `primarySide` selects which side's rep
 * count and compensation signal are treated as the reported measurement —
 * both sides' raw results remain available via the frame result.
 */
export class ShoulderAbductionReachPoseDetector {
  private readonly callbacks: ShoulderAbductionReachPoseDetectorCallbacks;
  private readonly primarySide: ShoulderAbductionReachSide;

  private detectorState: ShoulderAbductionReachDetectorState =
    createShoulderAbductionReachDetectorState();
  private compensationState: ShoulderAbductionReachCompensationState =
    createShoulderAbductionReachCompensationState();

  private animFrameId = 0;
  private stream: MediaStream | null = null;
  private poseLandmarker: PoseLandmarkerInstance | null = null;
  private sessionEpoch = 0;
  private previewActive = false;
  private initPhase: SitToStandInitPhase = null;
  private trackingError: string | null = null;
  private detectTimestamp = 0;
  private videoPauseHandler: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;

  private frameIndex = 0;
  private sessionStartMs = 0;
  private framesWithPose = 0;
  private framesTotal = 0;
  private consecutiveNoLandmarkFrames = 0;
  private trackerWasLost = false;
  private lastFrameResult: ShoulderAbductionReachFrameResult | null = null;
  private lastBodyFramingState: BodyFramingState = "checking";
  private lastPrimaryWristNormalized: { x: number; y: number } | null = null;

  constructor(
    callbacks: ShoulderAbductionReachPoseDetectorCallbacks,
    primarySide: ShoulderAbductionReachSide = "right",
  ) {
    this.callbacks = callbacks;
    this.primarySide = primarySide;
  }

  private primaryResult(result: ShoulderAbductionReachFrameResult) {
    return this.primarySide === "left" ? result.left : result.right;
  }

  private computeTrackingQuality(): ShoulderAbductionReachTrackingQuality {
    if (this.framesTotal === 0) return "unknown";
    const ratio = this.framesWithPose / this.framesTotal;
    if (ratio >= 0.85) return "good";
    if (ratio >= 0.5) return "fair";
    return "poor";
  }

  getSnapshot(): ShoulderAbductionReachPoseDetectorSnapshot {
    const result = this.lastFrameResult;
    const primary = result ? this.primaryResult(result) : null;
    return {
      trackingStatus: this.trackingError
        ? "error"
        : this.trackerWasLost
          ? "lost"
          : this.previewActive
            ? "tracking"
            : "idle",
      trackingQuality: this.computeTrackingQuality(),
      bodyFramingState: this.lastBodyFramingState,
      primarySide: this.primarySide,
      primaryPhase: primary?.phase ?? "resting",
      primaryRepCount: primary?.repCount ?? 0,
      primaryPeakAngleDegrees: primary?.peakAngleDegrees ?? null,
      bilateralAngleDifferenceDegrees: result?.bilateralAngleDifferenceDegrees ?? null,
      compensationFlagged: this.compensationState.flagged,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      initPhase: this.initPhase,
      previewActive: this.previewActive,
      trackingError: this.trackingError,
      primaryWristNormalized: this.lastPrimaryWristNormalized,
    };
  }

  getDerivedMetrics(): ShoulderAbductionReachDerivedMetrics {
    const sessionDurationS =
      this.sessionStartMs > 0 ? Math.round((performance.now() - this.sessionStartMs) / 1_000) : 0;
    const primary = this.lastFrameResult ? this.primaryResult(this.lastFrameResult) : null;
    return {
      exerciseId: "shoulder-abduction-reach",
      primarySide: this.primarySide,
      repCount: primary?.repCount ?? 0,
      sessionDurationS,
      trackingQuality: this.computeTrackingQuality(),
      movementDetected: (primary?.repCount ?? 0) > 0,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
    };
  }

  canSaveMetrics(): boolean {
    return this.getDerivedMetrics().sessionDurationS >= MIN_SAVE_DURATION_S;
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.getSnapshot());
  }

  /**
   * Process one already-detected landmark array. Split out from the capture
   * loop so frame-processing logic is exercised the same way whether
   * landmarks arrive from a live camera or (in tests) a synthetic sequence.
   */
  private processFrame(landmarks: PoseLandmark[] | null, capturedAtMs: number): void {
    this.framesTotal += 1;

    if (!landmarks) {
      this.consecutiveNoLandmarkFrames += 1;
      if (!this.trackerWasLost && this.consecutiveNoLandmarkFrames >= TRACKER_LOST_CONSECUTIVE_FRAMES) {
        this.trackerWasLost = true;
        this.callbacks.onMeasuredEvent?.({ type: "trackerLost", capturedAtMs });
      }
      return;
    }

    this.framesWithPose += 1;
    this.consecutiveNoLandmarkFrames = 0;
    if (this.trackerWasLost) {
      this.trackerWasLost = false;
      this.callbacks.onMeasuredEvent?.({ type: "trackerRecovered", capturedAtMs });
    }

    const context: InputAcquisitionContext = { frameIndex: this.frameIndex, capturedAtMs };
    this.frameIndex += 1;

    const previousPrimaryRepCount = this.lastFrameResult
      ? this.primaryResult(this.lastFrameResult).repCount
      : 0;

    const result = updateShoulderAbductionReachDetector(this.detectorState, landmarks, context);
    this.lastFrameResult = result;

    const primary = this.primaryResult(result);
    if (primary.repCount > previousPrimaryRepCount) {
      this.callbacks.onMeasuredEvent?.({
        type: "repCompleted",
        side: this.primarySide,
        repCount: primary.repCount,
        peakAngleDegrees: primary.peakAngleDegrees,
        capturedAtMs,
      });
    }

    // Compensation signal is computed for the primary side only in this
    // slice — tracking it for the non-primary side too is a documented
    // future extension, not required for one live movement block.
    //
    // The detector above normalizes landmarks internally but does not
    // expose the NormalizedMotionFrame, so it is normalized again here via
    // the same BlazePose adapter — a small duplicated computation, not a
    // second implementation of it.
    const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context);
    if (frame) {
      const wristJointId = SHOULDER_ABDUCTION_REACH_BONUS_JOINTS[this.primarySide].wrist;
      const wristJoint = frame.joints[wristJointId];
      this.lastPrimaryWristNormalized = wristJoint
        ? { x: wristJoint.landmark.x, y: wristJoint.landmark.y }
        : null;

      const wasFlagged = this.compensationState.flagged;
      const status = updateShoulderAbductionReachCompensation(
        this.compensationState,
        frame,
        this.primarySide,
        primary.phase === "resting",
      );
      if (status === "flagged" && !wasFlagged) {
        this.callbacks.onMeasuredEvent?.({
          type: "compensationDetected",
          side: this.primarySide,
          capturedAtMs,
        });
      } else if (status === "clear" && wasFlagged) {
        this.callbacks.onMeasuredEvent?.({
          type: "compensationCleared",
          side: this.primarySide,
          capturedAtMs,
        });
      }
    }
  }

  private detachVideoPauseHandler(): void {
    const video = this.videoEl;
    const handler = this.videoPauseHandler;
    if (video && handler) {
      video.removeEventListener("pause", handler);
    }
    this.videoPauseHandler = null;
  }

  stop(): void {
    this.sessionEpoch += 1;
    this.previewActive = false;
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = 0;
    this.detachVideoPauseHandler();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.poseLandmarker?.close?.();
    this.poseLandmarker = null;
    this.detectTimestamp = 0;
    this.initPhase = null;
    this.trackingError = null;
    this.emit();
  }

  async start(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    const browserError = getSitToStandBrowserSupportError();
    if (browserError) {
      throw new Error(browserError);
    }
    if (needsSitToStandSecureContext()) {
      throw new Error(
        "Camera access requires a secure connection (HTTPS). Open this page over HTTPS and try again.",
      );
    }

    const epoch = this.sessionEpoch + 1;
    this.sessionEpoch = epoch;
    this.videoEl = video;
    this.canvasEl = canvas;
    this.trackingError = null;
    this.initPhase = "import";
    this.previewActive = false;
    this.detectorState = createShoulderAbductionReachDetectorState();
    this.compensationState = createShoulderAbductionReachCompensationState();
    this.frameIndex = 0;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.consecutiveNoLandmarkFrames = 0;
    this.trackerWasLost = false;
    this.lastFrameResult = null;
    this.emit();

    const isCurrent = () => this.sessionEpoch === epoch;

    try {
      const { PoseLandmarker, FilesetResolver } = await withSitToStandTimeout(
        import("@mediapipe/tasks-vision"),
        SHOULDER_ABDUCTION_REACH_POSE_SHELL.initTimeoutMs,
        "Pose library load",
      );
      if (!isCurrent()) return;

      this.initPhase = "model";
      this.emit();

      const filesetResolver = await withSitToStandTimeout(
        FilesetResolver.forVisionTasks(SHOULDER_ABDUCTION_REACH_POSE_SHELL.wasmUrl),
        SHOULDER_ABDUCTION_REACH_POSE_SHELL.initTimeoutMs,
        "Pose runtime load",
      );
      if (!isCurrent()) return;

      const poseLandmarker = await createPoseLandmarker(PoseLandmarker, filesetResolver, {
        ...DEFAULT_STS_CONFIG,
        wasmUrl: SHOULDER_ABDUCTION_REACH_POSE_SHELL.wasmUrl,
        modelUrl: SHOULDER_ABDUCTION_REACH_POSE_SHELL.modelUrl,
        initTimeoutMs: SHOULDER_ABDUCTION_REACH_POSE_SHELL.initTimeoutMs,
      });
      if (!isCurrent()) {
        poseLandmarker.close?.();
        return;
      }
      this.poseLandmarker = poseLandmarker;

      this.initPhase = "camera";
      this.emit();

      await waitForVideoElementLayout(video);
      releaseMediaStream(this.stream, video);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: SHOULDER_ABDUCTION_REACH_POSE_SHELL.canvasWidth },
          height: { ideal: SHOULDER_ABDUCTION_REACH_POSE_SHELL.canvasHeight },
        },
        audio: false,
      });
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;

      video.srcObject = stream;
      this.detachVideoPauseHandler();
      const onVideoPause = () => {
        if (!this.previewActive || video.paused) {
          void video.play().catch(() => undefined);
        }
      };
      this.videoPauseHandler = onVideoPause;
      video.addEventListener("pause", onVideoPause);

      await startVideoPlayback(video);
      if (!isCurrent()) return;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error(PATIENT_CAMERA_NO_FRAMES_ERROR);
      }

      this.previewActive = true;
      this.initPhase = null;
      this.sessionStartMs = performance.now();
      this.emit();

      let consecutiveDetectErrors = 0;
      const { canvasWidth, canvasHeight, uiFrameUpdateInterval } = SHOULDER_ABDUCTION_REACH_POSE_SHELL;

      const detect = () => {
        if (!this.previewActive || !this.videoEl || !this.canvasEl) return;

        const ctx = this.canvasEl.getContext("2d");
        if (!ctx || !this.poseLandmarker) return;

        try {
          if (this.videoEl.paused && this.previewActive) {
            void this.videoEl.play().catch(() => undefined);
          }
          if (this.videoEl.videoWidth === 0 || this.videoEl.videoHeight === 0) {
            this.animFrameId = requestAnimationFrame(detect);
            return;
          }

          this.detectTimestamp = Math.max(this.detectTimestamp + 1, performance.now());
          const nowMs = performance.now();
          const result = this.poseLandmarker.detectForVideo(this.videoEl, this.detectTimestamp);

          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          consecutiveDetectErrors = 0;

          if (result.landmarks && result.landmarks.length > 0) {
            const landmarks = result.landmarks[0] as PoseLandmark[];
            const trackingQuality = this.computeTrackingQuality();
            const framing = evaluateBodyFraming(landmarks, UPPER_LIMB_REACH_FRAMING_PROFILE, {
              checking: false,
              trackingQuality: trackingQuality === "unknown" ? null : trackingQuality,
            });
            this.lastBodyFramingState = framing;
            drawBodyFramingOverlay(ctx, canvasWidth, canvasHeight, framing);
            const poseReadiness: PoseReadiness =
              framing === "checking" ? "checking" : framing === "good_distance" ? "ready" : "not_ready";
            drawPoseLandmarkDots(ctx, landmarks, canvasWidth, canvasHeight, poseReadiness);

            this.processFrame(landmarks, nowMs);
          } else {
            this.processFrame(null, nowMs);
          }
        } catch {
          consecutiveDetectErrors += 1;
          if (consecutiveDetectErrors >= 10) {
            this.trackingError = "Movement tracking could not continue. Please stop and try again.";
            this.emit();
            return;
          }
        }

        if (this.framesTotal % uiFrameUpdateInterval === 0) {
          this.emit();
        }

        this.animFrameId = requestAnimationFrame(detect);
      };

      this.animFrameId = requestAnimationFrame(detect);
    } catch (err) {
      if (!isCurrent()) return;
      this.stop();
      throw err;
    }
  }
}
