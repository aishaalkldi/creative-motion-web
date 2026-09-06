/**
 * PT Clinical Report generation — approved Clinical English → AI synthesis with rule-based fallback.
 */
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import { getAssessmentLanguage } from "@/app/lib/assessment-payload";
import { synthesizePtClinicalReport } from "@/app/lib/ai/synthesize-pt-clinical-report";
import { inferIncludedSections } from "@/app/lib/remote-questionnaire-summary";
import { polishPtClinicalReportDraft } from "@/app/lib/reports/polish-pt-clinical-report";
import {
  buildPtClinicalReportDraftFromSections,
  type PtClinicalReportDraft,
  type PtClinicalReportSection,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";
import { suggestRasqModulesFromCorpus } from "@/app/lib/reports/rasq-assessment-modules";
import {
  buildStructuredClinicalSourceBundle,
  type StructuredClinicalSourceBundle,
  type StructuredClinicalSourceField,
} from "@/app/lib/reports/structured-clinical-source-bundle";

export {
  PT_CLINICAL_REPORT_DISCLAIMER,
  PT_CLINICAL_REPORT_THERAPIST_NOTE,
  PT_CLINICAL_REPORT_TITLE,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";
export type {
  ApprovedClinicalEnglishField,
  ApprovedClinicalEnglishPayload,
  PtClinicalReportDraft,
  PtClinicalReportSection,
} from "@/app/lib/reports/pt-clinical-report-schema";
export { buildStructuredClinicalSourceBundle } from "@/app/lib/reports/structured-clinical-source-bundle";

function joinFieldText(fields: StructuredClinicalSourceField[]): string {
  return fields.map((field) => field.clinicalEnglish).join(" ");
}

function synthesizeParagraphFromFields(fields: StructuredClinicalSourceField[]): string[] {
  if (fields.length === 0) return [];
  if (fields.length === 1) return [fields[0].clinicalEnglish];
  const concepts = fields.map((field) =>
    field.clinicalEnglish
      .replace(/^(The patient reports|Patient-reported)\s*/i, "")
      .trim()
      .replace(/\.+$/, ""),
  );
  return [`The patient reports ${concepts.join("; ")}.`];
}

function buildInterpretationParagraph(bundle: StructuredClinicalSourceBundle): string[] {
  const domains: string[] = [];
  if (bundle.functionalLimitations.some((field) => /weakness|weak/i.test(field.clinicalEnglish))) {
    domains.push("upper-limb or general functional limitation");
  }
  if (bundle.symptomBehavior.length > 0) domains.push("symptom behavior with movement");
  if (bundle.activityParticipation.some((field) => /balance|unsteady|fall/i.test(field.clinicalEnglish))) {
    domains.push("balance");
  }
  if (bundle.activityParticipation.some((field) => /walk|gait/i.test(field.clinicalEnglish))) {
    domains.push("gait and mobility");
  }
  if (domains.length === 0) {
    return [
      "Based on the submitted questionnaire, further objective assessment is required to characterize movement quality, symptom behavior, and functional tolerance for therapist review.",
    ];
  }
  return [
    `The patient-reported presentation is consistent with significant ${domains.join(", ")}. Objective assessment is required to characterize movement quality, ROM, strength, motor control, hand function, balance, and mobility for therapist review.`,
  ];
}

function buildObjectiveBullets(bundle: StructuredClinicalSourceBundle): string[] {
  const bullets: string[] = [];
  const corpus = joinFieldText(bundle.allFields).toLowerCase();
  if (/shoulder|arm|hand|upper limb|overhead|reach/i.test(corpus)) {
    bullets.push("Consider assessing shoulder movement and movement quality.");
    bullets.push("Consider assessing upper-limb motor control and functional hand use.");
  }
  if (/weakness|grip|hold|cup|eat|groom/i.test(corpus)) {
    bullets.push("Consider assessing functional hand use and grip-related tasks.");
  }
  if (/balance|unsteady|fall/i.test(corpus)) {
    bullets.push("Consider assessing balance and postural control.");
  }
  if (/walk|gait|stairs|distance|stand/i.test(corpus)) {
    bullets.push("Consider assessing gait and mobility tolerance.");
  }
  if (bullets.length === 0) {
    bullets.push("Consider assessing pain behavior, active movement, and functional tasks relevant to the patient-reported region.");
  }
  return bullets;
}

function buildRuleFallbackSections(bundle: StructuredClinicalSourceBundle): PtClinicalReportSection[] {
  const primary = bundle.presentation.filter((field) => field.clinicalConcept === "primary_complaint");
  const anatomical = bundle.presentation.filter((field) => field.clinicalConcept === "anatomical_region");
  const presentationParagraphs = [
    anatomical.length > 0
      ? anatomical[0].clinicalEnglish
      : primary.length > 0
        ? primary[0].clinicalEnglish
        : "Summary of patient-reported presentation from the approved Clinical English translation.",
  ];
  if (bundle.painScore) {
    presentationParagraphs.push(`Patient-reported pain score: ${bundle.painScore}/10.`);
  }

  const rasqModules = suggestRasqModulesFromCorpus(joinFieldText(bundle.allFields));

  const sectionContent: Record<string, { paragraphs: string[]; bullets: string[] }> = {
    presentation: {
      paragraphs: presentationParagraphs,
      bullets: [],
    },
    primary_complaint: {
      paragraphs: primary.length ? synthesizeParagraphFromFields(primary) : ["Not reported."],
      bullets: [],
    },
    pain_symptom_behavior: {
      paragraphs: bundle.symptomBehavior.length
        ? synthesizeParagraphFromFields(bundle.symptomBehavior)
        : ["No pain or symptom behavior details were documented."],
      bullets: [],
    },
    functional_limitations: {
      paragraphs: bundle.functionalLimitations.length
        ? synthesizeParagraphFromFields(bundle.functionalLimitations)
        : ["No functional limitations were documented."],
      bullets: [],
    },
    activity_participation: {
      paragraphs: bundle.activityParticipation.length
        ? synthesizeParagraphFromFields(bundle.activityParticipation)
        : ["No activity or participation restrictions were documented."],
      bullets: [],
    },
    patient_goals: {
      paragraphs: bundle.patientGoals.length
        ? synthesizeParagraphFromFields(bundle.patientGoals)
        : ["No patient goals were documented."],
      bullets: [],
    },
    pt_interpretation: {
      paragraphs: buildInterpretationParagraph(bundle),
      bullets: [],
    },
    safety: {
      paragraphs: bundle.hasRedFlag
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
      bullets: buildObjectiveBullets(bundle),
    },
    suggested_rasq_modules: {
      paragraphs: [
        "Recommended RASQ assessment modules based on patient-reported information only. Therapist confirmation is required before assignment.",
      ],
      bullets: rasqModules.map(
        (module) => `Consider for therapist review: ${module.label} if clinically appropriate.`,
      ),
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
  const bundle = buildStructuredClinicalSourceBundle({
    structuredData: input.structuredData,
    draft: input.draft,
    includedSections: input.includedSections,
  });
  const sections = buildRuleFallbackSections(bundle);
  const draft = buildPtClinicalReportDraftFromSections(sections, {
    sourceLanguage: bundle.sourceLanguage,
    source: bundle.sourceLanguage === "ar" ? "clinical_english" : "patient_english",
    generatedAt: input.generatedAt,
    generationMethod: "rule_fallback",
  });
  return polishPtClinicalReportDraft(draft, bundle);
}

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
  const bundle = buildStructuredClinicalSourceBundle({
    structuredData: input.structuredData,
    draft: input.draft,
    includedSections: input.includedSections ?? inferIncludedSections(input.draft),
  });

  if (input.apiKey) {
    const aiResult = await synthesizePtClinicalReport(input.apiKey, bundle);
    if (aiResult.ok) {
      return { report: aiResult.report, usedFallback: false };
    }
  }

  return {
    report: buildPtClinicalReportDraftFallback({
      structuredData: input.structuredData,
      draft: input.draft,
      includedSections: input.includedSections,
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

// Backward-compatible export used by older imports.
export function buildApprovedClinicalEnglishPayload(input: {
  structuredData: Record<string, unknown>;
  draft: PatientAssessmentDraft;
  includedSections?: PatientSectionId[];
}) {
  const bundle = buildStructuredClinicalSourceBundle(input);
  return {
    sourceLanguage: bundle.sourceLanguage,
    painScore: bundle.painScore,
    hasRedFlag: bundle.hasRedFlag,
    fields: bundle.allFields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      section: field.sectionTitle,
      clinicalEnglish: field.clinicalEnglish,
    })),
  };
}
