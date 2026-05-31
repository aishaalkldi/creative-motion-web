"use client";

import type { PatientCvDerivedMetrics } from "@/app/lib/cv/bio-0-contracts";
import type { ResolvedExerciseView } from "@/app/lib/exercise-resolve";
import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { ExerciseMediaArea } from "@/app/components/patient/ExerciseMediaArea";
import {
  formatBodyRegionForPatient,
  formatExerciseProgress,
  sessionExerciseFlowUi,
  sessionExerciseUi,
} from "@/app/lib/patient-portal-ui";

export type ExerciseCardStep = "preview" | "active" | "done";

type PatientExerciseSessionCardProps = {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "rtl" | "ltr";
  isArabic: boolean;
  exerciseIndex: number;
  totalExercises: number;
  view: ResolvedExerciseView;
  step: ExerciseCardStep;
  setsCompleted: number;
  onStartExercise: () => void;
  onCompleteSet: () => void;
  onCompleteExercise: () => void | Promise<void>;
  onCvMetricsUpdate?: (metrics: PatientCvDerivedMetrics) => void;
  onCvSkipped?: () => void;
  onRegisterCvMetricsFlush?: (flush: () => void) => void;
  onRegisterCvMotionSummaryProvider?: (
    provider: () => import("@/app/lib/cv/motion-evidence.types").SessionMotionEvidenceSummary | null,
  ) => void;
};

