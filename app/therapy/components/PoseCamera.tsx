"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateAngle, type StepMetrics } from "../lib/gait/biomechanics";
import {
  DEFAULT_SESSION_CONFIG,
  type ExerciseSessionConfig,
} from "../lib/gait/exercise-session-config";

/* ── MediaPipe CDN endpoints ──────────────────────────────────────────────── */

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/* ── Landmark indices (MediaPipe 33-point model) ─────────────────────────── */

const LM = {
  leftShoulder:  11, rightShoulder: 12,
  leftElbow:     13, rightElbow:    14,
  leftWrist:     15, rightWrist:    16,
  leftHip:       23, rightHip:      24,
  leftKnee:      25, rightKnee:     26,
  leftAnkle:     27, rightAnkle:    28,
} as const;

const LOWER_BODY = new Set([23, 24, 25, 26, 27, 28]);

/** Skeleton connections to draw */
const CONNECTIONS: [number, number][] = [
  // Upper body
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24],
  // Lower body (highlighted)
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

/* ── Detection constants ──────────────────────────────────────────────────── */

/**
 * Per-exercise detection parameters (raiseThreshold, hipOffset, stepCooldownMs)
 * are now supplied via ExerciseSessionConfig and stored in configRef.
 * DEFAULT_SESSION_CONFIG preserves the original behaviour (threshold=0.02).
 *
 * TARGET_FPS is camera-level and stays constant regardless of exercise.
 *
 * PEAK_FRAMES: after the rising-edge threshold fires, continue tracking the
 * same leg for this many additional frames and report the maximum raise value
 * (and the joint angles at that maximum) rather than the values at the
 * threshold crossing.  At 30 fps, 12 frames ≈ 400 ms — enough to capture
 * the true apex of a typical marching knee lift.
 */
const TARGET_FPS  = 30;
const PEAK_FRAMES = 12; // ~400 ms at 30 fps

/**
 * Reference body span used as the denominator for threshold normalisation.
 * Represents a well-framed patient from shoulder to ankle (≈55% of frame height).
 * When the actual body span differs, both the effective raise threshold and the
 * effective hip offset are scaled accordingly, so that the entire raise formula
 * is consistent across different camera distances.
 */
const TYPICAL_BODY_SPAN = 0.55;

/**
 * Minimum MediaPipe visibility score required on the raised-side hip AND knee
 * before a step rising-edge can be registered.
 *
 * This gates the OPENING of a peak-detection window — it does not suppress the
 * VU meter or ongoing peak windows that are already active.
 *
 * 0.5 = "moderately confident" in MediaPipe's visibility model.  Frames below
 * this level (partial occlusion, motion blur, or poor lighting) produce
 * unreliable knee-height estimates and should not trigger step counts.
 */
const MIN_DETECTION_VISIBILITY = 0.5;

/* ── Public types ─────────────────────────────────────────────────────────── */

export type PoseStatus =
  | "initializing"
  | "loading_model"
  | "ready"
  | "no_pose"
  | "error";

export type { StepMetrics };

