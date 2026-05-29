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

const METRICS_REPORT_INTERVAL_MS = 3_000;

export type PatientCvCaptureProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
  onMetricsUpdate?: (metrics: SitToStandDerivedMetrics) => void;
  onSkipped?: () => void;
  onRegisterMetricsFlush?: (flush: () => void) => void;
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
  language,
  arClass = "",
  textDir = "ltr",
  onMetricsUpdate,
  onSkipped,
  onRegisterMetricsFlush,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<SitToStandDetector | null>(null);
  const startInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const skipReportRef = useRef(false);
  const lastReportedRepRef = useRef(-1);
  const onMetricsUpdateRef = useRef(onMetricsUpdate);

  useEffect(() => {
    onMetricsUpdateRef.current = onMetricsUpdate;
  }, [onMetricsUpdate]);

  const reportMetrics = useCallback(() => {
    if (skipReportRef.current) return;
    const detector = detectorRef.current;
    if (!detector?.isPreviewActive()) return;
    onMetricsUpdateRef.current?.(detector.getDerivedMetrics());
  }, []);

  const syncFromDetector = useCallback(
    (snapshot: SitToStandDetectorSnapshot) => {
      const prevRep = lastReportedRepRef.current;
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
      if (snapshot.previewActive && snapshot.repCount !== prevRep) {
        lastReportedRepRef.current = snapshot.repCount;
        reportMetrics();
      }
    },
    [reportMetrics],
  );

  useEffect(() => {
    const detector = new SitToStandDetector({ onSnapshot: syncFromDetector }, PATIENT_STS_CONFIG);
    detectorRef.current = detector;
    return () => {
      reportMetrics();
      detector.stop();
      detectorRef.current = null;
    };
  }, [syncFromDetector, reportMetrics]);

  useEffect(() => {
    if (!onRegisterMetricsFlush) return;
    onRegisterMetricsFlush(reportMetrics);
    return () => onRegisterMetricsFlush(() => {});
  }, [onRegisterMetricsFlush, reportMetrics]);

  useEffect(() => {
    if (!previewActive) return;
    reportMetrics();
    const id = setInterval(reportMetrics, METRICS_REPORT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [previewActive, reportMetrics]);

  const skipCameraWithoutSave = useCallback(() => {
    skipReportRef.current = true;
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    setSkipped(true);
    onSkipped?.();
  }, [syncFromDetector, onSkipped]);

  const handleStopSession = useCallback(() => {
    if (stopInProgressRef.current || !detectorRef.current?.isPreviewActive()) return;

    stopInProgressRef.current = true;
    reportMetrics();
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    stopInProgressRef.current = false;
  }, [reportMetrics, syncFromDetector]);

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
    skipReportRef.current = false;
    lastReportedRepRef.current = -1;

    try {
      await detector.start(video, canvas);
      reportMetrics();
    } catch (err) {
      detector.stop();
      syncFromDetector(detector.getSnapshot());
      setError(mapSitToStandStartError(err));
    } finally {
      startInProgressRef.current = false;
    }
  }, [consented, loading, syncFromDetector, reportMetrics]);

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
    skipReportRef.current = false;
    lastReportedRepRef.current = -1;
    stopInProgressRef.current = false;
    startInProgressRef.current = false;
  }, [syncFromDetector]);

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
            onClick={() => skipCameraWithoutSave()}
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
      <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{copy.startWhenReadyHint}</p>
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
          disabled={stopInProgressRef.current}
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
            onClick={() => skipCameraWithoutSave()}
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

          <p className="text-[10px] leading-relaxed text-[#9CA3AF]">{copy.prototypeNotice}</p>
        </div>
      )}
    </div>
  );
}
