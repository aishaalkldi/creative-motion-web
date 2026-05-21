import { createEmptyWorkflowDraft } from "./defaults";
import type {
  AssessmentWorkflowDraft,
  FunctionalCvTestKey,
  ObjectiveCvCardId,
  OutcomeInstrumentKey,
} from "./types";
import { WORKFLOW_STORAGE_VERSION } from "./types";

const PREFIX = "cm_assessment_workflow_v1:";

function key(assessmentId: string): string {
  return `${PREFIX}${assessmentId.trim()}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Shallow merge saved JSON with current schema defaults (forward-compatible). */
export function loadWorkflowDraft(assessmentId: string): AssessmentWorkflowDraft {
  if (typeof window === "undefined") return createEmptyWorkflowDraft();
  const id = assessmentId.trim();
  if (!id) return createEmptyWorkflowDraft();
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return createEmptyWorkflowDraft();
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== WORKFLOW_STORAGE_VERSION) {
      return createEmptyWorkflowDraft();
    }
    const base = createEmptyWorkflowDraft();
    return deepMergeWorkflow(base, parsed as Partial<AssessmentWorkflowDraft>);
  } catch {
    return createEmptyWorkflowDraft();
  }
}

function deepMergeWorkflow(
  base: AssessmentWorkflowDraft,
  saved: Partial<AssessmentWorkflowDraft>,
): AssessmentWorkflowDraft {
  const o = (saved.outcomes ?? {}) as Partial<
    Record<OutcomeInstrumentKey, { rawNotes?: string; computedSummary?: string }>
  >;
  const outcomes = {
    nprs: { ...base.outcomes.nprs, ...o.nprs },
    psfs: { ...base.outcomes.psfs, ...o.psfs },
    lefs: { ...base.outcomes.lefs, ...o.lefs },
    quickdash: { ...base.outcomes.quickdash, ...o.quickdash },
    odi: { ...base.outcomes.odi, ...o.odi },
    ndi: { ...base.outcomes.ndi, ...o.ndi },
  };
  const fc = (saved.functionalCv ?? {}) as Partial<
    Record<FunctionalCvTestKey, Partial<(typeof base.functionalCv)[FunctionalCvTestKey]>>
  >;
  const functionalCv = {
    five_x_sts: { ...base.functionalCv.five_x_sts, ...fc.five_x_sts },
    tug: { ...base.functionalCv.tug, ...fc.tug },
    gait_speed: { ...base.functionalCv.gait_speed, ...fc.gait_speed },
    single_leg_balance: {
      ...base.functionalCv.single_leg_balance,
      ...fc.single_leg_balance,
    },
    squat: { ...base.functionalCv.squat, ...fc.squat },
    step_down: { ...base.functionalCv.step_down, ...fc.step_down },
  };
  const ob = (saved.objectiveCv ?? {}) as Partial<
    Record<ObjectiveCvCardId, Partial<(typeof base.objectiveCv)[ObjectiveCvCardId]>>
  >;
  const objectiveCv = {
    posture: { ...base.objectiveCv.posture, ...ob.posture },
    rom: { ...base.objectiveCv.rom, ...ob.rom },
    squat: { ...base.objectiveCv.squat, ...ob.squat },
    gait: { ...base.objectiveCv.gait, ...ob.gait },
    balance: { ...base.objectiveCv.balance, ...ob.balance },
    sit_to_stand: { ...base.objectiveCv.sit_to_stand, ...ob.sit_to_stand },
  };
  return {
    ...base,
    version: WORKFLOW_STORAGE_VERSION,
    subjective: { ...base.subjective, ...saved.subjective },
    outcomes,
    functionalCv,
    objectiveCv,
    ai: { ...base.ai, ...saved.ai },
    therapist: { ...base.therapist, ...saved.therapist },
    soap: { ...base.soap, ...saved.soap },
    functionalPatientReportedNote:
      saved.functionalPatientReportedNote ?? base.functionalPatientReportedNote,
    fimOptionalNote: saved.fimOptionalNote ?? base.fimOptionalNote,
    updatedAt: new Date().toISOString(),
  };
}

export function saveWorkflowDraft(
  assessmentId: string,
  draft: AssessmentWorkflowDraft,
): void {
  if (typeof window === "undefined") return;
  const id = assessmentId.trim();
  if (!id) return;
  try {
    const payload: AssessmentWorkflowDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key(id), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}
