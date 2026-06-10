"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { ResolvedExerciseView } from "@/app/lib/exercise-resolve";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  formatExerciseProgress,
  guidedSessionUi,
  sessionExerciseFlowUi,
} from "@/app/lib/patient-portal-ui";
import { PatientSessionProgressStrip } from "@/app/components/patient/PatientExerciseSessionCard";

const CARD_SHADOW = "shadow-[0_8px_30px_rgba(10,15,26,0.06)]";

type ShellProps = {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  token: string;
  sessionTitle: string;
  children: ReactNode;
  exerciseIndex?: number;
  totalExercises?: number;
  showProgress?: boolean;
};

export function GuidedSessionShell({
  lang,
  arClass,
  textDir,
  token,
  sessionTitle,
  children,
  exerciseIndex,
  totalExercises,
  showProgress = false,
}: ShellProps) {
  const ui = guidedSessionUi(lang);

  return (
    <div className={`space-y-5 ${arClass}`} dir={textDir} lang={lang}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/patient/${token}`}
          className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
        >
          {ui.backToDashboard}
        </Link>
      </div>

      <div>
        <h1
          className="text-[20px] font-bold leading-snug text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {sessionTitle}
        </h1>
      </div>

      {showProgress &&
        exerciseIndex != null &&
        totalExercises != null &&
        totalExercises > 0 && (
          <PatientSessionProgressStrip
            lang={lang}
            exerciseIndex={exerciseIndex}
            total={totalExercises}
          />
        )}

      {children}
    </div>
  );
}

export function GuidedSessionStartScreen({
  lang,
  arClass,
  textDir,
  sessionTitle,
  totalExercises,
  firstExerciseName,
  onBegin,
}: {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  sessionTitle: string;
  totalExercises: number;
  firstExerciseName: string;
  onBegin: () => void;
}) {
  const ui = guidedSessionUi(lang);
  const flowUi = sessionExerciseFlowUi(lang);

  return (
    <div className={`space-y-5 ${arClass}`} dir={textDir}>
      <section
        className={`-mx-2 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#071612] via-[#0C3D32] to-[#1D9E75] px-6 py-8 text-white ${CARD_SHADOW}`}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
          {ui.startEyebrow}
        </p>
        <h2
          className="mt-3 text-[26px] font-bold leading-tight"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {ui.startTitle(sessionTitle)}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/85">{ui.startSubtitle}</p>
        <p className="mt-4 text-[13px] font-semibold text-[#B8F5DF]">
          {ui.exercisesReady(totalExercises)}
        </p>
      </section>

      <section className={`rounded-[20px] border border-[#E2E8E5] bg-white p-5 ${CARD_SHADOW}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
          {ui.firstUpLabel}
        </p>
        <p className="mt-2 text-[18px] font-bold text-[#0A0F1A]">{firstExerciseName}</p>
        <p className="mt-3 text-[13px] text-[#6B7280]">{flowUi.sessionOverviewBody}</p>
      </section>

      <p className="text-center text-[12px] text-[#6B7280]">{ui.safetyReminder}</p>

      <button
        type="button"
        onClick={onBegin}
        className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#1D9E75] text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(29,158,117,0.35)] transition hover:bg-[#179165] active:scale-[0.99]"
      >
        {ui.beginSession}
      </button>
    </div>
  );
}

export function GuidedSessionRestScreen({
  lang,
  arClass,
  textDir,
  restSeconds,
  nextExerciseName,
  nextExerciseIndex,
  totalExercises,
  onContinue,
}: {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  restSeconds: number | null;
  nextExerciseName: string;
  nextExerciseIndex: number;
  totalExercises: number;
  onContinue: () => void;
}) {
  const ui = guidedSessionUi(lang);

  return (
    <div className={`space-y-5 ${arClass}`} dir={textDir}>
      <section
        className={`rounded-[24px] border border-[#D1E7DE] bg-gradient-to-br from-[#F0FAF6] to-white p-6 text-center ${CARD_SHADOW}`}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8F2] text-[28px]"
          aria-hidden
        >
          ☕
        </div>
        <h2
          className="mt-4 text-[22px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {ui.restTitle}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">{ui.restSubtitle}</p>
        <p className="mt-3 text-[13px] font-semibold text-[#1D9E75]">
          {restSeconds != null && restSeconds > 0
            ? ui.restRecommended(restSeconds)
            : ui.restDefaultHint}
        </p>
      </section>

      <section className={`rounded-[20px] border border-[#E2E8E5] bg-white p-5 ${CARD_SHADOW}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
          {ui.nextExercisePreview}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-[#1D9E75]">
          {formatExerciseProgress(lang, nextExerciseIndex + 1, totalExercises)}
        </p>
        <p className="mt-2 text-[18px] font-bold text-[#0A0F1A]">{nextExerciseName}</p>
      </section>

      <button
        type="button"
        onClick={onContinue}
        className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#1D9E75] text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(29,158,117,0.35)] transition hover:bg-[#179165]"
      >
        {ui.continueToNext}
      </button>
    </div>
  );
}

export function GuidedSessionExerciseProgressLabel({
  lang,
  exerciseIndex,
  total,
}: {
  lang: PatientExerciseLanguage;
  exerciseIndex: number;
  total: number;
}) {
  return (
    <div className="rounded-[14px] bg-[#0A0F1A] px-4 py-2.5 text-center">
      <p className="text-[13px] font-bold tracking-wide text-white">
        {formatExerciseProgress(lang, exerciseIndex + 1, total)}
      </p>
    </div>
  );
}

export function GuidedSessionCompleteScreen({
  lang,
  arClass,
  textDir,
  token,
  sessionTitle,
  exercisesCompleted,
  effortScore,
  painAfter,
  effortLabel,
  painLabel,
  onViewProgress,
}: {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  token: string;
  sessionTitle: string;
  exercisesCompleted: number;
  effortScore: number;
  painAfter: number;
  effortLabel: string;
  painLabel: string;
  onViewProgress?: boolean;
}) {
  const ui = guidedSessionUi(lang);
  const shellUi = guidedSessionUi(lang);

  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-5 px-2 text-center ${arClass}`}
      dir={textDir}
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#E8F8F2] to-[#B8F5DF] text-[32px] text-[#1D9E75] shadow-[0_8px_24px_rgba(29,158,117,0.2)]"
        aria-hidden
      >
        ✓
      </div>
      <div>
        <h2
          className="text-[26px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {ui.sessionCompleteTitle}
        </h2>
        <p className="mt-2 text-[16px] font-semibold text-[#374151]">{sessionTitle}</p>
        <p className="mt-3 text-[15px] text-[#6B7280]">{ui.greatWork}</p>
        <p className="mt-2 text-[14px] text-[#374151]">{ui.sessionCompleteBody}</p>
        <p className="mt-3 text-[14px] font-medium text-[#1D9E75]">
          {exercisesCompleted}{" "}
          {lang === "ar" ? "تمارين مكتملة" : `exercise${exercisesCompleted === 1 ? "" : "s"} completed`}
        </p>
        <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3">
          <div className="rounded-[14px] border border-[#E2E8E5] bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              {effortLabel}
            </p>
            <p className="mt-1 text-[18px] font-bold text-[#1D9E75]">{effortScore}/10</p>
          </div>
          <div className="rounded-[14px] border border-[#E2E8E5] bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              {painLabel}
            </p>
            <p className="mt-1 text-[18px] font-bold text-[#1D9E75]">{painAfter}/10</p>
          </div>
        </div>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href={`/patient/${token}`}
          className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-[#1D9E75] text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(29,158,117,0.35)] transition hover:bg-[#179165]"
        >
          {shellUi.backToDashboard}
        </Link>
        {onViewProgress !== false && (
          <Link
            href={`/patient/${token}/progress`}
            className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-[#E2E8E5] bg-white text-[15px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            {lang === "ar" ? "عرض التقدّم" : "View progress"}
          </Link>
        )}
      </div>
    </div>
  );
}

export function GuidedSessionAlreadyCompleteScreen({
  lang,
  arClass,
  textDir,
  token,
  sessionTitle,
  totalExercises,
  completedLabel,
}: {
  lang: PatientExerciseLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  token: string;
  sessionTitle: string;
  totalExercises: number;
  completedLabel: string | null;
}) {
  const ui = guidedSessionUi(lang);

  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center ${arClass}`}
      dir={textDir}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5F1] text-[28px] text-[#1D9E75]">
        ✓
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-[#0A0F1A]">{ui.sessionCompleteTitle}</h2>
        <p className="mt-2 text-[16px] font-semibold text-[#374151]">{sessionTitle}</p>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          {totalExercises}{" "}
          {lang === "ar" ? "تمارين في هذه الجلسة" : `exercises in this session`}
          {completedLabel ? ` · ${completedLabel}` : ""}
        </p>
      </div>
      <Link
        href={`/patient/${token}`}
        className="flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-[14px] bg-[#1D9E75] text-[16px] font-bold text-white"
      >
        {ui.backToDashboard}
      </Link>
    </div>
  );
}

export type { ResolvedExerciseView };
