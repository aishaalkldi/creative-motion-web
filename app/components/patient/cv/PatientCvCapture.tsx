"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  patientCvCopy,
  type PatientCvDerivedMetrics,
} from "@/app/lib/cv/bio-0-contracts";
import {
  MiniSquatDetector,
  formatMiniSquatDuration,
  mapMiniSquatStartError,
  type MiniSquatDetectorSnapshot,
} from "@/app/lib/cv/mini-squat-pose-detector";
import {
  isHeelRaiseMotionPilotEnabled,
  isStepUpMotionPilotEnabled,
  PATIENT_HEEL_RAISE_POSE_SHELL,
  PATIENT_STEP_UP_POSE_SHELL,
  PATIENT_MINI_SQUAT_CONFIG,
  PATIENT_SLS_POSE_SHELL,
  PATIENT_STS_CONFIG,
  type CvY1ExerciseId,
} from "@/app/lib/cv/cv-patient-config";
import {
  HeelRaisePoseDetector,
  formatHeelRaiseDuration,
  mapHeelRaiseStartError,
  type HeelRaisePoseDetectorSnapshot,
} from "@/app/lib/cv/heel-raise-pose-detector";
import {
  buildHeelRaiseMotionPilotRecordFromSummary,
  buildMotionQualityWithHrPilot,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  StepUpPoseDetector,
  formatStepUpDuration,
  mapStepUpStartError,
  type StepUpPoseDetectorSnapshot,
} from "@/app/lib/cv/step-up-pose-detector";
import {
  buildStepUpMotionPilotRecordFromSummary,
  buildMotionQualityWithSuPilot,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import {
  beginHeelRaiseMotionTimeline,
  createHeelRaiseTimelineCaptureRefs,
  disposeHeelRaiseMotionTimelineRefs,
  finalizeHeelRaiseMotionTimelineCapture,
  logHeelRaiseMotionTimelineSummaryDebug,
  recordHeelRaiseMotionTimelineTick,
  tryFinalizeHeelRaiseTimelineBeforePilotSave,
} from "@/app/lib/cv/patient-cv-heel-raise-timeline";
import {
  beginStepUpMotionTimeline,
  createStepUpTimelineCaptureRefs,
  disposeStepUpMotionTimelineRefs,
  finalizeStepUpMotionTimelineCapture,
  logStepUpMotionTimelineSummaryDebug,
  recordStepUpMotionTimelineTick,
  tryFinalizeStepUpTimelineBeforePilotSave,
} from "@/app/lib/cv/patient-cv-step-up-timeline";
import {
  SingleLegStancePoseDetector,
  formatSingleLegStanceDuration,
  mapSingleLegStanceStartError,
  type SingleLegStancePoseDetectorSnapshot,
} from "@/app/lib/cv/single-leg-stance-pose-detector";
import type { StanceLeg } from "@/app/lib/cv/single-leg-stance-detector";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  formatSitToStandDuration,
  mapSitToStandStartError,
  SitToStandDetector,
  type BodyFramingState,
  type PoseReadiness,
  type SitToStandDetectorSnapshot,
  type SitToStandInitPhase,
  type SitToStandTrackingQuality,
  type SitToStandTrackingStatus,
} from "@/app/lib/cv/sit-to-stand-detector";
import {
  resolveLiveBodySignal,
  type LiveBodySignal,
} from "@/app/lib/cv/pose-landmark-overlay";
import {
  collectPatientCameraDiagnostics,
  isVideoPreviewRenderable,
  PATIENT_CAMERA_NO_FRAMES_ERROR,
  PATIENT_CAMERA_NO_FRAMES_MESSAGE,
} from "@/app/lib/cv/patient-camera-stream";
import {
  collectPatientCvDebugSnapshot,
  isPatientCvDebugEnabled,
  type PatientCvDebugSnapshot,
} from "@/app/lib/cv/patient-camera-debug";
import {
  beginStsMotionTimeline,
  createStsTimelineCaptureRefs,
  disposeStsMotionTimelineRefs,
  finalizeStsMotionTimelineCapture,
  logStsMotionTimelineFinalizeSkipped,
  logStsMotionTimelineSummaryDebug,
  recordStsMotionTimelineTick,
  tryFinalizeStsTimelineBeforePilotSave,
} from "@/app/lib/cv/patient-cv-sts-timeline";
import { isStsMotionTimelineEnabled } from "@/app/lib/cv/is-sts-motion-timeline-enabled";
import {
  buildMotionQualityWithStsPilot,
  buildStsMotionPilotRecord,
  type CvMotionQualityPayload,
} from "@/app/lib/cv/sts-motion-pilot-record";

const METRICS_REPORT_INTERVAL_MS = 3_000;

function isHoldCvExercise(exerciseId: CvY1ExerciseId): boolean {
  return exerciseId === "single-leg-stance";
}

type CvDetectorSnapshot =
  | SitToStandDetectorSnapshot
  | MiniSquatDetectorSnapshot
  | SingleLegStancePoseDetectorSnapshot
  | HeelRaisePoseDetectorSnapshot
  | StepUpPoseDetectorSnapshot;

