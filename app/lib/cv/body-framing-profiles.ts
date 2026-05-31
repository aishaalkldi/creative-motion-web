/**
 * Body framing profiles for patient CV exercises (distance / visibility only).
 */

import type { BodyFramingProfile } from "@/app/lib/cv/body-framing-evaluator";

export type BodyFramingProfileId = "seated-rise" | "standing-sagittal-rep";

/** Sit-to-Stand — seated start; hips, shoulders, at least one knee visible. */
export const SEATED_RISE_FRAMING_PROFILE: BodyFramingProfile = {
  id: "seated-rise",
  minHipVisibility: 0.35,
  minShoulderVisibility: 0.3,
  requireNose: false,
  requireKnee: true,
  minKneeVisibility: 0.25,
  torsoSpanMin: 0.06,
  torsoSpanMax: 0.52,
  bboxHeightMin: 0.32,
  bboxHeightMax: 0.9,
  frameMargin: 0.04,
};

/** Mini Squat — standing; head to mid-shin in frame. */
export const STANDING_SAGITTAL_REP_FRAMING_PROFILE: BodyFramingProfile = {
  id: "standing-sagittal-rep",
  minHipVisibility: 0.35,
  minShoulderVisibility: 0.3,
  requireNose: true,
  minNoseVisibility: 0.25,
  requireKnee: true,
  minKneeVisibility: 0.28,
  torsoSpanMin: 0.1,
  torsoSpanMax: 0.48,
  bboxHeightMin: 0.48,
  bboxHeightMax: 0.86,
  frameMargin: 0.04,
};

const PROFILES: Record<BodyFramingProfileId, BodyFramingProfile> = {
  "seated-rise": SEATED_RISE_FRAMING_PROFILE,
  "standing-sagittal-rep": STANDING_SAGITTAL_REP_FRAMING_PROFILE,
};

export function resolveBodyFramingProfile(
  profileId: BodyFramingProfileId | undefined,
): BodyFramingProfile | null {
  if (!profileId) return null;
  return PROFILES[profileId] ?? null;
}
