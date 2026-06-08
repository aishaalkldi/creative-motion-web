/**
 * Patient portal Step Up CV detector — rep counting via MediaPipe Pose.
 * On-device only — no landmarks or video are persisted.
 */

import type { StepUpDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { DEFAULT_STS_CONFIG, type CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import {
  PATIENT_STEP_UP_POSE_SHELL,
  PATIENT_STEP_UP_READINESS_MS,
  PATIENT_STEP_UP_REP_CONFIG,
} from "@/app/lib/cv/cv-patient-config";
import {
  drawBodyFramingOverlay,
  evaluateBodyFraming,
  type BodyFramingState,
} from "@/app/lib/cv/body-framing-evaluator";
import { STANDING_SAGITTAL_REP_FRAMING_PROFILE } from "@/app/lib/cv/body-framing-profiles";
import { drawPoseLandmarkDots } from "@/app/lib/cv/pose-landmark-overlay";
import {
  StepUpDetector,
  evaluateHipTrackingQuality,
  type StepUpRepConfig,
} from "@/app/lib/cv/step-up-detector";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";
import { stepUpStandPhaseFromRepPhase } from "@/app/lib/cv/step-up-stand-phase";
import {
  PATIENT_CAMERA_NO_FRAMES_ERROR,
  releaseMediaStream,
  waitForVideoElementLayout,
} from "@/app/lib/cv/patient-camera-stream";
import {
  createPoseLandmarker,
  formatSitToStandDuration,
  getSitToStandBrowserSupportError,
  mapSitToStandStartError,
  needsSitToStandSecureContext,
  startVideoPlayback,
  withSitToStandTimeout,
  type PoseReadiness,
  type SitToStandDetectorSnapshot,
  type SitToStandInitPhase,
  type SitToStandTrackingQuality,
  type SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

export type StepUpPoseDetectorSnapshot = SitToStandDetectorSnapshot;

export {
  formatSitToStandDuration as formatStepUpDuration,
  mapSitToStandStartError as mapStepUpStartError,
};

export type {
  BodyFramingState,
  PoseReadiness,
  SitToStandInitPhase,
  SitToStandTrackingQuality,
  SitToStandTrackingStatus,
};

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

export type StepUpPoseDetectorCallbacks = {
  onSnapshot: (snapshot: StepUpPoseDetectorSnapshot) => void;
};

function mapFramingToPoseReadiness(
  framingState: BodyFramingState,
  quality: SitToStandTrackingQuality | null,
): PoseReadiness {
  if (framingState === "checking") return "checking";
  if (framingState === "good_distance") return "ready";
  if (framingState === "low_visibility" && quality === "fair") return "partial";
  return "not_ready";
}

function mapEngineTrackingStatus(
  status: "idle" | "detecting" | "pose-found" | "pose-lost",
): SitToStandTrackingStatus {
  return status;
}

function normalizeTrackingQuality(
  quality: CvTrackingQuality | null,
): SitToStandTrackingQuality | null {
  if (!quality) return null;
  if (quality === "unknown") return "poor";
  return quality;
}

/**
 * Patient step up detector — MediaPipe shell + ankle-rise rep engine.
 */
export class StepUpPoseDetector {
  private readonly callbacks: StepUpPoseDetectorCallbacks;
  private readonly shellConfig: typeof PATIENT_STEP_UP_POSE_SHELL;
  private readonly repConfig: StepUpRepConfig;
  private readonly repEngine: StepUpDetector;

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

  private readinessCheckEndMs = 0;
  private repEngineStarted = false;
  private poseReadiness: PoseReadiness = "checking";
  private bodyFramingState: BodyFramingState = "checking";
  private trackingQuality: SitToStandTrackingQuality | null = null;
  private trackingStatus: SitToStandTrackingStatus = "idle";

  constructor(
    callbacks: StepUpPoseDetectorCallbacks,
    repConfig: StepUpRepConfig = PATIENT_STEP_UP_REP_CONFIG,
    shellConfig: typeof PATIENT_STEP_UP_POSE_SHELL = PATIENT_STEP_UP_POSE_SHELL,
  ) {
    this.callbacks = callbacks;
    this.repConfig = repConfig;
    this.shellConfig = shellConfig;
    this.repEngine = new StepUpDetector(repConfig);
  }

  getSnapshot(): StepUpPoseDetectorSnapshot {
    const engine = this.repEngine.getSnapshot();
    const standPhase = stepUpStandPhaseFromRepPhase(engine.repPhase);
    return {
      trackingStatus: this.repEngineStarted
        ? mapEngineTrackingStatus(engine.trackingStatus)
        : this.trackingStatus,
      trackingQuality: this.repEngineStarted
        ? normalizeTrackingQuality(engine.trackingQuality)
        : this.trackingQuality,
      poseReadiness: this.poseReadiness,
      bodyFramingState: this.repEngineStarted ? engine.bodyFramingState : this.bodyFramingState,
      repCount: engine.repCount,
      standPhase,
      sessionSeconds: engine.sessionSeconds,
      movementDetected: engine.movementDetected,
      framesWithPose: engine.framesWithPose,
      framesTotal: engine.framesTotal,
      initPhase: this.initPhase,
      previewActive: this.previewActive,
      trackingError: this.trackingError,
      isBaselineCalibrating: engine.isBaselineCalibrating,
    };
  }

  getDerivedMetrics(): StepUpDerivedMetrics {
    return this.repEngine.getDerivedMetrics();
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  canSaveMetrics(): boolean {
    return this.repEngine.canSaveMetrics();
  }

  private updateReadinessFromLandmarks(landmarks: PoseLandmark[], nowMs: number): void {
    if (nowMs < this.readinessCheckEndMs) {
      this.poseReadiness = "checking";
      this.bodyFramingState = "checking";
      this.trackingStatus = "detecting";
      return;
    }

    const quality = evaluateHipTrackingQuality(
      landmarks,
      this.repConfig.visibilityGood,
      this.repConfig.visibilityFair,
    );
    this.trackingQuality = quality === "unknown" ? "poor" : quality;
    this.bodyFramingState = evaluateBodyFraming(
      landmarks,
      STANDING_SAGITTAL_REP_FRAMING_PROFILE,
      {
        checking: false,
        trackingQuality: quality === "unknown" ? null : quality,
      },
    );
    this.poseReadiness = mapFramingToPoseReadiness(this.bodyFramingState, this.trackingQuality);
    this.trackingStatus = "pose-found";
  }

  private maybeStartRepEngine(nowMs: number): void {
    if (this.repEngineStarted) return;
    if (nowMs < this.readinessCheckEndMs) return;
    if (this.poseReadiness !== "ready" && this.poseReadiness !== "partial") return;

    this.repEngine.reset();
    this.repEngineStarted = true;
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.getSnapshot());
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
    if (this.repEngineStarted) {
      this.repEngine.endSession(performance.now());
    }
    this.repEngineStarted = false;
    this.readinessCheckEndMs = 0;
    this.poseReadiness = "checking";
    this.bodyFramingState = "checking";
    this.trackingQuality = null;
    this.trackingStatus = "idle";
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
    this.repEngine.reset();
    this.repEngineStarted = false;
    this.readinessCheckEndMs = 0;
    this.poseReadiness = "checking";
    this.bodyFramingState = "checking";
    this.trackingQuality = null;
    this.trackingStatus = "idle";
    this.emit();

    const isCurrent = () => this.sessionEpoch === epoch;

    try {
      const { PoseLandmarker, FilesetResolver } = await withSitToStandTimeout(
        import("@mediapipe/tasks-vision"),
        this.shellConfig.initTimeoutMs,
        "Pose library load",
      );
      if (!isCurrent()) return;

      this.initPhase = "model";
      this.emit();

      const filesetResolver = await withSitToStandTimeout(
        FilesetResolver.forVisionTasks(this.shellConfig.wasmUrl),
        this.shellConfig.initTimeoutMs,
        "Pose runtime load",
      );
      if (!isCurrent()) return;

      const poseLandmarker = await createPoseLandmarker(
        PoseLandmarker,
        filesetResolver,
        {
          ...DEFAULT_STS_CONFIG,
          wasmUrl: this.shellConfig.wasmUrl,
          modelUrl: this.shellConfig.modelUrl,
          initTimeoutMs: this.shellConfig.initTimeoutMs,
        },
      );
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
          width: { ideal: this.shellConfig.canvasWidth },
          height: { ideal: this.shellConfig.canvasHeight },
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
      this.readinessCheckEndMs = performance.now() + PATIENT_STEP_UP_READINESS_MS;
      this.emit();

      let consecutiveDetectErrors = 0;
      const { canvasWidth, canvasHeight, uiFrameUpdateInterval } = this.shellConfig;

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
          if (!this.shellConfig.landmarksOverlayOnly) {
            ctx.drawImage(this.videoEl, 0, 0, canvasWidth, canvasHeight);
          }

          consecutiveDetectErrors = 0;

          if (result.landmarks && result.landmarks.length > 0) {
            const landmarks = result.landmarks[0] as PoseLandmark[];
            this.updateReadinessFromLandmarks(landmarks, nowMs);
            this.maybeStartRepEngine(nowMs);
            if (this.repEngineStarted) {
              this.repEngine.driveFrame(landmarks, nowMs);
            }

            const snap = this.getSnapshot();
            drawBodyFramingOverlay(ctx, canvasWidth, canvasHeight, snap.bodyFramingState);
            drawPoseLandmarkDots(
              ctx,
              landmarks,
              canvasWidth,
              canvasHeight,
              snap.poseReadiness,
            );
          } else {
            this.poseReadiness = "not_ready";
            this.bodyFramingState = "low_visibility";
            this.trackingStatus = "pose-lost";
            this.trackingQuality = "poor";
          }
        } catch {
          consecutiveDetectErrors += 1;
          if (consecutiveDetectErrors >= 10) {
            this.trackingError =
              "Movement tracking could not continue. Please stop and try again.";
            this.emit();
            return;
          }
        }

        const engineSnap = this.repEngine.getSnapshot();
        if (engineSnap.framesTotal % uiFrameUpdateInterval === 0) {
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
