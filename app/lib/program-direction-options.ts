/**
 * Sprint P — Fixed focus-area → program template mapping for therapist review.
 * No scores, ranking, keyword matching, or auto-selection.
 */

import type { ClinicalFocusLabels } from "@/app/lib/clinical-focus-labels";
import { VALUE_FOCUS_UNSPECIFIED } from "@/app/lib/clinical-focus-copy";
import { PILOT_PROGRAM_TEMPLATES } from "@/app/lib/program-templates";

export type ProgramOptionForReview = {
  templateId: string;
  title: string;
  conditionArea: string;
  level: string;
  bodyRegion: string;
  conditionCategory: string;
  displayNote: string;
};

export type ResolveProgramDirectionOptions = {
  hasRedFlag?: boolean;
};

const EXCLUDED_TEMPLATE_IDS = new Set([
  "sports-rta-foundation-01",
  "neuro-mobility-foundation-01",
]);

const FOCUS_AREA_TO_TEMPLATE_IDS: Record<string, readonly string[]> = {
  Knee: ["knee-foundation-01", "knee-rehab-beginner", "post-op-knee-early-01"],
  Shoulder: ["shoulder-foundation-01", "shoulder-mobility-beginner"],
  "Low back": ["lumbar-foundation-01", "low-back-beginner"],
  Neck: ["cervical-foundation-01"],
  Hip: ["hip-foundation-01"],
  "Ankle / foot": ["ankle-foundation-01"],
  "Balance and gait": ["balance-gait-foundation-01"],
  "Upper limb": ["shoulder-foundation-01", "pain-mobility-beginner-01"],
  "General MSK": ["pain-mobility-beginner-01", "deconditioning-foundation-01"],
};

const MAX_OPTIONS = 3;

const templateById = new Map(
  PILOT_PROGRAM_TEMPLATES.map((template) => [template.id, template]),
);

function toProgramOption(templateId: string): ProgramOptionForReview | null {
  if (EXCLUDED_TEMPLATE_IDS.has(templateId)) return null;
  const template = templateById.get(templateId);
  if (!template) return null;

  return {
    templateId: template.id,
    title: template.title,
    conditionArea: template.conditionArea,
    level: template.level,
    bodyRegion: template.bodyRegion,
    conditionCategory: template.conditionCategory,
    displayNote: template.clinicianUseNote,
  };
}

/**
 * Resolve up to three equal program template options from Sprint O focus labels.
 */
export function resolveProgramOptionsForFocus(
  focus: Pick<ClinicalFocusLabels, "focusArea" | "clinicalCategory" | "confidence">,
  _options?: ResolveProgramDirectionOptions,
): ProgramOptionForReview[] {
  if (focus.focusArea === VALUE_FOCUS_UNSPECIFIED) return [];

  const templateIds = FOCUS_AREA_TO_TEMPLATE_IDS[focus.focusArea];
  if (!templateIds?.length) return [];

  const options: ProgramOptionForReview[] = [];
  for (const templateId of templateIds) {
    if (options.length >= MAX_OPTIONS) break;
    const option = toProgramOption(templateId);
    if (option) options.push(option);
  }

  return options;
}
