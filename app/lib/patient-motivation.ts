/**
 * Sprint V — derived motivation stats from existing plan sessions and completion logs.
 * No database schema changes.
 */

export type SessionLike = {
  id: string;
  status: string;
  completedAt?: string | null;
};

export type LogLike = {
  completedAt: string;
};

export type TodaySessionStatus = "none" | "ready" | "completed_today" | "all_complete";

export type MotivationStats = {
  completed: number;
  total: number;
  remaining: number;
  todayStatus: TodaySessionStatus;
  nextSessionId: string | null;
  activeDaysLast7: number;
  lastActivityAt: string | null;
};

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}

function collectActivityDates(sessions: SessionLike[], logs: LogLike[]): Date[] {
  const dates: Date[] = [];
  for (const session of sessions) {
    if (session.status === "completed" && session.completedAt) {
      const d = new Date(session.completedAt);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  }
  for (const log of logs) {
    const d = new Date(log.completedAt);
    if (!Number.isNaN(d.getTime())) dates.push(d);
  }
  return dates;
}

export function computeMotivationStats(
  sessions: SessionLike[],
  logs: LogLike[] = [],
): MotivationStats {
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const remaining = Math.max(0, total - completed);
  const nextPending = sessions.find((s) => s.status !== "completed") ?? null;
  const now = new Date();

  let todayStatus: TodaySessionStatus = "none";
  if (total === 0) {
    todayStatus = "none";
  } else if (remaining === 0) {
    todayStatus = "all_complete";
  } else if (nextPending) {
    const completedToday = sessions.some(
      (s) =>
        s.status === "completed" &&
        s.completedAt &&
        isSameLocalDay(new Date(s.completedAt), now),
    );
    const logToday = logs.some((l) => isSameLocalDay(new Date(l.completedAt), now));
    todayStatus = completedToday || logToday ? "completed_today" : "ready";
  }

  const activityDates = collectActivityDates(sessions, logs);
  const sevenDaysAgo = startOfLocalDay(now) - 6 * 24 * 60 * 60 * 1000;
  const uniqueDays = new Set<number>();
  for (const d of activityDates) {
    const day = startOfLocalDay(d);
    if (day >= sevenDaysAgo) uniqueDays.add(day);
  }

  const lastActivityAt =
    activityDates.length > 0
      ? activityDates
          .sort((a, b) => b.getTime() - a.getTime())[0]
          .toISOString()
      : null;

  return {
    completed,
    total,
    remaining,
    todayStatus,
    nextSessionId: nextPending?.id ?? null,
    activeDaysLast7: uniqueDays.size,
    lastActivityAt,
  };
}
