/**
 * Forward Reach Live-Camera Detector — Experimental integration spike.
 *
 * Validates that MediaPipe → BLAZEPOSE_ACQUISITION_ADAPTER → Forward Reach
 * engine integration works correctly from real camera input.
 *
 * Owns: camera lifecycle, MediaPipe initialization, frame loop, engine feeding.
 *
 * Does NOT own: React UI, tested side selection UI, persistence, API calls.
 *
 * Pattern: Mirrors SitToStandDetector architecture.
 */

import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import { BLAZEPOSE_ACQUISITION_ADAPTER } from "@/app/lib/input-acquisition/adapters/motion/blazepose-acquisition-adapter";
import type { InputAcquisitionContext } from "@/app/lib/input-acquisition/contract";
import {
  applyForwardReachCommand,
  createForwardReachAttemptState,
  getForwardReachRuntimeSnapshot,
  validateForwardReachConfig,
  type ForwardReachAttemptState,
  type ForwardReachConfig,
  type ForwardReachPhase,
  type ForwardReachRuntimeSnapshot,
} from "@/app/lib/upper-limb-motor-screen/forward-reach-engine";
import type {
  ClinicalStopEvent,
  UpperLimbMovementAttemptResult,
  UpperLimbSide,
} from "@/app/lib/upper-limb-motor-screen/types";
import {
  releaseMediaStream,
  waitForDecodedVideoFrames,
  waitForVideoElementLayout,
} from "@/app/lib/cv/patient-camera-stream";
// Starting-zone calibration reuses the Lateral Reach interaction-calibration
// domain's stable-point capture reducer as-is: it has no lateral-reach-specific
// semantics (it's a generic "N samples within a jitter radius held for a
// duration" accumulator, imported directly rather than reimplemented — see
// FORWARD_REACH_START_CAPTURE_CONFIG below and this file's calibration
// section for how it's wired in).
import {
  createLateralReachStartCaptureState,
  updateLateralReachStartCapture,
  type LateralReachStartCaptureConfig,
  type LateralReachStartCaptureSample,
  type LateralReachStartCaptureState,
} from "@/app/lib/interaction-calibration/lateral-reach/start-capture";
import type { LateralReachCaptureFailureReason } from "@/app/lib/interaction-calibration/lateral-reach/types";
import { resolveLateralReachCalibrationSampleFromFrame } from "@/app/lib/upper-limb-motor-screen/lateral-reach-calibration-camera-sample-adapter";

export type ForwardReachCameraStatus = "idle" | "initializing" | "running" | "error";
export type ForwardReachCameraInitPhase = null | "import" | "model" | "camera";

// ---------------------------------------------------------------------------
// Starting-zone calibration
// ---------------------------------------------------------------------------

export type ForwardReachStartingZoneCalibrationStatus = "not_started" | "capturing" | "captured" | "failed";

/**
 * Extends the reused Lateral Reach capture-failure vocabulary with exactly
 * one Forward-Reach-specific outcome: the captured point was tracked and
 * stable, but building a valid engine config from it failed (e.g. the
 * captured point landed too close to the fixed target for
 * validateForwardReachConfig's zone-overlap check). Every other reason
 * comes straight from the reused reducer's own failure vocabulary — see
 * start-capture.ts's deriveFailureReasons, which only ever produces the
 * capture-stage subset (never the lateral-reach-only direction/endpoint
 * reasons also present in this reused type).
 */
export type ForwardReachStartingZoneCalibrationFailureReason = LateralReachCaptureFailureReason | "geometry_invalid";

export type ForwardReachStartingZoneCalibrationSnapshot = {
  status: ForwardReachStartingZoneCalibrationStatus;
  capturedPoint: { x: number; y: number } | null;
  failureReasons: readonly ForwardReachStartingZoneCalibrationFailureReason[] | null;
};

/**
 * Fixed capture parameters — NOT clinically validated numeric defaults,
 * and not invented for this change: minStableDurationMs/totalTimeoutMs
 * reuse the 750ms hold / 15-second window already established and
 * reviewed elsewhere in this exact file for the readiness-arm mechanism;
 * maxJitterRadius reuses the starting zone's own 0.05 acceptance radius
 * (holding steady within the zone's own eventual size is a
 * self-consistent bar, not a new number). minStableSampleCount is a
 * small defensive floor against a single-frame accidental capture.
 */
export const FORWARD_REACH_START_CAPTURE_CONFIG: LateralReachStartCaptureConfig = {
  minStableDurationMs: 750,
  maxJitterRadius: 0.05,
  minStableSampleCount: 5,
  totalTimeoutMs: 15_000,
};

export type ForwardReachCameraSnapshot = {
  status: ForwardReachCameraStatus;
  initPhase: ForwardReachCameraInitPhase;
  error: string | null;
  engineSnapshot: ForwardReachRuntimeSnapshot | null;

  // Laterality diagnostics
  rightWristVisibility: number | null;
  leftWristVisibility: number | null;
  rightWristCoords: { x: number; y: number } | null;
  leftWristCoords: { x: number; y: number } | null;
  testedSide: UpperLimbSide;

  // Command feedback
  lastCommandType: string | null;
  lastCommandStatus: "applied" | "rejected" | null;
  lastCommandRejectionReason: string | null;

  // Starting-zone calibration — see calibrateStartingPosition().
  calibration: ForwardReachStartingZoneCalibrationSnapshot;

  // Armed readiness
  readinessArmed: boolean;
  readinessArmedTimeRemaining: number | null; // milliseconds remaining in armed window

  /**
   * The engine's own terminal UpperLimbMovementAttemptResult, once
   * produced — retained verbatim from applyForwardReachCommand's return
   * value, never recomputed here. Null until the attempt reaches a
   * terminal state.
   */
  attemptResult: UpperLimbMovementAttemptResult | null;
};

/**
 * Pure, additive plumbing only: applyForwardReachCommand already returns
 * `attemptResult` on every "applied" result (null until terminal). This
 * function's only job is to retain that already-computed value once it
 * appears, and to never lose it again if a later command's result
 * doesn't carry one (e.g. an "applied" readiness/resume command has no
 * attemptResult of its own, but a terminal result already captured
 * earlier from a prior command must not be discarded). Nothing here
 * recomputes, reinterprets, or derives any new engine value — it is a
 * verbatim pass-through of the engine's own answer.
 */
