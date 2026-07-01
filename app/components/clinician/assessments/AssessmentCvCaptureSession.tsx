"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STS_CONFIG } from "@/app/lib/cv/bio-0-contracts";
import {
  GaitWalkingObservationPoseDetector,
  formatGaitWalkingDuration,
  mapGaitWalkingStartError,
} from "@/app/lib/cv/gait-walking-observation-pose-detector";
import {
  formatSitToStandDuration,
  type SitToStandDetectorSnapshot,
  type SitToStandInitPhase,
  type SitToStandTrackingQuality,
  type SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } = DEFAULT_STS_CONFIG;

export type AssessmentCaptureMetrics = {
  exerciseId: string;
  repCount: number;
  sessionDurationS: number;
  trackingQuality: string;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type AssessmentCaptureDetector = {
  start: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<void>;
  stop: () => void;
  isPreviewActive: () => boolean;
  canSaveMetrics: () => boolean;
  getDerivedMetrics: () => AssessmentCaptureMetrics;
};

export type AssessmentCvCaptureSessionProps = {
  title: string;
  instructions: string[];
  primaryMetricLabel: string;
  consentIntro: string;
  createDetector: (onSnapshot: (snapshot: SitToStandDetectorSnapshot) => void) => AssessmentCaptureDetector;
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

export function AssessmentCvCaptureSession({
  title,
  instructions,
  primaryMetricLabel,
  consentIntro,
  createDetector,
  onSessionSaved,
}: AssessmentCvCaptureSessionProps) {
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<AssessmentCaptureDetector | null>(null);
  const saveInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const startInProgressRef = useRef(false);
  const onSessionSavedRef = useRef(onSessionSaved);

  onSessionSavedRef.current = onSessionSaved;

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
    const detector = createDetector(syncFromDetector);
    detectorRef.current = detector;
    return () => {
      detector.stop();
      detectorRef.current = null;
    };
  }, [createDetector, syncFromDetector]);

  const saveSessionMetrics = useCallback(async (metrics: AssessmentCaptureMetrics) => {
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/cv/session-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: metrics.exerciseId,
          repCount: metrics.repCount,
          sessionDurationS: metrics.sessionDurationS,
          trackingQuality: metrics.trackingQuality,
          movementDetected: metrics.movementDetected,
          framesWithPose: metrics.framesWithPose,
          framesTotal: metrics.framesTotal,
          source: "assessment_movement",
        }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
      onSessionSavedRef.current?.();
    } catch {
      setSaveStatus("error");
    } finally {
      saveInProgressRef.current = false;
    }
  }, []);

  const handleStopSession = useCallback(() => {
    const detector = detectorRef.current;
    if (stopInProgressRef.current || !detector?.isPreviewActive()) return;
    stopInProgressRef.current = true;
    const metrics = detector.canSaveMetrics() ? detector.getDerivedMetrics() : null;
    detector.stop();
    syncFromDetector({
      trackingStatus: "idle",
      trackingQuality: null,
      poseReadiness: "checking",
      bodyFramingState: "checking",
      repCount: 0,
      sessionSeconds: metrics?.sessionDurationS ?? sessionSeconds,
      movementDetected: metrics?.movementDetected ?? movementDetected,
      framesWithPose: metrics?.framesWithPose ?? framesWithPose,
      framesTotal: metrics?.framesTotal ?? framesTotal,
      initPhase: null,
      previewActive: false,
      trackingError: null,
      isBaselineCalibrating: false,
    });
    if (metrics) {
      void saveSessionMetrics(metrics).finally(() => {
        stopInProgressRef.current = false;
      });
    } else {
      stopInProgressRef.current = false;
    }
  }, [framesTotal, framesWithPose, movementDetected, saveSessionMetrics, sessionSeconds, syncFromDetector]);

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
    try {
      await detector.start(video, canvas);
    } catch (err) {
      detector.stop();
      setError(mapGaitWalkingStartError(err));
    } finally {
      startInProgressRef.current = false;
    }
  }, [consented, loading]);

  useEffect(() => {
    return () => detectorRef.current?.stop();
  }, []);

  const loadingLabel =
    initPhase === "import"
      ? "Loading pose library…"
      : initPhase === "model"
        ? "Loading pose model…"
        : initPhase === "camera"
          ? "Starting camera…"
          : "Starting capture…";

  const showPreview = previewActive || (loading && initPhase === "camera");
  const formatDuration = primaryMetricLabel.includes("Step") ? formatGaitWalkingDuration : formatSitToStandDuration;

  if (!consented) {
    return (
      <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-white/45">{consentIntro}</p>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed text-white/45">
          {instructions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-amber-200/90">
          Therapist review required. Observations are assistive only — not diagnostic.
        </p>
        <button
          type="button"
          onClick={() => setConsented(true)}
          className="mt-4 w-full rounded-[7px] bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
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
          {loading ? loadingLabel : "Start walking observation"}
        </button>
      )}
      <video ref={videoRef} autoPlay muted playsInline className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" aria-hidden />
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
          Stop and save observation
        </button>
      )}
      {sessionStarted && (
        <div className="space-y-2 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
          <p className="text-xs text-[#F9FAFB]">
            {!loading && trackingStatus === "pose-found" && "Pose detected — walk in place or toward camera"}
            {!loading && trackingStatus === "pose-lost" && "Pose not detected — adjust camera framing"}
            {loading && initPhase && `⏳ ${loadingLabel}`}
          </p>
          <p className="font-mono text-[28px] font-bold text-[#1D9E75]">
            {primaryMetricLabel}: {repCount}
          </p>
          <p className="text-sm text-[#9CA3AF]">
            Walking duration: {formatDuration(sessionSeconds)}
          </p>
          {movementDetected && (
            <p className="text-[11px] text-[#6B7280]">Movement observed during this pass.</p>
          )}
          {trackingQuality && (
            <p className="text-[11px] text-[#6B7280]">Tracking signal: {trackingQuality}</p>
          )}
          {saveStatus === "saved" && <p className="text-xs text-[#1D9E75]">Observation saved for therapist review.</p>}
          {saveStatus === "error" && <p className="text-xs text-rose-300">Could not save observation.</p>}
        </div>
      )}
    </div>
  );
}

export function createGaitWalkingCaptureDetector(
  onSnapshot: (snapshot: SitToStandDetectorSnapshot) => void,
): AssessmentCaptureDetector {
  const detector = new GaitWalkingObservationPoseDetector({ onSnapshot });
  return {
    start: (video, canvas) => detector.start(video, canvas),
    stop: () => detector.stop(),
    isPreviewActive: () => detector.isPreviewActive(),
    canSaveMetrics: () => detector.canSaveMetrics(),
    getDerivedMetrics: () => detector.getDerivedMetrics(),
  };
}
