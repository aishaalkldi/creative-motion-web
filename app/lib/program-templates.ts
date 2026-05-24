/**
 * Pilot program templates — clinician-reviewed starting points for plan assignment.
 * Static config only; no auto-prescription. Clinician edits before assigning.
 *
 * Exercises are library-linked PrescribedExerciseV1 objects (not text fallback).
 */

import {
  getLibraryExerciseById,
  type BodyRegion,
} from "@/app/lib/exercise-library-v1";
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
  programGoal: string;
  conditionCategory: string;
  bodyRegion: BodyRegion;
  suitableFor: string;
  notSuitableFor: string;
  phaseGoal: string;
  expectedResponse: string;
  safetyNotes: string;
  reviewCriteria: string;
  clinicianUseNote: string;
  patientFriendlyGoal: string;
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
    programGoal: "Basic knee strength, mobility, and walking confidence.",
    conditionCategory: "ACL, knee OA, post-op knee, general knee rehab",
    bodyRegion: "knee",
    suitableFor:
      "Patients with mild–moderate knee symptoms who can tolerate low-load activation, gentle ROM, and supported functional movement.",
    notSuitableFor:
      "Non–weight-bearing status, acute effusion with inability to activate quad, or post-operative restrictions without clearance.",
    phaseGoal:
      "Restore voluntary quadriceps control, comfortable knee flexion, and sit-to-stand confidence before progression.",
    expectedResponse:
      "Stable or decreasing pain after sessions, manageable effort scores, and improving control on activation and functional tasks.",
    safetyNotes:
      "Stop if sharp or increasing pain occurs. Progress only when movement quality is controlled.",
    reviewCriteria:
      "Consider progression after 2–3 stable sessions with pain ≤ 4/10 after exercise and controlled sit-to-stand form.",
    clinicianUseNote:
      "Phase 1 knee starting point. Review dose, session order, and contraindications before assigning.",
    patientFriendlyGoal:
      "Build strength and confidence in your knee for sitting, standing, and walking.",
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
    programGoal: "Gentle mobility, core activation, and functional confidence.",
    conditionCategory: "Lumbar disc herniation, mechanical low back pain, deconditioning",
    bodyRegion: "lumbar",
    suitableFor:
      "Patients with mild–moderate lumbar symptoms who benefit from breathing, mobility, and gradual core activation.",
    notSuitableFor:
      "Red-flag symptoms, progressive neurological deficit, or acute radicular pain requiring medical review first.",
    phaseGoal:
      "Calm symptoms, restore gentle spinal mobility, and establish neutral spine control for daily movement.",
    expectedResponse:
      "Symptoms stable or easing after sessions; patient reports improved confidence with bending and walking tasks.",
    safetyNotes:
      "Avoid pain-provoking ranges. Emphasize controlled breathing and neutral spine during movement.",
    reviewCriteria:
      "Progress when pain response is stable across 2–3 sessions and patient tolerates bird-dog and walking tasks.",
    clinicianUseNote:
      "Conservative lumbar entry program. Adjust exercises if extension or flexion bias is required.",
    patientFriendlyGoal:
      "Move more comfortably and rebuild confidence in your back for everyday activities.",
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
    programGoal: "Gentle shoulder mobility, scapular control, and pain-free movement.",
    conditionCategory: "Shoulder impingement, post-op shoulder, frozen shoulder, rotator cuff",
    bodyRegion: "shoulder",
    suitableFor:
      "Patients with shoulder stiffness or mild impingement who need graded mobility and scapular control.",
    notSuitableFor:
      "Acute dislocation, post-operative precautions not yet cleared, or sharp pinching pain through range.",
    phaseGoal:
      "Restore comfortable passive and assisted range with scapular stability before loaded rotation work.",
    expectedResponse:
      "Gradual ROM improvement, reduced stiffness after sessions, and no increase in night pain or pinching.",
    safetyNotes:
      "Stay within a comfortable range. Do not push through pinching or sharp shoulder pain.",
    reviewCriteria:
      "Review for progression after consistent tolerance of table slides and wall slides with stable pain response.",
    clinicianUseNote:
      "Mobility-first shoulder template. Verify surgical precautions and irritability level before assigning.",
    patientFriendlyGoal:
      "Loosen a stiff shoulder and move more comfortably for reaching and daily tasks.",
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
    goal: template.programGoal,
    safetyNote: template.safetyNotes,
    sessions: template.sessions.map((s) => ({
      sessionNumber: s.sessionNumber,
      title: s.title,
      exercises: s.exercises.map((ex) => ({ ...ex })),
    })),
  };
}
