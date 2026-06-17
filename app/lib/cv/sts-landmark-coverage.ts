/**
 * PR101 — STS landmark coverage readiness (setup only, not persisted).
 * Shoulders, hips, and knees are core; ankles are bonus only.
 */

import type { PoseLandmark } from "@/app/lib/cv/sagittal-hip-rep-core";

export const STS_COVERAGE_MIN_HIP_VISIBILITY = 0.35;
export const STS_COVERAGE_MIN_SHOULDER_VISIBILITY = 0.3;
export const STS_COVERAGE_MIN_KNEE_VISIBILITY = 0.25;

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

export type StsLandmarkCoverage = {
  /** 0–100 weighted score; ankles contribute bonus only. */
  score: number;
  shouldersOk: boolean;
  hipsOk: boolean;
  kneesOk: boolean;
  anklesBonus: boolean;
};

function landmarkVis(landmark: PoseLandmark | undefined): number {
  return landmark?.visibility ?? 0;
}

export function computeStsLandmarkCoverage(landmarks: PoseLandmark[]): StsLandmarkCoverage {
  const ls = landmarks[L_SHOULDER];
  const rs = landmarks[R_SHOULDER];
  const lh = landmarks[L_HIP];
  const rh = landmarks[R_HIP];
  const lk = landmarks[L_KNEE];
  const rk = landmarks[R_KNEE];
  const la = landmarks[L_ANKLE];
  const ra = landmarks[R_ANKLE];

  const shoulderVisL = landmarkVis(ls);
  const shoulderVisR = landmarkVis(rs);
  const hipVisL = landmarkVis(lh);
  const hipVisR = landmarkVis(rh);
  const kneeVis = Math.max(landmarkVis(lk), landmarkVis(rk));
  const ankleVis = Math.max(landmarkVis(la), landmarkVis(ra));

  const shouldersOk =
    shoulderVisL >= STS_COVERAGE_MIN_SHOULDER_VISIBILITY &&
    shoulderVisR >= STS_COVERAGE_MIN_SHOULDER_VISIBILITY;
  const hipsOk =
    hipVisL >= STS_COVERAGE_MIN_HIP_VISIBILITY && hipVisR >= STS_COVERAGE_MIN_HIP_VISIBILITY;
  const kneesOk = kneeVis >= STS_COVERAGE_MIN_KNEE_VISIBILITY;
  const anklesBonus = ankleVis >= 0.25;

  const shoulderScore =
    (Math.min(shoulderVisL, 1) + Math.min(shoulderVisR, 1)) / 2;
  const hipScore = (Math.min(hipVisL, 1) + Math.min(hipVisR, 1)) / 2;
  const kneeScore = Math.min(kneeVis, 1);
  const coreAvg = (shoulderScore + hipScore + kneeScore) / 3;
  const bonus = anklesBonus ? 0.05 : 0;
  const score = Math.round(Math.min(100, (coreAvg + bonus) * 100));

  return { score, shouldersOk, hipsOk, kneesOk, anklesBonus };
}

export function isStsCoverageReady(
  coverage: StsLandmarkCoverage,
  trackingQuality: "good" | "fair" | "poor" | null,
): boolean {
  if (trackingQuality === "poor" || trackingQuality === null) return false;
  return coverage.shouldersOk && coverage.hipsOk && coverage.kneesOk;
}

/** STS framing states that may be advisory when landmark coverage is strong. */
export function isStsAdvisoryFramingState(state: string): boolean {
  return state === "move_back";
}
