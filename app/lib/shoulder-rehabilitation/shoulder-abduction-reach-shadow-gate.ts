/**
 * Shoulder Abduction Reach shadow mode — enablement gate.
 *
 * Off by default; opt in with `?cvDebug=1&shoulderShadow=1` (developer-only),
 * mirroring the existing `is-sts-motion-timeline-enabled.ts` pilot-gate
 * pattern exactly (same `cvDebug` flag, same shape). No config default is
 * introduced that could turn this on in production by accident.
 */

import { isPatientCvDebugEnabled } from "@/app/lib/cv/patient-camera-debug";

/** Testable pilot gate from a query string (cvDebug=1 and shoulderShadow=1). */
export function isShoulderAbductionReachShadowPilotEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("cvDebug") === "1" && params.get("shoulderShadow") === "1";
}

/** Browser gate: existing cvDebug plus explicit shoulderShadow opt-in. */
export function isShoulderAbductionReachShadowEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPatientCvDebugEnabled()) return false;
  return new URLSearchParams(window.location.search).get("shoulderShadow") === "1";
}
