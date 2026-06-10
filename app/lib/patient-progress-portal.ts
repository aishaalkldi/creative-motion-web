/**
 * Patient Progress Portal v1 — derived view models from existing plan + log data only.
 */

import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import type { PatientPlanData, PatientSession } from "@/app/api/patient/plan/route";
import { MOVE_BETTER_PERFORMANCE_V1_ID } from "@/app/lib/move-better-performance-v1";
import type { MotivationStats } from "@/app/lib/patient-motivation";

export type ProgressProgramKind = "sports_knee" | "move_better" | "general";

export type PatientProgressAchievement = {
  id: string;
  title: string;
  earned: boolean;
};

export type PatientExerciseHighlight = {
  exerciseId: string;
  name: string;
  sessionCount: number;
};

export type PatientRecentSessionRow = {
  sessionId: string;
  sessionNumber: number;
  title: string;
  completedAt: string | null;
  exercisesCompleted: number;
  effortLabel: string | null;
  comfortLabel: string | null;
};

export type PatientProgressPortalView = {
  programKind: ProgressProgramKind;
  progressPercent: number;
  completedSessions: number;
  totalSessions: number;
  currentWeek: number | null;
  totalWeeks: number | null;
  activeDaysLast7: number;
  averageEffort: number | null;
  nextSession: PatientSession | null;
  achievements: PatientProgressAchievement[];
  exerciseHighlights: PatientExerciseHighlight[];
  recentSessions: PatientRecentSessionRow[];
};

const SPORTS_KNEE_TEMPLATE_PREFIX = "sports-knee";

export function resolveProgressProgramKind(input: {
  programTemplateId?: string | null;
  programName?: string | null;
  planTitle?: string | null;
}): ProgressProgramKind {
  const templateId = input.programTemplateId?.trim().toLowerCase() ?? "";
  const label = `${input.programName ?? ""} ${input.planTitle ?? ""}`.toLowerCase();

  if (
    templateId === MOVE_BETTER_PERFORMANCE_V1_ID ||
    templateId.includes("move-better") ||
    label.includes("move better")
  ) {
    return "move_better";
  }

  if (templateId.startsWith(SPORTS_KNEE_TEMPLATE_PREFIX) || label.includes("sports knee")) {
    return "sports_knee";
  }

  return "general";
}

export function friendlyEffortLabel(score: number, lang: "en" | "ar"): string {
  if (lang === "ar") {
    if (score <= 3) return "جهد خفيف";
    if (score <= 6) return "جهد معتدل";
    if (score <= 8) return "جهد قوي";
    return "جهد عالٍ";
  }
  if (score <= 3) return "Light effort";
  if (score <= 6) return "Moderate effort";
  if (score <= 8) return "Strong effort";
  return "High effort";
}

export function friendlyComfortLabel(score: number, lang: "en" | "ar"): string {
  if (lang === "ar") {
    if (score <= 3) return "مريح";
    if (score <= 6) return "مقبول";
    if (score <= 8) return "مُجهد";
    return "صعب";
  }
  if (score <= 3) return "Comfortable";
  if (score <= 6) return "Manageable";
  if (score <= 8) return "Challenging";
  return "Very tough";
}

function buildAchievements(
  stats: MotivationStats,
  lang: "en" | "ar",
): PatientProgressAchievement[] {
  const en = lang === "en";
  return [
    {
      id: "first_session",
      title: en ? "First session done" : "أول جلسة مكتملة",
      earned: stats.completed >= 1,
    },
    {
      id: "halfway",
      title: en ? "Halfway there" : "منتصف الطريق",
      earned: stats.total > 0 && stats.completed >= Math.ceil(stats.total / 2),
    },
    {
      id: "active_week",
      title: en ? "Active this week" : "نشط هذا الأسبوع",
      earned: stats.activeDaysLast7 >= 2,
    },
    {
      id: "consistent",
      title: en ? "Building consistency" : "بناء الانتظام",
      earned: stats.activeDaysLast7 >= 3,
    },
    {
      id: "program_complete",
      title: en ? "Program complete" : "اكتمل البرنامج",
      earned: stats.total > 0 && stats.completed >= stats.total,
    },
  ];
}

