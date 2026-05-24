"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import { usePatientLanguage } from "@/app/components/patient/PatientLanguageProvider";
import {
  deriveClinicalAction,
} from "@/app/lib/clinical-action-engine";
import {
  formatPortalDate,
  localizeClinicalActionMessage,
  progressPageUi,
} from "@/app/lib/patient-portal-ui";
import {
  parseSessionCoachNotes,
} from "@/app/lib/session-coach-metadata";

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function PatientProgressPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");

  const [plan, setPlan] = useState<PatientPlanData | null | undefined>(undefined);
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);
  const [loadErr, setLoadErr] = useState<"load" | "connection" | "">("");

  useEffect(() => {
    if (!token) {
      router.replace("/patient/invalid");
      return;
    }

    fetch(`/api/patient/plan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 403) {
          router.replace("/patient/invalid");
          return;
        }
        if (!res.ok) {
          setLoadErr("load");
          setPlan(null);
          return;
        }
        setPlan((await res.json()) as PatientPlanData);
      })
      .catch(() => {
        setLoadErr("connection");
        setPlan(null);
      });

    fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) setLogs((await res.json()) as SessionLogEntry[]);
      })
      .catch(() => {
        /* logs are optional */
      });
  }, [token, router]);

  const { language: lang, isArabic, textDir, arClass } = usePatientLanguage();
  const ui = progressPageUi(lang);

  const logBySessionId = useMemo(() => {
    const map = new Map<string, SessionLogEntry>();
    for (const log of logs) {
      if (!log.planSessionId) continue;
      const existing = map.get(log.planSessionId);
      if (
        !existing ||
        new Date(log.completedAt).getTime() > new Date(existing.completedAt).getTime()
      ) {
        map.set(log.planSessionId, log);
      }
    }
    return map;
  }, [logs]);

  if (plan === undefined) {
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
          {loadErr === "connection" ? ui.connectionError : ui.loadError}
          {!loadErr && ` ${ui.planNotFound}`}
        </p>
      </div>
    );
  }

  const completedSessions = plan.sessions.filter((s) => s.status === "completed").length;
  const totalSessions = plan.sessions.length;
  const adherence = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const effortLogs = logs.filter((l) => l.effortScore !== null);
  const avgEffort =
    effortLogs.length > 0
      ? Math.round(
          effortLogs.reduce((sum, l) => sum + (l.effortScore ?? 0), 0) / effortLogs.length,
        )
      : null;
  const painLogs = logs.filter((l) => l.painScore !== null);
  const latestPain = painLogs.length > 0 ? painLogs[0].painScore : null;

  const sortedSessions = [...plan.sessions].sort(
    (a, b) => a.sessionNumber - b.sessionNumber,
  );

  return (
    <div className={`space-y-6 ${arClass}`} dir={textDir}>
      <div>
        <Link
          href={`/patient/${token}`}
          className="text-[12px] font-semibold text-[#9CA3AF] transition hover:text-[#374151]"
        >
          {ui.backToPlan}
        </Link>
        <h1
          className="mt-2 text-[20px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {ui.pageTitle}
        </h1>
        <p className="mb-4 mt-2 text-[12px] leading-relaxed text-[#6B7280]">{ui.pageSubtitle}</p>
        <p className="mt-1 text-[13px] text-[#6B7280]" dir="ltr">
          {plan.planTitle || plan.programName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            label: ui.sessionsCompleted,
            value: `${completedSessions}/${totalSessions}`,
            sub: ui.inYourPlan,
          },
          { label: ui.progress, value: `${adherence}%`, sub: ui.completionRate },
          { label: ui.adherence, value: `${adherence}%`, sub: ui.completionRate },
          {
            label: ui.latestPain,
            value: latestPain !== null ? `${latestPain}/10` : "—",
            sub: latestPain !== null ? ui.selfReported : ui.notRecordedYet,
          },
          {
            label: ui.averageEffort,
            value: avgEffort !== null ? `${avgEffort}/10` : "—",
            sub: avgEffort !== null ? ui.selfReported : ui.notRecordedYet,
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

      {completedSessions < 2 && (
        <p className="mt-4 text-center text-[12px] italic text-[#6B7280]">{ui.keepGoing}</p>
      )}

      <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#374151]">{ui.overallProgress}</p>
          <p
            className="text-[13px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {adherence}%
          </p>
        </div>
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[#E2E8E5]">
          <div
            className="h-full rounded-full bg-[#1D9E75] transition-all"
            style={{ width: `${adherence}%` }}
          />
        </div>
      </div>

      {sortedSessions.length > 0 && completedSessions === 0 ? (
        <p className="text-center text-[12px] italic text-[#9CA3AF]">{ui.completeFirstSession}</p>
      ) : sortedSessions.length > 0 ? (
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            {ui.sessionHistory}
          </p>
          <div className="space-y-4">
            {sortedSessions.map((session) => {
              const isCompleted = session.status === "completed";
              const log = logBySessionId.get(session.id);
              const meta = parseSessionCoachNotes(log?.notes);
              const clinicalAction = log
                ? deriveClinicalAction({
                    painBefore: meta.painBefore,
                    painAfter: log.painScore,
                    effortScore: log.effortScore,
                    safetyConcern: meta.safetyConcern,
                    patientNote: meta.patientNote,
                    completedSessionsCount: isCompleted ? 1 : 0,
                    missedSessionsCount: 0,
                    stableSessionsCount: 0,
                  })
                : null;
              const showClinicalMessage =
                clinicalAction != null && clinicalAction.status !== "stable";

              return (
                <div
                  key={session.id}
                  className="rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold text-[#374151]">
                      {ui.sessionLabel(session.sessionNumber)}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isCompleted
                          ? "bg-[#E8F5F1] text-[#1D9E75]"
                          : "bg-[#F3F4F6] text-[#9CA3AF]"
                      }`}
                    >
                      {isCompleted ? ui.completedStatus : ui.notCompletedStatus}
                    </span>
                  </div>

                  {isCompleted && log?.completedAt && (
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">
                      {formatPortalDate(log.completedAt, lang)}
                    </p>
                  )}

                  {isCompleted && log ? (
                    <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${isArabic ? "text-right" : "text-left"}`}>
                      <div className="rounded-[6px] border border-[#E2E8E5] bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          {ui.painAfterSession}
                        </p>
                        <p
                          className="mt-0.5 text-[15px] font-bold text-[#1D9E75]"
                          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                        >
                          {log.painScore != null ? `${log.painScore}/10` : "—"}
                        </p>
                      </div>
                      <div className="rounded-[6px] border border-[#E2E8E5] bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          {ui.effort}
                        </p>
                        <p
                          className="mt-0.5 text-[15px] font-bold text-[#1D9E75]"
                          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                        >
                          {log.effortScore != null ? `${log.effortScore}/10` : "—"}
                        </p>
                      </div>
                    </div>
                  ) : isCompleted ? (
                    <p className="mt-2 text-[12px] text-[#9CA3AF]">{ui.noSessionDataYet}</p>
                  ) : null}

                  {meta.patientNote && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        {ui.noteToTherapist}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#374151]" dir="auto">
                        {meta.patientNote}
                      </p>
                    </div>
                  )}

                  {showClinicalMessage && clinicalAction && (
                    <p className="mt-3 text-[12px] leading-relaxed text-[#6B7280]">
                      {localizeClinicalActionMessage(
                        clinicalAction.status,
                        lang,
                        clinicalAction.patientSafeMessage,
                      )}
                    </p>
                  )}

                  {isCompleted && log && log.exercisesCompleted > 0 && (
                    <p className="mt-2 text-[11px] text-[#9CA3AF]">
                      {ui.exercisesCompleted(log.exercisesCompleted)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-[10px] border border-[#E2E8E5] bg-[#F9FAFB] px-4 py-3.5">
        <p className="text-[13px] leading-relaxed text-[#6B7280]">{ui.clinicalReviewNote}</p>
      </div>

      {plan.clinicianNotes && (
        <div className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            {ui.noteFromTherapist}
          </p>
          <blockquote
            className={`border-[#1D9E75] pl-4 ${isArabic ? "border-r-[3px] pr-4 pl-0" : "border-l-[3px]"}`}
          >
            <p className="text-[13px] leading-[1.7] text-[#6B7280]" dir="ltr">
              {plan.clinicianNotes}
            </p>
            {plan.assignedBy && (
              <p className="mt-2 text-[11px] text-[#9CA3AF]" dir="ltr">
                — {plan.assignedBy}
              </p>
            )}
          </blockquote>
        </div>
      )}
    </div>
  );
}
