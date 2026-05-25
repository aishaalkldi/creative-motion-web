/**
 * Resolves legacy exercise name strings and structured prescriptions
 * to library entries with patient/clinician display data.
 */

import {
  EXERCISE_LIBRARY_V1,
  getLibraryExerciseById,
  type ExerciseLibraryEntryV1,
} from "./exercise-library-v1";
import {
  formatDoseLabel,
  isPrescribedExerciseV1,
  type PrescribedExerciseV1,
  type StoredExercise,
} from "./exercise-prescription";

export type { PrescribedExerciseV1, StoredExercise } from "./exercise-prescription";

export type ResolveMatchType = "id" | "alias" | "name" | "fallback";

export type PatientExerciseLanguage = "en" | "ar";

export type ResolveExerciseViewOptions = {
  includeClinicianFields?: boolean;
  /** Patient-facing language for instructions, name, and dose label */
  language?: PatientExerciseLanguage;
};

/** Legacy and catalog name aliases → exerciseId */
export const EXERCISE_NAME_ALIASES: Record<string, string> = {
  "sit-to-stand": "sit-to-stand",
  "sit to stand": "sit-to-stand",
  "sit-to-stand practice": "sit-to-stand",
  "mini squat (0–45°)": "mini-squat",
  "mini squat (0-45°)": "mini-squat",
  "mini squats": "mini-squat",
  "mini squat": "mini-squat",
  "heel raises": "heel-raise",
  "heel raise": "heel-raise",
  "calf raises": "heel-raise",
  "single leg stance": "single-leg-stance",
  "low step-up": "step-up",
  "low step up": "step-up",
  "step-ups": "step-up",
  "step ups": "step-up",
  "step control": "step-up",
  "quad activation": "quad-set",
  "quad set": "quad-set",
  "seated knee extension": "quad-set",
  "heel slides": "heel-slide",
  "heel slide": "heel-slide",
  "balance hold": "single-leg-stance",
  "walking tolerance": "walking-tolerance",
  "walking plan": "walking-tolerance",
  "diaphragmatic breathing": "diaphragmatic-breathing",
  "pelvic tilts": "pelvic-tilt",
  "pelvic tilt": "pelvic-tilt",
  "knee-to-chest": "pelvic-tilt",
  "cat-cow": "cat-cow",
  "glute bridge": "glute-bridge",
  "bridge preparation": "glute-bridge",
  "bird-dog preparation": "bird-dog",
  "bird-dog": "bird-dog",
  "hip hinge education": "hip-hinge",
  "hip hinge": "hip-hinge",
  "pendulum": "pendulum",
  "scapular setting": "scapular-setting",
  "table slides": "table-slide",
  "resistance band squats": "mini-squat",
  "balance board": "single-leg-stance",
  "terminal knee extension": "terminal-knee-extension",
  "tke": "terminal-knee-extension",
  "short arc quad": "short-arc-quad",
  "short-arc quad": "short-arc-quad",
  "lateral band walk": "lateral-band-walk",
  "side steps": "lateral-band-walk",
  "dead bug": "dead-bug",
  "side plank": "side-plank",
  "prone press up": "prone-press-up",
  "prone press-up": "prone-press-up",
  "press ups": "prone-press-up",
  "extension in lying": "prone-press-up",
  "internal rotation": "internal-rotation",
  "internal rotation band": "internal-rotation",
  "cross body stretch": "cross-body-stretch",
  "cross-body stretch": "cross-body-stretch",
  "sleeper stretch": "cross-body-stretch",
  "chin tuck deep cervical flexor": "chin-tuck",
  "chin tuck": "chin-tuck",
  "cervical rotation pain-free range": "cervical-rotation-rom",
  "cervical lateral flexion stretch": "cervical-lateral-flexion-stretch",
  "upper trapezius stretch": "upper-trapezius-stretch",
  "theraband dorsiflexion": "theraband-ankle-dorsiflexion",
  "theraband inversion and eversion": "theraband-ankle-eversion-inversion",
  "prone y-t-w": "prone-ytw",
  "serratus anterior punch": "serratus-punch",
  "doorway chest stretch": "doorway-pectoral-stretch",
  "doorway pectoral stretch": "doorway-pectoral-stretch",
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
};

const GENERIC_FALLBACK: Pick<
  ExerciseLibraryEntryV1,
  "patientInstructions" | "whyThisMatters" | "precautions"
