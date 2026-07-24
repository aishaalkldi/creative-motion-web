"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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
  isFunctionalReachMotionPilotEnabled,
  isHeelRaiseMotionPilotEnabled,
  isLateralStepMotionPilotEnabled,
  isStepUpMotionPilotEnabled,
  PATIENT_FUNCTIONAL_REACH_POSE_SHELL,
  PATIENT_HEEL_RAISE_POSE_SHELL,
  PATIENT_LATERAL_STEP_POSE_SHELL,
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
  FunctionalReachPoseDetector,
  formatFunctionalReachDuration,
  mapFunctionalReachStartError,
  type FunctionalReachPoseDetectorSnapshot,
} from "@/app/lib/cv/functional-reach-pose-detector";
import {
  buildFunctionalReachMotionPilotRecordFromSummary,
  buildMotionQualityWithFrPilot,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
import {
  LateralStepPoseDetector,
  formatLateralStepDuration,
  mapLateralStepStartError,
  type LateralStepPoseDetectorSnapshot,
} from "@/app/lib/cv/lateral-step-pose-detector";
import {
  buildLateralStepMotionPilotRecordFromSummary,
  buildMotionQualityWithLsPilot,
} from "@/app/lib/cv/lateral-step-motion-pilot-record";
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
  beginFunctionalReachMotionTimeline,
  createFunctionalReachTimelineCaptureRefs,
  disposeFunctionalReachMotionTimelineRefs,
  finalizeFunctionalReachMotionTimelineCapture,
  logFunctionalReachMotionTimelineSummaryDebug,
  recordFunctionalReachMotionTimelineTick,
  tryFinalizeFunctionalReachTimelineBeforePilotSave,
} from "@/app/lib/cv/patient-cv-functional-reach-timeline";
import {
  beginLateralStepMotionTimeline,
  createLateralStepTimelineCaptureRefs,
  disposeLateralStepMotionTimelineRefs,
  finalizeLateralStepMotionTimelineCapture,
  logLateralStepMotionTimelineSummaryDebug,
  recordLateralStepMotionTimelineTick,
  tryFinalizeLateralStepTimelineBeforePilotSave,
} from "@/app/lib/cv/patient-cv-lateral-step-timeline";
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
import type { BodyFramingDiagnostics } from "@/app/lib/cv/body-framing-evaluator";
import {
  resolveLiveBodySignal,
  type LiveBodySignal,
} from "@/app/lib/cv/pose-landmark-overlay";
import type {
  StsAttemptType,
  StsCapturePhase,
} from "@/app/lib/cv/sts-biomechanical-capture-fsm";
import { stsAttemptOutcomeCopy } from "@/app/lib/cv/sts-attempt-reason-copy";
import {
  stsCalibratingCopy,
  stsCapturePhaseCopy,
  stsPoseDetectedCopy,
  stsReadinessCopy,
} from "@/app/lib/cv/sts-tracking-status-copy";
import {
  CameraHUD,
  type CameraHudMode,
  type CameraHudTrackingSignal,
} from "@/app/components/patient/cv/CameraHUD";
import { PatientCvCaptureReliabilityPanel } from "@/app/components/patient/cv/PatientCvCaptureReliabilityPanel";
import { PatientCvSetupPanel } from "@/app/components/patient/cv/PatientCvSetupPanel";
import { PatientTrackingStatusPanel } from "@/app/components/patient/cv/PatientTrackingStatusPanel";
import {
  appendNoTimelineSnapshotsFlag,
  buildPatientCvCaptureReliabilityState,
  resolveLastMovementEvent,
  resolvePatientSessionCaptureOutcome,
  readLiveTimelineSnapshotCount,
  shouldShowNoSnapshotCaptureWarning,
  type PatientSessionCaptureOutcome,
  type TimelineAccumulatorProbe,
} from "@/app/lib/cv/patient-cv-capture-reliability";
import {
  CAPTURE_SETUP_LIMITED_FLAG,
  evaluateCaptureReadiness,
  resolveCaptureSetupGuidance,
  shouldFlagCaptureSetupLimited,
  updateStableTrackingState,
  type CaptureSetupGuidance,
  type StableTrackingState,
} from "@/app/lib/cv/patient-cv-capture-readiness";
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
import {
  createPatientCvCameraConsentRecord,
  readPatientCvCameraConsentFromSession,
  writePatientCvCameraConsentToSession,
  type PatientCvCameraConsentRecord,
} from "@/app/lib/cv/patient-cv-consent";

const METRICS_REPORT_INTERVAL_MS = 3_000;

function isHoldCvExercise(exerciseId: CvY1ExerciseId): boolean {
  return exerciseId === "single-leg-stance";
}

function resolveCameraHudMode(exerciseId: CvY1ExerciseId): CameraHudMode {
  if (exerciseId === "single-leg-stance") return "hold";
  if (exerciseId === "functional-reach") return "reach";
  if (exerciseId === "step-up" || exerciseId === "lateral-step") return "cycles";
  return "reps";
}

function mapTrackingSignal(
  trackingQuality: SitToStandTrackingQuality | null,
): CameraHudTrackingSignal {
  return trackingQuality ?? "none";
}

type CvDetectorSnapshot =
  | SitToStandDetectorSnapshot
  | MiniSquatDetectorSnapshot
  | SingleLegStancePoseDetectorSnapshot
  | HeelRaisePoseDetectorSnapshot
  | StepUpPoseDetectorSnapshot
  | FunctionalReachPoseDetectorSnapshot
  | LateralStepPoseDetectorSnapshot;

type PatientCvDetector =
  | SitToStandDetector
  | MiniSquatDetector
  | SingleLegStancePoseDetector
  | HeelRaisePoseDetector
  | StepUpPoseDetector
  | FunctionalReachPoseDetector
  | LateralStepPoseDetector;

type PatientCameraPreviewStackProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  ariaLabel: string;
  loadingHint?: string | null;
  overlay?: ReactNode;
  /**
   * Layout: real camera aspect ratio (video.videoWidth/videoHeight), once known,
   * so object-contain letterboxes to zero and the canvas overlay (stretched to
   * fill the same box) stays pixel-aligned with the video. Falls back to the
   * exercise's configured canvasWidth/canvasHeight ratio before metadata loads.
   */
  aspectRatioOverride?: number | null;
  onVideoLoadedMetadata?: () => void;
  /** Layout: renders the preview at a larger, fixed-position size. Visual only. */
  expanded?: boolean;
};

type PatientCameraVideoLayerProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  onLoadedMetadata?: () => void;
};

const PatientCameraVideoLayer = memo(function PatientCameraVideoLayer({
  videoRef,
  canvasRef,
  canvasWidth,
  canvasHeight,
  onLoadedMetadata,
}: PatientCameraVideoLayerProps) {
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={onLoadedMetadata}
        className="block h-full w-full object-contain"
      />
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </>
  );
});

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
  overlay,
  aspectRatioOverride,
  onVideoLoadedMetadata,
  expanded,
}: PatientCameraPreviewStackProps) {
  const aspectRatio = aspectRatioOverride ?? canvasWidth / canvasHeight;
  // Both wrapper divs stay mounted — only classNames/styles toggle with `expanded`.
  // Keeps video/canvas DOM stable (no remount / stream loss). When not expanded the
  // outer wrapper is in-flow (`relative w-full`) and must not widen past the column.
  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          : "relative w-full"
      }
    >
      <div
        ref={containerRef}
        className={
          expanded
            ? "relative w-full max-w-5xl overflow-hidden rounded-[8px] border border-[#D1E7DE] bg-black"
            : "relative mt-3 w-full max-w-full overflow-hidden rounded-[8px] border border-[#D1E7DE] bg-black"
        }
        style={{
          aspectRatio,
          maxHeight: expanded ? "calc(100vh - 2rem)" : undefined,
        }}
        aria-label={ariaLabel}
      >
        <PatientCameraVideoLayer
          videoRef={videoRef}
          canvasRef={canvasRef}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onLoadedMetadata={onVideoLoadedMetadata}
        />
        {overlay}
        {loadingHint ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-[12px] font-medium text-white">
            {loadingHint}
          </div>
        ) : null}
      </div>
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
  /** Prescribed rep/cycle/reach target — shown on live HUD when set. */
  target?: number;
  onMetricsUpdate?: (metrics: PatientCvDerivedMetrics) => void;
  onSkipped?: () => void;
  onRegisterMetricsFlush?: (flush: () => void) => void;
  onRegisterStsPilotBeforeSave?: (beforeSave: () => void) => void;
  onRegisterStsPilotRecordFlush?: (flush: () => CvMotionQualityPayload | null) => void;
  onRegisterCaptureConsent?: (getter: () => PatientCvCameraConsentRecord | null) => void;
  onCaptureReadinessChange?: (payload: {
    primaryGuidance: CaptureSetupGuidance;
    canStartTracking: boolean;
    minimumMet: boolean;
    previewActive: boolean;
  }) => void;
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
  if (exerciseId === "functional-reach") {
    return {
      canvasWidth: PATIENT_FUNCTIONAL_REACH_POSE_SHELL.canvasWidth,
      canvasHeight: PATIENT_FUNCTIONAL_REACH_POSE_SHELL.canvasHeight,
    };
  }
  if (exerciseId === "lateral-step") {
    return {
      canvasWidth: PATIENT_LATERAL_STEP_POSE_SHELL.canvasWidth,
      canvasHeight: PATIENT_LATERAL_STEP_POSE_SHELL.canvasHeight,
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
    setStsLandmarkCoverageReady?: (v: boolean) => void;
    setSessionSeconds: (v: number) => void;
    setMovementDetected: (v: boolean) => void;
    setBaselineCalibrating: (v: boolean) => void;
    setFramesTotal: (v: number) => void;
    /** Tracking observability foundation: STS-only, undefined for other exercises. */
    setStsCapturePhase?: (v: StsCapturePhase | undefined) => void;
    setCalibrationProgressPct?: (v: number | null) => void;
    setLastAttemptType?: (v: StsAttemptType | null) => void;
    setLastAttemptReason?: (v: string | null) => void;
    /** Diagnostic foundation: STS-only, debug use only. */
    setBodyFramingDiagnostics?: (v: BodyFramingDiagnostics | null) => void;
    setCanCount?: (v: boolean) => void;
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
  if (
    setters.setStsLandmarkCoverageReady &&
    "stsLandmarkCoverageReady" in snapshot
  ) {
    setters.setStsLandmarkCoverageReady(Boolean(snapshot.stsLandmarkCoverageReady));
  }
  if (setters.setStsCapturePhase && "capturePhase" in snapshot) {
    setters.setStsCapturePhase(snapshot.capturePhase);
  }
  if (setters.setCalibrationProgressPct && "calibrationProgressPct" in snapshot) {
    setters.setCalibrationProgressPct(snapshot.calibrationProgressPct ?? null);
  }
  if (setters.setLastAttemptType && "lastAttemptType" in snapshot) {
    setters.setLastAttemptType(snapshot.lastAttemptType ?? null);
  }
  if (setters.setLastAttemptReason && "lastAttemptReason" in snapshot) {
    setters.setLastAttemptReason(snapshot.lastAttemptReason ?? null);
  }
  if (setters.setBodyFramingDiagnostics && "bodyFramingDiagnostics" in snapshot) {
    setters.setBodyFramingDiagnostics(snapshot.bodyFramingDiagnostics ?? null);
  }
  if (setters.setCanCount && "canCount" in snapshot) {
    setters.setCanCount(Boolean(snapshot.canCount));
  }
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
  target,
  onMetricsUpdate,
  onSkipped,
  onRegisterMetricsFlush,
  onRegisterStsPilotBeforeSave,
  onRegisterStsPilotRecordFlush,
  onRegisterCaptureConsent,
  onCaptureReadinessChange,
}: PatientCvCaptureProps) {
  const copy = patientCvCopy(language, exerciseId);
  const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } =
    canvasSizeForExercise(exerciseId);

  const [skipped, setSkipped] = useState(false);
  const [consented, setConsented] = useState(false);
  const [consentCheckboxChecked, setConsentCheckboxChecked] = useState(false);
  const captureConsentRef = useRef<PatientCvCameraConsentRecord | null>(null);
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
  const [stsLandmarkCoverageReady, setStsLandmarkCoverageReady] = useState(false);
  // Tracking observability foundation (STS only) — see PatientTrackingStatusPanel.
  const [stsCapturePhase, setStsCapturePhase] = useState<StsCapturePhase | undefined>(undefined);
  const [calibrationProgressPct, setCalibrationProgressPct] = useState<number | null>(null);
  const [lastAttemptType, setLastAttemptType] = useState<StsAttemptType | null>(null);
  const [lastAttemptReason, setLastAttemptReason] = useState<string | null>(null);
  // Body-framing diagnostic foundation (STS only, debug use only).
  const [bodyFramingDiagnostics, setBodyFramingDiagnostics] =
    useState<BodyFramingDiagnostics | null>(null);
  const [canCount, setCanCount] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [movementDetected, setMovementDetected] = useState(false);
  const [baselineCalibrating, setBaselineCalibrating] = useState(false);
  const [stanceLeg, setStanceLeg] = useState<StanceLeg | null>(null);
  const [trackingConfirmed, setTrackingConfirmed] = useState(false);
  const [trackingStartedAutomatically, setTrackingStartedAutomatically] = useState(false);
  const [stableSeconds, setStableSeconds] = useState(0);
  const [lastMovementEvent, setLastMovementEvent] = useState("—");
  const [detectorPhase, setDetectorPhase] = useState("—");
  const [showNoSnapshotWarning, setShowNoSnapshotWarning] = useState(false);
  const [sessionCaptureOutcome, setSessionCaptureOutcome] =
    useState<PatientSessionCaptureOutcome | null>(null);
  const [reliabilityTick, setReliabilityTick] = useState(0);
  const [lastRepAccepted, setLastRepAccepted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [videoElReady, setVideoElReady] = useState(false);
  const [noVideoFrames, setNoVideoFrames] = useState(false);
  const [framesTotal, setFramesTotal] = useState(0);
  const [cvDebugEnabled, setCvDebugEnabled] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<PatientCvDebugSnapshot | null>(null);
  // Layout: real camera aspect ratio (once known) and the optional expanded-view toggle.
  // Visual only — does not affect the detector, camera resolution, or MediaPipe input.
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setVideoAspectRatio(video.videoWidth / video.videoHeight);
  }, []);
  const detectorRef = useRef<PatientCvDetector | null>(null);
  const startInProgressRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const lastReportedRepRef = useRef(-1);
  const lastReportedHoldRef = useRef(-1);
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  const stsTimelineRefs = useRef(createStsTimelineCaptureRefs()).current;
  const hrTimelineRefs = useRef(createHeelRaiseTimelineCaptureRefs()).current;
  const suTimelineRefs = useRef(createStepUpTimelineCaptureRefs()).current;
  const frTimelineRefs = useRef(createFunctionalReachTimelineCaptureRefs()).current;
  const lsTimelineRefs = useRef(createLateralStepTimelineCaptureRefs()).current;
  const trackingConfirmedRef = useRef(false);
  const stableTrackingRef = useRef<StableTrackingState>({
    stableSinceMs: null,
    stableSeconds: 0,
  });
  const captureSetupLimitedRef = useRef(false);
  const trackingConfirmedAtMsRef = useRef<number | null>(null);
  const movementProbeRef = useRef({
    repCount: 0,
    movementDetected: false,
    phase: undefined as string | undefined,
    trackingStatus: "idle" as SitToStandTrackingStatus,
  });

  useEffect(() => {
    trackingConfirmedRef.current = trackingConfirmed;
  }, [trackingConfirmed]);

  useEffect(() => {
    if (!lastRepAccepted) return;
    const id = window.setTimeout(() => setLastRepAccepted(false), 1_500);
    return () => window.clearTimeout(id);
  }, [lastRepAccepted]);

  useEffect(() => {
    onMetricsUpdateRef.current = onMetricsUpdate;
  }, [onMetricsUpdate]);

  const getActiveTimelineAcc = useCallback((): TimelineAccumulatorProbe => {
    if (exerciseId === "sit-to-stand") return stsTimelineRefs.acc.current;
    if (exerciseId === "heel-raise") return hrTimelineRefs.acc.current;
    if (exerciseId === "step-up") return suTimelineRefs.acc.current;
    if (exerciseId === "functional-reach") return frTimelineRefs.acc.current;
    if (exerciseId === "lateral-step") return lsTimelineRefs.acc.current;
    return null;
  }, [exerciseId, stsTimelineRefs, hrTimelineRefs, suTimelineRefs, frTimelineRefs, lsTimelineRefs]);

  const buildExtraClinicianFlags = useCallback((snapshotCount: number): string[] | undefined => {
    let flags: string[] = [];
    if (captureSetupLimitedRef.current) flags.push(CAPTURE_SETUP_LIMITED_FLAG);
    flags = appendNoTimelineSnapshotsFlag(flags, snapshotCount);
    return flags.length > 0 ? flags : undefined;
  }, []);

  useEffect(() => {
    setCvDebugEnabled(isPatientCvDebugEnabled());
  }, []);

  const reportMetrics = useCallback(() => {
    if (!trackingConfirmedRef.current) return;
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
      const probe = movementProbeRef.current;
      const movementEvent = resolveLastMovementEvent({
        previousRepCount: probe.repCount,
        previousMovementDetected: probe.movementDetected,
        previousPhase: probe.phase,
        previousTrackingStatus: probe.trackingStatus,
        repCount: snapshot.repCount,
        movementDetected: snapshot.movementDetected,
        phase: snapshot.standPhase,
        trackingStatus: snapshot.trackingStatus,
        exerciseId,
      });
      if (movementEvent) {
        setLastMovementEvent(movementEvent);
      }
      movementProbeRef.current = {
        repCount: snapshot.repCount,
        movementDetected: snapshot.movementDetected,
        phase: snapshot.standPhase,
        trackingStatus: snapshot.trackingStatus,
      };
      setDetectorPhase(snapshot.standPhase ?? "—");
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
        setStsLandmarkCoverageReady:
          exerciseId === "sit-to-stand" ? setStsLandmarkCoverageReady : undefined,
        setStsCapturePhase: exerciseId === "sit-to-stand" ? setStsCapturePhase : undefined,
        setCalibrationProgressPct:
          exerciseId === "sit-to-stand" ? setCalibrationProgressPct : undefined,
        setLastAttemptType: exerciseId === "sit-to-stand" ? setLastAttemptType : undefined,
        setLastAttemptReason: exerciseId === "sit-to-stand" ? setLastAttemptReason : undefined,
        setBodyFramingDiagnostics:
          exerciseId === "sit-to-stand" ? setBodyFramingDiagnostics : undefined,
        setCanCount: exerciseId === "sit-to-stand" ? setCanCount : undefined,
        setSessionSeconds,
        setMovementDetected,
        setBaselineCalibrating,
        setFramesTotal,
      });
      if (!trackingConfirmedRef.current) {
        const readinessEvaluation = evaluateCaptureReadiness(
          exerciseId,
          snapshot,
          stableTrackingRef.current.stableSeconds,
        );
        const nextStable = updateStableTrackingState(
          stableTrackingRef.current,
          readinessEvaluation.minimumMet,
          performance.now(),
        );
        stableTrackingRef.current = nextStable;
        setStableSeconds(nextStable.stableSeconds);
      }

      if (!snapshot.previewActive && !trackingStopped) return;
      if (!trackingConfirmedRef.current) return;
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
      if (exerciseId === "functional-reach") {
        recordFunctionalReachMotionTimelineTick(
          exerciseId,
          frTimelineRefs,
          snapshot as SitToStandDetectorSnapshot,
        );
      }
      if (exerciseId === "lateral-step") {
        recordLateralStepMotionTimelineTick(
          exerciseId,
          lsTimelineRefs,
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
        if (prevRep >= 0 && snapshot.repCount > prevRep) {
          setLastRepAccepted(true);
        }
        lastReportedRepRef.current = snapshot.repCount;
        reportMetrics();
      }
    },
    [
      exerciseId,
      reportMetrics,
      trackingStopped,
      stsTimelineRefs,
      hrTimelineRefs,
      suTimelineRefs,
      frTimelineRefs,
      lsTimelineRefs,
    ],
  );

  useEffect(() => {
    if (isHoldCvExercise(exerciseId) && stanceLeg === null) {
      detectorRef.current?.stop();
      detectorRef.current = null;
      return;
    }

    const detector: PatientCvDetector =
      exerciseId === "functional-reach"
        ? new FunctionalReachPoseDetector({ onSnapshot: syncFromDetector })
        : exerciseId === "lateral-step"
        ? new LateralStepPoseDetector({ onSnapshot: syncFromDetector })
        : exerciseId === "step-up"
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
      const frSummary = finalizeFunctionalReachMotionTimelineCapture(
        exerciseId,
        frTimelineRefs,
        detector,
      );
      if (frSummary && cvDebugEnabled) {
        logFunctionalReachMotionTimelineSummaryDebug(frSummary, frTimelineRefs);
      }
      disposeFunctionalReachMotionTimelineRefs(frTimelineRefs);
      const lsSummary = finalizeLateralStepMotionTimelineCapture(
        exerciseId,
        lsTimelineRefs,
        detector,
      );
      if (lsSummary && cvDebugEnabled) {
        logLateralStepMotionTimelineSummaryDebug(lsSummary, lsTimelineRefs);
      }
      disposeLateralStepMotionTimelineRefs(lsTimelineRefs);
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
    frTimelineRefs,
    lsTimelineRefs,
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
    const frSummary = tryFinalizeFunctionalReachTimelineBeforePilotSave(
      exerciseId,
      frTimelineRefs,
      detector,
    );
    if (frSummary && cvDebugEnabled) {
      logFunctionalReachMotionTimelineSummaryDebug(frSummary, frTimelineRefs);
    }
    const lsSummary = tryFinalizeLateralStepTimelineBeforePilotSave(
      exerciseId,
      lsTimelineRefs,
      detector,
    );
    if (lsSummary && cvDebugEnabled) {
      logLateralStepMotionTimelineSummaryDebug(lsSummary, lsTimelineRefs);
    }
  }, [
    exerciseId,
    stsTimelineRefs,
    hrTimelineRefs,
    suTimelineRefs,
    frTimelineRefs,
    lsTimelineRefs,
    cvDebugEnabled,
  ]);

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
    const attemptSummaries =
      "getStsAttemptSummaries" in detector &&
      typeof detector.getStsAttemptSummaries === "function"
        ? detector.getStsAttemptSummaries()
        : [];
    const record = buildStsMotionPilotRecord({
      summary,
      metrics,
      snapshotCount: stsTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      extraClinicianFlags: buildExtraClinicianFlags(
        stsTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      ),
      attemptSummaries,
    });
    return buildMotionQualityWithStsPilot(record);
  }, [exerciseId, stsTimelineRefs, buildExtraClinicianFlags]);

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
      extraClinicianFlags: buildExtraClinicianFlags(
        hrTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      ),
    });
    return buildMotionQualityWithHrPilot(record);
  }, [exerciseId, hrTimelineRefs, buildExtraClinicianFlags]);

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
      extraClinicianFlags: buildExtraClinicianFlags(
        suTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      ),
    });
    return buildMotionQualityWithSuPilot(record);
  }, [exerciseId, suTimelineRefs, buildExtraClinicianFlags]);

  const buildFunctionalReachPilotMotionQuality = useCallback((): CvMotionQualityPayload | null => {
    if (exerciseId !== "functional-reach" || !isFunctionalReachMotionPilotEnabled(exerciseId)) {
      return null;
    }
    const summary = frTimelineRefs.summary.current;
    if (!summary) return null;
    const detector = detectorRef.current;
    if (!detector) return null;
    const metrics = detector.getDerivedMetrics();
    if (metrics.exerciseId !== "functional-reach") return null;
    const record = buildFunctionalReachMotionPilotRecordFromSummary({
      summary,
      metrics,
      snapshotCount: frTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      extraClinicianFlags: buildExtraClinicianFlags(
        frTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      ),
    });
    return buildMotionQualityWithFrPilot(record);
  }, [exerciseId, frTimelineRefs, buildExtraClinicianFlags]);

  const buildLateralStepPilotMotionQuality = useCallback((): CvMotionQualityPayload | null => {
    if (exerciseId !== "lateral-step" || !isLateralStepMotionPilotEnabled(exerciseId)) {
      return null;
    }
    const summary = lsTimelineRefs.summary.current;
    if (!summary) return null;
    const detector = detectorRef.current;
    if (!detector) return null;
    const metrics = detector.getDerivedMetrics();
    if (metrics.exerciseId !== "lateral-step") return null;
    const record = buildLateralStepMotionPilotRecordFromSummary({
      summary,
      metrics,
      snapshotCount: lsTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      extraClinicianFlags: buildExtraClinicianFlags(
        lsTimelineRefs.lastFinalizeSnapshotCount.current ?? 0,
      ),
    });
    return buildMotionQualityWithLsPilot(record);
  }, [exerciseId, lsTimelineRefs, buildExtraClinicianFlags]);

  const buildMotionPilotRecordFlush = useCallback((): CvMotionQualityPayload | null => {
    return (
      buildStsPilotMotionQuality() ??
      buildHeelRaisePilotMotionQuality() ??
      buildStepUpPilotMotionQuality() ??
      buildFunctionalReachPilotMotionQuality() ??
      buildLateralStepPilotMotionQuality()
    );
  }, [
    buildStsPilotMotionQuality,
    buildHeelRaisePilotMotionQuality,
    buildStepUpPilotMotionQuality,
    buildFunctionalReachPilotMotionQuality,
    buildLateralStepPilotMotionQuality,
  ]);

  useEffect(() => {
    if (!onRegisterStsPilotRecordFlush) return;
    onRegisterStsPilotRecordFlush(buildMotionPilotRecordFlush);
    return () => onRegisterStsPilotRecordFlush(() => null);
  }, [onRegisterStsPilotRecordFlush, buildMotionPilotRecordFlush]);

  useEffect(() => {
    const stored = readPatientCvCameraConsentFromSession();
    if (!stored) return;
    captureConsentRef.current = stored;
    setConsentCheckboxChecked(true);
    setConsented(true);
  }, []);

  useEffect(() => {
    if (!onRegisterCaptureConsent) return;
    onRegisterCaptureConsent(() => captureConsentRef.current);
    return () => onRegisterCaptureConsent(() => null);
  }, [onRegisterCaptureConsent]);

  const acceptCameraConsent = useCallback(() => {
    if (!consentCheckboxChecked) return;
    const record = createPatientCvCameraConsentRecord();
    captureConsentRef.current = record;
    writePatientCvCameraConsentToSession(record);
    setConsented(true);
  }, [consentCheckboxChecked]);

  useEffect(() => {
    if (!trackingConfirmed) return;
    if (!previewActive && !trackingStopped) return;
    reportMetrics();
    const id = setInterval(reportMetrics, METRICS_REPORT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [trackingConfirmed, previewActive, trackingStopped, reportMetrics]);

  const skipCameraWithoutSave = useCallback(() => {
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    disposeStsMotionTimelineRefs(stsTimelineRefs);
    disposeHeelRaiseMotionTimelineRefs(hrTimelineRefs);
    disposeStepUpMotionTimelineRefs(suTimelineRefs);
    disposeFunctionalReachMotionTimelineRefs(frTimelineRefs);
    disposeLateralStepMotionTimelineRefs(lsTimelineRefs);
    setCameraLive(false);
    setTrackingStopped(false);
    setSkipped(true);
    onSkipped?.();
  }, [syncFromDetector, onSkipped, stsTimelineRefs, hrTimelineRefs, suTimelineRefs, frTimelineRefs, lsTimelineRefs]);

  const handleStopSession = useCallback(() => {
    const detector = detectorRef.current;
    if (stopInProgressRef.current || !detector?.isPreviewActive()) return;

    stopInProgressRef.current = true;
    reportMetrics();
    const snapshotCount = readLiveTimelineSnapshotCount(getActiveTimelineAcc());
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
    const frSummary = finalizeFunctionalReachMotionTimelineCapture(
      exerciseId,
      frTimelineRefs,
      detector,
    );
    if (frSummary && cvDebugEnabled) {
      logFunctionalReachMotionTimelineSummaryDebug(frSummary, frTimelineRefs);
    }
    const lsSummary = finalizeLateralStepMotionTimelineCapture(
      exerciseId,
      lsTimelineRefs,
      detector,
    );
    if (lsSummary && cvDebugEnabled) {
      logLateralStepMotionTimelineSummaryDebug(lsSummary, lsTimelineRefs);
    }
    detector.stop();
    const endSnapshot = detector.getSnapshot() as CvDetectorSnapshot;
    setSessionCaptureOutcome(
      resolvePatientSessionCaptureOutcome({
        captureSetupLimited: captureSetupLimitedRef.current,
        snapshotCount,
        trackingQuality: endSnapshot.trackingQuality ?? null,
        trackingStatus: endSnapshot.trackingStatus,
      }),
    );
    setCameraLive(false);
    setTrackingStopped(true);
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
    frTimelineRefs,
    lsTimelineRefs,
    cvDebugEnabled,
    getActiveTimelineAcc,
  ]);

  const mapStartError =
    exerciseId === "functional-reach"
      ? mapFunctionalReachStartError
      : exerciseId === "lateral-step"
      ? mapLateralStepStartError
      : exerciseId === "step-up"
      ? mapStepUpStartError
      : exerciseId === "heel-raise"
        ? mapHeelRaiseStartError
        : exerciseId === "mini-squat"
          ? mapMiniSquatStartError
          : exerciseId === "single-leg-stance"
            ? mapSingleLegStanceStartError
            : mapSitToStandStartError;

  const beginMotionTimelines = useCallback(() => {
    beginStsMotionTimeline(exerciseId, stsTimelineRefs);
    beginHeelRaiseMotionTimeline(exerciseId, hrTimelineRefs);
    beginStepUpMotionTimeline(exerciseId, suTimelineRefs);
    beginFunctionalReachMotionTimeline(exerciseId, frTimelineRefs);
    beginLateralStepMotionTimeline(exerciseId, lsTimelineRefs);
  }, [exerciseId, stsTimelineRefs, hrTimelineRefs, suTimelineRefs, frTimelineRefs, lsTimelineRefs]);

  const confirmStartTracking = useCallback(
    (startedWithOverride: boolean) => {
      if (trackingConfirmedRef.current) return;
      const detector = detectorRef.current;
      if (!detector?.isPreviewActive()) return;

      const snapshot = detector.getSnapshot() as CvDetectorSnapshot;
      const evaluation = evaluateCaptureReadiness(
        exerciseId,
        snapshot,
        stableTrackingRef.current.stableSeconds,
      );
      captureSetupLimitedRef.current = shouldFlagCaptureSetupLimited(
        startedWithOverride,
        evaluation,
      );
      beginMotionTimelines();
      trackingConfirmedAtMsRef.current = performance.now();
      trackingConfirmedRef.current = true;
      setTrackingConfirmed(true);
      setShowNoSnapshotWarning(false);
      syncFromDetector(snapshot);
      reportMetrics();
    },
    [exerciseId, beginMotionTimelines, syncFromDetector, reportMetrics],
  );

  useEffect(() => {
    if (trackingConfirmed || trackingStopped || !previewActive) return;

    const evaluation = evaluateCaptureReadiness(
      exerciseId,
      {
        trackingStatus,
        trackingQuality,
        poseReadiness,
        bodyFramingState,
        previewActive,
        stsLandmarkCoverageReady:
          exerciseId === "sit-to-stand" ? stsLandmarkCoverageReady : undefined,
      },
      stableSeconds,
    );
    if (!evaluation.canStartTracking) return;

    setTrackingStartedAutomatically(true);
    confirmStartTracking(false);
  }, [
    trackingConfirmed,
    trackingStopped,
    previewActive,
    exerciseId,
    trackingStatus,
    trackingQuality,
    poseReadiness,
    bodyFramingState,
    stsLandmarkCoverageReady,
    stableSeconds,
    confirmStartTracking,
  ]);

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
      auditPreviewLayers("after-detector-start", video, canvas, previewContainerRef.current, {
        cameraLive: true,
        previewActive: detector.isPreviewActive(),
        cameraPhase: "setup",
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
    mapStartError,
    exerciseId,
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
    setTrackingConfirmed(false);
    setTrackingStartedAutomatically(false);
    setStableSeconds(0);
    setLastMovementEvent("—");
    setDetectorPhase("—");
    setShowNoSnapshotWarning(false);
    setLastRepAccepted(false);
    stableTrackingRef.current = { stableSinceMs: null, stableSeconds: 0 };
    captureSetupLimitedRef.current = false;
    trackingConfirmedAtMsRef.current = null;
    movementProbeRef.current = {
      repCount: 0,
      movementDetected: false,
      phase: undefined,
      trackingStatus: "idle",
    };
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

  // Tracking observability foundation (STS only) — always-visible, not debug-gated.
  const stsTrackingStatusPanelProps =
    exerciseId === "sit-to-stand"
      ? {
          poseDetectedLabel: stsPoseDetectedCopy(trackingStatus, textDir === "rtl"),
          readinessLabel: stsReadinessCopy(poseReadiness, bodyFramingState, textDir === "rtl"),
          isReady: poseReadiness === "ready" || poseReadiness === "partial",
          calibrationProgressPct,
          calibratingLabel: stsCalibratingCopy(textDir === "rtl"),
          movementStateLabel: stsCapturePhaseCopy(stsCapturePhase, textDir === "rtl"),
          lastOutcomeLabel: stsAttemptOutcomeCopy(
            lastAttemptType,
            lastAttemptReason,
            textDir === "rtl",
          ),
          lastOutcomeWasSuccess: lastAttemptType === "complete",
          isRtl: textDir === "rtl",
        }
      : null;

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
      setReliabilityTick((n) => n + 1);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [cvDebugEnabled, skipped, consented, stanceLegRequired, framesTotal, previewActive, cameraLive]);

  useEffect(() => {
    if (!trackingConfirmed || trackingStopped) {
      setShowNoSnapshotWarning(false);
      return;
    }
    const tick = () => {
      const acc = getActiveTimelineAcc();
      const snapshotCount = acc?.isActive() ? acc.getSnapshotCount() : 0;
      setShowNoSnapshotWarning(
        shouldShowNoSnapshotCaptureWarning({
          trackingConfirmed: true,
          trackingConfirmedAtMs: trackingConfirmedAtMsRef.current,
          snapshotCount,
          nowMs: performance.now(),
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [trackingConfirmed, trackingStopped, getActiveTimelineAcc, reliabilityTick]);

  const handleTryAgain = useCallback(() => {
    const detector = detectorRef.current;
    detector?.stop();
    if (detector) syncFromDetector(detector.getSnapshot());
    disposeStsMotionTimelineRefs(stsTimelineRefs);
    disposeHeelRaiseMotionTimelineRefs(hrTimelineRefs);
    disposeStepUpMotionTimelineRefs(suTimelineRefs);
    disposeFunctionalReachMotionTimelineRefs(frTimelineRefs);
    disposeLateralStepMotionTimelineRefs(lsTimelineRefs);
    setCameraLive(false);
    setTrackingStopped(false);
    setError(null);
    setTrackingError(null);
    setNoVideoFrames(false);
    setTrackingConfirmed(false);
    setTrackingStartedAutomatically(false);
    setStableSeconds(0);
    setLastMovementEvent("—");
    setDetectorPhase("—");
    setShowNoSnapshotWarning(false);
    setSessionCaptureOutcome(null);
    setLastRepAccepted(false);
    stableTrackingRef.current = { stableSinceMs: null, stableSeconds: 0 };
    captureSetupLimitedRef.current = false;
    trackingConfirmedAtMsRef.current = null;
    movementProbeRef.current = {
      repCount: 0,
      movementDetected: false,
      phase: undefined,
      trackingStatus: "idle",
    };
    lastReportedRepRef.current = -1;
    lastReportedHoldRef.current = -1;
    stopInProgressRef.current = false;
    startInProgressRef.current = false;
  }, [syncFromDetector, stsTimelineRefs, hrTimelineRefs, suTimelineRefs, frTimelineRefs, lsTimelineRefs]);

  const trackingStatusLabel = (() => {
    if (loading && initPhase === "import") return copy.loadingPoseLibrary;
    if (loading && initPhase === "model") return copy.loadingPoseModel;
    if (loading && initPhase === "camera") return copy.startingCamera;
    if (trackingStopped) return copy.stopTracking;
    if (trackingStatus === "pose-lost") return copy.setupGuidanceStepIntoFrame;
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
    if (exerciseId === "functional-reach") return formatFunctionalReachDuration;
    if (exerciseId === "lateral-step") return formatLateralStepDuration;
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

  const captureReadiness = evaluateCaptureReadiness(
    exerciseId,
    {
      trackingStatus,
      trackingQuality,
      poseReadiness,
      bodyFramingState,
      previewActive,
      stsLandmarkCoverageReady:
        exerciseId === "sit-to-stand" ? stsLandmarkCoverageReady : undefined,
    },
    stableSeconds,
  );

  useEffect(() => {
    onCaptureReadinessChange?.({
      primaryGuidance: captureReadiness.primaryGuidance,
      canStartTracking: captureReadiness.canStartTracking,
      minimumMet: captureReadiness.minimumMet,
      previewActive,
    });
  }, [
    onCaptureReadinessChange,
    captureReadiness.primaryGuidance,
    captureReadiness.canStartTracking,
    captureReadiness.minimumMet,
    previewActive,
  ]);

  const setupGuidanceCopy = (guidance: CaptureSetupGuidance): string => {
    switch (guidance) {
      case "move_farther":
        return copy.setupGuidanceMoveFarther;
      case "step_into_frame":
        return copy.setupGuidanceStepIntoFrame;
      case "improve_lighting":
        return copy.setupGuidanceImproveLighting;
      case "show_feet":
        return copy.setupGuidanceFeetVisible;
      case "keep_reach_arm_in_frame":
        return copy.setupGuidanceReachArmInFrame;
      case "ready":
        return copy.setupStateReadyToStart;
      default:
        return copy.setupGuidanceAdjustPosition;
    }
  };

  const movementNotDetectedLabel =
    !movementDetected && trackingConfirmed
      ? setupGuidanceCopy(
          resolveCaptureSetupGuidance(exerciseId, {
            trackingStatus,
            trackingQuality,
            poseReadiness,
            bodyFramingState,
            previewActive,
          }),
        )
      : copy.movementDetectedNo;

  const showSessionStats =
    trackingConfirmed && cameraLive && (previewActive || trackingStopped);

  const showCameraHud =
    trackingConfirmed && previewActive && !trackingStopped && cameraLive;

  const cameraHudMode = resolveCameraHudMode(exerciseId);

  const captureReliabilityState = buildPatientCvCaptureReliabilityState({
    cameraActive: cameraLive || previewActive,
    trackingStatus,
    trackingConfirmed,
    timelineAcc: getActiveTimelineAcc(),
    detectorPhase,
    readinessChecks: captureReadiness.checks,
    repOrCycleCount: holdExercise ? sessionSeconds : repCount,
    lastMovementEvent,
  });

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
          <label className="mt-1 flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-[#D1E7DE] bg-[#F9FAFB] px-3 py-2.5">
            <input
              type="checkbox"
              checked={consentCheckboxChecked}
              onChange={(event) => setConsentCheckboxChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1D9E75]"
            />
            <span className="text-[12px] leading-relaxed text-[#374151]">{copy.consentCheckboxLabel}</span>
          </label>
          <p className="text-[12px] text-[#6B7280]">
            {copy.consentLegalNote}{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#1D9E75] underline underline-offset-2"
            >
              {copy.consentPrivacyLinkLabel}
            </Link>
            {" · "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#1D9E75] underline underline-offset-2"
            >
              {copy.consentTermsLinkLabel}
            </Link>
          </p>
          <p className="text-[11px] text-[#9CA3AF]">{copy.therapistReviewOnly}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={acceptCameraConsent}
            disabled={!consentCheckboxChecked}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[14px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-45"
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
      {trackingConfirmed ? (
        <>
          <p className="text-[11px] text-[#6B7280]">{copy.moveComfortably}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#374151]">{copy.framingInstruction}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{copy.movementInstruction}</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">{copy.hipLandmarksHint}</p>
        </>
      ) : null}

      {(loading || (!previewActive && !cameraLive && !error && !trackingConfirmed)) && (
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
        aspectRatioOverride={videoAspectRatio}
        onVideoLoadedMetadata={handleVideoLoadedMetadata}
        expanded={expanded}
        overlay={
          <>
            {showCameraHud ? (
              <CameraHUD
                mode={cameraHudMode}
                count={repCount}
                target={target}
                trackingSignal={mapTrackingSignal(trackingQuality)}
                sessionSeconds={sessionSeconds}
                holdSeconds={holdExercise ? sessionSeconds : undefined}
                lastRepAccepted={lastRepAccepted}
                isRtl={textDir === "rtl"}
              />
            ) : null}
            {showPreviewUi ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`absolute top-2 ${textDir === "rtl" ? "left-2" : "right-2"} z-10 rounded-[6px] border border-white/25 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black/70`}
              >
                {expanded
                  ? textDir === "rtl"
                    ? "الخروج من العرض الموسّع"
                    : "Exit expanded view"
                  : textDir === "rtl"
                    ? "توسيع الكاميرا"
                    : "Expand camera"}
              </button>
            ) : null}
          </>
        }
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

      {showNoSnapshotWarning && trackingConfirmed && !trackingStopped ? (
        <div
          className="mt-3 rounded-[8px] border border-amber-300 bg-amber-50 px-3.5 py-3 text-[12px] font-medium leading-relaxed text-amber-900"
          role="alert"
          aria-live="assertive"
        >
          {copy.captureReliabilityNoDataWarning}
        </div>
      ) : null}

      {cvDebugEnabled && debugSnapshot ? (
        <PatientCameraDebugPanel snapshot={debugSnapshot} />
      ) : null}

      {cvDebugEnabled && captureReliabilityState ? (
        <PatientCvCaptureReliabilityPanel
          state={captureReliabilityState}
          stsAttemptDebug={
            exerciseId === "sit-to-stand"
              ? {
                  capturePhase: stsCapturePhase,
                  calibrationProgressPct,
                  lastAttemptType,
                  lastAttemptReason,
                  poseReadiness,
                  stsLandmarkCoverageReady,
                  canCount,
                  bodyFramingDiagnostics,
                }
              : undefined
          }
        />
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

      {showPreviewUi && stsTrackingStatusPanelProps ? (
        <div className="mt-2">
          <PatientTrackingStatusPanel {...stsTrackingStatusPanelProps} />
        </div>
      ) : null}

      {!trackingConfirmed ? (
        <PatientCvSetupPanel
          copy={copy}
          arClass={arClass}
          textDir={textDir}
          checks={captureReadiness.checks}
          primaryGuidance={captureReadiness.primaryGuidance}
          canStartTracking={captureReadiness.canStartTracking}
          stableSeconds={stableSeconds}
          previewActive={previewActive}
          onContinueAnyway={() => {
            setTrackingStartedAutomatically(false);
            confirmStartTracking(true);
          }}
        />
      ) : null}

      {trackingConfirmed && trackingStartedAutomatically && !trackingStopped ? (
        <p
          className="mt-3 rounded-[6px] border border-[#D1E7DE] bg-[#F0FAF6] px-3 py-2 text-[12px] font-semibold text-[#1D9E75]"
          role="status"
          aria-live="polite"
        >
          {copy.setupTrackingStartedAutomatically}
        </p>
      ) : null}

      {trackingConfirmed && previewActive && !trackingStopped && (
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
        <div
          className={`mt-3 rounded-[8px] border px-3.5 py-3 text-[13px] font-medium leading-relaxed ${
            sessionCaptureOutcome === "limited"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-[#D1E7DE] bg-[#F0FAF6] text-[#0A0F1A]"
          }`}
          role="status"
          aria-live="polite"
        >
          <p>
            {sessionCaptureOutcome === "limited"
              ? copy.sessionCompleteLimitedConfirmation
              : copy.sessionCompleteConfirmation}
          </p>
          {sessionCaptureOutcome === "limited" ? (
            <p className="mt-2 text-[12px] leading-relaxed text-amber-900/90">
              {copy.sessionRetestGuidance}
            </p>
          ) : null}
        </div>
      )}

      {trackingStopped && sessionCaptureOutcome === "limited" ? (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleTryAgain()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[14px] font-bold text-white transition hover:bg-[#179165]"
          >
            {copy.tryAgainLabel}
          </button>
        </div>
      ) : null}

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
            {movementDetected ? copy.movementDetectedYes : movementNotDetectedLabel}
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
