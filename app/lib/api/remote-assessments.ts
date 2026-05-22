/**
 * Remote Assessment Service — mock localStorage implementation.
 *
 * Clinician creates a tokenized link → patient fills sections → submits →
 * patient answers are merged into the clinician's GeneralAssessmentDraft so
 * the report renders automatically.
 *
 * Replace the localStorage calls with real API fetch() when backend is ready.
 */

import { loadGeneralAssessmentDraft, saveGeneralAssessmentDraft } from "../general-assessment/storage";
import { PATIENT_SECTION_LABELS_EN } from "../patient-assessment-questions";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AssessmentType = "general_msk" | "sports" | "gait" | "pain_function";

/** Subset of SectionId that a patient can answer (no CV/SOAP/AI/special-tests). */
export type PatientSectionId = "pain" | "rom" | "strength" | "balance" | "gait" | "functional";

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  general_msk:   "General MSK",
  sports:        "Sports Assessment",
  gait:          "Gait Assessment",
  pain_function: "Pain & Function",
};

export const DEFAULT_SECTIONS: Record<AssessmentType, PatientSectionId[]> = {
  general_msk:   ["pain", "rom", "strength", "balance", "functional"],
  sports:        ["pain", "rom", "strength", "balance", "gait", "functional"],
  gait:          ["pain", "gait", "functional"],
  pain_function: ["pain", "functional"],
};

/** English labels for patient forms (Arabic via patient-assessment-questions when enabled). */
export const PATIENT_SECTION_LABELS: Record<PatientSectionId, string> =
  PATIENT_SECTION_LABELS_EN;

export type AssessmentLanguage = "en" | "ar";

export interface RemoteAssessmentRequest {
  id: string;                          // UUID — also serves as the URL token
  patientId: string;
  patientName: string;
  assessmentType: AssessmentType;
  includedSections: PatientSectionId[];
  status: "pending" | "in_progress" | "submitted";
  expiresAt: string;                   // ISO string — 7 days from creation
  createdAt: string;
  submittedAt?: string;
  /** Patient-filled answers, keyed by section */
  patientDraft?: PatientAssessmentDraft;
  /** Language used when patient completed the form */
  assessmentLanguage?: AssessmentLanguage;
}