> = {
  patientInstructions:
    "Perform this exercise with controlled, deliberate movement. Focus on correct form and pain-free range of motion. Stop if you experience sharp pain.",
  whyThisMatters:
    "This exercise supports safe movement control and helps your therapist monitor your rehabilitation progress.",
  precautions: "Stop if you feel sharp pain, dizziness, or unusual symptoms.",
};

const GENERIC_FALLBACK_AR: Pick<
  ExerciseLibraryEntryV1,
  "patientInstructionsAr" | "whyThisMattersAr" | "precautionsAr"
> = {
  patientInstructionsAr:
    "نفّذ هذا التمرين بحركة بطيئة وتحكم. ركّز على الشكل الصحيح ومدى خالٍ من الألم. توقّف عند الشعور بألم حاد.",
  whyThisMattersAr:
    "هذا التمرين يدعم التحكم الآمن في الحركة ويساعد معالجك على متابعة تقدّمك في التأهيل.",
  precautionsAr: "توقّف إذا شعرت بألم حاد أو دوخة أو أعراض غير معتادة.",
};

function localizePatientField(
  language: PatientExerciseLanguage,
  en: string,
  ar: string | undefined,
): string {
  if (language === "ar" && ar?.trim()) return ar;
  return en;
}

function resolveExerciseDisplayName(
  language: PatientExerciseLanguage,
  prescribedName: string,
  entry: ExerciseLibraryEntryV1,
): string {
  if (language === "ar" && entry.nameAr.trim()) return entry.nameAr;
  return prescribedName || entry.nameEn;
}

