/**
 * Shared Sit-to-Stand CV detector (MediaPipe Pose + hip-Y rep FSM).
 * Used by CV Lab today; future patient capture will reuse this module.
 * On-device only — no landmarks or video are persisted.
 */

import {
  DEFAULT_STS_CONFIG,
  type CvTrackingQuality,
  type SitToStandCvConfig,
  type SitToStandDerivedMetrics,
} from "@/app/lib/cv/bio-0-contracts";

export type SitToStandTrackingStatus = "idle" | "detecting" | "pose-found" | "pose-lost";
export type SitToStandTrackingQuality = "good" | "fair" | "poor";
export type SitToStandInitPhase = null | "import" | "model" | "camera";

export type SitToStandDetectorSnapshot = {
  trackingStatus: SitToStandTrackingStatus;
  trackingQuality: SitToStandTrackingQuality | null;
  repCount: number;
  sessionSeconds: number;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
  initPhase: SitToStandInitPhase;
  previewActive: boolean;
  trackingError: string | null;
};

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

type StandPhase = "up" | "down";

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

const IDLE_SNAPSHOT: SitToStandDetectorSnapshot = {
  trackingStatus: "idle",
  trackingQuality: null,
  repCount: 0,
  sessionSeconds: 0,
  movementDetected: false,
  framesWithPose: 0,
  framesTotal: 0,
  initPhase: null,
  previewActive: false,
  trackingError: null,
};

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
      repCount: this.repCount,
      sessionSeconds: this.sessionSeconds,
      movementDetected: this.movementDetected,
      framesWithPose: this.framesWithPose,
      framesTotal: this.framesTotal,
      initPhase: this.initPhase,
      previewActive: this.previewActive,
      trackingError: this.trackingError,
    };
  }

  getDerivedMetrics(): SitToStandDerivedMetrics {
    const quality: CvTrackingQuality = this.trackingQuality ?? "unknown";
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
    this.emit();
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

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
            const hipVis =
              (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
            const quality: SitToStandTrackingQuality =
              hipVis > this.config.visibilityGood
                ? "good"
                : hipVis > this.config.visibilityFair
                  ? "fair"
                  : "poor";
            this.trackingQuality = quality;

            const hipY = ((landmarks[23]?.y ?? 0) + (landmarks[24]?.y ?? 0)) / 2;

            if (hipY < this.config.hipUpThreshold && this.standPhase === "down") {
              this.standPhase = "up";
              this.repCount += 1;
            } else if (hipY > this.config.hipDownThreshold && this.standPhase === "up") {
              this.standPhase = "down";
            }

            for (const idx of this.config.lowerBodyLandmarkIndices) {
              const lm = landmarks[idx];
              if (!lm) continue;
              ctx.beginPath();
              ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, 4, 0, 2 * Math.PI);
              ctx.fillStyle = this.config.landmarkDotColor;
              ctx.fill();
            }
          } else if (this.trackingStatus !== "pose-lost") {
            this.trackingStatus = "pose-lost";
            this.trackingQuality = null;
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
