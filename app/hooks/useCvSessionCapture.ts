"use client";

import { useCallback, useRef, useState } from "react";
import type { SitToStandDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import { CV_MIN_SAVE_DURATION_S, isCvEnabledExercise } from "@/app/lib/cv/cv-patient-config";
import {
  createInitialCvSaveDebugState,
  isCvQaDebugEnabled,
  metricsToDebugSnapshot,
  type CvSaveDebugState,
  type CvSaveResult,
} from "@/app/lib/cv/cv-qa-debug";

export type { CvSaveResult } from "@/app/lib/cv/cv-qa-debug";

export type CvCaptureStatus =
  | "not_started"
  | "capturing"
  | "save_pending"
  | "saved"
  | "save_failed"
  | "skipped";

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
  const latestMetricsRef = useRef<SitToStandDerivedMetrics | null>(null);
  const hasSavedRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const skippedRef = useRef(false);
  const saveFlightRef = useRef<Promise<CvSaveResult> | null>(null);
  const flushMetricsRef = useRef<(() => void) | null>(null);

  const isCvEligible = isCvEnabledExercise(exerciseId);
  const qaDebug = isCvQaDebugEnabled();

  const [cvSaveDebug, setCvSaveDebug] = useState<CvSaveDebugState>(() =>
    createInitialCvSaveDebugState(planSessionId, exerciseId),
  );

  const syncDebugFlags = useCallback(
    (patch: Partial<CvSaveDebugState> = {}): void => {
      if (!qaDebug) return;
      setCvSaveDebug((prev) => ({
        ...prev,
        ...patch,
        planSessionId,
        exerciseId,
        latestMetrics: latestMetricsRef.current
          ? metricsToDebugSnapshot(latestMetricsRef.current, planSessionId)
          : null,
        flags: {
          hasSaved: hasSavedRef.current,
          saveInProgress: saveInProgressRef.current,
          skipped: skippedRef.current,
          flushRegistered: flushMetricsRef.current != null,
        },
      }));
    },
    [qaDebug, planSessionId, exerciseId],
  );

  const onMetricsUpdate = useCallback(
    (metrics: SitToStandDerivedMetrics) => {
      latestMetricsRef.current = metrics;
      if (skippedRef.current || hasSavedRef.current) {
        syncDebugFlags();
        return;
      }
      setCvStatus((prev) =>
        prev === "save_pending" || prev === "saved" || prev === "save_failed" || prev === "skipped"
          ? prev
          : "capturing",
      );
      syncDebugFlags({
        headline: "Metrics received from camera",
        lines: ["Parent received metrics update"],
      });
    },
    [syncDebugFlags],
  );

  const markSkipped = useCallback(() => {
    skippedRef.current = true;
    latestMetricsRef.current = null;
    setCvStatus("skipped");
    syncDebugFlags({
      headline: "Camera skipped",
      lines: ["Continue without camera — no POST"],
      notSavedReason: "skipped",
    });
  }, [syncDebugFlags]);

  const registerMetricsFlush = useCallback(
    (flush: () => void) => {
      flushMetricsRef.current = flush;
      syncDebugFlags({
        lines: ["Flush callback registered from PatientCvCapture"],
      });
    },
    [syncDebugFlags],
  );

  const resetCapture = useCallback(() => {
    latestMetricsRef.current = null;
    hasSavedRef.current = false;
    saveInProgressRef.current = false;
    skippedRef.current = false;
    saveFlightRef.current = null;
    flushMetricsRef.current = null;
    setCvStatus("not_started");
    if (qaDebug) {
      setCvSaveDebug(createInitialCvSaveDebugState(planSessionId, exerciseId));
    }
  }, [qaDebug, planSessionId, exerciseId]);

  const saveCvMetrics = useCallback(async (): Promise<CvSaveResult> => {
    const finishNotSaved = (result: CvSaveResult, reason: string, lines: string[]) => {
      syncDebugFlags({
        headline: "CV not saved",
        lines,
        lastResult: result,
        notSavedReason: reason,
      });
      return result;
    };

    try {
      syncDebugFlags({
        headline: "CV save requested",
        lines: ["CV save requested (Complete exercise)"],
        lastResult: null,
        notEligibleReason: null,
        notSavedReason: null,
        postStatus: null,
        postMessage: null,
      });

      if (!isCvEligible) {
        return finishNotSaved("not_applicable", "not_applicable", [
          "CV not eligible: exercise is not sit-to-stand",
        ]);
      }

      syncDebugFlags({
        headline: "CV eligible",
        lines: ["CV eligible — sit-to-stand exercise"],
      });

      if (skippedRef.current) {
        return finishNotSaved("skipped", "skipped", [
          "CV not saved: skipped (Continue without camera)",
        ]);
      }

      if (hasSavedRef.current) {
        return finishNotSaved("already_saved", "already_saved", [
          "CV not saved: already_saved (duplicate guard)",
        ]);
      }

      if (saveFlightRef.current) {
        syncDebugFlags({ lines: ["Awaiting in-flight save…"] });
        return saveFlightRef.current;
      }

      flushMetricsRef.current?.();
      syncDebugFlags({ lines: ["Flush called before save"] });

      const metrics = latestMetricsRef.current;
      if (!metrics) {
        return finishNotSaved("no_metrics", "no_metrics", [
          "CV not saved: no_metrics (parent ref empty after flush)",
          "Hint: tracking may be stopped; metrics only flush while preview active",
        ]);
      }

      if (metrics.sessionDurationS < CV_MIN_SAVE_DURATION_S) {
        return finishNotSaved("too_short", "too_short", [
          `CV not saved: too_short (duration ${metrics.sessionDurationS}s < ${CV_MIN_SAVE_DURATION_S}s)`,
        ]);
      }

      const run = async (): Promise<CvSaveResult> => {
        saveInProgressRef.current = true;
        setCvStatus("save_pending");
        syncDebugFlags({
          headline: "CV POST started",
          lines: ["CV POST started → /api/patient/cv-session-metrics"],
        });

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
            let postMessage = res.statusText || "HTTP error";
            try {
              const errBody = (await res.json()) as { error?: string };
              if (errBody.error) postMessage = errBody.error;
            } catch {
              /* ignore */
            }
            setCvStatus("save_failed");
            syncDebugFlags({
              headline: "CV POST failed",
              lines: [`CV POST failed: ${res.status} ${postMessage}`],
              lastResult: "post_error",
              postStatus: res.status,
              postMessage,
            });
            return "post_error";
          }

          hasSavedRef.current = true;
          setCvStatus("saved");
          syncDebugFlags({
            headline: "CV POST success",
            lines: ["CV POST success — row should exist in cv_session_metrics"],
            lastResult: "saved",
            postStatus: res.status,
            postMessage: "OK",
          });
          return "saved";
        } catch (err) {
          const postMessage = err instanceof Error ? err.message : "network error";
          setCvStatus("save_failed");
          syncDebugFlags({
            headline: "CV POST failed",
            lines: [`CV POST failed: ${postMessage}`],
            lastResult: "post_error",
            postStatus: null,
            postMessage,
          });
          return "post_error";
        } finally {
          saveInProgressRef.current = false;
          syncDebugFlags();
        }
      };

      saveFlightRef.current = run();
      return await saveFlightRef.current;
    } catch (err) {
      const postMessage = err instanceof Error ? err.message : "unknown error";
      setCvStatus("save_failed");
      syncDebugFlags({
        headline: "CV POST failed",
        lines: [`CV save threw: ${postMessage}`],
        lastResult: "post_error",
        postMessage,
      });
      return "post_error";
    } finally {
      saveFlightRef.current = null;
      syncDebugFlags();
    }
  }, [isCvEligible, token, planSessionId, syncDebugFlags]);

  return {
    cvStatus,
    cvSaveDebug: qaDebug ? cvSaveDebug : null,
    isCvEligible,
    onMetricsUpdate,
    markSkipped,
    registerMetricsFlush,
    saveCvMetrics,
    resetCapture,
  };
}
