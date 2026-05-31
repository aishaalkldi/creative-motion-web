/**
 * Patient portal Single-Leg Stance CV detector — hold duration via MediaPipe Pose.
 * On-device only — no landmarks or video are persisted.
 */

import type { SingleLegStanceDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import {
  PATIENT_SLS_HOLD_CONFIG,
  PATIENT_SLS_POSE_SHELL,
} from "@/app/lib/cv/cv-patient-config";
import {
  drawBodyFramingOverlay,
  type BodyFramingState,
} from "@/app/lib/cv/body-framing-evaluator";
import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";
import {
  SingleLegStanceHoldDetector,
  type SingleLegStanceHoldConfig,
  type StanceLeg,
} from "@/app/lib/cv/single-leg-stance-detector";
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

export type SingleLegStancePoseDetectorSnapshot = SitToStandDetectorSnapshot;

export {
  formatSitToStandDuration as formatSingleLegStanceDuration,
  mapSitToStandStartError as mapSingleLegStanceStartError,
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

export type SingleLegStancePoseDetectorCallbacks = {
  onSnapshot: (snapshot: SingleLegStancePoseDetectorSnapshot) => void;
};

const READINESS_COLORS = {
  readyGood: "#1D9E75",
  readyPartial: "#F59E0B",
  notReady: "#9CA3AF",
} as const;

/**
 * Patient single-leg stance detector — MediaPipe shell + hold FSM engine.
 */
export class SingleLegStancePoseDetector {
  private readonly callbacks: SingleLegStancePoseDetectorCallbacks;
  private readonly shellConfig: typeof PATIENT_SLS_POSE_SHELL;
  private readonly holdConfig: SingleLegStanceHoldConfig;
  private readonly holdEngine: SingleLegStanceHoldDetector;

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

  constructor(
    callbacks: SingleLegStancePoseDetectorCallbacks,
    stanceLeg: StanceLeg,
    holdConfig: SingleLegStanceHoldConfig = PATIENT_SLS_HOLD_CONFIG,
    shellConfig: typeof PATIENT_SLS_POSE_SHELL = PATIENT_SLS_POSE_SHELL,
  ) {
    this.callbacks = callbacks;
    this.holdConfig = holdConfig;
    this.shellConfig = shellConfig;
    this.holdEngine = new SingleLegStanceHoldDetector(holdConfig, {
      stanceLeg,
      useReadinessGates: true,
    });
  }

  getSnapshot(): SingleLegStancePoseDetectorSnapshot {
    const hold = this.holdEngine.getSnapshot();
    const holdSeconds = Math.round(hold.accumulatedHoldMs / 1_000);
    return {
      trackingStatus: hold.trackingStatus,
      trackingQuality: hold.trackingQuality,
      poseReadiness: hold.poseReadiness,
      bodyFramingState: hold.bodyFramingState,
      repCount: 0,
      sessionSeconds: holdSeconds,
      movementDetected: hold.movementDetected,
      framesWithPose: hold.framesWithPose,
      framesTotal: hold.framesTotal,
      initPhase: this.initPhase,
      previewActive: this.previewActive,
      trackingError: this.trackingError,
      isBaselineCalibrating: hold.isBaselineCalibrating,
    };
  }

  getDerivedMetrics(): SingleLegStanceDerivedMetrics {
    const metrics = this.holdEngine.getDerivedMetrics();
    return {
      exerciseId: "single-leg-stance",
      repCount: 0,
      sessionDurationS: metrics.sessionDurationS,
      trackingQuality: metrics.trackingQuality,
      movementDetected: metrics.movementDetected,
      framesWithPose: metrics.framesWithPose,
      framesTotal: metrics.framesTotal,
    };
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  canSaveMetrics(): boolean {
    return this.getDerivedMetrics().sessionDurationS >= this.holdConfig.minSaveHoldS;
  }

  private readinessOverlayColor(poseReadiness: PoseReadiness): string {
    if (poseReadiness === "checking" || poseReadiness === "not_ready") {
      return READINESS_COLORS.notReady;
    }
    if (poseReadiness === "partial") return READINESS_COLORS.readyPartial;
    return READINESS_COLORS.readyGood;
  }

  private drawReadinessSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    poseReadiness: PoseReadiness,
  ): void {
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lh = landmarks[23];
    const rh = landmarks[24];
    const lk = landmarks[25];
    const rk = landmarks[26];
    const la = landmarks[27];
    const ra = landmarks[28];
    if (!ls || !rs || !lh || !rh) return;

    const color = this.readinessOverlayColor(poseReadiness);
    const shoulderX = ((ls.x + rs.x) / 2) * width;
    const shoulderY = ((ls.y + rs.y) / 2) * height;
    const hipX = ((lh.x + rh.x) / 2) * width;
    const hipY = ((lh.y + rh.y) / 2) * height;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    const dot = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    };

    dot(ls.x * width, ls.y * height);
    dot(rs.x * width, rs.y * height);
    dot(lh.x * width, lh.y * height);
    dot(rh.x * width, rh.y * height);
    if (lk) dot(lk.x * width, lk.y * height);
    if (rk) dot(rk.x * width, rk.y * height);
    if (la) dot(la.x * width, la.y * height);
    if (ra) dot(ra.x * width, ra.y * height);
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
    this.holdEngine.endSession();
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
    this.holdEngine.reset();
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

      this.previewActive = true;
      this.initPhase = null;
      this.holdEngine.startSession(performance.now());
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

          this.detectTimestamp = Math.max(this.detectTimestamp + 1, performance.now());
          const nowMs = performance.now();

          const result = this.poseLandmarker.detectForVideo(this.videoEl, this.detectTimestamp);

          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(this.videoEl, 0, 0, canvasWidth, canvasHeight);

          consecutiveDetectErrors = 0;

          if (result.landmarks && result.landmarks.length > 0) {
            const landmarks = result.landmarks[0] as PoseLandmark[];
            this.holdEngine.driveFrame(landmarks, nowMs);

            const holdSnap = this.holdEngine.getSnapshot();
            drawBodyFramingOverlay(ctx, canvasWidth, canvasHeight, holdSnap.bodyFramingState);
            this.drawReadinessSkeleton(
              ctx,
              landmarks,
              canvasWidth,
              canvasHeight,
              holdSnap.poseReadiness,
            );
          } else {
            this.holdEngine.driveFrame(null, nowMs);
          }
        } catch {
          consecutiveDetectErrors += 1;
          if (consecutiveDetectErrors >= 10) {
            this.trackingError =
              "Hold tracking could not continue. Please stop and try again.";
            this.emit();
            return;
          }
        }

        const hold = this.holdEngine.getSnapshot();
        if (hold.framesTotal % uiFrameUpdateInterval === 0) {
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