export function deriveNextForwardReachAttemptResult(
  engineResult: { status: "applied" | "rejected"; attemptResult?: UpperLimbMovementAttemptResult | null },
  previousAttemptResult: UpperLimbMovementAttemptResult | null,
): UpperLimbMovementAttemptResult | null {
  if (engineResult.status === "applied" && engineResult.attemptResult) {
    return engineResult.attemptResult;
  }
  return previousAttemptResult;
}

/**
 * Decides whether the engine's current phase, combined with whether this
 * attempt has already had its window auto-ended, means attemptWindowEnded
 * should be dispatched now. "completed_pending_finalization" is the
 * engine's own signal that return-to-start has been confirmed and no
 * further frame data is expected — see forward-reach-engine.ts, which
 * rejects every later frame/observationUnavailable command from that
 * phase onward. Pure and DOM-free precisely so the once-only automatic
 * finalization decision is testable without a browser (see this file's
 * own header comment on why the class itself isn't unit-tested).
 */
export function shouldAutoDispatchForwardReachAttemptWindowEnd(
  phase: ForwardReachPhase,
  alreadyDispatched: boolean,
): boolean {
  return phase === "completed_pending_finalization" && !alreadyDispatched;
}

/**
 * Decides whether an armReadiness() call should actually (re)arm the
 * 15-second auto-readiness window. False whenever already armed: arming
 * unconditionally resets readinessStableSinceMs to null, so a redundant
 * call — e.g. a UI control that stays visible/clickable after readiness
 * is already armed — would silently discard an in-progress continuous
 * in-zone stability hold and restart it from zero, which can prevent the
 * required stability duration from ever being reached in practice.
 *
 * Also requires calibrationStatus === "captured": readiness is measured
 * against startingZone.point, which is a placeholder until the tested
 * wrist's real starting position has been captured (see
 * shouldStartForwardReachCalibration/calibrateStartingPosition) — arming
 * against the placeholder would ask the patient to reach an arbitrary
 * point that has nothing to do with where they were actually seated.
 *
 * Pure and DOM-free for the same reason as this file's other exported
 * decision functions (see this file's header comment).
 */
export function shouldArmForwardReachReadiness(
  status: ForwardReachCameraStatus,
  phase: ForwardReachPhase,
  alreadyArmed: boolean,
  calibrationStatus: ForwardReachStartingZoneCalibrationStatus,
): boolean {
  return (
    status === "running" &&
    !alreadyArmed &&
    calibrationStatus === "captured" &&
    (phase === "idle" || phase === "awaiting_readiness")
  );
}

/**
 * Decides whether calibrateStartingPosition() should actually (re)start
 * capturing the tested wrist's real starting position. One-shot per
 * session once captured: calibration must not continue tracking the
 * wrist and silently moving the zone after a successful capture (the
 * zone is frozen at that point, per this session's product requirement).
 * A retry is allowed from "failed" (e.g. the patient wasn't in frame in
 * time) but never from "captured" or while already "capturing".
 */
export function shouldStartForwardReachCalibration(
  status: ForwardReachCameraStatus,
  phase: ForwardReachPhase,
  calibrationStatus: ForwardReachStartingZoneCalibrationStatus,
): boolean {
  return (
    status === "running" &&
    (phase === "idle" || phase === "awaiting_readiness") &&
    (calibrationStatus === "not_started" || calibrationStatus === "failed")
  );
}

/**
 * Builds a new ForwardReachConfig with startingZone.point replaced by the
 * captured point, AND fixedTarget.point shifted by the exact same
 * displacement — the base template's own start-to-target vector
 * (direction + magnitude) is preserved verbatim, never reinvented, only
 * re-anchored to wherever the patient's real starting position actually
 * is. Without this, fixedTarget would stay at its old absolute screen
 * coordinate — unrelated to a starting position that is now itself
 * patient/session-specific, and in practice unreachable by any natural
 * reach gesture from an arbitrary calibrated start.
 *
 * Radii and every other field (testedSide, tracking, timing) are
 * preserved verbatim. Pure — the caller is responsible for
 * re-validating the result via validateForwardReachConfig, since the
 * shifted target could in principle land outside [0,1] or too close to
 * the new starting zone.
 */
export function applyCapturedForwardReachStartingZonePoint(
  baseConfig: ForwardReachConfig,
  capturedPoint: { x: number; y: number },
): ForwardReachConfig {
  const deltaX = baseConfig.fixedTarget.point.x - baseConfig.startingZone.point.x;
  const deltaY = baseConfig.fixedTarget.point.y - baseConfig.startingZone.point.y;
  return {
    ...baseConfig,
    startingZone: {
      point: { x: capturedPoint.x, y: capturedPoint.y },
      radius: baseConfig.startingZone.radius,
    },
    fixedTarget: {
      point: { x: capturedPoint.x + deltaX, y: capturedPoint.y + deltaY },
      radius: baseConfig.fixedTarget.radius,
    },
  };
}

export type ForwardReachNextAction =
  | "hold_starting_position"
  | "reach_to_target"
  | "hold_target"
  | "return_to_start"
  | "complete"
  | "paused";

/**
 * Maps the engine's current phase (plus whether a protective pause is
 * active) to the single next action the clinician/patient must take.
 * A pause always wins regardless of phase — resuming is the only
 * meaningful next step while one is active. Pure and exhaustive over
 * FORWARD_REACH_PHASES (a compile error here means a new phase was
 * added to the engine without updating this mapping).
 */