function buildExerciseHighlights(
  sessions: PatientSession[],
  logsBySessionId: Map<string, SessionLogEntry>,
): PatientExerciseHighlight[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const session of sessions) {
    if (session.status !== "completed") continue;
    if (!logsBySessionId.has(session.id) && !session.completedAt) continue;

    for (const exercise of session.exercises) {
      const current = counts.get(exercise.exerciseId) ?? {
        name: exercise.name,
        count: 0,
      };
      counts.set(exercise.exerciseId, {
        name: exercise.name,
        count: current.count + 1,
      });
    }
  }

  return [...counts.entries()]
    .map(([exerciseId, value]) => ({
      exerciseId,
      name: value.name,
      sessionCount: value.count,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 4);
}

function buildRecentSessions(
  sessions: PatientSession[],
  logsBySessionId: Map<string, SessionLogEntry>,
  lang: "en" | "ar",
): PatientRecentSessionRow[] {
  const completed = sessions
    .filter((s) => s.status === "completed")
    .map((session) => {
      const log = logsBySessionId.get(session.id);
      const completedAt = log?.completedAt ?? session.completedAt ?? null;
      return { session, log, completedAt };
    })
    .filter((row) => row.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    )
    .slice(0, 5);

  return completed.map(({ session, log, completedAt }) => ({
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    title: session.title,
    completedAt,
    exercisesCompleted: log?.exercisesCompleted ?? session.exercises.length,
    effortLabel:
      log?.effortScore != null ? friendlyEffortLabel(log.effortScore, lang) : null,
    comfortLabel:
      log?.painScore != null ? friendlyComfortLabel(log.painScore, lang) : null,
  }));
}

export function buildPatientProgressPortalView(
  plan: PatientPlanData,
  logs: SessionLogEntry[],
  stats: MotivationStats,
  lang: "en" | "ar",
): PatientProgressPortalView {
  const completedSessions = stats.completed;
  const totalSessions = stats.total;
  const progressPercent =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const sessionsPerWeek = plan.sessionsPerWeek ?? 3;
  const totalWeeks = plan.totalWeeks;
  const currentWeek =
    totalWeeks != null && totalWeeks > 0
      ? Math.min(Math.ceil((completedSessions + 1) / sessionsPerWeek), totalWeeks)
      : null;

  const logsBySessionId = new Map<string, SessionLogEntry>();
  for (const log of logs) {
    if (!log.planSessionId) continue;
    const existing = logsBySessionId.get(log.planSessionId);
    if (
      !existing ||
      new Date(log.completedAt).getTime() > new Date(existing.completedAt).getTime()
    ) {
      logsBySessionId.set(log.planSessionId, log);
    }
  }

  const effortScores = logs
    .map((l) => l.effortScore)
    .filter((s): s is number => s != null);
  const averageEffort =
    effortScores.length > 0
      ? Math.round(
          (effortScores.reduce((sum, s) => sum + s, 0) / effortScores.length) * 10,
        ) / 10
      : null;

  const nextSession = plan.sessions.find((s) => s.status !== "completed") ?? null;

  return {
    programKind: resolveProgressProgramKind({
      programTemplateId: plan.programTemplateId,
      programName: plan.programName,
      planTitle: plan.planTitle,
    }),
    progressPercent,
    completedSessions,
    totalSessions,
    currentWeek,
    totalWeeks,
    activeDaysLast7: stats.activeDaysLast7,
    averageEffort,
    nextSession,
    achievements: buildAchievements(stats, lang),
    exerciseHighlights: buildExerciseHighlights(plan.sessions, logsBySessionId),
    recentSessions: buildRecentSessions(plan.sessions, logsBySessionId, lang),
  };
}
