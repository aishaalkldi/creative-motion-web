"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientPlanData } from "@/app/api/patient/plan/route";

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Maps DB session statuses (upcoming/today/completed/skipped) to display state.
 * The first non-completed session is treated as today's session.
 */
function sessionDisplayStatus(
  sessions: PatientPlanData["sessions"],
  session: PatientPlanData["sessions"][number],
): "done" | "today" | "upcoming" {
  if (session.status === "completed") return "done";
  const firstPending = sessions.find((s) => s.status !== "completed");
  if (firstPending?.id === session.id) return "today";
  return "upcoming";
}

function StatusBadge({ status }: { status: "done" | "today" | "upcoming" }) {
  if (status === "done")
    return (
      <span className="rounded-[5px] bg-[#E8F5F1] px-2 py-0.5 text-[11px] font-semibold text-[#085041]">
        Done
      </span>
    );
  if (status === "today")
    return (
      <span className="rounded-[5px] bg-[#1D9E75] px-2 py-0.5 text-[11px] font-semibold text-white">
        Today
      </span>
    );
  return (
    <span className="rounded-[5px] bg-[#F4F6F5] px-2 py-0.5 text-[11px] font-semibold text-[#9CA3AF]">
      Upcoming
    </span>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function PatientDashboard() {
  const params = useParams();
  const router = useRouter();
  const token  = String(params.token ?? "");

  const [plan,    setPlan]    = useState<PatientPlanData | null | undefined>(undefined);
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
          setLoadErr("Unable to load your plan. Please try again.");
          setPlan(null);
          return;
        }
        setPlan((await res.json()) as PatientPlanData);
      })
      .catch(() => {
        setLoadErr("Connection error. Please check your connection and try again.");
        setPlan(null);
      });
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

  const patientName = plan.patientName || "Patient";
  const diagnosis   = plan.diagnosis ?? plan.programName;

  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const total     = plan.sessions.length;
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sessionsCompleted = completed;
  const dayStreak         = 7;
  const currentScore      = progress;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1
          className="text-[22px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {getGreeting()}, {patientName.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {diagnosis} · {plan.phaseName} · Week {plan.totalWeeks ? `1 of ${plan.totalWeeks}` : "1"}
        </p>
      </div>

      {/* Recovery progress bar */}
      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#374151]">Recovery progress</p>
          <p
            className="text-[13px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {progress}%
          </p>
        </div>
        <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-[#E2E8E5]">
          <div
            className="h-full rounded-full bg-[#1D9E75] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-[#9CA3AF]">
          {completed} of {total} sessions complete
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessions", value: String(sessionsCompleted), sub: "completed" },
          { label: "Score",    value: String(currentScore),      sub: "current"   },
          { label: "Streak",   value: String(dayStreak),         sub: "day streak" },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-[10px] border border-[#E2E8E5] bg-white p-4 text-center"
          >
            <p
              className="text-[22px] font-bold text-[#1D9E75]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {value}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#374151]">{label}</p>
            <p className="text-[10px] text-[#9CA3AF]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Session list */}
      <div className="rounded-[10px] border border-[#E2E8E5] bg-white">
        <div className="border-b border-[#E2E8E5] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            Your sessions
          </p>
        </div>
        <div className="divide-y divide-[#F4F6F5]">
          {plan.sessions.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] text-[#9CA3AF]">No sessions assigned yet.</p>
            </div>
          ) : (
            plan.sessions.map((session) => {
              const st     = sessionDisplayStatus(plan.sessions, session);
              const isToday = st === "today";
              const row = (
                <div className="flex min-h-[56px] items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#0A0F1A]">
                      {session.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#6B7280]">
                      {session.exercises.slice(0, 2).join(" · ")}
                      {session.exercises.length > 2 && ` +${session.exercises.length - 2}`}
                    </p>
                  </div>
                  <StatusBadge status={st} />
                </div>
              );

              return isToday ? (
                <Link
                  key={session.id}
                  href={`/patient/${token}/session/${session.id}`}
                  className="block transition hover:bg-[#F9FAFB]"
                >
                  {row}
                </Link>
              ) : (
                <div key={session.id}>{row}</div>
              );
            })
          )}
        </div>
      </div>

      {/* Progress link */}
      <div className="pb-2 text-right">
        <Link
          href={`/patient/${token}/progress`}
          className="text-[13px] font-semibold text-[#1D9E75] transition hover:text-[#179165]"
        >
          View my progress →
        </Link>
      </div>
    </div>
  );
}
