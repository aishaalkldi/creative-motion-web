/**
 * session-store.ts
 *
 * Persists Creative Motion rehabilitation session records in localStorage.
 * All functions guard against server-side execution (typeof window) so this
 * module can be imported in both RSC and client contexts without errors.
 *
 * Storage key versioned to "cm_sessions_v1".
 * All new fields are optional for full backward compatibility.
 */

/* ── Re-export biomechanics types so consumers don't need a separate import ── */
export type { BiomechanicsData, StepMetrics } from "./gait/biomechanics";

/* ── Types ──────────────────────────────────────────────────────────────── */

import type { BiomechanicsData } from "./gait/biomechanics";
import { PROGRAMS, type ProgramId } from "./programs";

export type { ProgramId };

/* ── Schema versioning ──────────────────────────────────────────────────── */

/**
 * Current schema version of SessionRecord.
 *
 * Increment this when a breaking structural change is made (field renamed,
 * type narrowed, required field added). Minor additions (new optional fields)
 * do NOT require a version bump — they are backward-compatible by convention.
 *
 * Records created before this field was introduced are implicitly version "1".
 * Consumers should treat a missing schemaVersion as "1".
 */
export const SESSION_SCHEMA_VERSION = "1" as const;
export type SessionSchemaVersion = typeof SESSION_SCHEMA_VERSION;

/**
 * Therapist quality label assigned per session.
 * "unlabeled" is the default — no therapist review has occurred.
 *
 * Session-quality labels (describe how the patient performed):
 *   good            — patient performed well; targets may be advanced
 *   acceptable      — performance meets minimum rehab threshold
 *   poor_control    — step-height consistency or bilateral control was poor
 *   fatigue_limited — patient's output dropped in second half (fatigue pattern)
 *   unsafe          — concerning movement pattern; do NOT advance without review
 *
 * Data-quality labels (describe measurement validity, not patient performance):
 *   technical_error — detection or software anomaly may have affected counts
 *   camera_issue    — camera framing, occlusion, or landmark quality was poor
 *
 * Backward-compatibility:
 *   poor            — legacy label; kept valid so older records deserialise correctly
 *
 *   unlabeled       — no human review yet
 *
 * All labels are decision-support only — not clinical diagnoses.
 */
export type TherapistLabel =
  | "good"
  | "acceptable"
  | "poor_control"
  | "fatigue_limited"
  | "technical_error"
  | "camera_issue"
  | "unsafe"
  | "poor"          // legacy — kept for backward compatibility
  | "unlabeled";

/**
 * Validation log — lightweight structure enabling future comparison of
 * app-computed metrics against independent manual review (e.g. video analysis).
 *
 * Fields are all optional; the structure is populated progressively:
 *   1. Researcher flags the session (flaggedAt is set).
 *   2. Manual review is performed offline (e.g. video coding).
 *   3. Manual values are entered (via CSV import or future UI).
 *   4. Discrepancy note records any meaningful difference.
 *
 * This is not a replacement for clinical validation — it is a logging scaffold
 * to support future accuracy studies. No fields here should drive clinical decisions.
 */
export interface ValidationLog {
  /** ISO 8601 datetime when this session was flagged for independent review. */
  flaggedAt?: string;
  /**
   * Step count from independent manual review (e.g. video frame counting).
   * Compare against SessionRecord.totalSteps to assess detection accuracy.
   */
  manualStepCount?: number;
  /**
   * Movement quality score assigned by a human reviewer (0–100).
   * Compare against BiomechanicsData.movementQualityScore.
   */
  manualMovementQuality?: number;
  /** Who performed the manual review. */
  reviewSource?: "therapist" | "researcher" | "video_review";
  /**
   * Free-text note on any discrepancy between app measurement and manual review.
   * E.g. "App overcounted by 3 — contralateral sway triggered false positives."
   */
  discrepancyNote?: string;
}

