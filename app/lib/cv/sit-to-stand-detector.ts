/**
 * Shared Sit-to-Stand CV detector (MediaPipe Pose + hip-Y rep FSM).
 * Used by CV Lab today; future patient capture will reuse this module.
 * On-device only — no landmarks or video are persisted.
 */

import {
  DEFAULT_STS_CONFIG,
  type SitToStandCvConfig,
  type SitToStandDerivedMetrics,
} from "@/app/lib/cv/bio-0-contracts";
import {
  emptyVisibilityLabelCounts,
  evaluateTrackingQualityFromHipVisSum,
  summarizeSessionVisibility,
  type VisibilityLabelCounts,
} from "@/app/lib/cv/session-visibility-summary";

export type SitToStandTrackingStatus = "idle" | "detecting" | "pose-found" | "pose-lost";
export type SitToStandTrackingQuality = "good" | "fair" | "poor";
export type SitToStandInitPhase = null | "import" | "model" | "camera";
/** Patient portal pose readiness (CV Lab leaves this as ready). */
export type PoseReadiness = "checking" | "ready" | "partial" | "not_ready";

export type SitToStandDetectorSnapshot = {
  trackingStatus: SitToStandTrackingStatus;
  trackingQuality: SitToStandTrackingQuality | null;
  poseReadiness: PoseReadiness;
  repCount: number;
  sessionSeconds: number;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
  initPhase: SitToStandInitPhase;
  previewActive: boolean;
  trackingError: string | null;
  /** True while collecting seated hip baseline (patient baseline mode only) */
  isBaselineCalibrating: boolean;
};

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

type StandPhase = "up" | "down";

type PoseLandmark = { x: number; y: number; visibility?: number };

/** Shoulder–hip span in normalized frame coords (adapts to camera distance). */
export function computeTorsoSpan(landmarks: PoseLandmark[]): number | null {
  const ls = landmarks[11];
  const rs = landmarks[12];
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return null;

  const shoulderVis = (ls.visibility ?? 0) + (rs.visibility ?? 0);
  const hipVis = (lh.visibility ?? 0) + (rh.visibility ?? 0);
  if (shoulderVis < 0.6 || hipVis < 0.6) return null;

  const shoulderY = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  const span = Math.abs(hipY - shoulderY);
  if (span < 0.08 || span > 0.9) return null;
  return span;
}

export function computeHipMidY(landmarks: PoseLandmark[]): number {
  return ((landmarks[23]?.y ?? 0) + (landmarks[24]?.y ?? 0)) / 2;
}

export function hipsMeetMinVisibility(
  landmarks: PoseLandmark[],
  minPerHip: number,
): boolean {
  const left = landmarks[23]?.visibility ?? 0;
  const right = landmarks[24]?.visibility ?? 0;
  return left >= minPerHip && right >= minPerHip;
}

export function evaluateHipTrackingQuality(
  landmarks: PoseLandmark[],
  visibilityGood: number,
  visibilityFair: number,
): SitToStandTrackingQuality {
  const hipVis = (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
  return evaluateTrackingQualityFromHipVisSum(hipVis, visibilityGood, visibilityFair);
}

/** Classify a single pose frame for mobile readiness (not persisted). */
export function evaluatePoseFrameReadiness(
  landmarks: PoseLandmark[],
  trackingQuality: SitToStandTrackingQuality,
  config: SitToStandCvConfig,
): Exclude<PoseReadiness, "checking"> {
  const minHip = config.minHipVisibility ?? 0.35;
  if (!hipsMeetMinVisibility(landmarks, minHip) || trackingQuality === "poor") {
    return "not_ready";
  }

  const torsoSpan = computeTorsoSpan(landmarks);
  if (torsoSpan === null) {
    return "partial";
  }

  if (trackingQuality === "good") return "ready";
  return "partial";
}

export function formatSitToStandDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function withSitToStandTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error(`${label} timed out. Please check your connection and try again.`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

export function getSitToStandBrowserSupportError(): string | null {
  if (typeof navigator === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not support camera access. Try a current version of Chrome, Edge, or Safari.";
  }
  return null;
}

export function needsSitToStandSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return !window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function mapSitToStandStartError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Camera access was denied. Movement tracking could not start. Please check camera permission and try again.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "The camera is in use by another application. Close other apps and try again.";
    }
  }
  if (err instanceof Error) {
    if (err.message.includes("timed out")) return err.message;
    return err.message;
  }
  return "Movement tracking could not start. Please check camera permission and try again.";
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Camera video could not start."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function startVideoPlayback(video: HTMLVideoElement): Promise<void> {
  await waitForVideoReady(video);
  try {
    await video.play();
  } catch (err) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
    throw err;
  }
}

