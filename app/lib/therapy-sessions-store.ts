/**
 * Browser-local therapy session log for clinician dashboard continuity.
 *
 * TODO: POST therapy summaries to FastAPI (patient_id, assessment_id, metrics blob)
 *       and remove localStorage in production or use only as offline cache.
 */

const STORAGE_KEY = "cm_therapy_sessions_v1";

export type TherapySessionLog = {
  id: string;
  patientId: string;
  recordedAt: string;
  programLabel: string;
  score: number;
  totalSteps: number;
  symmetryPct: number;
};

function readAll(): TherapySessionLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TherapySessionLog[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: TherapySessionLog[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* quota / private mode */
  }
}

export function recordTherapySessionLog(entry: TherapySessionLog): void {
  const rows = readAll();
  rows.unshift(entry);
  writeAll(rows.slice(0, 200));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cm-therapy-saved", { detail: { patientId: entry.patientId } }));
  }
}

export function listTherapySessionsForPatient(patientId: string): TherapySessionLog[] {
  const id = String(patientId).trim();
  if (!id) return [];
  return readAll().filter((r) => String(r.patientId).trim() === id);
}
