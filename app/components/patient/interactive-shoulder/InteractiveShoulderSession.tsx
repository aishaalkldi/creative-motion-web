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
import { resolveInteractiveShoulderSessionFromEnv } from "@/app/lib/interactive-shoulder/resolve-interactive-shoulder-session";
import {
  resolveActiveMotionPattern,
  resolveFeedbackInteractionMode,
} from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry";
import {
  createInitialPatternLifecycle,
  type PatternLifecycleState,
} from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle";
import { resetPatternLifecycleForBlock, tickPatternLifecycleIfActive } from "@/app/lib/interactive-shoulder/motion-patterns/pattern-lifecycle-gating";
import type { ResolvedMotionPattern } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-types";
import {
  isDevMouseSimulationEnabled,
  normalizedPointFromMouseEvent,
} from "@/app/lib/interactive-shoulder/dev-mouse-simulation";
import { interactiveShoulderUi, resolveInteractiveShoulderStartError } from "@/app/lib/interactive-shoulder/interactive-shoulder-ui";
import { resolveHitExitTransitionMs } from "@/app/lib/interactive-shoulder/reach-the-light-motion";
import {
  registerTargetBlockRunner,
  resolveTargetBlockRunner,
} from "@/app/lib/interactive-shoulder/block-engine/target-block-runner";
import type { TherapeuticTarget } from "@/app/lib/interactive-shoulder/types";
import { INTERACTIVE_SHOULDER_CV_EXERCISE_ID } from "@/app/lib/interactive-shoulder/interactive-shoulder-exercise-ids";
import {
  resolveInteractiveShoulderSide,
  type ResolvedInteractiveShoulderSide,
} from "@/app/lib/interactive-shoulder/resolve-interactive-shoulder-side";
import {
  mapPatternCompletionToSessionInput,
  mapShoulderMeasuredEventToSessionInput,
  mapTargetHitToSessionInput,
} from "@/app/lib/session-orchestrator/adapters/shoulder-session-adapter";
import { SessionOrchestrator } from "@/app/lib/session-orchestrator/session-orchestrator";
import type { SessionOrchestratorSnapshot } from "@/app/lib/session-orchestrator/types";
import { ShoulderSessionHud } from "./ShoulderSessionHud";
import { ShoulderTargetLayer } from "./ShoulderTargetLayer";
import { TrackedHandCursor } from "./TrackedHandCursor";
import { TherapeuticPathLayer } from "./TherapeuticPathLayer";
import { ReachTheLightEnvironment } from "./ReachTheLightEnvironment";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const INTERACTIVE_SHOULDER_SESSION = resolveInteractiveShoulderSessionFromEnv();
const DEFAULT_PATTERN_ID = "d1-inspired-diagonal-reach";

/**
 * Reach the Light now executes through the Block Runner registry instead
 * of calling target-lifecycle functions directly. Registered and resolved
 * once here, at module scope — same "resolved once at initialization, not
 * per animation frame" rule INTERACTIVE_SHOULDER_SESSION above already
 * follows. Resolution reads the active session's own first block's
 * blockType rather than a hardcoded string, so this is null (not a crash,
 * not a fallback to the wrong runner) whenever the resolved session isn't
 * target-mode — e.g. NEXT_PUBLIC_RASQ_MOTION_PATTERNS_V1="true" selects
 * the D1 pattern session instead, which this constant correctly ignores.
 * The D1 pattern branch below is untouched by this migration.
 */
