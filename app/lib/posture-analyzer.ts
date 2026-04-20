/**
 * Posture Assessment — browser-side landmark analysis.
 * Pure functions. No side-effects. No imports from React or Next.js.
 *
 * Uses the same BlazePose 33-landmark topology as body-axis-ai.
 * Landmark indices:
 *   0  = nose            11,12 = L/R shoulder
 *   23,24 = L/R hip      25,26 = L/R knee
 */
import type { NormLandmark } from "./body-axis-acl-squat";

export type PostureLabel =
  | "Good alignment"
  | "Mild asymmetry detected"
  | "Postural deviation observed";

function scoreToPostureLabel(score: number): PostureLabel {
  return score >= 80
    ? "Good alignment"
    : score >= 60
      ? "Mild asymmetry detected"
      : "Postural deviation observed";
}

export type PostureCheckResult = {
  /** Shoulder tilt — angle of shoulder line from horizontal (degrees). */
  shoulderTilt: number;
  /** Head lateral offset — nose x vs shoulder midpoint x (normalised, 0–1). */
  headOffset: number;
  /** Trunk lateral shift — hip midpoint x vs shoulder midpoint x (normalised, 0–1). */
  trunkOffset: number;
  /** Hip tilt — angle of hip line from horizontal (degrees). */
  hipTilt: number;
  /** Composite score 0–100. */
  score: number;
  label: PostureLabel;
  details: string;
};

/**
 * Analyse a single 33-landmark frame for static posture.
 * Returns null if key landmarks are missing or low-visibility.
 */
export function analysePostureFrame(
  landmarks: NormLandmark[]
): PostureCheckResult | null {
  const nose = landmarks[0];
  const lSh = landmarks[11];
  const rSh = landmarks[12];
  const lHip = landmarks[23];
  const rHip = landmarks[24];

  if (!nose || !lSh || !rSh || !lHip || !rHip) return null;
  if ([nose, lSh, rSh, lHip, rHip].some((lm) => (lm.visibility ?? 1) < 0.3))
    return null;

  // Shoulder tilt (degrees)
  const shoulderTilt = Math.abs(
    Math.atan2(rSh.y - lSh.y, rSh.x - lSh.x) * (180 / Math.PI)
  );

  // Head lateral offset (normalised)
  const shoulderMidX = (lSh.x + rSh.x) / 2;
  const headOffset = Math.abs(nose.x - shoulderMidX);

  // Hip tilt (degrees)
  const hipTilt = Math.abs(
    Math.atan2(rHip.y - lHip.y, rHip.x - lHip.x) * (180 / Math.PI)
  );

  // Trunk lateral shift (normalised)
  const hipMidX = (lHip.x + rHip.x) / 2;
  const trunkOffset = Math.abs(hipMidX - shoulderMidX);

  // Score deductions
  let score = 100;
  if (shoulderTilt > 8) score -= 25;
  else if (shoulderTilt > 4) score -= 12;

  if (headOffset > 0.06) score -= 20;
  else if (headOffset > 0.03) score -= 10;

  if (hipTilt > 8) score -= 25;
  else if (hipTilt > 4) score -= 12;

  if (trunkOffset > 0.06) score -= 20;
  else if (trunkOffset > 0.03) score -= 10;

  score = Math.max(0, Math.min(100, score));

  const label = scoreToPostureLabel(score);

  const issues: string[] = [];
  if (shoulderTilt > 4) issues.push(`shoulder tilt ${shoulderTilt.toFixed(1)}°`);
  if (headOffset > 0.03) issues.push("head offset");
  if (hipTilt > 4) issues.push(`hip tilt ${hipTilt.toFixed(1)}°`);
  if (trunkOffset > 0.03) issues.push("trunk shift");

  const details =
    issues.length > 0
      ? `Flags: ${issues.join(", ")}.`
      : "No significant deviations detected.";

  return { shoulderTilt, headOffset, trunkOffset, hipTilt, score, label, details };
}

/**
 * Aggregate per-frame posture results into a final score and report summary.
 */
export function aggregatePostureResults(frames: PostureCheckResult[]): {
  score: number;
  label: PostureLabel;
  summary: string;
} {
  if (frames.length === 0) {
    return {
      score: 75,
      label: "Mild asymmetry detected",
      summary:
        "Postural Assessment completed. Insufficient frames for full analysis — ensure full body is visible next time.",
    };
  }

  const avgScore =
    frames.reduce((s, f) => s + f.score, 0) / frames.length;
  const score = Math.round(avgScore);

  const label = scoreToPostureLabel(score);

  const last = frames[frames.length - 1];
  const summary = `Postural Assessment completed. ${label}. Overall postural score: ${score}%. ${last?.details ?? ""}`;

  return { score, label, summary };
}