export function nextForwardReachAction(phase: ForwardReachPhase, hasActivePause: boolean): ForwardReachNextAction {
  if (hasActivePause) return "paused";
  switch (phase) {
    case "idle":
    case "awaiting_readiness":
      return "hold_starting_position";
    case "ready_confirmed_awaiting_onset":
    case "outbound":
      return "reach_to_target";
    case "dwelling":
      return "hold_target";
    case "reach_confirmed":
    case "returning":
      return "return_to_start";
    case "completed_pending_finalization":
      return "complete";
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

/** Human-readable label for each ForwardReachNextAction, shared by the
 * canvas overlay and any React caller (see getSnapshot()/engineSnapshot
 * consumers) that wants to show the same instruction text. */
export const FORWARD_REACH_NEXT_ACTION_LABELS: Record<ForwardReachNextAction, string> = {
  hold_starting_position: "Hold starting position",
  reach_to_target: "Reach to target",
  hold_target: "Hold target",
  return_to_start: "Return to start",
  complete: "Complete",
  paused: "Paused — resume when ready",
};

/**
 * Converts the starting-zone's normalized-space radius into pixel radii
 * for canvas rendering. A circular tolerance in NORMALIZED [0,1] x/y
 * space — what checkArmedReadiness, the engine, and this file's own
 * "wristInZone" status text all compute distance in — is only a visual
 * circle when the canvas is square. On a non-square canvas (e.g. this
 * detector's 640x480 default), the true iso-distance contour of that
 * tolerance is an ellipse in pixel space, since one pixel in x and one
 * pixel in y represent different fractions of the same normalized unit.
 * Drawing a single Math.min(width,height)-based circle therefore drew a
 * visual zone that did not exactly match the region actually being
 * checked. Returning distinct x/y radii lets the caller draw an ellipse
 * instead, so the rendered zone is geometrically identical to the real
 * acceptance region.
 */
export function computeForwardReachZoneRadiusPixels(
  radiusNormalized: number,
  canvasWidth: number,
  canvasHeight: number,
): { radiusXPixels: number; radiusYPixels: number } {
  return {
    radiusXPixels: radiusNormalized * canvasWidth,
    radiusYPixels: radiusNormalized * canvasHeight,
  };
}

export type ForwardReachStartingZoneGuidance =
  | { status: "inside"; distance: number }
  | {
      status: "outside";
      distance: number;
      horizontal: "move_left_on_screen" | "move_right_on_screen" | null;
      vertical: "move_up" | "move_down" | null;
    };

/**
 * Directional guidance toward the starting zone from the tested wrist's
 * current raw (un-mirrored) normalized position. "inside" uses the exact
 * same <= comparison as isWristInsideTarget (target-hit.ts) and
 * checkArmedReadiness, so it always agrees with the real gate.
 *
 * Horizontal guidance is deliberately inverted from raw dx: the canvas
 * bitmap is drawn in raw (un-mirrored) coordinates and then the whole
 * canvas element is CSS-mirrored (transform: scaleX(-1)) for display —
 * a wrist at a LARGER raw x than the zone is therefore displayed at a
 * SMALLER pixel x (further left on screen) than the zone, so telling
 * the clinician to "move right on screen" is what actually closes the
 * gap they can see. Verified against a worked numeric example in this
 * module's test file. Vertical guidance needs no such inversion — the
 * mirror is horizontal-only.
 */
export function computeForwardReachStartingZoneGuidance(
  wrist: { x: number; y: number },
  zone: { point: { x: number; y: number }; radius: number },
): ForwardReachStartingZoneGuidance {
  const dx = wrist.x - zone.point.x;
  const dy = wrist.y - zone.point.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= zone.radius) {
    return { status: "inside", distance };
  }

  const EPSILON = 1e-6;
  const horizontal = dx > EPSILON ? "move_right_on_screen" : dx < -EPSILON ? "move_left_on_screen" : null;
  const vertical = dy > EPSILON ? "move_up" : dy < -EPSILON ? "move_down" : null;

  return { status: "outside", distance, horizontal, vertical };
}

type PoseLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

// Pose skeleton connections for debug visualization
// Body-only: shoulders, arms, minimal torso. No face, no legs.
const POSE_CONNECTIONS: [number, number][] = [
  // Shoulders
  [11, 12], // left shoulder to right shoulder
  // Left arm
  [11, 13], // left shoulder to elbow
  [13, 15], // left elbow to wrist
  // Right arm
  [12, 14], // right shoulder to elbow
  [14, 16], // right elbow to wrist
];

// Body landmark indices to draw (shoulders, elbows, wrists only)
const BODY_LANDMARKS_TO_DRAW = [11, 12, 13, 14, 15, 16];

export type ForwardReachCameraDetectorCallbacks = {
  onSnapshot: (snapshot: ForwardReachCameraSnapshot) => void;
};

type ForwardReachCameraConfig = {
  modelUrl?: string;
  wasmUrl?: string;
  initTimeoutMs?: number;
};

const DEFAULT_CONFIG: Required<ForwardReachCameraConfig> = {
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
  initTimeoutMs: 15_000,
};

function mapStartError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Camera access was denied. Please check camera permission and try again.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "The camera is in use by another application. Close other apps and try again.";
    }
  }
  if (err instanceof Error) {
    if (err.message.includes("timed out")) return err.message;
    return err.message;
  }
  return "Camera could not start. Please check camera permission and try again.";
}

/**
 * Forward Reach Camera Detector — validates live MediaPipe → Motor Screen integration.
 *
 * Epoch-based async cancellation prevents stale init completions.
 * Idempotent cleanup safe for stop/unmount during async operations.
 */
export class ForwardReachCameraDetector {
  private readonly config: Required<ForwardReachCameraConfig>;
  private readonly callbacks: ForwardReachCameraDetectorCallbacks;

  // Session lifecycle
  private sessionEpoch = 0;
  private currentEpoch = 0;
  private status: ForwardReachCameraStatus = "idle";
  private initPhase: ForwardReachCameraInitPhase = null;
  private error: string | null = null;

  // Camera resources
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private poseLandmarker: PoseLandmarkerInstance | null = null;

  // Frame processing
  private rafId = 0;
  private detectTimestamp = 0;
  private frameIndex = 0;

  // Engine state
  private engineConfig: ForwardReachConfig | null = null;
  private engineState: ForwardReachAttemptState | null = null;
  private attemptResult: UpperLimbMovementAttemptResult | null = null;
  private attemptWindowEndDispatched = false;

  // Starting-zone calibration
  /** Original template config passed to start() — startingZone.point in
   * here is a placeholder; engineConfig is replaced with a calibrated
   * copy of this once capture succeeds (see applyStartCaptureSample). */
  private baseEngineConfig: ForwardReachConfig | null = null;
  private startCaptureState: LateralReachStartCaptureState | null = null;
  private startingZoneCalibration: ForwardReachStartingZoneCalibrationSnapshot = {
    status: "not_started",
    capturedPoint: null,
    failureReasons: null,
  };

  // Laterality diagnostics
  private lastRightWristVisibility: number | null = null;
  private lastLeftWristVisibility: number | null = null;
  private lastRightWristCoords: { x: number; y: number } | null = null;
  private lastLeftWristCoords: { x: number; y: number } | null = null;