export type ResolvedExerciseView = {
  exerciseId: string;
  name: string;
  sets?: number;
  reps?: number | string;
  durationSec?: number;
  restSec?: number;
  clinicianNote?: string;
  doseLabel: string | null;
  patientInstructions: string;
  whyThisMatters: string;
  precautions: string;
  fromLibrary: boolean;
  matchType: ResolveMatchType;
  targetImpairment?: string;
  functionalGoal?: string;
  biomechanicalRationale?: string;
  progressionCriteria?: string;
  regressionCriteria?: string;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveExerciseById(exerciseId: string): ExerciseLibraryEntryV1 | null {
  return getLibraryExerciseById(exerciseId);
}

export function resolveExerciseByName(name: string): {
  entry: ExerciseLibraryEntryV1 | null;
  matchType: ResolveMatchType;
} {
  const key = normalizeNameKey(name);
  if (!key) return { entry: null, matchType: "fallback" };

  const aliasId = EXERCISE_NAME_ALIASES[key];
  if (aliasId) {
    const entry = getLibraryExerciseById(aliasId);
    if (entry) return { entry, matchType: "alias" };
  }

  const slug = key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const bySlug = getLibraryExerciseById(slug);
  if (bySlug) return { entry: bySlug, matchType: "name" };

  for (const entry of EXERCISE_LIBRARY_V1) {
    if (normalizeNameKey(entry.nameEn) === key) {
      return { entry, matchType: "name" };
    }
    if (entry.nameAr.trim() === name.trim()) {
      return { entry, matchType: "name" };
    }
  }

  return { entry: null, matchType: "fallback" };
}

export function prescribedFromLibrary(
  entry: ExerciseLibraryEntryV1,
  overrides?: Partial<PrescribedExerciseV1>,
): PrescribedExerciseV1 {
  return {
    exerciseId: entry.exerciseId,
    name: overrides?.name ?? entry.nameEn,
    sets: overrides?.sets ?? entry.defaultSets,
    reps: overrides?.reps ?? entry.defaultReps,
    durationSec: overrides?.durationSec ?? entry.defaultDurationSec,
    restSec: overrides?.restSec ?? entry.defaultRestSec,
    clinicianNote: overrides?.clinicianNote,
  };
}

/** Convert string or partial structured input to stored prescription when library match exists. */
export function normalizeExerciseForStorage(
  input: string | PrescribedExerciseV1,
): StoredExercise {
  if (isPrescribedExerciseV1(input)) {
    const entry = getLibraryExerciseById(input.exerciseId);
    if (entry) {
      return {
        exerciseId: input.exerciseId,
        name: input.name || entry.nameEn,
        sets: input.sets ?? entry.defaultSets,
        reps: input.reps ?? entry.defaultReps,
        durationSec: input.durationSec ?? entry.defaultDurationSec,
        restSec: input.restSec ?? entry.defaultRestSec,
        clinicianNote: input.clinicianNote,
      };
    }
    return input;
  }

  const trimmed = input.trim();
  if (!trimmed) return input;

  const { entry } = resolveExerciseByName(trimmed);
  if (entry) {
    return prescribedFromLibrary(entry, { name: trimmed });
  }

  return trimmed;
}

export function normalizeExercisesForStorage(
  exercises: (string | PrescribedExerciseV1)[],
): StoredExercise[] {
  return exercises
    .map(normalizeExerciseForStorage)
    .filter((ex) => (typeof ex === "string" ? ex.trim().length > 0 : true));
}

export function parseStoredExercise(raw: unknown): PrescribedExerciseV1 {
  if (isPrescribedExerciseV1(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const { entry } = resolveExerciseByName(raw);
    if (entry) {
      return prescribedFromLibrary(entry, { name: raw });
    }
    return {
      exerciseId: `legacy-${normalizeNameKey(raw).replace(/[^a-z0-9]+/g, "-") || "custom"}`,
      name: raw,
    };
  }
  return {
    exerciseId: "unknown",
    name: "Exercise",
  };
}

export function parseStoredExercises(raw: unknown): PrescribedExerciseV1[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseStoredExercise);
}

export function resolveExerciseView(
  input: StoredExercise | PrescribedExerciseV1 | string,
  options?: ResolveExerciseViewOptions,
): ResolvedExerciseView {
  const language = options?.language ?? "en";
  const prescribed = isPrescribedExerciseV1(input)
    ? input
    : typeof input === "string"
      ? parseStoredExercise(input)
      : parseStoredExercise(input);

  let entry = getLibraryExerciseById(prescribed.exerciseId);
  let matchType: ResolveMatchType = "id";

  if (!entry) {
    const byName = resolveExerciseByName(prescribed.name);
    entry = byName.entry;
    matchType = byName.matchType;
  } else {
    matchType = "id";
  }

  const doseSource = {
    sets: prescribed.sets,
    reps: prescribed.reps,
    durationSec: prescribed.durationSec,
    restSec: prescribed.restSec,
  };
  const doseLabel = formatDoseLabel(doseSource, language);

  if (!entry) {
    const fallbackInstructions =
      language === "ar"
        ? GENERIC_FALLBACK_AR.patientInstructionsAr
        : GENERIC_FALLBACK.patientInstructions;
    const fallbackWhy =
      language === "ar"
        ? GENERIC_FALLBACK_AR.whyThisMattersAr
        : GENERIC_FALLBACK.whyThisMatters;
    const fallbackPrecautions =
      language === "ar"
        ? GENERIC_FALLBACK_AR.precautionsAr
        : GENERIC_FALLBACK.precautions;

    return {
      exerciseId: prescribed.exerciseId,
      name: prescribed.name,
      sets: prescribed.sets,
      reps: prescribed.reps,
      durationSec: prescribed.durationSec,
      restSec: prescribed.restSec,
      clinicianNote: prescribed.clinicianNote,
      doseLabel,
      patientInstructions: fallbackInstructions,
      whyThisMatters: fallbackWhy,
      precautions: fallbackPrecautions,
      fromLibrary: false,
      matchType: "fallback",
    };
  }

  const resolvedDose = {
    sets: prescribed.sets ?? entry.defaultSets,
    reps: prescribed.reps ?? entry.defaultReps,
    durationSec: prescribed.durationSec ?? entry.defaultDurationSec,
    restSec: prescribed.restSec ?? entry.defaultRestSec,
  };

  const base: ResolvedExerciseView = {
    exerciseId: entry.exerciseId,
    name: resolveExerciseDisplayName(language, prescribed.name, entry),
    sets: resolvedDose.sets,
    reps: resolvedDose.reps,
    durationSec: resolvedDose.durationSec,
    restSec: resolvedDose.restSec,
    clinicianNote: prescribed.clinicianNote,
    doseLabel: formatDoseLabel(resolvedDose, language),
    patientInstructions: localizePatientField(
      language,
      entry.patientInstructions,
      entry.patientInstructionsAr,
    ),
    whyThisMatters: localizePatientField(
      language,
      entry.whyThisMatters,
      entry.whyThisMattersAr,
    ),
    precautions: localizePatientField(
      language,
      entry.precautions,
      entry.precautionsAr,
    ),
    fromLibrary: true,
    matchType,
  };

  if (options?.includeClinicianFields) {
    base.targetImpairment = entry.targetImpairment;
    base.functionalGoal = entry.functionalGoal;
    base.biomechanicalRationale = entry.biomechanicalRationale;
    base.progressionCriteria = entry.progressionCriteria;
    base.regressionCriteria = entry.regressionCriteria;
  }

  return base;
}

export function getExerciseDisplayNameFromStored(exercise: StoredExercise): string {
  if (typeof exercise === "string") return exercise;
  return exercise.name;
}