export interface SessionRecord {
  /** Unique session identifier (timestamp + random suffix). */
  id: string;
  /**
   * Schema version of this record. Always stamped by saveSession().
   * Optional for backward compatibility — records created before versioning
   * was introduced are implicitly schema version "1".
   * The main platform uses this to detect and handle schema migrations.
   */
  schemaVersion?: SessionSchemaVersion;
  /** Patient identifier entered by the user, e.g. "PT-001". */
  patientId: string;
  /**
   * Stable identifier of the rehabilitation program this session belongs to.
   * Set to PROGRAMS.GAIT_TRAINING.id ("gait_training") by saveSession() unless
   * overridden by the caller.
   *
   * Optional for backward compatibility: records created before this field was
   * introduced have no programId. Treat them as belonging to "gait_training"
   * (the only program that existed at that time).
   *
   * Integration note: this is the primary key the main platform will use to
   * query sessions by program. Never hardcode the string — always use PROGRAMS.
   */
  programId?: ProgramId;
  /** ISO 8601 date-time of when the session was saved. */
  date: string;
  /** Planned session duration in seconds. */
  durationSec: number;
  /** Total score accumulated from real knee-lift events. */
  score: number;
  /** Total detected knee lifts (left + right). */
  totalSteps: number;
  /** Left knee lifts only. */
  leftSteps: number;
  /** Right knee lifts only. */
  rightSteps: number;
  /** Bilateral symmetry score 0–100. */
  symmetryPct: number;
  /** Highest consecutive step streak recorded in this session. */
  bestCombo: number;
  /** Average steps per minute for this session. */
  stepsPerMin: number;
  /**
   * Biomechanical metrics computed from joint angles and movement patterns.
   * Undefined for sessions recorded before biomechanics tracking was added.
   */
  biomechanics?: BiomechanicsData;

  /* ── Extended analytics fields (added in v2 — all optional) ── */

  /**
   * Fatigue proxy: 0 = no fatigue (equal output in both halves),
   * 1 = severe (step rate dropped to zero in second half).
   * Computed from step timestamp distribution.
   */
  fatigueIndex?: number;
  /**
   * Percentage of playing-phase frames in which the pose was detected.
   * 0–100. Low values indicate the patient was partially out of frame.
   */
  cameraVisibilityScore?: number;
  /** Automated warning strings generated at save time. */
  warnings?: string[];
  /** Short positive feedback messages generated at save time. */
  feedbackMessages?: string[];

  /* ── Therapist human-in-the-loop fields ── */

  /** Therapist quality label. Defaults to "unlabeled" until reviewed. */
  therapistLabel?: TherapistLabel;
  /** Free-text clinical observations entered by the therapist. */
  therapistNotes?: string;
  /**
   * True only after an authorised therapist has explicitly approved this record
   * for use in model training or clinical reporting.
   */
  approvedByTherapist?: boolean;

  /* ── Validation scaffold (all optional — populated progressively) ── */

  /**
   * Lightweight log for future comparison of app results against manual review.
   * Populated by flagForReview() and updateValidationLog().
   * Not present on sessions recorded before this feature was added.
   */
  validationLog?: ValidationLog;

  /* ── Prescribed session plan linkage (added in v3 — all optional) ── */

  /**
   * ID of the SessionPlan that was active when this session was completed.
   * Undefined for sessions recorded before the prescription system was added.
   */
  planId?: string;

  /**
   * Stable exercise identifier (e.g. "high_knee_march") for the exercise
   * performed in this session. Copied directly from SessionPlan.exerciseId
   * at save time so each record is self-contained.
   *
   * Optional for backward compatibility: records created before this field
   * was introduced have no exerciseId. Callers that need the exercise for
   * older records can fall back to resolving via planId → SessionPlan, or
   * assume "high_knee_march" (the only exercise in V1).
   *
   * Integration note: the main platform will use this as a filter key to
   * group sessions by exercise without traversing the plan relationship.
   * Keep this in sync with the exercise slug registry in gait-progression.ts.
   */
  exerciseId?: string;

  /**
   * Outcome evaluation: each target from the active plan measured against
   * the values recorded in this session.
   * Stored as plain objects to avoid circular imports with session-plan.ts.
   */
  targetAchievements?: Array<{
    metric:       string;
    label:        string;
    threshold:    number;
    thresholdMax: number | undefined;
    operator:     string;
    actualValue:  number;
    achieved:     boolean;
  }>;
}

/* ── Public API contract (for main platform / API adapter) ─────────────── */