export interface PoseCameraProps {
  /** Start the webcam and detection engine */
  running: boolean;
  /** Actually emit step events (false = preview only) */
  detecting: boolean;
  /**
   * Called on each confirmed knee-lift rising edge.
   * `metrics` contains joint angles and raise height at the moment of detection.
   */
  onStepDetected: (side: "left" | "right", metrics: StepMetrics) => void;
  onPoseReady?: (ready: boolean) => void;
  onStatusChange?: (status: PoseStatus) => void;
  /** Called every detection frame with raw raise levels (0–1) for live visualisation */
  onKneeRaise?: (left: number, right: number) => void;
  /**
   * Called every detection frame (when a pose is present) with the mean
   * visibility of the 6 lower-body landmarks (0–1). Used by the session page
   * to accumulate a session-level landmark quality score.
   */
  onFrameQuality?: (quality: number) => void;
  /**
   * Called every detection frame with the current smoothed body span
   * (max of left and right stance-side shoulder-to-ankle distances, 0–1).
   * Used by the ready screen to assess camera framing in real time.
   * 0 = no data yet; ~0.55 = ideal framing.
   */
  onBodySpan?: (span: number) => void;
  /**
   * Per-exercise detection config. Controls the raise threshold, hip offset,
   * step cooldown, and visual style of the target line.
   * Defaults to DEFAULT_SESSION_CONFIG (original behaviour) when not supplied.
   */
  exerciseConfig?: ExerciseSessionConfig;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function PoseCamera({
  running,
  detecting,
  onStepDetected,
  onPoseReady,
  onStatusChange,
  onKneeRaise,
  onFrameQuality,
  onBodySpan,
  exerciseConfig,
}: PoseCameraProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef        = useRef<number>(0);
  const streamRef     = useRef<MediaStream | null>(null);
  const prevRaise     = useRef({ left: 0, right: 0 });
  const cooldown      = useRef({ left: 0, right: 0 });
  const detectingRef  = useRef(detecting);
  const hasPoseRef    = useRef(false);
  const lastTickRef   = useRef(0);

  // Keep detectingRef and configRef in sync on every render — same pattern,
  // allows processStep to always read current values without stale closures.
  detectingRef.current = detecting;
  const configRef = useRef<ExerciseSessionConfig>(exerciseConfig ?? DEFAULT_SESSION_CONFIG);
  configRef.current = exerciseConfig ?? DEFAULT_SESSION_CONFIG;

  /**
   * Peak-detection windows — one per side.
   * Populated on the rising-edge threshold crossing, resolved after PEAK_FRAMES.
   */
  const peakWindows = useRef<{
    left:  { frameCount: number; peakRaise: number; peakKneeAngle: number; hipAngle: number; hipTilt: number; bodySpan: number } | null;
    right: { frameCount: number; peakRaise: number; peakKneeAngle: number; hipAngle: number; hipTilt: number; bodySpan: number } | null;
  }>({ left: null, right: null });

  /**
   * Shared smoothed body span (shoulder-to-ankle, normalised 0–1).
   * Pooled from whichever stance side provides a valid reading on each frame:
   * right-side span when left knee is raised, left-side span when right is raised.
   * Both sides read the SAME value so their detection thresholds are always equal,
   * eliminating asymmetric sensitivity caused by differing per-side EMA convergence.
   */
  const bodySpanRef = useRef({ shared: 0 });

  /** Stable ref to onFrameQuality — avoids re-creating the RAF loop on prop change. */
  const onFrameQualityRef = useRef(onFrameQuality);
  onFrameQualityRef.current = onFrameQuality;
  /** Stable ref to onBodySpan — same pattern. */
  const onBodySpanRef = useRef(onBodySpan);
  onBodySpanRef.current = onBodySpan;

  const [status,    setStatusRaw] = useState<PoseStatus>("initializing");
  const [hasPose,   setHasPose]   = useState(false);
  const [kneeRaise, setKneeRaise] = useState({ left: 0, right: 0 });
  const [errorMsg,  setErrorMsg]  = useState("");

  const setStatus = useCallback(
    (s: PoseStatus) => {
      setStatusRaw(s);
      onStatusChange?.(s);
    },
    [onStatusChange],
  );

  /* ── Cleanup ── */
  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  /* ── Init / teardown on `running` change ── */
  useEffect(() => {
    if (!running) {
      stopAll();
      hasPoseRef.current  = false;
      prevRaise.current   = { left: 0, right: 0 };
      peakWindows.current = { left: null, right: null };
      bodySpanRef.current = { shared: 0 };
      setStatus("initializing");
      setHasPose(false);
      setKneeRaise({ left: 0, right: 0 });
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        /* 1 ── Webcam ── */
        setStatus("initializing");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        /* 2 ── MediaPipe Pose Landmarker ── */
        setStatus("loading_model");

        const { PoseLandmarker, FilesetResolver } =
          await import("@mediapipe/tasks-vision");

        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence:  0.5,
          minTrackingConfidence:      0.5,
        });

        if (cancelled) { landmarker.close(); return; }

        landmarkerRef.current = landmarker;
        setStatus("ready");

        /* 3 ── Detection RAF loop ── */
        const intervalMs = 1000 / TARGET_FPS;

        const loop = () => {
          if (cancelled) return;

          const now = performance.now();

          if (now - lastTickRef.current >= intervalMs) {
            lastTickRef.current = now;

            const video  = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState >= 2 && !video.paused) {
              try {
                const result = landmarkerRef.current.detectForVideo(video, now);
                drawSkeleton(canvas, video, result);

                if (!result.landmarks?.length) {
                  if (hasPoseRef.current) {
                    hasPoseRef.current = false;
                    setHasPose(false);
                    setStatus("no_pose");
                    onPoseReady?.(false);
                    setKneeRaise({ left: 0, right: 0 });
                    prevRaise.current = { left: 0, right: 0 };
                  }
                } else {
                  if (!hasPoseRef.current) {
                    hasPoseRef.current = true;
                    setHasPose(true);
                    setStatus("ready");
                    onPoseReady?.(true);
                  }
                  processStep(result.landmarks[0]);

                  // Landmark quality: mean visibility of the 6 lower-body
                  // landmarks.  Fired on every detected frame so the session
                  // page can accumulate a session-level quality score.
                  if (onFrameQualityRef.current) {
                    const lms = result.landmarks[0];
                    const lmVis = (
                      (lms[LM.leftHip]?.visibility   ?? 0) +
                      (lms[LM.rightHip]?.visibility  ?? 0) +
                      (lms[LM.leftKnee]?.visibility  ?? 0) +
                      (lms[LM.rightKnee]?.visibility ?? 0) +
                      (lms[LM.leftAnkle]?.visibility ?? 0) +
                      (lms[LM.rightAnkle]?.visibility ?? 0)
                    ) / 6;
                    onFrameQualityRef.current(lmVis);
                  }
                  if (onBodySpanRef.current) {
                    onBodySpanRef.current(bodySpanRef.current.shared);
                  }
                }
              } catch {
                // skip frame errors silently
              }
            }
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error");
        const e = err as { name?: string; message?: string };
        setErrorMsg(
          e.name === "NotAllowedError" ? "Camera permission denied. Please allow access in your browser." :
          e.name === "NotFoundError"   ? "No camera found on this device."                                :
                                         `Camera unavailable: ${e.message ?? "unknown error"}`,
        );
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* ── Knee-raise detector with peak-detection window ── */
  const processStep = useCallback(
    (landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>) => {
      const { hipOffset, raiseThreshold, stepCooldownMs } = configRef.current;
      const raises = { left: 0, right: 0 };

      // Bilateral pelvic tilt is the same regardless of which side is processed
      const lhLM = landmarks[LM.leftHip];
      const rhLM = landmarks[LM.rightHip];
      const hipTilt =
        lhLM && rhLM && (lhLM.visibility ?? 0) > 0.1 && (rhLM.visibility ?? 0) > 0.1
          ? Math.abs(lhLM.y - rhLM.y) * 1000
          : 0;

      for (const side of ["left", "right"] as const) {
        const hipIdx  = side === "left" ? LM.leftHip  : LM.rightHip;
        const kneeIdx = side === "left" ? LM.leftKnee : LM.rightKnee;

        const hip  = landmarks[hipIdx];
        const knee = landmarks[kneeIdx];
        if (!hip || !knee) continue;
        // Accept landmarks with as little as 10 % confidence — the right knee
        // is partially occluded during a left-leg raise (single-leg stance),
        // so keeping this floor very low prevents the right side from going dark.
        if ((hip.visibility  ?? 0) < 0.1) continue;
        if ((knee.visibility ?? 0) < 0.1) continue;

        // ── Body-span normalisation (stance-side, shared EMA) ──────────────
        //
        // During a left knee raise, the RIGHT leg is the stance leg (planted).
        // Using the stance-side shoulder → ankle gives a stable body-height
        // reference that does not fluctuate as the raised knee lifts.
        //
        // Both sides pool into a SINGLE shared EMA so left and right detection
        // thresholds are always identical — eliminating asymmetric sensitivity
        // caused by differing per-side EMA convergence rates.
        const stanceSide        = side === "left" ? "right" : "left";
        const stanceShoulderIdx = stanceSide === "left" ? LM.leftShoulder : LM.rightShoulder;
        const stanceAnkleIdx    = stanceSide === "left" ? LM.leftAnkle    : LM.rightAnkle;
        const stanceShoulderLM  = landmarks[stanceShoulderIdx];
        const stanceAnkleLM     = landmarks[stanceAnkleIdx];

        const rawBodySpan =
          stanceShoulderLM && stanceAnkleLM &&
          (stanceShoulderLM.visibility ?? 0) > 0.3 &&
          (stanceAnkleLM.visibility   ?? 0) > 0.3
            ? Math.max(0, stanceAnkleLM.y - stanceShoulderLM.y)
            : 0;

        // Shared EMA (α = 0.15): initialise directly on first valid reading.
        if (rawBodySpan > 0.1) {
          bodySpanRef.current.shared = bodySpanRef.current.shared > 0.1
            ? bodySpanRef.current.shared * 0.85 + rawBodySpan * 0.15
            : rawBodySpan;
        }

        // Both sides read the same smoothed span — equal thresholds, equal sensitivity.
        const smoothedSpan = bodySpanRef.current.shared;

        // Effective raise threshold: nominal / TYPICAL × smoothed span
        const effectiveThreshold = smoothedSpan > 0.1
          ? (raiseThreshold / TYPICAL_BODY_SPAN) * smoothedSpan
          : raiseThreshold;

        // Effective hip offset: same normalisation as effectiveThreshold.
        // hipOffset shifts the detection baseline below the hip; without this
        // normalisation the baseline is proportionally too large for distant
        // patients (small body span), creating camera-distance detection bias.
        const effectiveHipOffset = smoothedSpan > 0.1
          ? (hipOffset / TYPICAL_BODY_SPAN) * smoothedSpan
          : hipOffset;

        /*
         * Raise formula:  (hip.y + effectiveHipOffset) - knee.y
         *
         * In normalised coords y increases downward.
         * effectiveHipOffset shifts the detection zero-point below the hip
         * proportionally to the patient's visible body size, so that the
         * formula remains consistent regardless of camera distance.
         */
        const raise = Math.max(0, (hip.y + effectiveHipOffset) - knee.y);
        raises[side] = raise;

        const prev = prevRaise.current[side];
        prevRaise.current[side] = raise;

        // ── Compute joint angles when needed (peak window active or rising edge) ──
        // Always use the RAISED side's ankle for the knee-angle calculation —
        // the hip→knee→ankle angle still refers to the moving leg.
        const raisedAnkleIdx    = side === "left" ? LM.leftAnkle    : LM.rightAnkle;
        const raisedShoulderIdx = side === "left" ? LM.leftShoulder : LM.rightShoulder;

        const needAngles = peakWindows.current[side] !== null ||
                           (raise > effectiveThreshold && prev <= effectiveThreshold);

        let kneeAngle = 0, hipAngle = 0;
        if (needAngles) {
          const raisedAnkle   = landmarks[raisedAnkleIdx];
          const raisedShoulder = landmarks[raisedShoulderIdx];

          kneeAngle =
            raisedAnkle && (raisedAnkle.visibility ?? 0) > 0.1
              ? calculateAngle(hip, knee, raisedAnkle)
              : 0;
          hipAngle =
            raisedShoulder && (raisedShoulder.visibility ?? 0) > 0.1
              ? calculateAngle(raisedShoulder, hip, knee)
              : 0;
        }

        // ── Advance active peak window ──
        const pk = peakWindows.current[side];
        if (pk) {
          if (raise > pk.peakRaise) {
            pk.peakRaise = raise;
            if (kneeAngle > 0) pk.peakKneeAngle = kneeAngle;
          }
          pk.frameCount++;

          if (pk.frameCount >= PEAK_FRAMES) {
            // Window complete — emit step with peak biomechanics
            if (detectingRef.current) {
              const metrics: StepMetrics = {
                kneeAngle:       pk.peakKneeAngle,
                hipAngle:        pk.hipAngle,
                kneeRaiseHeight: pk.peakRaise,
                hipTilt:         pk.hipTilt,
                bodySpan:        pk.bodySpan,
              };
              onStepDetected(side, metrics);
            }
            peakWindows.current[side] = null;
          }
        }

        // ── Rising edge: start a new peak window ──
        //
        // Quality gate: require both raised-side hip and knee to have MediaPipe
        // visibility ≥ MIN_DETECTION_VISIBILITY before opening a peak window.
        // Frames below this level (occlusion, blur, poor lighting) produce
        // unreliable knee-height estimates; they are shown in the VU meter
        // but do not trigger step counts.
        const detectionQualityOK =
          (hip.visibility  ?? 0) >= MIN_DETECTION_VISIBILITY &&
          (knee.visibility ?? 0) >= MIN_DETECTION_VISIBILITY;

        if (raise > effectiveThreshold && prev <= effectiveThreshold && detectionQualityOK) {
          const now = Date.now();
          if (now - cooldown.current[side] > stepCooldownMs) {
            cooldown.current[side] = now;
            if (detectingRef.current) {
              peakWindows.current[side] = {
                frameCount:    0,
                peakRaise:     raise,
                peakKneeAngle: kneeAngle,
                hipAngle,
                hipTilt,
                // Store the smoothed span — this is what the threshold was based on
                bodySpan:      smoothedSpan,
              };
            }
          }
        }
      }

      // Update VU meter state (batched for both sides)
      setKneeRaise((k) =>
        Math.abs(k.left - raises.left) < 0.005 && Math.abs(k.right - raises.right) < 0.005
          ? k
          : { left: raises.left, right: raises.right },
      );

      // Emit live levels to parent for external visualisation
      onKneeRaise?.(raises.left, raises.right);
    },
    [onStepDetected, onKneeRaise],
  );

  /* ── Render ── */
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#060d1a]/95 shadow-2xl shadow-black/50 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-700">
            CV Camera
          </span>
          {configRef.current.exerciseId !== "default" && (
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-1.5 py-0.5 text-[8px] font-medium text-cyan-600">
              {configRef.current.exerciseName}
            </span>
          )}
        </div>
        <StatusBadge status={status} hasPose={hasPose} />
      </div>

      {/* Video feed + skeleton overlay */}
      <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Loading overlay */}
        {(status === "initializing" || status === "loading_model") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#060d1a]/92">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-[10px] text-slate-500">
              {status === "initializing" ? "Starting camera…" : "Loading pose model…"}
            </p>
          </div>
        )}

        {/* No pose hint */}
        {status === "no_pose" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-5">
            <p className="text-center text-[10px] text-yellow-300">
              Step back — show your full body
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#060d1a]/95 p-4">
            <span className="text-xl">⚠️</span>
            <p className="text-center text-[10px] leading-relaxed text-rose-400">
              {errorMsg}
            </p>
          </div>
        )}