type PatientCvDetector =
  | SitToStandDetector
  | MiniSquatDetector
  | SingleLegStancePoseDetector
  | HeelRaisePoseDetector
  | StepUpPoseDetector;

type PatientCameraPreviewStackProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  ariaLabel: string;
  loadingHint?: string | null;
};

function auditPreviewLayers(
  label: string,
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  container: HTMLDivElement | null,
  state: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const vStyle = video ? window.getComputedStyle(video) : null;
  const cStyle = canvas ? window.getComputedStyle(canvas) : null;
  const diagnostics = collectPatientCameraDiagnostics(label, video, canvas, container);

  const canvasCoversPreview = Boolean(
    canvas &&
      canvas.clientWidth > 32 &&
      canvas.clientHeight > 32 &&
      cStyle?.display !== "none" &&
      cStyle?.visibility !== "hidden" &&
      Number(cStyle?.opacity ?? 1) > 0.01,
  );

  const videoHealthy = diagnostics.previewRenderable && diagnostics.clientWidth > 0;

  let diagnosis = "ok";
  if (!video) diagnosis = "missing video element";
  else if (!diagnostics.hasSrcObject) diagnosis = "video missing srcObject";
  else if (diagnostics.videoWidth === 0 || diagnostics.videoHeight === 0)
    diagnosis = "video has no decoded frames";
  else if (diagnostics.clientWidth === 0 || diagnostics.clientHeight === 0)
    diagnosis = "video visible box is 0 size";
  else if (vStyle?.display === "none" || Number(vStyle?.opacity ?? 1) <= 0.01)
    diagnosis = "video hidden via CSS";
  else if (canvasCoversPreview) diagnosis = "full-size canvas may be covering preview";

  console.info(`[CV preview audit] ${label}`, {
    ...state,
    ...diagnostics,
    previewOk: videoHealthy && !canvasCoversPreview,
    videoHealthy,
    canvasCoversPreview,
    diagnosis,
    video: video
      ? {
          hidden: video.hidden,
          opacity: vStyle?.opacity ?? null,
          display: vStyle?.display ?? null,
          clientWidth: video.clientWidth,
          clientHeight: video.clientHeight,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          hasSrcObject: Boolean(video.srcObject),
        }
      : null,
    canvas: canvas
      ? {
          hidden: canvas.hidden,
          opacity: cStyle?.opacity ?? null,
          display: cStyle?.display ?? null,
          zIndex: cStyle?.zIndex ?? null,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        }
      : null,
  });
}

function PatientCameraPreviewStack({
  videoRef,
  canvasRef,
  containerRef,
  canvasWidth,
  canvasHeight,
  ariaLabel,
  loadingHint,
}: PatientCameraPreviewStackProps) {
  return (
    <div
      ref={containerRef}
      className="relative mt-3 w-full overflow-hidden rounded-[8px] border border-[#D1E7DE] bg-black"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      aria-label={ariaLabel}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="block h-full w-full object-cover"
      />
      {/* Transparent landmark overlay — video stays visible underneath (PR #33 fix) */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {loadingHint ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-[12px] font-medium text-white">
          {loadingHint}
        </div>
      ) : null}
    </div>
  );
}

function PatientCameraDebugPanel({ snapshot }: { snapshot: PatientCvDebugSnapshot }) {
  return (
    <div className="mt-2 rounded-[6px] border border-dashed border-[#6B7280] bg-[#0A0F1A] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#E5E7EB]">
      <p className="font-bold text-[#5DCAA5]">CV debug (?cvDebug=1)</p>
      <p>videoWidth: {snapshot.videoWidth}</p>
      <p>videoHeight: {snapshot.videoHeight}</p>
      <p>readyState: {snapshot.readyState}</p>
      <p>stream active: {String(snapshot.streamActive)}</p>
      <p>frames received: {snapshot.framesReceived}</p>
      <p>preview visible: {String(snapshot.previewVisible)}</p>
      <p>hasSrcObject: {String(snapshot.hasSrcObject)}</p>
      <p>client: {snapshot.clientWidth}×{snapshot.clientHeight}</p>
      <p>paused: {String(snapshot.paused)}</p>
    </div>
  );
}

export type PatientCvCaptureProps = {
  exerciseId: CvY1ExerciseId;
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
  onMetricsUpdate?: (metrics: PatientCvDerivedMetrics) => void;
  onSkipped?: () => void;
  onRegisterMetricsFlush?: (flush: () => void) => void;
  onRegisterStsPilotBeforeSave?: (beforeSave: () => void) => void;
  onRegisterStsPilotRecordFlush?: (flush: () => CvMotionQualityPayload | null) => void;
};

