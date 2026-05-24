/**
 * Display-only session grouping for patient portal and clinician plan views.
 * Does not mutate database rows.
 */

import type { StoredExercise } from "./exercise-prescription";
import { getExerciseDisplayNameFromStored } from "./exercise-resolve";

export type SchedulableSession = {
  id: string;
  sessionNumber: number;
  title: string;
  /** Legacy strings or structured prescriptions from plan_sessions.exercises jsonb */
  exercises?: StoredExercise[];
  status: string;
  completedAt?: string | null;
  scheduledAt?: string | null;
};

export function getSchedulableExerciseNames(session: SchedulableSession): string[] {
  return (session.exercises ?? []).map(getExerciseDisplayNameFromStored);
}

export type SessionDayGroup = {
  dayLabel: string;
  sessions: SchedulableSession[];
};

export type SessionWeekGroup = {
  weekLabel: string;
  weekIndex: number;
  days: SessionDayGroup[];
};

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function weekIndexFromSessionNumber(sessionNumber: number, sessionsPerWeek: number): number {
  const perWeek = Math.max(1, sessionsPerWeek);
  return Math.ceil(sessionNumber / perWeek);
}

function dayIndexInWeek(sessionNumber: number, sessionsPerWeek: number): number {
  const perWeek = Math.max(1, sessionsPerWeek);
  return ((sessionNumber - 1) % perWeek) + 1;
}

/** Group by scheduled_at when any session has it; otherwise synthetic week/day from session number. */
export function groupSessionsBySchedule(
  sessions: SchedulableSession[],
  sessionsPerWeek: number,
): SessionWeekGroup[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);
  const hasScheduled = sorted.some((s) => s.scheduledAt);

  if (hasScheduled) {
    const byWeek = new Map<string, Map<string, SchedulableSession[]>>();

    for (const s of sorted) {
      const sched = s.scheduledAt ? new Date(s.scheduledAt) : null;
      let weekKey: string;
      let weekLabel: string;
      let dayKey: string;
      let dayLabel: string;

      if (sched && !Number.isNaN(sched.getTime())) {
        const start = new Date(sched);
        start.setHours(0, 0, 0, 0);
        const day = start.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        start.setDate(start.getDate() + diff);
        weekKey = start.toISOString().slice(0, 10);
        weekLabel = `Week of ${formatShortDate(weekKey)}`;
        dayKey = s.scheduledAt!.slice(0, 10);
        dayLabel = formatShortDate(s.scheduledAt!);
      } else {
        const wi = weekIndexFromSessionNumber(s.sessionNumber, sessionsPerWeek);
        const di = dayIndexInWeek(s.sessionNumber, sessionsPerWeek);
        weekKey = `syn-week-${wi}`;
        weekLabel = `Week ${wi}`;
        dayKey = `syn-day-${wi}-${di}`;
        dayLabel = `Day ${di}`;
      }

      if (!byWeek.has(weekKey)) byWeek.set(weekKey, new Map());
      const weekMap = byWeek.get(weekKey)!;
      if (!weekMap.has(dayKey)) weekMap.set(dayKey, []);
      weekMap.get(dayKey)!.push(s);
    }

    return [...byWeek.entries()].map(([weekKey, dayMap], i) => ({
      weekLabel: weekKey.startsWith("syn-week-")
        ? `Week ${weekKey.replace("syn-week-", "")}`
        : `Week of ${formatShortDate(weekKey)}`,
      weekIndex: i + 1,
      days: [...dayMap.entries()].map(([dayKey, daySessions]) => ({
        dayLabel: dayKey.startsWith("syn-day-")
          ? `Day ${dayKey.split("-").pop()}`
          : formatShortDate(daySessions[0]?.scheduledAt ?? dayKey),
        sessions: daySessions,
      })),
    }));
  }

  const perWeek = Math.max(1, sessionsPerWeek);
  const maxWeek = Math.ceil(sorted.length / perWeek);
  const weeks: SessionWeekGroup[] = [];

  for (let w = 1; w <= maxWeek; w++) {
    const weekSessions = sorted.filter(
      (s) => weekIndexFromSessionNumber(s.sessionNumber, perWeek) === w,
    );
    const days: SessionDayGroup[] = [];
    for (let d = 1; d <= perWeek; d++) {
      const daySessions = weekSessions.filter(
        (s) => dayIndexInWeek(s.sessionNumber, perWeek) === d,
      );
      if (daySessions.length > 0) {
        days.push({ dayLabel: `Day ${d}`, sessions: daySessions });
      }
    }
    if (days.length > 0) {
      weeks.push({ weekLabel: `Week ${w}`, weekIndex: w, days });
    }
  }

  return weeks;
}
