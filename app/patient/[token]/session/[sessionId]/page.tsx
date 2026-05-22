"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";

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
  "Single Leg Squat":
    "Stand on your operated leg. Slowly lower into a single-leg squat to 30–45°, keeping your knee tracking over your second toe. Return to standing. Hold a surface for support if needed.",
};

function getInstructions(exercise: string): string {
  return (
    INSTRUCTIONS[exercise] ??
    `Perform this exercise with controlled, deliberate movement. Focus on correct form and pain-free range of motion. Stop if you experience sharp pain.`
  );
}

import type { SessionCompleteResponse } from "@/app/api/patient/session-complete/route";

/* ── RASQArc mark SVG ───────────────────────────────────────────────────────── */

function RasqArc({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
    </svg>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function SessionPlayerPage() {
  const params    = useParams();
  const router    = useRouter();
  const token     = String(params.token ?? "");
  const sessionId = String(params.sessionId ?? "");

  const [session,       setSession]       = useState<PatientSession | null>(null);
  const [notFound,      setNotFound]      = useState(false);
  const [patientName,   setPatientName]   = useState("");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [effortScore,   setEffortScore]   = useState<number | null>(null);
  const [completing,    setCompleting]    = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completed,     setCompleted]     = useState(false);

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

  async function handleMarkComplete() {
    if (!isLast) {
      setExerciseIndex((i) => i + 1);
      return;
    }
    if (effortScore === null) return;
    if (completing || completed) return;

    setCompleting(true);
    setCompleteError("");

    try {
      const res = await fetch("/api/patient/session-complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sessionId,
          effortScore,
          exercisesCompleted: total,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as SessionCompleteResponse & { error?: string };

      if (!res.ok) {
        throw new Error(body.error ?? `Session could not be saved (${res.status}). Please try again.`);
      }

      // 200 (alreadyCompleted) or 201 (first completion) — same completion screen
      setCompleted(true);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Could not save session. Please try again.");
      setCompleting(false);
    }
  }

  /* Completion screen */
  if (completed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <RasqArc size={48} />
        <div>
          <h2
            className="text-[22px] font-bold text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            Session complete.
          </h2>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Well done{patientName ? `, ${patientName.split(" ")[0]}` : ""}.
          </p>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[#6B7280]">
            If you feel sharp or unusual pain during exercises, stop immediately and contact your therapist.
          </p>
        </div>
        <Link
          href={`/patient/${token}`}
          className="mt-2 flex min-h-[44px] items-center rounded-[7px] bg-[#1D9E75] px-6 text-[14px] font-semibold text-white transition hover:bg-[#179165]"
        >
          ← Back to your plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
          <p className="mt-0.5 text-[13px] text-[#6B7280]">
            Exercise {exerciseIndex + 1} of {total}
          </p>
        </div>
        {/* Dot progress */}
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

      {/* Exercise card */}
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
      </div>

      {/* Effort input — shown on last exercise */}
      {isLast && (
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
      )}

      {/* Inline error */}
      {completeError && (
        <div className="rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-[13px] text-rose-600">{completeError}</p>
        </div>
      )}

      {/* Mark complete button */}
      <button
        type="button"
        onClick={handleMarkComplete}
        disabled={(isLast && effortScore === null) || completing}
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
