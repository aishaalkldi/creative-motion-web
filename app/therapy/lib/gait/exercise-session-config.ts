/**
 * exercise-session-config.ts — Exercise-specific session detection parameters
 *
 * Translates the clinical requirements of each prescribed exercise into
 * concrete PoseCamera detection parameters. Keeping this separate from
 * gait-progression.ts ensures the clinical framework (targets, rules,
 * progression logic) stays decoupled from real-time detection (thresholds,
 * cooldowns, visual feedback).
 *
 * Coordinate system reference
 * ───────────────────────────
 * MediaPipe y-coordinates: 0 = top of frame, 1 = bottom (y increases downward).
 *
 *   raise = max(0, (hip.y + hipOffset) - knee.y)
 *
 *   raise = 0          →  knee is hipOffset below the hip (at "effective zero")
 *   raise = hipOffset  →  knee.y == hip.y  →  knee is at exact hip height
 *   raise > hipOffset  →  knee is above the hip
 *
 * With hipOffset = 0.13:
 *   raise 0.02 → knee ~11 % below hip  (barely detectable lift, default)
 *   raise 0.10 → knee ~2 % below hip   (approaching hip height, HKM)
 *   raise 0.13 → knee at hip height    (strict clinical standard)
 *
 * Why 0.10 for High Knee March and not 0.13?
 *   0.13 is the strict clinical target. Using it as a hard gate would make
 *   the exercise fail for patients with reduced hip flexion range, varying
 *   camera distance, or minor postural offsets. 0.10 enforces a genuine
 *   high-quality lift (77% of the way to hip level) while remaining
 *   achievable in an unmonitored home setting.
 *
 * Decision-support only · Not a clinical protocol.
 * All exercise parameters require clinical validation for formal use.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Interface
═══════════════════════════════════════════════════════════════════════════ */

export interface ExerciseSessionConfig {
  exerciseId:   string;
  exerciseName: string;

  /* ── Detection geometry ── */

  /**
   * Effective-zero offset below the hip.
   * (hip.y + hipOffset) is the baseline; raise is measured above this.
   * 0.13 = 13 % of frame height — same for all exercises in V1.
   */
  hipOffset: number;

  /**
   * Minimum raise value to register a valid rep.
   * Directly controls how high the knee must travel to count.
   * Scale: 0.25 = full VU meter height.
   */
  raiseThreshold: number;

  /**
   * Minimum milliseconds between reps on the same side.
   * Prevents double-counting fast bounces; longer for exercises
   * requiring deliberate, controlled movement.
   */
  stepCooldownMs: number;

  /* ── Visual feedback (KneeMeter) ── */

  /** Short label for the threshold line: "Target", "High Knee", "Lateral" etc. */
  targetLineLabel: string;

  /** Tailwind class for the threshold line colour. */
  targetLineColor: string;

  /* ── In-game coaching ── */

  /** One-line hint displayed in the camera panel when pose is active. */
  cameraHint: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Default config — exactly matches legacy hard-coded constants
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Used for any exercise that does not yet have an explicit config entry.
 * Mirrors the original constants (HIP_OFFSET=0.13, RAISE_THRESHOLD=0.02)
 * so all existing behaviour is fully preserved.
 */
export const DEFAULT_SESSION_CONFIG: ExerciseSessionConfig = {
  exerciseId:      "default",
  exerciseName:    "Exercise",
  hipOffset:       0.13,
  raiseThreshold:  0.02,
  stepCooldownMs:  300,
  targetLineLabel: "Target",
  targetLineColor: "bg-white/30",
  cameraHint:      "March in place",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Exercise 1 — High Knee March
═══════════════════════════════════════════════════════════════════════════ */

/**
 * HIGH KNEE MARCH
 *
 * Clinical goal: Controlled knee elevation to hip height with bilateral
 * coordination. This is the baseline exercise for all new patients.
 *
 * Detection change vs default:
 *   raiseThreshold  0.02 → 0.10   (knee must approach hip height)
 *   stepCooldownMs  300  → 350    (slight extension — encourages deliberate pace)
 *
 * The threshold increase is the primary quality gate for this exercise mode.
 * A raise value of 0.10 with hipOffset 0.13 means the knee has cleared
 * ~77 % of the distance to hip level — a genuine high-knee lift, not a shuffle.
 *
 * Target line colour changed to cyan to distinguish from the default white line
 * and give patients a clear, familiar "aim for the cyan line" visual goal.
 */
export const HIGH_KNEE_MARCH_CONFIG: ExerciseSessionConfig = {
  exerciseId:      "high_knee_march",
  exerciseName:    "High Knee March",
  hipOffset:       0.13,
  raiseThreshold:  0.10,
  stepCooldownMs:  350,
  targetLineLabel: "High Knee",
  targetLineColor: "bg-cyan-400/70",
  cameraHint:      "Lift knee toward hip height",
};

/* ═══════════════════════════════════════════════════════════════════════════
   Future exercise slots (V2)
═══════════════════════════════════════════════════════════════════════════ */

// export const RHYTHM_MARCH_CONFIG: ExerciseSessionConfig = {
//   exerciseId:      "rhythm_march",
//   exerciseName:    "Rhythm March",
//   hipOffset:       0.13,
//   raiseThreshold:  0.06,  // moderate — cadence-focused, not height-focused
//   stepCooldownMs:  220,   // shorter cooldown — allows higher cadence
//   targetLineLabel: "Rhythm",
//   targetLineColor: "bg-blue-400/70",
//   cameraHint:      "Keep a steady, rhythmic pace",
// };

// export const SIDE_STEPPING_CONFIG: ExerciseSessionConfig = {
//   exerciseId:      "side_stepping",
//   exerciseName:    "Side Stepping",
//   hipOffset:       0.08,  // lateral movement — different geometry
//   raiseThreshold:  0.04,
//   stepCooldownMs:  400,
//   targetLineLabel: "Step",
//   targetLineColor: "bg-purple-400/70",
//   cameraHint:      "Step sideways with controlled weight shift",
// };

/* ═══════════════════════════════════════════════════════════════════════════
   Registry + lookup
═══════════════════════════════════════════════════════════════════════════ */

const EXERCISE_SESSION_CONFIGS: Record<string, ExerciseSessionConfig> = {
  high_knee_march: HIGH_KNEE_MARCH_CONFIG,
  // rhythm_march:    RHYTHM_MARCH_CONFIG,   // uncomment when implemented
  // side_stepping:   SIDE_STEPPING_CONFIG,  // uncomment when implemented
};

/**
 * Return the session detection config for a given exercise ID.
 * Falls back to DEFAULT_SESSION_CONFIG for any exercise not yet configured,
 * preserving full backward compatibility.
 */
export function getExerciseSessionConfig(exerciseId: string): ExerciseSessionConfig {
  return EXERCISE_SESSION_CONFIGS[exerciseId] ?? DEFAULT_SESSION_CONFIG;
}
