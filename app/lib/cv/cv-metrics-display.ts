/** Public derived CV metrics shape from GET /api/cv/session-metrics */

export type CvSessionMetricPublic = {
  id: string;
  exerciseId: string;
  repCount: number | null;
  sessionDurationS: number | null;
  trackingQuality: string | null;
  movementDetected: boolean;
  source: string;
  recordedAt: string;
  patientId?: string | null;
  planId?: string | null;
  planSessionId?: string | null;
};

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