function canvasSizeForExercise(exerciseId: CvY1ExerciseId): {
  canvasWidth: number;
  canvasHeight: number;
} {
  if (exerciseId === "mini-squat") {
    return {
      canvasWidth: PATIENT_MINI_SQUAT_CONFIG.canvasWidth,
      canvasHeight: PATIENT_MINI_SQUAT_CONFIG.canvasHeight,
    };
  }
  if (exerciseId === "single-leg-stance") {
    return {
      canvasWidth: PATIENT_SLS_POSE_SHELL.canvasWidth,
      canvasHeight: PATIENT_SLS_POSE_SHELL.canvasHeight,
    };
  }
  if (exerciseId === "heel-raise") {
    return {
      canvasWidth: PATIENT_HEEL_RAISE_POSE_SHELL.canvasWidth,
      canvasHeight: PATIENT_HEEL_RAISE_POSE_SHELL.canvasHeight,
    };
  }
  if (exerciseId === "step-up") {
    return {
      canvasWidth: PATIENT_STEP_UP_POSE_SHELL.canvasWidth,
      canvasHeight: PATIENT_STEP_UP_POSE_SHELL.canvasHeight,
    };
  }
  return {
    canvasWidth: PATIENT_STS_CONFIG.canvasWidth,
    canvasHeight: PATIENT_STS_CONFIG.canvasHeight,
  };
}

function applySnapshot(
  snapshot: CvDetectorSnapshot,
  setters: {
    setPreviewActive: (v: boolean) => void;
    setLoading: (v: boolean) => void;
    setInitPhase: (v: SitToStandInitPhase) => void;
    setTrackingError: (v: string | null) => void;
    setRepCount: (v: number) => void;
    setTrackingStatus: (v: SitToStandTrackingStatus) => void;
    setTrackingQuality: (v: SitToStandTrackingQuality | null) => void;
    setPoseReadiness: (v: PoseReadiness) => void;
    setBodyFramingState: (v: BodyFramingState) => void;
    setSessionSeconds: (v: number) => void;
    setMovementDetected: (v: boolean) => void;
    setBaselineCalibrating: (v: boolean) => void;
    setFramesTotal: (v: number) => void;
  },
): void {
  setters.setPreviewActive(snapshot.previewActive);
  setters.setInitPhase(snapshot.initPhase);
  setters.setTrackingError(snapshot.trackingError);
  setters.setRepCount(snapshot.repCount);
  setters.setTrackingStatus(snapshot.trackingStatus);
  setters.setTrackingQuality(snapshot.trackingQuality);
  setters.setPoseReadiness(snapshot.poseReadiness);
  setters.setBodyFramingState(snapshot.bodyFramingState);
  setters.setSessionSeconds(snapshot.sessionSeconds);
  setters.setMovementDetected(snapshot.movementDetected);
  setters.setBaselineCalibrating(snapshot.isBaselineCalibrating);
  setters.setFramesTotal(snapshot.framesTotal);
  setters.setLoading(snapshot.initPhase !== null);
}