  // Command feedback
  private lastCommandType: string | null = null;
  private lastCommandStatus: "applied" | "rejected" | null = null;
  private lastCommandRejectionReason: string | null = null;

  // Armed readiness
  private readinessArmed = false;
  private readinessArmedUntilMs: number | null = null;
  private readinessStableSinceMs: number | null = null;
  private readinessAlreadySent = false;

  constructor(
    callbacks: ForwardReachCameraDetectorCallbacks,
    config: ForwardReachCameraConfig = {},
  ) {
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getSnapshot(): ForwardReachCameraSnapshot {
    return {
      status: this.status,
      initPhase: this.initPhase,
      error: this.error,
      engineSnapshot: this.engineState ? getForwardReachRuntimeSnapshot(this.engineState) : null,
      rightWristVisibility: this.lastRightWristVisibility,
      leftWristVisibility: this.lastLeftWristVisibility,
      rightWristCoords: this.lastRightWristCoords,
      leftWristCoords: this.lastLeftWristCoords,
      testedSide: this.engineConfig?.testedSide ?? "right",
      lastCommandType: this.lastCommandType,
      lastCommandStatus: this.lastCommandStatus,
      lastCommandRejectionReason: this.lastCommandRejectionReason,
      calibration: this.startingZoneCalibration,
      readinessArmed: this.readinessArmed,
      readinessArmedTimeRemaining:
        this.readinessArmed && this.readinessArmedUntilMs
          ? Math.max(0, this.readinessArmedUntilMs - performance.now())
          : null,
      attemptResult: this.attemptResult,
    };
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.getSnapshot());
  }

