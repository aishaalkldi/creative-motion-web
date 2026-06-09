/**
 * Pilot program templates — clinician-reviewed starting points for plan assignment.
 * Static config only; no auto-prescription. Clinician edits before assigning.
 *
 * Exercises prefer library-linked PrescribedExerciseV1; unmatched labels remain
 * plain strings until added to the exercise library.
 */

import {
  getLibraryExerciseById,
  type BodyRegion,
} from "@/app/lib/exercise-library-v1";
import {
  buildMoveBetterPerformanceV1PilotSessions,
  MOVE_BETTER_PERFORMANCE_V1,
} from "@/app/lib/move-better-performance-v1";
import type { StoredExercise } from "@/app/lib/exercise-prescription";
import {
  prescribedFromLibrary,
  resolveExerciseByName,
  type PrescribedExerciseV1,
} from "@/app/lib/exercise-resolve";

/** Body region label for program metadata (broader than exercise-library BodyRegion). */
export type ProgramBodyRegion =
  | BodyRegion
  | "cervical"
  | "ankle"
  | "hip"
  | "lower-limb"
  | "general";

export type PilotProgramSession = {
  sessionNumber: number;
  title: string;
  exercises: StoredExercise[];
};

export type PilotProgramTemplate = {
  id: string;
  title: string;
  conditionArea: string;
  level: string;
  programGoal: string;
  conditionCategory: string;
  bodyRegion: ProgramBodyRegion;
  /** Weeks — expanded templates only; legacy pilots omit. */
  durationWeeks?: number;
  /** Sessions per week — expanded templates only; legacy pilots omit. */
  sessionsPerWeek?: number;
  suitableFor: string;
  notSuitableFor: string;
  phaseGoal: string;
  expectedResponse: string;
  safetyNotes: string;
  /** Required on Sprint L expanded programs; optional on legacy pilot templates. */
  redFlags?: string;
  reviewCriteria: string;
  clinicianUseNote: string;
  patientFriendlyGoal: string;
  sessions: PilotProgramSession[];
};