registerTargetBlockRunner();
const RESOLVED_TARGET_BLOCK_RUNNER = resolveTargetBlockRunner(
  INTERACTIVE_SHOULDER_SESSION.blocks[0]?.blockType,
);

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
      <video ref={videoRef} autoPlay muted playsInline className="block h-full w-full object-cover opacity-95" />
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-60 mix-blend-screen"
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
      className="relative mt-3 w-full overflow-hidden rounded-[12px] border border-[#1E2D42]/50 bg-[#0A0F1A] shadow-[0_8px_28px_rgba(10,15,26,0.18)]"
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const hitExitTransitionMs = resolveHitExitTransitionMs(prefersReducedMotion);
  const entry = getExerciseCvRegistryEntry(INTERACTIVE_SHOULDER_CV_EXERCISE_ID);
  const profile = entry?.calibrationProfile;
  const interactiveBlock = INTERACTIVE_SHOULDER_SESSION.blocks[0];
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
  const patternStateRef = useRef<PatternLifecycleState>(
    createInitialPatternLifecycle(DEFAULT_PATTERN_ID),
  );
  const activeBlockIdRef = useRef<string | null>(null);
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
  const [patternState, setPatternState] = useState<PatternLifecycleState>(
    createInitialPatternLifecycle(DEFAULT_PATTERN_ID),
  );
  const [activeMotionPattern, setActiveMotionPattern] = useState<ResolvedMotionPattern | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<"motion-pattern" | "reach-the-light-targets">(
    resolveFeedbackInteractionMode(interactiveBlock?.feedbackProfile),
  );
  const [showBlockSummary, setShowBlockSummary] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState({ targets: 0, patterns: 0, reps: 0, durationSeconds: 0 });
  const [targetHitAnnouncement, setTargetHitAnnouncement] = useState<string | null>(null);
  const [hitBurstTarget, setHitBurstTarget] = useState<TherapeuticTarget | null>(null);
  const [hitBurstProgress, setHitBurstProgress] = useState<number | null>(null);
  const hitFeedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    return () => {
      if (hitFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(hitFeedbackTimeoutRef.current);
      }
    };
  }, []);

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
        orchestratorRef.current = new SessionOrchestrator(INTERACTIVE_SHOULDER_SESSION);
      }
      const now = performance.now();
      const orchestrator = orchestratorRef.current;
      orchestrator.start(now);
      orchestrator.beginCalibration(now);
      orchestrator.completeCalibration(now);
      sessionStartedRef.current = true;
      targetStateRef.current = createInitialTargetLifecycle();
      setTargetState(targetStateRef.current);
      patternStateRef.current = createInitialPatternLifecycle(DEFAULT_PATTERN_ID);
      setPatternState(patternStateRef.current);
      activeBlockIdRef.current = null;
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
          const totalTargets = snap.accumulatedBlockResults.reduce(
            (sum, result) => sum + result.interaction.targetsContacted,
            0,
          );
          const totalPatterns = snap.accumulatedBlockResults.reduce(
            (sum, result) => sum + result.interaction.patternsCompleted,
            0,
          );
          const totalReps = snap.accumulatedBlockResults.reduce(
            (sum, result) => sum + result.measured.validRepetitions,
            0,
          );
          setSummaryMetrics({
            targets: totalTargets || targetStateRef.current.interaction.targetsReached,
            patterns:
              totalPatterns || patternStateRef.current.interaction.patternsCompleted,
            reps: totalReps || snapshot?.primaryRepCount || 0,
            durationSeconds: Math.max(0, Math.round(snap.blockElapsedSeconds)),
          });
          setShowBlockSummary(true);
        }

        const currentBlock = snap.currentBlock;
        const currentBlockId = currentBlock?.blockId ?? null;
        const currentFeedbackProfile = currentBlock?.feedbackProfile;
        const currentFeedbackMode = resolveFeedbackInteractionMode(currentFeedbackProfile);
        const resolvedPattern = resolveActiveMotionPattern(
          currentFeedbackProfile,
          therapeuticSideRef.current,
        );

        if (currentBlockId && activeBlockIdRef.current !== currentBlockId) {
          activeBlockIdRef.current = currentBlockId;
          setFeedbackMode(currentFeedbackMode);
          setActiveMotionPattern(resolvedPattern);
          targetStateRef.current = createInitialTargetLifecycle();
          setTargetState(targetStateRef.current);
          if (resolvedPattern) {
            patternStateRef.current = resetPatternLifecycleForBlock(resolvedPattern.id);
            setPatternState(patternStateRef.current);
          } else {
            patternStateRef.current = createInitialPatternLifecycle(DEFAULT_PATTERN_ID);
            setPatternState(patternStateRef.current);
          }
        } else if (resolvedPattern && !activeMotionPattern) {
          setActiveMotionPattern(resolvedPattern);
          setFeedbackMode(currentFeedbackMode);
        }

        const poseSnap = snapshotRef.current;
        const wrist =
          poseSnap?.primaryWristNormalized ??
          (isDevMouseSimulationEnabled() ? devMouseRef.current : null);
        if (snap.sessionState === "active") {
          if (currentFeedbackMode === "motion-pattern" && resolvedPattern) {
            const ticked = tickPatternLifecycleIfActive(snap.sessionState, patternStateRef.current, {
              wrist: wrist ?? null,
              nowMs: now,
              pattern: resolvedPattern,
              completionExitTransitionMs: hitExitTransitionMs,
            });
            patternStateRef.current = ticked.state;
            setPatternState(ticked.state);
            if (ticked.completionEvent) {
              orchestrator.reportInputEvent(
                mapPatternCompletionToSessionInput(ticked.completionEvent),
                now,
              );
              setHitBurstProgress(ticked.state.exitingProgress);
              setTargetHitAnnouncement(ui.patternPathComplete);
              if (hitFeedbackTimeoutRef.current !== null) {
                window.clearTimeout(hitFeedbackTimeoutRef.current);
              }
              hitFeedbackTimeoutRef.current = window.setTimeout(() => {
                setHitBurstProgress(null);
                setTargetHitAnnouncement(null);
                hitFeedbackTimeoutRef.current = null;
              }, Math.max(hitExitTransitionMs, 480));
            }
          } else if (wrist && RESOLVED_TARGET_BLOCK_RUNNER) {
            const ticked = RESOLVED_TARGET_BLOCK_RUNNER.tick(snap.sessionState, targetStateRef.current, {
              wrist,
              nowMs: now,
              side: therapeuticSideRef.current,
              bounds: DEFAULT_SAFE_TARGET_BOUNDS,
              hitExitTransitionMs,
            });
            targetStateRef.current = ticked.state;
            setTargetState(ticked.state);
            if (ticked.completionEvent) {
              orchestrator.reportInputEvent(mapTargetHitToSessionInput(ticked.completionEvent), now);
              const burstTarget = ticked.state.exitingTarget;
              if (burstTarget) {
                setHitBurstTarget(burstTarget);
              }
              setTargetHitAnnouncement(ui.targetReached);
              if (hitFeedbackTimeoutRef.current !== null) {
                window.clearTimeout(hitFeedbackTimeoutRef.current);
              }
              hitFeedbackTimeoutRef.current = window.setTimeout(() => {
                setHitBurstTarget(null);
                setTargetHitAnnouncement(null);
                hitFeedbackTimeoutRef.current = null;
              }, Math.max(hitExitTransitionMs, 480));
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hitExitTransitionMs, showBlockSummary, ui.patternPathComplete, ui.targetReached, activeMotionPattern]);

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
  const resolvedHudFeedbackMode = resolveFeedbackInteractionMode(
    hudSnapshot.currentBlock?.feedbackProfile,
  );
  const renderPattern =
    activeMotionPattern ??
    resolveActiveMotionPattern(hudSnapshot.currentBlock?.feedbackProfile, resolvedTherapeuticSide.side);

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
                <ReachTheLightEnvironment reducedMotion={prefersReducedMotion} />
                {resolvedHudFeedbackMode === "motion-pattern" && renderPattern ? (
                  <TherapeuticPathLayer
                    pattern={renderPattern}
                    lifecycle={patternState}
                    hitBurstProgress={hitBurstProgress}
                    reducedMotion={prefersReducedMotion}
                  />
                ) : (
                  <ShoulderTargetLayer
                    target={targetState.currentTarget}
                    exitingTarget={targetState.exitingTarget}
                    hitBurstTarget={hitBurstTarget}
                    reducedMotion={prefersReducedMotion}
                  />
                )}
                <TrackedHandCursor
                  wrist={
                    snapshot?.primaryWristNormalized ??
                    (isDevMouseSimulationEnabled() ? devMouseRef.current : null)
                  }
                  visible={hudSnapshot.sessionState === "active" || hudSnapshot.sessionState === "safetyHold"}
                  reducedMotion={prefersReducedMotion}
                />
                <ShoulderSessionHud
                  language={language}
                  arClass={arClass}
                  snapshot={hudSnapshot}
                  feedbackMode={resolvedHudFeedbackMode}
                  targetInteraction={targetState.interaction}
                  patternInteraction={patternState.interaction}
                  measuredReps={measuredReps}
                  onPause={() => orchestratorRef.current?.pause(performance.now())}
                  onResume={() => orchestratorRef.current?.resume(performance.now())}
                  showBlockSummary={showBlockSummary}
                  blockSummaryTargetsReached={summaryMetrics.targets}
                  blockSummaryPatternsCompleted={summaryMetrics.patterns}
                  blockSummaryMeasuredReps={summaryMetrics.reps}
                  blockSummaryDurationSeconds={summaryMetrics.durationSeconds}
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
