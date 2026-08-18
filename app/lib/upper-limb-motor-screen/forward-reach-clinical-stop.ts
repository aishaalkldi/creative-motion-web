/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Builds the explicit clinician-recorded ClinicalStopEvent for the "Stop
 * Session" action. No new clinical-stop policy or automatic safety
 * decision is made here — the clinician selects the reason; this module
 * only stamps recordedBy/recordedAt/reviewRequired mechanically. The
 * event is then sent through the existing, unchanged
 * clinicalStopReceived engine command (ForwardReachCameraDetector.recordClinicalStop).
 */

import type { ClinicalStopEvent, ClinicalStopReason } from "./types";

export function buildClinicianClinicalStopEvent(
  reason: ClinicalStopReason,
  nowIso: string = new Date().toISOString(),
): ClinicalStopEvent {
  return {
    reason,
    recordedAt: nowIso,
    recordedBy: "clinician",
    reviewRequired: true,
  };
}