/**
 * Intentionally narrow subset of SessionRecord for consumption by the main
 * Creative Motion platform, API adapters, analytics pipelines, and future
 * integrations.
 *
 * Design decisions — what is EXCLUDED and why:
 *
 *   feedbackMessages     — auto-generated motivational UI strings; not clinical
 *                          data and not meaningful outside the session screen.
 *
 *   therapistNotes       — free-text field; PII risk; belongs in a dedicated
 *                          therapist workflow API with appropriate access controls,
 *                          not in the general session data contract.
 *
 *   approvedByTherapist  — internal human-in-the-loop gate for ML training;
 *                          the main platform has no need to consume this flag
 *                          before a formal therapist dashboard exists.
 *
 *   validationLog        — internal research accuracy scaffold (manualStepCount,
 *                          flaggedAt, discrepancyNote, etc.); populated only by
 *                          researchers doing manual review; not for platform API.
 *
 * Decision-support only · Not a clinical record · Therapist review required.
 */
export interface PublicSessionRecord {
  /** Schema version — use this to detect and handle format migrations. */
  schemaVersion:  SessionSchemaVersion;

  /* ── Identity ── */
  id:             string;
  patientId:      string;
  /** Program this session belongs to. Defaults to "gait_training" for legacy records. */
  programId:      string;
  /** Exercise performed (e.g. "high_knee_march"). Self-contained — no plan lookup needed. */
  exerciseId?:    string;
  /** ID of the active prescription plan at session time. */
  planId?:        string;
  /** ISO 8601 date-time the session was saved. */
  date:           string;

  /* ── Session metrics ── */
  durationSec:    number;
  totalSteps:     number;
  leftSteps:      number;
  rightSteps:     number;
  symmetryPct:    number;
  stepsPerMin:    number;
  bestCombo:      number;
  /** Activity score (totalSteps × point value). Useful for engagement analytics. */
  score:          number;

  /* ── Extended analytics ── */
  /** Fatigue proxy: 0 = no fatigue, 1 = severe. Undefined for older records. */
  fatigueIndex?:          number;
  /** Frame-level pose detection coverage 0–100. Low values = patient partly off-frame. */
  cameraVisibilityScore?: number;

  /* ── Clinical signals ── */
  /** Structured biomechanical metrics. Undefined for pre-biomechanics records. */
  biomechanics?:       BiomechanicsData;
  /** Prescription target outcomes — what was aimed for vs. what was achieved. */
  targetAchievements?: SessionRecord["targetAchievements"];
  /** Therapist quality label. "unlabeled" until a human reviews the session. */
  therapistLabel?:     TherapistLabel;
  /** Automated clinical risk flags generated at save time. */
  warnings?:           string[];
}

/**
 * Convert a single SessionRecord to its public API shape.
 *
 * Strips internal scaffolding and supplies safe defaults for fields
 * introduced after record creation (schemaVersion, programId).
 *
 * Old records without schemaVersion are treated as version "1" — they were
 * all created before versioning existed, which is by definition schema v1.
 */
export function toPublicRecord(session: SessionRecord): PublicSessionRecord {
  return {
    schemaVersion:         session.schemaVersion ?? SESSION_SCHEMA_VERSION,
    id:                    session.id,
    patientId:             session.patientId,
    programId:             session.programId  ?? PROGRAMS.GAIT_TRAINING.id,
    exerciseId:            session.exerciseId,
    planId:                session.planId,
    date:                  session.date,
    durationSec:           session.durationSec,
    totalSteps:            session.totalSteps,
    leftSteps:             session.leftSteps,
    rightSteps:            session.rightSteps,
    symmetryPct:           session.symmetryPct,
    stepsPerMin:           session.stepsPerMin,
    bestCombo:             session.bestCombo,
    score:                 session.score,
    fatigueIndex:          session.fatigueIndex,
    cameraVisibilityScore: session.cameraVisibilityScore,
    biomechanics:          session.biomechanics,
    targetAchievements:    session.targetAchievements,
    therapistLabel:        session.therapistLabel,
    warnings:              session.warnings,
  };
}

/**
 * Convert an array of SessionRecords to their public API shapes.
 * Convenience wrapper for the common batch-export use case.
 *
 * @example
 *   const payload = toPublicRecords(loadPatientSessions(patientId));
 *   await api.post("/sessions/sync", payload);
 */
export function toPublicRecords(sessions: SessionRecord[]): PublicSessionRecord[] {
  return sessions.map(toPublicRecord);
}

