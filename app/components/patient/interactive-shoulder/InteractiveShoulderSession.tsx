"use client";

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
import { getExerciseCvRegistryEntry } from "@/app/lib/cv/exercise-cv-registry";
import {
  ShoulderAbductionReachPoseDetector,
  type ShoulderAbductionReachMeasuredEvent,
  type ShoulderAbductionReachPoseDetectorSnapshot,
} from "@/app/lib/cv/shoulder-abduction-reach-pose-detector";
import {
  createPatientCvCameraConsentRecord,
  readPatientCvCameraConsentFromSession,
  writePatientCvCameraConsentToSession,
} from "@/app/lib/cv/patient-cv-consent";
import type { CaptureSetupGuidance } from "@/app/lib/cv/patient-cv-capture-readiness";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { DEFAULT_SAFE_TARGET_BOUNDS } from "@/app/lib/interactive-shoulder/target-generator";
import {
  createInitialTargetLifecycle,
  type TargetLifecycleState,
} from "@/app/lib/interactive-shoulder/target-lifecycle";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "@/app/lib/interactive-shoulder/shoulder-abduction-reach-session-definition";
import {
  isDevMouseSimulationEnabled,
  normalizedPointFromMouseEvent,
} from "@/app/lib/interactive-shoulder/dev-mouse-simulation";
import { interactiveShoulderUi, resolveInteractiveShoulderStartError } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import { tickTargetLifecycleIfActive } from "@/app/lib/interactive-shoulder/target-lifecycle-gating";
import { INTERACTIVE_SHOULDER_CV_EXERCISE_ID } from "@/app/lib/interactive-shoulder/interactive-shoulder-exercise-ids";
import {
  resolveInteractiveShoulderSide,
  type ResolvedInteractiveShoulderSide,
} from "@/app/lib/interactive-shoulder/resolve-interactive-shoulder-side";
import {
  mapShoulderMeasuredEventToSessionInput,
  mapTargetHitToSessionInput,
} from "@/app/lib/session-orchestrator/adapters/shoulder-session-adapter";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { ShoulderSessionHud } from "./ShoulderSessionHud";
import { ShoulderTargetLayer } from "./ShoulderTargetLayer";
import { TrackedHandCursor } from "./TrackedHandCursor";

type InteractiveShoulderSessionProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
  /** Future-safe: pass when an existing session/prescription side field is available. */
  prescribedSide?: string | null;
  onSkipped?: () => void;
  onRegisterMetricsFlush?: (flush: () => void) => void;
  onRegisterCaptureConsent?: (getter: () => ReturnType<typeof createPatientCvCameraConsentRecord> | null) => void;
  onCaptureReadinessChange?: (payload: {
    primaryGuidance: CaptureSetupGuidance;
    canStartTracking: boolean;
    minimumMet: boolean;
    previewActive: boolean;
  }) => void;
};

const PatientCameraVideoLayer = memo(function PatientCameraVideoLayer({
  videoRef,
  canvasRef,
  canvasWidth,
  canvasHeight,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}) {
  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline className="block h-full w-full object-cover opacity-90" />
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      />
    </>
  );
});

function PreviewStack({
  videoRef,
  canvasRef,
  containerRef,
  canvasWidth,
  canvasHeight,
  overlay,
  onDevMouseMove,
  previewAriaLabel,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  overlay?: ReactNode;
  onDevMouseMove?: (event: React.MouseEvent) => void;
  previewAriaLabel: string;
}) {
  return (
    <div
      ref={containerRef}
      className="relative mt-3 w-full overflow-hidden rounded-[8px] border border-[#D1E7DE] bg-black"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      onMouseMove={onDevMouseMove}
      aria-label={previewAriaLabel}
    >
      <PatientCameraVideoLayer
        videoRef={videoRef}
        canvasRef={canvasRef}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />
      {overlay}
    </div>
  );
}

