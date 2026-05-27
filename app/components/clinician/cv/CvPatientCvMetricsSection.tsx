"use client";

import { useCallback, useEffect, useState } from "react";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { CvReviewSummary } from "@/app/components/clinician/cv/CvReviewSummary";

const PATIENT_CV_FETCH_LIMIT = 20;
const PATIENT_CV_DISPLAY_MAX = 10;

type CvPatientCvMetricsSectionProps = {
  patientId: string;
};

export function CvPatientCvMetricsSection({ patientId }: CvPatientCvMetricsSectionProps) {
  const exerciseNameById = Object.fromEntries(
    getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
  );

  const [metrics, setMetrics] = useState<CvSessionMetricPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/cv/session-metrics?patientId=${encodeURIComponent(patientId)}&limit=${PATIENT_CV_FETCH_LIMIT}`,
      );
      if (!res.ok) {
        setError(true);
        setMetrics([]);
        return;
      }
      const data = (await res.json()) as { metrics?: CvSessionMetricPublic[] };
      setMetrics(data.metrics ?? []);
    } catch {
      setError(true);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const refresh = () => void fetchMetrics();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchMetrics]);

  if (loading || error || metrics.length === 0) {
    return null;
  }

  return (
    <CvReviewSummary
      metrics={metrics}
      exerciseNameById={exerciseNameById}
      variant="patient-profile"
      maxSessions={PATIENT_CV_DISPLAY_MAX}
    />
  );
}
