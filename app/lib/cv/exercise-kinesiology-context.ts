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
    "Quadriceps",
    "Gluteus maximus",
    "Gluteus medius",
    "Core stabilizers",
  ],
  movementPhases: [
    {
      id: "standing",
      label: "Standing",
      description: "Upright stance with feet shoulder-width; weight through mid-foot and heels.",
    },
    {
      id: "lowering",
      label: "Lowering",
      description: "Hip and knee flexion toward partial squat depth.",
    },
    {
      id: "bottom",
      label: "Bottom position",
      description: "Brief hold or transition at prescribed partial depth before ascent.",
    },
    {
      id: "rising",
      label: "Rising",
      description: "Knee and hip extension returning to upright without harsh locking.",
    },
    {
      id: "rest",
      label: "Rest / transition",
      description: "Brief pause between squat cycles or repositioning between reps.",
    },
  ],
  expectedPatterns: [
    "Squat depth stays within clinician-prescribed partial range across repetitions.",
    "Knee control maintained during descent and ascent — alignment cannot be confirmed from camera data alone.",
    "Trunk strategy stays relatively controlled without excessive collapse at partial depth.",
    "Lower-limb loading appears consistent across cycles — pacing may be worth clinician review.",
  ],
  functionalTransfer:
    "Stair negotiation, lifting from floor height, and controlled lower-limb loading in daily tasks.",
  clinicianObservationGuide: [
    "Review squat depth consistency across repetitions relative to prescribed range.",
    "Observe knee alignment during descent and ascent — assistive capture cannot confirm valgus or varus.",
    "Note trunk strategy and whether forward lean changes across cycles.",
    "Review pacing consistency between squat cycles.",
    "Use assistive cycle counts and visibility notes only — not automated movement quality scores.",
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

const HEEL_RAISE: ExerciseKinesiologyContext = {
  exerciseId: "heel-raise",
  primaryMuscles: [
    "Gastrocnemius",
    "Soleus",
    "Tibialis posterior / ankle stabilizers",
    "Intrinsic foot stabilizers",
  ],
  movementPhases: [
    {
      id: "standing",
      label: "Standing / baseline",
      description: "Heels on ground; upright stance with weight through mid-foot before lift.",
    },
    {
      id: "rising",
      label: "Rising",
      description: "Controlled plantarflexion lifting heels off the floor.",
    },
    {
      id: "peak_raise",
      label: "Peak raise",
      description: "Top of heel raise — brief hold or transition at highest comfortable height.",
    },
    {
      id: "lowering",
      label: "Lowering",
      description: "Controlled eccentric lowering of heels back to floor without dropping.",
    },
    {
      id: "rest",
      label: "Rest / transition",
      description: "Brief pause between heel raise cycles or repositioning between reps.",
    },
  ],
  expectedPatterns: [
    "Controlled heel lift with even weight between feet when prescribed bilaterally.",
    "Controlled lowering without rushing or bouncing at the bottom.",
    "Ankle stability maintained — excessive inversion or eversion cannot be confirmed from camera data alone.",
    "Balance and foot control appear steady across cycles — pacing may be worth clinician review.",
  ],
  functionalTransfer:
    "Push-off in gait, running readiness, jumping preparation, stair climbing, and calf endurance for daily mobility.",
  clinicianObservationGuide: [
    "Review heel raise height consistency across repetitions relative to prescribed range.",
    "Observe lowering control during descent — assistive capture cannot confirm eccentric strength.",
    "Note ankle stability and foot quietness during plantarflexion.",
    "Review pacing consistency between heel raise cycles.",
    "Calf strength cannot be confirmed from camera data alone — correlate with clinical assessment.",
  ],
};

const STEP_UP: ExerciseKinesiologyContext = {
  exerciseId: "step-up",
  primaryMuscles: [
    "Quadriceps",
    "Gluteus maximus",
    "Gluteus medius",
    "Calf complex",
    "Core stabilizers",
  ],
  movementPhases: [
    {
      id: "standing",
      label: "Standing / baseline",
      description: "Upright stance on the floor before stepping onto the platform.",
    },
    {
      id: "step_ascent",
      label: "Step ascent",
      description: "Controlled concentric loading as the leading leg rises onto the step.",
    },
    {
      id: "top_position",
      label: "Top position",
      description: "Brief pause or transition at the top of the step with weight on the leading leg.",
    },
    {
      id: "step_descent",
      label: "Step descent",
      description: "Controlled eccentric lowering back to the floor without dropping.",
    },
    {
      id: "rest",
      label: "Rest / transition",
      description: "Brief pause between step-up cycles or repositioning between reps.",
    },
  ],
  expectedPatterns: [
    "Controlled step onto the platform with steady trunk position.",
    "Controlled step down without rushing or loss of balance — cannot be confirmed from camera data alone.",
    "Knee alignment over the foot during loading — valgus cannot be confirmed from camera data alone.",
    "Limb loading strategy may vary across cycles — pacing may be worth clinician review.",
  ],
  functionalTransfer:
    "Stair climbing, step negotiation, lower-limb loading, and sports readiness tasks requiring unilateral closed-chain control.",
  clinicianObservationGuide: [
    "Review step height strategy consistency across repetitions relative to prescribed step height.",
    "Observe ascent control during step-up — assistive capture cannot confirm strength.",
    "Observe descent control during step-down — assistive capture cannot confirm eccentric control.",
    "Note limb loading strategy and trunk position during single-limb acceptance.",
    "Limited camera visibility may affect lower-limb detail — review capture framing.",
  ],
};

const KINESIOLOGY_BY_EXERCISE: Readonly<Record<string, ExerciseKinesiologyContext>> = {
  "sit-to-stand": SIT_TO_STAND,
  "mini-squat": MINI_SQUAT,
  "single-leg-stance": SINGLE_LEG_STANCE,
  "heel-raise": HEEL_RAISE,
  "step-up": STEP_UP,
};

export const KINESIOLOGY_CONTEXT_EXERCISE_IDS = [
  "sit-to-stand",
  "mini-squat",
  "single-leg-stance",
  "heel-raise",
  "step-up",
] as const;

export type KinesiologyContextExerciseId = (typeof KINESIOLOGY_CONTEXT_EXERCISE_IDS)[number];

export function resolveExerciseKinesiologyContext(
  exerciseId: string | null | undefined,
): ExerciseKinesiologyContext | null {
  const normalized = exerciseId?.trim().toLowerCase();
  if (!normalized) return null;
  return KINESIOLOGY_BY_EXERCISE[normalized] ?? null;
}