export function InteractiveShoulderSession({
  language,
  arClass = "",
  textDir = "ltr",
  prescribedSide,
  onSkipped,
  onRegisterMetricsFlush,
  onRegisterCaptureConsent,
  onCaptureReadinessChange,
}: InteractiveShoulderSessionProps) {
  const ui = interactiveShoulderUi(language);
  const entry = getExerciseCvRegistryEntry(INTERACTIVE_SHOULDER_CV_EXERCISE_ID);
  const profile = entry?.calibrationProfile;
  const interactiveBlock = SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0];
  const resolvedTherapeuticSide: ResolvedInteractiveShoulderSide = resolveInteractiveShoulderSide({
    prescribedSide,
    blockSide: interactiveBlock?.side,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const detectorRef = useRef<ShoulderAbductionReachPoseDetector | null>(null);
  const orchestratorRef = useRef<SessionOrchestrator | null>(null);
  const targetStateRef = useRef<TargetLifecycleState>(createInitialTargetLifecycle());
  const rafRef = useRef<number>(0);
  const sessionStartedRef = useRef(false);
  const devMouseRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ShoulderAbductionReachPoseDetectorSnapshot | null>(null);
  const therapeuticSideRef = useRef(resolvedTherapeuticSide.side);
  therapeuticSideRef.current = resolvedTherapeuticSide.side;

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ShoulderAbductionReachPoseDetectorSnapshot | null>(null);
  const [orchestratorSnapshot, setOrchestratorSnapshot] = useState<SessionOrchestratorSnapshot | null>(null);
  const [targetState, setTargetState] = useState<TargetLifecycleState>(createInitialTargetLifecycle());
  const [showBlockSummary, setShowBlockSummary] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState({ targets: 0, reps: 0 });
  const [recentHitFlash, setRecentHitFlash] = useState(false);
  const [targetHitAnnouncement, setTargetHitAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (readPatientCvCameraConsentFromSession()) {
      setConsentAccepted(true);
      setConsentChecked(true);
    }
  }, []);

  useEffect(() => {
    onRegisterMetricsFlush?.(() => {
      /* Shoulder interactive slice — metrics persistence deferred; flush is a no-op. */
    });
    onRegisterCaptureConsent?.(() =>
      consentAccepted ? createPatientCvCameraConsentRecord() : null,
    );
  }, [consentAccepted, onRegisterCaptureConsent, onRegisterMetricsFlush]);

  const reportReadiness = useCallback(
    (snap: ShoulderAbductionReachPoseDetectorSnapshot | null) => {
      if (!onCaptureReadinessChange) return;
      const framing = snap?.bodyFramingState ?? "checking";
      const canStart = framing === "good_distance" && snap?.trackingStatus === "tracking";
      const primaryGuidance: CaptureSetupGuidance = canStart
        ? "ready"
        : framing === "move_closer"
          ? "step_into_frame"
          : framing === "move_back"
            ? "move_farther"
            : framing === "low_visibility"
              ? "improve_lighting"
              : "adjust_position";
      onCaptureReadinessChange({
        primaryGuidance,
        canStartTracking: Boolean(canStart),
        minimumMet: framing !== "checking",
        previewActive: Boolean(snap?.previewActive),
      });
    },
    [onCaptureReadinessChange],
  );

  const handleOrchestratorEvent = useCallback((event: ShoulderAbductionReachMeasuredEvent) => {
    const orchestrator = orchestratorRef.current;
    if (!orchestrator) return;
    orchestrator.reportInputEvent(mapShoulderMeasuredEventToSessionInput(event), event.capturedAtMs);
  }, []);

  const startSession = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!profile || !video || !canvas || !detector) return;
    setStarting(true);
    setStartError(null);
    try {
      await detector.start(video, canvas);
      if (!orchestratorRef.current) {
        orchestratorRef.current = new SessionOrchestrator(SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION);
      }
      const now = performance.now();
      const orchestrator = orchestratorRef.current;
      orchestrator.start(now);
      orchestrator.beginCalibration(now);
      orchestrator.completeCalibration(now);
      sessionStartedRef.current = true;
      targetStateRef.current = createInitialTargetLifecycle();
      setTargetState(targetStateRef.current);
      setOrchestratorSnapshot(orchestrator.getSnapshot(now));
    } catch (error) {
      setStartError(resolveInteractiveShoulderStartError(language, error));
    } finally {
      setStarting(false);
    }
  }, [profile, language]);

  useLayoutEffect(() => {
    if (!profile) return;
    const DetectorClass = entry!.detectorResolver();
    const detector = new DetectorClass(
      {
        onSnapshot: (snap) => {
          setSnapshot(snap);
          reportReadiness(snap);
        },
        onMeasuredEvent: handleOrchestratorEvent,
      },
      resolvedTherapeuticSide.side,
    );
    detectorRef.current = detector;
    return () => {
      detector.stop();
      detectorRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [entry, handleOrchestratorEvent, profile, reportReadiness, resolvedTherapeuticSide.side]);

  useEffect(() => {
    if (!consentAccepted || !profile) return;
    void startSession();
  }, [consentAccepted, profile, startSession]);

  useEffect(() => {
    const loop = () => {
      const orchestrator = orchestratorRef.current;
      const now = performance.now();
      if (orchestrator && sessionStartedRef.current) {
        orchestrator.tick(now);
        const snap = orchestrator.getSnapshot(now);
        setOrchestratorSnapshot(snap);
        if (snap.sessionState === "completed" && !showBlockSummary) {
          const blockResult = snap.accumulatedBlockResults[0];
          setSummaryMetrics({
            targets: blockResult?.interaction.targetsContacted ?? targetStateRef.current.interaction.targetsReached,
            reps: blockResult?.measured.validRepetitions ?? snapshot?.primaryRepCount ?? 0,
          });
          setShowBlockSummary(true);
        }

        const poseSnap = snapshotRef.current;
        const wrist =
          poseSnap?.primaryWristNormalized ??
          (isDevMouseSimulationEnabled() ? devMouseRef.current : null);
        if (snap.sessionState === "active" && wrist) {
          const ticked = tickTargetLifecycleIfActive(snap.sessionState, targetStateRef.current, {
            wrist,
            nowMs: now,
            side: therapeuticSideRef.current,
            bounds: DEFAULT_SAFE_TARGET_BOUNDS,
          });
          targetStateRef.current = ticked.state;
          setTargetState(ticked.state);
          if (ticked.hitEvent) {
            orchestrator.reportInputEvent(mapTargetHitToSessionInput(ticked.hitEvent), now);
            setRecentHitFlash(true);
            setTargetHitAnnouncement(ui.targetReached);
            window.setTimeout(() => {
              setRecentHitFlash(false);
              setTargetHitAnnouncement(null);
            }, 350);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [language, showBlockSummary, ui.targetReached]);

  const acceptConsent = () => {
    if (!consentChecked) return;
    writePatientCvCameraConsentToSession(createPatientCvCameraConsentRecord());
    setConsentAccepted(true);
  };

  const handleDevMouseMove = (event: React.MouseEvent) => {
    if (!isDevMouseSimulationEnabled() || snapshot?.primaryWristNormalized) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    devMouseRef.current = normalizedPointFromMouseEvent(event, rect);
  };

  if (!profile) return null;

  const canvasWidth = profile.canvasWidth;
  const canvasHeight = profile.canvasHeight;
  const measuredReps = snapshot?.primaryRepCount ?? 0;
  const hudSnapshot =
    orchestratorSnapshot ??
    ({
      sessionState: "preparing",
      blockProgress: 0,
      blockElapsedSeconds: 0,
      safetyStatus: "normal",
      isPaused: false,
      patientFeedbackState: { message: null, encouragement: null },
      currentBlock: interactiveBlock,
    } as SessionOrchestratorSnapshot);

  return (
    <div className="px-4 pb-4 pt-3" dir={textDir} lang={language}>
      {!consentAccepted ? (
        <div className={`rounded-[10px] border border-[#E2E8E5] bg-white p-4 ${arClass}`}>
          <p className="text-sm font-semibold text-[#0A0F1A]">{ui.consentTitle}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6B7280]">{ui.consentDescription}</p>
          <label className="mt-3 flex items-start gap-2 text-[12px] text-[#374151]">
            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />
            <span>{ui.consentCheckbox}</span>
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-[8px] bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!consentChecked}
              onClick={acceptConsent}
            >
              {ui.continueCamera}
            </button>
            <button type="button" className="rounded-[8px] border border-[#E2E8E5] px-4 py-2 text-sm" onClick={onSkipped}>
              {ui.skipCamera}
            </button>
          </div>
        </div>
      ) : (
        <>
          {resolvedTherapeuticSide.usedFallback ? (
            <p className={`mb-2 rounded-[6px] border border-[#E2E8E5] bg-[#F9FAFB] px-2 py-1 text-[11px] text-[#6B7280] ${arClass}`}>
              {ui.therapeuticSideFallback}
            </p>
          ) : null}
          {isDevMouseSimulationEnabled() && !snapshot?.primaryWristNormalized && (
            <p className={`mb-2 rounded-[6px] border border-amber-300/40 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 ${arClass}`}>
              {ui.devMouseSimulation}
            </p>
          )}
          <PreviewStack
            videoRef={videoRef}
            canvasRef={canvasRef}
            containerRef={containerRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            previewAriaLabel={ui.cameraPreviewAriaLabel}
            onDevMouseMove={handleDevMouseMove}
            overlay={
              <>
                <ShoulderTargetLayer target={targetState.currentTarget} highlight={recentHitFlash} />
                <TrackedHandCursor
                  wrist={
                    snapshot?.primaryWristNormalized ??
                    (isDevMouseSimulationEnabled() ? devMouseRef.current : null)
                  }
                  visible={hudSnapshot.sessionState === "active" || hudSnapshot.sessionState === "safetyHold"}
                />
                <ShoulderSessionHud
                  language={language}
                  arClass={arClass}
                  snapshot={hudSnapshot}
                  interaction={targetState.interaction}
                  measuredReps={measuredReps}
                  onPause={() => orchestratorRef.current?.pause(performance.now())}
                  onResume={() => orchestratorRef.current?.resume(performance.now())}
                  showBlockSummary={showBlockSummary}
                  blockSummaryTargetsReached={summaryMetrics.targets}
                  blockSummaryMeasuredReps={summaryMetrics.reps}
                  targetHitAnnouncement={targetHitAnnouncement}
                />
              </>
            }
          />
          {starting ? (
            <p className={`mt-2 text-center text-[12px] text-[#6B7280] ${arClass}`}>{ui.startingCamera}</p>
          ) : null}
          {startError ? (
            <p
              className={`mt-2 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ${arClass}`}
              role="status"
              aria-live="polite"
            >
              {startError}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
