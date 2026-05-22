"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function PatientProgressPage() {
  const params = useParams();
  const router = useRouter();
  const token  = String(params.token ?? "");

  const [plan,    setPlan]    = useState<PatientPlanData | null | undefined>(undefined);
  const [logs,    setLogs]    = useState<SessionLogEntry[]>([]);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    if (!token) { router.replace("/patient/invalid"); return; }

    fetch(`/api/patient/plan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 403) {
          router.replace("/patient/invalid");
          return;
        }
        if (!res.ok) {
          setLoadErr("Unable to load progress data. Please try again.");
          setPlan(null);
          return;
        }
        setPlan((await res.json()) as PatientPlanData);
      })
      .catch(() => {
        setLoadErr("Connection error. Please check your connection and try again.");
        setPlan(null);
      });

    // Fetch session logs (non-blocking — safe empty state if fails)
    fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) setLogs((await res.json()) as SessionLogEntry[]);
      })
      .catch(() => { /* logs are optional */ });
  }, [token, router]);

  if (plan === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[13px] text-[#9CA3AF]">Loading…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[13px] text-rose-400">{loadErr || "Plan not found."}</p>
      </div>
    );
  }

  // Use plan_sessions.status for completed count (real-time from Supabase)
  const completedSessions = plan.sessions.filter((s) => s.status === "completed").length;
  const totalSessions     = plan.sessions.length;
  const adherence         = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Session log stats
  const effortLogs = logs.filter((l) => l.effortScore !== null);
  const avgEffort  = effortLogs.length > 0
    ? Math.round(effortLogs.reduce((sum, l) => sum + (l.effortScore ?? 0), 0) / effortLogs.length)
    : null;
  const painLogs    = logs.filter((l) => l.painScore !== null);
  const latestPain  = painLogs.length > 0 ? painLogs[0].painScore : null; // logs ordered newest first

  const spw = plan.sessionsPerWeek || 3;

  // Weekly view: group sessions by sessionsPerWeek
  const weeks = Array.from(
    { length: Math.ceil(totalSessions / spw) },
    (_, wi) => {
      const slice = plan.sessions.slice(wi * spw, wi * spw + spw);
      const done  = slice.filter((s) => s.status === "completed").length;
      return {
        week:      `Week ${wi + 1}`,
        completed: done,
        target:    spw,
        isDone:    done === slice.length && slice.length > 0,
      };
    },
  );

  // Phase status from assigned plan only
  const phaseCompletions = plan.phaseName
    ? [
        {
          label: plan.phaseName,
          done:  completedSessions >= totalSessions && totalSessions > 0,
          note:  `${completedSessions} / ${totalSessions} sessions`,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Link
          href={`/patient/${token}`}
          className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
        >
          ← Your plan
        </Link>
        <h1
          className="mt-2 text-[20px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          Your recovery progress
        </h1>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessions",  value: `${completedSessions}/${totalSessions}`,             sub: "completed"      },
          { label: "Adherence", value: `${adherence}%`,                                     sub: "completion rate" },
          { label: "Avg effort",value: avgEffort !== null ? String(avgEffort) : "—",        sub: "out of 10"       },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-[10px] border border-[#E2E8E5] bg-white p-4 text-center"
          >
            <p
              className="text-[20px] font-bold text-[#1D9E75]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {value}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#374151]">{label}</p>
            <p className="text-[10px] text-[#9CA3AF]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Phase status */}
      {phaseCompletions.length > 0 && (
      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
          Current phase
        </p>
        <div className="space-y-3">
          {phaseCompletions.map(({ label, done, note }) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-[#1D9E75]" : "border-2 border-[#E2E8E5] bg-white"
                }`}
              >
                {done && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold ${done ? "text-[#0A0F1A]" : "text-[#374151]"}`}>
                  {label}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Recovery timeline */}
      {weeks.length > 0 && (
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            Recovery timeline
          </p>
          <div className="space-y-3">
            {weeks.map(({ week, completed: c, target, isDone }) => (
              <div key={week} className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${isDone ? "bg-[#1D9E75]" : "bg-[#E2E8E5]"}`}
                />
                <p className="flex-1 text-[13px] text-[#374151]">
                  {week} — {c}/{target} sessions
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest pain score (if reported) */}
      {latestPain !== null && (
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            Latest pain score
          </p>
          <p
            className="text-[20px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {latestPain}/10
          </p>
        </div>
      )}

      {/* Clinician note */}
      {plan.clinicianNotes && (
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            Note from your therapist
          </p>
          <blockquote className="border-l-[3px] border-[#1D9E75] pl-4">
            <p className="text-[13px] leading-[1.7] text-[#6B7280]">
              {plan.clinicianNotes}
            </p>
            {plan.assignedBy && (
              <p className="mt-2 text-[11px] text-[#9CA3AF]">— {plan.assignedBy}</p>
            )}
          </blockquote>
        </div>
      )}
    </div>
  );
}
