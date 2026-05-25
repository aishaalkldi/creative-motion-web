"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

const LOWER_BODY_LANDMARKS = [23, 24, 25, 26, 27, 28] as const;

type TrackingStatus = "idle" | "detecting" | "pose-found" | "pose-lost";
type TrackingQuality = "good" | "fair" | "poor";
type StandPhase = "up" | "down";

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function CvLabSession() {
  const [consented, setConsented] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  const [trackingQuality, setTrackingQuality] = useState<TrackingQuality | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<{ detectForVideo: (video: HTMLVideoElement, ts: number) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> } } | null>(null);
  const standPhaseRef = useRef<StandPhase>("down");
  const cameraActiveRef = useRef(false);

  const stopSession = useCallback(() => {
    cameraActiveRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    poseLandmarkerRef.current = null;
    setCameraActive(false);
    setTrackingStatus("idle");
    setTrackingQuality(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const startSession = useCallback(async () => {
    if (!consented) return;

    setError(null);
    setLoading(true);
    setRepCount(0);
    standPhaseRef.current = "down";
    setSessionSeconds(0);
    setSessionStarted(true);
    setTrackingStatus("detecting");

    try {
      const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);

      const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      poseLandmarkerRef.current = poseLandmarker;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element not available.");
      }

      video.srcObject = stream;
      await video.play();

      cameraActiveRef.current = true;
      setCameraActive(true);
      setLoading(false);

      timerRef.current = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);

      const detect = () => {
        if (!cameraActiveRef.current || !videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx || !poseLandmarkerRef.current) return;

        const result = poseLandmarkerRef.current.detectForVideo(
          videoRef.current,
          performance.now(),
        );

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(videoRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (result.landmarks && result.landmarks.length > 0) {
          setTrackingStatus("pose-found");

          const landmarks = result.landmarks[0];
          const hipVis =
            (landmarks[23]?.visibility ?? 0) + (landmarks[24]?.visibility ?? 0);
          const quality: TrackingQuality =
            hipVis > 1.4 ? "good" : hipVis > 0.8 ? "fair" : "poor";
          setTrackingQuality(quality);

          const hipY = ((landmarks[23]?.y ?? 0) + (landmarks[24]?.y ?? 0)) / 2;

          if (hipY < 0.42 && standPhaseRef.current === "down") {
            standPhaseRef.current = "up";
            setRepCount((c) => c + 1);
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
        } else {
          setTrackingStatus("pose-lost");
          setTrackingQuality(null);
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    } catch (err) {
      stopSession();
      setError(
        err instanceof Error
          ? err.message
          : "Could not start camera or pose detection.",
      );
    }
  }, [consented, stopSession]);

  const resetCounter = () => {
    setRepCount(0);
    standPhaseRef.current = "down";
  };

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
            <li>Shows pose tracking quality</li>
          </ul>
          <p className="font-medium text-[#9CA3AF]">What this does NOT do:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Record or store any video</li>
            <li>Transmit data to any server</li>
            <li>Assess clinical movement quality</li>
            <li>Generate any clinical interpretation</li>
          </ul>
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
          {error}
        </div>
      )}

      {!cameraActive && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startSession()}
          className="rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165] disabled:opacity-50"
        >
          {loading ? "Starting session…" : "Start Session"}
        </button>
      )}

      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full rounded-[8px] border border-[#1E2D42] bg-[#0B1220]"
        style={{ display: cameraActive ? "block" : "none" }}
      />

      {cameraActive && (
        <button
          type="button"
          onClick={stopSession}
          className="rounded-[7px] border border-[#1E2D42] bg-transparent px-4 py-2 text-sm font-semibold text-[#9CA3AF] transition hover:text-white"
        >
          Stop Session
        </button>
      )}

      {sessionStarted && (
        <div className="space-y-2 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
          <p className="text-xs text-[#F9FAFB]">
            {trackingStatus === "idle" && "⏳ Ready"}
            {trackingStatus === "detecting" && "⏳ Detecting pose…"}
            {trackingStatus === "pose-found" && "🟢 Pose detected"}
            {trackingStatus === "pose-lost" && "🔴 Pose not detected — check camera angle"}
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

          <button
            type="button"
            onClick={resetCounter}
            className="rounded-[7px] border border-[#1E2D42] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#9CA3AF] transition hover:text-white"
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
