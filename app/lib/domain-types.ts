/**
 * Shared domain model for Creative Motion Lab.
 * Local persistence today; shapes are stable for a future API/DB layer.
 *
 * Semantics:
 * - Assessment = one session record (immutable id, tied to patient).
 * - Result = clinical/motion output of that session (logical type); still stored on the
 *   same record until a separate result store exists.
 */

/** Patient lifecycle; includes `string` for legacy/freeform values (e.g. "Saved"). */
export type PatientStatus = "active" | "inactive" | "new" | string;

export type PatientRecord = {
  id: string;
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  diagnosis: string;
  notes: string;
  initialAssessment: string;
  status: PatientStatus;
  createdAt: string;
};

/** Minimum fields to create a patient; storage normalization fills the rest. */
export type CreatePatientInput = Pick<PatientRecord, "id" | "fullName"> &
  Partial<Omit<PatientRecord, "id" | "fullName">>;

export type AssessmentMode = "remote" | "in_clinic";

export type AssessmentStatus = "draft" | "completed";

/** Reserved for MediaPipe / pose pipeline outputs; optional on persisted sessions. */
export type MotionMetrics = {
  /** For future schema migrations */
  schemaVersion?: number;
  /** Example: confidence or quality scores keyed by landmark/body region */
  landmarkScores?: Record<string, number>;
  /** Forward-compatible bag for extra channels */
  extras?: Record<string, unknown>;
};

/**
 * Result payload for a completed session (still embedded on `AssessmentRecord` in storage).
 */
export type AssessmentResult = {
  score?: number;
  durationSeconds?: number;
  reportSummary?: string;
  completedAt?: string;
  motionMetrics?: MotionMetrics;
};

/**
 * One assessment session (includes `selectedTests` and optional embedded result fields).
 */
export type AssessmentRecord = {
  id: string;
  patientId: string;
  mode: AssessmentMode;
  selectedTests: string[];
  bodyRegion: string;
  side: string;
  visitType: string;
  sessionLabel: string;
  status: AssessmentStatus;
  createdAt: string;
} & AssessmentResult;

/** Create a draft session (same inputs previously accepted by draft creation). */
export type CreateAssessmentInput = {
  id: string;
  patientId: string;
  mode: AssessmentMode;
  selectedTests?: string[];
  bodyRegion?: string;
  side?: string;
  visitType?: string;
  sessionLabel?: string;
  createdAt?: string;
};