/** Sprint L exercise label aliases (program library only). */
const PROGRAM_EXERCISE_ALIASES: Record<string, string> = {
  "quad sets": "quad-set",
  "mini squat (0-30 degrees)": "mini-squat",
  "step-up low step": "step-up",
  "calf raise bilateral": "heel-raise",
  "seated knee extension partial arc": "terminal-knee-extension",
  "prone knee flexion": "heel-slide",
  "knee to chest stretch": "pelvic-tilt",
  "cat-cow mobilisation": "cat-cow",
  "cat-cow mobilization": "cat-cow",
  "hip flexor stretch": "hip-hinge",
  "shoulder blade squeeze": "scapular-setting",
  "external rotation elbow at side": "external-rotation",
  "side-lying external rotation": "external-rotation",
  "pendulum circles": "pendulum",
  "heel-toe walking": "walking-tolerance",
  "single leg stance eyes open": "single-leg-stance",
  "single leg stance eyes closed": "single-leg-stance",
  "tandem standing": "single-leg-stance",
  "sit to stand": "sit-to-stand",
  "sit to stand slow": "sit-to-stand",
  "sit to stand assisted": "sit-to-stand",
  "marching on spot": "walking-tolerance",
  "side step": "lateral-band-walk",
  "backward walking short distance": "walking-tolerance",
  "romanian deadlift": "hip-hinge",
  "core stability plank": "side-plank",
  "ankle pumps": "heel-slide",
  "ankle circles": "heel-slide",
  "towel calf stretch": "heel-raise",
  "clamshell": "glute-bridge",
  "side-lying hip abduction": "lateral-band-walk",
  "standing hip extension": "hip-hinge",
  "hip flexor stretch kneeling": "hip-hinge",
  "step-up low": "step-up",
  "heel slides": "heel-slide",
  "short arc quads": "short-arc-quad",
  "quad sets post-op": "quad-set",
  "ankle pumps post-op": "heel-slide",
  "seated knee flexion assisted": "heel-slide",
  "standing calf raise bilateral": "heel-raise",
  "chin tuck deep cervical flexor": "chin-tuck",
  "cervical rotation pain-free range": "cervical-rotation-rom",
  "cervical lateral flexion stretch": "cervical-lateral-flexion-stretch",
  "upper trapezius stretch": "upper-trapezius-stretch",
  "theraband dorsiflexion": "theraband-ankle-dorsiflexion",
  "theraband inversion and eversion": "theraband-ankle-eversion-inversion",
  "prone y-t-w": "prone-ytw",
  "serratus anterior punch": "serratus-punch",
  "doorway chest stretch": "doorway-pectoral-stretch",
  "piriformis stretch": "piriformis-stretch",
  "supine hip flexion knee bent": "supine-hip-flexion",
  "seated marching": "seated-marching",
  "standing weight shift": "weight-shift-standing",
  "single leg squat": "single-leg-squat",
  "supported single leg stance": "supported-single-leg-stance",
  "shoulder blade retraction": "scapular-setting",
  "step-up and step-down": "step-up",
  "seated leg extension": "terminal-knee-extension",
  "standing hip abduction": "lateral-band-walk",
  "step touch side to side": "lateral-band-walk",
  "straight leg raise": "straight-leg-raise",
  "nordic hamstring curl": "nordic-hamstring-curl",
  "wall press-up": "wall-press-up",
  "postural awareness exercise": "postural-awareness",
  "heel-toe walking supported": "heel-toe-walking-supported",
  "upper limb reaching seated": "upper-limb-reaching-seated",
  "gentle neck rotation": "gentle-neck-rotation",
  "shoulder circles": "shoulder-circles",
  "seated trunk rotation": "seated-trunk-rotation",
  "ankle pumps neurological": "ankle-pumps-neuro",
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

/** Resolve exercise label to library prescription or plain string. */
function resolveTemplateExercise(label: string): StoredExercise {
  const key = label.trim().toLowerCase();
  const aliasId = PROGRAM_EXERCISE_ALIASES[key];
  if (aliasId) {
    const entry = getLibraryExerciseById(aliasId);
    if (entry) return prescribedFromLibrary(entry, { name: label });
  }
  const { entry } = resolveExerciseByName(label);
  if (entry) return prescribedFromLibrary(entry, { name: label });
  // TODO: add to exercise library
  return label;
}

function buildSessionsFromLabels(
  labels: string[],
  sessionCount = 3,
): PilotProgramSession[] {
  const perSession = Math.max(1, Math.ceil(labels.length / sessionCount));
  const sessions: PilotProgramSession[] = [];
  for (let i = 0; i < sessionCount; i++) {
    const slice = labels.slice(i * perSession, (i + 1) * perSession);
    if (slice.length === 0) break;
    sessions.push({
      sessionNumber: sessions.length + 1,
      title: `Session ${sessions.length + 1}`,
      exercises: slice.map(resolveTemplateExercise),
    });
  }
  return sessions;
}

/** RASQ Clinical Program Library v0 — 12 explicit sessions per sports-knee-foundation.md */
function buildSportsKneeFoundationSessions(): PilotProgramSession[] {
  const quadSet = () =>
    templateExercise("quad-set", "Quad Set / Activation", {
      sets: 3,
      reps: "10 × 5s hold",
      restSec: 30,
    });
  const heelSlide = () =>
    templateExercise("heel-slide", "Heel Slide", {
      sets: 3,
      reps: "12–15",
      restSec: 45,
    });
  const terminalKneeExtension = () =>
    templateExercise("terminal-knee-extension", "Terminal Knee Extension", {
      sets: 3,
      reps: "10–12",
      restSec: 45,
    });
  const shortArcQuad = () =>
    templateExercise("short-arc-quad", "Short Arc Quad", {
      sets: 3,
      reps: 10,
      restSec: 45,
    });
  const straightLegRaise = () =>
    templateExercise("straight-leg-raise", "Straight Leg Raise", {
      sets: 3,
      reps: "8–10",
      restSec: 45,
    });
  const sitToStand = () =>
    templateExercise("sit-to-stand", "Sit-to-Stand", {
      sets: 3,
      reps: "8–12",
      restSec: 60,
    });
  const heelRaise = () =>
    templateExercise("heel-raise", "Heel Raises", {
      sets: 3,
      reps: "12–15",
      restSec: 45,
    });
  const miniSquat = () =>
    templateExercise("mini-squat", "Mini Squat (0–45°)", {
      sets: 3,
      reps: "10–15",
      restSec: 60,
    });
  const stepUp = () =>
    templateExercise("step-up", "Step-Up", {
      sets: 3,
      reps: "8–10 each leg",
      restSec: 60,
    });
  const singleLegStance = () =>
    templateExercise("single-leg-stance", "Single-Leg Stance", {
      sets: 3,
      durationSec: 30,
      restSec: 45,
    });
  const lateralBandWalk = () =>
    templateExercise("lateral-band-walk", "Lateral Band Walk", {
      sets: 3,
      reps: "10 steps each direction",
      restSec: 60,
    });
  const walkingTolerance = () =>
    templateExercise("walking-tolerance", "Walking Tolerance", {
      sets: 1,
      durationSec: 420,
      restSec: 0,
    });

  return [
    {
      sessionNumber: 1,
      title: "Session 1 — Activation I",
      exercises: [quadSet(), heelSlide(), terminalKneeExtension()],
    },
    {
      sessionNumber: 2,
      title: "Session 2 — Activation II",
      exercises: [quadSet(), shortArcQuad(), heelSlide()],
    },
    {
      sessionNumber: 3,
      title: "Session 3 — Extension control",
      exercises: [straightLegRaise(), terminalKneeExtension(), quadSet()],
    },
    {
      sessionNumber: 4,
      title: "Session 4 — Sit-to-stand intro",
      exercises: [sitToStand(), heelRaise(), quadSet()],
    },
    {
      sessionNumber: 5,
      title: "Session 5 — Closed-chain prep",
      exercises: [miniSquat(), sitToStand(), heelRaise()],
    },
    {
      sessionNumber: 6,
      title: "Session 6 — Step & balance",
      exercises: [stepUp(), singleLegStance(), heelRaise()],
    },
    {
      sessionNumber: 7,
      title: "Session 7 — Load week 3",
      exercises: [miniSquat(), stepUp(), sitToStand()],
    },
    {
      sessionNumber: 8,
      title: "Session 8 — Lateral control",
      exercises: [lateralBandWalk(), singleLegStance(), miniSquat()],
    },
    {
      sessionNumber: 9,
      title: "Session 9 — Volume",
      exercises: [sitToStand(), stepUp(), walkingTolerance()],
    },
    {
      sessionNumber: 10,
      title: "Session 10 — Integration I",
      exercises: [miniSquat(), singleLegStance(), sitToStand()],
    },
    {
      sessionNumber: 11,
      title: "Session 11 — Integration II",
      exercises: [stepUp(), lateralBandWalk(), walkingTolerance()],
    },
    {
      sessionNumber: 12,
      title: "Session 12 — Review session",
      exercises: [sitToStand(), singleLegStance(), miniSquat()],
    },
  ];
}

/** RASQ Sports Knee Foundation v1 — 6 sessions, 3 phases (7-exercise scope) */
function buildSportsKneeFoundationV1Sessions(): PilotProgramSession[] {
  return [
    {
      sessionNumber: 1,
      title: "Session 1 — Closed-Chain Start",
      exercises: [
        templateExercise("sit-to-stand", "Sit-to-Stand", {
          sets: 3,
          reps: "8–10",
          restSec: 60,
        }),
        templateExercise("heel-raise", "Heel Raises", {
          sets: 3,
          reps: "12–15",
          restSec: 45,
        }),
      ],
    },
    {
      sessionNumber: 2,
      title: "Session 2 — Squat & Balance Intro",
      exercises: [
        templateExercise("mini-squat", "Mini Squat (0–45°)", {
          sets: 3,
          reps: 10,
          restSec: 60,
        }),
        templateExercise("single-leg-stance", "Single Leg Stance — 20 s each leg", {
          sets: 3,
          durationSec: 20,
          restSec: 45,
        }),
      ],
    },
    {
      sessionNumber: 3,
      title: "Session 3 — Dynamic Balance",
      exercises: [
        templateExercise("sit-to-stand", "Sit-to-Stand", {
          sets: 3,
          reps: "10–12",
          restSec: 60,
        }),
        templateExercise("heel-raise", "Heel Raises", {
          sets: 3,
          reps: 15,
          restSec: 45,
        }),
        templateExercise("functional-reach", "Functional Reach", {
          sets: 3,
          reps: "3 each arm",
          restSec: 30,
        }),
      ],
    },
    {
      sessionNumber: 4,
      title: "Session 4 — Lateral Control",
      exercises: [
        templateExercise("mini-squat", "Mini Squat (0–45°)", {
          sets: 3,
          reps: "12–15",
          restSec: 60,
        }),
        templateExercise("lateral-step", "Lateral Step", {
          sets: 3,
          reps: "8 each direction",
          restSec: 60,
        }),
        templateExercise("single-leg-stance", "Single Leg Stance — 25 s each leg", {
          sets: 3,
          durationSec: 25,
          restSec: 45,
        }),
      ],
    },
    {
      sessionNumber: 5,
      title: "Session 5 — Step Loading",
      exercises: [
        templateExercise("step-up", "Low Step-Up", {
          sets: 3,
          reps: "8 each leg",
          restSec: 60,
        }),
        templateExercise("sit-to-stand", "Sit-to-Stand", {
          sets: 3,
          reps: 12,
          restSec: 60,
        }),
        templateExercise("functional-reach", "Functional Reach", {
          sets: 3,
          reps: "4 each arm",
          restSec: 30,
        }),
      ],
    },
    {
      sessionNumber: 6,
      title: "Session 6 — Integration & Review",
      exercises: [
        templateExercise("mini-squat", "Mini Squat (0–45°)", {
          sets: 3,
          reps: 12,
          restSec: 60,
        }),
        templateExercise("step-up", "Low Step-Up", {
          sets: 3,
          reps: "10 each leg",
          restSec: 60,
        }),
        templateExercise("lateral-step", "Lateral Step", {
          sets: 3,
          reps: "10 each direction",
          restSec: 60,
        }),
        templateExercise("single-leg-stance", "Single Leg Stance — 30 s each leg", {
          sets: 3,
          durationSec: 30,
          restSec: 45,
        }),
      ],
    },
  ];
}

function defineExpandedProgram(config: {
  id: string;
  title: string;
  conditionArea: string;
  level: string;
  programGoal: string;
  conditionCategory: string;
  bodyRegion: ProgramBodyRegion;
  durationWeeks: number;
  sessionsPerWeek: number;
  suitableFor: string;
  notSuitableFor: string;
  safetyNotes: string;
  redFlags: string;
  reviewCriteria: string;
  clinicianUseNote: string;
  patientFriendlyGoal: string;
  phaseGoal: string;
  expectedResponse: string;
  exerciseLabels: string[];
}): PilotProgramTemplate {
  return {
    id: config.id,
    title: config.title,
    conditionArea: config.conditionArea,
    level: config.level,
    programGoal: config.programGoal,
    conditionCategory: config.conditionCategory,
    bodyRegion: config.bodyRegion,
    durationWeeks: config.durationWeeks,
    sessionsPerWeek: config.sessionsPerWeek,
    suitableFor: config.suitableFor,
    notSuitableFor: config.notSuitableFor,
    phaseGoal: config.phaseGoal,
    expectedResponse: config.expectedResponse,
    safetyNotes: config.safetyNotes,
    redFlags: config.redFlags,
    reviewCriteria: config.reviewCriteria,
    clinicianUseNote: config.clinicianUseNote,
    patientFriendlyGoal: config.patientFriendlyGoal,
    sessions: buildSessionsFromLabels(config.exerciseLabels),
  };
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

  // ── Sprint L expanded programs (12) — distinct IDs; legacy pilots preserved above ──

  defineExpandedProgram({
    id: "knee-foundation-01",
    title: "Knee Rehabilitation — Foundation",
    conditionArea: "Knee",
    level: "Beginner",
    conditionCategory: "Orthopedic Rehabilitation",
    bodyRegion: "knee",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Reduce knee pain, restore range of motion, and improve quadriceps and hamstring strength to support functional weight-bearing and daily mobility.",
    patientFriendlyGoal:
      "Help your knee feel stronger and more comfortable during everyday movements like walking, standing, and climbing stairs.",
    suitableFor:
      "Non-operative knee pain. Subacute or chronic onset. Mild to moderate pain (≤6/10 on movement). Able to partial or full weight-bear. Suitable for patellofemoral pain, knee OA, tendinopathy.",
    notSuitableFor:
      "Acute post-operative (<6 weeks without specific protocol). Severe pain at rest (>7/10). Suspected fracture. Locked knee. Severe swelling with inability to weight-bear.",
    safetyNotes:
      "Stop if pain exceeds 5/10 during exercise. Avoid deep squats in early phase. Monitor for increased swelling after sessions. Ice after exercise if swelling present.",
    redFlags:
      "Locking or giving way. Significant effusion. Inability to weight-bear. Night pain. Recent significant trauma. Neurovascular compromise.",
    reviewCriteria:
      "Review if pain increases by 2 or more points over two consecutive sessions. Review if effort consistently reported above 8/10. Review if new symptoms develop, including swelling, locking, or giving way.",
    clinicianUseNote:
      "Clinical examination required before program assignment. Begin with open-chain exercises before progressing to closed-chain loading. Ensure VMO activation pattern before functional movements. Adjust load based on pain response.",
    phaseGoal:
      "Restore voluntary quadriceps control, comfortable knee flexion, and supported functional movement.",
    expectedResponse:
      "Stable or decreasing pain after sessions with improving activation and sit-to-stand confidence.",
    exerciseLabels: [
      "Quad Sets",
      "Straight Leg Raise",
      "Terminal Knee Extension",
      "Mini Squat (0-30 degrees)",
      "Step-Up Low Step",
      "Calf Raise Bilateral",
      "Seated Knee Extension Partial Arc",
      "Prone Knee Flexion",
    ],
  }),

  {
    id: "sports-knee-foundation",
    title: "Sports Knee Foundation",
    conditionArea: "Knee",
    level: "Foundation",
    programGoal:
      "Structured four-week foundation for active patients: restore quadriceps activation and knee ROM, build closed-chain tolerance and single-leg control, and establish pain/effort reporting — with therapist review before any progression.",
    conditionCategory: "Sports / orthopedic rehabilitation (foundation phase)",
    bodyRegion: "knee",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    suitableFor:
      "Active adults and recreational athletes with subacute or chronic knee symptoms. Cleared for partial or full weight-bearing. Pain during movement typically ≤ 6/10 at start (clinician-adjustable). Examples: patellofemoral pain, mild/moderate knee OA, post-injury deconditioning, foundation-phase post-ACL with surgeon/protocol alignment.",
    notSuitableFor:
      "Non–weight-bearing or touch-down weight-bearing without clearance. Acute post-operative < 6 weeks without surgeon protocol. Locked knee, suspected fracture, joint infection. Repeated giving way without supervision plan. Unresolved red flags.",
    phaseGoal:
      "Restore voluntary quadriceps control, comfortable knee flexion, closed-chain tolerance, and single-leg balance — preparing for clinician-led review, not automatic sport return.",
    expectedResponse:
      "Stable or decreasing pain after sessions, manageable effort scores, and improving control on activation and functional tasks. Optional sit-to-stand CV assist may support therapist review — not required for completion.",
    safetyNotes:
      "Stop if sharp pain occurs during exercise. Stay ≤ 5/10 during exercise unless clinician sets a higher limit. Monitor for swelling after sessions. Contact clinic if sharp pain > 7/10, new giving way, locking, or rapid swelling within 2 hours.",
    redFlags:
      "Locked knee. Acute fracture suspicion. Joint infection. Numbness, foot drop, or pulse deficit. Non–weight-bearing status without clearance. Repeated giving way. Unexplained fever or unrelenting night pain.",
    reviewCriteria:
      "Review before session 1 (confirm inclusion and dose). Mid-program review after session 6. End-of-program review after session 12. Review if pain increases ≥ 2 points over two consecutive sessions, effort ≥ 8/10 for three sessions, zero sessions in 7 days, or new locking, giving way, or swelling reports.",
    clinicianUseNote:
      "Therapist-guided sports knee foundation program for early-to-mid stage strengthening, movement confidence, and graded loading. Not return-to-sport clearance. Clinical examination required before assignment. Edit dose, order, and exclusions before assigning. RASQ does not auto-progress — clinician approves all progression.",
    patientFriendlyGoal:
      "Build knee strength and movement confidence for everyday activities and training prep. Complete your sessions and report pain and effort honestly — your therapist reviews progress and decides next steps. This plan does not clear you to return to sport.",
    sessions: buildSportsKneeFoundationSessions(),
  },

  {
    id: "sports-knee-foundation-v1",
    title: "Sports Knee Foundation v1",
    conditionArea: "Knee",
    level: "Foundation",
    programGoal:
      "Six-session foundation for active patients: build closed-chain strength, single-leg balance, dynamic reach, and step confidence — with therapist review before any progression. Optional CV assist on sit-to-stand, mini squat, and single-leg stance.",
    conditionCategory:
      "Early sports knee rehabilitation / functional strengthening / balance foundation",
    bodyRegion: "knee",
    durationWeeks: 2,
    sessionsPerWeek: 3,
    suitableFor:
      "Active adults and recreational athletes with subacute or chronic knee symptoms. Cleared for partial or full weight-bearing. Pain during movement typically ≤ 6/10 at start (clinician-adjustable). Able to perform sit-to-stand from a standard chair.",
    notSuitableFor:
      "Non–weight-bearing or touch-down weight-bearing without clearance. Locked knee, suspected fracture, joint infection. Repeated giving way without supervision plan. Acute post-operative restrictions without surgeon protocol alignment. Unresolved red flags.",
    phaseGoal:
      "Phase 1: closed-chain introduction. Phase 2: strength and dynamic balance. Phase 3: functional integration — clinician reviews exit criteria; no automatic progression.",
    expectedResponse:
      "Stable or decreasing pain after sessions, manageable effort scores, and improving control on sit-to-stand, mini squat, step-up, and balance tasks. Optional CV assist may support therapist review — not required for completion.",
    safetyNotes:
      "Stop if sharp pain occurs during exercise. Stay ≤ 5/10 during exercise unless clinician sets a higher limit. Monitor for swelling after sessions. Contact clinic if sharp pain > 7/10, new giving way, locking, rapid swelling within 2 hours, or dizziness during balance tasks.",
    redFlags:
      "Locked knee. Acute fracture suspicion. Joint infection. Numbness, foot drop, or pulse deficit. Non–weight-bearing status without clearance. Repeated giving way. Unexplained fever or unrelenting night pain.",
    reviewCriteria:
      "Review before session 1 (confirm inclusion and dose). Mid-program review after session 3. End-of-program review after session 6. Review if pain increases ≥ 2 points over two consecutive sessions, effort ≥ 8/10 for three sessions, zero sessions in 7 days, or new locking, giving way, or swelling reports.",
    clinicianUseNote:
      "Therapist-guided sports knee foundation v1 — 7 exercises only. Not return-to-sport clearance. Clinical examination required before assignment. Edit dose, order, and exclusions before assigning. RASQ does not auto-progress — clinician approves all progression.",
    patientFriendlyGoal:
      "Build knee strength and stability for standing, squatting, stepping, and balancing over 6 sessions. Report pain and effort honestly — your therapist reviews progress and decides next steps. This plan does not clear you to return to sport.",
    sessions: buildSportsKneeFoundationV1Sessions(),
  },

  {
    id: MOVE_BETTER_PERFORMANCE_V1.id,
    title: MOVE_BETTER_PERFORMANCE_V1.name,
    conditionArea: "General fitness",
    level: "Performance",
    programGoal: MOVE_BETTER_PERFORMANCE_V1.tagline,
    conditionCategory: "General public fitness / standing movement",
    bodyRegion: "general",
    durationWeeks: MOVE_BETTER_PERFORMANCE_V1.totalWeeks,
    sessionsPerWeek: MOVE_BETTER_PERFORMANCE_V1.sessionsPerWeek,
    suitableFor:
      "General public adults who can stand safely for short intervals without equipment. Suitable for deconditioned or time-limited users seeking a structured 20-minute movement routine.",
    notSuitableFor:
      "Acute injury, unresolved balance instability, or medical restrictions to standing exercise without clinician clearance. Not a clinical rehabilitation prescription.",
    phaseGoal:
      "Week 1 foundation: build standing movement confidence with 45 s work / 15 s rest intervals. Week 2 performance: same exercises with 45 s work / 10 s rest.",
    expectedResponse:
      "Improved standing tolerance, movement rhythm, and session completion confidence. Optional movement checks are for progress comparison only — not clinical assessment.",
    safetyNotes:
      "Stop if sharp pain, dizziness, or loss of balance occurs. This program does not provide diagnosis, progression advice, or quality scores. Movement checks are optional and not part of the main workout.",
    redFlags:
      "Severe dizziness, chest pain, or inability to weight-bear. Seek medical review before continuing.",
    reviewCriteria:
      "Optional clinician review if assigning to patients with known MSK conditions. Program is designed for general-public use without mandatory clinical review.",
    clinicianUseNote:
      "Fitness program template — not a clinical prescription. Review exercise selection and dose before assigning to patients with medical history. Gamification metadata is prepared but not yet implemented in the patient portal.",
    patientFriendlyGoal: MOVE_BETTER_PERFORMANCE_V1.tagline,
    sessions: buildMoveBetterPerformanceV1PilotSessions(),
  },

  defineExpandedProgram({
    id: "lumbar-foundation-01",
    title: "Low Back Pain — Foundation",
    conditionArea: "Low back",
    level: "Beginner",
    conditionCategory: "MSK Rehabilitation",
    bodyRegion: "lumbar",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Reduce lumbar pain, improve core stability and lumbar mobility, and restore functional capacity for daily activities including sitting, standing, and walking.",
    patientFriendlyGoal:
      "Help your back feel more supported and comfortable during daily activities like sitting at work, standing, and walking.",
    suitableFor:
      "Non-specific low back pain. Subacute or chronic onset. Able to mobilise independently. No significant neurological deficit. Suitable for postural LBP, lumbar muscle strain, mild disc-related pain.",
    notSuitableFor:
      "Acute disc prolapse with neurological deficit. Cauda equina syndrome (emergency — do not assign). Suspected fracture. Severe radiculopathy with progressive neurological signs. Red flags present.",
    safetyNotes:
      "Avoid end-range lumbar flexion in acute phase. Stop if leg pain develops or increases during exercise. Monitor for bladder or bowel changes throughout rehabilitation. Do not progress if symptoms peripheralise.",
    redFlags:
      "Bladder or bowel dysfunction. Bilateral leg symptoms. Saddle area numbness. Severe progressive neurological deficit. Night pain severe and unrelenting. Unexplained weight loss.",
    reviewCriteria:
      "Review if leg pain develops or radiates below the knee. Review if pain at rest worsens. Review if neurological symptoms change. Review if no improvement after 4 sessions.",
    clinicianUseNote:
      "Directional preference assessment recommended before program assignment. McKenzie or motor control approach based on clinical findings. Avoid loaded flexion until pain-free range established.",
    phaseGoal:
      "Calm symptoms, restore gentle spinal mobility, and establish neutral spine control for daily movement.",
    expectedResponse:
      "Symptoms stable or easing after sessions with improved confidence for bending and walking tasks.",
    exerciseLabels: [
      "Pelvic Tilt",
      "Knee to Chest Stretch",
      "Cat-Cow Mobilisation",
      "Dead Bug",
      "Glute Bridge",
      "Bird Dog",
      "Hip Flexor Stretch",
      "Prone Press-Up",
    ],
  }),

  defineExpandedProgram({
    id: "shoulder-foundation-01",
    title: "Shoulder Mobility and Stability — Foundation",
    conditionArea: "Shoulder",
    level: "Beginner",
    conditionCategory: "Orthopedic Rehabilitation",
    bodyRegion: "shoulder",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Restore shoulder range of motion and rotator cuff and scapular muscle strength to support pain-free functional movement including reaching and lifting.",
    patientFriendlyGoal:
      "Help your shoulder move more freely and feel more stable during daily activities like reaching, lifting, and dressing.",
    suitableFor:
      "Rotator cuff tendinopathy. Subacromial impingement. Adhesive capsulitis non-acute phase. Shoulder pain with functional limitation. Mild to moderate severity.",
    notSuitableFor:
      "Acute full-thickness rotator cuff rupture. Acute shoulder dislocation. Fracture. Severe acute inflammatory phase. Post-operative without specific protocol.",
    safetyNotes:
      "Avoid aggressive end-range movements in acute phase. Monitor painful arc during exercises. Stop if sharp catching pain occurs. Avoid overhead loading until pain-free at 90 degrees of elevation.",
    redFlags:
      "Acute dislocation. Significant sudden weakness suggesting complete rupture. Severe night pain. Recent trauma. Vascular compromise.",
    reviewCriteria:
      "Review if range of motion decreases. Review if pain increases with exercise. Review if patient reports instability or clicking with pain. Review if no progress after 4 sessions.",
    clinicianUseNote:
      "Assess scapular control and thoracic mobility before rotator cuff loading. Differentiate impingement from instability. Clinical examination required to confirm clinical findings before program assignment.",
    phaseGoal:
      "Restore comfortable passive and assisted range with scapular stability before loaded rotation work.",
    expectedResponse:
      "Gradual ROM improvement with reduced stiffness after sessions and no increase in night pain or pinching.",
    exerciseLabels: [
      "Pendulum Circles",
      "Shoulder Blade Squeeze",
      "External Rotation Elbow at Side",
      "Side-Lying External Rotation",
      "Wall Slide",
      "Doorway Chest Stretch",
      "Prone Y-T-W",
      "Serratus Anterior Punch",
    ],
  }),

  defineExpandedProgram({
    id: "cervical-foundation-01",
    title: "Neck Pain and Mobility — Foundation",
    conditionArea: "Neck",
    level: "Beginner",
    conditionCategory: "MSK Rehabilitation",
    bodyRegion: "cervical",
    durationWeeks: 3,
    sessionsPerWeek: 3,
    programGoal:
      "Reduce cervical pain, restore cervical range of motion, and improve deep cervical flexor and postural muscle endurance to support comfortable daily function.",
    patientFriendlyGoal:
      "Help your neck feel less painful and move more comfortably during daily activities including work, driving, and sleep.",
    suitableFor:
      "Non-specific neck pain. Postural neck pain. Cervicogenic headache with therapist confirmation. Subacute or chronic duration. No significant radiculopathy.",
    notSuitableFor:
      "Cervical myelopathy. Suspected instability including rheumatoid arthritis or post-trauma. Acute fracture. Severe radiculopathy with progressive neurological deficit. Basilar artery insufficiency symptoms.",
    safetyNotes:
      "Screen for vertebrobasilar insufficiency before cervical rotation exercises. Avoid combined extension and rotation in acute phase. Stop if dizziness, nausea, or vision changes occur during exercise.",
    redFlags:
      "Dizziness or drop attacks. Dysphagia. Bilateral upper limb symptoms. Progressive neurological weakness. History of significant trauma. Myelopathy signs.",
    reviewCriteria:
      "Review if headaches develop or worsen. Review if arm symptoms change or increase. Review if dizziness occurs with exercise. Review if no improvement after 3 sessions.",
    clinicianUseNote:
      "Screen for VBI and cervical instability before assigning. Deep cervical flexor training is first priority. Avoid high-velocity or end-range cervical rotation. Assess for cervicogenic headache separately.",
    phaseGoal:
      "Restore comfortable cervical movement and postural endurance for daily tasks.",
    expectedResponse:
      "Reduced stiffness and improved tolerance for sustained postures after sessions.",
    exerciseLabels: [
      "Chin Tuck Deep Cervical Flexor",
      "Cervical Rotation Pain-Free Range",
      "Cervical Lateral Flexion Stretch",
      "Upper Trapezius Stretch",
      "Shoulder Blade Retraction",
      "Postural Awareness Exercise",
    ],
  }),

  defineExpandedProgram({
    id: "ankle-foundation-01",
    title: "Ankle Rehabilitation — Foundation",
    conditionArea: "Ankle",
    level: "Beginner",
    conditionCategory: "Orthopedic Rehabilitation",
    bodyRegion: "ankle",
    durationWeeks: 3,
    sessionsPerWeek: 3,
    programGoal:
      "Restore ankle range of motion, peroneal and calf strength, and proprioception to support pain-free weight-bearing and functional mobility.",
    patientFriendlyGoal:
      "Help your ankle feel stronger and more stable so you can walk, stand, and move with confidence.",
    suitableFor:
      "Lateral ankle sprain subacute or chronic. Mild ligament injury. Able to partial or full weight-bear. Ankle pain with functional limitation.",
    notSuitableFor:
      "Suspected fracture — Ottawa Rules positive. Complete ligament rupture requiring surgical management. Non-weight-bearing status. Neurovascular compromise.",
    safetyNotes:
      "Monitor swelling after each session. Progress weight-bearing gradually. Stop if sharp pain occurs with weight-bearing or balance exercises. Ice after sessions if swelling present.",
    redFlags:
      "Suspected fracture. Complete instability. Neurovascular compromise. Significant increasing swelling unresponsive to rest.",
    reviewCriteria:
      "Review if swelling significantly increases after sessions. Review if pain worsens with weight-bearing. Review if balance exercises cause consistent sharp pain.",
    clinicianUseNote:
      "Apply Ottawa Rules before program assignment to rule out fracture. Begin non-weight-bearing ROM before progressing to weight-bearing and proprioception. Taping may support early phase.",
    phaseGoal:
      "Restore comfortable ankle ROM and supported single-leg balance for walking.",
    expectedResponse:
      "Improving weight-bearing tolerance and balance confidence after sessions.",
    exerciseLabels: [
      "Ankle Pumps",
      "Ankle Circles",
      "Towel Calf Stretch",
      "Calf Raise Bilateral",
      "Single Leg Stance Eyes Open",
      "Heel-Toe Walking",
      "Theraband Dorsiflexion",
      "Theraband Inversion and Eversion",
    ],
  }),

  defineExpandedProgram({
    id: "hip-foundation-01",
    title: "Hip Rehabilitation — Foundation",
    conditionArea: "Hip",
    level: "Beginner",
    conditionCategory: "Orthopedic Rehabilitation",
    bodyRegion: "hip",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Reduce hip pain, restore range of motion, and improve hip abductor and extensor strength to support comfortable walking and daily functional mobility.",
    patientFriendlyGoal:
      "Help your hip feel stronger and more comfortable with walking, stairs, and everyday movements.",
    suitableFor:
      "Hip osteoarthritis mild to moderate. Greater trochanteric pain syndrome. Hip flexor tightness. Non-operative hip pain with functional limitation.",
    notSuitableFor:
      "Acute fracture or stress fracture. Hip replacement less than 6 weeks post-operative without specific protocol. Severe hip OA with complete functional loss. Suspected avascular necrosis.",
    safetyNotes:
      "Avoid hip adduction across midline in post-THR patients. Monitor for groin pain with rotation exercises. Stop if clicking occurs with pain. Avoid end-range hip extension in irritable phase.",
    redFlags:
      "Groin pain at rest severe and unrelenting. Suspected avascular necrosis. Stress fracture. Significant antalgic gait. Pain referred from lumbar spine requiring differentiation.",
    reviewCriteria:
      "Review if pain at rest increases. Review if range of motion decreases. Review if patient reports new symptoms including groin pain or clicking with pain.",
    clinicianUseNote:
      "Differentiate hip from lumbar source before program assignment. Assess FABER and FADIR before loading. Hip OA patients may require graded exposure approach.",
    phaseGoal:
      "Improve hip control for walking and supported single-leg tasks.",
    expectedResponse:
      "Improved tolerance for walking and stair-related tasks with stable pain response.",
    exerciseLabels: [
      "Supine Hip Flexion Knee Bent",
      "Clamshell",
      "Side-Lying Hip Abduction",
      "Glute Bridge",
      "Standing Hip Extension",
      "Hip Flexor Stretch Kneeling",
      "Piriformis Stretch",
      "Step-Up Low",
    ],
  }),

  defineExpandedProgram({
    id: "post-op-knee-early-01",
    title: "Post-Operative Knee — Early Rehabilitation Phase",
    conditionArea: "Knee",
    level: "Beginner",
    conditionCategory: "Post-Operative Rehabilitation",
    bodyRegion: "knee",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Reduce post-operative pain and swelling, restore early range of motion, and initiate quadriceps activation to support safe weight-bearing progression.",
    patientFriendlyGoal:
      "Help your knee recover safely after surgery by gently restoring movement and building the muscle strength needed to walk comfortably.",
    suitableFor:
      "Post-operative knee rehabilitation. Suitable for post-ACL reconstruction, meniscus repair, knee arthroscopy, or TKR when cleared by surgeon for physiotherapy. Follow surgeon protocol.",
    notSuitableFor:
      "Do not assign without surgical clearance and specific post-operative protocol guidance. Not suitable for acute wound complications, deep vein thrombosis, or infection.",
    safetyNotes:
      "Always follow the specific post-operative protocol provided by the operating surgeon. Stop if wound drainage increases, significant swelling develops, or severe pain occurs. Monitor for DVT signs including calf pain and swelling.",
    redFlags:
      "Calf pain or swelling suggesting DVT. Wound dehiscence or infection signs. Severe uncontrolled pain. Fever. Inability to achieve expected range of motion milestones per surgical protocol.",
    reviewCriteria:
      "Review if swelling significantly increases after exercise. Review if range of motion does not progress as expected. Review if pain at rest increases. Review at each surgical milestone checkpoint.",
    clinicianUseNote:
      "This program provides a general framework only. The specific post-operative protocol from the surgeon takes precedence. Confirm weight-bearing status and range of motion precautions before each session. Do not progress independently of surgical protocol.",
    phaseGoal:
      "Restore early knee flexion and reliable quadriceps activation within surgical precautions.",
    expectedResponse:
      "Decreasing swelling and improving quad activation with milestone-appropriate ROM.",
    exerciseLabels: [
      "Ankle Pumps Post-Op",
      "Quad Sets Post-Op",
      "Straight Leg Raise",
      "Heel Slides",
      "Seated Knee Flexion Assisted",
      "Short Arc Quads",
      "Standing Calf Raise Bilateral",
    ],
  }),

  defineExpandedProgram({
    id: "balance-gait-foundation-01",
    title: "Balance and Gait — Foundation",
    conditionArea: "Lower limb",
    level: "Beginner",
    conditionCategory: "Balance and Gait Rehabilitation",
    bodyRegion: "lower-limb",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Improve static and dynamic balance, lower limb proprioception, and gait quality to reduce fall risk and support independent functional mobility.",
    patientFriendlyGoal:
      "Help you feel more steady and confident when standing, walking, and moving around daily.",
    suitableFor:
      "Balance difficulty reported. Mild to moderate gait impairment. Fall risk or history of falls. Lower limb proprioception deficit. Suitable for older adults, post-injury balance training, or vestibular-cleared patients.",
    notSuitableFor:
      "Active neurological event without specialist clearance. Severe vestibular disorder without ENT or vestibular physiotherapy clearance. Cardiovascular instability. Dementia without supervised exercise environment.",
    safetyNotes:
      "Always exercise near a wall or stable support surface. Ensure environment is clear of obstacles. Stop if dizziness, vision changes, or loss of balance occurs. Supervised environment recommended for high fall-risk patients.",
    redFlags:
      "Sudden onset balance loss. Neurological symptoms including weakness, numbness, or vision changes. Unexplained falls. Cardiovascular symptoms during exercise.",
    reviewCriteria:
      "Review if falls occur during or after exercise. Review if dizziness develops. Review if neurological symptoms change. Review if no functional improvement after 4 sessions.",
    clinicianUseNote:
      "Differentiate peripheral, central, and vestibular contributions to balance impairment before program assignment. Supervised environment recommended. Progress surface and vision challenges gradually.",
    phaseGoal:
      "Improve steady standing balance and controlled gait patterns.",
    expectedResponse:
      "Improved balance confidence and gait stability after sessions.",
    exerciseLabels: [
      "Single Leg Stance Eyes Open",
      "Single Leg Stance Eyes Closed",
      "Heel-Toe Walking",
      "Side Step",
      "Tandem Standing",
      "Step-Up and Step-Down",
      "Sit to Stand",
      "Backward Walking Short Distance",
    ],
  }),

  defineExpandedProgram({
    id: "sports-rta-foundation-01",
    title: "Sports Return to Activity — Foundation",
    conditionArea: "General",
    level: "Intermediate",
    conditionCategory: "Sports Rehabilitation",
    bodyRegion: "general",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Rebuild functional strength, movement quality, and sport-specific conditioning to support a safe return to physical activity and sport participation.",
    patientFriendlyGoal:
      "Help you rebuild strength and confidence to return to your sport or physical activity safely.",
    suitableFor:
      "Post-injury or post-rehabilitation patient cleared for return-to-activity phase. Sport or activity goal stated. Pain well-controlled (≤3/10 with activity). Full or near-full range of motion.",
    notSuitableFor:
      "Active injury. Pain at rest above 3/10. Significant range of motion deficit. Post-operative without surgical clearance for return-to-activity phase. High-contact sport return without specific protocol.",
    safetyNotes:
      "Pain should not exceed 3/10 during activity. Monitor for re-injury signs after sessions. Functional movement quality takes priority over intensity. Stop and review if pain increases after activity.",
    redFlags:
      "Pain recurrence above 3/10 at rest. Re-injury or suspected re-injury. Significant swelling return. Psychological readiness concern.",
    reviewCriteria:
      "Review if pain increases above 3/10 with activity. Review if functional tests show asymmetry. Review before progressing to contact or high-load sport-specific activities.",
    clinicianUseNote:
      "Functional testing recommended before program assignment including limb symmetry index where applicable. This program is a general foundation and should be supplemented with sport-specific conditioning by the treating clinician.",
    phaseGoal:
      "Rebuild load tolerance and movement quality for return-to-activity progression.",
    expectedResponse:
      "Improving strength and control with activity-related pain ≤3/10.",
    exerciseLabels: [
      "Lateral Band Walk",
      "Single Leg Squat",
      "Nordic Hamstring Curl",
      "Box Jump Landing",
      "Agility Ladder Basic Pattern",
      "Plyometric Step-Up",
      "Core Stability Plank",
      "Romanian Deadlift",
    ],
  }),

  defineExpandedProgram({
    id: "neuro-mobility-foundation-01",
    title: "Neurological Mobility — Foundation",
    conditionArea: "General",
    level: "Beginner",
    conditionCategory: "Neurological Rehabilitation",
    bodyRegion: "general",
    durationWeeks: 6,
    sessionsPerWeek: 3,
    programGoal:
      "Maintain and gently improve functional mobility, postural control, and upper and lower limb movement quality in patients with stable neurological conditions.",
    patientFriendlyGoal:
      "Help you stay as mobile and independent as possible in daily activities.",
    suitableFor:
      "Stable neurological condition including mild stroke, Parkinson disease early stage, multiple sclerosis stable phase, or peripheral neuropathy. Patient able to follow instructions and participate in exercise.",
    notSuitableFor:
      "Acute neurological event — do not assign during acute phase. Rapidly progressing neurological conditions. Cognitive impairment preventing safe exercise participation without supervision. Cardiovascular instability.",
    safetyNotes:
      "Fatigue management is essential — shorten sessions if fatigue develops. Monitor for dizziness, increased spasticity, or falls. Supervised environment strongly recommended. Stop if new neurological symptoms develop.",
    redFlags:
      "New or worsening neurological symptoms. Sudden weakness. New falls. Cardiovascular symptoms during exercise. Significant fatigue change.",
    reviewCriteria:
      "Review if new neurological symptoms develop. Review if fatigue significantly increases. Review if falls occur. Review with specialist if condition status changes.",
    clinicianUseNote:
      "This program is for stable neurological conditions only. Specialist physiotherapy assessment is recommended before assignment. Fatigue and exacerbation management must be discussed with patient. Exercise intensity should be conservative.",
    phaseGoal:
      "Support safe functional mobility and postural control in daily tasks.",
    expectedResponse:
      "Stable participation with manageable fatigue and no new neurological symptoms.",
    exerciseLabels: [
      "Seated Marching",
      "Sit to Stand Assisted",
      "Standing Weight Shift",
      "Supported Single Leg Stance",
      "Upper Limb Reaching Seated",
      "Ankle Pumps Neurological",
      "Heel-Toe Walking Supported",
    ],
  }),

  defineExpandedProgram({
    id: "deconditioning-foundation-01",
    title: "General Deconditioning — Foundation",
    conditionArea: "General",
    level: "Beginner",
    conditionCategory: "General MSK Rehabilitation",
    bodyRegion: "general",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    programGoal:
      "Improve general muscular strength, endurance, and functional mobility in patients experiencing reduced activity tolerance or deconditioning.",
    patientFriendlyGoal:
      "Help you feel stronger and more energised during everyday activities like walking, standing, and climbing stairs.",
    suitableFor:
      "General deconditioning. Reduced activity tolerance. Post-illness mobility loss. Mild frailty with therapist assessment. Patients returning to activity after extended rest.",
    notSuitableFor:
      "Acute illness or infection. Cardiovascular instability. Severe frailty without specialist geriatric assessment. Metabolic conditions requiring specialist exercise prescription.",
    safetyNotes:
      "Begin with low intensity and progress gradually based on tolerance. Monitor for excessive fatigue, dizziness, or chest discomfort. Stop and review if cardiovascular symptoms develop. Hydration and rest important.",
    redFlags:
      "Chest pain or palpitations during exercise. Severe dizziness or syncope. Unexplained weight loss. Rapid deterioration in function.",
    reviewCriteria:
      "Review if exercise tolerance decreases rather than improves. Review if cardiovascular symptoms develop. Review if significant fatigue prevents session completion for two consecutive sessions.",
    clinicianUseNote:
      "Medical clearance recommended for patients with known cardiovascular or metabolic conditions. Start conservative and progress based on patient response. Graded exercise approach.",
    phaseGoal:
      "Rebuild basic strength and endurance for daily functional tasks.",
    expectedResponse:
      "Gradual improvement in activity tolerance and session completion.",
    exerciseLabels: [
      "Sit to Stand",
      "Marching on Spot",
      "Wall Press-Up",
      "Seated Leg Extension",
      "Standing Hip Abduction",
      "Step Touch Side to Side",
      "Calf Raise Bilateral",
    ],
  }),

  defineExpandedProgram({
    id: "pain-mobility-beginner-01",
    title: "Pain and Mobility — Beginner",
    conditionArea: "General",
    level: "Beginner",
    conditionCategory: "Pain and Mobility Rehabilitation",
    bodyRegion: "general",
    durationWeeks: 3,
    sessionsPerWeek: 3,
    programGoal:
      "Introduce graded movement to reduce pain sensitivity, improve joint mobility, and restore basic functional movement patterns through gentle progressive exercise.",
    patientFriendlyGoal:
      "Help you start moving more comfortably and confidently to manage your pain and improve daily mobility.",
    suitableFor:
      "Chronic or persistent pain with movement avoidance. Generalised pain and mobility limitation. Patients requiring gentle graded movement introduction. Suitable as a starting point when region-specific program is not yet clinically confirmed.",
    notSuitableFor:
      "Active inflammatory flare without review. Acute injury. Red flags not yet cleared. Patients requiring region-specific clinical assessment before exercise prescription.",
    safetyNotes:
      "Use graded exposure principles. Do not push through sharp pain. Mild discomfort during movement is acceptable and expected with deconditioning — distinguish from sharp or worsening pain. Pacing strategies recommended.",
    redFlags:
      "Sharp increasing pain. New neurological symptoms. Significant sleep disturbance due to pain. Unexplained systemic symptoms.",
    reviewCriteria:
      "Review if pain increases significantly after each session rather than settling within 24 hours. Review if patient is unable to complete any exercises due to pain. Review if function decreases rather than improves.",
    clinicianUseNote:
      "Pain education should accompany this program. Graded activity and pacing strategies are core. Validate patient effort and normalise expected mild discomfort. This program is a starting point — reassess for region-specific program after initial assessment and examination.",
    phaseGoal:
      "Introduce gentle graded movement and restore basic mobility confidence.",
    expectedResponse:
      "Gradual increase in movement tolerance with pain settling within 24 hours after sessions.",
    exerciseLabels: [
      "Diaphragmatic Breathing",
      "Gentle Neck Rotation",
      "Shoulder Circles",
      "Seated Trunk Rotation",
      "Knee to Chest Stretch",
      "Ankle Pumps",
      "Sit to Stand Slow",
    ],
  }),
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
      exercises: s.exercises.map((ex) =>
        typeof ex === "string" ? ex : { ...ex },
      ),
    })),
  };
}

/** Sprint L expanded program count (excludes 3 legacy pilots). */
export const EXPANDED_PROGRAM_TEMPLATE_COUNT = 12;

/** Total pilot templates available in plan builder. */
export const PILOT_PROGRAM_TEMPLATE_COUNT = PILOT_PROGRAM_TEMPLATES.length;
