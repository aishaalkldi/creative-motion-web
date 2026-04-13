import type { AssessmentRecord, CreateAssessmentInput } from "../domain-types";
import {
  createAssessmentId,
  createDraftAssessment,
  getAllAssessments,
  getAssessmentById,
  getAssessmentsByPatientId,
  getLatestAssessmentForPatient,
  getRecentAssessmentsForPatient,
  saveAssessmentToStorage,
} from "../assessments-storage";

/**
 * Assessment (session) data access boundary. Local implementation delegates to
 * `assessments-storage`; swap for a remote adapter later without touching UI.
 */
export type AssessmentsRepository = {
  getAll(): AssessmentRecord[];
  getById(id: string): AssessmentRecord | null;
  /** New draft session (wraps `createDraftAssessment`). */
  create(input: CreateAssessmentInput): AssessmentRecord;
  /** Persist full session row — insert or merge (wraps `saveAssessmentToStorage`). */
  update(record: AssessmentRecord): void;
  /** All sessions for a patient, newest first. */
  listByPatientId(patientId: string): AssessmentRecord[];
  /** Most recent N sessions for comparison views. */
  listRecentByPatient(patientId: string, limit?: number): AssessmentRecord[];
  /** Latest single session for a patient, if any. */
  getLatestByPatient(patientId: string): AssessmentRecord | null;
  /** Client-side id generator used when starting a session (unchanged behavior). */
  newAssessmentId(): string;
};

const localAssessmentsRepository: AssessmentsRepository = {
  getAll() {
    return getAllAssessments();
  },
  getById(id) {
    return getAssessmentById(id);
  },
  create(input) {
    return createDraftAssessment(input);
  },
  update(record) {
    saveAssessmentToStorage(record);
  },
  listByPatientId(patientId) {
    return getAssessmentsByPatientId(patientId);
  },
  listRecentByPatient(patientId, limit = 3) {
    return getRecentAssessmentsForPatient(patientId, limit);
  },
  getLatestByPatient(patientId) {
    return getLatestAssessmentForPatient(patientId);
  },
  newAssessmentId() {
    return createAssessmentId();
  },
};

export const assessmentsRepository: AssessmentsRepository =
  localAssessmentsRepository;
