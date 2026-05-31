"use client";

import Link from "next/link";
import {
  groupSessionsBySchedule,
  type SchedulableSession,
} from "@/app/lib/session-schedule";
import { formatDoseLabel } from "@/app/lib/exercise-prescription";
import { parseStoredExercise, type PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  formatSessionDisplayTitle,
  localizeScheduleLabel,
  planHomeUi,
} from "@/app/lib/patient-portal-ui";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import { deriveClinicianSessionCameraLine } from "@/app/lib/cv/clinician-session-camera-status";

type Props = {
  sessions: SchedulableSession[];
  sessionsPerWeek: number;
  /** Patient token link base — if set, today's session rows are clickable */
  patientToken?: string;
  /** Clinician dark theme vs patient light */
  variant?: "clinician" | "patient";
  /** Patient portal language for schedule labels */
  language?: PatientExerciseLanguage;
  getDisplayStatus?: (
    sessions: SchedulableSession[],
    session: SchedulableSession,
  ) => "done" | "today" | "upcoming" | "completed" | "ready" | "in-progress";
  /** Clinician profile: CV rows keyed by plan_session_id for camera status lines */
  cvMetricsByPlanSessionId?: Map<string, CvSessionMetricPublic[]>;
};

function formatClinicianExerciseSummary(exercises: SchedulableSession["exercises"]): string {
  const items = (exercises ?? []).slice(0, 2).map((raw) => {
    const parsed = parseStoredExercise(raw);
    const dose = formatDoseLabel(parsed);
    return dose ? `${parsed.name} (${dose})` : parsed.name;
  });
  const count = exercises?.length ?? 0;
  if (count > 2) items.push(`+${count - 2}`);
  return items.join(" · ");
}

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
  language = "en",
}: {
  status: string;
  variant: "clinician" | "patient";
  language?: PatientExerciseLanguage;
}) {
  const isDone = status === "done" || status === "completed";
  const isToday = status === "today" || status === "in-progress";
  const homeUi = planHomeUi(language);

  if (variant === "patient") {
    if (isDone) return <span className="shrink-0 rounded-[6px] bg-[#E8F5F1] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#085041]">{homeUi.done}</span>;
    if (isToday) return <span className="shrink-0 rounded-[6px] bg-[#1D9E75] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">{homeUi.startToday}</span>;
    return <span className="shrink-0 rounded-[6px] border border-[#E2E8E5] bg-[#F4F6F5] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">{homeUi.upcoming}</span>;
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
  language = "en",
  getDisplayStatus,
  cvMetricsByPlanSessionId,
}: Props) {
  const weeks = groupSessionsBySchedule(sessions, sessionsPerWeek);
  const resolveStatus = getDisplayStatus ?? defaultPatientStatus;
  const homeUi = planHomeUi(language);
  const patientLang = variant === "patient" ? language : "en";

  if (weeks.length === 0) {
    return (
      <p className={variant === "clinician" ? "text-xs text-white/35" : "text-[13px] text-[#9CA3AF]"}>
        {variant === "patient" ? homeUi.noSessionsScheduled : "No sessions scheduled yet."}
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
        <div key={week.weekLabel} className={`rounded-[10px] border ${borderCls} ${bgCls} overflow-hidden`}>
          <div className={`border-b ${borderCls} px-4 py-2.5`}>
            <p className={weekTitleCls}>
              {variant === "patient"
                ? localizeScheduleLabel(week.weekLabel, patientLang)
                : week.weekLabel}
            </p>
          </div>
          <div className={`divide-y ${borderCls}`}>
            {week.days.map((day) => (
              <div key={`${week.weekLabel}-${day.dayLabel}`} className="px-4 py-3.5">
                <p className={`${dayTitleCls} mb-2.5`}>
                  {variant === "patient"
                    ? localizeScheduleLabel(day.dayLabel, patientLang)
                    : day.dayLabel}
                </p>
                <div className="space-y-3">
                  {day.sessions.map((session) => {
                    const st = resolveStatus(sessions, session);
                    const isToday = st === "today";
                    const displayTitle =
                      variant === "patient"
                        ? formatSessionDisplayTitle(
                            session.sessionNumber,
                            session.title,
                            patientLang,
                          )
                        : session.title.trim().toLowerCase().startsWith(`session ${session.sessionNumber}`)
                          ? session.title
                          : `Session ${session.sessionNumber} — ${session.title}`;
                    const exerciseCount = session.exercises?.length ?? 0;
                    const estimatedMinutes = Math.max(10, (session.exercises?.length ?? 3) * 4);
                    const cameraLine =
                      variant === "clinician" && cvMetricsByPlanSessionId
                        ? deriveClinicianSessionCameraLine({
                            planSessionId: session.id,
                            sessionStatus: session.status,
                            exercises: session.exercises,
                            cvMetrics: cvMetricsByPlanSessionId.get(session.id),
                          })
                        : null;
                    const row = (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`${titleCls} leading-snug`}>{displayTitle}</p>
                          {exerciseCount > 0 && (
                            <p className={`mt-1 ${subCls}`}>
                              {variant === "patient"
                                ? homeUi.exercisesMinutes(exerciseCount, estimatedMinutes)
                                : formatClinicianExerciseSummary(session.exercises)}
                            </p>
                          )}
                          {cameraLine && (
                            <p className="mt-1.5 text-[11px] font-medium text-[#5DCAA5]/90">
                              {cameraLine}
                            </p>
                          )}
                        </div>
                        <StatusPill status={st} variant={variant} language={patientLang} />
                      </div>
                    );

                    if (patientToken && isToday && session.status !== "completed") {
                      return (
                        <Link
                          key={session.id}
                          href={`/patient/${patientToken}/session/${session.id}`}
                          className={`block rounded-[8px] border transition -mx-1 px-3 py-2.5 ${
                            variant === "patient"
                              ? "border-[#1D9E75]/25 bg-[#1D9E75]/5 hover:border-[#1D9E75]/40 hover:bg-[#1D9E75]/8"
                              : "hover:bg-[#F9FAFB]"
                          }`}
                        >
                          {row}
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={session.id}
                        className={variant === "patient" ? "rounded-[8px] px-1 py-1" : undefined}
                      >
                        {row}
                      </div>
                    );
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
