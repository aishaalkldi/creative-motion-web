/**
 * Browser-local therapy session log (offline cache + merge source).
 * Primary persistence: `therapy-session-persistence.ts` → FastAPI + PostgreSQL.
 */

import type { TherapyRecommendation } from "../therapy/lib/clinicalDecisionEngine";

const STORAGE_KEY = "cm_therapy_sessions_v1";

/** Defaults when therapy is not launched from a program deep link. */
export const DEFAULT_THERAPY_PROGRAM_ID = "general-gait";
export const DEFAULT_THERAPY_PHASE = "1";
export const DEFAULT_THERAPY_SESSION_TYPE = "gait-session";

/** Normalized origin of the therapy deep link. */
export type TherapySessionSource = "assessment" | "library";

/** Optional query context from `/therapy` deep links (library / program cards / assessment results). */
export type TherapyLibraryQueryContext = {
  source?: string;
  programId?: string;
  phase?: string;
  sessionType?: string;
  patientId?: string;
  /** Local or backend assessment id when launched from Results Review */
  assessmentId?: string;
  /** Human-readable rationale from assessment → therapy mapping */
  reason?: string;
};

export function normalizeTherapySessionSource(
  raw: string | null | undefined,
): TherapySessionSource {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "assessment") return "assessment";
  return "library";
}

export function resolveTherapyProgramContext(
  ctx: TherapyLibraryQueryContext | null | undefined,
): { programId: string; phase: string; sessionType: string } {
  const programId =
    (ctx?.programId && String(ctx.programId).trim()) || DEFAULT_THERAPY_PROGRAM_ID;
  const phase = (ctx?.phase && String(ctx.phase).trim()) || DEFAULT_THERAPY_PHASE;
  const sessionType =
    (ctx?.sessionType && String(ctx.sessionType).trim()) || DEFAULT_THERAPY_SESSION_TYPE;
  return { programId, phase, sessionType };
}

export type TherapySessionLog = {
  id: string;
  /** Server row id when persisted to PostgreSQL */
  backendRowId?: number;
  /** False when saved only to localStorage after API failure */
  backendSynced?: boolean;
  patientId: string;
  recordedAt: string;
  /** ISO timestamp; mirrors recordedAt on new saves */
  createdAt?: string;
  programLabel: string;
  exerciseName?: string;
  /** assessment | library (legacy rows may omit → treat as library in UI) */
  source?: string;
  /** Linked assessment when launched from Results Review */
  assessmentId?: string;
  /** Rationale copied from assessment-derived therapy context when present */
  therapyContextReason?: string;
  /** Resolved program routing; legacy rows may omit (use resolveTherapyProgramContext defaults when displaying). */
  programId?: string;
  phase?: string;
  sessionType?: string;
  /** In-app capture modality */
  mode?: string;
  score: number;
  totalSteps: number;
  /** Session length in seconds */
  duration?: number;
  /** Bilateral symmetry %; null when too few reps for a valid estimate */
  symmetryPct: number | null;
  /** Same as symmetryPct; explicit field for clinical exports */
  symmetry?: number | null;
  /** Same as symmetry / accuracyPct for exports */
  accuracy?: number | null;
  leftKneeCount?: number;
  rightKneeCount?: number;
  controlScore?: number | null;
  /** Mirrors step symmetry / timing; null = not enough data */
  accuracyPct?: number | null;
  fatigueIndex?: number | null;
  movementQuality?: number | null;
  confidenceLevel?: "High" | "Medium" | "Low";
  /** Rule-based therapy guidance snapshot at save time */
  therapyRecommendation?: TherapyRecommendation;
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
  if (process.env.NODE_ENV === "development") {
    console.log("Saved connected therapy result:", entry);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cm-therapy-saved", { detail: { patientId: entry.patientId } }));
  }
}

function normalizePatientKey(id: string): string {
  return String(id).trim();
}

export function listTherapySessionsForPatient(patientId: string): TherapySessionLog[] {
  const id = normalizePatientKey(patientId);
  if (!id) return [];
  return readAll()
    .filter((r) => normalizePatientKey(r.patientId) === id)
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
}

/** Latest therapy rows for a given assessment id (same patient), newest first. */
export function listTherapySessionsForAssessment(
  patientId: string,
  assessmentId: string,
): TherapySessionLog[] {
  const aid = String(assessmentId).trim();
  if (!aid) return [];
  return listTherapySessionsForPatient(patientId).filter(
    (r) => r.assessmentId != null && String(r.assessmentId).trim() === aid,
  );
}
