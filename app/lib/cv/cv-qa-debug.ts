/**
 * Preview / local QA only — CV save debug UI gate (not production).
 */

import type { SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";

export type CvSaveResult =
  | "saved"
  | "already_saved"
  | "skipped"
  | "too_short"
  | "no_metrics"
  | "not_applicable"
  | "post_error";

export function isCvQaDebugEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.includes("-git-");
}

export type CvSaveDebugMetricsSnapshot = {
  sessionDurationS: number;
  repCount: number;
  trackingQuality: string;
  movementDetected: boolean;
  exerciseId: string;
  planSessionId: string;
};

export type CvSaveDebugFlags = {
  hasSaved: boolean;
  saveInProgress: boolean;
  skipped: boolean;
  flushRegistered: boolean;
};

export type CvSaveDebugState = {
  headline: string;
  lines: string[];
  lastResult: CvSaveResult | null;
  notEligibleReason: string | null;
  notSavedReason: string | null;
  postStatus: number | null;
  postMessage: string | null;
  latestMetrics: CvSaveDebugMetricsSnapshot | null;
  flags: CvSaveDebugFlags;
  planSessionId: string;
  exerciseId: string | undefined;
};

export function metricsToDebugSnapshot(
  metrics: SitToStandDerivedMetrics,
  planSessionId: string,
): CvSaveDebugMetricsSnapshot {
  return {
    sessionDurationS: metrics.sessionDurationS,
    repCount: metrics.repCount,
    trackingQuality: metrics.trackingQuality,
    movementDetected: metrics.movementDetected,
    exerciseId: metrics.exerciseId,
    planSessionId,
  };
}

export function createInitialCvSaveDebugState(
  planSessionId: string,
  exerciseId: string | undefined,
): CvSaveDebugState {
  return {
    headline: "Waiting for capture",
    lines: ["CV debug idle"],
    lastResult: null,
    notEligibleReason: null,
    notSavedReason: null,
    postStatus: null,
    postMessage: null,
    latestMetrics: null,
    flags: {
      hasSaved: false,
      saveInProgress: false,
      skipped: false,
      flushRegistered: false,
    },
    planSessionId,
    exerciseId,
  };
}
