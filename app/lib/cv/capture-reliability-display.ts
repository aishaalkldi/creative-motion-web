/**
 * Clinician-facing labels for capture reliability flags — technical QC only.
 */

export const CAPTURE_RELIABILITY_FLAG_LABELS: Record<string, string> = {
  capture_setup_limited: "Capture started before setup checks passed",
  pose_tracking_interrupted: "Pose tracking interrupted during session",
  no_timeline_snapshots: "No motion timeline snapshots recorded",
  unclear_reps_recorded: "Some movement attempts were unclear or incomplete",
  unclear_visibility: "Visibility was unclear during capture",
  limited_observed_phases: "Limited movement phases observed",
};

export function isCaptureReliabilityFlag(flag: string): boolean {
  return flag in CAPTURE_RELIABILITY_FLAG_LABELS;
}

export function humanizeCaptureReliabilityFlags(flags: readonly string[]): string[] {
  return flags
    .filter(isCaptureReliabilityFlag)
    .map((flag) => CAPTURE_RELIABILITY_FLAG_LABELS[flag]!);
}
