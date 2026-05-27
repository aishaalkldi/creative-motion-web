/**
 * Clinician-facing session activity formatting from existing plan/results fields.
 * No API calls, no clinical interpretation.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days without a logged session completion before showing the neutral follow-up badge. */
export const NO_RECENT_SESSION_DAYS = 7;

export type SessionActivityInput = {
  sessionsCompleted: number;
  totalSessions: number;
  lastSessionAt: string | null;
};

export function formatSessionsLine(completed: number, total: number): string | null {
  if (total <= 0) return null;
  return `Sessions: ${completed} of ${total}`;
}

export function formatSessionsCompletedLine(completed: number, total: number): string | null {
  if (total <= 0) return null;
  return `Sessions completed: ${completed} of ${total}`;
}

export function formatLastSessionDate(iso: string | null): string {
  if (!iso) return "No completed session yet";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "No completed session yet";
  }
}

export function formatLastSessionLine(iso: string | null): string {
  return `Last session: ${formatLastSessionDate(iso)}`;
}

export function formatLastSessionCompletedLine(iso: string | null): string {
  return `Last session: ${formatLastSessionDate(iso)}`;
}

export function daysSince(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

/**
 * Neutral badge when a plan has scheduled sessions but none completed recently.
 */
export function shouldShowNoRecentSessionBadge(input: {
  totalSessions: number;
  lastSessionAt: string | null;
}): boolean {
  if (input.totalSessions <= 0) return false;
  if (!input.lastSessionAt) return true;
  const days = daysSince(input.lastSessionAt);
  if (days === null) return false;
  return days > NO_RECENT_SESSION_DAYS;
}

export const OPERATIONAL_STATUS_ONLY = "Operational status only";
