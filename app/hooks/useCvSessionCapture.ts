"use client";

import { useCallback, useRef, useState } from "react";
import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";
import { isCvMetricsEligibleForSave } from "@/app/lib/cv/cv-session-save-gate";

export type CvCaptureStatus =
  | "not_started"
  | "capturing"
  | "save_pending"
  | "saved"
  | "save_failed"
  | "skipped";

export type CvSaveResult =
  | "saved"
  | "already_saved"
  | "skipped"
  | "too_short"
  | "no_metrics"
  | "not_applicable"
  | "post_error";

type UseCvSessionCaptureArgs = {
  token: string;
  planSessionId: string;
  exerciseId: string | undefined;
};

export function useCvSessionCapture({
  token,
  planSessionId,
  exerciseId,
}: UseCvSessionCaptureArgs) {
  const [cvStatus, setCvStatus] = useState<CvCaptureStatus>("not_started");
  const latestMetricsRef = useRef<PatientCvDerivedMetrics | null>(null);
  const hasSavedRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const skippedRef = useRef(false);
  const saveFlightRef = useRef<Promise<CvSaveResult> | null>(null);
  const flushMetricsRef = useRef<(() => void) | null>(null);

  const isCvEligible = isCvEnabledExercise(exerciseId);

  const onMetricsUpdate = useCallback((metrics: PatientCvDerivedMetrics) => {
    latestMetricsRef.current = metrics;
    if (skippedRef.current || hasSavedRef.current) return;
    setCvStatus((prev) =>
      prev === "save_pending" || prev === "saved" || prev === "save_failed" || prev === "skipped"
        ? prev
        : "capturing",
    );
  }, []);

  const markSkipped = useCallback(() => {
    skippedRef.current = true;
    latestMetricsRef.current = null;
    setCvStatus("skipped");
  }, []);

  const registerMetricsFlush = useCallback((flush: () => void) => {
    flushMetricsRef.current = flush;
  }, []);

  const resetCapture = useCallback(() => {
    latestMetricsRef.current = null;
    hasSavedRef.current = false;
    saveInProgressRef.current = false;
    skippedRef.current = false;
    saveFlightRef.current = null;
    flushMetricsRef.current = null;
    setCvStatus("not_started");
  }, []);

  const saveCvMetrics = useCallback(async (): Promise<CvSaveResult> => {
    try {
      if (!isCvEligible) return "not_applicable";
      if (skippedRef.current) return "skipped";
      if (hasSavedRef.current) return "already_saved";
      if (saveFlightRef.current) return saveFlightRef.current;

      flushMetricsRef.current?.();

      const metrics = latestMetricsRef.current;
      if (!metrics) return "no_metrics";
      if (!isCvMetricsEligibleForSave(metrics)) return "too_short";

      const run = async (): Promise<CvSaveResult> => {
        saveInProgressRef.current = true;
        setCvStatus("save_pending");

        const payload = {
          token,
          sessionId: planSessionId,
          exerciseId: metrics.exerciseId,
          repCount: metrics.repCount,
          sessionDurationS: metrics.sessionDurationS,
          trackingQuality: metrics.trackingQuality,
          movementDetected: metrics.movementDetected,
          framesWithPose: metrics.framesWithPose,
          framesTotal: metrics.framesTotal,
        };

        try {
          const res = await fetch("/api/patient/cv-session-metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            setCvStatus("save_failed");
            return "post_error";
          }

          hasSavedRef.current = true;
          setCvStatus("saved");
          return "saved";
        } catch {
          setCvStatus("save_failed");
          return "post_error";
        } finally {
          saveInProgressRef.current = false;
        }
      };

      saveFlightRef.current = run();
      return await saveFlightRef.current;
    } catch {
      setCvStatus("save_failed");
      return "post_error";
    } finally {
      saveFlightRef.current = null;
    }
  }, [isCvEligible, token, planSessionId]);

  return {
    cvStatus,
    isCvEligible,
    onMetricsUpdate,
    markSkipped,
    registerMetricsFlush,
    saveCvMetrics,
    resetCapture,
  };
}