export function PatientCvCapture({
  exerciseId,
  language,
  arClass = "",
  textDir = "ltr",
  onMetricsUpdate,
  onSkipped,
  onRegisterMetricsFlush,
  onRegisterStsPilotBeforeSave,
  onRegisterStsPilotRecordFlush,
}: PatientCvCaptureProps) {
  const copy = patientCvCopy(language, exerciseId);
  const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } =
    canvasSizeForExercise(exerciseId);

  const [skipped, setSkipped] = useState(false);
  const [consented, setConsented] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const [trackingStopped, setTrackingStopped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initPhase, setInitPhase] = useState<SitToStandInitPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<SitToStandTrackingStatus>("idle");
  const [trackingQuality, setTrackingQuality] = useState<SitToStandTrackingQuality | null>(null);
  const [poseReadiness, setPoseReadiness] = useState<PoseReadiness>("checking");
  const [bodyFramingState, setBodyFramingState] = useState<BodyFramingState>("checking");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [movementDetected, setMovementDetected] = useState(false);
  const [baselineCalibrating, setBaselineCalibrating] = useState(false);
  const [stanceLeg, setStanceLeg] = useState<StanceLeg | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [videoElReady, setVideoElReady] = useState(false);
  const [noVideoFrames, setNoVideoFrames] = useState(false);
  const [framesTotal, setFramesTotal] = useState(0);
  const [cvDebugEnabled, setCvDebugEnabled] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<PatientCvDebugSnapshot | null>(null);
  const detectorRef = useRef<PatientCvDetector | null>(null);
  const startInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const lastReportedRepRef = useRef(-1);
  const lastReportedHoldRef = useRef(-1);
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  const stsTimelineRefs = useRef(createStsTimelineCaptureRefs()).current;
  const hrTimelineRefs = useRef(createHeelRaiseTimelineCaptureRefs()).current;
  const suTimelineRefs = useRef(createStepUpTimelineCaptureRefs()).current;

  useEffect(() => {
    onMetricsUpdateRef.current = onMetricsUpdate;
  }, [onMetricsUpdate]);

  useEffect(() => {
    setCvDebugEnabled(isPatientCvDebugEnabled());
  }, []);

  const reportMetrics = useCallback(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    if (!detector.isPreviewActive() && !trackingStopped) return;
    onMetricsUpdateRef.current?.(detector.getDerivedMetrics());
  }, [trackingStopped]);

  /** Always push latest derived metrics — used before save even after stop(). */
  const flushMetricsForSave = useCallback(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    onMetricsUpdateRef.current?.(detector.getDerivedMetrics());
  }, []);

  const syncFromDetector = useCallback(
    (snapshot: CvDetectorSnapshot) => {
      const prevRep = lastReportedRepRef.current;
      const prevHold = lastReportedHoldRef.current;
      applySnapshot(snapshot, {
        setPreviewActive,
        setLoading,
        setInitPhase,
        setTrackingError,
        setRepCount,
        setTrackingStatus,
        setTrackingQuality,
        setPoseReadiness,
        setBodyFramingState,
        setSessionSeconds,
        setMovementDetected,
        setBaselineCalibrating,
        setFramesTotal,
      });
      if (!snapshot.previewActive && !trackingStopped) return;
      if (exerciseId === "sit-to-stand") {
        recordStsMotionTimelineTick(
          exerciseId,
          stsTimelineRefs,
          snapshot as SitToStandDetectorSnapshot,
        );
      }
      if (exerciseId === "heel-raise") {
        recordHeelRaiseMotionTimelineTick(
          exerciseId,
          hrTimelineRefs,
          snapshot as SitToStandDetectorSnapshot,
        );
      }
      if (exerciseId === "step-up") {
        recordStepUpMotionTimelineTick(
          exerciseId,
          suTimelineRefs,
          snapshot as SitToStandDetectorSnapshot,
        );
      }
      if (isHoldCvExercise(exerciseId)) {
        if (snapshot.sessionSeconds !== prevHold) {
          lastReportedHoldRef.current = snapshot.sessionSeconds;
          reportMetrics();
        }
        return;
      }
      if (snapshot.repCount !== prevRep) {
        lastReportedRepRef.current = snapshot.repCount;
        reportMetrics();
      }
    },
    [exerciseId, reportMetrics, trackingStopped, stsTimelineRefs, hrTimelineRefs, suTimelineRefs],
  );

  useEffect(() => {
    if (isHoldCvExercise(exerciseId) && stanceLeg === null) {
      detectorRef.current?.stop();
      detectorRef.current = null;
      return;
    }

    const detector: PatientCvDetector =
      exerciseId === "step-up"
        ? new StepUpPoseDetector({ onSnapshot: syncFromDetector })
        : exerciseId === "heel-raise"
          ? new HeelRaisePoseDetector({ onSnapshot: syncFromDetector })
          : exerciseId === "mini-squat"
            ? new MiniSquatDetector({ onSnapshot: syncFromDetector })
            : exerciseId === "single-leg-stance"
              ? new SingleLegStancePoseDetector({ onSnapshot: syncFromDetector }, stanceLeg!)
              : new SitToStandDetector({ onSnapshot: syncFromDetector }, PATIENT_STS_CONFIG);

    detectorRef.current = detector;
    return () => {
      const summary = finalizeStsMotionTimelineCapture(
        exerciseId,
        stsTimelineRefs,
        detector,
      );
      if (summary) {
        if (cvDebugEnabled) logStsMotionTimelineSummaryDebug(summary, stsTimelineRefs);
      } else {
        logStsMotionTimelineFinalizeSkipped(exerciseId, stsTimelineRefs, summary);
      }
      disposeStsMotionTimelineRefs(stsTimelineRefs);
      const hrSummary = finalizeHeelRaiseMotionTimelineCapture(
        exerciseId,
        hrTimelineRefs,
        detector,
      );
      if (hrSummary && cvDebugEnabled) {
        logHeelRaiseMotionTimelineSummaryDebug(hrSummary, hrTimelineRefs);
      }
      disposeHeelRaiseMotionTimelineRefs(hrTimelineRefs);
      const suSummary = finalizeStepUpMotionTimelineCapture(
        exerciseId,
        suTimelineRefs,
        detector,
      );
      if (suSummary && cvDebugEnabled) {
        logStepUpMotionTimelineSummaryDebug(suSummary, suTimelineRefs);
      }
      disposeStepUpMotionTimelineRefs(suTimelineRefs);
      flushMetricsForSave();
      detector.stop();
      detectorRef.current = null;
    };
  }, [
    exerciseId,
    stanceLeg,
    syncFromDetector,
    flushMetricsForSave,
    stsTimelineRefs,
    hrTimelineRefs,
    suTimelineRefs,
    cvDebugEnabled,
  ]);

  useEffect(() => {
    if (!onRegisterMetricsFlush) return;
    onRegisterMetricsFlush(flushMetricsForSave);
    return () => onRegisterMetricsFlush(() => {});
  }, [onRegisterMetricsFlush, flushMetricsForSave]);

  const finalizeStsPilotBeforeSave = useCallback(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    const summary = tryFinalizeStsTimelineBeforePilotSave(
      exerciseId,
      stsTimelineRefs,
      detector,
      isStsMotionTimelineEnabled(exerciseId),
    );
    if (summary && cvDebugEnabled) {
      logStsMotionTimelineSummaryDebug(summary, stsTimelineRefs);
    }
    const hrSummary = tryFinalizeHeelRaiseTimelineBeforePilotSave(
      exerciseId,
      hrTimelineRefs,
      detector,
    );
    if (hrSummary && cvDebugEnabled) {
      logHeelRaiseMotionTimelineSummaryDebug(hrSummary, hrTimelineRefs);
    }
    const suSummary = tryFinalizeStepUpTimelineBeforePilotSave(
      exerciseId,
      suTimelineRefs,
      detector,
    );
    if (suSummary && cvDebugEnabled) {
      logStepUpMotionTimelineSummaryDebug(suSummary, suTimelineRefs);
    }
  }, [exerciseId, stsTimelineRefs, hrTimelineRefs, suTimelineRefs, cvDebugEnabled]);

  useEffect(() => {
    if (!onRegisterStsPilotBeforeSave) return;
    onRegisterStsPilotBeforeSave(finalizeStsPilotBeforeSave);
    return () => onRegisterStsPilotBeforeSave(() => {});
  }, [onRegisterStsPilotBeforeSave, finalizeStsPilotBeforeSave]);

  const buildStsPilotMotionQuality = useCallback((): CvMotionQualityPayload | null => {
    if (exerciseId !== "sit-to-stand" || !isStsMotionTimelineEnabled("sit-to-stand")) {
      return null;
    }
    const summary = stsTimelineRefs.summary.current;
    if (!summary) return null;
    const detector = detectorRef.current;
    if (!detector) return null;
    const metrics = detector.getDerivedMetrics();
    if (metrics.exerciseId !== "sit-to-stand") return null;
    const record = buildStsMotionPilotRecord({
      summary,
      metrics,
      snapshotCount: stsTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
    });
    return buildMotionQualityWithStsPilot(record);
  }, [exerciseId, stsTimelineRefs]);

  const buildHeelRaisePilotMotionQuality = useCallback((): CvMotionQualityPayload | null => {
    if (exerciseId !== "heel-raise" || !isHeelRaiseMotionPilotEnabled(exerciseId)) {
      return null;
    }
    const summary = hrTimelineRefs.summary.current;
    if (!summary) return null;
    const detector = detectorRef.current;
    if (!detector) return null;
    const metrics = detector.getDerivedMetrics();
    if (metrics.exerciseId !== "heel-raise") return null;
    const record = buildHeelRaiseMotionPilotRecordFromSummary({
      summary,
      metrics,
      snapshotCount: hrTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
    });
    return buildMotionQualityWithHrPilot(record);
  }, [exerciseId, hrTimelineRefs]);

  const buildStepUpPilotMotionQuality = useCallback((): CvMotionQualityPayload | null => {
    if (exerciseId !== "step-up" || !isStepUpMotionPilotEnabled(exerciseId)) {
      return null;
    }
    const summary = suTimelineRefs.summary.current;
    if (!summary) return null;
    const detector = detectorRef.current;
    if (!detector) return null;
    const metrics = detector.getDerivedMetrics();
    if (metrics.exerciseId !== "step-up") return null;
    const record = buildStepUpMotionPilotRecordFromSummary({
      summary,
      metrics,
      snapshotCount: suTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
    });
    return buildMotionQualityWithSuPilot(record);
  }, [exerciseId, suTimelineRefs]);

  const buildMotionPilotRecordFlush = useCallback((): CvMotionQualityPayload | null => {
    return (
      buildStsPilotMotionQuality() ??
      buildHeelRaisePilotMotionQuality() ??
      buildStepUpPilotMotionQuality()
    );
  }, [buildStsPilotMotionQuality, buildHeelRaisePilotMotionQuality, buildStepUpPilotMotionQuality]);

  useEffect(() => {
    if (!onRegisterStsPilotRecordFlush) return;
    onRegisterStsPilotRecordFlush(buildMotionPilotRecordFlush);
    return () => onRegisterStsPilotRecordFlush(() => null);
  }, [onRegisterStsPilotRecordFlush, buildMotionPilotRecordFlush]);

  useEffect(() => {
    if (!previewActive && !trackingStopped) return;
    reportMetrics();
    const id = setInterval(reportMetrics, METRICS_REPORT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [previewActive, trackingStopped, reportMetrics]);

  const skipCameraWithoutSave = useCallback(() => {
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    disposeStsMotionTimelineRefs(stsTimelineRefs);
    disposeHeelRaiseMotionTimelineRefs(hrTimelineRefs);
    disposeStepUpMotionTimelineRefs(suTimelineRefs);
    setCameraLive(false);
    setTrackingStopped(false);
    setSkipped(true);
    onSkipped?.();
  }, [syncFromDetector, onSkipped, stsTimelineRefs, hrTimelineRefs, suTimelineRefs]);

  const handleStopSession = useCallback(() => {
    const detector = detectorRef.current;
    if (stopInProgressRef.current || !detector?.isPreviewActive()) return;

    stopInProgressRef.current = true;
    reportMetrics();
    const summary = finalizeStsMotionTimelineCapture(
      exerciseId,
      stsTimelineRefs,
      detector,
    );
    if (summary) {
      if (cvDebugEnabled) logStsMotionTimelineSummaryDebug(summary, stsTimelineRefs);
    } else {
      logStsMotionTimelineFinalizeSkipped(exerciseId, stsTimelineRefs, summary);
    }
    const hrSummary = finalizeHeelRaiseMotionTimelineCapture(
      exerciseId,
      hrTimelineRefs,
      detector,
    );
    if (hrSummary && cvDebugEnabled) {
      logHeelRaiseMotionTimelineSummaryDebug(hrSummary, hrTimelineRefs);
    }
    const suSummary = finalizeStepUpMotionTimelineCapture(
      exerciseId,
      suTimelineRefs,
      detector,
    );
    if (suSummary && cvDebugEnabled) {
      logStepUpMotionTimelineSummaryDebug(suSummary, suTimelineRefs);
    }
    detector.stop();
    setCameraLive(false);
    flushMetricsForSave();
    syncFromDetector(detector.getSnapshot());
    stopInProgressRef.current = false;
  }, [
    exerciseId,
    reportMetrics,
    syncFromDetector,
    flushMetricsForSave,
    stsTimelineRefs,
    hrTimelineRefs,
    suTimelineRefs,
    cvDebugEnabled,
  ]);

  const mapStartError =
    exerciseId === "step-up"
      ? mapStepUpStartError
      : exerciseId === "heel-raise"
        ? mapHeelRaiseStartError
        : exerciseId === "mini-squat"
          ? mapMiniSquatStartError
          : exerciseId === "single-leg-stance"
            ? mapSingleLegStanceStartError
            : mapSitToStandStartError;

  const startCameraTracking = useCallback(async () => {
    const detector = detectorRef.current;
    if (
      !consented ||
      !detector ||
      startInProgressRef.current ||
      loading ||
      detector.isPreviewActive() ||
      cameraLive
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
    setTrackingStopped(false);
    setNoVideoFrames(false);

    try {
      await detector.start(video, canvas);
      if (!isVideoPreviewRenderable(video)) {
        throw new Error(PATIENT_CAMERA_NO_FRAMES_ERROR);
      }
      setCameraLive(true);
      beginStsMotionTimeline(exerciseId, stsTimelineRefs);
      beginHeelRaiseMotionTimeline(exerciseId, hrTimelineRefs);
      beginStepUpMotionTimeline(exerciseId, suTimelineRefs);
      reportMetrics();
      auditPreviewLayers("after-detector-start", video, canvas, previewContainerRef.current, {
        cameraLive: true,
        previewActive: detector.isPreviewActive(),
        cameraPhase: "tracking",
      });
    } catch (err) {
      detector.stop();
      syncFromDetector(detector.getSnapshot());
      setCameraLive(false);
      const message = mapStartError(err);
      setError(message);
      setNoVideoFrames(message === PATIENT_CAMERA_NO_FRAMES_MESSAGE);
    } finally {
      startInProgressRef.current = false;
    }
  }, [
    consented,
    loading,
    cameraLive,
    syncFromDetector,
    reportMetrics,
    mapStartError,
    exerciseId,
    stsTimelineRefs,
    hrTimelineRefs,
    suTimelineRefs,
  ]);

  const holdExercise = isHoldCvExercise(exerciseId);
  const stanceLegRequired = holdExercise && stanceLeg === null;

  useLayoutEffect(() => {
    if (skipped || !consented || stanceLegRequired) {
      setVideoElReady(false);
      return;
    }
    setVideoElReady(Boolean(videoRef.current));
  }, [skipped, consented, stanceLegRequired, exerciseId]);

  useEffect(() => {
    if (skipped || !consented || stanceLegRequired || !videoElReady) return;
    if (previewActive || cameraLive || loading || startInProgressRef.current || error) return;
    void startCameraTracking();
  }, [
    skipped,
    consented,
    stanceLegRequired,
    videoElReady,
    previewActive,
    cameraLive,
    loading,
    error,
    startCameraTracking,
  ]);

  useEffect(() => {
    setCameraLive(false);
    setTrackingStopped(false);
    setError(null);
  }, [exerciseId, stanceLeg]);

  const loadingLabel =
    initPhase === "import"
      ? copy.loadingPoseLibrary
      : initPhase === "model"
        ? copy.loadingPoseModel
        : initPhase === "camera"
          ? copy.startingCamera
          : copy.startTracking;

  const showPreviewUi = cameraLive || previewActive || loading;
  const previewLoadingHint =
    loading && initPhase === "import"
      ? copy.loadingPoseLibrary
      : loading && initPhase === "model"
        ? copy.loadingPoseModel
        : loading && initPhase === "camera"
          ? copy.startingCamera
          : null;

  useEffect(() => {
    if (!consented || skipped) return;
    auditPreviewLayers(
      "render-state",
      videoRef.current,
      canvasRef.current,
      previewContainerRef.current,
      {
        consented,
        cameraLive,
        previewActive,
        trackingStopped,
        showPreviewUi,
        loading,
        initPhase,
        cameraPhase: loading ? initPhase ?? "idle" : previewActive ? "tracking" : "idle",
      },
    );
  }, [
    consented,
    skipped,
    cameraLive,
    previewActive,
    trackingStopped,
    showPreviewUi,
    loading,
    initPhase,
  ]);

  useEffect(() => {
    if (!cameraLive || !previewActive || trackingStopped) return;
    const video = videoRef.current;
    if (!video) return;

    const checkFrames = () => {
      if (!isVideoPreviewRenderable(video)) {
        setNoVideoFrames(true);
        auditPreviewLayers(
          "no-frames-detected",
          video,
          canvasRef.current,
          previewContainerRef.current,
          { cameraPhase: "tracking", previewActive: true },
        );
        return;
      }
      setNoVideoFrames(false);
    };

    const id = window.setInterval(checkFrames, 2_000);
    checkFrames();
    return () => window.clearInterval(id);
  }, [cameraLive, previewActive, trackingStopped]);

  useEffect(() => {
    if (!cvDebugEnabled || skipped || !consented || stanceLegRequired) {
      setDebugSnapshot(null);
      return;
    }
    const tick = () => {
      const detector = detectorRef.current;
      const frames = detector?.getSnapshot().framesTotal ?? framesTotal;
      setDebugSnapshot(collectPatientCvDebugSnapshot(videoRef.current, frames));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [cvDebugEnabled, skipped, consented, stanceLegRequired, framesTotal, previewActive, cameraLive]);

  const handleTryAgain = useCallback(() => {
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    disposeStsMotionTimelineRefs(stsTimelineRefs);
    disposeHeelRaiseMotionTimelineRefs(hrTimelineRefs);
    disposeStepUpMotionTimelineRefs(suTimelineRefs);
    setCameraLive(false);
    setTrackingStopped(false);
    setError(null);
    setTrackingError(null);
    setNoVideoFrames(false);
    lastReportedRepRef.current = -1;
    lastReportedHoldRef.current = -1;
    stopInProgressRef.current = false;
    startInProgressRef.current = false;
  }, [syncFromDetector, stsTimelineRefs, hrTimelineRefs, suTimelineRefs]);

  const trackingStatusLabel = (() => {
    if (loading && initPhase === "import") return copy.loadingPoseLibrary;
    if (loading && initPhase === "model") return copy.loadingPoseModel;
    if (loading && initPhase === "camera") return copy.startingCamera;
    if (trackingStopped) return copy.stopTracking;
    if (trackingStatus === "pose-lost") return copy.poseNotDetectedLabel;
    if (bodyFramingState === "checking" || poseReadiness === "checking") {
      return copy.checkingCameraPosition;
    }
    if (bodyFramingState === "move_back") return copy.framingMoveBack;
    if (bodyFramingState === "move_closer") return copy.framingMoveCloser;
    if (bodyFramingState === "adjust_camera_angle") return copy.framingAdjustAngle;
    if (bodyFramingState === "low_visibility") return copy.framingLowVisibility;
    if (poseReadiness === "not_ready") return copy.adjustPhoneBodyChairLabel;
    if (poseReadiness === "partial") return copy.almostReadyLabel;
    if (poseReadiness === "ready") return copy.framingGoodDistance;
    return copy.checkingCameraPosition;
  })();

  const showReadinessActions =
    previewActive &&
    !trackingStopped &&
    (poseReadiness === "not_ready" ||
      trackingStatus === "pose-lost" ||
      (bodyFramingState !== "good_distance" && bodyFramingState !== "checking"));

  const formatDuration = (() => {
    if (exerciseId === "step-up") return formatStepUpDuration;
    if (exerciseId === "heel-raise") return formatHeelRaiseDuration;
    if (exerciseId === "mini-squat") return formatMiniSquatDuration;
    if (exerciseId === "single-leg-stance") return formatSingleLegStanceDuration;
    return formatSitToStandDuration;
  })();

  const liveBodySignal: LiveBodySignal = resolveLiveBodySignal({
    trackingStatus,
    poseReadiness,
    bodyFramingState,
  });

  const liveSignalLabel =
    liveBodySignal === "body_visible"
      ? copy.liveSignalBodyVisible
      : liveBodySignal === "move_back_lighting"
        ? copy.liveSignalMoveBackLighting
        : copy.liveSignalAdjustPosition;

  const liveSignalStyles =
    liveBodySignal === "body_visible"
      ? "border-[#D1E7DE] bg-[#F0FAF6] text-[#1D9E75]"
      : liveBodySignal === "move_back_lighting"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-[#E2E8E5] bg-[#F9FAFB] text-[#374151]";

  const liveSignalDotClass =
    liveBodySignal === "body_visible"
      ? "bg-[#1D9E75]"
      : liveBodySignal === "move_back_lighting"
        ? "bg-amber-500"
        : "bg-[#9CA3AF]";

  const showSessionStats = cameraLive && (previewActive || trackingStopped);

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
        {copy.supportNearWallHint ? (
          <p className="mt-2 text-[12px] leading-relaxed text-[#374151]">{copy.supportNearWallHint}</p>
        ) : null}
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

  if (stanceLegRequired) {
    return (
      <div
        className={`border-b border-[#D1E7DE] bg-white px-4 py-4 ${arClass}`}
        dir={textDir}
        lang={language}
      >
        <p className="text-[11px] font-semibold text-[#1D9E75]">{copy.optionalCameraNote}</p>
        {copy.supportNearWallHint ? (
          <p className="mt-2 text-[12px] leading-relaxed text-[#374151]">{copy.supportNearWallHint}</p>
        ) : null}
        <h3 className={`mt-3 text-[15px] font-bold text-[#0A0F1A] ${arClass}`}>
          {copy.stanceLegPickerTitle}
        </h3>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStanceLeg("left")}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40"
          >
            {copy.stanceLegLeftLabel}
          </button>
          <button
            type="button"
            onClick={() => setStanceLeg("right")}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40"
          >
            {copy.stanceLegRightLabel}
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
      <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{copy.movementInstruction}</p>
      <p className="mt-1 text-[11px] text-[#6B7280]">{copy.hipLandmarksHint}</p>

      {(loading || (!previewActive && !cameraLive && !error)) && (
        <p className="mt-2 text-[12px] font-medium text-[#6B7280]">
          {loading ? loadingLabel : copy.setupCheckingCamera}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12px] text-rose-800">
          <p>{error}</p>
          {!previewActive && !cameraLive && !loading && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void startCameraTracking();
              }}
              className="mt-2 text-[12px] font-semibold text-[#1D9E75] underline"
            >
              {copy.tryAgainLabel}
            </button>
          )}
        </div>
      )}

      {trackingError && showPreviewUi && (
        <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
          {trackingError}
        </div>
      )}

      <PatientCameraPreviewStack
        videoRef={videoRef}
        canvasRef={canvasRef}
        containerRef={previewContainerRef}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        ariaLabel={copy.consentTitle}
        loadingHint={previewLoadingHint}
      />

      {noVideoFrames && (
        <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
          <p>{PATIENT_CAMERA_NO_FRAMES_MESSAGE}</p>
          <p className="mt-1 text-[11px]">{copy.continueWithoutCamera}</p>
          <button
            type="button"
            onClick={() => {
              handleTryAgain();
            }}
            className="mt-2 text-[12px] font-semibold text-[#1D9E75] underline"
          >
            {copy.tryAgainLabel}
          </button>
        </div>
      )}

      {cvDebugEnabled && debugSnapshot ? (
        <PatientCameraDebugPanel snapshot={debugSnapshot} />
      ) : null}

      {showPreviewUi && (
        <div
          className={`mt-2 flex items-center gap-2 rounded-[6px] border px-3 py-2 text-[12px] font-semibold ${liveSignalStyles} ${arClass}`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${liveSignalDotClass}`}
            aria-hidden
          />
          <span>{liveSignalLabel}</span>
        </div>
      )}

      {previewActive && !trackingStopped && (
        <button
          type="button"
          disabled={stopInProgressRef.current}
          onClick={handleStopSession}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40 disabled:opacity-50"
        >
          {copy.stopTracking}
        </button>
      )}

      {trackingStopped && (
        <p className="mt-3 text-[12px] font-medium text-[#374151]" role="status">
          {copy.stopTracking}
        </p>
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
        </div>
      )}

      {baselineCalibrating && (poseReadiness === "ready" || poseReadiness === "partial") && previewActive && (
        <p className="mt-3 text-[12px] font-medium text-[#1D9E75]">{copy.baselineStandStillHint}</p>
      )}

      {showSessionStats && (
        <div className="mt-4 space-y-2 rounded-[8px] border border-[#D1E7DE] bg-[#F9FAFB] px-3.5 py-3">
          <p className="text-[12px] font-semibold text-[#374151]">
            <span className="text-[#6B7280]">{copy.trackingSignalLabel}: </span>
            {trackingStatusLabel}
          </p>

          {holdExercise && copy.holdTimeTracked ? (
            <p
              className="text-[28px] font-bold text-[#1D9E75]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {copy.holdTimeTracked(formatDuration(sessionSeconds))}
            </p>
          ) : (
            <p
              className="text-[28px] font-bold text-[#1D9E75]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {copy.repsCounted(repCount)}
            </p>
          )}

          {!holdExercise ? (
            <p className="text-[13px] text-[#374151]">
              {copy.sessionDuration(formatDuration(sessionSeconds))}
            </p>
          ) : null}

          <p className="text-[12px] text-[#6B7280]">
            {movementDetected ? copy.movementDetectedYes : copy.movementDetectedNo}
          </p>

          <p className="text-[10px] leading-relaxed text-[#9CA3AF]">{copy.prototypeNotice}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => skipCameraWithoutSave()}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] text-[14px] font-semibold text-[#374151] transition hover:border-[#1D9E75]/40"
      >
        {copy.continueWithoutCamera}
      </button>
    </div>
  );
}
