"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";
import type { SessionCompleteResponse } from "@/app/api/patient/session-complete/route";
import { encodeSessionCoachNotes } from "@/app/lib/session-coach-metadata";

/* ── Exercise instructions lookup ───────────────────────────────────────────── */

const INSTRUCTIONS: Record<string, string> = {
  "Sit-to-Stand":
    "Sit at the edge of a sturdy chair with feet shoulder-width apart. Lean forward slightly, push through your heels, and stand up fully. Slowly lower back to sitting. Keep your core engaged and knees tracking over your toes throughout.",
  "Mini Squat (0–45°)":
    "Stand with feet shoulder-width apart. Slowly bend your knees to approximately 45°, keeping your chest tall and weight through your heels. Hold for 2 seconds, then return to standing. Do not let your knees cave inward.",
  "Heel Raises":
    "Stand behind a chair for support. Slowly rise up onto the balls of both feet, hold for 2 seconds at the top, then lower with control. Focus on equal weight through both feet.",
  "Single Leg Stance":
    "Stand on your operated leg with a slight bend in the knee. Hold your balance for the prescribed duration. Use a wall or chair for safety if needed. Aim to minimise hip drop on the lifted side.",
  "Low Step-Up":
    "Stand facing a low step (15–20 cm). Step up with your operated leg, driving through the heel to fully straighten the knee. Step down with control. Keep your trunk upright.",
  "Resistance Band Squats":
    "Place a resistance band just above your knees. Stand with feet shoulder-width apart. Squat to 45–60°, pressing outward against the band to keep knees aligned. Return to standing.",
  "Step-Ups":
    "Step up onto a stair or box with your operated leg leading. Drive through the heel to stand fully upright, then step back down with control. Keep your hips level throughout.",
  "Balance Board":
    "Stand on the balance board with feet hip-width apart. Maintain your balance for the prescribed time. Progress to single-leg if tolerated. Focus on steady posture and controlled weight shifts.",
};

const WHY_THIS_MATTERS =
  "This exercise supports safe movement control and helps your therapist monitor your rehabilitation progress.";

function getInstructions(exercise: string): string {
  return (
    INSTRUCTIONS[exercise] ??
    "Perform this exercise with controlled, deliberate movement. Focus on correct form and pain-free range of motion. Stop if you experience sharp pain."
  );
}

function getTodaysGoal(sessionTitle: string): string {
  if (sessionTitle.trim()) {
    return `Complete "${sessionTitle}" gently and safely.`;
  }
  return "Complete today's session gently and safely.";
}

