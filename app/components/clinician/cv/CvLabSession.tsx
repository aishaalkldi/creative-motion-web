"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const INIT_TIMEOUT_MS = 45_000;
const UI_FRAME_UPDATE_INTERVAL = 15;

const LOWER_BODY_LANDMARKS = [23, 24, 25, 26, 27, 28] as const;

type TrackingStatus = "idle" | "detecting" | "pose-found" | "pose-lost";
type TrackingQuality = "good" | "fair" | "poor";
type StandPhase = "up" | "down";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type InitPhase = null | "import" | "model" | "camera";

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

export type CvLabSessionProps = {
  patientId?: string;
  planId?: string;
  planSessionId?: string;
  onSessionSaved?: () => void;
};

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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

function getBrowserSupportError(): string | null {
  if (typeof navigator === "undefined") return null;
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not support camera access. Try a current version of Chrome, Edge, or Safari.";
  }
  return null;
}

function needsSecureContextMessage(): boolean {
  if (typeof window === "undefined") return false;
  return !window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function mapStartError(err: unknown): string {
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
  fileset: Awaited<ReturnType<Awaited<typeof import("@mediapipe/tasks-vision")>["FilesetResolver"]["forVisionTasks"]>>,
): Promise<PoseLandmarkerInstance> {
  const baseOptions = { modelAssetPath: MODEL_URL, delegate: "GPU" as const };
  const options = { baseOptions, runningMode: "VIDEO" as const, numPoses: 1 };
  try {
    return await withTimeout(
      PoseLandmarker.createFromOptions(fileset, options),
      INIT_TIMEOUT_MS,
      "Pose model load",
    );
  } catch {
    return await withTimeout(
      PoseLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...baseOptions, delegate: "CPU" },
      }),
      INIT_TIMEOUT_MS,
      "Pose model load",
    );
  }
}

