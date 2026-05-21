/**
 * Backend-first persistence for Camera CV therapy with localStorage fallback.
 */

import type { TherapyRecommendation } from "../therapy/lib/clinicalDecisionEngine";
import {
  createCameraTherapyReport,
  listCameraTherapyReports,
  type CameraTherapyReportCreate,
  type CameraTherapyReportOut,
} from "./api/therapy-reports";
import {
  listTherapySessionsForAssessment,
  listTherapySessionsForPatient,
  recordTherapySessionLog,
  type TherapySessionLog,
} from "./therapy-sessions-store";

export function isValidChartPatientId(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 && String(n) === s;
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Read first numeric metric from API JSON (camelCase + snake_case keys). */
function metricNumber(
  m: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function therapyLogToCreatePayload(
  entry: TherapySessionLog,
  patientNumericId: number,
): CameraTherapyReportCreate {
  const metrics: Record<string, unknown> = {
    score: entry.score,
    totalSteps: entry.totalSteps,
    duration: entry.duration,
    steps: entry.totalSteps,
    left_steps: entry.leftKneeCount,
    right_steps: entry.rightKneeCount,
    symmetry: entry.symmetry ?? entry.symmetryPct ?? entry.accuracy ?? null,
    duration_sec: entry.duration,
    symmetryPct: entry.symmetryPct,
    accuracy: entry.accuracy ?? null,
    leftKneeCount: entry.leftKneeCount,
    rightKneeCount: entry.rightKneeCount,
    controlScore: entry.controlScore ?? null,
    fatigueIndex: entry.fatigueIndex ?? null,
    movementQuality: entry.movementQuality ?? null,
    movement_quality: entry.movementQuality ?? null,
    confidenceLevel: entry.confidenceLevel ?? null,
    accuracyPct: entry.accuracyPct ?? null,
  };

  const assessmentIdRaw = entry.assessmentId?.trim();
  const assessment_id =
    assessmentIdRaw && /^\d+$/.test(assessmentIdRaw)
      ? Number.parseInt(assessmentIdRaw, 10)
      : null;

  return {
    patient_id: patientNumericId,
    assessment_id: assessment_id ?? undefined,
    client_session_id: entry.id,
    source: entry.source === "assessment" ? "assessment" : "library",
    program_id: entry.programId ?? "general-gait",
    phase: entry.phase ?? "1",
    session_type: entry.sessionType ?? "gait-session",
    mode: entry.mode ?? "camera-cv",
    program_label: entry.programLabel ?? null,
    exercise_name: entry.exerciseName ?? null,
    therapy_context_reason: entry.therapyContextReason ?? null,
    recorded_at: entry.recordedAt,
    metrics,
    therapy_recommendation: (entry.therapyRecommendation ?? null) as
      | Record<string, unknown>
      | null,
    provenance: {
      client: "creative-motion-web",
      storage: "postgresql",
    },
  };
}

export function cameraReportToTherapyLog(row: CameraTherapyReportOut): TherapySessionLog {
  const m = (row.metrics ?? {}) as Record<string, unknown>;
  const rec = row.therapy_recommendation as TherapyRecommendation | null;

  const totalSteps =
    metricNumber(m, "steps", "totalSteps") ?? numOrUndef(m.totalSteps) ?? 0;
  const leftKneeCount =
    metricNumber(m, "left_steps", "leftKneeCount") ?? numOrUndef(m.leftKneeCount);
  const rightKneeCount =
    metricNumber(m, "right_steps", "rightKneeCount") ??
    numOrUndef(m.rightKneeCount);
  const duration =
    metricNumber(m, "duration_sec", "duration") ?? numOrUndef(m.duration);
  const movementQuality =
    metricNumber(m, "movement_quality", "movementQuality") ??
    numOrNull(m.movementQuality);

  const symmetryCombined =
    metricNumber(m, "symmetry", "symmetryPct", "accuracyPct", "accuracy") ??
    numOrNull(m.symmetry) ??
    numOrNull(m.symmetryPct) ??
    numOrNull(m.accuracy);

  return {
    id: row.client_session_id,
    backendRowId: row.id,
    patientId: String(row.patient_id),
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    programLabel: row.program_label ?? "",
    exerciseName: row.exercise_name ?? undefined,
    source: row.source === "assessment" ? "assessment" : "library",
    assessmentId:
      row.assessment_id != null ? String(row.assessment_id) : undefined,
    therapyContextReason: row.therapy_context_reason ?? undefined,
    programId: row.program_id,
    phase: row.phase,
    sessionType: row.session_type,
    mode: row.mode,
    score: metricNumber(m, "score") ?? numOrUndef(m.score) ?? 0,
    totalSteps,
    duration,
    symmetryPct: symmetryCombined,
    symmetry: symmetryCombined,
    accuracy: numOrNull(m.accuracy),
    leftKneeCount,
    rightKneeCount,
    controlScore: numOrNull(m.controlScore),
    accuracyPct: numOrNull(m.accuracyPct),
    fatigueIndex: numOrNull(m.fatigueIndex),
    movementQuality,
    confidenceLevel: m.confidenceLevel as TherapySessionLog["confidenceLevel"],
    therapyRecommendation: rec ?? undefined,
    backendSynced: true,
  };
}

export type PersistTherapyResult = {
  backendSaved: boolean;
  localSaved: boolean;
  error?: string;
};

/**
 * POST to API first; on failure write localStorage only (offline / backend down).
 */
export async function persistTherapySessionWithFallback(
  entry: TherapySessionLog,
): Promise<PersistTherapyResult> {
  if (!isValidChartPatientId(entry.patientId)) {
    return {
      backendSaved: false,
      localSaved: false,
      error: "Invalid patient id — must be a positive integer matching backend patients.id",
    };
  }
  const patientNumericId = Number.parseInt(entry.patientId.trim(), 10);
  const payload = therapyLogToCreatePayload(entry, patientNumericId);

  try {
    const saved = await createCameraTherapyReport(payload);
    recordTherapySessionLog({
      ...entry,
      backendRowId: saved.id,
      backendSynced: true,
    });
    return { backendSaved: true, localSaved: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordTherapySessionLog({ ...entry, backendSynced: false });
    return { backendSaved: false, localSaved: true, error: msg };
  }
}

export type LoadTherapyOptions = { assessmentId?: string };

/**
 * Prefer backend rows; merge in local-only sessions (e.g. failed sync). On API error, local only.
 */
export async function loadTherapySessionsForDisplay(
  patientId: string,
  opts?: LoadTherapyOptions,
): Promise<TherapySessionLog[]> {
  const assessmentFilter = opts?.assessmentId?.trim();
  const localBase = assessmentFilter
    ? listTherapySessionsForAssessment(patientId, assessmentFilter)
    : listTherapySessionsForPatient(patientId);

  if (!isValidChartPatientId(patientId)) {
    return localBase;
  }

  /* Backend only stores numeric assessment_id; avoid mixing unscoped remote rows. */
  if (assessmentFilter && !/^\d+$/.test(assessmentFilter)) {
    return localBase;
  }

  const num = Number.parseInt(patientId.trim(), 10);
  let assessmentNum: number | undefined;
  if (assessmentFilter && /^\d+$/.test(assessmentFilter)) {
    assessmentNum = Number.parseInt(assessmentFilter, 10);
  }

  try {
    const remoteRows = await listCameraTherapyReports(num, assessmentNum);
    const remote = remoteRows.map(cameraReportToTherapyLog);
    const byId = new Map<string, TherapySessionLog>();
    for (const r of remote) {
      byId.set(r.id, r);
    }
    for (const l of localBase) {
      if (!byId.has(l.id)) {
        byId.set(l.id, l);
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  } catch {
    return localBase;
  }
}
