"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patientCvCopy, type SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  formatSitToStandDuration,
  mapSitToStandStartError,
  SitToStandDetector,
  type PoseReadiness,
  type SitToStandDetectorSnapshot,
  type SitToStandInitPhase,
  type SitToStandTrackingQuality,
  type SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";

const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } = PATIENT_STS_CONFIG;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PatientCvCaptureProps = {
  token: string;
  sessionId: string;
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
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
    setPoseReadiness: (v: PoseReadiness) => void;
    setSessionSeconds: (v: number) => void;
    setMovementDetected: (v: boolean) => void;
    setBaselineCalibrating: (v: boolean) => void;
  },
): void {
  setters.setPreviewActive(snapshot.previewActive);
  setters.setInitPhase(snapshot.initPhase);
  setters.setTrackingError(snapshot.trackingError);
  setters.setRepCount(snapshot.repCount);
  setters.setTrackingStatus(snapshot.trackingStatus);
  setters.setTrackingQuality(snapshot.trackingQuality);
  setters.setPoseReadiness(snapshot.poseReadiness);
  setters.setSessionSeconds(snapshot.sessionSeconds);
  setters.setMovementDetected(snapshot.movementDetected);
  setters.setBaselineCalibrating(snapshot.isBaselineCalibrating);
  setters.setLoading(snapshot.initPhase !== null);
}

