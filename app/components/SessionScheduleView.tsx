"use client";

import Link from "next/link";
import {
  groupSessionsBySchedule,
  type SchedulableSession,
} from "@/app/lib/session-schedule";

type Props = {
  sessions: SchedulableSession[];
  sessionsPerWeek: number;
  /** Patient token link base — if set, today's session rows are clickable */
  patientToken?: string;
  /** Clinician dark theme vs patient light */
  variant?: "clinician" | "patient";
  getDisplayStatus?: (
    sessions: SchedulableSession[],
    session: SchedulableSession,
  ) => "done" | "today" | "upcoming" | "completed" | "ready" | "in-progress";
};

function defaultPatientStatus(
  sessions: SchedulableSession[],
  session: SchedulableSession,
): "done" | "today" | "upcoming" {
  if (session.status === "completed") return "done";
  const first = sessions.find((s) => s.status !== "completed");
  if (first?.id === session.id) return "today";
  return "upcoming";
}

function StatusPill({
  status,
  variant,
}: {
  status: string;
  variant: "clinician" | "patient";
}) {
  const isDone = status === "done" || status === "completed";
  const isToday = status === "today" || status === "in-progress";

  if (variant === "patient") {
    if (isDone) return <span className="rounded-[5px] bg-[#E8F5F1] px-2 py-0.5 text-[11px] font-semibold text-[#085041]">Done</span>;
    if (isToday) return <span className="rounded-[5px] bg-[#1D9E75] px-2 py-0.5 text-[11px] font-semibold text-white">Today</span>;
    return <span className="rounded-[5px] bg-[#F4F6F5] px-2 py-0.5 text-[11px] font-semibold text-[#9CA3AF]">Upcoming</span>;
  }

  if (isDone) return <span className="text-[10px] font-semibold text-[#5DCAA5]">Done</span>;
  if (isToday) return <span className="text-[10px] font-semibold text-amber-300">Today</span>;
  return <span className="text-[10px] font-semibold text-white/35">Upcoming</span>;
}

export function SessionScheduleView({
  sessions,
  sessionsPerWeek,
  patientToken,
  variant = "patient",
  getDisplayStatus,
}: Props) {
  const weeks = groupSessionsBySchedule(sessions, sessionsPerWeek);
  const resolveStatus = getDisplayStatus ?? defaultPatientStatus;

  if (weeks.length === 0) {
    return (
      <p className={variant === "clinician" ? "text-xs text-white/35" : "text-[13px] text-[#9CA3AF]"}>
        No sessions scheduled yet.
      </p>
    );
  }

  const borderCls = variant === "clinician" ? "border-[#1E2D42]" : "border-[#E2E8E5]";
  const bgCls = variant === "clinician" ? "bg-[#0B1220]" : "bg-white";
  const weekTitleCls = variant === "clinician" ? "text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]" : "text-[11px] font-bold uppercase tracking-wider text-[#1D9E75]";
  const dayTitleCls = variant === "clinician" ? "text-[10px] font-semibold text-white/40" : "text-[11px] font-semibold text-[#6B7280]";
  const titleCls = variant === "clinician" ? "text-sm font-semibold text-white/80" : "text-[14px] font-semibold text-[#0A0F1A]";
  const subCls = variant === "clinician" ? "text-xs text-white/40" : "text-[12px] text-[#6B7280]";

  return (
    <div className="space-y-4">
      {weeks.map((week) => (
        <div key={week.weekLabel} className={`rounded-[8px] border ${borderCls} ${bgCls} overflow-hidden`}>
          <div className={`border-b ${borderCls} px-4 py-2.5`}>
            <p className={weekTitleCls}>{week.weekLabel}</p>
          </div>
          <div className={`divide-y ${borderCls}`}>
            {week.days.map((day) => (
              <div key={`${week.weekLabel}-${day.dayLabel}`} className="px-4 py-3">
                <p className={`${dayTitleCls} mb-2`}>{day.dayLabel}</p>
                <div className="space-y-2">
                  {day.sessions.map((session) => {
                    const st = resolveStatus(sessions, session);
                    const isToday = st === "today";
                    const row = (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={titleCls}>
                            Session {session.sessionNumber} — {session.title}
                          </p>
                          {session.exercises && session.exercises.length > 0 && (
                            <p className={`mt-0.5 truncate ${subCls}`}>
                              {session.exercises.slice(0, 2).join(" · ")}
                              {session.exercises.length > 2 && ` +${session.exercises.length - 2}`}
                            </p>
                          )}
                        </div>
                        <StatusPill status={st} variant={variant} />
                      </div>
                    );

                    if (patientToken && isToday && session.status !== "completed") {
                      return (
                        <Link
                          key={session.id}
                          href={`/patient/${patientToken}/session/${session.id}`}
                          className="block rounded-[6px] transition hover:bg-[#F9FAFB] -mx-1 px-1 py-1"
                        >
                          {row}
                        </Link>
                      );
                    }
                    return <div key={session.id}>{row}</div>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