        {/* Live detection overlay */}
        {hasPose && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-green-400/25 bg-green-400/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-[9px] font-medium text-green-300">Pose Detected</span>
          </div>
        )}

        {/* Exercise coaching hint — shown at bottom when detecting */}
        {hasPose && detecting && configRef.current.exerciseId !== "default" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-5">
            <p className="text-center text-[10px] font-medium text-cyan-300">
              {configRef.current.cameraHint}
            </p>
          </div>
        )}
      </div>

      {/* Knee raise VU meters */}
      <div className="flex items-end gap-2 px-3 py-2">
        <KneeMeter
          side="L"
          raise={kneeRaise.left}
          threshold={
            bodySpanRef.current.shared > 0.1
              ? (configRef.current.raiseThreshold / TYPICAL_BODY_SPAN) * bodySpanRef.current.shared
              : configRef.current.raiseThreshold
          }
          targetLineColor={configRef.current.targetLineColor}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
          <p className="text-[9px] uppercase tracking-widest text-slate-700">Knee Lift</p>
          <p className="text-[9px] text-slate-800">
            {configRef.current.targetLineLabel}
          </p>
          {/* Camera distance quality indicator */}
          <CameraDistanceDot bodySpan={bodySpanRef.current.shared} />
        </div>
        <KneeMeter
          side="R"
          raise={kneeRaise.right}
          threshold={
            bodySpanRef.current.shared > 0.1
              ? (configRef.current.raiseThreshold / TYPICAL_BODY_SPAN) * bodySpanRef.current.shared
              : configRef.current.raiseThreshold
          }
          targetLineColor={configRef.current.targetLineColor}
        />
      </div>
    </div>
  );
}

