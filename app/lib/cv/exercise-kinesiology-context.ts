/**
 * Motion Analysis Report v3 — static kinesiology reference for clinician review.
 * Educational context only: no diagnosis, scoring, or treatment recommendations.
 */

export type KinesiologyMovementPhase = {
  id: string;
  label: string;
  description: string;
};

export type ExerciseKinesiologyContext = {
  exerciseId: string;
  primaryMuscles: string[];
  movementPhases: readonly KinesiologyMovementPhase[];
  expectedPatterns: string[];
  functionalTransfer: string;
  clinicianObservationGuide: string[];
};

const SIT_TO_STAND: ExerciseKinesiologyContext = {
  exerciseId: "sit-to-stand",
  primaryMuscles: [
    "Quadriceps (vastus medialis, rectus femoris)",
    "Gluteus maximus",
    "Hamstrings (eccentric during lowering)",
    "Core stabilizers (transverse abdominis, erector spinae)",
  ],
  movementPhases: [
    {
      id: "seated",
      label: "Seated",
      description: "Hips and knees flexed; trunk upright or slightly forward-leaning at chair edge.",
    },
    {
      id: "rising",
      label: "Rising",
      description: "Ankle dorsiflexion, knee extension, and hip extension initiate vertical translation.",
    },
    {
      id: "standing",
      label: "Standing",
      description: "Full upright posture with hips and knees near extension; weight through feet.",
    },
    {
      id: "returning",
      label: "Returning",
      description: "Controlled hip and knee flexion to lower body toward seat without plopping.",
    },
    {
      id: "rest",
      label: "Rest / transition",
      description: "Brief pause between cycles or repositioning at chair edge.",
    },
  ],
  expectedPatterns: [
    "Forward trunk lean precedes knee extension to shift center of mass over feet.",
    "Knees track over second toe without excessive valgus collapse.",
    "Heels remain grounded during rise; minimal arm pull unless used for balance only.",
    "Lowering is hip-led with controlled eccentric quadriceps loading.",
  ],
  functionalTransfer:
    "Chair transfers, toilet use, car entry/exit, and independent standing tolerance for daily mobility.",
  clinicianObservationGuide: [
    "Note whether rise is initiated with trunk lean versus excessive arm pull.",
    "Observe knee alignment during ascent and descent — valgus or lateral shift.",
    "Compare symmetry of weight bearing and foot placement between sides.",
    "Review pacing: rushed plopping versus controlled lowering.",
    "Correlate unclear or incomplete cycles with camera visibility, not movement quality scores.",
  ],
};

const MINI_SQUAT: ExerciseKinesiologyContext = {
  exerciseId: "mini-squat",
  primaryMuscles: [
    "Quadriceps (closed-chain knee extensors)",
    "Gluteus maximus and medius",
    "Hamstrings (co-contraction for stability)",
    "Gastrocnemius / soleus (ankle stability)",
  ],
  movementPhases: [
    {
      id: "standing",
      label: "Standing",
      description: "Upright stance with feet shoulder-width; weight through mid-foot and heels.",
    },
    {
      id: "descent",
      label: "Descent",
      description: "Hip and knee flexion to partial depth (typically 30–45° knee flexion).",
    },
    {
      id: "bottom_hold",
      label: "Bottom hold",
      description: "Brief pause at prescribed depth before ascent.",
    },
    {
      id: "ascent",
      label: "Ascent",
      description: "Knee and hip extension returning to upright without harsh locking.",
    },
  ],
  expectedPatterns: [
    "Torso stays relatively tall; limited excessive forward lean at partial depth.",
    "Knees track over toes without medial collapse.",
    "Heels stay in contact with floor throughout the range.",
    "Tempo is controlled — no bouncing at the bottom.",
  ],
  functionalTransfer:
    "Stair negotiation, lifting from floor height, sport-ready loading, and patellofemoral load tolerance in daily tasks.",
  clinicianObservationGuide: [
    "Observe depth consistency across reps relative to clinician-prescribed range.",
    "Note knee valgus, heel lift, or trunk collapse during descent or ascent.",
    "Compare left-right weight distribution if visible in capture framing.",
    "Review whether patient stays within partial range versus drifting deeper.",
    "Use assistive rep counts and visibility notes only — not automated movement quality scores.",
  ],
};

const SINGLE_LEG_STANCE: ExerciseKinesiologyContext = {
  exerciseId: "single-leg-stance",
  primaryMuscles: [
    "Gluteus medius and minimus (pelvic stability)",
    "Quadriceps (stance knee control)",
    "Ankle invertors / evertors and calf complex",
    "Core and hip rotators (trunk steadiness)",
  ],
  movementPhases: [
    {
      id: "bilateral_stance",
      label: "Bilateral stance",
      description: "Both feet on ground; preparation and weight shift.",
    },
    {
      id: "weight_shift",
      label: "Weight shift",
      description: "Load transfers to stance limb as opposite foot clears floor.",
    },
    {
      id: "single_leg_hold",
      label: "Single-leg hold",
      description: "Sustained unilateral stance with level pelvis and steady trunk.",
    },
    {
      id: "recovery",
      label: "Recovery",
      description: "Return to bilateral stance or side switch.",
    },
  ],
  expectedPatterns: [
    "Pelvis remains level without contralateral hip drop (Trendelenburg sign observation).",
    "Stance knee maintains soft flexion — not hyperextended or excessively valgus.",
    "Trunk stays steady; minimal arm windmilling unless used for fingertip support.",
    "Foot remains quiet on stance side without excessive wobble.",
  ],
  functionalTransfer:
    "Single-limb loading during gait, turning, stepping, and sport preparation where one leg accepts full body weight.",
  clinicianObservationGuide: [
    "Note hold duration achieved versus prescribed time — assistive duration only.",
    "Observe pelvic level and trunk sway during unilateral loading.",
    "Record whether support surface (wall/counter) was used — context for interpretation.",
    "Compare sides if both were attempted in the session.",
    "Limited camera visibility may affect lower-limb detail — review capture framing.",
  ],
};

const KINESIOLOGY_BY_EXERCISE: Readonly<Record<string, ExerciseKinesiologyContext>> = {
  "sit-to-stand": SIT_TO_STAND,
  "mini-squat": MINI_SQUAT,
  "single-leg-stance": SINGLE_LEG_STANCE,
};

export const KINESIOLOGY_CONTEXT_EXERCISE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
] as const;

export type KinesiologyContextExerciseId = (typeof KINESIOLOGY_CONTEXT_EXERCISE_IDS)[number];

export function resolveExerciseKinesiologyContext(
  exerciseId: string | null | undefined,
): ExerciseKinesiologyContext | null {
  const normalized = exerciseId?.trim().toLowerCase();
  if (!normalized) return null;
  return KINESIOLOGY_BY_EXERCISE[normalized] ?? null;
}
