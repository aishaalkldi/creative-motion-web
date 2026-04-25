/**
 * biomechanics.ts
 *
 * Joint-angle mathematics and movement-quality scoring for Creative Motion.
 * Uses 2D normalised MediaPipe landmark coordinates (x, y ∈ [0,1], y ↓).
 *
 * These scores are decision-support metrics, not clinical measurements.
 * They provide relative, intra-patient comparisons across sessions.
 *
 * MEASUREMENT NOTES (disclosed to consumers):
 *   - Angles are captured at the peak of each detected knee lift
 *     (peak-detection window of ~400 ms after the rising-edge threshold).
 *   - ROM score requires ≥ 3 valid knee-angle samples; returns null otherwise.
 *   - Posture score requires ≥ 3 bilateral hip-tilt samples; returns null otherwise.
 *   - Symmetry score requires ≥ 3 detected steps on each side; returns null otherwise.
 *   - Raise threshold and hip offset are both normalised by a shared body-span
 *     EMA (stance-side shoulder-to-ankle distance) so detection is proportionally
 *     consistent regardless of camera distance.
 *   - Landmark visibility gate: a rising-edge step event is only registered when
 *     both the raised-side hip and knee report MediaPipe visibility ≥ 0.5.
 *     Low-visibility frames (occlusion, blur, poor lighting) are shown in the
 *     VU meter but do not trigger step counts or open peak-detection windows.
 *   - All scores remain camera-position-sensitive: results are most reliable
 *     when the patient fills the vertical frame from head to ankle.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Raw biomechanics snapshot captured at the peak of a step's knee-lift arc
 * (resolved ~400 ms after the rising-edge threshold crossing via the
 * peak-detection window in PoseCamera).
 */
export interface StepMetrics {
  /**
   * Hip → Knee → Ankle angle in degrees at the peak of the lift.
   * Full knee extension (standing): ≈170°.
   * Knee raised to hip level: ≈90°–130°.
   * 0 = unable to compute (landmarks not visible).
   */
  kneeAngle: number;
  /**
   * Shoulder → Hip → Knee angle in degrees.
   * Normal standing: ≈175°. Hip flexing: decreases.
   * 0 = unable to compute.
   */
  hipAngle: number;
  /** Peak raise height within the detection window: max((hip.y + hipOffset) − knee.y). */
  kneeRaiseHeight: number;
  /**
   * Pelvic tilt proxy: |left_hip.y − right_hip.y| × 1000.
   * 0 = level pelvis, 50+ = notable lateral tilt.
   */
  hipTilt: number;
  /**
   * Shoulder-to-ankle distance in normalised frame coordinates at the moment
   * of peak lift.  Used for camera-distance normalisation: a larger span means
   * the patient is closer to the camera.  0 = landmarks not visible.
   */
  bodySpan: number;
}

/** Per-session aggregated biomechanics stored alongside the SessionRecord. */
export interface BiomechanicsData {
  avgLeftKneeAngle:    number;      // degrees
  avgRightKneeAngle:   number;
  avgLeftHipAngle:     number;
  avgRightHipAngle:    number;
  avgLeftKneeHeight:   number;      // normalised 0–1
  avgRightKneeHeight:  number;
  /**
   * ROM score (0–100), derived from average knee-flexion angle at peak lift.
   * null when fewer than 3 valid knee-angle samples were captured.
   */
  romScore:             number | null;
  /**
   * Pelvic level estimate (0–100), derived from mean vertical asymmetry between
   * left and right hip landmarks across all steps.
   * This is a 2D projection proxy — not a physical displacement measurement.
   * null when fewer than 3 bilateral samples were captured.
   */
  postureScore:         number | null;
  /** Step-height consistency score (0–100). Coefficient of variation of raise heights. */
  controlScore:         number;
  /**
   * Bilateral lift-height symmetry score (0–100).
   * null when fewer than 3 steps were detected on either side.
   */
  symmetryScore:        number | null;
  /** Weighted composite of available scores (0–100). */
  movementQualityScore: number;
  /** Number of detected steps that contributed to this biomechanics record. */
  stepCount:            number;
  /**
   * Average smoothed stance-side body span across all detected steps.
   * A value near 0.55 indicates the patient filled the frame well.
   * Lower values (< 0.35) suggest the patient was too close;
   * higher values (> 0.75) suggest too far or partial occlusion.
   * 0 = no body-span data was available (shoulder or ankle not visible).
   */
  avgBodySpan:          number;
  /**
   * Fraction of detected steps that had valid body-span data (0.0–1.0).
   * 1.0 = every step was normalised; 0.0 = no steps were normalised (raw threshold used).
   * Values below 0.5 indicate that the normalisation benefit was limited and
   * scores should be interpreted with additional caution.
   */
  bodySpanConfidence:   number;
  /**
   * Average lower-body landmark visibility across all detection frames where
   * a pose was present (0.0–1.0, sourced from MediaPipe confidence scores).
   * Covers: left/right hip, knee, and ankle (6 landmarks).
   * Values below 0.5 indicate frequent partial occlusion or poor lighting,
   * which reduces the reliability of all joint-angle measurements.
   */
  landmarkQuality:      number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   calculateAngle  —  angle at vertex B formed by A–B–C
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Returns the angle in degrees at point `b` (the vertex) in the A–B–C triplet.
 * Uses the dot-product formula; returns 0 when vectors are degenerate.
 */
export function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const abX = a.x - b.x, abY = a.y - b.y;
  const cbX = c.x - b.x, cbY = c.y - b.y;
  const mag_a = Math.sqrt(abX ** 2 + abY ** 2);
  const mag_c = Math.sqrt(cbX ** 2 + cbY ** 2);
  if (mag_a < 1e-6 || mag_c < 1e-6) return 0;
  const cos = Math.max(-1, Math.min(1, (abX * cbX + abY * cbY) / (mag_a * mag_c)));
  return Math.round(Math.acos(cos) * (180 / Math.PI));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Score calculators
═══════════════════════════════════════════════════════════════════════════ */

/**
 * ROM Score — how much knee flexion the patient achieves at peak lift.
 *
 * The angle is measured at the peak of the lift (after the 400 ms
 * peak-detection window), which is a closer approximation to true ROM
 * than the legacy threshold-crossing moment.
 *
 *   Angle  90°  → 100 pts  (excellent ROM, deep march)
 *   Angle 130°  →  57 pts  (moderate, hip-level lift)
 *   Angle 160°  →   0 pts  (poor, barely-raised knee)
 *
 * Returns null when fewer than 3 valid knee-angle samples are available.
 */
export function calculateROMScore(avgKneeAngle: number, sampleCount: number): number | null {
  if (sampleCount < 3 || avgKneeAngle <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(100 - ((avgKneeAngle - 90) / 70) * 100)));
}

