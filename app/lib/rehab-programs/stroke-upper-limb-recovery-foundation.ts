/**
 * Stroke -> Upper Limb Recovery Foundation — the one hardcoded Neuro
 * Rehabilitation catalog entry proving the Condition/RehabPathway/
 * TreatmentProgram/ProgramSession shape end to end. Mirrors how
 * program-templates.ts's PilotProgramTemplate entries are defined:
 * static, clinician-reviewed config, not auto-generated or persisted.
 *
 * Session 1's Reach the Light and D1-Inspired Diagonal Reach blocks
 * reuse the real movementId/feedbackProfile values already defined for
 * production (clinical-motion-pattern-session-definition.ts), so this
 * catalog entry describes the same underlying blocks, not a parallel
 * invented set. Duration values here are catalog-level estimates for
 * this session shape, not a clinical prescription.
 *
 * Calibration and the session summary are intentionally absent from
 * the `blocks` array — see rehab-program-types.ts's module doc. They
 * are represented only via `lifecycle` on the session below.
 */
import { D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE } from "@/app/lib/interactive-shoulder/motion-patterns/d1-inspired-diagonal-reach-pattern";
import { REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE } from "@/app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry";
import type {
  Condition,
  ProgramSession,
  ProgramSessionBlock,
  RehabPathway,
  TreatmentProgram,
} from "./rehab-program-types";

export const NEURO_STROKE_CONDITION: Condition = Object.freeze({
  id: "neuro-stroke",
  name: "Stroke",
});

export const STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY: RehabPathway = Object.freeze({
  id: "stroke-upper-limb-recovery-foundation",
  conditionId: NEURO_STROKE_CONDITION.id,
  name: "Upper Limb Recovery Foundation",
});

const WARM_UP_BLOCK: ProgramSessionBlock = Object.freeze({
  blockId: "stroke-ulrf-v1-session-1-warm-up",
  blockType: "instructional",
  title: "Warm-up",
  instructions: "Small, slow reaches to prepare the shoulder before active movement.",
  targetDurationSeconds: 60,
});

const REACH_THE_LIGHT_BLOCK: ProgramSessionBlock = Object.freeze({
  blockId: "stroke-ulrf-v1-session-1-reach-the-light",
  blockType: "movement-target",
  title: "Reach the Light",
  instructions:
    "Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.",
  movementId: "shoulder-abduction-reach",
  feedbackProfile: REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE,
  targetDurationSeconds: 240,
});

const D1_DIAGONAL_REACH_BLOCK: ProgramSessionBlock = Object.freeze({
  blockId: "stroke-ulrf-v1-session-1-d1-diagonal-reach",
  blockType: "movement-pattern",
  title: "D1-Inspired Diagonal Reach",
  instructions:
    "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
  movementId: "shoulder-abduction-reach",
  feedbackProfile: D1_INSPIRED_DIAGONAL_REACH_FEEDBACK_PROFILE,
  targetDurationSeconds: 240,
});

const COOL_DOWN_BLOCK: ProgramSessionBlock = Object.freeze({
  blockId: "stroke-ulrf-v1-session-1-cool-down",
  blockType: "instructional",
  title: "Cool-down",
  instructions: "Slow, reduced-range movement and breathing to finish the session.",
  targetDurationSeconds: 90,
});

export const STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1: ProgramSession = Object.freeze({
  id: "stroke-upper-limb-recovery-foundation-v1-session-1",
  programId: "stroke-upper-limb-recovery-foundation-v1",
  sessionNumber: 1,
  title: "Session 1 — Activation and Functional Reaching",
  goal: "Activation and Functional Reaching",
  estimatedDurationMinutes: Object.freeze({ min: 10, max: 15 }),
  lifecycle: Object.freeze({
    requiresCalibration: true,
    summaryMode: "standard",
  }),
  blocks: Object.freeze([
    WARM_UP_BLOCK,
    REACH_THE_LIGHT_BLOCK,
    D1_DIAGONAL_REACH_BLOCK,
    COOL_DOWN_BLOCK,
  ]),
});

export const STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1: TreatmentProgram = Object.freeze({
  id: "stroke-upper-limb-recovery-foundation-v1",
  pathwayId: STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY.id,
  name: "Upper Limb Recovery Foundation",
  version: 1,
  sessions: Object.freeze([STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1]),
});