type SessionPhase = "precheck" | "active";

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
  const router    = useRouter();
  const token     = String(params.token ?? "");
  const sessionId = String(params.sessionId ?? "");

  const [session,             setSession]             = useState<PatientSession | null>(null);
  const [notFound,            setNotFound]            = useState(false);
  const [patientName,         setPatientName]         = useState("");
  const [phase,               setPhase]               = useState<SessionPhase>("precheck");
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
    if (!token) { router.replace("/patient/invalid"); return; }

    fetch(`/api/patient/plan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 403) {
          router.replace("/patient/invalid");
          return;
        }
        if (!res.ok) { setNotFound(true); return; }
        const plan = (await res.json()) as PatientPlanData;
        const s = plan.sessions.find((x) => x.id === sessionId);
        if (!s) { setNotFound(true); return; }
        setSession(s);
        setPatientName(plan.patientName ?? "");
      })
      .catch(() => { setNotFound(true); });
  }, [token, sessionId, router]);

  if (notFound) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#374151]">Session not found.</p>
          <Link
            href={`/patient/${token}`}
            className="mt-4 inline-block text-[13px] font-semibold text-[#1D9E75]"
          >
            ← Back to your plan
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-[13px] text-[#9CA3AF]">Loading…</p>
      </div>
    );
  }

  const exercises = session.exercises;
  const total     = exercises.length;
  const isLast    = exerciseIndex === total - 1;
  const current   = exercises[exerciseIndex];
  const todaysGoal = getTodaysGoal(session.title);

  const precheckReady =
    painBefore !== null &&
    safetyConcern !== null &&
    (safetyConcern === false || safetyAcknowledged);

  async function handleMarkComplete() {
    if (phase === "precheck") {
      if (!precheckReady) return;
      setPhase("active");
      return;
    }

    if (!isLast) {
      setExerciseIndex((i) => i + 1);
      return;
    }

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
      setCompleteError(err instanceof Error ? err.message : "Could not save session. Please try again.");
      setCompleting(false);
    }
  }

  /* Already completed — avoid confusing re-run */
  if (session.status === "completed" && !completed) {
    const completedLabel = session.completedAt
      ? new Date(session.completedAt).toLocaleDateString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
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
            Session already completed
          </h2>
          <p className="mt-2 text-[15px] font-semibold text-[#374151]">{session.title}</p>
          <p className="mt-2 text-[14px] text-[#6B7280]">
            You finished {total} exercise{total === 1 ? "" : "s"} in this session.
            {completedLabel ? ` Completed ${completedLabel}.` : ""}
          </p>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#6B7280]">
            Your therapist can review your progress on the plan dashboard. You do not need to repeat this session.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Link
            href={`/patient/${token}`}
            className="flex min-h-[48px] items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
          >
            ← Back to my plan
          </Link>
          <Link
            href={`/patient/${token}/progress`}
            className="flex min-h-[44px] items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            View progress
          </Link>
        </div>
      </div>
    );
  }

  /* Completion screen */
  if (completed && completionSummary) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
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
            Session complete
          </h2>
          <p className="mt-2 text-[15px] font-semibold text-[#374151]">{session.title}</p>
          <p className="mt-2 text-[14px] text-[#374151]">
            {completionSummary.exercisesCompleted} exercise
            {completionSummary.exercisesCompleted === 1 ? "" : "s"} completed
          </p>
          <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2 text-left">
            <div className="rounded-[8px] border border-[#E2E8E5] bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Effort</p>
              <p className="mt-0.5 text-[16px] font-bold text-[#1D9E75]">
                {completionSummary.effortScore}/10
              </p>
            </div>
            <div className="rounded-[8px] border border-[#E2E8E5] bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Pain after</p>
              <p className="mt-0.5 text-[16px] font-bold text-[#1D9E75]">
                {completionSummary.painAfter}/10
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14px] text-[#374151]">
            Your progress has been saved for your therapist to review.
          </p>
          <p className="mt-3 max-w-sm text-[12px] italic leading-relaxed text-[#6B7280]">
            If you feel sharp or unusual pain during exercises, stop immediately and contact your therapist.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Link
            href={`/patient/${token}`}
            className="flex min-h-[48px] items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165]"
          >
            ← Back to my plan
          </Link>
          <Link
            href={`/patient/${token}/progress`}
            className="flex min-h-[44px] items-center justify-center rounded-[7px] border border-[#E2E8E5] bg-white text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            View progress
          </Link>
        </div>
      </div>
    );
  }

  /* Completion screen (fallback if summary missing) */
  if (completed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div>
          <h2
            className="text-[20px] font-medium text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            Well done.
          </h2>
          <p className="mt-2 text-[14px] text-[#374151]">
            Your progress has been updated for your therapist to review.
          </p>
        </div>
        <Link
          href={`/patient/${token}`}
          className="mt-2 flex min-h-[44px] items-center rounded-[7px] border border-[#E2E8E5] bg-transparent px-6 text-[14px] font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
        >
          ← Back to my plan
        </Link>
      </div>
    );
  }

  /* Pre-session guided check */
  if (phase === "precheck") {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/patient/${token}`}
            className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
          >
            ← Your plan
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
            Today&apos;s rehab goal
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">{todaysGoal}</p>
        </div>

        <PainScale
          label="How is your pain before starting? (0 = none, 10 = worst)"
          value={painBefore}
          onChange={setPainBefore}
        />

        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-3 text-[13px] font-semibold text-[#374151]">
            Do you feel sharp pain, dizziness, or unusual symptoms today?
          </p>
          <div className="flex gap-3">
            {([
              { label: "No", value: false },
              { label: "Yes", value: true },
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
              Please stop and contact your therapist before starting.
            </p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={safetyAcknowledged}
                onChange={(e) => setSafetyAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600"
              />
              <span className="text-[13px] leading-relaxed text-amber-900">
                I will contact my therapist before continuing
              </span>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleMarkComplete}
          disabled={!precheckReady}
          className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start session
        </button>
      </div>
    );
  }

  /* Active exercise flow */
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/patient/${token}`}
            className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
          >
            ← Your plan
          </Link>
          <h1
            className="mt-2 text-[18px] font-bold text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {session.title}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 pt-6">
          {exercises.map((_, i) => (
            <span
              key={i}
              className={`block h-2 w-2 rounded-full transition ${
                i < exerciseIndex
                  ? "bg-[#1D9E75]"
                  : i === exerciseIndex
                  ? "bg-[#1D9E75] ring-2 ring-[#1D9E75]/30"
                  : "bg-[#E2E8E5]"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mb-2 text-center text-[11px] text-[#9CA3AF]">
        Exercise {exerciseIndex + 1} of {total}
      </p>

      <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-3">
        <p className="text-[13px] leading-relaxed text-[#374151]">
          Move slowly and stop if you feel sharp pain, dizziness, or unusual symptoms.
        </p>
      </div>

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-6">
        <h2
          className="text-[18px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {current}
        </h2>
        <p
          className="mt-1 text-[13px] font-semibold text-[#1D9E75]"
          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
        >
          As prescribed by your therapist
        </p>
        <p className="mt-4 text-[14px] leading-[1.7] text-[#374151]">
          {getInstructions(current)}
        </p>
        <p className="mt-4 rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-2.5 text-[12px] leading-relaxed text-[#6B7280]">
          <span className="font-semibold text-[#374151]">Why this matters: </span>
          {WHY_THIS_MATTERS}
        </p>
      </div>

      {isLast && (
        <>
          <p className="text-center text-[12px] text-[#1D9E75]">
            This is your final exercise for this session.
          </p>

          <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
            <p className="mb-3 text-[13px] font-semibold text-[#374151]">
              How did this feel? (1 = easy, 10 = very hard)
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
            label="How is your pain after this session? (0 = none, 10 = worst)"
            value={painAfter}
            onChange={setPainAfter}
          />

          <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
            <label htmlFor="patient-note" className="mb-2 block text-[13px] font-semibold text-[#374151]">
              Anything you want your therapist to know? (optional)
            </label>
            <textarea
              id="patient-note"
              value={patientNote}
              onChange={(e) => setPatientNote(e.target.value)}
              rows={3}
              placeholder="Optional note for your therapist…"
              className="w-full resize-none rounded-[7px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-2.5 text-[14px] text-[#374151] placeholder:text-[#9CA3AF] focus:border-[#1D9E75]/50 focus:outline-none"
            />
          </div>
        </>
      )}

      {completeError && (
        <div className="rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-[13px] text-rose-600">{completeError}</p>
        </div>
      )}

      {isLast && (effortScore === null || painAfter === null) && (
        <p className="text-center text-[12px] text-[#6B7280]">
          Select how the session felt and your pain level after exercising to finish.
        </p>
      )}

      <button
        type="button"
        onClick={handleMarkComplete}
        disabled={(isLast && (effortScore === null || painAfter === null)) || completing}
        className="flex min-h-[48px] w-full items-center justify-center rounded-[7px] bg-[#1D9E75] text-[15px] font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {completing
          ? "Saving…"
          : isLast
          ? "Complete session"
          : "Next exercise →"}
      </button>
    </div>
  );
}
