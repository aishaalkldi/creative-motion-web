"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { SessionScheduleView } from "@/app/components/SessionScheduleView";
import {
  getLatestReportedScores,
  getPortalGreeting,
  journeyContextUi,
  planHomeUi,
} from "@/app/lib/patient-portal-ui";

function sessionDisplayStatus(
  sessions: { id: string; status: string }[],
  session: { id: string; status: string },
): "done" | "today" | "upcoming" {
  if (session.status === "completed") return "done";
  const firstPending = sessions.find((s) => s.status !== "completed");
  if (firstPending?.id === session.id) return "today";
  return "upcoming";
}

export default function PatientDashboard() {
  const params = useParams();
  const token  = String(params.token ?? "");

  const { plan, planLoadError, isPlanLoading } = usePatientPlan();
  const { language: lang, isArabic, textDir, arClass } = usePatientLanguage();
  const ui = planHomeUi(lang);
  const journeyUi = journeyContextUi(lang);
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) setLogs((await res.json()) as SessionLogEntry[]);
      })
      .catch(() => {
        /* logs are optional */
      });
  }, [token]);

  if (isPlanLoading || plan === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className={`text-[13px] text-[#9CA3AF] ${arClass}`}>{ui.loading}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className={`text-[13px] text-rose-400 ${arClass}`}>
          {planLoadError === "connection" ? ui.connectionError : ui.loadError}
        </p>
      </div>
    );
  }

  const patientName = plan.patientName || "Patient";
  const planSubtitle = plan.programName || plan.planTitle;

  const completed = plan.sessions.filter((s) => s.status === "completed").length;
  const total     = plan.sessions.length;
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasSessions = total > 0;
  const allSessionsComplete = hasSessions && completed === total;
  const sessionsPerWeek = plan.sessionsPerWeek ?? 3;
  const currentWeek = Math.min(
    Math.ceil((completed + 1) / sessionsPerWeek),
    plan.totalWeeks ?? 1,
  );
  const showWeekContext = plan.totalWeeks != null && plan.totalWeeks > 1;
  const patientFriendlyGoal = plan.patientFriendlyGoal?.trim() || null;
  const latestReported = getLatestReportedScores(logs);
  const clinicianNote = plan.clinicianNotes?.trim() || null;

  if (!hasSessions) {
    return (
      <div className={`space-y-6 ${arClass}`} dir={textDir} lang={lang}>
        <div>
          <h1
            className="text-[22px] font-bold text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {getPortalGreeting(lang)}, {patientName.split(" ")[0]}.
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            {planSubtitle} · {plan.phaseName}
          </p>
        </div>

        {plan.patientRehabFocus?.trim() && !patientFriendlyGoal && (
          <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#085041]">
              {ui.yourRehabFocus}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">
              {plan.patientRehabFocus}
            </p>
          </div>
        )}

        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-6 text-center">
          <p className="text-[15px] font-semibold text-[#0A0F1A]">{ui.finalizingSchedule}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">{ui.checkBackLater}</p>
          {plan.clinicianNotes && (
            <blockquote className="mt-5 border-t border-[#E2E8E5] pt-5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
                {ui.noteFromTherapist}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]" dir="ltr">
                {plan.clinicianNotes}
              </p>
            </blockquote>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${arClass}`} dir={textDir} lang={lang}>
      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
          {ui.yourRehabPlan}
        </p>
        <h1
          className="mt-2 text-[22px] font-bold leading-tight text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {getPortalGreeting(lang)}, {patientName.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-[15px] font-semibold text-[#0A0F1A]">
          {plan.planTitle || plan.programName}
        </p>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {planSubtitle ? `${planSubtitle} · ` : ""}{plan.phaseName}
        </p>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          {showWeekContext
            ? ui.weekOfProgram(currentWeek, plan.totalWeeks ?? 1)
            : ui.sessionProgram(total)}
        </p>
        <p className="mt-3 text-[12px] font-medium text-[#6B7280]">
          {ui.assignedByClinician}
          {plan.assignedBy ? ` · ${plan.assignedBy}` : ""}
        </p>
      </div>

      {plan.patientRehabFocus?.trim() && !patientFriendlyGoal && (
        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#085041]">
            {ui.yourRehabFocus}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">
            {plan.patientRehabFocus}
          </p>
        </div>
      )}

      <div
        className="rounded-[10px] border border-[#E2E8E5] bg-white px-4 py-3.5"
        style={{ borderWidth: "0.5px", marginBottom: "14px" }}
      >
        {patientFriendlyGoal && (
          <>
            <p
              className={`text-[9px] font-bold uppercase text-[#1D9E75] ${arClass}`}
              style={{ letterSpacing: "0.06em" }}
            >
              {journeyUi.rehabGoalLabel}
            </p>
            <p
              className={`mt-1.5 text-[14px] leading-[1.5] text-[#0A0F1A] ${arClass}`}
              style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)", fontWeight: 500 }}
            >
              {patientFriendlyGoal}
            </p>
            <div className="my-2.5" style={{ borderTop: "0.5px solid #F4F4F4" }} />
          </>
        )}

        <p
          className={`text-[9px] font-bold uppercase text-[#9CA3AF] ${arClass}`}
          style={{ letterSpacing: "0.06em" }}
        >
          {journeyUi.sessionsCompletedLabel}
        </p>
        <p className={`mt-1 text-[13px] font-medium text-[#0A0F1A] ${arClass}`}>
          {journeyUi.sessionsCompleted(completed, total)}
        </p>
        {showWeekContext && (
          <p className={`mt-0.5 text-[11px] text-[#9CA3AF] ${arClass}`}>
            {journeyUi.weekOfProgram(currentWeek, plan.totalWeeks ?? 1)}
          </p>
        )}

        {latestReported && (latestReported.painScore != null || latestReported.effortScore != null) && (
          <>
            <div className="my-2.5" style={{ borderTop: "0.5px solid #F4F4F4" }} />
            <p
              className={`text-[9px] font-bold uppercase text-[#9CA3AF] ${arClass}`}
              style={{ letterSpacing: "0.06em" }}
            >
              {journeyUi.lastReportedLabel}
            </p>
            <div className={`mt-1.5 space-y-0.5 ${arClass}`}>
              {latestReported.painScore != null && (
                <p className="text-[12px] text-[#374151]">
                  {journeyUi.painScore(latestReported.painScore)}
                </p>
              )}
              {latestReported.effortScore != null && (
                <p className="text-[12px] text-[#374151]">
                  {journeyUi.effortScore(latestReported.effortScore)}
                </p>
              )}
            </div>
            <p className={`mt-2 text-[10px] italic text-[#9CA3AF] ${arClass}`}>
              {journeyUi.lastReportedNote}
            </p>
          </>
        )}

        {clinicianNote && (
          <>
            <div className="my-2.5" style={{ borderTop: "0.5px solid #F4F4F4" }} />
            <p
              className={`text-[9px] font-bold uppercase text-[#1D9E75] ${arClass}`}
              style={{ letterSpacing: "0.06em" }}
            >
              {journeyUi.clinicianNoteLabel}
            </p>
            <div
              className={`mt-1.5 rounded-[6px] bg-[#F9FAFB] px-3 py-2 text-[12px] leading-[1.6] text-[#374151] ${arClass}`}
              style={{
                borderLeft: isArabic ? undefined : "3px solid #1D9E75",
                borderRight: isArabic ? "3px solid #1D9E75" : undefined,
              }}
              dir="auto"
            >
              {clinicianNote}
            </div>
          </>
        )}

        <div className="my-2.5" style={{ borderTop: "0.5px solid #F4F4F4" }} />
        <p className={`flex items-start gap-1.5 text-[11px] italic text-[#6B7280] ${arClass}`}>
          <span className="mt-1 shrink-0 text-[8px] text-[#1D9E75]" aria-hidden>
            ●
          </span>
          <span>{journeyUi.therapistVisibility}</span>
        </p>
      </div>

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#6B7280]">{ui.yourProgress}</p>
          <p className="text-[11px] font-medium text-[#1D9E75]">
            {ui.sessionsProgress(completed, total)}
          </p>
        </div>
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[#E2E8E5]">
          <div
            className="h-full rounded-full bg-[#1D9E75] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {allSessionsComplete && (
        <div className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] p-5 text-center">
          <p className="text-[16px] font-semibold text-[#085041]">{ui.allSessionsComplete}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#374151]">{ui.allSessionsCompleteBody}</p>
          <Link
            href={`/patient/${token}/progress`}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[7px] bg-[#1D9E75] px-5 text-[14px] font-semibold text-white transition hover:bg-[#179165]"
          >
            {ui.viewMyProgress}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: ui.totalSessions, value: String(total), sub: ui.inYourPlan },
          { label: ui.completed, value: String(completed), sub: ui.sessionsDone },
          {
            label: journeyUi.sessionsCompletedLabel,
            value: journeyUi.sessionsCompleted(completed, total),
            sub: ui.inYourPlan,
          },
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

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
          {ui.yourSessions}
        </p>
        <p className="mb-4 text-[12px] text-[#6B7280]">
          {allSessionsComplete ? ui.completedSessionsListed : ui.tapTodaySession}
        </p>
        <SessionScheduleView
          sessions={plan.sessions.map((s) => ({
            id: s.id,
            sessionNumber: s.sessionNumber,
            title: s.title,
            exercises: s.exercises,
            status: s.status,
            scheduledAt: s.scheduledAt,
            completedAt: s.completedAt,
          }))}
          sessionsPerWeek={plan.sessionsPerWeek}
          patientToken={token}
          variant="patient"
          language={lang}
          getDisplayStatus={(sessions, session) =>
            sessionDisplayStatus(sessions, session)
          }
        />
      </div>

      <div className={`pb-2 ${isArabic ? "text-left" : "text-right"}`}>
        <Link
          href={`/patient/${token}/progress`}
          className="text-[13px] font-semibold text-[#1D9E75] transition hover:text-[#179165]"
        >
          {ui.viewMyProgressArrow}
        </Link>
      </div>
    </div>
  );
}
