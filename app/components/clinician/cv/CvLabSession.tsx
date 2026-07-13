"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STS_CONFIG, type SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import {
  formatSitToStandDuration,
  mapSitToStandStartError,
  SitToStandDetector,
  type SitToStandDetectorSnapshot,
  type SitToStandInitPhase,
  type SitToStandTrackingQuality,
  type SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";
import { useShoulderAbductionReachCvLabShadow } from "./useShoulderAbductionReachCvLabShadow";

const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } = DEFAULT_STS_CONFIG;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type CvLabSessionProps = {
  patientId?: string;
  planId?: string;
  planSessionId?: string;
  onSessionSaved?: () => void;
};

function applySnapshot(
  snapshot: SitToStandDetectorSnapshot,
  setters: {
    setPreviewActive: (v: boolean) => void;
    setLoading: (v: boolean) => void;
    setInitPhase: (v: SitToStandInitPhase) => void;
    setTrackingError: (v: string | null) => void;
    setRepCount: (v: number) => void;
    setTrackingStatus: (v: SitToStandTrackingStatus) => void;
    setTrackingQuality: (v: SitToStandTrackingQuality | null) => void;
    setSessionSeconds: (v: number) => void;
    setMovementDetected: (v: boolean) => void;
    setFramesWithPose: (v: number) => void;
    setFramesTotal: (v: number) => void;
  },
): void {
  setters.setPreviewActive(snapshot.previewActive);
  setters.setInitPhase(snapshot.initPhase);
  setters.setTrackingError(snapshot.trackingError);
  setters.setRepCount(snapshot.repCount);
  setters.setTrackingStatus(snapshot.trackingStatus);
  setters.setTrackingQuality(snapshot.trackingQuality);
  setters.setSessionSeconds(snapshot.sessionSeconds);
  setters.setMovementDetected(snapshot.movementDetected);
  setters.setFramesWithPose(snapshot.framesWithPose);
  setters.setFramesTotal(snapshot.framesTotal);
  setters.setLoading(snapshot.initPhase !== null);
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
  const [initPhase, setInitPhase] = useState<SitToStandInitPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<SitToStandTrackingStatus>("idle");
  const [trackingQuality, setTrackingQuality] = useState<SitToStandTrackingQuality | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [movementDetected, setMovementDetected] = useState(false);
  const [framesWithPose, setFramesWithPose] = useState(0);
  const [framesTotal, setFramesTotal] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<SitToStandDetector | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInProgressRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const onSessionSavedRef = useRef(onSessionSaved);

  onSessionSavedRef.current = onSessionSaved;

  // Off by default; opt in with ?cvDebug=1&shoulderShadow=1. Console-only,
  // independent of SitToStandDetector — see
  // shoulder-abduction-reach-cv-lab-shadow-runner.ts and
  // docs/shoulder-abduction-reach-shadow-mode.md.
  useShoulderAbductionReachCvLabShadow({ videoRef, active: previewActive });

  const syncFromDetector = useCallback((snapshot: SitToStandDetectorSnapshot) => {
    applySnapshot(snapshot, {
      setPreviewActive,
      setLoading,
      setInitPhase,
      setTrackingError,
      setRepCount,
      setTrackingStatus,
      setTrackingQuality,
      setSessionSeconds,
      setMovementDetected,
      setFramesWithPose,
      setFramesTotal,
    });
  }, []);

  useEffect(() => {
    const detector = new SitToStandDetector({ onSnapshot: syncFromDetector });
    detectorRef.current = detector;
    return () => {
      detector.stop();
      detectorRef.current = null;
    };
  }, [syncFromDetector]);

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

  const saveSessionMetrics = useCallback(async (metricsSnapshot: SitToStandDerivedMetrics) => {
    if (saveInProgressRef.current) return;

    const metrics = metricsSnapshot;

    saveInProgressRef.current = true;
    setSaveStatus("saving");

    const payload = {
      exerciseId: metrics.exerciseId,
      repCount: metrics.repCount,
      sessionDurationS: metrics.sessionDurationS,
      trackingQuality: metrics.trackingQuality,
      movementDetected: metrics.movementDetected,
      framesWithPose: metrics.framesWithPose,
      framesTotal: metrics.framesTotal,
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
    const detector = detectorRef.current;
    if (stopInProgressRef.current || !detector?.isPreviewActive()) return;

    stopInProgressRef.current = true;
    const metricsSnapshot = detector.canSaveMetrics() ? detector.getDerivedMetrics() : null;
    detector.stop();
    syncFromDetector(detector.getSnapshot());
    if (metricsSnapshot) {
      void saveSessionMetrics(metricsSnapshot as SitToStandDerivedMetrics).finally(() => {
        stopInProgressRef.current = false;
      });
    } else {
      stopInProgressRef.current = false;
    }
  }, [saveSessionMetrics, syncFromDetector]);

  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
      clearSaveStatusTimer();
    };
  }, [clearSaveStatusTimer]);

  const startSession = useCallback(async () => {
    const detector = detectorRef.current;
    if (!consented || !detector || startInProgressRef.current || loading || detector.isPreviewActive()) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Video element not available.");
      return;
    }

    startInProgressRef.current = true;
    setError(null);
    setTrackingError(null);
    setSessionStarted(true);
    setSaveStatus("idle");
    clearSaveStatusTimer();

    try {
      await detector.start(video, canvas);
    } catch (err) {
      detector.stop();
      syncFromDetector(detector.getSnapshot());
      setError(mapSitToStandStartError(err));
    } finally {
      startInProgressRef.current = false;
    }
  }, [consented, loading, clearSaveStatusTimer, syncFromDetector]);

  const resetCounter = () => {
    detectorRef.current?.resetReps();
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
            Session duration: {formatSitToStandDuration(sessionSeconds)}
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
