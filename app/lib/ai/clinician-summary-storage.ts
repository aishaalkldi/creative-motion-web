/** Client-side persistence for approved AI session summaries (no server schema change). */

export type ApprovedAiSummaryRecord = {
  summary: string;
  generatedAt: string;
  approvedAt: string;
};

function approvedStorageKey(patientId: string, planId: string | null): string {
  return `rasq-ai-summary-approved:${patientId}:${planId ?? "latest"}`;
}

export function loadApprovedAiSummary(
  patientId: string,
  planId: string | null,
): ApprovedAiSummaryRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(approvedStorageKey(patientId, planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApprovedAiSummaryRecord;
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveApprovedAiSummary(
  patientId: string,
  planId: string | null,
  record: ApprovedAiSummaryRecord,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(approvedStorageKey(patientId, planId), JSON.stringify(record));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearApprovedAiSummary(patientId: string, planId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(approvedStorageKey(patientId, planId));
  } catch {
    /* ignore */
  }
}
