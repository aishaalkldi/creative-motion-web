"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PatientSession } from "@/app/api/patient/plan/route";
import type { SessionCompleteResponse } from "@/app/api/patient/session-complete/route";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { encodeSessionCoachNotes } from "@/app/lib/session-coach-metadata";
import {
  resolveExerciseView,
} from "@/app/lib/exercise-resolve";
import {
  PatientPreSessionMotivation,
  PatientSessionCompletionMotivation,
} from "@/app/components/patient/PatientMotivationCards";
import {
  PatientExerciseSessionCard,
  PatientSessionProgressStrip,
  type ExerciseCardStep,
} from "@/app/components/patient/PatientExerciseSessionCard";
import {
  planHomeUi,
  resolveSessionFocusPurpose,
  sessionExerciseFlowUi,
  sessionExerciseUi,
  sessionFocusUi,
  sessionShellUi,
} from "@/app/lib/patient-portal-ui";

type SessionPhase = "precheck" | "overview" | "exercise" | "wrapup";

function PainScale({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  min?: number;
}) {
  const options = Array.from({ length: 11 - min }, (_, i) => i + min);
  return (
    <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
      <p className="mb-3 text-[13px] font-semibold text-[#374151]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex h-[44px] min-w-[40px] flex-1 items-center justify-center rounded-[7px] border text-[13px] font-semibold transition ${
              value === n
                ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                : "border-[#E2E8E5] bg-[#F4F6F5] text-[#374151] hover:border-[#1D9E75]/40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function SessionPlayerPage() {
  const params    = useParams();
  const token     = String(params.token ?? "");
  const sessionId = String(params.sessionId ?? "");

  const [session,             setSession]             = useState<PatientSession | null>(null);
  const [notFound,            setNotFound]            = useState(false);
  const [patientName,         setPatientName]         = useState("");
  const { plan, isPlanLoading } = usePatientPlan();
  const { language: patientLanguage, isArabic, textDir, arClass } = usePatientLanguage();
  const [phase,               setPhase]               = useState<SessionPhase>("precheck");
  const [exerciseStep,        setExerciseStep]        = useState<ExerciseCardStep>("preview");
  const [setsCompleted,       setSetsCompleted]       = useState(0);
  const [painBefore,          setPainBefore]          = useState<number | null>(null);
  const [safetyConcern,       setSafetyConcern]       = useState<boolean | null>(null);
  const [safetyAcknowledged,  setSafetyAcknowledged]  = useState(false);
  const [exerciseIndex,       setExerciseIndex]       = useState(0);
  const [effortScore,         setEffortScore]         = useState<number | null>(null);
  const [painAfter,           setPainAfter]           = useState<number | null>(null);
  const [patientNote,         setPatientNote]         = useState("");
  const [completing,          setCompleting]          = useState(false);
  const [completeError,       setCompleteError]       = useState("");
  const [completed,           setCompleted]           = useState(false);
  const [completionSummary,   setCompletionSummary]   = useState<{
    effortScore: number;
    painAfter: number;
    exercisesCompleted: number;
  } | null>(null);

  useEffect(() => {
    setPhase("precheck");
    setExerciseStep("preview");
    setSetsCompleted(0);
    setPainBefore(null);
    setSafetyConcern(null);
    setSafetyAcknowledged(false);
    setExerciseIndex(0);
    setEffortScore(null);
    setPainAfter(null);
    setPatientNote("");
    setCompleted(false);
    setCompletionSummary(null);
    setCompleteError("");
    setCompleting(false);
  }, [token, sessionId]);

  useEffect(() => {
    if (!token || isPlanLoading) return;
    if (plan === null) {
      setNotFound(true);
      return;
    }
    if (!plan) return;

    const s = plan.sessions.find((x) => x.id === sessionId);
    if (!s) {
      setNotFound(true);
      return;
    }
    setSession(s);
    setPatientName(plan.patientName ?? "");
    setNotFound(false);
  }, [token, sessionId, plan, isPlanLoading]);

  if (notFound) {
    const shellUi = sessionShellUi(patientLanguage);
    return (
      <div className={`flex min-h-[50vh] items-center justify-center ${arClass}`} dir={textDir}>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#374151]">{shellUi.sessionNotFound}</p>
          <Link
            href={`/patient/${token}`}
            className="mt-4 inline-block text-[13px] font-semibold text-[#1D9E75]"
          >
            {shellUi.backToPlan}
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className={`text-[13px] text-[#9CA3AF] ${arClass}`}>{planHomeUi(patientLanguage).loading}</p>
      </div>
    );
  }

  const exercises = session.exercises;
  const total     = exercises.length;
  const isLast    = exerciseIndex === total - 1;
  const current   = exercises[exerciseIndex];
  const exerciseUi = sessionExerciseUi(patientLanguage);
  const flowUi = sessionExerciseFlowUi(patientLanguage);
  const shellUi = sessionShellUi(patientLanguage);
  const focusUi = sessionFocusUi(patientLanguage);
  const currentView = current
    ? resolveExerciseView(current, { language: patientLanguage })
    : null;
  const todaysGoal = shellUi.todaysGoal(session.title);
  const sessionFocusPurpose = resolveSessionFocusPurpose(
    session.title,
    plan?.patientFriendlyGoal,
  );

  const precheckReady =
    painBefore !== null &&
    safetyConcern !== null &&
    (safetyConcern === false || safetyAcknowledged);

  function handleBeginExercises() {
    setExerciseIndex(0);
    setExerciseStep("preview");
    setSetsCompleted(0);
    setPhase("exercise");
  }

  function handleStartExercise() {
    setExerciseStep("active");
    setSetsCompleted(0);
  }

  function handleCompleteSet() {
    const maxSets = currentView?.sets ?? 0;
    if (maxSets > 0) {
      setSetsCompleted((n) => Math.min(n + 1, maxSets));
    }
  }

  function handleCompleteExercise() {
    setExerciseStep("done");
  }

  function handleNextExercise() {
    if (!isLast) {
      setExerciseIndex((i) => i + 1);
      setExerciseStep("preview");
      setSetsCompleted(0);
      return;
    }
    setPhase("wrapup");
  }

  async function handleSubmitSession() {
    if (effortScore === null || painAfter === null) return;
    if (completing || completed) return;

    setCompleting(true);
    setCompleteError("");

    const notes = encodeSessionCoachNotes({
      painBefore,
      safetyConcern: safetyConcern === true,
      patientNote: patientNote.trim() || null,
    });

    try {
      const res = await fetch("/api/patient/session-complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sessionId,
          effortScore,
          painScore: painAfter,
          exercisesCompleted: total,
          notes,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as SessionCompleteResponse & { error?: string };

      if (!res.ok) {
        throw new Error(body.error ?? `Session could not be saved (${res.status}). Please try again.`);
      }

      setCompleted(true);
      setCompletionSummary({
        effortScore,
        painAfter,
        exercisesCompleted: total,
      });
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : shellUi.saveError);
      setCompleting(false);
    }
  }

  /* Already completed — avoid confusing re-run */
  if (session.status === "completed" && !completed) {
    const completedLabel = session.completedAt
      ? new Date(session.completedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center ${arClass}`} dir={textDir}>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5F1] text-[24px] text-[#1D9E75]"
          aria-hidden
        >
          ✓
        </div>
        <div>
          <h2
            className="text-[20px] font-medium text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {shellUi.alreadyCompleted}
          </h2>
          <p className="mt-2 text-[15px] font-semibold text-[#374151]">{session.title}</p>
          <p className="mt-2 text-[14px] text-[#6B7280]">
            {shellUi.finishedExercisesInSession(total)}
            {completedLabel ? shellUi.completedOn(completedLabel) : ""}
          </p>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#6B7280]">
            {shellUi.noRepeatNeeded}
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Link
            href={`/patient/${token}`}
            className="flex min-h-[48px] items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
          >
            {shellUi.backToMyPlan}
          </Link>
          <Link
            href={`/patient/${token}/progress`}
            className="flex min-h-[44px] items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            {shellUi.viewProgress}
          </Link>
        </div>
      </div>
    );
  }

  /* Completion screen */
  if (completed && completionSummary) {
    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center ${arClass}`} dir={textDir}>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5F1] text-[24px] text-[#1D9E75]"
          aria-hidden
        >
          ✓
        </div>
        <div>
          <h2
            className="text-[20px] font-medium text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {shellUi.sessionComplete}
          </h2>
          <p className="mt-2 text-[15px] font-semibold text-[#374151]">{session.title}</p>
          <div className="mt-3">
            <PatientSessionCompletionMotivation
              lang={patientLanguage}
              arClass={arClass}
              textDir={textDir}
            />
          </div>
          <p className="mt-3 text-[14px] text-[#374151]">
            {shellUi.exercisesCompleted(completionSummary.exercisesCompleted)}
          </p>
          <div className={`mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2 ${isArabic ? "text-right" : "text-left"}`}>
            <div className="rounded-[8px] border border-[#E2E8E5] bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">{shellUi.effort}</p>
              <p className="mt-0.5 text-[16px] font-bold text-[#1D9E75]">
                {completionSummary.effortScore}/10
              </p>
            </div>
            <div className="rounded-[8px] border border-[#E2E8E5] bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">{shellUi.painAfterLabel}</p>
              <p className="mt-0.5 text-[16px] font-bold text-[#1D9E75]">
                {completionSummary.painAfter}/10
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-[#374151]">
            {shellUi.sessionSavedForReview}
          </p>
          <p className="mt-3 max-w-sm text-[12px] italic leading-relaxed text-[#6B7280]">
            {shellUi.completionSafetyNote}
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Link
            href={`/patient/${token}`}
            className="flex min-h-[48px] items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
          >
            {shellUi.backToMyPlan}
          </Link>
          <Link
            href={`/patient/${token}/progress`}
            className="flex min-h-[44px] items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            {shellUi.viewProgress}
          </Link>
        </div>
      </div>
    );
  }

  /* Completion screen (fallback if summary missing) */
  if (completed) {
    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center ${arClass}`} dir={textDir}>
        <div>
          <h2
            className="text-[20px] font-medium text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {shellUi.sessionComplete}
          </h2>
          <p className="mt-2 text-[14px] text-[#374151]">{shellUi.sessionSavedForReview}</p>
        </div>
        <Link
          href={`/patient/${token}`}
          className="mt-2 flex min-h-[44px] items-center rounded-[7px] border border-[#E2E8E5] bg-transparent px-6 text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
        >
          {shellUi.backToMyPlan}
        </Link>
      </div>
    );
  }

  /* Pre-session guided check */
  if (phase === "precheck") {
    return (
      <div className={`space-y-6 ${arClass}`} dir={textDir} lang={patientLanguage}>
        <div>
          <Link
            href={`/patient/${token}`}
            className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
          >
            {shellUi.backToPlan}
          </Link>
          <h1
            className="mt-2 text-[18px] font-bold text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {session.title}
          </h1>
        </div>

        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D9E75]">
            {shellUi.todaysRehabGoal}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{todaysGoal}</p>
        </div>

        <PatientPreSessionMotivation
          lang={patientLanguage}
          arClass={arClass}
          textDir={textDir}
        />

        <PainScale
          label={shellUi.painBefore}
          value={painBefore}
          onChange={setPainBefore}
        />

        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-3 text-[13px] font-semibold text-[#374151]">
            {shellUi.safetyQuestion}
          </p>
          <div className="flex gap-3">
            {([
              { label: shellUi.no, value: false },
              { label: shellUi.yes, value: true },
            ] as const).map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSafetyConcern(value);
                  if (!value) setSafetyAcknowledged(false);
                }}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-[7px] border text-[14px] font-semibold transition ${
                  safetyConcern === value
                    ? value
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-[#1D9E75] bg-[#1D9E75] text-white"
                    : "border-[#E2E8E5] bg-[#F4F6F5] text-[#374151] hover:border-[#1D9E75]/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {safetyConcern === true && (
          <div className="space-y-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-4">
            <p className="text-[13px] font-semibold text-amber-900">
              {shellUi.safetyStopTitle}
            </p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={safetyAcknowledged}
                onChange={(e) => setSafetyAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600"
              />
              <span className="text-[13px] leading-relaxed text-amber-900">
                {shellUi.safetyAcknowledge}
              </span>
            </label>
          </div>
        )}

        <p className="text-center text-[12px] leading-relaxed text-[#6B7280]">
          {shellUi.therapistReviewNote}
        </p>

        <button
          type="button"
          onClick={() => {
            if (!precheckReady) return;
            setPhase("overview");
          }}
          disabled={!precheckReady}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {shellUi.startSession}
        </button>
      </div>
    );
  }

  const sessionHeader = (
    <div>
      <Link
        href={`/patient/${token}`}
        className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
      >
        {shellUi.backToPlan}
      </Link>
      <h1
        className="mt-2 text-[18px] font-bold text-[#0A0F1A]"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
      >
        {session.title}
      </h1>
    </div>
  );

  /* Session overview */
  if (phase === "overview") {
    return (
      <div className={`space-y-6 ${arClass}`} dir={textDir} lang={patientLanguage}>
        {sessionHeader}
        <PatientSessionProgressStrip
          lang={patientLanguage}
          exerciseIndex={0}
          total={total}
        />
        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D9E75]">
            {flowUi.sessionOverviewTitle}
          </p>
          <p className={`mt-2 text-[14px] leading-relaxed text-[#374151] ${arClass}`}>
            {flowUi.sessionOverviewBody}
          </p>
          <p className={`mt-3 text-[13px] font-semibold text-[#0A0F1A] ${arClass}`}>
            {flowUi.exercisesInSession(total)}
          </p>
        </div>
        <ul className="space-y-2">
          {exercises.map((ex, i) => {
            const v = resolveExerciseView(ex, { language: patientLanguage });
            return (
              <li
                key={ex.exerciseId + i}
                className="rounded-[8px] border border-[#E2E8E5] bg-white px-3.5 py-2.5 text-[13px] text-[#374151]"
              >
                <span className="font-semibold text-[#9CA3AF]">{i + 1}. </span>
                {v.name}
              </li>
            );
          })}
        </ul>
        <p className={`text-center text-[12px] text-[#6B7280] ${arClass}`}>
          {flowUi.therapistCanReview}
        </p>
        <button
          type="button"
          onClick={handleBeginExercises}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
        >
          {flowUi.beginExercises}
        </button>
      </div>
    );
  }

  /* Post-exercise session wrap-up */
  if (phase === "wrapup") {
    return (
      <div className={`space-y-6 ${arClass}`} dir={textDir} lang={patientLanguage}>
        {sessionHeader}
        <PatientSessionProgressStrip
          lang={patientLanguage}
          exerciseIndex={total - 1}
          total={total}
        />
        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-4 text-center">
          <p className={`text-[15px] font-semibold text-[#0A0F1A] ${arClass}`}>
            {flowUi.sessionWrapUpTitle}
          </p>
          <p className={`mt-2 text-[13px] text-[#374151] ${arClass}`}>
            {flowUi.takeYourTime} · {flowUi.followTherapistPlan}
          </p>
        </div>
        <p className="text-center text-[12px] text-[#1D9E75]">
          {shellUi.finalExerciseHint}
        </p>
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-3 text-[13px] font-semibold text-[#374151]">
            {shellUi.effortQuestion}
          </p>
          <div className="flex gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEffortScore(n)}
                className={`flex h-[44px] flex-1 items-center justify-center rounded-[7px] border text-[13px] font-semibold transition ${
                  effortScore === n
                    ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                    : "border-[#E2E8E5] bg-[#F4F6F5] text-[#374151] hover:border-[#1D9E75]/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <PainScale
          label={shellUi.painAfter}
          value={painAfter}
          onChange={setPainAfter}
        />
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <label
            htmlFor="patient-note"
            className="mb-2 block text-[13px] font-semibold text-[#374151]"
          >
            {shellUi.optionalNoteLabel}
          </label>
          <textarea
            id="patient-note"
            value={patientNote}
            onChange={(e) => setPatientNote(e.target.value)}
            rows={3}
            placeholder={shellUi.optionalNotePlaceholder}
            className="w-full resize-none rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-2.5 text-[14px] text-[#374151] placeholder:text-[#9CA3AF] focus:border-[#1D9E75]/50 focus:outline-none"
          />
        </div>
        {completeError && (
          <div className="rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-[13px] text-rose-600">{completeError}</p>
          </div>
        )}
        {(effortScore === null || painAfter === null) && (
          <p className="text-center text-[12px] text-[#6B7280]">
            {shellUi.finishHint}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmitSession}
          disabled={(effortScore === null || painAfter === null) || completing}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {completing ? shellUi.saving : shellUi.completeSession}
        </button>
      </div>
    );
  }

  /* Active exercise flow */
  if (!currentView) {
    return (
      <div className={`space-y-6 ${arClass}`} dir={textDir}>
        {sessionHeader}
        <p className="text-[13px] text-[#374151]">{exerciseUi.exerciseFallback}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${arClass}`} dir={textDir} lang={patientLanguage}>
      {sessionHeader}
      <PatientSessionProgressStrip
        lang={patientLanguage}
        exerciseIndex={exerciseIndex}
        total={total}
      />

      {sessionFocusPurpose && (
        <div className="rounded-[8px] bg-[#F0FAF6] px-3.5 py-2.5">
          <p
            className={`text-[9px] font-bold uppercase text-[#1D9E75] ${arClass}`}
            style={{ letterSpacing: "0.06em", marginBottom: "3px" }}
          >
            {focusUi.todaysSessionFocus}
          </p>
          <p className={`text-[13px] leading-[1.5] text-[#065F46] ${arClass}`}>
            {sessionFocusPurpose}
          </p>
        </div>
      )}

      <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-3">
        <p
          className={`text-[13px] leading-relaxed text-[#374151] ${arClass}`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          {exerciseUi.safetyBanner}
        </p>
      </div>

      <PatientExerciseSessionCard
        lang={patientLanguage}
        arClass={arClass}
        textDir={textDir}
        isArabic={isArabic}
        exerciseIndex={exerciseIndex}
        totalExercises={total}
        view={currentView}
        step={exerciseStep}
        setsCompleted={setsCompleted}
        onStartExercise={handleStartExercise}
        onCompleteSet={handleCompleteSet}
        onCompleteExercise={handleCompleteExercise}
      />

      {exerciseStep === "done" && (
        <button
          type="button"
          onClick={handleNextExercise}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
        >
          {isLast ? flowUi.continueToFinish : flowUi.nextExercise}
        </button>
      )}

      <p
        className={`text-center text-[11px] italic text-[#9CA3AF] ${arClass}`}
      >
        {focusUi.exerciseSafetyReminder}
      </p>
    </div>
  );
}
