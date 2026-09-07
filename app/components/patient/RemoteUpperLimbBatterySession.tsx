"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BatteryCameraSession, type BatteryCameraSnapshot } from "@/app/lib/remote-upper-limb-battery/battery-camera-session";
import { getBatteryTestOrientation } from "@/app/lib/remote-upper-limb-battery/battery-orientation";
import {
  createBatteryTestProcessor,
  createPreviewPositionProcessor,
  type BatteryTestProcessor,
} from "@/app/lib/remote-upper-limb-battery/battery-frame-processors";
import {
  beginBatteryCountdown,
  buildBatteryPayload,
  buildFunctionalReachTestResult,
  buildRepTestResult,
  cancelBatteryAssessment,
  completeBatteryTest,
  completeSideReposition,
  createBatteryOrchestratorState,
  getActiveBatteryTestId,
  getActiveBatteryTestRequiredReps,
  markBatterySubmitting,
  recordBatteryRepCompleted,
  retryCurrentBatteryTest,
  setBatteryTrackingReady,
  startBatteryAssessment,
  tickBatteryCountdown,
  type BatteryOrchestratorState,
} from "@/app/lib/remote-upper-limb-battery/battery-orchestrator";
import {
  getBatteryOverviewLines,
  getHoldStillStatus,
  getInitialPositionInstruction,
  getMovementInstruction,
  getPositioningStatus,
  getRepositionInstruction,
  getRepositionProgressLabel,
  getTestProgressLabel,
  getTestSetupInstruction,
  getTrackingLostStatus,
} from "@/app/lib/remote-upper-limb-battery/battery-patient-copy";
import {
  resetBatterySpeech,
  resetBatterySpeechForTest,
  speakBatteryCue,
  speakBatteryTestCompleted,
  type BatterySpeechCue,
} from "@/app/lib/remote-upper-limb-battery/battery-speech";
import type { RemoteUpperLimbBatteryPayload, RemoteUpperLimbBatterySide } from "@/app/lib/remote-upper-limb-battery/types";
import {
  isBatteryProcessorTrackingUsable,
  resolveBatteryTrackingRejection,
} from "@/app/lib/remote-upper-limb-battery/battery-tracking";

const POSITION_STABLE_MS = 1000;
const COUNTDOWN_INTERVAL_MS = 1000;
const IS_DEV = process.env.NODE_ENV === "development";

type RemoteUpperLimbBatterySessionProps = {
  testedSide: RemoteUpperLimbBatterySide;
  disabled?: boolean;
  onBatteryComplete: (payload: RemoteUpperLimbBatteryPayload) => void;
  onCancel?: () => void;
};

function isTrackingUsable(snapshot: BatteryCameraSnapshot | null): boolean {
  return isBatteryProcessorTrackingUsable(snapshot?.processor);
}

function repSpeechCue(completed: number): BatterySpeechCue | null {
  if (completed === 1) return "rep-one";
  if (completed === 2) return "rep-two";
  if (completed === 3) return "rep-three";
  return null;
}

function movementSpeechCue(
  testId: ReturnType<typeof getActiveBatteryTestId>,
  phase: string,
): BatterySpeechCue | null {
  if (testId === "shoulderAbduction") {
    if (phase === "raising") return "abduction-raise";
    if (phase === "lowering") return "abduction-return";
  }
  if (testId === "shoulderFlexion") {
    if (phase === "raising") return "flexion-raise";
    if (phase === "lowering") return "flexion-return";
  }
  if (testId === "elbowFlexion") {
    if (phase === "flexing") return "elbow-bend";
    if (phase === "extending") return "elbow-straighten";
  }
  if (testId === "functionalReach") {
    if (phase === "peak") return "functional-reach";
    if (phase === "rest") return "functional-return";
  }
  return null;
}