/* ── Internal helpers ───────────────────────────────────────────────────── */

const STORE_KEY = "cm_sessions_v1";
const PID_KEY   = "cm_patient_id";

function isClient(): boolean {
  return typeof window !== "undefined";
}

function readStore(): SessionRecord[] {
  if (!isClient()) return [];
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as SessionRecord[];
  } catch {
    return [];
  }
}

function writeStore(records: SessionRecord[]): void {
  if (!isClient()) return;
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

/* ── Public API — CRUD ──────────────────────────────────────────────────── */

/**
 * Save a new session record and return the stored record with its generated ID.
 * therapistLabel defaults to "unlabeled".
 */
export function saveSession(
  session: Omit<SessionRecord, "id">,
): SessionRecord {
  const record: SessionRecord = {
    schemaVersion:  SESSION_SCHEMA_VERSION,
    therapistLabel: "unlabeled",
    // Default to gait_training — the only program in V1.
    // Caller can override by including programId in the session argument.
    programId: PROGRAMS.GAIT_TRAINING.id,
    ...session,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };
  const all = readStore();
  all.push(record);
  writeStore(all);
  return record;
}

/**
 * All sessions for a specific patient, sorted chronologically (oldest first).
 *
 * @param patientId  - Opaque patient identifier (e.g. "PT-001").
 * @param options    - Optional filters applied after the patient match.
 *   options.programId — when provided, only sessions belonging to this program
 *     are returned. Records without a programId field (created before V1 of
 *     the programs system) are assumed to belong to "gait_training" for full
 *     backward compatibility.
 *
 * Alias exported as `getPatientSessions` for ML-oriented callers.
 */
export function loadPatientSessions(
  patientId: string,
  options?: { programId?: ProgramId },
): SessionRecord[] {
  return readStore()
    .filter((s) => {
      if (s.patientId !== patientId) return false;
      if (options?.programId) {
        // Records without programId pre-date the programs system.
        // Treat them as gait_training — the only program that existed then.
        const recordProgram = s.programId ?? PROGRAMS.GAIT_TRAINING.id;
        return recordProgram === options.programId;
      }
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
export const getPatientSessions = loadPatientSessions;

/**
 * Every stored session across all patients, sorted chronologically.
 */
export function loadAllSessions(): SessionRecord[] {
  return readStore().sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/**
 * Sorted list of unique patient IDs present in the store.
 */
export function getAllPatientIds(): string[] {
  const ids = new Set(readStore().map((s) => s.patientId));
  return Array.from(ids).sort();
}

/**
 * Remove all sessions for a specific patient.
 */
export function clearPatientSessions(patientId: string): void {
  writeStore(readStore().filter((s) => s.patientId !== patientId));
}

/**
 * Read the last-used patient ID from localStorage.
 * Falls back to "PT-001" if none is stored.
 */
export function getStoredPatientId(): string {
  if (!isClient()) return "PT-001";
  return localStorage.getItem(PID_KEY) ?? "PT-001";
}

/**
 * Persist the current patient ID so it pre-fills on next visit.
 */
export function storePatientId(id: string): void {
  if (!isClient()) return;
  localStorage.setItem(PID_KEY, id.trim() || "PT-001");
}

/* ── Therapist labeling ─────────────────────────────────────────────────── */

/**
 * Update the therapist label, notes, and approval flag for a single session.
 * Returns the updated record, or null if the sessionId was not found.
 *
 * Human-in-the-loop: only labelled + approved sessions are used for model training.
 * This function never auto-prescribes treatment — it records the therapist's judgment.
 */
export function updateTherapistLabel(
  sessionId: string,
  label: TherapistLabel,
  notes?: string,
  approved?: boolean,
): SessionRecord | null {
  const all = readStore();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  all[idx] = {
    ...all[idx],
    therapistLabel: label,
    therapistNotes:       notes   !== undefined ? notes   : all[idx].therapistNotes,
    approvedByTherapist:  approved !== undefined ? approved : all[idx].approvedByTherapist,
  };
  writeStore(all);
  return all[idx];
}

/* ── Validation log ─────────────────────────────────────────────────────── */

/**
 * Mark a session as flagged for independent manual review.
 * Sets validationLog.flaggedAt to the current timestamp.
 * Safe to call multiple times — only updates the timestamp.
 *
 * After flagging, the researcher performs manual review offline and enters
 * results via updateValidationLog() or by editing and re-importing the CSV.
 */
export function flagForReview(sessionId: string): SessionRecord | null {
  const all = readStore();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    validationLog: {
      ...all[idx].validationLog,
      flaggedAt: new Date().toISOString(),
    },
  };
  writeStore(all);
  return all[idx];
}

/**
 * Merge manual review data into a session's validation log.
 * Partial updates are safe — only provided keys are overwritten.
 */
export function updateValidationLog(
  sessionId: string,
  log: Partial<ValidationLog>,
): SessionRecord | null {
  const all = readStore();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    validationLog: {
      ...all[idx].validationLog,
      ...log,
    },
  };
  writeStore(all);
  return all[idx];
}

/* ── CSV export / import ────────────────────────────────────────────────── */

/** CSV column order — stable across versions. */
const CSV_HEADERS = [
  "sessionId", "patientId", "date", "durationSec",
  "totalSteps", "leftSteps", "rightSteps",
  "symmetryPct", "stepsPerMin", "score", "bestCombo",
  "avgLeftKneeAngle", "avgRightKneeAngle",
  "avgLeftHipAngle",  "avgRightHipAngle",
  "avgLeftKneeHeight","avgRightKneeHeight",
  "romScore", "postureScore", "controlScore", "symmetryScore", "movementQualityScore",
  "stepCount", "avgBodySpan", "bodySpanConfidence", "landmarkQuality",
  "fatigueIndex", "cameraVisibilityScore",
  "warnings", "feedbackMessages",
  "therapistLabel", "therapistNotes", "approvedByTherapist",
  // Validation scaffold — for future comparison against manual review
  "validationFlaggedAt", "manualStepCount", "manualMovementQuality",
  "reviewSource", "validationNote",
] as const;

/**
 * Export all sessions (or a single patient's sessions) as a UTF-8 CSV string.
 * Suitable for ML pipelines, spreadsheet analysis, or audit trails.
 *
 * @param patientId  Omit to export every patient.
 */
export function exportDatasetAsCSV(patientId?: string): string {
  const sessions = patientId ? loadPatientSessions(patientId) : loadAllSessions();
  const escape = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n"))
    ? `"${v.replace(/"/g, '""')}"`
    : v;

  const rows = sessions.map((s) => [
    s.id,              s.patientId,         s.date,            String(s.durationSec),
    String(s.totalSteps), String(s.leftSteps), String(s.rightSteps),
    String(s.symmetryPct), String(s.stepsPerMin), String(s.score), String(s.bestCombo),
    String(s.biomechanics?.avgLeftKneeAngle  ?? ""),
    String(s.biomechanics?.avgRightKneeAngle ?? ""),
    String(s.biomechanics?.avgLeftHipAngle   ?? ""),
    String(s.biomechanics?.avgRightHipAngle  ?? ""),
    String(s.biomechanics?.avgLeftKneeHeight  ?? ""),
    String(s.biomechanics?.avgRightKneeHeight ?? ""),
    String(s.biomechanics?.romScore             ?? ""),
    String(s.biomechanics?.postureScore         ?? ""),
    String(s.biomechanics?.controlScore         ?? ""),
    String(s.biomechanics?.symmetryScore        ?? ""),
    String(s.biomechanics?.movementQualityScore  ?? ""),
    String(s.biomechanics?.stepCount             ?? ""),
    String(s.biomechanics?.avgBodySpan           ?? ""),
    String(s.biomechanics?.bodySpanConfidence    ?? ""),
    String(s.biomechanics?.landmarkQuality       ?? ""),
    String(s.fatigueIndex         ?? ""),
    String(s.cameraVisibilityScore ?? ""),
    escape((s.warnings        ?? []).join("; ")),
    escape((s.feedbackMessages ?? []).join("; ")),
    s.therapistLabel      ?? "unlabeled",
    escape(s.therapistNotes ?? ""),
    String(s.approvedByTherapist ?? false),
    s.validationLog?.flaggedAt              ?? "",
    String(s.validationLog?.manualStepCount       ?? ""),
    String(s.validationLog?.manualMovementQuality ?? ""),
    s.validationLog?.reviewSource           ?? "",
    escape(s.validationLog?.discrepancyNote ?? ""),
  ].join(","));

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

/**
 * Import sessions from a CSV produced by `exportDatasetAsCSV`.
 * Duplicate session IDs are skipped (no overwrite of existing records).
 *
 * Returns counts of imported and skipped rows.
 */
export function importDatasetFromCSV(csvText: string): { imported: number; skipped: number } {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { imported: 0, skipped: 0 };

  const headers = lines[0].split(",");
  const col = (row: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"') : "";
  };

  const existing = new Set(readStore().map((s) => s.id));
  const toAdd: SessionRecord[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (handles quoted fields that don't contain commas themselves)
    const row = lines[i].split(",");
    const id  = col(row, "sessionId");
    if (!id || existing.has(id)) { skipped++; continue; }

    const num = (key: string) => {
      const v = col(row, key);
      return v !== "" ? Number(v) : undefined;
    };

    const romScore     = num("romScore");
    const bio = (romScore !== undefined) ? {
      avgLeftKneeAngle:    num("avgLeftKneeAngle")    ?? 0,
      avgRightKneeAngle:   num("avgRightKneeAngle")   ?? 0,
      avgLeftHipAngle:     num("avgLeftHipAngle")     ?? 0,
      avgRightHipAngle:    num("avgRightHipAngle")    ?? 0,
      avgLeftKneeHeight:   num("avgLeftKneeHeight")   ?? 0,
      avgRightKneeHeight:  num("avgRightKneeHeight")  ?? 0,
      // romScore and postureScore may be null (insufficient data) — preserve that
      romScore:            romScore ?? null,
      postureScore:        num("postureScore") ?? null,
      controlScore:        num("controlScore")        ?? 75,
      // symmetryScore may be null (fewer than 3 steps on either side) — preserve that
      symmetryScore:       num("symmetryScore") ?? null,
      movementQualityScore: num("movementQualityScore") ?? 50,
      stepCount:           num("stepCount")           ?? 0,
      avgBodySpan:         num("avgBodySpan")         ?? 0,
      bodySpanConfidence:  num("bodySpanConfidence")  ?? 0,
      landmarkQuality:     num("landmarkQuality")     ?? 0,
    } : undefined;

    const labelRaw = col(row, "therapistLabel") as TherapistLabel;
    const validLabels: TherapistLabel[] = [
      "good", "acceptable", "poor_control", "fatigue_limited",
      "technical_error", "camera_issue", "unsafe", "poor", "unlabeled",
    ];

    toAdd.push({
      id,
      patientId:    col(row, "patientId"),
      date:         col(row, "date"),
      durationSec:  num("durationSec")  ?? 60,
      score:        num("score")        ?? 0,
      totalSteps:   num("totalSteps")   ?? 0,
      leftSteps:    num("leftSteps")    ?? 0,
      rightSteps:   num("rightSteps")   ?? 0,
      symmetryPct:  num("symmetryPct")  ?? 100,
      bestCombo:    num("bestCombo")    ?? 0,
      stepsPerMin:  num("stepsPerMin")  ?? 0,
      biomechanics: bio,
      fatigueIndex:          num("fatigueIndex"),
      cameraVisibilityScore: num("cameraVisibilityScore"),
      warnings:        col(row,"warnings")       ? col(row,"warnings").split("; ").filter(Boolean)       : [],
      feedbackMessages: col(row,"feedbackMessages") ? col(row,"feedbackMessages").split("; ").filter(Boolean) : [],
      therapistLabel:      validLabels.includes(labelRaw) ? labelRaw : "unlabeled",
      therapistNotes:      col(row, "therapistNotes") || undefined,
      approvedByTherapist: col(row, "approvedByTherapist") === "true",
      validationLog: col(row, "validationFlaggedAt") ? {
        flaggedAt:             col(row, "validationFlaggedAt") || undefined,
        manualStepCount:       num("manualStepCount"),
        manualMovementQuality: num("manualMovementQuality"),
        reviewSource:          (col(row, "reviewSource") as ValidationLog["reviewSource"]) || undefined,
        discrepancyNote:       col(row, "validationNote") || undefined,
      } : undefined,
    });
  }

  if (toAdd.length > 0) {
    const all = readStore();
    writeStore([...all, ...toAdd]);
  }

  return { imported: toAdd.length, skipped };
}
