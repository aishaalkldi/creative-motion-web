"use client";

import { useMemo } from "react";
import { AssessmentCaptureReviewLayout } from "@/app/components/clinician/assessments/AssessmentCaptureReviewLayout";
import { AssessmentTimedCaptureSession } from "@/app/components/clinician/assessments/AssessmentTimedCaptureSession";
import { TIMED_UP_AND_GO_SHELL } from "@/app/lib/clinician/assessment-module-shells";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import { useCvSessionMetrics } from "@/app/hooks/useCvSessionMetrics";

const TUG_EXERCISE_ID = "timed-up-and-go";
const FETCH_LIMIT = 50;

const TUG_INSTRUCTIONS = [
  "Clear a safe path (~3 meters) for sit-to-stand, walk, turn, and return.",
  "Press start when the patient begins rising from the chair.",
  "Press stop when the patient is seated again.",
] as const;

export default function TimedUpAndGoAssessmentPage() {
  const exerciseNameById = useMemo(
    () => ({
      ...Object.fromEntries(
        getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
      ),
      [TUG_EXERCISE_ID]: "Timed Up and Go",
    }),
    [],
  );

  const { metrics, loading, error, refresh } = useCvSessionMetrics({
    limit: FETCH_LIMIT,
    exerciseIds: [TUG_EXERCISE_ID],
    dedupePatientSessions: false,
  });

  const hasPatientLinkedSessions = metrics.some((row) => Boolean(row.patientId));

  return (
    <AssessmentCaptureReviewLayout
      config={TIMED_UP_AND_GO_SHELL}
      metrics={metrics}
      loading={loading}
      error={error}
      exerciseNameById={exerciseNameById}
      hasPatientLinkedSessions={hasPatientLinkedSessions}
      captureSection={
        <AssessmentTimedCaptureSession
          title="Timed Up and Go"
          instructions={[...TUG_INSTRUCTIONS]}
          consentIntro="A manual timer records task duration for therapist review. No mobility impairment score is assigned."
          exerciseId={TUG_EXERCISE_ID}
          startButtonLabel="Start TUG timer"
          stopButtonLabel="Stop and save TUG time"
          onSessionSaved={() => void refresh()}
        />
      }
    />
  );
}
