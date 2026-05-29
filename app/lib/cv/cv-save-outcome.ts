/**
 * Patient CV save-before-complete outcomes (no clinical interpretation).
 */

export type CvSaveOutcome =
  | "saved"
  | "not_active"
  | "too_short"
  | "skipped_camera"
  | "already_saved"
  | "post_error"
  | "no_detector"
  | "not_applicable";

export type CvSaveDebugSnapshot = {
  planSessionId: string;
  exerciseId: string;
  isPreviewActive: boolean;
  canSaveMetrics: boolean;
  sessionDurationS: number;
  repCount: number;
  result: CvSaveOutcome;
};

export function shouldLogCvSaveDebug(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("-git-") ||
    host.includes("vercel.app")
  );
}

export function logCvSaveAttempt(snapshot: CvSaveDebugSnapshot): void {
  if (!shouldLogCvSaveDebug()) return;
  console.info("[RASQ CV] saveBeforeExerciseComplete", snapshot);
}
