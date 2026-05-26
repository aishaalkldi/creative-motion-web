"use client";

import Link from "next/link";
import type { PatientPortalLanguage } from "@/app/lib/patient-portal-ui";
import { motivationUi } from "@/app/lib/patient-portal-ui";
import type { MotivationStats, TodaySessionStatus } from "@/app/lib/patient-motivation";

type CardProps = {
  lang: PatientPortalLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
};

function todayStatusMessage(
  lang: PatientPortalLanguage,
  status: TodaySessionStatus,
): string {
  const ui = motivationUi(lang);
  if (status === "ready") return ui.todayReady;
  if (status === "completed_today") return ui.todayCompleted;
  if (status === "all_complete") return ui.allSessionsCompleteShort;
  return ui.todayReady;
}

export function PatientTodaySessionCard({
  lang,
  arClass,
  textDir,
  stats,
  patientToken,
}: CardProps & {
  stats: MotivationStats;
  patientToken: string;
}) {
  const ui = motivationUi(lang);
  if (stats.total === 0) return null;

  const showStartLink =
    stats.todayStatus === "ready" && stats.nextSessionId != null;

  return (
    <div
      className={`rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] p-4 ${arClass}`}
      dir={textDir}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1D9E75]">
        {ui.todaysSessionStatus}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-[#374151]">
        {todayStatusMessage(lang, stats.todayStatus)}
      </p>
      <p className="mt-2 text-[12px] text-[#6B7280]">
        {ui.completedSessionsCount(stats.completed, stats.total)}
      </p>
      {showStartLink ? (
        <Link
          href={`/patient/${patientToken}/session/${stats.nextSessionId}`}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[7px] bg-[#1D9E75] px-4 text-[14px] font-semibold text-white transition hover:bg-[#179165]"
        >
          {lang === "ar" ? "بدء الجلسة" : "Start session"}
        </Link>
      ) : null}
    </div>
  );
}

export function PatientGentleEncouragementCard({ lang, arClass, textDir }: CardProps) {
  const ui = motivationUi(lang);
  return (
    <div
      className={`rounded-[10px] border border-[#E2E8E5] bg-white p-4 ${arClass}`}
      dir={textDir}
    >
      <p className="text-[13px] font-semibold text-[#0A0F1A]">{ui.gentleEncouragementTitle}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">{ui.gentleEncouragementBody}</p>
      <p className="mt-2 text-[12px] font-medium text-[#1D9E75]">{ui.followTherapistPlan}</p>
    </div>
  );
}

export function PatientMotivationSafetyStrip({ lang, arClass, textDir }: CardProps) {
  const ui = motivationUi(lang);
  return (
    <p
      className={`rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#6B7280] ${arClass}`}
      dir={textDir}
    >
      {ui.safetyReminderShort}
    </p>
  );
}

export function PatientPreSessionMotivation({ lang, arClass, textDir }: CardProps) {
  const ui = motivationUi(lang);
  return (
    <div
      className={`rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] px-4 py-3.5 ${arClass}`}
      dir={textDir}
    >
      <p className="text-[13px] leading-relaxed text-[#374151]">{ui.preSessionComfort}</p>
      <p className="mt-2 text-[12px] text-[#6B7280]">{ui.followTherapistPlan}</p>
    </div>
  );
}

export function PatientSessionCompletionMotivation({ lang, arClass, textDir }: CardProps) {
  const ui = motivationUi(lang);
  return (
    <div className={`space-y-1 ${arClass}`} dir={textDir}>
      <p className="text-[15px] font-semibold text-[#1D9E75]">{ui.greatEffort}</p>
      <p className="text-[14px] text-[#374151]">{ui.youShowedUpToday}</p>
      <p className="text-[13px] text-[#6B7280]">{ui.therapistCanReviewProgress}</p>
    </div>
  );
}

export function PatientProgressMotivationCard({
  lang,
  arClass,
  textDir,
  stats,
}: CardProps & { stats: MotivationStats }) {
  const ui = motivationUi(lang);
  if (stats.total === 0) return null;

  return (
    <div
      className={`rounded-[10px] border border-[#E2E8E5] bg-white p-4 ${arClass}`}
      dir={textDir}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
        {ui.smallStepsConsistency}
      </p>
      <p
        className="mt-2 text-[20px] font-bold text-[#1D9E75]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {stats.remaining}
      </p>
      <p className="text-[11px] font-semibold text-[#374151]">{ui.progressRemainingLabel}</p>
      <p className="mt-2 text-[12px] text-[#6B7280]">{ui.remainingSessions(stats.remaining)}</p>
      <p className="mt-3 text-[12px] leading-relaxed text-[#6B7280]">
        {ui.consistencyActiveDays(stats.activeDaysLast7)}
      </p>
    </div>
  );
}
