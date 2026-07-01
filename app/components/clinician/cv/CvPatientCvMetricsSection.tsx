"use client";

import { useMemo } from "react";
import { CvReviewSummary } from "@/app/components/clinician/cv/CvReviewSummary";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { useCvSessionMetrics } from "@/app/hooks/useCvSessionMetrics";

const PATIENT_CV_FETCH_LIMIT = 20;
const PATIENT_CV_DISPLAY_MAX = 10;

type CvPatientCvMetricsSectionProps = {
  patientId: string;
};

export function CvPatientCvMetricsSection({ patientId }: CvPatientCvMetricsSectionProps) {
  const exerciseNameById = useMemo(
    () =>
      Object.fromEntries(
        getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
      ),
    [],
  );

  const { metrics, loading, error } = useCvSessionMetrics({
    patientId,
    limit: PATIENT_CV_FETCH_LIMIT,
  });

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