/** Simplified, patient-friendly answers (no clinical jargon). */
export interface PatientAssessmentDraft {
  pain?: {
    chiefComplaint: string;
    painLocation: string;
    painScore: string;       // "0"–"10"
    aggravating: string;
    easing: string;
    dailyImpact: string;
    goals: string;
  };
  rom?: {
    limitations: string;
    worseWith: string;
  };
  strength?: {
    weaknessDescription: string;
    activitiesAffected: string;
  };
  balance?: {
    difficultyDescription: string;
    fallHistory: string;
  };
  gait?: {
    walkingDescription: string;
    aids: string;
  };
  functional?: {
    standingDuration: string;
    walkingDistance: string;
    stairsAbility: string;
    otherNotes: string;
  };
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const REQ_PREFIX   = "cm_remote_req:";
const INDEX_PREFIX = "cm_remote_req_idx:";
const EXPIRY_DAYS  = 7;

function reqKey(id: string)       { return `${REQ_PREFIX}${id}`; }
function indexKey(patientId: string) {
  return `${INDEX_PREFIX}${patientId.trim()}`;
}

function readIndex(patientId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(indexKey(patientId)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeIndex(patientId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(indexKey(patientId), JSON.stringify(ids));
}

/** Legacy assessments indexed under numeric patient id (pre-UUID). */
function legacyNumericIndexKey(patientId: string): string | null {
  const trimmed = patientId.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

function collectIndexIds(patientId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (key: string) => {
    for (const id of readIndex(key)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  };
  const trimmed = patientId.trim();
  if (!trimmed) return out;
  add(trimmed);
  const legacy = legacyNumericIndexKey(trimmed);
  if (legacy && legacy !== trimmed) add(legacy);
  return out;
}

function persist(req: RemoteAssessmentRequest) {
  if (typeof window === "undefined") return;
  localStorage.setItem(reqKey(req.id), JSON.stringify(req));
}

// ── UUID helper ────────────────────────────────────────────────────────────────

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export function createRemoteAssessment(input: {
  patientId: string;
  patientName: string;
  assessmentType: AssessmentType;
  includedSections: PatientSectionId[];
}): RemoteAssessmentRequest {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + EXPIRY_DAYS);

  const patientId = input.patientId.trim();
  const req: RemoteAssessmentRequest = {
    id: uuid(),
    patientId,
    patientName: input.patientName,
    assessmentType: input.assessmentType,
    includedSections: input.includedSections,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  persist(req);

  const ids = readIndex(patientId);
  writeIndex(patientId, [req.id, ...ids]);

  return req;
}

export function getRemoteAssessment(id: string): RemoteAssessmentRequest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(reqKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as RemoteAssessmentRequest;
  } catch { return null; }
}

export function listPatientAssessments(patientId: string): RemoteAssessmentRequest[] {
  const ids = collectIndexIds(patientId);
  return ids
    .map((id) => getRemoteAssessment(id))
    .filter((r): r is RemoteAssessmentRequest => {
      if (!r) return false;
      const pid = patientId.trim();
      const rid = String(r.patientId).trim();
      return rid === pid || (legacyNumericIndexKey(pid) !== null && rid === legacyNumericIndexKey(pid));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateRemoteAssessmentDraft(
  id: string,
  patientDraft: PatientAssessmentDraft,
  assessmentLanguage?: AssessmentLanguage,
): void {
  const req = getRemoteAssessment(id);
  if (!req) return;
  persist({
    ...req,
    status: "in_progress",
    patientDraft,
    ...(assessmentLanguage ? { assessmentLanguage } : {}),
  });
}

export function submitRemoteAssessment(
  id: string,
  patientDraft: PatientAssessmentDraft,
  assessmentLanguage: AssessmentLanguage = "en",
): void {
  const req = getRemoteAssessment(id);
  if (!req) return;

  const submitted: RemoteAssessmentRequest = {
    ...req,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    patientDraft,
    assessmentLanguage,
  };
  persist(submitted);

  // Merge patient answers into the clinician's GeneralAssessmentDraft so the
  // existing report page renders patient-submitted data automatically.
  const clinicianDraft = loadGeneralAssessmentDraft(req.patientId.trim());
  const pd = patientDraft;

  if (pd.pain) {
    clinicianDraft.subjective = {
      ...clinicianDraft.subjective,
      chiefComplaint:       pd.pain.chiefComplaint      || clinicianDraft.subjective.chiefComplaint,
      painLocation:         pd.pain.painLocation        || clinicianDraft.subjective.painLocation,
      nprs:                 pd.pain.painScore           || clinicianDraft.subjective.nprs,
      aggravating:          pd.pain.aggravating         || clinicianDraft.subjective.aggravating,
      easing:               pd.pain.easing              || clinicianDraft.subjective.easing,
      functionalLimitations:pd.pain.dailyImpact         || clinicianDraft.subjective.functionalLimitations,
      goals:                pd.pain.goals               || clinicianDraft.subjective.goals,
    };
  }
  if (pd.rom?.limitations) {
    clinicianDraft.objective.rom = {
      ...clinicianDraft.objective.rom,
      notes: [clinicianDraft.objective.rom.notes, `[Patient-reported] ${pd.rom.limitations}`]
        .filter(Boolean).join("\n"),
    };
  }
  if (pd.gait?.walkingDescription) {
    clinicianDraft.objective.gait = {
      ...clinicianDraft.objective.gait,
      notes: [clinicianDraft.objective.gait.notes, `[Patient-reported] ${pd.gait.walkingDescription}`]
        .filter(Boolean).join("\n"),
    };
  }
  if (pd.balance?.difficultyDescription) {
    clinicianDraft.objective.balance = {
      ...clinicianDraft.objective.balance,
      notes: [clinicianDraft.objective.balance.notes, `[Patient-reported] ${pd.balance.difficultyDescription}`]
        .filter(Boolean).join("\n"),
    };
  }
  if (pd.functional?.otherNotes) {
    clinicianDraft.functional.five_x_sts = {
      ...clinicianDraft.functional.five_x_sts,
      notes: [clinicianDraft.functional.five_x_sts.notes, `[Patient-reported] ${pd.functional.otherNotes}`]
        .filter(Boolean).join("\n"),
    };
  }

  saveGeneralAssessmentDraft(String(req.patientId), clinicianDraft);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isExpired(req: RemoteAssessmentRequest): boolean {
  return new Date(req.expiresAt) < new Date();
}

export function daysUntilExpiry(req: RemoteAssessmentRequest): number {
  const diff = new Date(req.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isTokenValid(req: RemoteAssessmentRequest): boolean {
  return !isExpired(req) && req.status !== "submitted";
}
