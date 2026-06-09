/**
 * RASQ Move Better Performance — fitness program template v1 (code-first, no database).
 * General-public interval program. Not a clinical prescription.
 */

import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";
import { prescribedFromLibrary } from "@/app/lib/exercise-resolve";
import type { PrescribedExerciseV1 } from "@/app/lib/exercise-prescription";

export const MOVE_BETTER_PERFORMANCE_V1_ID = "move-better-performance-v1";

export type FitnessGamificationFeatures = {
  sessionStreak: boolean;
  repChallenge: boolean;
  beatLastSession: boolean;
  sessionCompletion: boolean;
  weeklyUnlock: boolean;
  qualityScore: false;
  leaderboard: false;
  clinicalProgression: false;
};

export type FitnessSessionTiming = {
  workSeconds: number;
  restSeconds: number;
};

export type FitnessProgramSessionDef = {
  sessionNumber: number;
  week: 1 | 2;
  title: string;
  exerciseIds: string[];
  note?: string;
};

export type FitnessProgramSafetyFlags = {
  noDiagnosis: true;
  noProgressionAdvice: true;
  noQualityScore: true;
  clinicianReviewRequired: false;
  patientFacingAI: false;
};

export type MoveBetterPerformanceV1 = {
  id: typeof MOVE_BETTER_PERFORMANCE_V1_ID;
  name: string;
  tagline: string;
  targetAudience: "general_public";
  clinicalProgram: false;
  totalWeeks: number;
  sessionsPerWeek: number;
  totalSessions: number;
  sessionDurationMinutes: number;
  equipment: "none";
  position: "standing_only";
  warmupMinutes: number;
  mainBlockMinutes: number;
  cooldownMinutes: number;
  weekTiming: {
    1: FitnessSessionTiming;
    2: FitnessSessionTiming;
  };
  sessions: FitnessProgramSessionDef[];
  movementChecks: string[];
  movementCheckLabel: string;
  movementCheckNote: string;
  gamificationReady: true;
  features: FitnessGamificationFeatures;
  safetyFlags: FitnessProgramSafetyFlags;
};

const S1_EXERCISES = [
  "sit-to-stand",
  "lateral-step",
  "heel-raise",
  "standing-march",
] as const;

const S2_EXERCISES = [
  "step-up",
  "lateral-step",
  "heel-raise",
  "standing-march",
] as const;

const S3_EXERCISES = [
  "sit-to-stand",
  "step-up",
  "lateral-step",
  "heel-raise",
] as const;

export const MOVE_BETTER_PERFORMANCE_V1: MoveBetterPerformanceV1 = {
  id: MOVE_BETTER_PERFORMANCE_V1_ID,
  name: "Move Better Performance",
  tagline: "20 minutes. No equipment. Feel the difference.",
  targetAudience: "general_public",
  clinicalProgram: false,
  totalWeeks: 2,
  sessionsPerWeek: 3,
  totalSessions: 6,
  sessionDurationMinutes: 20,
  equipment: "none",
  position: "standing_only",
  warmupMinutes: 2,
  mainBlockMinutes: 15,
  cooldownMinutes: 3,
  weekTiming: {
    1: { workSeconds: 45, restSeconds: 15 },
    2: { workSeconds: 45, restSeconds: 10 },
  },
  sessions: [
    {
      sessionNumber: 1,
      week: 1,
      title: "Foundation Start",
      exerciseIds: [...S1_EXERCISES],
    },
    {
      sessionNumber: 2,
      week: 1,
      title: "Foundation Build",
      exerciseIds: [...S2_EXERCISES],
    },
    {
      sessionNumber: 3,
      week: 1,
      title: "Foundation Finish",
      exerciseIds: [...S3_EXERCISES],
    },
    {
      sessionNumber: 4,
      week: 2,
      title: "Performance Start",
      exerciseIds: [...S1_EXERCISES],
      note: "Less rest than Week 1",
    },
    {
      sessionNumber: 5,
      week: 2,
      title: "Performance Build",
      exerciseIds: [...S2_EXERCISES],
      note: "Less rest than Week 1",
    },
    {
      sessionNumber: 6,
      week: 2,
      title: "Performance Finish",
      exerciseIds: [...S3_EXERCISES],
      note: "Less rest than Week 1",
    },
  ],
  movementChecks: ["functional-reach", "single-leg-stance"],
  movementCheckLabel: "Optional Movement Check",
  movementCheckNote: "Progress comparison only. Not a clinical assessment.",
  gamificationReady: true,
  features: {
    sessionStreak: true,
    repChallenge: true,
    beatLastSession: true,
    sessionCompletion: true,
    weeklyUnlock: true,
    qualityScore: false,
    leaderboard: false,
    clinicalProgression: false,
  },
  safetyFlags: {
    noDiagnosis: true,
    noProgressionAdvice: true,
    noQualityScore: true,
    clinicianReviewRequired: false,
    patientFacingAI: false,
  },
};

function fitnessTemplateExercise(
  exerciseId: string,
  timing: FitnessSessionTiming,
): PrescribedExerciseV1 {
  const entry = getLibraryExerciseById(exerciseId);
  if (!entry) {
    throw new Error(`Move Better Performance references unknown exerciseId: ${exerciseId}`);
  }
  return prescribedFromLibrary(entry, {
    sets: 1,
    durationSec: timing.workSeconds,
    restSec: timing.restSeconds,
  });
}

/** Clinician plan-builder shape — same session contract as Sports Knee Foundation templates. */
export function buildMoveBetterPerformanceV1PilotSessions(): {
  sessionNumber: number;
  title: string;
  exercises: PrescribedExerciseV1[];
}[] {
  return MOVE_BETTER_PERFORMANCE_V1.sessions.map((session) => {
    const timing = MOVE_BETTER_PERFORMANCE_V1.weekTiming[session.week];
    const titleSuffix = session.note ? ` — ${session.note}` : "";
    return {
      sessionNumber: session.sessionNumber,
      title: `Session ${session.sessionNumber} — ${session.title}${titleSuffix}`,
      exercises: session.exerciseIds.map((id) => fitnessTemplateExercise(id, timing)),
    };
  });
}

export function getMoveBetterPerformanceV1SessionExerciseIds(
  sessionNumber: number,
): string[] {
  const session = MOVE_BETTER_PERFORMANCE_V1.sessions.find(
    (s) => s.sessionNumber === sessionNumber,
  );
  return session ? [...session.exerciseIds] : [];
}
