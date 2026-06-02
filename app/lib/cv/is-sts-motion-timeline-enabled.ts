/**
 * SMT-1 — gate in-memory STS motion timeline.
 * Off by default; pilot sessions: ?cvDebug=1&smtTimeline=1 (developer-only).
 */

import type { CvY1ExerciseId } from "@/app/lib/cv/cv-patient-config";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import { isPatientCvDebugEnabled } from "@/app/lib/cv/patient-camera-debug";

/** Testable pilot gate from a query string (cvDebug=1 and smtTimeline=1). */
export function isStsMotionTimelinePilotEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("cvDebug") === "1" && params.get("smtTimeline") === "1";
}

/** Browser pilot gate: existing cvDebug plus explicit smtTimeline opt-in. */
export function isStsMotionTimelinePilotEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPatientCvDebugEnabled()) return false;
  return new URLSearchParams(window.location.search).get("smtTimeline") === "1";
}

export function isStsMotionTimelineEnabled(exerciseId: CvY1ExerciseId): boolean {
  if (exerciseId !== "sit-to-stand") return false;
  return (
    PATIENT_STS_CONFIG.motionTimelineEnabled === true ||
    isStsMotionTimelinePilotEnabled()
  );
}