export function CvLabSession({
  patientId,
  planId,
  planSessionId,
  onSessionSaved,
}: CvLabSessionProps = {}) {
  const [consented, setConsented] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initPhase, setInitPhase] = useState<InitPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  const [trackingQuality, setTrackingQuality] = useState<TrackingQuality | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [movementDetected, setMovementDetected] = useState(false);
  const [framesWithPose, setFramesWithPose] = useState(0);
  const [framesTotal, setFramesTotal] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerInstance | null>(null);
  const standPhaseRef = useRef<StandPhase>("down");
  const previewActiveRef = useRef(false);
  const repCountRef = useRef(0);
  const sessionSecondsRef = useRef(0);
  const trackingQualityRef = useRef<TrackingQuality | null>(null);
  const framesWithPoseRef = useRef(0);
  const framesTotalRef = useRef(0);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInProgressRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const sessionEpochRef = useRef(0);
  const detectTimestampRef = useRef(0);
  const trackingStatusRef = useRef<TrackingStatus>("idle");
  const onSessionSavedRef = useRef(onSessionSaved);
  const videoPauseHandlerRef = useRef<(() => void) | null>(null);

  onSessionSavedRef.current = onSessionSaved;

  const clearSaveStatusTimer = useCallback(() => {
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }
  }, []);

  const scheduleSaveStatusClear = useCallback(() => {
    clearSaveStatusTimer();
    saveStatusTimerRef.current = setTimeout(() => {
      setSaveStatus("idle");
    }, 4000);
  }, [clearSaveStatusTimer]);

  const detachVideoPauseHandler = useCallback(() => {
    const video = videoRef.current;
    const handler = videoPauseHandlerRef.current;
    if (video && handler) {
      video.removeEventListener("pause", handler);
    }
    videoPauseHandlerRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    sessionEpochRef.current += 1;
    previewActiveRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = 0;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    detachVideoPauseHandler();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    poseLandmarkerRef.current?.close?.();
    poseLandmarkerRef.current = null;
    detectTimestampRef.current = 0;
    setPreviewActive(false);
    setTrackingStatus("idle");
    trackingStatusRef.current = "idle";
    setTrackingQuality(null);
    setLoading(false);
    setInitPhase(null);
    setTrackingError(null);
  }, [detachVideoPauseHandler]);

  const saveSessionMetrics = useCallback(async () => {
    if (saveInProgressRef.current) return;

    const duration = sessionSecondsRef.current;
    if (duration < 3) return;

    saveInProgressRef.current = true;
    setSaveStatus("saving");

    const payload = {
      exerciseId: "sit-to-stand",
      repCount: repCountRef.current,
      sessionDurationS: duration,
      trackingQuality: trackingQualityRef.current ?? "unknown",
      movementDetected: framesWithPoseRef.current > 0,
      framesWithPose: framesWithPoseRef.current,
      framesTotal: framesTotalRef.current,
      source: "cv_lab",
      ...(patientId ? { patientId } : {}),
      ...(planId ? { planId } : {}),
      ...(planSessionId ? { planSessionId } : {}),
    };

    try {
      const res = await fetch("/api/cv/session-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setSaveStatus("error");
        scheduleSaveStatusClear();
        return;
      }

      setSaveStatus("saved");
      scheduleSaveStatusClear();
      onSessionSavedRef.current?.();
    } catch {
      setSaveStatus("error");
      scheduleSaveStatusClear();
    } finally {
      saveInProgressRef.current = false;
    }
  }, [patientId, planId, planSessionId, scheduleSaveStatusClear]);

  const handleStopSession = useCallback(() => {
    if (stopInProgressRef.current || !previewActiveRef.current) return;

    stopInProgressRef.current = true;
    stopCamera();
    void saveSessionMetrics().finally(() => {
      stopInProgressRef.current = false;
    });
  }, [stopCamera, saveSessionMetrics]);

  useEffect(() => {
    return () => {
      stopCamera();
      clearSaveStatusTimer();
    };
  }, [stopCamera, clearSaveStatusTimer]);

  const startSession = useCallback(async () => {
    if (!consented || startInProgressRef.current || loading || previewActiveRef.current) {
      return;
    }

    const browserError = getBrowserSupportError();
    if (browserError) {
      setError(browserError);
      return;
    }
    if (needsSecureContextMessage()) {
      setError("Camera access requires a secure connection (HTTPS). Open this page over HTTPS and try again.");
      return;
    }

    const epoch = sessionEpochRef.current + 1;
    sessionEpochRef.current = epoch;
    startInProgressRef.current = true;
    setError(null);
    setTrackingError(null);
    setLoading(true);
    setInitPhase("import");
    setRepCount(0);
    repCountRef.current = 0;
    standPhaseRef.current = "down";
    setSessionSeconds(0);
    sessionSecondsRef.current = 0;
    setSessionStarted(true);
    setTrackingStatus("detecting");
    trackingStatusRef.current = "detecting";
    setMovementDetected(false);
    setFramesWithPose(0);
    setFramesTotal(0);
    framesWithPoseRef.current = 0;
    framesTotalRef.current = 0;
    trackingQualityRef.current = null;
    setSaveStatus("idle");
    clearSaveStatusTimer();

    const isCurrentSession = () => sessionEpochRef.current === epoch;

    try {
      const { PoseLandmarker, FilesetResolver } = await withTimeout(
        import("@mediapipe/tasks-vision"),
        INIT_TIMEOUT_MS,
        "Pose library load",
      );
      if (!isCurrentSession()) return;

      setInitPhase("model");
      const filesetResolver = await withTimeout(
        FilesetResolver.forVisionTasks(WASM_URL),
        INIT_TIMEOUT_MS,
        "Pose runtime load",
      );
      if (!isCurrentSession()) return;

      const poseLandmarker = await createPoseLandmarker(PoseLandmarker, filesetResolver);
      if (!isCurrentSession()) {
        poseLandmarker.close?.();
        return;
      }
      poseLandmarkerRef.current = poseLandmarker;

      setInitPhase("camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!isCurrentSession()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element not available.");
      }

      video.srcObject = stream;
      detachVideoPauseHandler();
      const onVideoPause = () => {
        if (!previewActiveRef.current || video.paused) {
          void video.play().catch(() => {
            /* keep preview alive; detect loop surfaces tracking errors */
          });
        }
      };
      videoPauseHandlerRef.current = onVideoPause;
      video.addEventListener("pause", onVideoPause);

      await startVideoPlayback(video);
      if (!isCurrentSession()) return;

      previewActiveRef.current = true;
      setPreviewActive(true);
      setLoading(false);
      setInitPhase(null);

      timerRef.current = setInterval(() => {
        sessionSecondsRef.current += 1;
        setSessionSeconds(sessionSecondsRef.current);
      }, 1000);

      let consecutiveDetectErrors = 0;

      const detect = () => {
        if (!previewActiveRef.current || !videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx || !poseLandmarkerRef.current) return;

        framesTotalRef.current += 1;

        try {
          if (videoRef.current.paused && previewActiveRef.current) {
            void videoRef.current.play().catch(() => undefined);
          }

          detectTimestampRef.current = Math.max(
            detectTimestampRef.current + 1,
            performance.now(),
          );

          const result = poseLandmarkerRef.current.detectForVideo(
            videoRef.current,
            detectTimestampRef.current,
          );

          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.drawImage(videoRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          consecutiveDetectErrors = 0;

          if (result.landmarks && result.landmarks.length > 0) {
            if (trackingStatusRef.current !== "pose-found") {
              trackingStatusRef.current = "pose-found";
              setTrackingStatus("pose-found");
            }
            framesWithPoseRef.current += 1;
            setMovementDetected(true);

            const landmarks = result.landmarks[0];
            const hipVis =
              (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
            const quality: TrackingQuality =
              hipVis > 1.4 ? "good" : hipVis > 0.8 ? "fair" : "poor";
            trackingQualityRef.current = quality;
            setTrackingQuality(quality);

            const hipY = ((landmarks[23]?.y ?? 0) + (landmarks[24]?.y ?? 0)) / 2;

            if (hipY < 0.42 && standPhaseRef.current === "down") {
              standPhaseRef.current = "up";
              repCountRef.current += 1;
              setRepCount(repCountRef.current);
            } else if (hipY > 0.58 && standPhaseRef.current === "up") {
              standPhaseRef.current = "down";
            }

            for (const idx of LOWER_BODY_LANDMARKS) {
              const lm = landmarks[idx];
              if (!lm) continue;
              ctx.beginPath();
              ctx.arc(lm.x * CANVAS_WIDTH, lm.y * CANVAS_HEIGHT, 4, 0, 2 * Math.PI);
              ctx.fillStyle = "#1D9E75";
              ctx.fill();
            }
          } else if (trackingStatusRef.current !== "pose-lost") {
            trackingStatusRef.current = "pose-lost";
            setTrackingStatus("pose-lost");
            setTrackingQuality(null);
          }
        } catch {
          consecutiveDetectErrors += 1;
          if (consecutiveDetectErrors >= 10) {
            setTrackingError(
              "Movement tracking could not continue. Please stop and try again.",
            );
            return;
          }
        }

        if (framesTotalRef.current % UI_FRAME_UPDATE_INTERVAL === 0) {
          setFramesTotal(framesTotalRef.current);
          setFramesWithPose(framesWithPoseRef.current);
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    } catch (err) {
      if (!isCurrentSession()) return;
      stopCamera();
      setError(mapStartError(err));
    } finally {
      if (sessionEpochRef.current === epoch) {
        startInProgressRef.current = false;
      }
    }
  }, [consented, loading, stopCamera, clearSaveStatusTimer, detachVideoPauseHandler]);

  const resetCounter = () => {
    repCountRef.current = 0;
    setRepCount(0);
    standPhaseRef.current = "down";
  };

  const loadingLabel =
    initPhase === "import"
      ? "Loading pose library…"
      : initPhase === "model"
        ? "Loading pose model…"
        : initPhase === "camera"
          ? "Starting camera…"
          : "Starting session…";

  const showPreview = previewActive || (loading && initPhase === "camera");

  if (!consented) {
    return (
      <div
        className="mx-auto max-w-[480px] rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-[#F9FAFB]">Camera Access — Internal Lab</h3>
        <div className="mt-4 space-y-3 text-xs leading-[1.9] text-[#6B7280]">
          <p className="font-medium text-[#9CA3AF]">What this does:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Detects body position using MediaPipe Pose</li>
            <li>Counts repetitions of Sit-to-Stand</li>
            <li>Shows pose tracking status during the session</li>
            <li>Saves derived session metrics (reps, duration) when you stop a session</li>
          </ul>
          <p className="font-medium text-[#9CA3AF]">What this does NOT do:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Record or store any video</li>
            <li>Upload body coordinates or pose landmarks</li>
            <li>Generate any clinical interpretation</li>
          </ul>
          <p className="text-[#9CA3AF]">
            Camera access is required for this internal CV lab. Use HTTPS in production environments.
          </p>
          <p className="text-[#9CA3AF]">
            This prototype records derived movement metrics only. No video or body coordinates are
            stored.
          </p>
          <p className="text-[#EF9F27]">
            This tool is not clinically validated and must not be used for treatment decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConsented(true)}
          className="mt-5 w-full rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
        >
          I understand — enable camera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[8px] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
          <p>{error}</p>
          {!previewActive && !loading && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void startSession();
              }}
              className="mt-3 rounded-[7px] border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/10"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {trackingError && previewActive && (
        <div className="rounded-[8px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
          {trackingError}
        </div>
      )}

      {!previewActive && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startSession()}
          className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165] disabled:opacity-50"
        >
          {loading ? loadingLabel : "Start Session"}
        </button>
      )}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full rounded-[8px] border border-[#1E2D42] bg-[#0B1220]"
        style={{ display: showPreview ? "block" : "none" }}
      />

      {previewActive && (
        <button
          type="button"
          disabled={stopInProgressRef.current || saveInProgressRef.current}
          onClick={handleStopSession}
          className="rounded-[7px] border border-[#1E2D42] bg-transparent px-4 py-2 text-sm font-semibold text-[#9CA3AF] transition hover:text-white disabled:opacity-50"
        >
          Stop Session
        </button>
      )}

      {sessionStarted && (
        <div className="space-y-2 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
          <p className="text-xs text-[#F9FAFB]">
            {loading && initPhase === "import" && "⏳ Loading pose library…"}
            {loading && initPhase === "model" && "⏳ Loading pose model…"}
            {loading && initPhase === "camera" && "⏳ Starting camera…"}
            {!loading && trackingStatus === "idle" && "⏳ Ready"}
            {!loading && trackingStatus === "detecting" && "⏳ Detecting pose…"}
            {!loading && trackingStatus === "pose-found" && "🟢 Pose detected"}
            {!loading && trackingStatus === "pose-lost" && "🔴 Pose not detected — check camera angle"}
          </p>

          {trackingStatus === "pose-found" && trackingQuality && (
            <p className="text-[11px] text-[#6B7280]">
              {trackingQuality === "good" && "Tracking quality: Good"}
              {trackingQuality === "fair" && "Tracking quality: Fair — results may vary"}
              {trackingQuality === "poor" && "⚠ Tracking quality: Poor — adjust camera or lighting"}
            </p>
          )}

          <p
            className="font-mono text-[32px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            Reps counted: {repCount}
          </p>

          <p className="text-sm text-[#9CA3AF]">
            Session duration: {formatDuration(sessionSeconds)}
          </p>

          {movementDetected && (
            <p className="text-[11px] text-[#6B7280]">
              Frames with pose: {framesWithPose} / {framesTotal}
            </p>
          )}

          {saveStatus === "saving" && (
            <p className="text-xs text-[#9CA3AF]">Saving session…</p>
          )}
          {saveStatus === "saved" && (
            <p className="text-xs text-[#1D9E75]">✓ Session saved</p>
          )}
          {saveStatus === "error" && (
            <p className="text-xs text-rose-300">Session data could not be saved</p>
          )}

          <button
            type="button"
            onClick={resetCounter}
            disabled={previewActive && loading}
            className="rounded-[7px] border border-[#1E2D42] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#9CA3AF] transition hover:text-white disabled:opacity-50"
          >
            Reset counter
          </button>

          <p className="mt-2 text-[10px] italic leading-relaxed text-[#EF9F27]">
            ⚠ Prototype-level detection. Not clinically validated. For internal demonstration only.
          </p>
        </div>
      )}
    </div>
  );
}
