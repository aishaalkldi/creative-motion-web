/**
 * PT Clinical Report generation — approved Clinical English → AI synthesis with rule-based fallback.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import { synthesizePtClinicalReport } from "@/app/lib/ai/synthesize-pt-clinical-report";
import { PATIENT_SECTION_QUESTIONS, PATIENT_SECTION_TITLES, clinicianText } from "@/app/lib/patient-assessment-questions";
import { detectRedFlag, inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";
import {
  buildAssessmentInterpretationDraft,
  FORBIDDEN_INTERPRETATION_TERMS,
} from "@/app/lib/reports/assessment-interpretation-draft";
import { readClinicalFieldForReport } from "@/app/lib/reports/remote-questionnaire-workflow";
import {
  buildPtClinicalReportDraftFromSections,
  type ApprovedClinicalEnglishField,
  type ApprovedClinicalEnglishPayload,
  type PtClinicalReportDraft,
  type PtClinicalReportSection,
  PT_CLINICAL_REPORT_DISCLAIMER,
  PT_CLINICAL_REPORT_THERAPIST_NOTE,
  PT_CLINICAL_REPORT_TITLE,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";

export {
  PT_CLINICAL_REPORT_DISCLAIMER,
  PT_CLINICAL_REPORT_THERAPIST_NOTE,
  PT_CLINICAL_REPORT_TITLE,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";
export type {
  ApprovedClinicalEnglishPayload,
  PtClinicalReportDraft,
  PtClinicalReportSection,
} from "@/app/lib/reports/pt-clinical-report-schema";

function asText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function readField(
  structuredData: Record<string, unknown>,
  fieldKey: string,
  original: string | undefined,
): string {
  return readClinicalFieldForReport(structuredData, fieldKey, original);
}

export function buildApprovedClinicalEnglishPayload(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
}): ApprovedClinicalEnglishPayload {
  const includedSections = input.includedSections ?? inferIncludedSections(input.draft);
  const language = getAssessmentLanguage(input.structuredData);
  const fields: ApprovedClinicalEnglishField[] = [];

  for (const sectionId of includedSections) {
    const block = input.draft[sectionId];
    if (!block || typeof block !== "object") continue;
    const questions = PATIENT_SECTION_QUESTIONS[sectionId];
    for (const question of questions) {
      const raw = (block as Record<string, string>)[question.key];
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (!trimmed || /^\d+$/.test(trimmed)) continue;
      const clinicalEnglish = readField(input.structuredData, question.key, trimmed);
      if (!clinicalEnglish) continue;
      fields.push({
        fieldKey: question.key,
        label: clinicianText(question.text),
        section: clinicianText(PATIENT_SECTION_TITLES[sectionId]),
        clinicalEnglish,
      });
    }
  }

  const painScore = asText(input.draft.pain?.painScore) || null;

  return {
    sourceLanguage: language === "ar" ? "ar" : "en",
    painScore,
    hasRedFlag: detectRedFlag(input.structuredData),
    fields,
  };
}

function containsForbiddenTerm(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return FORBIDDEN_INTERPRETATION_TERMS.some((term) => normalized.includes(term.trim()));
}

function filterSafeLines(lines: string[]): string[] {
  return lines.filter((line) => line.trim() && !containsForbiddenTerm(line));
}

function buildRuleFallbackSections(
  structuredData: Record<string, unknown>,
  draft: PatientAssessmentDraft,
  includedSections: PatientSectionId[],
): PtClinicalReportSection[] {
  const pain = draft.pain;
  const interpretation = buildAssessmentInterpretationDraft({
    draft,
    includedSections,
    submissionMeta: structuredData,
  });

  const mainComplaint = readField(structuredData, "chiefComplaint", pain?.chiefComplaint);
  const bodyRegion = readField(structuredData, "painLocation", pain?.painLocation);
  const aggravating = readField(structuredData, "aggravating", pain?.aggravating);
  const easing = readField(structuredData, "easing", pain?.easing);
  const dailyImpact = readField(structuredData, "dailyImpact", pain?.dailyImpact);
  const goals = readField(structuredData, "goals", pain?.goals);
  const painScore = asText(pain?.painScore);

  const presentationBullets = filterSafeLines([
    mainComplaint ? `Primary concern: ${mainComplaint}` : "",
    bodyRegion ? `Affected area (patient-reported): ${bodyRegion}` : "",
    painScore ? `Patient-reported pain score: ${painScore}/10` : "",
  ]);

  const painBullets = filterSafeLines([
    aggravating ? `Aggravating factors (patient-reported): ${aggravating}` : "",
    easing ? `Easing factors (patient-reported): ${easing}` : "",
    readField(structuredData, "worseWith", draft.rom?.worseWith)
      ? `Movement-related symptom behavior (patient-reported): ${readField(structuredData, "worseWith", draft.rom?.worseWith)}`
      : "",
  ]);

  const functionalBullets = filterSafeLines([
    dailyImpact ? `Daily impact (patient-reported): ${dailyImpact}` : "",
    readField(structuredData, "limitations", draft.rom?.limitations)
      ? `Movement limitations (patient-reported): ${readField(structuredData, "limitations", draft.rom?.limitations)}`
      : "",
    readField(structuredData, "activitiesAffected", draft.strength?.activitiesAffected)
      ? `Strength-related activity impact (patient-reported): ${readField(structuredData, "activitiesAffected", draft.strength?.activitiesAffected)}`
      : "",
  ]);

  const activityBullets = filterSafeLines([
    readField(structuredData, "difficultyDescription", draft.balance?.difficultyDescription)
      ? `Balance-related difficulty (patient-reported): ${readField(structuredData, "difficultyDescription", draft.balance?.difficultyDescription)}`
      : "",
    readField(structuredData, "walkingDescription", draft.gait?.walkingDescription)
      ? `Gait-related difficulty (patient-reported): ${readField(structuredData, "walkingDescription", draft.gait?.walkingDescription)}`
      : "",
    readField(structuredData, "standingDuration", draft.functional?.standingDuration)
      ? `Standing tolerance (patient-reported): ${readField(structuredData, "standingDuration", draft.functional?.standingDuration)}`
      : "",
    readField(structuredData, "walkingDistance", draft.functional?.walkingDistance)
      ? `Walking distance (patient-reported): ${readField(structuredData, "walkingDistance", draft.functional?.walkingDistance)}`
      : "",
    readField(structuredData, "stairsAbility", draft.functional?.stairsAbility)
      ? `Stair ability (patient-reported): ${readField(structuredData, "stairsAbility", draft.functional?.stairsAbility)}`
      : "",
    readField(structuredData, "otherNotes", draft.functional?.otherNotes)
      ? `Additional functional notes (patient-reported): ${readField(structuredData, "otherNotes", draft.functional?.otherNotes)}`
      : "",
  ]);

  const interpretationParagraphs = filterSafeLines([
    mainComplaint || aggravating || dailyImpact
      ? `Based on the submitted questionnaire, the patient reports ${[mainComplaint, aggravating, dailyImpact].filter(Boolean).join("; ")}.`
      : "",
    bodyRegion && (aggravating || dailyImpact)
      ? `The reported symptom behavior in the ${bodyRegion} region may indicate a mechanically influenced presentation requiring further physical examination for therapist review.`
      : interpretation.functionalLimitations.length > 0
        ? "Patient-reported functional limitations may indicate activity-related symptom behavior requiring further physical examination for therapist review."
        : "",
  ]);

  const objectiveBullets = filterSafeLines([
    ...interpretation.suggestedObjectiveAssessments.map(
      (item) => `Consider assessing: ${item.replace(/^Suggested objective PT assessment item:\s*/i, "")}`,
    ),
    ...interpretation.movementComponents.slice(0, 4).map(
      (item) => `Consider assessing: ${item.replace(/^Movement component for review:\s*/i, "")}`,
    ),
  ]);

  const rasqBullets = filterSafeLines(
    interpretation.bodyRegionBuckets.map((bucket) => {
      if (bucket === "Shoulder" || bucket === "Upper limb") {
        return "Consider for therapist review: upper-limb movement observation or remote upper-limb battery modules if clinically appropriate.";
      }
      if (bucket === "Balance and gait" || bucket === "Ankle / foot") {
        return "Consider for therapist review: gait observation, balance, or mobility-related RASQ assessment modules if clinically appropriate.";
      }
      if (bucket === "Knee" || bucket === "Hip") {
        return "Consider for therapist review: lower-limb functional movement and strength-related assessment modules if clinically appropriate.";
      }
      if (bucket === "Low back" || bucket === "Neck") {
        return "Consider for therapist review: spinal movement and functional tolerance assessment modules if clinically appropriate.";
      }
      return "";
    }),
  );

  if (rasqBullets.length === 0) {
    rasqBullets.push(
      "Consider for therapist review: objective movement and functional assessment modules aligned with the patient-reported region and goals.",
    );
  }

  const hasRedFlag = detectRedFlag(structuredData);

  const sectionContent: Record<string, { paragraphs: string[]; bullets: string[] }> = {
    presentation: {
      paragraphs: presentationBullets.length
        ? ["Summary of patient-reported presentation from the approved Clinical English translation."]
        : ["No detailed presentation fields were documented in the submitted questionnaire."],
      bullets: presentationBullets,
    },
    primary_complaint: {
      paragraphs: mainComplaint ? [] : ["No primary complaint was documented."],
      bullets: mainComplaint ? [mainComplaint] : [],
    },
    pain_symptom_behavior: {
      paragraphs: painBullets.length
        ? ["Patient-reported pain and symptom behavior:"]
        : ["No pain or symptom behavior details were documented."],
      bullets: painBullets,
    },
    functional_limitations: {
      paragraphs: functionalBullets.length
        ? ["Patient-reported functional limitations:"]
        : ["No functional limitations were documented."],
      bullets: functionalBullets,
    },
    activity_participation: {
      paragraphs: activityBullets.length
        ? ["Patient-reported activity and participation restrictions:"]
        : ["No activity or participation restrictions were documented."],
      bullets: activityBullets,
    },
    patient_goals: {
      paragraphs: goals ? [] : ["No patient goals were documented."],
      bullets: goals ? [goals] : [],
    },
    pt_interpretation: {
      paragraphs:
        interpretationParagraphs.length > 0
          ? interpretationParagraphs
          : [
              "Insufficient patient-reported detail to synthesize a structured physiotherapy interpretation draft. Therapist review of the original responses is required.",
            ],
      bullets: [],
    },
    safety: {
      paragraphs: hasRedFlag
        ? [
            "The patient reported information that may warrant red-flag screening during therapist review. Confirm details directly with the patient and apply appropriate clinical safety protocols.",
          ]
        : [
            "No specific red flags were identified from the submitted questionnaire; clinician screening is still required.",
          ],
      bullets: [],
    },
    suggested_objective: {
      paragraphs: [
        "Suggested objective assessment areas based on patient-reported information only. Therapist confirmation is required.",
      ],
      bullets:
        objectiveBullets.length > 0
          ? objectiveBullets
          : [
              "Consider for therapist review: pain characteristics, active movement, functional movement, and relevant special tests based on the patient-reported region.",
            ],
    },
    suggested_rasq_modules: {
      paragraphs: [
        "Recommended RASQ assessment modules based on patient-reported information only. Therapist confirmation is required before assignment.",
      ],
      bullets: rasqBullets,
    },
  };

  return PT_REPORT_SECTION_SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    paragraphs: sectionContent[spec.id]?.paragraphs ?? [],
    bullets: sectionContent[spec.id]?.bullets ?? [],
  }));
}

export function buildPtClinicalReportDraftFallback(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
  generatedAt?: string;
}): PtClinicalReportDraft {
  const includedSections = input.includedSections ?? inferIncludedSections(input.draft);
  const language = getAssessmentLanguage(input.structuredData);
  const sections = buildRuleFallbackSections(input.structuredData, input.draft, includedSections);

  return buildPtClinicalReportDraftFromSections(sections, {
    sourceLanguage: language === "ar" ? "ar" : "en",
    source: language === "ar" ? "clinical_english" : "patient_english",
    generatedAt: input.generatedAt,
    generationMethod: "rule_fallback",
  });
}

/** Synchronous builder — rule-based fallback (tests and AI failure path). */
export function buildPtClinicalReportDraft(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
  generatedAt?: string;
}): PtClinicalReportDraft {
  return buildPtClinicalReportDraftFallback(input);
}

export type GeneratePtClinicalReportResult = {
  report: PtClinicalReportDraft;
  usedFallback: boolean;
};

export async function generatePtClinicalReport(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
  apiKey: string | null;
}): Promise<GeneratePtClinicalReportResult> {
  const includedSections = input.includedSections ?? inferIncludedSections(input.draft);
  const payload = buildApprovedClinicalEnglishPayload({
    structuredData: input.structuredData,
    draft: input.draft,
    includedSections,
  });

  if (input.apiKey) {
    const aiResult = await synthesizePtClinicalReport(input.apiKey, payload);
    if (aiResult.ok) {
      return { report: aiResult.report, usedFallback: false };
    }
  }

  return {
    report: buildPtClinicalReportDraftFallback({
      structuredData: input.structuredData,
      draft: input.draft,
      includedSections,
    }),
    usedFallback: true,
  };
}

export function ptReportUsesClinicalEnglish(structuredData: Record<string, unknown>): boolean {
  return getAssessmentLanguage(structuredData) === "ar";
}

export function ptReportContainsPatientReportedLanguage(report: PtClinicalReportDraft): boolean {
  const corpus = report.sections
    .flatMap((section) => [...section.paragraphs, ...section.bullets])
    .join("\n")
    .toLowerCase();
  return (
    corpus.includes("patient reports") ||
    corpus.includes("patient-reported") ||
    corpus.includes("based on the submitted questionnaire")
  );
}

export function ptReportSectionsMatchSchema(report: PtClinicalReportDraft): boolean {
  if (report.sections.length !== PT_REPORT_SECTION_SPECS.length) return false;
  return PT_REPORT_SECTION_SPECS.every(
    (spec, index) => report.sections[index]?.id === spec.id && report.sections[index]?.title === spec.title,
  );
}