export function PatientCvCapture({
  token,
  sessionId,
  language,
  arClass = "",
  textDir = "ltr",
}: PatientCvCaptureProps) {
  const copy = patientCvCopy(language);

  const [skipped, setSkipped] = useState(false);
  const [consented, setConsented] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initPhase, setInitPhase] = useState<SitToStandInitPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<SitToStandTrackingStatus>("idle");
  const [trackingQuality, setTrackingQuality] = useState<SitToStandTrackingQuality | null>(null);
  const [poseReadiness, setPoseReadiness] = useState<PoseReadiness>("checking");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [movementDetected, setMovementDetected] = useState(false);
  const [baselineCalibrating, setBaselineCalibrating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<SitToStandDetector | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInProgressRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);

  const syncFromDetector = useCallback((snapshot: SitToStandDetectorSnapshot) => {
    applySnapshot(snapshot, {
      setPreviewActive,
      setLoading,
      setInitPhase,
      setTrackingError,
      setRepCount,
      setTrackingStatus,
      setTrackingQuality,
      setPoseReadiness,
      setSessionSeconds,
      setMovementDetected,
      setBaselineCalibrating,
    });
  }, []);

  useEffect(() => {
    const detector = new SitToStandDetector({ onSnapshot: syncFromDetector }, PATIENT_STS_CONFIG);
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
    }, 5000);
  }, [clearSaveStatusTimer]);

  const saveSessionMetrics = useCallback(async (metricsSnapshot: SitToStandDerivedMetrics) => {
    if (saveInProgressRef.current) return;

    const metrics = metricsSnapshot;

    saveInProgressRef.current = true;
    setSaveStatus("saving");

    const payload = {
      token,
      sessionId,
      exerciseId: metrics.exerciseId,
      repCount: metrics.repCount,
      sessionDurationS: metrics.sessionDurationS,
      trackingQuality: metrics.trackingQuality,
      movementDetected: metrics.movementDetected,
      framesWithPose: metrics.framesWithPose,
      framesTotal: metrics.framesTotal,
    };

    try {
      const res = await fetch("/api/patient/cv-session-metrics", {
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
    } catch {
      setSaveStatus("error");
      scheduleSaveStatusClear();
    } finally {
      saveInProgressRef.current = false;
    }
  }, [token, sessionId, scheduleSaveStatusClear]);

  const handleStopSession = useCallback(() => {
    const detector = detectorRef.current;
    if (stopInProgressRef.current || !detector?.isPreviewActive()) return;

    stopInProgressRef.current = true;
    const metricsSnapshot = detector.canSaveMetrics() ? detector.getDerivedMetrics() : null;
    detector.stop();
    syncFromDetector(detector.getSnapshot());
    if (metricsSnapshot) {
      void saveSessionMetrics(metricsSnapshot).finally(() => {
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
    if (
      !consented ||
      !detector ||
      startInProgressRef.current ||
      loading ||
      detector.isPreviewActive()
    ) {
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

  const loadingLabel =
    initPhase === "import"
      ? copy.loadingPoseLibrary
      : initPhase === "model"
        ? copy.loadingPoseModel
        : initPhase === "camera"
          ? copy.startingCamera
          : copy.startTracking;

  const showPreview = previewActive || (loading && initPhase === "camera");

  const handleTryAgain = useCallback(() => {
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    setSessionStarted(false);
    setError(null);
    setTrackingError(null);
    setSaveStatus("idle");
    clearSaveStatusTimer();
    stopInProgressRef.current = false;
    startInProgressRef.current = false;
  }, [clearSaveStatusTimer, syncFromDetector]);

  const trackingStatusLabel = (() => {
    if (loading && initPhase === "import") return copy.loadingPoseLibrary;
    if (loading && initPhase === "model") return copy.loadingPoseModel;
    if (loading && initPhase === "camera") return copy.startingCamera;
    if (poseReadiness === "checking") return copy.checkingCameraPosition;
    if (poseReadiness === "not_ready" || trackingStatus === "pose-lost") {
      return trackingStatus === "pose-lost"
        ? copy.poseNotDetectedLabel
        : copy.adjustPhoneBodyChairLabel;
    }
    if (poseReadiness === "partial") return copy.almostReadyLabel;
    if (poseReadiness === "ready") return copy.cameraReadyLabel;
    return copy.checkingCameraPosition;
  })();

  const showReadinessActions =
    previewActive && (poseReadiness === "not_ready" || trackingStatus === "pose-lost");

  if (skipped) {
    return null;
  }

  if (!consented) {
    return (
      <div
        className={`border-b border-[#D1E7DE] bg-white px-4 py-4 ${arClass}`}
        dir={textDir}
        lang={language}
      >
        <p className="text-[11px] font-semibold text-[#1D9E75]">{copy.optionalCameraNote}</p>
        <h3 className={`mt-2 text-[15px] font-bold text-[#0A0F1A] ${arClass}`}>
          {copy.consentTitle}
        </h3>
        <div className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-[#374151]">
          <p className="font-semibold text-[#0A0F1A]">{copy.consentDoIntro}</p>
          <ul className={`list-disc space-y-1 ${textDir === "rtl" ? "mr-4" : "ml-4"}`}>
            {copy.consentDoBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="font-semibold text-[#0A0F1A]">{copy.consentDontIntro}</p>
          <ul className={`list-disc space-y-1 ${textDir === "rtl" ? "mr-4" : "ml-4"}`}>
            {copy.consentDontBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-[#6B7280]">{copy.consentSecureNote}</p>
          <p className="text-[#6B7280]">{copy.consentDerivedNote}</p>
          <p className="text-[11px] text-[#9CA3AF]">{copy.therapistReviewOnly}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setConsented(true)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[14px] font-bold text-white transition hover:bg-[#179165]"
          >
            {copy.consentAccept}
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40"
          >
            {copy.continueWithoutCamera}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-b border-[#D1E7DE] bg-white px-4 py-4 ${arClass}`}
      dir={textDir}
      lang={language}
    >
      <p className="text-[11px] text-[#6B7280]">{copy.moveComfortably}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-[#374151]">{copy.framingInstruction}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{copy.movementInstruction}</p>
      <p className="mt-1 text-[11px] text-[#6B7280]">{copy.hipLandmarksHint}</p>

      {error && (
        <div className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12px] text-rose-800">
          <p>{error}</p>
          {!previewActive && !loading && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void startSession();
              }}
              className="mt-2 text-[12px] font-semibold text-[#1D9E75] underline"
            >
              {copy.startTracking}
            </button>
          )}
        </div>
      )}

      {trackingError && previewActive && (
        <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
          {trackingError}
        </div>
      )}

      {!previewActive && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void startSession()}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[14px] font-bold text-white transition hover:bg-[#179165] disabled:opacity-50"
        >
          {loading ? loadingLabel : copy.startTracking}
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
        className="mt-3 w-full rounded-[8px] border border-[#D1E7DE] bg-[#0A0F1A]"
        style={{ display: showPreview ? "block" : "none" }}
        aria-label={copy.consentTitle}
      />

      {previewActive && (
        <button
          type="button"
          disabled={stopInProgressRef.current || saveInProgressRef.current}
          onClick={handleStopSession}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40 disabled:opacity-50"
        >
          {copy.stopTracking}
        </button>
      )}

      {showReadinessActions && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleTryAgain()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[14px] font-bold text-white transition hover:bg-[#179165]"
          >
            {copy.tryAgainLabel}
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40"
          >
            {copy.continueWithoutCamera}
          </button>
        </div>
      )}

      {sessionStarted && baselineCalibrating && (poseReadiness === "ready" || poseReadiness === "partial") && (
        <p className="mt-3 text-[12px] font-medium text-[#1D9E75]">{copy.startSeatedHint}</p>
      )}

      {sessionStarted && (
        <div className="mt-4 space-y-2 rounded-[8px] border border-[#D1E7DE] bg-[#F9FAFB] px-3.5 py-3">
          <p className="text-[12px] font-semibold text-[#374151]">
            <span className="text-[#6B7280]">{copy.trackingSignalLabel}: </span>
            {trackingStatusLabel}
          </p>

          <p
            className="text-[28px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {copy.repsCounted(repCount)}
          </p>

          <p className="text-[13px] text-[#374151]">
            {copy.sessionDuration(formatSitToStandDuration(sessionSeconds))}
          </p>

          <p className="text-[12px] text-[#6B7280]">
            {movementDetected ? copy.movementDetectedYes : copy.movementDetectedNo}
          </p>

          {saveStatus === "saving" && (
            <p className="text-[12px] text-[#6B7280]">{copy.savingMetrics}</p>
          )}
          {saveStatus === "saved" && (
            <p className="text-[12px] font-semibold text-[#1D9E75]">{copy.savedTherapistReview}</p>
          )}
          {saveStatus === "error" && (
            <p className="text-[12px] text-rose-700">{copy.saveError}</p>
          )}

          <p className="text-[10px] leading-relaxed text-[#9CA3AF]">{copy.prototypeNotice}</p>
        </div>
      )}
    </div>
  );
}