export function RemoteUpperLimbBatterySession({
  testedSide,
  disabled = false,
  onBatteryComplete,
  onCancel,
}: RemoteUpperLimbBatterySessionProps) {
  const [orchestrator, setOrchestrator] = useState<BatteryOrchestratorState>(
    createBatteryOrchestratorState,
  );
  const [cameraSnapshot, setCameraSnapshot] = useState<BatteryCameraSnapshot | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [holdStillVisible, setHoldStillVisible] = useState(false);
  const [repositionReady, setRepositionReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<BatteryCameraSession | null>(null);
  const processorRef = useRef<BatteryTestProcessor>(createPreviewPositionProcessor(testedSide));
  const stableSinceRef = useRef<number | null>(null);
  const lastProcessorRepRef = useRef(0);
  const lastMovementCueRef = useRef<string | null>(null);
  const finalizedTestIndexRef = useRef(-1);
  /** True once the active test's processor has been armed for test_active (#295 / CV-1). */
  const movementArmedRef = useRef(false);
  const repositionCueSpokenRef = useRef(false);
  const onBatteryCompleteRef = useRef(onBatteryComplete);

  useEffect(() => {
    onBatteryCompleteRef.current = onBatteryComplete;
  }, [onBatteryComplete]);

  const activeTestId = getActiveBatteryTestId(orchestrator);
  const requiredReps = getActiveBatteryTestRequiredReps(orchestrator);
  const activeOrientation = getBatteryTestOrientation(activeTestId);
  const previewActive = cameraSnapshot?.previewActive ?? false;
  const positionReady = previewActive && isTrackingUsable(cameraSnapshot);
  const trackingLost =
    assessmentStarted &&
    orchestrator.phase !== "idle" &&
    orchestrator.phase !== "assessment_completed" &&
    orchestrator.phase !== "submitting" &&
    orchestrator.phase !== "submit_failed" &&
    !isTrackingUsable(cameraSnapshot);

  const processorSnapshot = cameraSnapshot?.processor;
  const trackingRejection = resolveBatteryTrackingRejection(processorSnapshot);
  const landmarkDebug = processorSnapshot?.landmarkVisibility;

  const overviewLines = useMemo(() => getBatteryOverviewLines(testedSide), [testedSide]);

  const bindProcessor = useCallback((processor: BatteryTestProcessor) => {
    processorRef.current = processor;
    cameraRef.current?.setFrameProcessor((landmarks, context) =>
      processorRef.current.processFrame(landmarks, context),
    );
  }, []);

  const bindPreviewProcessor = useCallback(() => {
    bindProcessor(createPreviewPositionProcessor(testedSide));
  }, [bindProcessor, testedSide]);

  useEffect(() => {
    const camera = new BatteryCameraSession({
      onSnapshot: (snapshot) => setCameraSnapshot(snapshot),
    });
    cameraRef.current = camera;
    bindPreviewProcessor();

    return () => {
      resetBatterySpeech();
      camera.stop();
      cameraRef.current = null;
    };
  }, [bindPreviewProcessor]);

  /**
   * Bind the active test's processor UNARMED (#295 / CV-1).
   *
   * The processor sees positioning and countdown frames so tracking readiness
   * keeps working, but its rep FSM stays frozen until `armActiveTestProcessor`
   * runs at the transition into test_active.
   */
  const switchToActiveTestProcessor = useCallback(
    (testId: ReturnType<typeof getActiveBatteryTestId>) => {
      const processor = createBatteryTestProcessor(testId, testedSide);
      processor.reset();
      bindProcessor(processor);
      lastProcessorRepRef.current = 0;
      lastMovementCueRef.current = null;
      movementArmedRef.current = false;
    },
    [bindProcessor, testedSide],
  );

  /**
   * Arm the active test at test_active so only real test frames are measured.
   *
   * Functional reach is previewed through the positioning processor, so its
   * real processor is created here; tests 1–3 are already bound and only need
   * arming. `beginMovementTracking` resets measurement state either way, so no
   * pre-start repetition or peak can survive into the persisted result.
   */
  const armActiveTestProcessor = useCallback(
    (testId: ReturnType<typeof getActiveBatteryTestId>) => {
      if (testId === "functionalReach") {
        const processor = createBatteryTestProcessor("functionalReach", testedSide);
        processor.reset();
        bindProcessor(processor);
      }
      processorRef.current.beginMovementTracking();
      lastProcessorRepRef.current = 0;
      lastMovementCueRef.current = null;
      movementArmedRef.current = true;
    },
    [bindProcessor, testedSide],
  );

  const handleStartCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || cameraStarting || previewActive) return;
    setCameraStarting(true);
    setCameraError(null);
    try {
      await cameraRef.current?.start(videoRef.current, canvasRef.current);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Could not start the camera.");
    } finally {
      setCameraStarting(false);
    }
  }, [cameraStarting, previewActive]);

  const handleStartAssessment = useCallback(() => {
    if (!positionReady || disabled || assessmentStarted) return;
    resetBatterySpeech();
    setAssessmentStarted(true);
    stableSinceRef.current = null;
    finalizedTestIndexRef.current = -1;
    movementArmedRef.current = false;
    repositionCueSpokenRef.current = false;
    setRepositionReady(false);
    setOrchestrator(startBatteryAssessment(createBatteryOrchestratorState()));
    switchToActiveTestProcessor("shoulderAbduction");
    speakBatteryCue("get-ready", testedSide, "assessment");
  }, [assessmentStarted, disabled, positionReady, switchToActiveTestProcessor, testedSide]);

  const handleRetryCurrentTest = useCallback(() => {
    resetBatterySpeechForTest();
    stableSinceRef.current = null;
    setHoldStillVisible(false);
    setRepositionReady(false);
    repositionCueSpokenRef.current = false;
    lastProcessorRepRef.current = 0;
    movementArmedRef.current = false;
    if (orchestrator.phase === "reposition_side") {
      finalizedTestIndexRef.current = 0;
      bindPreviewProcessor();
    } else {
      finalizedTestIndexRef.current = orchestrator.testIndex - 1;
      if (activeTestId === "functionalReach") {
        bindPreviewProcessor();
      } else {
        switchToActiveTestProcessor(activeTestId);
      }
    }
    setOrchestrator((current) => retryCurrentBatteryTest(current));
  }, [
    activeTestId,
    bindPreviewProcessor,
    orchestrator.phase,
    orchestrator.testIndex,
    switchToActiveTestProcessor,
  ]);

  const handleCancelAssessment = useCallback(() => {
    resetBatterySpeech();
    setAssessmentStarted(false);
    setHoldStillVisible(false);
    setRepositionReady(false);
    repositionCueSpokenRef.current = false;
    stableSinceRef.current = null;
    finalizedTestIndexRef.current = -1;
    movementArmedRef.current = false;
    setOrchestrator(cancelBatteryAssessment(createBatteryOrchestratorState()));
    bindPreviewProcessor();
    onCancel?.();
  }, [bindPreviewProcessor, onCancel]);

  useEffect(() => {
    if (!assessmentStarted) return;
    const processor = cameraSnapshot?.processor;
    if (!processor) return;

    setOrchestrator((current) => setBatteryTrackingReady(current, processor.trackingReady));

    if (trackingLost) {
      stableSinceRef.current = null;
      setHoldStillVisible(false);
      setRepositionReady(false);
      return;
    }

    if (orchestrator.phase === "reposition_side") {
      if (!repositionCueSpokenRef.current) {
        repositionCueSpokenRef.current = true;
        speakBatteryCue("reposition-side", testedSide, "reposition");
      }

      const now = performance.now();
      if (stableSinceRef.current === null) {
        stableSinceRef.current = now;
      } else if (now - stableSinceRef.current >= POSITION_STABLE_MS) {
        if (!repositionReady) {
          setRepositionReady(true);
          stableSinceRef.current = now;
        } else if (now - stableSinceRef.current >= 600) {
          setOrchestrator((current) => {
            if (current.phase !== "reposition_side") return current;
            const next = completeSideReposition(current);
            switchToActiveTestProcessor(getActiveBatteryTestId(next));
            resetBatterySpeechForTest();
            stableSinceRef.current = null;
            setHoldStillVisible(false);
            setRepositionReady(false);
            return next;
          });
        }
      }
      return;
    }

    if (orchestrator.phase === "positioning") {
      const now = performance.now();
      if (stableSinceRef.current === null) {
        stableSinceRef.current = now;
        setHoldStillVisible(true);
        speakBatteryCue("stand-still", testedSide, `position-${activeTestId}`);
      } else if (now - stableSinceRef.current >= POSITION_STABLE_MS) {
        setHoldStillVisible(true);
        setOrchestrator((current) => beginBatteryCountdown(current, 3));
        speakBatteryCue("countdown-three", testedSide, `countdown-${activeTestId}`);
      }
    }
  }, [
    activeTestId,
    assessmentStarted,
    cameraSnapshot,
    orchestrator.phase,
    switchToActiveTestProcessor,
    testedSide,
    trackingLost,
  ]);

  useEffect(() => {
    if (orchestrator.phase !== "countdown" || trackingLost) return;
    const timer = window.setTimeout(() => {
      setOrchestrator((current) => {
        if (current.phase !== "countdown" || current.countdown === null) return current;
        if (current.countdown === 3) {
          speakBatteryCue("countdown-two", testedSide, `countdown-${activeTestId}`);
        } else if (current.countdown === 2) {
          speakBatteryCue("countdown-one", testedSide, `countdown-${activeTestId}`);
        }
        return tickBatteryCountdown(current);
      });
    }, COUNTDOWN_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [activeTestId, orchestrator.countdown, orchestrator.phase, testedSide, trackingLost]);

  useEffect(() => {
    if (!assessmentStarted) return;
    if (orchestrator.phase !== "test_active") return;
    if (movementArmedRef.current) return;
    armActiveTestProcessor(activeTestId);
  }, [activeTestId, armActiveTestProcessor, assessmentStarted, orchestrator.phase]);

  useEffect(() => {
    if (orchestrator.phase !== "test_active" || trackingLost) return;
    const processor = cameraSnapshot?.processor;
    if (!processor) return;

    if (processor.repCount > lastProcessorRepRef.current) {
      const completed = processor.repCount;
      lastProcessorRepRef.current = completed;
      const cue = repSpeechCue(completed);
      if (cue) speakBatteryCue(cue, testedSide, `${activeTestId}-rep`);
      setOrchestrator((current) => recordBatteryRepCompleted(current, processor.lastRepPeak));
    }

    const movementCue = movementSpeechCue(activeTestId, processor.movementPhase);
    if (movementCue) {
      const key = `${activeTestId}:${movementCue}`;
      if (lastMovementCueRef.current !== key) {
        lastMovementCueRef.current = key;
        speakBatteryCue(movementCue, testedSide, key);
      }
    }
  }, [activeTestId, cameraSnapshot?.processor, orchestrator.phase, testedSide, trackingLost]);

  useEffect(() => {
    if (orchestrator.phase !== "test_completed") return;
    if (finalizedTestIndexRef.current === orchestrator.testIndex) return;

    const processor = cameraSnapshot?.processor;
    if (!processor) return;

    finalizedTestIndexRef.current = orchestrator.testIndex;
    const trackingQuality = processor.trackingQuality;

    const result =
      activeTestId === "functionalReach"
        ? buildFunctionalReachTestResult({
            peakReachExtent: processor.peakReachExtent,
            trackingQuality,
          })
        : buildRepTestResult({
            testId: activeTestId as "shoulderAbduction" | "shoulderFlexion" | "elbowFlexion",
            // CV-6: the orchestrator's gated count is the single source of truth.
            // The previous Math.max let raw processor reps — including any the
            // rep dispatch rejected while tracking was unusable — override it.
            repsCompleted: orchestrator.repsCompleted,
            repsRequired: requiredReps,
            // Keep one peak per persisted repetition so the therapist never sees
            // more peaks than accepted reps.
            peakAnglesDeg: processor.completedPeaksDeg.slice(0, orchestrator.repsCompleted),
            trackingQuality,
          });

    speakBatteryTestCompleted(activeTestId, testedSide);

    setOrchestrator((current) => {
      const next = completeBatteryTest(current, result);
      if (next.phase === "reposition_side") {
        bindPreviewProcessor();
        repositionCueSpokenRef.current = false;
        setRepositionReady(false);
        stableSinceRef.current = null;
        setHoldStillVisible(false);
      } else if (next.phase === "positioning") {
        const nextTestId = getActiveBatteryTestId(next);
        if (nextTestId === "functionalReach") {
          bindPreviewProcessor();
          movementArmedRef.current = false;
        } else {
          switchToActiveTestProcessor(nextTestId);
        }
        resetBatterySpeechForTest();
        stableSinceRef.current = null;
        setHoldStillVisible(false);
      }
      return next;
    });
  }, [
    activeTestId,
    bindPreviewProcessor,
    cameraSnapshot?.processor,
    orchestrator.phase,
    orchestrator.repsCompleted,
    orchestrator.testIndex,
    requiredReps,
    switchToActiveTestProcessor,
    testedSide,
  ]);

  useEffect(() => {
    if (orchestrator.phase !== "assessment_completed" || orchestrator.submitAttempted) return;
    const payload = buildBatteryPayload({
      testedSide,
      results: orchestrator.results,
    });
    speakBatteryCue("assessment-completed", testedSide, "assessment-done");
    setOrchestrator((current) => markBatterySubmitting(current));
    onBatteryCompleteRef.current(payload);
  }, [orchestrator.phase, orchestrator.results, orchestrator.submitAttempted, testedSide]);

  const statusLine = useMemo(() => {
    if (!assessmentStarted) {
      return getInitialPositionInstruction(testedSide);
    }
    if (trackingLost) {
      return getTrackingLostStatus(testedSide);
    }
    if (orchestrator.phase === "reposition_side") {
      if (repositionReady) return "Position detected";
      return getRepositionInstruction(testedSide);
    }
    if (holdStillVisible && orchestrator.phase === "positioning") {
      return getHoldStillStatus();
    }
    if (orchestrator.phase === "positioning") {
      const setup = getTestSetupInstruction(activeTestId, testedSide);
      if (setup && activeOrientation === "face_camera") return setup;
    }
    if (orchestrator.phase === "countdown" && orchestrator.countdown !== null) {
      return String(orchestrator.countdown);
    }
    if (
      orchestrator.phase === "test_active" ||
      orchestrator.phase === "test_completed" ||
      orchestrator.phase === "positioning"
    ) {
      return getMovementInstruction(activeTestId, testedSide);
    }
    if (orchestrator.phase === "assessment_completed" || orchestrator.phase === "submitting") {
      return "Assessment completed.";
    }
    return getPositioningStatus(testedSide, positionReady);
  }, [
    activeOrientation,
    activeTestId,
    assessmentStarted,
    holdStillVisible,
    orchestrator.countdown,
    orchestrator.phase,
    positionReady,
    repositionReady,
    testedSide,
    trackingLost,
  ]);

  const progressLabel = useMemo(() => {
    if (!assessmentStarted) return null;
    if (
      orchestrator.phase === "assessment_completed" ||
      orchestrator.phase === "submitting" ||
      orchestrator.phase === "submit_failed"
    ) {
      return "Assessment completed";
    }
    if (orchestrator.phase === "reposition_side") {
      return getRepositionProgressLabel();
    }
    const repsForLabel =
      orchestrator.phase === "test_completed"
        ? requiredReps
        : Math.max(orchestrator.repsCompleted, 0);
    return getTestProgressLabel(
      orchestrator.testIndex,
      activeTestId,
      repsForLabel,
      requiredReps,
    );
  }, [
    activeTestId,
    assessmentStarted,
    orchestrator.phase,
    orchestrator.repsCompleted,
    orchestrator.testIndex,
    repositionReady,
    requiredReps,
  ]);

  const showRecoveryControls =
    assessmentStarted &&
    orchestrator.phase !== "assessment_completed" &&
    orchestrator.phase !== "submitting";

  return (
    <section className="mt-6">
      {!assessmentStarted ? (
        <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
          <h2 className="text-lg font-bold text-white">Remote Upper-Limb Assessment</h2>
          <p className="mt-2 text-sm text-white/55">Tests:</p>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {overviewLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[10px] border border-[#1E2D42] bg-black">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover opacity-0"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>

      {cameraError ? (
        <p className="mt-3 text-sm text-rose-200">{cameraError}</p>
      ) : null}

      <div className="mt-4 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-4">
        {progressLabel ? (
          <p className="whitespace-pre-line text-sm font-semibold text-[#1D9E75]">{progressLabel}</p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-white/70">{statusLine}</p>
        {assessmentStarted && activeTestId === "functionalReach" ? (
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Keep your feet still. Stepping is not automatically measured in this release.
          </p>
        ) : null}
      </div>

      {IS_DEV && assessmentStarted && processorSnapshot ? (
        <div className="mt-3 rounded-[7px] border border-dashed border-white/15 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-white/45">
          <p>dev tracking — not shown to patients in production</p>
          <p>testedSide: {testedSide}</p>
          <p>phase: {orchestrator.phase}</p>
          <p>trackingReady: {String(processorSnapshot.trackingReady)}</p>
          <p>trackingQuality: {processorSnapshot.trackingQuality}</p>
          <p>rejection: {trackingRejection}</p>
          {landmarkDebug ? (
            <>
              <p>
                right shoulder/elbow/wrist:{" "}
                {landmarkDebug.right.shoulder.toFixed(2)} / {landmarkDebug.right.elbow.toFixed(2)} /{" "}
                {landmarkDebug.right.wrist.toFixed(2)}
              </p>
              <p>
                left shoulder/elbow/wrist:{" "}
                {landmarkDebug.left.shoulder.toFixed(2)} / {landmarkDebug.left.elbow.toFixed(2)} /{" "}
                {landmarkDebug.left.wrist.toFixed(2)}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!previewActive ? (
          <button
            type="button"
            disabled={disabled || cameraStarting}
            onClick={() => void handleStartCamera()}
            className="rounded-[7px] bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#178f68] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cameraStarting ? "Starting camera…" : "Start Camera"}
          </button>
        ) : null}

        {previewActive && !assessmentStarted ? (
          <button
            type="button"
            disabled={disabled || !positionReady}
            onClick={handleStartAssessment}
            className="rounded-[7px] bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#178f68] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {positionReady ? "Start Assessment" : "Waiting for position…"}
          </button>
        ) : null}

        {previewActive && !assessmentStarted && positionReady ? (
          <span className="self-center text-sm text-[#1D9E75]">Position detected</span>
        ) : null}

        {showRecoveryControls ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={handleRetryCurrentTest}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Retry Current Test
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleCancelAssessment}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Assessment
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