/* ── Canvas skeleton drawing ──────────────────────────────────────────────── */

function drawSkeleton(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = video.videoWidth  || video.clientWidth  || 640;
  const H = video.videoHeight || video.clientHeight || 480;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  if (!result.landmarks?.length) return;

  const lms = result.landmarks[0];

  // Connections
  for (const [a, b] of CONNECTIONS) {
    if (!lms[a] || !lms[b]) continue;
    if ((lms[a].visibility ?? 0) < 0.35 || (lms[b].visibility ?? 0) < 0.35) continue;

    const isLower = LOWER_BODY.has(a) && LOWER_BODY.has(b);
    ctx.strokeStyle = isLower ? "rgba(34,211,238,0.65)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth   = isLower ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(lms[a].x * W, lms[a].y * H);
    ctx.lineTo(lms[b].x * W, lms[b].y * H);
    ctx.stroke();
  }

  // Keypoints
  for (let i = 0; i < lms.length; i++) {
    const lm = lms[i];
    if (!lm || (lm.visibility ?? 0) < 0.35) continue;
    const isKey = LOWER_BODY.has(i);
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, isKey ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isKey ? "#22d3ee" : "rgba(255,255,255,0.55)";
    ctx.fill();

    // Glow on key joints
    if (isKey) {
      ctx.beginPath();
      ctx.arc(lm.x * W, lm.y * H, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,211,238,0.12)";
      ctx.fill();
    }
  }
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function StatusBadge({ status, hasPose }: { status: PoseStatus; hasPose: boolean }) {
  type BadgeCfg = { label: string; dot: string; pulse: boolean };

  const cfg: BadgeCfg = (() => {
    if (status === "initializing")  return { label: "Starting Camera",    dot: "bg-slate-500",  pulse: true  };
    if (status === "loading_model") return { label: "Loading Model",      dot: "bg-blue-400",   pulse: true  };
    if (status === "no_pose")       return { label: "No Person Detected", dot: "bg-yellow-400", pulse: true  };
    if (status === "error")         return { label: "Camera Error",       dot: "bg-rose-500",   pulse: false };
    // status === "ready" — distinguish camera-ready-no-person vs person-visible
    return hasPose
      ? { label: "Pose Detected", dot: "bg-green-400", pulse: false }
      : { label: "Camera Ready",  dot: "bg-cyan-400",  pulse: false };
  })();

  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
      <span className="text-[9px] text-slate-600">{cfg.label}</span>
    </div>
  );
}

