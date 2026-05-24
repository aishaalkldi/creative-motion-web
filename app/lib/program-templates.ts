/**
 * Pilot program templates — clinician-reviewed starting points for plan assignment.
 * Static config only; no auto-prescription. Clinician edits before assigning.
 *
 * Exercises are library-linked PrescribedExerciseV1 objects (not text fallback).
 */

import { getLibraryExerciseById } from "@/app/lib/exercise-library-v1";
import {
  prescribedFromLibrary,
  type PrescribedExerciseV1,
} from "@/app/lib/exercise-resolve";

export type PilotProgramSession = {
  sessionNumber: number;
  title: string;
  exercises: PrescribedExerciseV1[];
};

export type PilotProgramTemplate = {
  id: string;
  title: string;
  conditionArea: string;
  level: string;
  goal: string;
  safetyNote: string;
  sessions: PilotProgramSession[];
};

function templateExercise(
  exerciseId: string,
  displayName: string,
  overrides?: Partial<PrescribedExerciseV1>,
): PrescribedExerciseV1 {
  const entry = getLibraryExerciseById(exerciseId);
  if (!entry) {
    throw new Error(`Pilot template references unknown exerciseId: ${exerciseId}`);
  }
  return prescribedFromLibrary(entry, { name: displayName, ...overrides });
}

export const PILOT_PROGRAM_TEMPLATES: PilotProgramTemplate[] = [
  {
    id: "knee-rehab-beginner",
    title: "Knee Rehab — Beginner",
    conditionArea: "Knee",
    level: "Beginner",
    goal: "Basic knee strength, mobility, and walking confidence.",
    safetyNote:
      "Stop if sharp or increasing pain occurs. Progress only when movement quality is controlled.",
    sessions: [
      {
        sessionNumber: 1,
        title: "Session 1 — Activation & mobility",
        exercises: [
          templateExercise("quad-set", "Quad activation"),
          templateExercise("heel-slide", "Heel slides"),
          templateExercise("quad-set", "Seated knee extension"),
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Strength & function",
        exercises: [
          templateExercise("sit-to-stand", "Sit-to-stand practice"),
          templateExercise("mini-squat", "Mini squats"),
          templateExercise("heel-raise", "Calf raises"),
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Control & walking",
        exercises: [
          templateExercise("step-up", "Step control"),
          templateExercise("single-leg-stance", "Balance hold"),
          templateExercise("walking-tolerance", "Walking tolerance"),
        ],
      },
    ],
  },
  {
    id: "low-back-beginner",
    title: "Low Back Pain — Beginner",
    conditionArea: "Low back",
    level: "Beginner",
    goal: "Gentle mobility, core activation, and functional confidence.",
    safetyNote:
      "Avoid pain-provoking ranges. Emphasize controlled breathing and neutral spine during movement.",
    sessions: [
      {
        sessionNumber: 1,
        title: "Session 1 — Mobility & breathing",
        exercises: [
          templateExercise("diaphragmatic-breathing", "Diaphragmatic breathing"),
          templateExercise("pelvic-tilt", "Pelvic tilts"),
          templateExercise("pelvic-tilt", "Knee-to-chest"),
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Spinal mobility & hinge",
        exercises: [
          templateExercise("cat-cow", "Cat-cow"),
          templateExercise("glute-bridge", "Bridge preparation"),
          templateExercise("hip-hinge", "Hip hinge education"),
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Core & walking",
        exercises: [
          templateExercise("glute-bridge", "Glute bridge"),
          templateExercise("bird-dog", "Bird-dog preparation"),
          templateExercise("walking-tolerance", "Walking plan"),
        ],
      },
    ],
  },
  {
    id: "shoulder-mobility-beginner",
    title: "Shoulder Mobility — Beginner",
    conditionArea: "Shoulder",
    level: "Beginner",
    goal: "Gentle shoulder mobility, scapular control, and pain-free movement.",
    safetyNote:
      "Stay within a comfortable range. Do not push through pinching or sharp shoulder pain.",
    sessions: [
      {
        sessionNumber: 1,
        title: "Session 1 — Mobility & scapular setting",
        exercises: [
          templateExercise("pendulum", "Pendulum"),
          templateExercise("scapular-setting", "Scapular setting"),
          templateExercise("table-slide", "Table slides"),
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Controlled range & posture",
        exercises: [
          templateExercise("wall-slide", "Wall slides"),
          templateExercise("external-rotation", "External rotation isometric"),
          templateExercise("posture-reset", "Posture reset"),
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Functional reach",
        exercises: [
          templateExercise("table-slide", "Assisted shoulder flexion"),
          templateExercise("scapular-setting", "Scapular retraction"),
          templateExercise("cross-body-stretch", "Functional reach"),
        ],
      },
    ],
  },
];

/** Deep-clone a template for editable plan state (no shared references). */
export function clonePilotTemplate(template: PilotProgramTemplate): {
  title: string;
  goal: string;
  safetyNote: string;
  sessions: PilotProgramSession[];
} {
  return {
    title: template.title,
    goal: template.goal,
    safetyNote: template.safetyNote,
    sessions: template.sessions.map((s) => ({
      sessionNumber: s.sessionNumber,
      title: s.title,
      exercises: s.exercises.map((ex) => ({ ...ex })),
    })),
  };
}
