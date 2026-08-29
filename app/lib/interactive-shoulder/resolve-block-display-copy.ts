import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

export type BlockDisplayCopy = {
  phaseLabel: string;
  title: string;
  instructions: string;
};

const BLOCK_COPY: Record<
  string,
  Record<PatientExerciseLanguage, { phaseLabel: string; title: string; instructions: string }>
> = {
  "stroke-ulrf-v1-session-1-warm-up": {
    en: {
      phaseLabel: "Warm-up",
      title: "Warm-up",
      instructions: "Reach slowly and comfortably to prepare your shoulder.",
    },
    ar: {
      phaseLabel: "الإحماء",
      title: "الإحماء",
      instructions: "امدُد ببطء وراحة لتحضير كتفك.",
    },
  },
  "stroke-ulrf-v1-session-1-cool-down": {
    en: {
      phaseLabel: "Cool-down",
      title: "Cool-down",
      instructions: "Slow down your movement and relax your shoulder.",
    },
    ar: {
      phaseLabel: "التهدئة",
      title: "التهدئة",
      instructions: "أبطئ حركتك واسترخِ كتفك.",
    },
  },
  "stroke-ulrf-v1-session-1-reach-the-light": {
    en: {
      phaseLabel: "Exercise",
      title: "Reach the Light",
      instructions:
        "Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.",
    },
    ar: {
      phaseLabel: "التمرين",
      title: "الوصول إلى الضوء",
      instructions: "ارفع ذراعك جانبًا وامدُد نحو كل ضوء علاجي. تحرّك بوتيرة مريحة.",
    },
  },
  "stroke-ulrf-v1-session-1-d1-diagonal-reach": {
    en: {
      phaseLabel: "Exercise",
      title: "D1-Inspired Diagonal Reach",
      instructions:
        "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
    },
    ar: {
      phaseLabel: "التمرين",
      title: "الوصول القطري المستوحى من D1",
      instructions: "اتبع الضوء العلاجي على المسار القطري. تحرّك بسلاسة وبوتيرة مريحة.",
    },
  },
};

export function resolveBlockDisplayCopy(
  language: PatientExerciseLanguage,
  blockId: string | undefined,
  fallbackTitle: string,
  fallbackInstructions: string,
): BlockDisplayCopy {
  const localized = blockId ? BLOCK_COPY[blockId]?.[language] : undefined;
  if (localized) return localized;
  return {
    phaseLabel: fallbackTitle,
    title: fallbackTitle,
    instructions: fallbackInstructions,
  };
}

export function isWarmUpBlock(blockId: string | undefined): boolean {
  return blockId === "stroke-ulrf-v1-session-1-warm-up";
}

export function isCoolDownBlock(blockId: string | undefined): boolean {
  return blockId === "stroke-ulrf-v1-session-1-cool-down";
}