async function createPoseLandmarker(
  PoseLandmarker: Awaited<typeof import("@mediapipe/tasks-vision")>["PoseLandmarker"],
  fileset: Awaited<
    ReturnType<
      Awaited<typeof import("@mediapipe/tasks-vision")>["FilesetResolver"]["forVisionTasks"]
    >
  >,
  config: SitToStandCvConfig,
): Promise<PoseLandmarkerInstance> {
  const baseOptions = { modelAssetPath: config.modelUrl, delegate: "GPU" as const };
  const options = { baseOptions, runningMode: "VIDEO" as const, numPoses: 1 };
  try {
    return await withSitToStandTimeout(
      PoseLandmarker.createFromOptions(fileset, options),
      config.initTimeoutMs,
      "Pose model load",
    );
  } catch {
    return await withSitToStandTimeout(
      PoseLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...baseOptions, delegate: "CPU" },
      }),
      config.initTimeoutMs,
      "Pose model load",
    );
  }
}

export type SitToStandDetectorCallbacks = {
  onSnapshot: (snapshot: SitToStandDetectorSnapshot) => void;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

const IDLE_SNAPSHOT: SitToStandDetectorSnapshot = {
  trackingStatus: "idle",
  trackingQuality: null,
  poseReadiness: "ready",
  repCount: 0,
  sessionSeconds: 0,
  movementDetected: false,
  framesWithPose: 0,
  framesTotal: 0,
  initPhase: null,
  previewActive: false,
  trackingError: null,
  isBaselineCalibrating: false,
};

const READINESS_COLORS = {
  readyGood: "#1D9E75",
  readyPartial: "#F59E0B",
  notReady: "#9CA3AF",
} as const;

/**
 * Manages MediaPipe pose detection, rep counting, timer, and canvas overlay for Sit-to-Stand.
 */
export class SitToStandDetector {
  private readonly config: SitToStandCvConfig;
  private readonly callbacks: SitToStandDetectorCallbacks;

  private animFrameId = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;
  private poseLandmarker: PoseLandmarkerInstance | null = null;
  private standPhase: StandPhase = "down";
  private sessionEpoch = 0;
  private previewActive = false;
  private repCount = 0;
  private sessionSeconds = 0;
  private trackingQuality: SitToStandTrackingQuality | null = null;
  private framesWithPose = 0;
  private framesTotal = 0;
  private movementDetected = false;
  private trackingStatus: SitToStandTrackingStatus = "idle";
  private initPhase: SitToStandInitPhase = null;
  private trackingError: string | null = null;
  private detectTimestamp = 0;
  private videoPauseHandler: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private baselineSamples: number[] = [];
  private baselineHipY: number | null = null;
  private baselineWindowEndMs = 0;
  private trackingStartedAtMs = 0;
  private lastRepAtMs = 0;
  private isBaselineCalibrating = false;
  private poseReadiness: PoseReadiness = "ready";
  private readinessCheckEndMs = 0;
  /** MQ-SIGNAL-1B: in-memory session visibility (saved summary only; not persisted). */
  private hipVisSamples: number[] = [];
  private visibilityLabelCounts: VisibilityLabelCounts = emptyVisibilityLabelCounts();

  constructor(
    callbacks: SitToStandDetectorCallbacks,
    config: SitToStandCvConfig = DEFAULT_STS_CONFIG,
  ) {
    this.config = config;
    this.callbacks = callbacks;
  }

  getSnapshot(): SitToStandDetectorSnapshot {
    return {
      trackingStatus: this.trackingStatus,
      trackingQuality: this.trackingQuality,
      poseReadiness: this.poseReadiness,
      repCount: this.repCount,
      sessionSeconds: this.sessionSeconds,
      movementDetected: this.movementDetected,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      initPhase: this.initPhase,
      previewActive: this.previewActive,
      trackingError: this.trackingError,
      isBaselineCalibrating: this.isBaselineCalibrating,
    };
  }

  private usesBaselineRepCounting(): boolean {
    return this.config.repCountingMode === "baseline";
  }

  private usesReadiness(): boolean {
    return Boolean(this.config.readinessEnabled);
  }

  private resetBaselineState(): void {
    this.baselineSamples = [];
    this.baselineHipY = null;
    this.baselineWindowEndMs = 0;
    this.trackingStartedAtMs = 0;
    this.lastRepAtMs = 0;
    this.isBaselineCalibrating = false;
    this.readinessCheckEndMs = 0;
    this.poseReadiness = this.usesReadiness() ? "checking" : "ready";
  }

  private canCollectBaseline(): boolean {
    if (!this.usesBaselineRepCounting() || this.baselineHipY !== null) return false;
    if (!this.usesReadiness()) return true;
    return (
      (this.poseReadiness === "ready" || this.poseReadiness === "partial") &&
      this.baselineWindowEndMs > 0
    );
  }

  private canIncrementReps(): boolean {
    if (!this.usesReadiness()) return true;
    if (this.poseReadiness === "checking" || this.poseReadiness === "not_ready") {
      return false;
    }
    if (this.usesBaselineRepCounting() && this.baselineHipY === null) return false;
    return true;
  }

  private maybeStartBaselineWindow(nowMs: number): void {
    if (
      !this.usesBaselineRepCounting() ||
      this.baselineHipY !== null ||
      this.baselineWindowEndMs > 0
    ) {
      return;
    }
    if (this.poseReadiness !== "ready" && this.poseReadiness !== "partial") return;

    const durationMs = this.config.baselineDurationMs ?? 3_000;
    this.baselineWindowEndMs = nowMs + durationMs;
    this.isBaselineCalibrating = true;
  }

  private updatePoseReadiness(nowMs: number, landmarks: PoseLandmark[]): void {
    if (!this.usesReadiness()) {
      this.poseReadiness = "ready";
      return;
    }

    if (nowMs < this.readinessCheckEndMs) {
      this.poseReadiness = "checking";
      return;
    }

    const quality = this.trackingQuality ?? "poor";
    const wasCountingReady =
      this.poseReadiness === "ready" || this.poseReadiness === "partial";
    this.poseReadiness = evaluatePoseFrameReadiness(landmarks, quality, this.config);

    if (!wasCountingReady && (this.poseReadiness === "ready" || this.poseReadiness === "partial")) {
      this.maybeStartBaselineWindow(nowMs);
    }
  }

  private readinessOverlayColor(): string {
    if (this.poseReadiness === "checking" || this.poseReadiness === "not_ready") {
      return READINESS_COLORS.notReady;
    }
    if (this.poseReadiness === "partial") return READINESS_COLORS.readyPartial;
    return READINESS_COLORS.readyGood;
  }

  private drawReadinessSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
  ): void {
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lh = landmarks[23];
    const rh = landmarks[24];
    if (!ls || !rs || !lh || !rh) return;

    const color = this.readinessOverlayColor();
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
  }

  private maybeFinalizeBaseline(nowMs: number): void {
    if (!this.usesBaselineRepCounting() || this.baselineHipY !== null) return;
    if (this.baselineWindowEndMs <= 0 || nowMs < this.baselineWindowEndMs) return;

    const medianY = median(this.baselineSamples);
    this.baselineHipY =
      medianY ?? this.config.fallbackSeatedHipY ?? this.config.hipDownThreshold;
    this.isBaselineCalibrating = false;
  }

  private resolveBaselineDeltas(torsoSpan: number | null): { standDelta: number; resetDelta: number } {
    const fixedStand = this.config.baselineStandDelta ?? 0.09;
    const fixedReset = this.config.baselineResetDelta ?? 0.04;

    if (!this.config.baselineScaleByTorso || torsoSpan === null) {
      return { standDelta: fixedStand, resetDelta: fixedReset };
    }

    const ratioStand = this.config.baselineStandDeltaRatio ?? 0.18;
    const ratioReset = this.config.baselineResetDeltaRatio ?? 0.08;
    const minStand = this.config.baselineStandDeltaMin ?? 0.035;
    const minReset = this.config.baselineResetDeltaMin ?? 0.02;
    const scaledStand = ratioStand * torsoSpan;
    const scaledReset = ratioReset * torsoSpan;

    // Cap at fixed deltas: full-body framing has larger span but smaller absolute hip rise.
    // Without cap, ratio×span can exceed fixedStand and make far framing stricter than close.
    return {
      standDelta: Math.max(minStand, Math.min(fixedStand, scaledStand)),
      resetDelta: Math.max(minReset, Math.min(fixedReset, scaledReset)),
    };
  }

  private updateRepCountFromHipY(hipY: number, nowMs: number, torsoSpan: number | null): void {
    if (this.usesBaselineRepCounting()) {
      this.maybeFinalizeBaseline(nowMs);
      if (this.baselineHipY === null) {
        if (this.canCollectBaseline()) {
          this.baselineSamples.push(hipY);
        }
        return;
      }

      if (!this.canIncrementReps()) return;

      const { standDelta, resetDelta } = this.resolveBaselineDeltas(torsoSpan);
      const minMs = this.config.minMsBetweenReps ?? 900;
      const standThreshold = this.baselineHipY - standDelta;
      const seatedThreshold = this.baselineHipY - resetDelta;

      if (
        hipY < standThreshold &&
        this.standPhase === "down" &&
        nowMs - this.lastRepAtMs >= minMs
      ) {
        this.standPhase = "up";
        this.repCount += 1;
        this.lastRepAtMs = nowMs;
      } else if (hipY > seatedThreshold && this.standPhase === "up") {
        this.standPhase = "down";
      }
      return;
    }

    if (hipY < this.config.hipUpThreshold && this.standPhase === "down") {
      this.standPhase = "up";
      this.repCount += 1;
    } else if (hipY > this.config.hipDownThreshold && this.standPhase === "up") {
      this.standPhase = "down";
    }
  }

  getDerivedMetrics(): SitToStandDerivedMetrics {
    const quality = summarizeSessionVisibility({
      hipVisSamples: this.hipVisSamples,
      labelCounts: this.visibilityLabelCounts,
      framesWithPose: this.framesWithPose,
      visibilityGood: this.config.visibilityGood,
      visibilityFair: this.config.visibilityFair,
    });
    return {
      exerciseId: "sit-to-stand",
      repCount: this.repCount,
      sessionDurationS: this.sessionSeconds,
      trackingQuality: quality,
      movementDetected: this.framesWithPose > 0,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
    };
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  canSaveMetrics(): boolean {
    return this.sessionSeconds >= this.config.minSaveDurationS;
  }

  resetReps(): void {
    this.repCount = 0;
    this.standPhase = "down";
    this.lastRepAtMs = 0;
    this.emit();
  }

  private resetVisibilityAccumulators(): void {
    this.hipVisSamples = [];
    this.visibilityLabelCounts = emptyVisibilityLabelCounts();
  }

  private recordVisibilityFrame(landmarks: PoseLandmark[]): void {
    const hipVisSum = (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
    const frameLabel = evaluateHipTrackingQuality(
      landmarks,
      this.config.visibilityGood,
      this.config.visibilityFair,
    );
    this.hipVisSamples.push(hipVisSum);
    this.visibilityLabelCounts[frameLabel] += 1;
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
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.detachVideoPauseHandler();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    this.poseLandmarker?.close?.();
    this.poseLandmarker = null;
    this.detectTimestamp = 0;
    this.trackingStatus = "idle";
    this.trackingQuality = null;
    this.initPhase = null;
    this.trackingError = null;
    this.resetBaselineState();
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

    this.repCount = 0;
    this.standPhase = "down";
    this.sessionSeconds = 0;
    this.movementDetected = false;
    this.framesWithPose = 0;
    this.framesTotal = 0;
    this.trackingQuality = null;
    this.trackingError = null;
    this.trackingStatus = "detecting";
    this.initPhase = "import";
    this.previewActive = false;
    this.resetVisibilityAccumulators();
    this.resetBaselineState();
    this.emit();

    const isCurrent = () => this.sessionEpoch === epoch;

    try {
      const { PoseLandmarker, FilesetResolver } = await withSitToStandTimeout(
        import("@mediapipe/tasks-vision"),
        this.config.initTimeoutMs,
        "Pose library load",
      );
      if (!isCurrent()) return;

      this.initPhase = "model";
      this.emit();

      const filesetResolver = await withSitToStandTimeout(
        FilesetResolver.forVisionTasks(this.config.wasmUrl),
        this.config.initTimeoutMs,
        "Pose runtime load",
      );
      if (!isCurrent()) return;

      const poseLandmarker = await createPoseLandmarker(PoseLandmarker, filesetResolver, this.config);
      if (!isCurrent()) {
        poseLandmarker.close?.();
        return;
      }
      this.poseLandmarker = poseLandmarker;

      this.initPhase = "camera";
      this.emit();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: this.usesReadiness()
          ? {
              facingMode: { ideal: "user" },
              width: { ideal: this.config.canvasWidth },
              height: { ideal: this.config.canvasHeight },
            }
          : true,
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
      this.trackingStartedAtMs = performance.now();
      if (this.usesReadiness()) {
        const checkMs = this.config.readinessCheckMs ?? 2_000;
        this.readinessCheckEndMs = this.trackingStartedAtMs + checkMs;
        this.poseReadiness = "checking";
      } else if (this.usesBaselineRepCounting()) {
        const durationMs = this.config.baselineDurationMs ?? 2_000;
        this.baselineWindowEndMs = this.trackingStartedAtMs + durationMs;
        this.isBaselineCalibrating = true;
      }
      this.emit();

      this.timerId = setInterval(() => {
        this.sessionSeconds += 1;
        this.emit();
      }, 1000);

      let consecutiveDetectErrors = 0;
      const { canvasWidth, canvasHeight, uiFrameUpdateInterval } = this.config;

      const detect = () => {
        if (!this.previewActive || !this.videoEl || !this.canvasEl) return;

        const ctx = this.canvasEl.getContext("2d");
        if (!ctx || !this.poseLandmarker) return;

        this.framesTotal += 1;

        try {
          if (this.videoEl.paused && this.previewActive) {
            void this.videoEl.play().catch(() => undefined);
          }

          this.detectTimestamp = Math.max(this.detectTimestamp + 1, performance.now());

          const result = this.poseLandmarker.detectForVideo(
            this.videoEl,
            this.detectTimestamp,
          );

          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(this.videoEl, 0, 0, canvasWidth, canvasHeight);

          consecutiveDetectErrors = 0;

          if (result.landmarks && result.landmarks.length > 0) {
            if (this.trackingStatus !== "pose-found") {
              this.trackingStatus = "pose-found";
            }
            this.framesWithPose += 1;
            this.movementDetected = true;

            const landmarks = result.landmarks[0];
            this.trackingQuality = evaluateHipTrackingQuality(
              landmarks,
              this.config.visibilityGood,
              this.config.visibilityFair,
            );
            this.recordVisibilityFrame(landmarks);

            const hipY = computeHipMidY(landmarks);
            const torsoSpan = computeTorsoSpan(landmarks);
            const nowMs = performance.now();
            this.updatePoseReadiness(nowMs, landmarks);
            this.updateRepCountFromHipY(hipY, nowMs, torsoSpan);

            if (this.config.readinessEnabled) {
              this.drawReadinessSkeleton(ctx, landmarks, canvasWidth, canvasHeight);
            } else {
              for (const idx of this.config.lowerBodyLandmarkIndices) {
                const lm = landmarks[idx];
                if (!lm) continue;
                ctx.beginPath();
                ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 4, 0, 2 * Math.PI);
                ctx.fillStyle = this.config.landmarkDotColor;
                ctx.fill();
              }
            }
          } else if (this.trackingStatus !== "pose-lost") {
            this.trackingStatus = "pose-lost";
            this.trackingQuality = null;
            if (this.usesReadiness()) {
              this.poseReadiness = "not_ready";
            }
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

export { IDLE_SNAPSHOT };
