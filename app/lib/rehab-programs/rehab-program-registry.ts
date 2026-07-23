/**
 * Neuro Rehabilitation program catalog — read-only lookup registry.
 *
 * Same lookup shape as exercise-cv-registry.ts: static data in, safe
 * not-found results out, no mutation API. Exactly one catalog entry
 * exists today (neuro-stroke -> stroke-upper-limb-recovery-foundation);
 * this registry does not assume there will only ever be one.
 */
import type { Condition, RehabPathway, TreatmentProgram } from "./rehab-program-types";
import {
  NEURO_STROKE_CONDITION,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY,
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
} from "./stroke-upper-limb-recovery-foundation";

const CONDITIONS: readonly Condition[] = Object.freeze([NEURO_STROKE_CONDITION]);

const PATHWAYS: readonly RehabPathway[] = Object.freeze([
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY,
]);

const TREATMENT_PROGRAMS: readonly TreatmentProgram[] = Object.freeze([
  STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
]);

export function getConditionById(conditionId: string): Condition | null {
  return CONDITIONS.find((condition) => condition.id === conditionId) ?? null;
}

export function getRehabPathwaysForCondition(conditionId: string): readonly RehabPathway[] {
  return PATHWAYS.filter((pathway) => pathway.conditionId === conditionId);
}

export function getTreatmentProgramById(programId: string): TreatmentProgram | null {
  return TREATMENT_PROGRAMS.find((program) => program.id === programId) ?? null;
}
