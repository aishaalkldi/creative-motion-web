/** Public derived CV metrics shape from GET /api/cv/session-metrics */

export type CvSessionMetricPublic = {
  id: string;
  exerciseId: string;
  repCount: number | null;
  sessionDurationS: number | null;
  trackingQuality: string | null;
  movementDetected: boolean;
  source: string;
  prototypeVersion?: string | null;
  recordedAt: string;
  patientId?: string | null;
  planId?: string | null;
  planSessionId?: string | null;
};

export const CV_CLINICIAN_DISCLAIMER =
  "For clinician review — derived movement metrics only — not clinically validated. No video or body coordinates are stored.";

export const CV_REP_COUNT_FOOTER =
  "Rep count is an assistive movement metric and must be reviewed with the patient's clinical context.";

export function formatCvRecordedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatCvDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Clinician-facing tracking signal label (not a clinical score). */
export function formatCvTrackingSignal(quality: string | null): string {
  if (!quality) return "—";
  const normalized = quality.trim().toLowerCase();
  if (normalized === "good") return "Good signal";
  if (normalized === "fair") return "Fair signal";
  if (normalized === "poor") return "Poor signal";
  if (normalized === "unknown") return "Unknown signal";
  return quality.charAt(0).toUpperCase() + quality.slice(1);
}

/** @deprecated CV Lab table — use formatCvTrackingSignal in patient profile UI */
export function formatCvTrackingQuality(quality: string | null): string {
  if (!quality) return "—";
  const normalized = quality.trim().toLowerCase();
  if (normalized === "good") return "Good";
  if (normalized === "fair") return "Fair";
  if (normalized === "poor") return "Poor";
  if (normalized === "unknown") return "Unknown";
  return quality.charAt(0).toUpperCase() + quality.slice(1);
}

export function formatCvSource(source: string): string {
  if (source === "cv_lab") return "CV Lab";
  if (source === "patient_session") return "Patient Session";
  if (source === "assessment_movement") return "Assessment";
  return source;
}

export function formatCvMovementDetected(detected: boolean): string {
  return detected ? "Yes" : "No";
}

export function formatCvPrototypeLabel(version: string | null | undefined): string {
  const v = version?.trim();
  if (!v || v === "0.1") return "Prototype";
  return v;
}

export function summarizeCvSources(metrics: CvSessionMetricPublic[]): string {
  const sources = new Set(metrics.map((m) => m.source));
  const hasPatient = sources.has("patient_session");
  const hasLab = sources.has("cv_lab");
  if (hasPatient && hasLab) return "Patient Session / CV Lab";
  if (hasPatient) return "Patient Session";
  if (hasLab) return "CV Lab";
  if (sources.has("assessment_movement")) return "Assessment";
  return "—";
}

export function totalCvRepsRecorded(metrics: CvSessionMetricPublic[]): number {
  return metrics.reduce((sum, row) => sum + (row.repCount ?? 0), 0);
}

/** Patient Session rows first, then newest recorded_at within each group. */
export function sortCvMetricsForPatientProfile(
  metrics: CvSessionMetricPublic[],
): CvSessionMetricPublic[] {
  return [...metrics].sort((a, b) => {
    const aPatient = a.source === "patient_session" ? 0 : 1;
    const bPatient = b.source === "patient_session" ? 0 : 1;
    if (aPatient !== bPatient) return aPatient - bPatient;
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
  });
}
