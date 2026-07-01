/**
 * Rule-based treatment plan suggestions from patient + assessment data.
 * Assistive only — clinician selects and edits before assigning.
 */

import type { AssessmentListRow } from "@/app/api/assessments/route";
import { deriveClinicalFocusLabels } from "@/app/lib/clinical-focus-labels";
import { VALUE_FOCUS_UNSPECIFIED } from "@/app/lib/clinical-focus-copy";
import {
  PILOT_PROGRAM_TEMPLATES,
  type PilotProgramTemplate,
} from "@/app/lib/program-templates";
import {
  resolveProgramOptionsForFocus,
  type ProgramOptionForReview,
} from "@/app/lib/program-direction-options";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

export type IntelligentPlanSuggestion = {
  templateId: string;
  templateTitle: string;
  rationale: string[];
  baselineAssessmentId: string | null;
  sessionsPerWeek: number;
  redFlagReviewRequired: boolean;
  programOptions: ProgramOptionForReview[];
};

function bucketDiagnosisFocus(diagnosis: string | null): string {
  const t = (diagnosis ?? "").trim().toLowerCase();
  if (!t) return VALUE_FOCUS_UNSPECIFIED;
  if (/\b(knee|acl|patella|meniscus)\b/.test(t)) return "Knee";
  if (/\b(shoulder|rotator|impingement)\b/.test(t)) return "Shoulder";
  if (/\b(lumbar|back|spine|disc)\b/.test(t)) return "Low back";
  if (/\b(neck|cervical)\b/.test(t)) return "Neck";
  if (/\b(hip|groin)\b/.test(t)) return "Hip";
  if (/\b(ankle|foot)\b/.test(t)) return "Ankle / foot";
  if (/\b(gait|balance|walking)\b/.test(t)) return "Balance and gait";
  return "General MSK";
}

function pickPreferredAssessment(
  assessments: AssessmentListRow[],
): AssessmentListRow | null {
  if (assessments.length === 0) return null;
  const priority = ["general_msk", "remote_questionnaire", "structured", "questionnaire"];
  for (const type of priority) {
    const match = assessments.find((row) => row.type === type);
    if (match) return match;
  }
  return assessments[0] ?? null;
}

export function generateIntelligentPlanSuggestion(input: {
  patient: Pick<PatientRow, "diagnosis">;
  assessments: AssessmentListRow[];
  assessmentStructuredData?: unknown;
  assessmentType?: string;
}): IntelligentPlanSuggestion | null {
  const preferred = pickPreferredAssessment(input.assessments);
  const focus =
    input.assessmentType && input.assessmentStructuredData != null
      ? deriveClinicalFocusLabels(input.assessmentType, input.assessmentStructuredData)
      : deriveClinicalFocusLabels(
          preferred?.type,
          input.assessmentStructuredData,
        );

  const focusArea =
    focus.focusArea !== VALUE_FOCUS_UNSPECIFIED
      ? focus.focusArea
      : bucketDiagnosisFocus(input.patient.diagnosis);

  if (focusArea === VALUE_FOCUS_UNSPECIFIED) return null;

  const programOptions = resolveProgramOptionsForFocus({
    focusArea,
    clinicalCategory: focus.clinicalCategory,
    confidence: focus.confidence,
  });

  if (programOptions.length === 0) return null;

  const top = programOptions[0]!;
  const template = PILOT_PROGRAM_TEMPLATES.find((row) => row.id === top.templateId);
  if (!template) return null;

  const rationale = buildRationale(template, focusArea, preferred, focus.confirmationRequired);

  return {
    templateId: top.templateId,
    templateTitle: top.title,
    rationale,
    baselineAssessmentId: preferred?.id ?? null,
    sessionsPerWeek: template.sessionsPerWeek ?? 3,
    redFlagReviewRequired: focus.confirmationRequired,
    programOptions,
  };
}

function buildRationale(
  template: PilotProgramTemplate,
  focusArea: string,
  assessment: AssessmentListRow | null,
  confirmationRequired: boolean,
): string[] {
  const lines = [
    `Focus area inferred as ${focusArea} from patient record and assessment context.`,
    `Suggested starting template: ${template.title} (${template.level}).`,
    template.clinicianUseNote,
  ];
  if (assessment) {
    lines.push(`Baseline assessment on file (${assessment.type.replace(/_/g, " ")}).`);
  }
  if (confirmationRequired) {
    lines.push("Review red-flag fields before assigning — no automatic prescription.");
  }
  lines.push("Clinician must review and edit sessions before assigning.");
  return lines;
}