/**
 * A single-pixel dot that communicates camera framing quality.
 * Green  → body span 0.35–0.75 (patient well-framed)
 * Yellow → body span < 0.35 (too close) or > 0.75 (too far / partial)
 * Grey   → body span unavailable (landmarks not detected)
 */
function CameraDistanceDot({ bodySpan }: { bodySpan: number }) {
  if (bodySpan <= 0) return null;
  const ok = bodySpan >= 0.35 && bodySpan <= 0.75;
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      <span className={`h-1 w-1 rounded-full ${ok ? "bg-green-400" : "bg-yellow-400"}`} />
      <span className={`text-[8px] ${ok ? "text-green-700" : "text-yellow-700"}`}>
        {ok ? "framed" : bodySpan < 0.35 ? "too close" : "too far"}
      </span>
    </div>
  );
}

function KneeMeter({
  side,
  raise,
  threshold,
  targetLineColor = "bg-white/30",
}: {
  side: "L" | "R";
  raise: number;
  threshold: number;
  targetLineColor?: string;
}) {
  const MAX    = 0.25;
  const pct    = Math.min((raise / MAX) * 100, 100);
  const thPct  = Math.min((threshold / MAX) * 100, 100);
  const active = raise > threshold;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-10 w-3.5 overflow-hidden rounded-full bg-white/5">
        {/* Threshold line — colour reflects the exercise's target quality */}
        <div
          className={`absolute inset-x-0 h-px ${targetLineColor}`}
          style={{ bottom: `${thPct}%` }}
        />
        {/* Fill bar */}
        <div
          className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-75 ${
            active ? "bg-cyan-400" : "bg-white/15"
          }`}
          style={{ height: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[9px] font-bold ${active ? "text-cyan-400" : "text-slate-700"}`}
      >
        {side}
      </span>
    </div>
  );
}
