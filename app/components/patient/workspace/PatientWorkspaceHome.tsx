"use client";

import type { ReactNode } from "react";
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
import { PatientLifetimeSummaryCard } from "@/app/components/patient/PatientLifetimeSummaryCard";

type Props = {
  plan: PatientPlanData;
  logs: SessionLogEntry[];
  token: string;
  lang: PatientPortalLanguage;
  arClass: string;
  textDir: "ltr" | "rtl";
  movementCheck: PatientMovementCheckView | null;
};

const CARD_SHADOW = "shadow-[0_8px_30px_rgba(10,15,26,0.06)]";

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
  const programName = plan.planTitle || plan.programName;
  const isPerformance = preview.programKind === "move_better";
  const homeTitle = isPerformance ? ui.performanceHome : ui.recoveryHome;
  const heroTagline = isPerformance ? ui.heroPerformanceTagline : ui.heroRecoveryTagline;
  const canStart =
    preview.stats.todayStatus === "ready" && preview.stats.nextSessionId != null;
  const sessionsRemaining = Math.max(preview.totalCount - preview.completedCount, 0);

  if (preview.totalCount === 0) {
    return (
      <div className={`space-y-5 ${arClass}`} dir={textDir}>
        <HeroEmpty
          homeTitle={homeTitle}
          greeting={`${getPortalGreeting(lang)}, ${firstName}`}
          tagline={heroTagline}
        />
        <section
          className={`rounded-[20px] border border-[#E2E8E5] bg-white p-8 text-center ${CARD_SHADOW}`}
        >
          <p className="text-[17px] font-bold text-[#0A0F1A]">{ui.preparingSchedule}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">{ui.noSessionsYet}</p>
        </section>
        <PatientLifetimeSummaryCard
          summary={plan.lifetimeSummary}
          lang={lang}
          textDir={textDir}
          arClass={arClass}
        />
        {plan.assignedBy ? (
          <ProviderCard
            assignedBy={plan.assignedBy}
            program={programName}
            ui={ui}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${arClass}`} dir={textDir}>
      <HeroSection
        homeTitle={homeTitle}
        greeting={ui.homeGreeting(firstName)}
        tagline={heroTagline}
        programName={programName}
        progressPercent={preview.progressPercent}
        completedCount={preview.completedCount}
        totalCount={preview.totalCount}
        progressLabel={ui.programProgressLabel}
        sessionsLeftLabel={ui.sessionsLeft(sessionsRemaining)}
      />

      <PatientLifetimeSummaryCard
        summary={plan.lifetimeSummary}
        lang={lang}
        textDir={textDir}
        arClass={arClass}
      />

      {preview.nextSession ? (
        <NextSessionCard
          sessionLabel={
            preview.stats.todayStatus === "completed_today"
              ? ui.todaySession
              : ui.nextSession
          }
          title={preview.nextSession.title}
          exerciseCount={preview.nextSession.exercises.length}
          motivation={
            canStart ? ui.nextSessionReady : ui.nextSessionDoneToday
          }
          completedLabel={ui.sessionHistoryCount(
            preview.completedCount,
            preview.totalCount,
          )}
          canStart={canStart}
          startHref={
            canStart && preview.stats.nextSessionId
              ? `/patient/${token}/session/${preview.stats.nextSessionId}`
              : null
          }
          startLabel={ui.startSessionCta}
          lang={lang}
        />
      ) : null}

      <WeeklyActivityStrip
        title={ui.weeklyActivityTitle}
        subtitle={ui.weeklyActivitySubtitle}
        days={preview.weeklyActivity}
      />

      <QuickStatsGrid
        title={ui.quickStatsPreview}
        stats={[
          {
            label: lang === "ar" ? "الجلسات" : "Sessions",
            value: `${preview.completedCount}/${preview.totalCount}`,
            accent: "#1D9E75",
          },
          {
            label: lang === "ar" ? "أيام نشطة" : "Active days",
            value: String(preview.view.activeDaysLast7),
            accent: "#0F766E",
          },
          {
            label: lang === "ar" ? "الإكمال" : "Completion",
            value: `${preview.progressPercent}%`,
            accent: "#14B8A6",
          },
          {
            label: lang === "ar" ? "الجهد" : "Effort",
            value:
              preview.view.averageEffort != null
                ? friendlyEffortLabel(Math.round(preview.view.averageEffort), lang)
                : "—",
            accent: "#6B7280",
            small: true,
          },
        ]}
      />

      <SectionCard
        title={ui.achievementsPreview}
        actionHref={`/patient/${token}/progress`}
        actionLabel={ui.viewAchievements}
      >
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
          {preview.view.achievements.map((badge) => (
            <span
              key={badge.id}
              className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-[13px] font-semibold ${
                badge.earned
                  ? "bg-[#E8F8F2] text-[#085041] ring-1 ring-[#B8E8D8]"
                  : "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}
            >
              {badge.earned ? "✓ " : "○ "}
              {badge.title}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={ui.recentActivityPreview}
        actionHref={`/patient/${token}/progress`}
        actionLabel={ui.viewRecentSessions}
      >
        {preview.view.recentSessions.length === 0 ? (
          <p className="text-[14px] text-[#6B7280]">{ui.recentEmptyFriendly}</p>
        ) : (
          <ul className="space-y-2.5">
            {preview.view.recentSessions.slice(0, 3).map((row) => (
              <li
                key={row.sessionId}
                className="flex items-center gap-3 rounded-[14px] bg-[#F8FAF9] px-4 py-3"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F8F2] text-[14px] font-bold text-[#1D9E75]"
                  aria-hidden
                >
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#0A0F1A]">
                    {row.title}
                  </p>
                  {row.completedAt ? (
                    <p className="text-[12px] text-[#9CA3AF]">
                      {formatPortalDate(row.completedAt, lang)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Link
        href={`/patient/${token}/progress`}
        className={`block rounded-[20px] border border-[#E2E8E5] bg-white p-5 transition hover:border-[#D1E7DE] ${CARD_SHADOW}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
              {ui.progressSummary}
            </p>
            <p className="mt-1 text-[22px] font-bold text-[#0A0F1A]">
              {preview.progressPercent}%
            </p>
          </div>
          <span className="text-[13px] font-semibold text-[#1D9E75]">
            {ui.viewFullProgress} →
          </span>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#E8EEEC]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#14B8A6] transition-all"
            style={{ width: `${preview.progressPercent}%` }}
          />
        </div>
      </Link>

      <PatientMovementCheckCard
        view={movementCheck}
        lang={lang}
        arClass={arClass}
        textDir={textDir}
      />

      {plan.assignedBy ? (
        <ProviderCard assignedBy={plan.assignedBy} program={programName} ui={ui} />
      ) : null}

      <div className="pb-2 text-center">
        <Link
          href={`/patient/${token}/sessions`}
          className="text-[14px] font-semibold text-[#1D9E75] hover:text-[#179165]"
        >
          {ui.viewAllSessions} →
        </Link>
      </div>
    </div>
  );
}

function HeroSection({
  homeTitle,
  greeting,
  tagline,
  programName,
  progressPercent,
  completedCount,
  totalCount,
  progressLabel,
  sessionsLeftLabel,
}: {
  homeTitle: string;
  greeting: string;
  tagline: string;
  programName: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  progressLabel: string;
  sessionsLeftLabel: string;
}) {
  const ringRadius = 42;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <section className="-mx-6 overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#071612] via-[#0C3D32] to-[#1D9E75] px-6 pb-8 pt-3 text-white shadow-[0_12px_40px_rgba(7,22,18,0.28)] md:-mx-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
        {homeTitle}
      </p>
      <h1
        className="mt-3 text-[30px] font-bold leading-[1.15] tracking-tight"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
      >
        {greeting}
      </h1>
      <p className="mt-2 max-w-[28rem] text-[14px] leading-relaxed text-white/85">
        {tagline}
      </p>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
            {progressLabel}
          </p>
          <p
            className="mt-1 truncate text-[18px] font-bold"
            style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
          >
            {programName}
          </p>
          <p className="mt-2 text-[13px] text-white/75">
            {completedCount}/{totalCount} · {sessionsLeftLabel}
          </p>
        </div>

        <div className="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center">
          <svg
            className="-rotate-90"
            width="104"
            height="104"
            viewBox="0 0 104 104"
            aria-hidden
          >
            <circle
              cx="52"
              cy="52"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="8"
            />
            <circle
              cx="52"
              cy="52"
              r={ringRadius}
              fill="none"
              stroke="#B8F5DF"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[22px] font-bold leading-none"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroEmpty({
  homeTitle,
  greeting,
  tagline,
}: {
  homeTitle: string;
  greeting: string;
  tagline: string;
}) {
  return (
    <section className="-mx-6 rounded-b-[32px] bg-gradient-to-br from-[#071612] via-[#0C3D32] to-[#1D9E75] px-6 pb-8 pt-3 text-white md:-mx-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
        {homeTitle}
      </p>
      <h1
        className="mt-3 text-[30px] font-bold leading-tight"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
      >
        {greeting}
      </h1>
      <p className="mt-2 text-[14px] text-white/85">{tagline}</p>
    </section>
  );
}

function NextSessionCard({
  sessionLabel,
  title,
  exerciseCount,
  motivation,
  completedLabel,
  canStart,
  startHref,
  startLabel,
  lang,
}: {
  sessionLabel: string;
  title: string;
  exerciseCount: number;
  motivation: string;
  completedLabel: string;
  canStart: boolean;
  startHref: string | null;
  startLabel: string;
  lang: PatientPortalLanguage;
}) {
  const exerciseLabel =
    lang === "ar"
      ? exerciseCount === 1
        ? "تمرين واحد"
        : `${exerciseCount} تمارين`
      : `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`;

  return (
    <section
      className={`-mt-5 rounded-[22px] border border-[#D1E7DE] bg-white p-5 ${CARD_SHADOW}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
        {sessionLabel}
      </p>
      <h2
        className="mt-2 text-[20px] font-bold leading-snug text-[#0A0F1A]"
        style={{ fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)" }}
      >
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-[#6B7280]">{exerciseLabel}</p>
      <p className="mt-3 text-[14px] leading-relaxed text-[#374151]">{motivation}</p>
      <p className="mt-2 text-[12px] font-medium text-[#9CA3AF]">{completedLabel}</p>

      {canStart && startHref ? (
        <Link
          href={startHref}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[#1D9E75] text-[16px] font-bold text-white shadow-[0_10px_24px_rgba(29,158,117,0.35)] transition hover:bg-[#179165] active:scale-[0.99]"
        >
          {startLabel}
        </Link>
      ) : null}
    </section>
  );
}

function WeeklyActivityStrip({
  title,
  subtitle,
  days,
}: {
  title: string;
  subtitle: string;
  days: ReturnType<typeof buildWorkspaceHomePreview>["weeklyActivity"];
}) {
  return (
    <section className={`rounded-[20px] border border-[#E2E8E5] bg-white p-5 ${CARD_SHADOW}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {title}
      </p>
      <p className="mt-0.5 text-[15px] font-bold text-[#0A0F1A]">{subtitle}</p>
      <div className="mt-4 flex items-end justify-between gap-2">
        {days.map((day, index) => (
          <div key={`${day.label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`w-full max-w-[2rem] rounded-full transition-all ${
                day.active
                  ? "bg-gradient-to-t from-[#1D9E75] to-[#5DCAA5]"
                  : "bg-[#E8EEEC]"
              } ${day.isToday ? "h-14 ring-2 ring-[#1D9E75]/30 ring-offset-2" : day.active ? "h-12" : "h-8"}`}
              aria-label={day.active ? "Active day" : "Inactive day"}
            />
            <span
              className={`text-[11px] font-bold ${
                day.isToday ? "text-[#1D9E75]" : "text-[#9CA3AF]"
              }`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickStatsGrid({
  title,
  stats,
}: {
  title: string;
  stats: {
    label: string;
    value: string;
    accent: string;
    small?: boolean;
  }[];
}) {
  return (
    <section className={`rounded-[20px] border border-[#E2E8E5] bg-white p-5 ${CARD_SHADOW}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {title}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[16px] bg-[#F8FAF9] px-4 py-3.5"
            style={{ borderTop: `3px solid ${stat.accent}` }}
          >
            <p
              className={`font-bold text-[#0A0F1A] ${stat.small ? "text-[14px]" : "text-[22px]"}`}
              style={
                stat.small
                  ? undefined
                  : { fontFamily: "var(--font-ibm-plex-mono, monospace)" }
              }
            >
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCard({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-[20px] border border-[#E2E8E5] bg-white p-5 ${CARD_SHADOW}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
          {title}
        </p>
        <Link href={actionHref} className="text-[12px] font-semibold text-[#1D9E75]">
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
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
    <section
      className={`rounded-[20px] border border-[#E2E8E5] bg-gradient-to-br from-white to-[#F8FAF9] p-5 ${CARD_SHADOW}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F8F2] text-[18px]"
          aria-hidden
        >
          🏥
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            {ui.providerClinic}
          </p>
          <p className="mt-1 text-[16px] font-bold text-[#0A0F1A]" dir="ltr">
            {assignedBy}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">{ui.providerCardSubtitle}</p>
          <p className="mt-1 truncate text-[12px] font-medium text-[#1D9E75]">{program}</p>
        </div>
      </div>
    </section>
  );
}
