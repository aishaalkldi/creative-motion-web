"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import {
  AssessmentCvCaptureSession,
  createGaitWalkingCaptureDetector,
} from "@/app/components/clinician/assessments/AssessmentCvCaptureSession";
import { CvReviewSummary } from "@/app/components/clinician/cv/CvReviewSummary";
import {
  GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES,
  isGaitAssessmentExerciseId,
} from "@/app/lib/cv/gait-assessment-exercise-ids";
import { useCvSessionMetrics } from "@/app/hooks/useCvSessionMetrics";

const FETCH_LIMIT = 50;
const DISPLAY_MAX = 10;

const GAIT_CAPTURE_INSTRUCTIONS = [
  "Frame the patient from the side or front with hips and legs visible.",
  "Ask the patient to walk in place or take a short bounded pass toward the camera.",
  "Stop after about 15–30 seconds — movement and duration are saved for review.",
] as const;

export default function GaitAssessmentPage() {
  const exerciseNameById = useMemo(
    () => ({ ...GAIT_ASSESSMENT_EXERCISE_DISPLAY_NAMES }),
    [],
  );

  const { metrics, loading, error, refresh } = useCvSessionMetrics({
    limit: FETCH_LIMIT,
    exerciseFilter: isGaitAssessmentExerciseId,
    dedupePatientSessions: false,
  });

  const createDetector = useCallback(
    (onSnapshot: Parameters<typeof createGaitWalkingCaptureDetector>[0]) =>
      createGaitWalkingCaptureDetector(onSnapshot),
    [],
  );

  const hasPatientLinkedSessions = metrics.some((row) => Boolean(row.patientId));
  const showGaitEmptyState = !loading && !error && metrics.length === 0;

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/clinician/assessments"
          className="inline-flex text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
        >
          ← Assessment Center
        </Link>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#1D9E75]">
          RASQ · Gait assessment
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Gait Assessment v1</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
          Camera-assisted walking observation for therapist review. Movement observations
          to support therapist review — not diagnostic gait analysis.
        </p>

        <div className="mt-5 rounded-[10px] border border-amber-400/20 bg-amber-400/5 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">
            Therapist review required
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            This module provides camera-assisted walking observation and movement observations
            to support therapist review. It is not diagnostic, does not classify walking
            patterns, and does not replace clinical examination.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-bold text-white">Capture walking observation</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/40">
            Run a bounded walking pass. Duration, movement, and optional step estimate are saved
            for therapist review below.
          </p>
          <div className="mt-4">
            <AssessmentCvCaptureSession
              title="Walking observation capture"
              instructions={[...GAIT_CAPTURE_INSTRUCTIONS]}
              primaryMetricLabel="Step estimate"
              consentIntro="Camera access is used for a short walking observation pass. No diagnostic gait classification is performed."
              createDetector={createDetector}
              onSessionSaved={() => void refresh()}
              startButtonLabel="Start walking observation"
            />
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/clinician/results"
            className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/60 transition hover:border-[#1D9E75]/25 hover:text-white"
          >
            Open Results queue
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-bold text-white">Recorded walking observations</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/40">
            Saved assessment movement sessions appear here after capture.
          </p>

          {loading ? (
            <p className="mt-4 text-xs text-[#6B7280]">Loading walking observations…</p>
          ) : error ? (
            <p className="mt-4 text-xs text-rose-300">
              Could not load walking observations. Try again later.
            </p>
          ) : showGaitEmptyState ? (
            <div className="mt-4 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-8 text-center">
              <p className="text-sm font-medium text-[#9CA3AF]">
                No gait observations have been captured yet
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                Use the capture section above to record a bounded walking pass for therapist
                review.
              </p>
            </div>
          ) : (
            <CvReviewSummary
              metrics={metrics}
              exerciseNameById={exerciseNameById}
              loading={false}
              error={false}
              showPatientLinks={hasPatientLinkedSessions}
              maxSessions={DISPLAY_MAX}
            />
          )}
        </section>

        <section className="mt-6 rounded-[10px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3.5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/35">
            Review guidance
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-white/45">
            <li>Use walking observations together with your clinical examination.</li>
            <li>Repeat capture when tracking quality or visibility is limited.</li>
            <li>Do not use this module alone for treatment or progression decisions.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
