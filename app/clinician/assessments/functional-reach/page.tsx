"use client";

import { useCallback, useMemo } from "react";
import { AssessmentCaptureReviewLayout } from "@/app/components/clinician/assessments/AssessmentCaptureReviewLayout";
import {
  AssessmentCvCaptureSession,
  createFunctionalReachCaptureDetector,
  mapFunctionalReachStartError,
} from "@/app/components/clinician/assessments/AssessmentCvCaptureSession";
import { FUNCTIONAL_REACH_SHELL } from "@/app/lib/clinician/assessment-module-shells";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { useCvSessionMetrics } from "@/app/hooks/useCvSessionMetrics";

const FR_EXERCISE_ID = "functional-reach";
const FETCH_LIMIT = 50;

const FR_INSTRUCTIONS = [
  "Frame the patient from the side with shoulder, arm, and trunk visible.",
  "Ask the patient to reach forward from a stable standing position and return.",
  "Repeat several reaches, then stop and save the observation.",
] as const;

export default function FunctionalReachAssessmentPage() {
  const exerciseNameById = useMemo(
    () =>
      Object.fromEntries(
        getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
      ),
    [],
  );

  const { metrics, loading, error, refresh } = useCvSessionMetrics({
    limit: FETCH_LIMIT,
    exerciseIds: [FR_EXERCISE_ID],
    dedupePatientSessions: false,
  });

  const createDetector = useCallback(
    (onSnapshot: Parameters<typeof createFunctionalReachCaptureDetector>[0]) =>
      createFunctionalReachCaptureDetector(onSnapshot),
    [],
  );

  const hasPatientLinkedSessions = metrics.some((row) => Boolean(row.patientId));

  return (
    <AssessmentCaptureReviewLayout
      config={FUNCTIONAL_REACH_SHELL}
      metrics={metrics}
      loading={loading}
      error={error}
      exerciseNameById={exerciseNameById}
      hasPatientLinkedSessions={hasPatientLinkedSessions}
      captureSection={
        <AssessmentCvCaptureSession
          title="Functional reach capture"
          instructions={[...FR_INSTRUCTIONS]}
          primaryMetricLabel="Reach cycles"
          consentIntro="Camera access is used to observe forward reach attempts. No validated reach score is assigned."
          createDetector={createDetector}
          onSessionSaved={() => void refresh()}
          startButtonLabel="Start reach observation"
          durationLabel="Task duration"
          mapStartError={mapFunctionalReachStartError}
        />
      }
    />
  );
}
