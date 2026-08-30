import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

export type CatalogSessionDisplay = {
  title: string;
  goal: string | null;
};

const CATALOG_SESSION_DISPLAY: Record<
  string,
  Record<PatientExerciseLanguage, { title: string; goal: string }>
> = {
  "stroke-upper-limb-recovery-foundation-v1-session-1": {
    en: {
      title: "Session 1 — Activation and Functional Reaching",
      goal: "Activation and Functional Reaching",
    },
    ar: {
      title: "الجلسة 1 — التنشيط والوصول الوظيفي",
      goal: "التنشيط والوصول الوظيفي",
    },
  },
};

export function hasLocalizedCatalogSessionDisplay(catalogSessionId: string | undefined): boolean {
  return Boolean(catalogSessionId && CATALOG_SESSION_DISPLAY[catalogSessionId]);
}

export function resolveCatalogSessionDisplay(
  language: PatientExerciseLanguage,
  catalogSessionId: string | undefined,
  fallbackTitle: string,
  fallbackGoal: string | null | undefined,
): CatalogSessionDisplay {
  const localized = catalogSessionId ? CATALOG_SESSION_DISPLAY[catalogSessionId]?.[language] : undefined;
  return {
    title: localized?.title ?? fallbackTitle,
    goal: localized?.goal ?? fallbackGoal ?? null,
  };
}
