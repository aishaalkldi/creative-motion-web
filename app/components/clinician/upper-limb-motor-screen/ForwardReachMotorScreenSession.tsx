"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ForwardReachCameraDetector,
  FORWARD_REACH_NEXT_ACTION_LABELS,
  nextForwardReachAction,
  type ForwardReachCameraSnapshot,
} from "@/app/lib/cv/forward-reach-camera-detector";
import { validateForwardReachConfig } from "@/app/lib/upper-limb-motor-screen/forward-reach-engine";
import { isUuidPatientId } from "@/app/lib/api/patient-id-utils";
import {
  createUpperLimbMotorScreenAssignment,
  createUpperLimbMotorScreenSessionResult,
  fetchLatestUpperLimbMotorScreenAssignment,
  fetchLatestUpperLimbMotorScreenSessionResult,
  finalizeUpperLimbMotorScreenSessionResult,
} from "@/app/lib/api/upper-limb-motor-screen-client";
import {
  buildForwardReachAssignmentRequest,
  FORWARD_REACH_SCREEN_DEFINITION_ID,
  type ForwardReachSetupFormState,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-assignment-request";
import { buildForwardReachSessionResultRequest } from "@/app/lib/upper-limb-motor-screen/forward-reach-session-result-request";
import { loadForwardReachSessionState } from "@/app/lib/upper-limb-motor-screen/forward-reach-session-load";
import { buildClinicianClinicalStopEvent } from "@/app/lib/upper-limb-motor-screen/forward-reach-clinical-stop";
import { resolveForwardReachSessionPhase } from "@/app/lib/upper-limb-motor-screen/forward-reach-session-lifecycle";
import { createSingleFlightGuard } from "@/app/lib/upper-limb-motor-screen/single-flight-guard";
import { CLINICAL_STOP_REASONS, type ClinicalStopEvent, type ClinicalStopReason } from "@/app/lib/upper-limb-motor-screen/types";
import type { UpperLimbMovementAttemptResult } from "@/app/lib/upper-limb-motor-screen/types";
import type { UpperLimbMotorScreenAssignmentPublic } from "@/app/lib/upper-limb-motor-screen/assignment-persistence";
import type { UpperLimbMotorScreenSessionResultPublic } from "@/app/lib/upper-limb-motor-screen/session-result-persistence";
import { ForwardReachSetupForm } from "./ForwardReachSetupForm";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type ForwardReachMotorScreenSessionProps = {
  patientId: string;
};

/** Existing Forward Reach camera runtime geometry/config, unchanged from
 * app/clinician/forward-reach-camera-lab/page.tsx — never moved into the
 * assignment payload, never made clinician-configurable in this slice. */
const RUNTIME_CONFIG = {
  fixedTarget: { point: { x: 0.7, y: 0.5 }, radius: 0.05 },
  startingZone: { point: { x: 0.3, y: 0.5 }, radius: 0.05 },
  tracking: { minWristVisibility: 0.3, maxAllowedGapMs: 300 },
  timing: { onsetConfirmationMs: 100, dwellDurationMs: 200, returnConfirmationMs: 150 },
};

export function ForwardReachMotorScreenSession({ patientId }: ForwardReachMotorScreenSessionProps) {
  const isUuidPatient = isUuidPatientId(patientId);

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<UpperLimbMotorScreenAssignmentPublic | null>(null);
  const [sessionResult, setSessionResult] = useState<UpperLimbMotorScreenSessionResultPublic | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraSnapshot, setCameraSnapshot] = useState<ForwardReachCameraSnapshot | null>(null);
  const [selectedStopReason, setSelectedStopReason] = useState<ClinicalStopReason | "">("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ForwardReachCameraDetector | null>(null);
  const startCameraInProgressRef = useRef(false);
  const terminalAttemptRef = useRef<UpperLimbMovementAttemptResult | null>(null);
  const recordedClinicalStopEventRef = useRef<ClinicalStopEvent | null>(null);
  const assignmentRef = useRef<UpperLimbMotorScreenAssignmentPublic | null>(null);
  useEffect(() => {
    assignmentRef.current = assignment;
  }, [assignment]);

  const createAssignmentGuardRef = useRef(createSingleFlightGuard());
  const saveResultGuardRef = useRef(createSingleFlightGuard());
  const finalizeGuardRef = useRef(createSingleFlightGuard());

  // ── On mount: find-or-nothing. Never fabricates an assignment or
  // result — only ever reflects what the server actually has.
  //
  // Deliberately NOT wrapped in a single-flight guard (unlike the
  // create/save/finalize actions below): a guard here interacts badly
  // with React StrictMode's mount→cleanup→remount replay in dev. That
  // replay runs this effect twice in immediate synchronous succession;
  // a shared guard would let the FIRST invocation's fetch start, then
  // silently skip the SECOND invocation's fetch (guard still
  // "in progress") — but the first invocation's own `cancelled` flag
  // is flipped by its cleanup before its fetch resolves, so its result
  // gets discarded too, and loading=false is never reached by anyone.
  // The plain per-invocation `cancelled` flag alone is the correct,
  // standard fix: StrictMode's replay does issue two real GETs (reads,
  // not writes — never a duplicate persistence write), but the second
  // (currently-active) invocation's `cancelled` stays false and always
  // reaches loading=false. The fetch orchestration itself is extracted
  // into loadForwardReachSessionState (forward-reach-session-load.ts)
  // so it's testable with injected fakes; only the cancelled-flag
  // wiring and the resulting setState calls live in this effect. Its
  // output feeds resolveForwardReachSessionPhase (forward-reach-session-lifecycle.ts).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loadForwardReachSessionState({
      isUuidPatient,
      patientId,
      screenDefinitionId: FORWARD_REACH_SCREEN_DEFINITION_ID,
      isCancelled: () => cancelled,
      fetchAssignment: fetchLatestUpperLimbMotorScreenAssignment,
      fetchSessionResult: fetchLatestUpperLimbMotorScreenSessionResult,
    }).then((result) => {
      if (result.cancelled) return;
      if (!result.ok) {
        if (result.error) setErrorMessage(result.error);
        setLoading(false);
        return;
      }
      setAssignment(result.assignment);
      setSessionResult(result.sessionResult);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [patientId, isUuidPatient]);

  const persistTerminalAttempt = useCallback(async (attempt: UpperLimbMovementAttemptResult) => {
    const currentAssignment = assignmentRef.current;
    if (!currentAssignment) return;

    const outcome = await saveResultGuardRef.current.run(async () => {
      const body = buildForwardReachSessionResultRequest({
        assignmentId: currentAssignment.assignment.id,
        attempt,
        clinicalStopEvent: recordedClinicalStopEventRef.current,
      });
      return createUpperLimbMotorScreenSessionResult(body);
    });
    // Structurally unreachable under normal operation: handleSnapshot only
    // ever calls persistTerminalAttempt once per attempt (guarded by
    // terminalAttemptRef reference-equality, and the engine itself never
    // produces a second distinct terminal attemptResult — see
    // forward-reach-engine.ts's `if (state.terminal) return rejected(...)`
    // guard). If this branch is ever hit regardless, saveStatus is left
    // exactly as-is here rather than touched: the other, currently-in-flight
    // call that caused this skip is guaranteed to reach either "saved" or
    // "error" itself, so saveStatus can never end up permanently stuck on
    // "saving" from this branch.
    if (outcome.skipped) return;

    const result = outcome.value;
    if (!result.ok) {
      setSaveStatus("error");
      if (!("skipped" in result)) setErrorMessage(result.error);
      return;
    }
    setSessionResult(result.data);
    setSaveStatus("saved");
  }, []);

  const handleSnapshot = useCallback(
    (snapshot: ForwardReachCameraSnapshot) => {
      setCameraSnapshot(snapshot);
      if (snapshot.attemptResult && snapshot.attemptResult !== terminalAttemptRef.current) {
        terminalAttemptRef.current = snapshot.attemptResult;
        setSaveStatus("saving");
        void persistTerminalAttempt(snapshot.attemptResult);
      }
    },
    [persistTerminalAttempt],
  );

  useEffect(() => {
    if (!assignment || sessionResult) return; // only mount the runtime while there's something to run
    const detector = new ForwardReachCameraDetector({ onSnapshot: handleSnapshot });
    detectorRef.current = detector;
    return () => {
      detector.stop();
      detectorRef.current = null;
    };
  }, [assignment, sessionResult, handleSnapshot]);

  const handleStartCamera = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const currentAssignment = assignmentRef.current;
    // Mirrors app/clinician/forward-reach-camera-lab/page.tsx's start
    // guard exactly: the ref check closes the synchronous gap before
    // the first state-driven re-render lands (so a rapid double-click
    // cannot call detector.start() twice), and the status check covers
    // any stale-closure re-entry after initialization has finished.
    if (
      !detector ||
      !video ||
      !canvas ||
      !currentAssignment ||
      startCameraInProgressRef.current ||
      cameraSnapshot?.status === "running"
    ) {
      return;
    }

    const testedSide = currentAssignment.assignment.taskAssignmentGroups[0]?.testedSide;
    if (!testedSide) return;

    const configResult = validateForwardReachConfig({ testedSide, ...RUNTIME_CONFIG });
    if (!configResult.ok) {
      setErrorMessage(`Invalid runtime config: ${configResult.reason}`);
      return;
    }

    startCameraInProgressRef.current = true;
    try {
      await detector.start(video, canvas, configResult.config);
    } catch (err) {
      console.error("[ForwardReachMotorScreenSession] camera start failed:", err);
    } finally {
      startCameraInProgressRef.current = false;
    }
  }, [cameraSnapshot?.status]);

  const handleStopCamera = useCallback(() => {
    detectorRef.current?.stop();
  }, []);

  const handleCalibrateStartingPosition = useCallback(() => {
    detectorRef.current?.calibrateStartingPosition();
  }, []);

  const handleArmReadiness = useCallback(() => {
    detectorRef.current?.armReadiness();
  }, []);

  const handleResume = useCallback(() => {
    detectorRef.current?.resumeAfterPause("clinician");
  }, []);

  const handleClinicalStop = useCallback(() => {
    if (!selectedStopReason || !detectorRef.current) return;
    const event = buildClinicianClinicalStopEvent(selectedStopReason);
    recordedClinicalStopEventRef.current = event;
    detectorRef.current.recordClinicalStop(event);
  }, [selectedStopReason]);

  const handleStartSetup = useCallback(
    async (form: ForwardReachSetupFormState) => {
      const built = buildForwardReachAssignmentRequest(patientId, form);
      if (!built.ok) return; // defensive — Start is already disabled unless complete

      setSaveStatus("saving");
      setErrorMessage(null);

      const outcome = await createAssignmentGuardRef.current.run(async () => {
        return createUpperLimbMotorScreenAssignment(built.body);
      });
      if (outcome.skipped) return;

      const result = outcome.value;
      if (!result.ok) {
        setSaveStatus("error");
        if (!("skipped" in result)) setErrorMessage(result.error);
        return;
      }
      setAssignment(result.data);
      setSaveStatus("idle");
    },
    [patientId],
  );

  const handleFinalize = useCallback(async () => {
    if (!sessionResult) return;
    setSaveStatus("saving");
    setErrorMessage(null);

    const outcome = await finalizeGuardRef.current.run(async () => {
      return finalizeUpperLimbMotorScreenSessionResult(sessionResult.sessionResult.id);
    });
    if (outcome.skipped) return;

    const result = outcome.value;
    if (!result.ok) {
      setSaveStatus("error");
      if (!("skipped" in result)) setErrorMessage(result.error);
      return;
    }
    setSessionResult(result.data);
    setSaveStatus("saved");
  }, [sessionResult]);

  const handleStartNewSession = useCallback(() => {
    setAssignment(null);
    setSessionResult(null);
    terminalAttemptRef.current = null;
    recordedClinicalStopEventRef.current = null;
    setSelectedStopReason("");
    setCameraSnapshot(null);
    setSaveStatus("idle");
    setErrorMessage(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  if (!isUuidPatient) {
    return (
      <Panel title="Upper-Limb Motor Screen — Forward Reach">
        <p className="text-xs text-white/50">
          Not available for this patient record (no persisted patient profile).
        </p>
      </Panel>
    );
  }

  if (loading) {
    return (
      <Panel title="Upper-Limb Motor Screen — Forward Reach">
        <p className="text-xs text-white/50">Loading…</p>
      </Panel>
    );
  }

  const phase = resolveForwardReachSessionPhase({
    isUuidPatient: true,
    assignment: assignment ? { id: assignment.assignment.id } : null,
    sessionResult: sessionResult ? { status: sessionResult.sessionResult.status } : null,
  });

  return (
    <Panel title="Upper-Limb Motor Screen — Forward Reach">
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      {phase === "setup" && (
        <ForwardReachSetupForm onStart={handleStartSetup} disabled={saveStatus === "saving"} />
      )}

      {phase === "readyToRun" && assignment && (
        <div className="space-y-4">
          <SaveStatusBadge status={saveStatus} />

          <div className="flex flex-wrap gap-2">
            {cameraSnapshot?.status !== "running" ? (
              <button
                type="button"
                onClick={() => void handleStartCamera()}
                disabled={cameraSnapshot?.status === "initializing" || startCameraInProgressRef.current}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cameraSnapshot?.status === "initializing"
                  ? cameraSnapshot.initPhase === "import"
                    ? "Loading pose library…"
                    : cameraSnapshot.initPhase === "model"
                      ? "Loading pose model…"
                      : "Starting camera…"
                  : "Start camera"}
              </button>
            ) : (
              <>
                {/* Starting Zone is a session-specific capture of the tested
                    wrist's real resting position, not a fixed point — the
                    clinician gets the patient into the intended starting
                    posture, then explicitly captures it. One-shot per
                    session (see shouldStartForwardReachCalibration): shown
                    only before capture, or to retry after a failure. */}
                {!cameraSnapshot?.attemptResult &&
                  (cameraSnapshot?.calibration.status === "not_started" ||
                    cameraSnapshot?.calibration.status === "failed") && (
                    <button
                      type="button"
                      onClick={handleCalibrateStartingPosition}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      {cameraSnapshot?.calibration.status === "failed"
                        ? "Retry starting-position capture"
                        : "Calibrate starting position"}
                    </button>
                  )}
                {!cameraSnapshot?.attemptResult && cameraSnapshot?.calibration.status === "capturing" && (
                  <p className="flex items-center rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-2 text-sm font-semibold text-amber-300">
                    Capturing starting position — hold the tested wrist steady…
                  </p>
                )}
                {!cameraSnapshot?.attemptResult && cameraSnapshot?.calibration.status === "failed" && (
                  <p className="flex items-center rounded-lg border border-rose-400/25 bg-rose-400/5 px-4 py-2 text-sm font-semibold text-rose-300">
                    Starting-position capture failed — reposition and try again.
                  </p>
                )}

                {/* Once a terminal attempt result has been captured, the
                    attempt is over: readiness/resume must never dispatch
                    a further runtime command (the engine would reject it
                    anyway, but the control is removed here too so the UI
                    never invites a no-op click while the result saves).
                    Once readiness is already armed, the button is hidden
                    rather than left clickable — a redundant re-arm would
                    reset the in-progress in-zone stability timer and can
                    prevent readiness from ever confirming. Also requires
                    the starting position to be captured first (the engine
                    won't accept readiness before then anyway, but the
                    control is hidden too so it never invites a no-op
                    click), and only shows while phase is still idle/
                    awaiting_readiness — once movement is underway this
                    control has nothing left to do. */}
                {!cameraSnapshot?.attemptResult &&
                  !cameraSnapshot?.readinessArmed &&
                  cameraSnapshot?.calibration.status === "captured" &&
                  (cameraSnapshot?.engineSnapshot?.phase === "idle" ||
                    cameraSnapshot?.engineSnapshot?.phase === "awaiting_readiness") && (
                    <button
                      type="button"
                      onClick={handleArmReadiness}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      Arm readiness
                    </button>
                  )}
                {!cameraSnapshot?.attemptResult && cameraSnapshot?.readinessArmed && (
                  <p className="flex items-center rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-2 text-sm font-semibold text-amber-300">
                    Readiness armed — hold the tested wrist in the starting zone
                    {cameraSnapshot.readinessArmedTimeRemaining !== null
                      ? ` (${Math.ceil(cameraSnapshot.readinessArmedTimeRemaining / 1000)}s)`
                      : ""}
                  </p>
                )}
                {!cameraSnapshot?.attemptResult && cameraSnapshot?.engineSnapshot?.hasActivePause && (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                  >
                    Resume after pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white"
                >
                  Stop camera
                </button>
              </>
            )}
          </div>

          {cameraSnapshot?.status === "running" && !cameraSnapshot?.attemptResult && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-rose-400/25 bg-rose-400/5 p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-rose-200">Clinical stop reason</label>
                <select
                  value={selectedStopReason}
                  onChange={(e) => setSelectedStopReason(e.target.value as ClinicalStopReason)}
                  className="rounded-lg border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm text-white"
                >
                  <option value="">Select…</option>
                  {CLINICAL_STOP_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!selectedStopReason}
                onClick={handleClinicalStop}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop session
              </button>
            </div>
          )}

          {cameraSnapshot?.attemptResult && (
            <p className="text-xs font-semibold text-amber-300">
              Terminal result captured — saving, runtime controls disabled.
            </p>
          )}

          <video ref={videoRef} autoPlay muted playsInline className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" aria-hidden />
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full rounded-lg border border-[#1E2D42] bg-[#0B1220]"
            style={{ display: cameraSnapshot?.status === "running" ? "block" : "none", transform: "scaleX(-1)" }}
          />

          {cameraSnapshot?.calibration.status === "captured" && cameraSnapshot.calibration.capturedPoint && (
            <p className="text-xs text-emerald-300/80">
              Starting position captured at ({cameraSnapshot.calibration.capturedPoint.x.toFixed(3)},{" "}
              {cameraSnapshot.calibration.capturedPoint.y.toFixed(3)}) — frozen for this session.
            </p>
          )}

          {cameraSnapshot?.engineSnapshot && !cameraSnapshot.attemptResult && (
            <p className="text-sm font-semibold text-emerald-300">
              Next:{" "}
              {
                FORWARD_REACH_NEXT_ACTION_LABELS[
                  nextForwardReachAction(
                    cameraSnapshot.engineSnapshot.phase,
                    cameraSnapshot.engineSnapshot.hasActivePause,
                  )
                ]
              }
            </p>
          )}

          {cameraSnapshot?.engineSnapshot && (
            <p className="text-xs text-white/50">
              Phase: {cameraSnapshot.engineSnapshot.phase} · Terminal:{" "}
              {cameraSnapshot.engineSnapshot.terminal ? "yes" : "no"}
            </p>
          )}
        </div>
      )}

      {phase === "computedUnfinalized" && sessionResult && (
        <div className="space-y-4">
          <SaveStatusBadge status={saveStatus} />
          <p className="text-sm text-white/80">
            Result saved — completion:{" "}
            <span className="font-mono">
              {sessionResult.sessionResult.taskCompletion[0]?.completionState ?? "—"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void handleFinalize()}
            disabled={saveStatus === "saving"}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalize
          </button>
        </div>
      )}

      {phase === "finalized" && sessionResult && (
        <div className="space-y-4">
          <p className="text-sm text-white/80">
            Session finalized — completion:{" "}
            <span className="font-mono">
              {sessionResult.sessionResult.taskCompletion[0]?.completionState ?? "—"}
            </span>
          </p>
          <button
            type="button"
            onClick={handleStartNewSession}
            className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/15"
          >
            Start new session
          </button>
        </div>
      )}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1E2D42] bg-[#0F1825] p-6">
      <h3 className="mb-4 text-base font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const label = { saving: "Saving…", saved: "Saved", error: "Save failed" }[status];
  const color =
    status === "saving"
      ? "text-amber-300"
      : status === "saved"
        ? "text-emerald-400"
        : "text-rose-400";
  return <p className={`text-xs font-semibold ${color}`}>{label}</p>;
}