/**
 * Pelvic Level Estimate — vertical hip-landmark asymmetry during marching.
 *
 * Measures the mean absolute difference between the normalised y-coordinates
 * of the left and right hip landmarks at each step event, scaled by ×1000
 * to produce a readable integer.
 *
 *   Mean |left_hip.y − right_hip.y| × 1000:
 *     0   → 100 pts  (hips appear level throughout)
 *    50   →  50 pts  (moderate bilateral asymmetry in 2D projection)
 *   100+  →   0 pts  (pronounced asymmetry)
 *
 * IMPORTANT: This is a 2D projection proxy, NOT a physical displacement
 * measurement.  Camera angle, patient rotation, and clothing all affect the
 * result.  It provides a relative, within-session signal only — not a
 * clinical pelvis stability score.  The label "posture" is a shorthand;
 * the underlying computation is hip-landmark vertical asymmetry.
 *
 * Returns null when fewer than 3 bilateral measurements are available
 * (insufficient data to distinguish pose-estimation noise from signal).
 */
export function calculatePostureScore(hipTilts: number[]): number | null {
  if (hipTilts.length < 3) return null;
  const avgTilt = hipTilts.reduce((a, b) => a + b, 0) / hipTilts.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgTilt)));
}

/**
 * Control Score — consistency of step height across all repetitions.
 *
 * Uses the coefficient of variation (CV = σ/μ) of all raise heights.
 * Low variability = high step-height consistency.
 *
 *   CV  0% → 100 pts  (perfectly consistent)
 *   CV 40% →   0 pts  (highly variable)
 *
 * Returns 75 when fewer than 2 samples exist (insufficient for CV).
 * NOTE: this is a step-height consistency score, not a timing measure.
 */
export function calculateControlScore(heights: number[]): number {
  if (heights.length < 2) return 75;
  const n    = heights.length;
  const mean = heights.reduce((a, b) => a + b, 0) / n;
  if (mean < 1e-4) return 50;
  const variance = heights.reduce((acc, h) => acc + (h - mean) ** 2, 0) / n;
  const cv = (Math.sqrt(variance) / mean) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - (cv / 40) * 100)));
}

/**
 * Symmetry Score — bilateral height balance between left and right knee lifts.
 *
 *   0 difference → 100 pts  (perfect bilateral symmetry)
 *   50% height diff → 0 pts (severe asymmetry)
 *
 * Returns null when fewer than 3 steps were detected on either side —
 * a single-sample average is too noisy to be a meaningful bilateral comparison.
 */
export function calculateSymmetryScore(
  avgLeft: number,
  avgRight: number,
  leftCount: number,
  rightCount: number,
): number | null {
  if (leftCount < 3 || rightCount < 3) return null;
  const total = avgLeft + avgRight;
  if (total < 1e-4) return 100;
  const diff = Math.abs(avgLeft - avgRight);
  return Math.max(0, Math.min(100, Math.round((1 - diff / Math.max(avgLeft, avgRight)) * 100)));
}

/**
 * Movement Quality Score — weighted composite of available scores.
 *
 * Weights reflect clinical priority for early-stage rehab:
 *   Control  35%  (motor consistency)
 *   ROM      25%  (range of motion)
 *   Symmetry 25%  (bilateral balance)
 *   Posture  15%  (pelvic stability)
 *
 * When any component is null (insufficient data), its weight is redistributed
 * proportionally across the remaining components, preserving the 0–100 scale
 * without fabricating values.  Control is always present (never null).
 */
