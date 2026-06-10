"use client";

import Link from "next/link";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import { friendlyEffortLabel } from "@/app/lib/patient-progress-portal";
import { buildWorkspaceHomePreview } from "@/app/lib/patient-workspace";
import {
  formatPortalDate,
  getPortalGreeting,
  workspaceUi,
  type PatientPortalLanguage,
} from "@/app/lib/patient-portal-ui";
import type { PatientMovementCheckView } from "@/app/lib/patient-movement-check";
import { PatientMovementCheckCard } from "@/app/components/patient/workspace/PatientMovementCheckCard";

type Props = {
  plan: PatientPlanData;
  logs: SessionLogEntry[];
  token: string;
  lang: PatientPortalLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  movementCheck: PatientMovementCheckView | null;
};

export function PatientWorkspaceHome({
  plan,
  logs,
  token,
  lang,
  arClass,
  textDir,
  movementCheck,
}: Props) {
  const ui = workspaceUi(lang);
  const preview = buildWorkspaceHomePreview(plan, logs, lang);
  const firstName = plan.patientName.split(" ")[0] || plan.patientName;
  const homeTitle =
    preview.programKind === "move_better" ? ui.performanceHome : ui.recoveryHome;
  const sessionLabel =
    preview.stats.todayStatus === "completed_today" ? ui.todaySession : ui.nextSession;

  if (preview.totalCount === 0) {
    return (
      <div className={`space-y-5 ${arClass}`} dir={textDir}>
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
            {homeTitle}
          </p>
          <h1
            className="mt-2 text-[22px] font-bold text-[#0A0F1A]"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {getPortalGreeting(lang)}, {firstName}.
          </h1>
        </header>
        <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-6 text-center">
          <p className="text-[15px] font-semibold text-[#0A0F1A]">{ui.preparingSchedule}</p>
          <p className="mt-2 text-[13px] text-[#6B7280]">{ui.noSessionsYet}</p>
        </section>
        {plan.assignedBy ? (
          <ProviderCard assignedBy={plan.assignedBy} program={plan.planTitle || plan.programName} ui={ui} />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${arClass}`} dir={textDir}>
      <header className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
          {homeTitle}
        </p>
        <h1
          className="mt-2 text-[22px] font-bold text-[#0A0F1A]"
          style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
        >
          {ui.homeGreeting(firstName)}
        </h1>
        <p className="mt-2 text-[13px] text-[#6B7280]">
          {ui.currentProgram}:{" "}
          <span className="font-semibold text-[#374151]">
            {plan.planTitle || plan.programName}
          </span>
        </p>
      </header>

      {preview.nextSession ? (
        <section className="rounded-[10px] border border-[#D1E7DE] bg-[#F0FAF6] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1D9E75]">
            {sessionLabel}
          </p>
          <p className="mt-2 text-[16px] font-bold text-[#0A0F1A]">{preview.nextSession.title}</p>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            {ui.sessionHistoryCount(preview.completedCount, preview.totalCount)}
          </p>
          {preview.stats.todayStatus === "ready" && preview.stats.nextSessionId ? (
            <Link
              href={`/patient/${token}/session/${preview.stats.nextSessionId}`}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[7px] bg-[#1D9E75] px-5 text-[14px] font-semibold text-white transition hover:bg-[#179165]"
            >
              {ui.startSession}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            {ui.progressSummary}
          </p>
          <span
            className="text-[13px] font-bold text-[#1D9E75]"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {preview.progressPercent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E2E8E5]">
          <div
            className="h-full rounded-full bg-[#1D9E75] transition-all"
            style={{ width: `${preview.progressPercent}%` }}
          />
        </div>
        <Link
          href={`/patient/${token}/progress`}
          className="mt-3 inline-block text-[13px] font-semibold text-[#1D9E75] hover:text-[#179165]"
        >
          {ui.viewFullProgress} →
        </Link>
      </section>

      <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
          {ui.quickStatsPreview}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            {
              label: lang === "ar" ? "الجلسات" : "Sessions",
              value: `${preview.completedCount}/${preview.totalCount}`,
            },
            {
              label: lang === "ar" ? "أيام نشطة" : "Active days",
              value: String(preview.view.activeDaysLast7),
            },
            {
              label: lang === "ar" ? "الإكمال" : "Completion",
              value: `${preview.progressPercent}%`,
            },
            {
              label: lang === "ar" ? "الجهد" : "Effort",
              value:
                preview.view.averageEffort != null
                  ? friendlyEffortLabel(Math.round(preview.view.averageEffort), lang)
                  : lang === "ar"
                    ? "—"
                    : "—",
              small: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-2.5"
            >
              <p
                className={`font-bold text-[#1D9E75] ${stat.small ? "text-[13px]" : "text-[18px]"}`}
                style={
                  stat.small
                    ? undefined
                    : { fontFamily: "var(--font-ibm-plex-mono, monospace)" }
                }
              >
                {stat.value}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#6B7280]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            {ui.achievementsPreview}
          </p>
          <Link
            href={`/patient/${token}/progress`}
            className="text-[11px] font-semibold text-[#1D9E75]"
          >
            {ui.viewAchievements}
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {preview.view.achievements.slice(0, 4).map((badge) => (
            <span
              key={badge.id}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                badge.earned
                  ? "border border-[#D1E7DE] bg-[#F0FAF6] text-[#1D9E75]"
                  : "border border-[#E2E8E5] bg-[#F9FAFB] text-[#9CA3AF]"
              }`}
            >
              {badge.earned ? "✓ " : ""}
              {badge.title}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
            {ui.recentActivityPreview}
          </p>
          <Link
            href={`/patient/${token}/progress`}
            className="text-[11px] font-semibold text-[#1D9E75]"
          >
            {ui.viewRecentSessions}
          </Link>
        </div>
        {preview.view.recentSessions.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6B7280]">
            {lang === "ar" ? "ستظهر جلساتك هنا بعد الإكمال." : "Sessions will appear here after you complete one."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {preview.view.recentSessions.slice(0, 3).map((row) => (
              <li
                key={row.sessionId}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-[#374151]">{row.title}</span>
                {row.completedAt ? (
                  <span className="text-[11px] text-[#9CA3AF]">
                    {formatPortalDate(row.completedAt, lang)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PatientMovementCheckCard
        view={movementCheck}
        lang={lang}
        arClass={arClass}
        textDir={textDir}
      />

      {plan.assignedBy ? (
        <ProviderCard
          assignedBy={plan.assignedBy}
          program={plan.planTitle || plan.programName}
          ui={ui}
        />
      ) : null}

      <div className="text-center">
        <Link
          href={`/patient/${token}/sessions`}
          className="text-[13px] font-semibold text-[#1D9E75] hover:text-[#179165]"
        >
          {ui.viewAllSessions} →
        </Link>
      </div>
    </div>
  );
}

function ProviderCard({
  assignedBy,
  program,
  ui,
}: {
  assignedBy: string;
  program: string;
  ui: ReturnType<typeof workspaceUi>;
}) {
  return (
    <section className="rounded-[10px] border border-[#E2E8E5] bg-white p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#374151]">
        {ui.providerClinic}
      </p>
      <p className="mt-2 text-[15px] font-semibold text-[#0A0F1A]" dir="ltr">
        {assignedBy}
      </p>
      <p className="mt-1 text-[12px] text-[#6B7280]">{program}</p>
    </section>
  );
}
