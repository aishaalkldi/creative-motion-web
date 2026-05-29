/**
 * Patient CV save-before-complete outcomes (no clinical interpretation).
 */

import { isCvQaDebugEnabled } from "@/app/lib/cv/cv-qa-debug";

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
  return isCvQaDebugEnabled();
}

export function logCvSaveAttempt(snapshot: CvSaveDebugSnapshot): void {
  if (!shouldLogCvSaveDebug()) return;
  console.info("[RASQ CV] saveBeforeExerciseComplete", snapshot);
}