function DoseTile({
  label,
  value,
  isArabic,
}: {
  label: string;
  value: string;
  isArabic: boolean;
}) {
  return (
    <div
      className={`rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-2.5 ${
        isArabic ? "text-right" : "text-left"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </p>
      <p
        className="mt-0.5 text-[15px] font-bold text-[#0A0F1A]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}

export function PatientExerciseSessionCard({
  lang,
  arClass,
  textDir,
  isArabic,
  exerciseIndex,
  totalExercises,
  view,
  step,
  setsCompleted,
  onStartExercise,
  onCompleteSet,
  onCompleteExercise,
  onCvMetricsUpdate,
  onCvSkipped,
  onRegisterCvMetricsFlush,
  onRegisterCvMotionSummaryProvider,
}: PatientExerciseSessionCardProps) {
  const flowUi = sessionExerciseFlowUi(lang);
  const cardUi = sessionExerciseUi(lang);
  const libraryEntry = getLibraryExerciseById(view.exerciseId);
  const bodyRegion = formatBodyRegionForPatient(lang, libraryEntry?.bodyRegion);

  const hasSets = view.sets != null && view.sets > 0;
  const totalSets = view.sets ?? 0;
  const canCompleteSet =
    step === "active" && hasSets && setsCompleted < totalSets;
  const allSetsDone =
    !hasSets || (hasSets && setsCompleted >= totalSets);

  const doseValue = (v: number | string | undefined) =>
    v != null && String(v).trim() !== "" ? String(v) : flowUi.doseNotSet;

  const durationDisplay =
    view.durationSec != null
      ? flowUi.durationSeconds(view.durationSec)
      : flowUi.doseNotSet;

  const restDisplay =
    view.restSec != null && view.restSec > 0
      ? flowUi.restSeconds(view.restSec)
      : flowUi.doseNotSet;

  return (
    <div
      className={`space-y-4 ${arClass}`}
      dir={textDir}
      lang={lang}
    >
      <p className="text-center text-[12px] font-semibold text-[#1D9E75]">
        {formatExerciseProgress(lang, exerciseIndex + 1, totalExercises)}
      </p>

      <div className="overflow-hidden rounded-[10px] border border-[#E2E8E5] bg-white">
        <ExerciseMediaArea
          exerciseId={view.exerciseId}
          exerciseName={view.name}
          bodyRegion={libraryEntry?.bodyRegion}
          mediaUrl={null}
          thumbnailUrl={null}
          language={lang}
          arClass={arClass}
          textDir={textDir}
          exerciseStep={step}
          onCvMetricsUpdate={onCvMetricsUpdate}
          onCvSkipped={onCvSkipped}
          onRegisterCvMetricsFlush={onRegisterCvMetricsFlush}
          onRegisterCvMotionSummaryProvider={onRegisterCvMotionSummaryProvider}
        />

        <div className="space-y-4 p-5">
          <div>
            <h2
              className={`text-[18px] font-bold text-[#0A0F1A] ${arClass}`}
              style={{
                fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)",
              }}
            >
              {view.name}
            </h2>
            {bodyRegion && (
              <p className={`mt-1 text-[12px] text-[#6B7280] ${arClass}`}>
                <span className="font-semibold text-[#374151]">
                  {flowUi.bodyRegionLabel}:{" "}
                </span>
                {bodyRegion}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DoseTile
              label={flowUi.doseSets}
              value={doseValue(view.sets)}
              isArabic={isArabic}
            />
            <DoseTile
              label={flowUi.doseReps}
              value={doseValue(view.reps)}
              isArabic={isArabic}
            />
            <DoseTile
              label={flowUi.doseDuration}
              value={durationDisplay}
              isArabic={isArabic}
            />
            <DoseTile
              label={flowUi.doseRest}
              value={restDisplay}
              isArabic={isArabic}
            />
          </div>

          {view.doseLabel && (
            <p
              className={`text-[12px] font-semibold text-[#1D9E75] ${arClass}`}
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {view.doseLabel}
            </p>
          )}

          <div className="rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3.5 py-3">
            <p className={`text-[12px] leading-relaxed text-[#374151] ${arClass}`}>
              {view.patientInstructions}
            </p>
          </div>

          <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className={`text-[12px] leading-relaxed text-amber-900 ${arClass}`}>
              <span className="font-semibold">{cardUi.stopIf} </span>
              {view.precautions}
            </p>
          </div>

          {view.clinicianNote && (
            <p
              className={`rounded-[7px] border border-[#D1E7DE] bg-[#F0FAF6] px-3 py-2.5 text-[12px] leading-relaxed text-[#374151] ${arClass}`}
            >
              <span className="font-semibold text-[#0A0F1A]">
                {cardUi.therapistNote}{" "}
              </span>
              {view.clinicianNote}
            </p>
          )}

          <p className={`text-[11px] text-[#9CA3AF] ${arClass}`}>
            {flowUi.followTherapistPlan} · {flowUi.stopSharpPain}
          </p>
        </div>
      </div>

      {step === "preview" && (
        <button
          type="button"
          onClick={onStartExercise}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
        >
          {flowUi.startThisExercise}
        </button>
      )}

      {step === "active" && (
        <div className="space-y-3">
          <p
            className={`text-center text-[12px] font-semibold text-[#1D9E75] ${arClass}`}
          >
            {flowUi.inProgressLabel}
          </p>
          {hasSets && (
            <p className={`text-center text-[13px] text-[#374151] ${arClass}`}>
              {flowUi.setProgress(setsCompleted, totalSets)}
            </p>
          )}
          <p className={`text-center text-[12px] text-[#6B7280] ${arClass}`}>
            {flowUi.takeYourTime}
            {hasSets ? ` · ${flowUi.restBetweenSets}` : ""}
          </p>
          <div className={`flex flex-col gap-2 sm:flex-row ${isArabic ? "sm:flex-row-reverse" : ""}`}>
            {canCompleteSet && (
              <button
                type="button"
                onClick={onCompleteSet}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-[7px] border border-[#1D9E75] bg-white text-[15px] font-semibold text-[#1D9E75] transition hover:bg-[#F0FAF6]"
              >
                {flowUi.completeSet}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onCompleteExercise()}
              disabled={!allSetsDone}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {flowUi.completeExercise}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-4 text-center">
          <p
            className={`text-[15px] font-semibold text-[#0A0F1A] ${arClass}`}
          >
            {flowUi.exerciseCompleteTitle}
          </p>
          <p className={`mt-2 text-[13px] leading-relaxed text-[#374151] ${arClass}`}>
            {flowUi.exerciseCompleteBody}
          </p>
        </div>
      )}
    </div>
  );
}

export function PatientSessionProgressStrip({
  lang,
  exerciseIndex,
  total,
}: {
  lang: PatientExerciseLanguage;
  exerciseIndex: number;
  total: number;
}) {
  const flowUi = sessionExerciseFlowUi(lang);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
          {flowUi.sessionProgressLabel}
        </p>
        <p className="text-[12px] font-semibold text-[#374151]">
          {formatExerciseProgress(lang, exerciseIndex + 1, total)}
        </p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i < exerciseIndex
                ? "bg-[#1D9E75]"
                : i === exerciseIndex
                  ? "bg-[#1D9E75]/60"
                  : "bg-[#E2E8E5]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