  /**
   * Start camera session with Forward Reach engine configuration.
   * Async operations protected by epoch cancellation.
   */
  async start(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    engineConfig: ForwardReachConfig,
  ): Promise<void> {
    // Validate config
    const configResult = validateForwardReachConfig(engineConfig);
    if (!configResult.ok) {
      throw new Error(`Invalid Forward Reach config: ${configResult.reason}`);
    }

    // Start new session epoch
    const epoch = this.sessionEpoch + 1;
    this.sessionEpoch = epoch;
    this.currentEpoch = epoch;

    const isCurrent = () => this.sessionEpoch === epoch;

    this.videoEl = video;
    this.canvasEl = canvas;
    this.engineConfig = configResult.config;
    this.status = "initializing";
    this.initPhase = "import";
    this.error = null;
    this.detectTimestamp = 0;
    this.frameIndex = 0;
    this.lastRightWristVisibility = null;
    this.lastLeftWristVisibility = null;
    this.lastRightWristCoords = null;
    this.lastLeftWristCoords = null;
    this.lastCommandType = null;
    this.lastCommandStatus = null;
    this.lastCommandRejectionReason = null;
    this.attemptResult = null;
    this.attemptWindowEndDispatched = false;
    this.baseEngineConfig = configResult.config;
    this.startCaptureState = null;
    this.startingZoneCalibration = { status: "not_started", capturedPoint: null, failureReasons: null };
    this.emit();

    try {
      // Import MediaPipe
      const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      if (!isCurrent()) return;

      this.initPhase = "model";
      this.emit();

      // Init FilesetResolver
      const fileset = await FilesetResolver.forVisionTasks(this.config.wasmUrl);
      if (!isCurrent()) return;

      // Create PoseLandmarker
      const baseOptions = { modelAssetPath: this.config.modelUrl, delegate: "GPU" as const };
      const options = { baseOptions, runningMode: "VIDEO" as const, numPoses: 1 };

      let landmarker: PoseLandmarkerInstance;
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, options);
      } catch {
        // Fallback to CPU
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...baseOptions, delegate: "CPU" },
        });
      }

      if (!isCurrent()) {
        landmarker.close?.();
        return;
      }
      this.poseLandmarker = landmarker;

      this.initPhase = "camera";
      this.emit();

      // Wait for video element layout
      await waitForVideoElementLayout(video);
      if (!isCurrent()) {
        this.poseLandmarker?.close?.();
        this.poseLandmarker = null;
        return;
      }

      // Release any existing stream
      releaseMediaStream(this.stream, video);

      // getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        this.poseLandmarker?.close?.();
        this.poseLandmarker = null;
        return;
      }
      this.stream = stream;

      // Attach to video element
      video.srcObject = stream;

      // Wait for video playback
      await waitForDecodedVideoFrames(video);
      if (!isCurrent()) return;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Camera opened but no video frames detected.");
      }

      // Initialize Forward Reach engine
      const stateResult = createForwardReachAttemptState(
        this.engineConfig,
        0, // attemptIndex
        performance.now(), // armedAtMs
      );

      if (!stateResult.ok) {
        throw new Error(`Failed to create Forward Reach state: ${stateResult.reason}`);
      }
      this.engineState = stateResult.state;

      // Start frame loop
      this.status = "running";
      this.initPhase = null;
      this.emit();

      this.startFrameLoop(video);
    } catch (err) {
      // Always clean up resources created during this session
      if (this.poseLandmarker && this.currentEpoch === epoch) {
        this.poseLandmarker.close?.();
        this.poseLandmarker = null;
      }

      if (!isCurrent()) return;
      this.stop();
      this.error = mapStartError(err);
      this.status = "error";
      this.emit();
      throw err;
    }
  }

  /**
   * Draw text that remains readable despite canvas CSS mirror (scaleX(-1)).
   * Applies compensating transform so text reads normally.
   */
  private drawUnmirroredText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
  ): void {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillText(text, -(width - x), y);
    ctx.restore();
  }

  /**
   * Draw pose debug overlay: skeleton, tested wrist, starting zone.
   * Engineering visualization only - not clinical measurement.
   */
  private drawPoseDebugOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: PoseLandmark[] | undefined,
  ): void {
    if (!this.engineConfig) return;

    const testedSide = this.engineConfig.testedSide;
    const testedWristIndex = testedSide === "right" ? 16 : 15;

    // Draw skeleton connections
    if (landmarks && landmarks.length > 0) {
      for (const [a, b] of POSE_CONNECTIONS) {
        if (!landmarks[a] || !landmarks[b]) continue;
        if ((landmarks[a].visibility ?? 0) < 0.3 || (landmarks[b].visibility ?? 0) < 0.3) continue;

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * width, landmarks[a].y * height);
        ctx.lineTo(landmarks[b].x * width, landmarks[b].y * height);
        ctx.stroke();
      }

      // Draw body landmarks only (shoulders, elbows, wrists)
      for (const i of BODY_LANDMARKS_TO_DRAW) {
        if (i >= landmarks.length) continue;
        const lm = landmarks[i];
        if (!lm || (lm.visibility ?? 0) < 0.3) continue;

        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fill();
      }

      // Highlight tested wrist
      const testedWrist = landmarks[testedWristIndex];
      if (testedWrist && (testedWrist.visibility ?? 0) >= 0.3) {
        const wx = testedWrist.x * width;
        const wy = testedWrist.y * height;

        // Outer ring
        ctx.beginPath();
        ctx.arc(wx, wy, 12, 0, Math.PI * 2);
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(wx, wy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#22d3ee";
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(wx, wy, 18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,211,238,0.2)";
        ctx.fill();
      }
    }

    // Draw starting zone
    const startingZone = this.engineConfig.startingZone;
    const centerX = startingZone.point.x * width;
    const centerY = startingZone.point.y * height;
    const { radiusXPixels, radiusYPixels } = computeForwardReachZoneRadiusPixels(
      startingZone.radius,
      width,
      height,
    );

    // Zone ellipse — matches the real normalized-space circular tolerance
    // exactly, including on non-square canvases (see
    // computeForwardReachZoneRadiusPixels's doc comment).
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusXPixels, radiusYPixels, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239,159,39,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center marker
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239,159,39,0.9)";
    ctx.fill();

    // Zone label (readable despite CSS mirror)
    ctx.fillStyle = "rgba(239,159,39,0.9)";
    ctx.font = "12px monospace";
    this.drawUnmirroredText(ctx, "Starting Zone", centerX + radiusXPixels + 5, centerY, width);

    // Draw target zone — visually distinct from Starting Zone: solid
    // line (vs. dashed) and a different hue (magenta vs. amber) so the
    // two are never confusable at a glance. Read from this.engineConfig
    // — the exact same object the engine itself validates and checks
    // distance against, so this is guaranteed to be the real target,
    // never a separately-maintained value that could drift from it.
    const fixedTarget = this.engineConfig.fixedTarget;
    const targetCenterX = fixedTarget.point.x * width;
    const targetCenterY = fixedTarget.point.y * height;
    const targetRadiusPixels = computeForwardReachZoneRadiusPixels(fixedTarget.radius, width, height);

    ctx.beginPath();
    ctx.ellipse(
      targetCenterX,
      targetCenterY,
      targetRadiusPixels.radiusXPixels,
      targetRadiusPixels.radiusYPixels,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = "rgba(217,70,239,0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetCenterX, targetCenterY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(217,70,239,0.95)";
    ctx.fill();

    ctx.fillStyle = "rgba(217,70,239,0.95)";
    ctx.font = "bold 12px monospace";
    this.drawUnmirroredText(
      ctx,
      "TARGET",
      targetCenterX + targetRadiusPixels.radiusXPixels + 5,
      targetCenterY,
      width,
    );

    // Readiness status text
    const minVisibility = this.engineConfig.tracking.minWristVisibility;
    let wristTracked = false;
    let guidance: ForwardReachStartingZoneGuidance | null = null;
    let trackedWristPoint: { x: number; y: number } | null = null;

    if (landmarks && landmarks.length > 0) {
      const testedWrist = landmarks[testedWristIndex];
      const visibility = testedWrist?.visibility ?? 0;
      wristTracked = visibility >= minVisibility;

      if (wristTracked && testedWrist) {
        trackedWristPoint = { x: testedWrist.x, y: testedWrist.y };
        guidance = computeForwardReachStartingZoneGuidance(trackedWristPoint, startingZone);
      }
    }
    const wristInZone = guidance?.status === "inside";

    // Status text at top - line 1: tracked status (readable despite CSS mirror)
    const trackedStatus = wristTracked ? "TRACKED" : "NOT TRACKED";
    const trackedColor = wristTracked ? "#22d3ee" : "#ef4444";
    ctx.fillStyle = trackedColor;
    ctx.font = "bold 14px monospace";
    this.drawUnmirroredText(ctx, `Tested wrist (${testedSide.toUpperCase()}): ${trackedStatus}`, 10, 25, width);

    // Line 2: zone status (readable despite CSS mirror)
    if (wristTracked) {
      const zoneStatus = wristInZone ? "INSIDE STARTING ZONE" : "OUTSIDE STARTING ZONE";
      const zoneColor = wristInZone ? "#22d3ee" : "#ef9f27";
      ctx.fillStyle = zoneColor;
      this.drawUnmirroredText(ctx, zoneStatus, 10, 45, width);
    }

    // Line 3: armed status (readable despite CSS mirror)
    const armedStatus = this.readinessArmed ? "ARMED" : "NOT ARMED";
    const armedColor = this.readinessArmed ? "#ef9f27" : "#6b7280";
    ctx.fillStyle = armedColor;
    this.drawUnmirroredText(ctx, `Readiness: ${armedStatus}`, 10, 65, width);

    // Line 4: NEXT ACTION — the single most important line on this
    // overlay (UX requirement: the clinician/patient must always know
    // the one next thing to do). Derived from the engine's own phase +
    // pause state, never a separately-tracked UI flag.
    if (this.engineState) {
      const engineSnapshot = getForwardReachRuntimeSnapshot(this.engineState);
      const action = nextForwardReachAction(engineSnapshot.phase, engineSnapshot.hasActivePause);
      const actionLabel = FORWARD_REACH_NEXT_ACTION_LABELS[action];
      ctx.fillStyle = action === "paused" ? "#ef4444" : "#a7f3d0";
      ctx.font = "bold 16px monospace";
      this.drawUnmirroredText(ctx, `NEXT: ${actionLabel}`, 10, 90, width);
    }

    // Overlay label (readable despite CSS mirror)
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px monospace";
    this.drawUnmirroredText(ctx, "Pose Debug Overlay — Engineering/therapist review only", 10, height - 10, width);
  }

  /**
   * Frame processing loop with epoch guard and monotonic MediaPipe timestamps.
   */
  private startFrameLoop(video: HTMLVideoElement): void {
    const epoch = this.currentEpoch;

    const detect = () => {
      // Guard: session still active
      if (this.sessionEpoch !== epoch) return;

      // Guard: resources ready
      if (!this.poseLandmarker || !this.engineState) return;

      // Guard: video ready
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        this.rafId = requestAnimationFrame(detect);
        return;
      }

      try {
        // Monotonic MediaPipe inference timestamp
        this.detectTimestamp = Math.max(this.detectTimestamp + 1, performance.now());

        // Single event timestamp for this acquisition cycle
        const capturedAtMs = performance.now();

        // MediaPipe inference
        const result = this.poseLandmarker.detectForVideo(video, this.detectTimestamp);
        const landmarks = result.landmarks?.[0];

        // Draw video + debug overlay to canvas
        if (this.canvasEl) {
          const ctx = this.canvasEl.getContext("2d");
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            // Only reset dimensions if they changed (optimization)
            const needsResize =
              this.canvasEl.width !== video.videoWidth || this.canvasEl.height !== video.videoHeight;
            if (needsResize) {
              this.canvasEl.width = video.videoWidth;
              this.canvasEl.height = video.videoHeight;
            }

            ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
            ctx.drawImage(video, 0, 0, this.canvasEl.width, this.canvasEl.height);

            // Draw pose debug overlay
            this.drawPoseDebugOverlay(ctx, this.canvasEl.width, this.canvasEl.height, landmarks);
          }
        }

        // Increment frame index
        this.frameIndex += 1;

        if (landmarks && landmarks.length > 0) {
          // Create acquisition context
          const context: InputAcquisitionContext = {
            frameIndex: this.frameIndex,
            capturedAtMs,
            deviceLabel: "front_camera",
          };

          // Normalize via existing BlazePose adapter
          const frame = BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context);

          // Update laterality diagnostics
          this.updateLateralityDiagnostics(landmarks);

          // Starting-position calibration feed — only while an explicit
          // calibration is in progress (calibrateStartingPosition).
          // Reuses the same already-normalized frame the engine itself
          // consumes below, via the same Lateral Reach camera-sample
          // adapter their own calibration flow uses.
          if (this.startCaptureState !== null && this.baseEngineConfig) {
            const captureSample = frame
              ? resolveLateralReachCalibrationSampleFromFrame(
                  frame,
                  this.baseEngineConfig.testedSide,
                  this.baseEngineConfig.tracking.minWristVisibility,
                )
              : { atMs: capturedAtMs, wrist: null, trackingValid: false };
            this.applyStartCaptureSample(captureSample);
          }

          // Feed engine
          if (frame) {
            // CASE A: Valid frame from adapter
            const engineResult = applyForwardReachCommand(this.engineState, {
              type: "frame",
              nowMs: capturedAtMs,
              frame,
            });

            if (engineResult.status === "applied") {
              this.engineState = engineResult.state;
            }
            this.attemptResult = deriveNextForwardReachAttemptResult(engineResult, this.attemptResult);
          } else {
            // CASE C: MediaPipe returned landmarks but adapter returned null
            const engineResult = applyForwardReachCommand(this.engineState, {
              type: "observationUnavailable",
              nowMs: capturedAtMs,
            });

            if (engineResult.status === "applied") {
              this.engineState = engineResult.state;
            }
            this.attemptResult = deriveNextForwardReachAttemptResult(engineResult, this.attemptResult);
          }
        } else {
          // CASE B: MediaPipe returned no pose landmarks
          if (this.startCaptureState !== null) {
            this.applyStartCaptureSample({ atMs: capturedAtMs, wrist: null, trackingValid: false });
          }

          const engineResult = applyForwardReachCommand(this.engineState, {
            type: "observationUnavailable",
            nowMs: capturedAtMs,
          });

          if (engineResult.status === "applied") {
            this.engineState = engineResult.state;
          }
          this.attemptResult = deriveNextForwardReachAttemptResult(engineResult, this.attemptResult);

          // Clear laterality diagnostics
          this.lastRightWristVisibility = null;
          this.lastLeftWristVisibility = null;
          this.lastRightWristCoords = null;
          this.lastLeftWristCoords = null;
        }

        // Automatic finalization: once the engine reports
        // completed_pending_finalization (return-to-start confirmed),
        // the attempt window is over. Dispatch attemptWindowEnded exactly
        // once so the terminal attemptResult is produced without a
        // manual "End attempt" control — see
        // shouldAutoDispatchForwardReachAttemptWindowEnd's doc comment.
        if (
          this.engineState &&
          shouldAutoDispatchForwardReachAttemptWindowEnd(this.engineState.phase, this.attemptWindowEndDispatched)
        ) {
          this.attemptWindowEndDispatched = true;
          this.dispatchAttemptWindowEnded();
        }

        // Check armed readiness
        this.checkArmedReadiness(capturedAtMs);

        // Emit snapshot
        this.emit();
      } catch (err) {
        console.error("[ForwardReachCameraDetector] Frame processing error:", err);
      }

      // Schedule next frame
      this.rafId = requestAnimationFrame(detect);
    };

    this.rafId = requestAnimationFrame(detect);
  }

  /**
   * Update laterality diagnostics from raw landmarks.
   */
  private updateLateralityDiagnostics(landmarks: readonly PoseLandmark[]): void {
    // Right wrist: index 16
    const rightWrist = landmarks[16];
    if (rightWrist) {
      this.lastRightWristVisibility = rightWrist.visibility ?? null;
      if (
        typeof rightWrist.x === "number" &&
        typeof rightWrist.y === "number" &&
        Number.isFinite(rightWrist.x) &&
        Number.isFinite(rightWrist.y)
      ) {
        this.lastRightWristCoords = { x: rightWrist.x, y: rightWrist.y };
      } else {
        this.lastRightWristCoords = null;
      }
    } else {
      this.lastRightWristVisibility = null;
      this.lastRightWristCoords = null;
    }

    // Left wrist: index 15
    const leftWrist = landmarks[15];
    if (leftWrist) {
      this.lastLeftWristVisibility = leftWrist.visibility ?? null;
      if (
        typeof leftWrist.x === "number" &&
        typeof leftWrist.y === "number" &&
        Number.isFinite(leftWrist.x) &&
        Number.isFinite(leftWrist.y)
      ) {
        this.lastLeftWristCoords = { x: leftWrist.x, y: leftWrist.y };
      } else {
        this.lastLeftWristCoords = null;
      }
    } else {
      this.lastLeftWristVisibility = null;
      this.lastLeftWristCoords = null;
    }
  }

  /**
   * Stop session — idempotent cleanup safe for repeated calls.
   */
  stop(): void {
    // Invalidate current session
    this.sessionEpoch += 1;

    // Cancel RAF
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    // Disarm readiness
    this.disarmReadiness();

    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Detach video
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }

    // Clear canvas
    this.canvasEl = null;

    // Close MediaPipe
    if (this.poseLandmarker) {
      this.poseLandmarker.close?.();
      this.poseLandmarker = null;
    }

    // Reset state
    this.detectTimestamp = 0;
    this.frameIndex = 0;
    this.engineState = null;
    this.attemptResult = null;
    this.attemptWindowEndDispatched = false;
    this.baseEngineConfig = null;
    this.startCaptureState = null;
    this.startingZoneCalibration = { status: "not_started", capturedPoint: null, failureReasons: null };
    this.status = "idle";
    this.initPhase = null;

    // Emit final snapshot
    this.emit();
  }

  /**
   * Check armed readiness conditions and send readinessConfirmed if stable in zone.
   */
  private checkArmedReadiness(nowMs: number): void {
    if (!this.readinessArmed || !this.engineState || !this.engineConfig) {
      return;
    }

    // Check timeout
    if (this.readinessArmedUntilMs && nowMs >= this.readinessArmedUntilMs) {
      this.disarmReadiness();
      return;
    }

    // Don't send if already sent
    if (this.readinessAlreadySent) {
      return;
    }

    // Check engine phase
    const phase = this.engineState.phase;
    if (phase !== "idle" && phase !== "awaiting_readiness") {
      this.disarmReadiness();
      return;
    }

    // Check wrist conditions
    const testedSide = this.engineConfig.testedSide;

    // Get tested wrist from laterality diagnostics
    const testedWristVisibility = testedSide === "right"
      ? this.lastRightWristVisibility
      : this.lastLeftWristVisibility;
    const testedWristCoords = testedSide === "right"
      ? this.lastRightWristCoords
      : this.lastLeftWristCoords;

    // Check if wrist is tracked sufficiently
    const minVisibility = this.engineConfig.tracking.minWristVisibility;
    if (!testedWristVisibility || testedWristVisibility < minVisibility) {
      // Not tracked sufficiently - reset stability
      this.readinessStableSinceMs = null;
      return;
    }

    // Check if wrist coords available
    if (!testedWristCoords) {
      this.readinessStableSinceMs = null;
      return;
    }

    // Check if wrist is in starting zone
    const startingZone = this.engineConfig.startingZone;
    const dx = testedWristCoords.x - startingZone.point.x;
    const dy = testedWristCoords.y - startingZone.point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const inZone = distance <= startingZone.radius;

    if (!inZone) {
      // Not in zone - reset stability
      this.readinessStableSinceMs = null;
      return;
    }

    // Wrist is tracked and in zone
    if (this.readinessStableSinceMs === null) {
      // Start stability timer
      this.readinessStableSinceMs = nowMs;
      return;
    }

    // Check if stability duration met (750ms)
    const stabilityDuration = nowMs - this.readinessStableSinceMs;
    if (stabilityDuration >= 750) {
      // Send readinessConfirmed command
      const result = applyForwardReachCommand(this.engineState, {
        type: "readinessConfirmed",
        nowMs,
        confirmedBy: "clinician",
      });

      // Store command outcome
      this.lastCommandType = "readinessConfirmed";
      this.lastCommandStatus = result.status;
      this.lastCommandRejectionReason = result.status === "rejected" ? result.reason : null;

      if (result.status === "applied") {
        this.engineState = result.state;
      }
      this.attemptResult = deriveNextForwardReachAttemptResult(result, this.attemptResult);

      // Mark as sent and disarm
      this.readinessAlreadySent = true;
      this.disarmReadiness();
    }
  }

  /**
   * Explicitly begin capturing the tested wrist's real, current resting
   * position as this session's frozen Starting Zone. Replaces whatever
   * placeholder point the config passed to start() shipped with. One-shot
   * per session — see shouldStartForwardReachCalibration's doc comment
   * for why this becomes a no-op once already "captured".
   */
  calibrateStartingPosition(): void {
    if (!this.engineState || !this.baseEngineConfig) {
      return;
    }
    if (
      !shouldStartForwardReachCalibration(
        this.status,
        this.engineState.phase,
        this.startingZoneCalibration.status,
      )
    ) {
      return;
    }

    this.startCaptureState = createLateralReachStartCaptureState(
      performance.now(),
      FORWARD_REACH_START_CAPTURE_CONFIG,
    );
    this.startingZoneCalibration = { status: "capturing", capturedPoint: null, failureReasons: null };
    this.emit();
  }

  /**
   * Feeds one sample into the in-progress start-capture reducer and
   * applies whatever outcome it produces. On "captured", rebuilds
   * engineConfig/engineState from baseEngineConfig with startingZone.point
   * replaced by the captured point — safe to discard the prior
   * placeholder-based engineState here because armReadiness() (and
   * confirmReadiness()) refuse to run before calibration is "captured",
   * so nothing meaningful can have accumulated on it yet (idle /
   * awaiting_readiness only track lastValidWristSample, which this
   * intentionally drops along with the rest of the placeholder state).
   */
  private applyStartCaptureSample(sample: LateralReachStartCaptureSample): void {
    if (this.startCaptureState === null || !this.baseEngineConfig) {
      return;
    }

    const update = updateLateralReachStartCapture(this.startCaptureState, sample);

    if (update.status === "collecting") {
      this.startCaptureState = update.state;
      return;
    }

    if (update.status === "failed") {
      this.startCaptureState = null;
      this.startingZoneCalibration = {
        status: "failed",
        capturedPoint: null,
        failureReasons: update.failureReasons,
      };
      return;
    }

    // status === "captured"
    this.startCaptureState = null;
    const candidate = applyCapturedForwardReachStartingZonePoint(this.baseEngineConfig, update.startWrist);
    const validated = validateForwardReachConfig(candidate);
    if (!validated.ok) {
      this.startingZoneCalibration = { status: "failed", capturedPoint: null, failureReasons: ["geometry_invalid"] };
      return;
    }

    const initResult = createForwardReachAttemptState(validated.config, 0, performance.now());
    if (!initResult.ok) {
      this.startingZoneCalibration = { status: "failed", capturedPoint: null, failureReasons: ["geometry_invalid"] };
      return;
    }

    this.engineConfig = validated.config;
    this.engineState = initResult.state;
    this.startingZoneCalibration = {
      status: "captured",
      capturedPoint: { x: update.startWrist.x, y: update.startWrist.y },
      failureReasons: null,
    };
  }

  /**
   * Arm readiness — opens a 15-second window for automatic readiness confirmation
   * when wrist is stable in starting zone.
   */
  armReadiness(): void {
    if (!this.engineState) {
      return;
    }
    if (
      !shouldArmForwardReachReadiness(
        this.status,
        this.engineState.phase,
        this.readinessArmed,
        this.startingZoneCalibration.status,
      )
    ) {
      return;
    }

    // Arm for 15 seconds
    this.readinessArmed = true;
    this.readinessArmedUntilMs = performance.now() + 15000;
    this.readinessStableSinceMs = null;
    this.readinessAlreadySent = false;

    this.emit();
  }

  /**
   * Disarm readiness — cancels armed readiness window.
   */
  disarmReadiness(): void {
    this.readinessArmed = false;
    this.readinessArmedUntilMs = null;
    this.readinessStableSinceMs = null;
    this.readinessAlreadySent = false;

    this.emit();
  }

  /**
   * Confirm readiness — explicit human action to advance from awaiting_readiness.
   */
  confirmReadiness(confirmedBy: string): void {
    if (!this.engineState || this.status !== "running") {
      return;
    }
    // Same calibration gate as armReadiness() — see
    // shouldArmForwardReachReadiness's doc comment. Not currently wired
    // to any UI, but kept consistent so this method can never bypass it.
    if (this.startingZoneCalibration.status !== "captured") {
      return;
    }

    const result = applyForwardReachCommand(this.engineState, {
      type: "readinessConfirmed",
      nowMs: performance.now(),
      confirmedBy,
    });

    // Store command outcome for UI feedback
    this.lastCommandType = "readinessConfirmed";
    this.lastCommandStatus = result.status;
    this.lastCommandRejectionReason = result.status === "rejected" ? result.reason : null;

    if (result.status === "applied") {
      this.engineState = result.state;
    }
    this.attemptResult = deriveNextForwardReachAttemptResult(result, this.attemptResult);

    // Always emit - UI needs feedback for both success and rejection
    this.emit();
  }

  /**
   * Resume after protective pause — explicit human action required.
   */
  resumeAfterPause(resumedBy: string): void {
    if (!this.engineState || this.status !== "running") {
      return;
    }

    // Engine requires readinessConfirmedAt for resume command
    // Use ISO timestamp for evidentiary attribution
    const readinessConfirmedAt = new Date().toISOString();

    const result = applyForwardReachCommand(this.engineState, {
      type: "resumeRequested",
      nowMs: performance.now(),
      readinessConfirmedAt,
      resumedBy,
    });

    // Store command outcome for UI feedback
    this.lastCommandType = "resumeRequested";
    this.lastCommandStatus = result.status;
    this.lastCommandRejectionReason = result.status === "rejected" ? result.reason : null;

    if (result.status === "applied") {
      this.engineState = result.state;
    }
    this.attemptResult = deriveNextForwardReachAttemptResult(result, this.attemptResult);

    // Always emit - UI needs feedback for both success and rejection
    this.emit();
  }

  /**
   * Record an explicit clinician-initiated clinical stop — sends the
   * engine's existing clinicalStopReceived command unchanged. No new
   * clinical-stop policy or automatic safety decision is made here: the
   * event (reason/recordedAt/recordedBy) is supplied by the caller in
   * full: the engine alone decides how this finalizes the attempt.
   */
  recordClinicalStop(event: ClinicalStopEvent): void {
    if (!this.engineState || this.status !== "running") {
      return;
    }

    const result = applyForwardReachCommand(this.engineState, {
      type: "clinicalStopReceived",
      nowMs: performance.now(),
      event,
    });

    // Store command outcome for UI feedback
    this.lastCommandType = "clinicalStopReceived";
    this.lastCommandStatus = result.status;
    this.lastCommandRejectionReason = result.status === "rejected" ? result.reason : null;

    if (result.status === "applied") {
      this.engineState = result.state;
    }
    this.attemptResult = deriveNextForwardReachAttemptResult(result, this.attemptResult);

    // Always emit - UI needs feedback for both success and rejection
    this.emit();
  }

  /**
   * Core attemptWindowEnded dispatch — no emit. Shared by the automatic
   * per-frame trigger (startFrameLoop) and endAttemptWindow() so both
   * paths update engineState/attemptResult identically; the caller
   * decides when to emit.
   */
  private dispatchAttemptWindowEnded(): void {
    if (!this.engineState) return;

    const result = applyForwardReachCommand(this.engineState, {
      type: "attemptWindowEnded",
      nowMs: performance.now(),
    });

    this.lastCommandType = "attemptWindowEnded";
    this.lastCommandStatus = result.status;
    this.lastCommandRejectionReason = result.status === "rejected" ? result.reason : null;

    if (result.status === "applied") {
      this.engineState = result.state;
    }
    this.attemptResult = deriveNextForwardReachAttemptResult(result, this.attemptResult);
  }

  /**
   * End the attempt window — explicit terminal action. Sends
   * attemptWindowEnded through the engine and latches the resulting
   * terminal attemptResult via getSnapshot().attemptResult. Mirrors
   * LateralReachCameraDetector.endAttemptWindow()'s contract.
   *
   * In this one-attempt Forward Reach vertical slice this is invoked
   * automatically from startFrameLoop once the engine reports
   * completed_pending_finalization (see shouldAutoDispatchForwardReachAttemptWindowEnd)
   * rather than from a manual UI control — kept as its own method,
   * guarded the same way, so the dispatch is a single reusable,
   * independently callable action rather than inline-only logic.
   */
  endAttemptWindow(): void {
    if (!this.engineState || this.status !== "running" || this.attemptWindowEndDispatched) {
      return;
    }
    this.attemptWindowEndDispatched = true;
    this.dispatchAttemptWindowEnded();
    this.emit();
  }
}