export function calculateMovementQualityScore(
  rom: number | null,
  posture: number | null,
  control: number,
  symmetry: number | null,
): number {
  // Control is the only always-present component
  const components: Array<[number, number]> = [[control, 0.35]];
  if (symmetry !== null) components.push([symmetry, 0.25]);
  if (rom      !== null) components.push([rom,      0.25]);
  if (posture  !== null) components.push([posture,  0.15]);

  const totalWeight = components.reduce((s, [, w]) => s + w, 0);
  const weighted    = components.reduce((s, [v, w]) => s + v * w, 0);
  // Normalise so missing components don't deflate the composite
  return Math.round(weighted / totalWeight);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Session aggregation
═══════════════════════════════════════════════════════════════════════════ */

function avgOf(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Aggregate per-step metrics collected during a playing session into a single
 * BiomechanicsData record suitable for storage and later analysis.
 *
 * Minimum step count: 5 total steps (left + right combined). Below this,
 * the caller should omit biomechanics entirely — see session/page.tsx.
 *
 * @param leftSteps      StepMetrics array from all detected left-knee steps
 * @param rightSteps     StepMetrics array from all detected right-knee steps
 * @param landmarkQuality  Mean lower-body landmark visibility across all
 *                         detection frames (0–1). Pass 0 if not tracked.
 */
export function computeSessionBiomechanics(
  leftSteps: StepMetrics[],
  rightSteps: StepMetrics[],
  landmarkQuality = 0,
): BiomechanicsData {
  const stepCount = leftSteps.length + rightSteps.length;

  // Angle averages (skip zero values — means landmark wasn't visible)
  const validAngles = (arr: StepMetrics[], key: "kneeAngle" | "hipAngle") =>
    arr.map((m) => m[key]).filter((a) => a > 0);

  const avgLeftKneeAngle  = Math.round(avgOf(validAngles(leftSteps,  "kneeAngle")));
  const avgRightKneeAngle = Math.round(avgOf(validAngles(rightSteps, "kneeAngle")));
  const avgLeftHipAngle   = Math.round(avgOf(validAngles(leftSteps,  "hipAngle")));
  const avgRightHipAngle  = Math.round(avgOf(validAngles(rightSteps, "hipAngle")));

  const avgLeftKneeHeight  = parseFloat(avgOf(leftSteps.map((m) => m.kneeRaiseHeight)).toFixed(3));
  const avgRightKneeHeight = parseFloat(avgOf(rightSteps.map((m) => m.kneeRaiseHeight)).toFixed(3));

  // Composite angle across both sides for ROM
  const allKneeAngles = [
    ...validAngles(leftSteps,  "kneeAngle"),
    ...validAngles(rightSteps, "kneeAngle"),
  ];
  const compositeKneeAngle = allKneeAngles.length ? avgOf(allKneeAngles) : 0;

  // All heights for control score
  const allHeights = [
    ...leftSteps.map((m) => m.kneeRaiseHeight),
    ...rightSteps.map((m) => m.kneeRaiseHeight),
  ];

  // Hip tilts (bilateral, captured at each step regardless of side)
  const allHipTilts = [
    ...leftSteps.map((m) => m.hipTilt),
    ...rightSteps.map((m) => m.hipTilt),
  ];

  const romScore      = calculateROMScore(compositeKneeAngle, allKneeAngles.length);
  const postureScore  = calculatePostureScore(allHipTilts);
  const controlScore  = calculateControlScore(allHeights);
  const symmetryScore = calculateSymmetryScore(
    avgLeftKneeHeight, avgRightKneeHeight,
    leftSteps.length,  rightSteps.length,
  );
  const movementQualityScore = calculateMovementQualityScore(
    romScore, postureScore, controlScore, symmetryScore,
  );

  // Body-span stats — only from steps that had valid stance-side span data
  const allBodySpans = [
    ...leftSteps.map((m) => m.bodySpan),
    ...rightSteps.map((m) => m.bodySpan),
  ].filter((s) => s > 0);

  const avgBodySpan = allBodySpans.length > 0
    ? parseFloat(avgOf(allBodySpans).toFixed(3))
    : 0;

  // Confidence: what fraction of steps had valid body-span normalisation
  const bodySpanConfidence = stepCount > 0
    ? parseFloat((allBodySpans.length / stepCount).toFixed(2))
    : 0;

  return {
    avgLeftKneeAngle,
    avgRightKneeAngle,
    avgLeftHipAngle,
    avgRightHipAngle,
    avgLeftKneeHeight,
    avgRightKneeHeight,
    romScore,
    postureScore,
    controlScore,
    symmetryScore,
    movementQualityScore,
    stepCount,
    avgBodySpan,
    bodySpanConfidence,
    landmarkQuality: parseFloat(Math.min(1, Math.max(0, landmarkQuality)).toFixed(2)),
  };
}
