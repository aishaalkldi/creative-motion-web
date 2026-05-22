/**
 * Pilot program templates — clinician-reviewed starting points for plan assignment.
 * Static config only; no auto-prescription. Clinician edits before assigning.
 */

export type PilotProgramSession = {
  sessionNumber: number;
  title: string;
  exercises: string[];
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
          "Quad activation",
          "Heel slides",
          "Seated knee extension",
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Strength & function",
        exercises: [
          "Sit-to-stand practice",
          "Mini squats",
          "Calf raises",
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Control & walking",
        exercises: [
          "Step control",
          "Balance hold",
          "Walking tolerance",
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
          "Diaphragmatic breathing",
          "Pelvic tilts",
          "Knee-to-chest",
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Spinal mobility & hinge",
        exercises: [
          "Cat-cow",
          "Bridge preparation",
          "Hip hinge education",
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Core & walking",
        exercises: [
          "Glute bridge",
          "Bird-dog preparation",
          "Walking plan",
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
          "Pendulum",
          "Scapular setting",
          "Table slides",
        ],
      },
      {
        sessionNumber: 2,
        title: "Session 2 — Controlled range & posture",
        exercises: [
          "Wall slides",
          "External rotation isometric",
          "Posture reset",
        ],
      },
      {
        sessionNumber: 3,
        title: "Session 3 — Functional reach",
        exercises: [
          "Assisted shoulder flexion",
          "Scapular retraction",
          "Functional reach",
        ],
      },
    ],
  },
];

/** Deep-clone a template for editable plan state (no shared references). */
export function clonePilotTemplate(
  template: PilotProgramTemplate,
): {
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
      exercises: [...s.exercises],
    })),
  };
}
