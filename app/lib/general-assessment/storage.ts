import { createEmptyGeneralAssessmentDraft } from "./defaults";
import { createEmptySpecialTests } from "./special-tests-catalog";
import type {
  FunctionalKey,
  GeneralAssessmentDraft,
  ObjectiveKey,
  OutcomeKey,
  SpecialTestsData,
} from "./types";
import { GENERAL_ASSESSMENT_VERSION } from "./types";

const PREFIX = "cm_general_assessment_v1:";

function key(patientId: string) {
  return `${PREFIX}${patientId.trim()}`;
}

export function loadGeneralAssessmentDraft(patientId: string): GeneralAssessmentDraft {
  if (typeof window === "undefined") return createEmptyGeneralAssessmentDraft();
  const id = patientId.trim();
  if (!id) return createEmptyGeneralAssessmentDraft();
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return createEmptyGeneralAssessmentDraft();
    const parsed = JSON.parse(raw) as Partial<GeneralAssessmentDraft>;
    if (parsed.version !== GENERAL_ASSESSMENT_VERSION) {
      return createEmptyGeneralAssessmentDraft();
    }
    const base = createEmptyGeneralAssessmentDraft();
    const ok = (parsed.outcomes ?? {}) as Partial<
      Record<OutcomeKey, Partial<GeneralAssessmentDraft["outcomes"][OutcomeKey]>>
    >;
    const outcomes = {
      nprs: { ...base.outcomes.nprs, ...ok.nprs },
      psfs: { ...base.outcomes.psfs, ...ok.psfs },
      lefs: { ...base.outcomes.lefs, ...ok.lefs },
      quickdash: { ...base.outcomes.quickdash, ...ok.quickdash },
      oswestry: { ...base.outcomes.oswestry, ...ok.oswestry },
      ndi: { ...base.outcomes.ndi, ...ok.ndi },
    };
    const fk = (parsed.functional ?? {}) as Partial<
      Record<FunctionalKey, Partial<GeneralAssessmentDraft["functional"][FunctionalKey]>>
    >;
    const functional = {
      five_x_sts: { ...base.functional.five_x_sts, ...fk.five_x_sts },
      tug: { ...base.functional.tug, ...fk.tug },
      gait_speed: { ...base.functional.gait_speed, ...fk.gait_speed },
      single_leg_balance: {
        ...base.functional.single_leg_balance,
        ...fk.single_leg_balance,
      },
      squat: { ...base.functional.squat, ...fk.squat },
      step_down: { ...base.functional.step_down, ...fk.step_down },
    };
    const ob = (parsed.objective ?? {}) as Partial<
      Record<ObjectiveKey, Partial<GeneralAssessmentDraft["objective"][ObjectiveKey]>>
    >;
    const objective = {
      posture: { ...base.objective.posture, ...ob.posture },
      rom: { ...base.objective.rom, ...ob.rom },
      squat: { ...base.objective.squat, ...ob.squat },
      gait: { ...base.objective.gait, ...ob.gait },
      balance: { ...base.objective.balance, ...ob.balance },
      sit_to_stand: { ...base.objective.sit_to_stand, ...ob.sit_to_stand },
    };
    const savedAt =
      typeof parsed.updatedAt === "string" && parsed.updatedAt.trim() !== ""
        ? parsed.updatedAt.trim()
        : base.updatedAt;
    // Merge specialTests: start from defaults so new tests appear even on old drafts
    const storedST = (parsed as Partial<GeneralAssessmentDraft>).specialTests;
    const specialTests: SpecialTestsData = {
      ...createEmptySpecialTests(),
      ...(storedST && typeof storedST === "object" ? storedST : {}),
    };

    return {
      ...base,
      subjective: { ...base.subjective, ...parsed.subjective },
      outcomes,
      functional,
      objective,
      ai: { ...base.ai, ...parsed.ai },
      therapist: { ...base.therapist, ...parsed.therapist },
      soap: { ...base.soap, ...parsed.soap },
      specialTests,
      updatedAt: savedAt,
    };
  } catch {
    return createEmptyGeneralAssessmentDraft();
  }
}

export function saveGeneralAssessmentDraft(
  patientId: string,
  draft: GeneralAssessmentDraft,
): void {
  if (typeof window === "undefined") return;
  const id = patientId.trim();
  if (!id) return;
  try {
    localStorage.setItem(
      key(id),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota */
  }
}
