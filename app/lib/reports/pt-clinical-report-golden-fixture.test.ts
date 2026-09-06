/**
 * Run: npx tsx --test app/lib/reports/pt-clinical-report-golden-fixture.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeClinicalEnglishText } from "./normalize-clinical-english";
import {
  countSubstantiveReportLines,
  estimateReportPages,
  polishPtClinicalReportDraft,
  reportUsesSynthesisStyle,
} from "./polish-pt-clinical-report";
import { buildPtClinicalReportDraftFallback } from "./pt-clinical-report-draft";
import { buildStructuredClinicalSourceBundle } from "./structured-clinical-source-bundle";

const GOLDEN_ARABIC_DRAFT = {
  assessmentLanguage: "ar",
  pain: {
    chiefComplaint: "عندي ضعف في عضلات اليد اليمنى",
    painLocation: "الكتف واليد اليمنى",
    painScore: "6",
    aggravating: "رفع الذراع فوق التسعين درجة",
    easing: "الراحة",
    dailyImpact: "صعوبة في حمل الكوب والأكل والتزيين وقيادة السيارة",
    goals: "العودة للقيادة والأنشطة اليومية بدون صعوبة",
  },
  strength: {
    weaknessDescription: "ضعف واضح في اليد اليمنى",
    activitiesAffected: "حمل الأشياء والأكل والتزيين",
  },
  balance: {
    difficultyDescription: "أحياناً أحس بعدم توازن عند الوقوف",
    fallHistory: "",
  },
  gait: {
    walkingDescription: "المشي ممكن لكن ببطء أحياناً",
    aids: "",
  },
  functional: {
    standingDuration: "يمكنني الوقوف دقيقة تقريباً",
    walkingDistance: "أمشي لمسافة قصيرة فقط",
    stairsAbility: "صعود السلالم صعب",
    otherNotes: "",
  },
};

const GOLDEN_STRUCTURED = {
  assessmentLanguage: "ar",
  clinical_translation_status: "approved",
  clinical_translation_reviewed: true,
  chiefComplaint_method: "voice",
  painLocation_method: "voice",
  standingDuration_method: "voice",
  chiefComplaint_en: "The patient reports weakness affecting the right hand.",
  painLocation_en: "The patient reports symptoms in the right shoulder and hand.",
  aggravating_en: "The patient reports symptoms increase when raising the arm above approximately 90 degrees.",
  easing_en: "The patient reports rest eases symptoms.",
  dailyImpact_en:
    "The patient reports difficulty holding a cup, eating, grooming, and driving.",
  goals_en: "The patient reports a goal to return to driving and daily activities without difficulty.",
  weaknessDescription_en: "The patient reports noticeable weakness in the right hand.",
  activitiesAffected_en: "The patient reports difficulty carrying objects, eating, and grooming.",
  difficultyDescription_en: "The patient reports occasional imbalance when standing.",
  walkingDescription_en: "The patient reports walking is possible but sometimes slow.",
  standingDuration_en: "The patient reports standing tolerance of approximately one minute.",
  walkingDistance_en: "The patient reports walking only short distances.",
  stairsAbility_en: "The patient reports stair climbing is difficult.",
  pain: GOLDEN_ARABIC_DRAFT.pain,
  strength: GOLDEN_ARABIC_DRAFT.strength,
  balance: GOLDEN_ARABIC_DRAFT.balance,
  gait: GOLDEN_ARABIC_DRAFT.gait,
  functional: GOLDEN_ARABIC_DRAFT.functional,
};

describe("golden Arabic voice-transcription regression fixture", () => {
  it("cleans filler-like artifacts in deterministic normalization without semantic guessing", () => {
    const cleaned = normalizeClinicalEnglishText(
      "Um, the patient reports, um, standing tolerance of about one minute.",
    );
    assert.doesNotMatch(cleaned.text, /\bum\b/i);
    assert.match(cleaned.text, /one minute/i);
  });

  it("maps anatomical location separately from functional impact in source bundle", () => {
    const bundle = buildStructuredClinicalSourceBundle({
      structuredData: GOLDEN_STRUCTURED,
      draft: GOLDEN_ARABIC_DRAFT,
    });

    const anatomical = bundle.presentation.find((field) => field.clinicalConcept === "anatomical_region");
    const functional = bundle.functionalLimitations.find(
      (field) => field.clinicalConcept === "functional_daily_impact",
    );
    assert.ok(anatomical);
    assert.ok(functional);
    assert.match(anatomical.clinicalEnglish, /shoulder|hand/i);
    assert.match(functional.clinicalEnglish, /cup|eating|grooming|driving/i);
    assert.doesNotMatch(anatomical.clinicalEnglish, /cup|eating|driving/i);
  });

  it("preserves durations as durations in activity participation bucket", () => {
    const bundle = buildStructuredClinicalSourceBundle({
      structuredData: GOLDEN_STRUCTURED,
      draft: GOLDEN_ARABIC_DRAFT,
    });
    const standing = bundle.activityParticipation.find(
      (field) => field.clinicalConcept === "standing_tolerance",
    );
    assert.ok(standing);
    assert.match(standing.clinicalEnglish, /one minute|minute/i);
    assert.doesNotMatch(standing.clinicalEnglish, /metre|meter|distance/i);
  });

  it("synthesizes a concise PT report rather than concatenating every field", () => {
    const bundle = buildStructuredClinicalSourceBundle({
      structuredData: GOLDEN_STRUCTURED,
      draft: GOLDEN_ARABIC_DRAFT,
    });
    const beforePolish = buildPtClinicalReportDraftFallback({
      structuredData: GOLDEN_STRUCTURED,
      draft: GOLDEN_ARABIC_DRAFT,
    });
    const report = polishPtClinicalReportDraft(beforePolish, bundle);

    const corpus = report.sections
      .flatMap((section) => [...section.paragraphs, ...section.bullets])
      .join("\n")
      .toLowerCase();

    assert.match(corpus, /patient reports|patient-reported/i);
    assert.doesNotMatch(corpus, /diagnosis/i);
    assert.doesNotMatch(corpus, /confirmed weakness on examination/i);
    assert.doesNotMatch(corpus, /limited rom/i);
    assert.ok(reportUsesSynthesisStyle(report) || corpus.includes("objective assessment is required"));

    const functionalSection = report.sections.find((section) => section.id === "functional_limitations");
    const presentationSection = report.sections.find((section) => section.id === "presentation");
    assert.ok(functionalSection);
    assert.ok(presentationSection);
    const presentationText = presentationSection.paragraphs.join(" ").toLowerCase();
    const functionalText = functionalSection.paragraphs.join(" ").toLowerCase();
    assert.doesNotMatch(presentationText, /cup|eating|grooming|driving/);
    assert.match(functionalText, /cup|eating|grooming|driving/);

    const lineCount = countSubstantiveReportLines(report);
    assert.ok(lineCount <= 24, `expected concise report, got ${lineCount} substantive lines`);
    assert.ok(estimateReportPages(report) <= 4);
  });

  it("preserves Arabic originals separately from approved clinical English", () => {
    assert.equal(GOLDEN_STRUCTURED.pain.chiefComplaint, "عندي ضعف في عضلات اليد اليمنى");
    assert.equal(GOLDEN_STRUCTURED.chiefComplaint_en, "The patient reports weakness affecting the right hand.");
    assert.notEqual(GOLDEN_STRUCTURED.pain.chiefComplaint, GOLDEN_STRUCTURED.chiefComplaint_en);
  });

  it("keeps gait and balance statements patient-reported", () => {
    const report = buildPtClinicalReportDraftFallback({
      structuredData: GOLDEN_STRUCTURED,
      draft: GOLDEN_ARABIC_DRAFT,
    });
    const activity = report.sections.find((section) => section.id === "activity_participation");
    const text = [...(activity?.paragraphs ?? []), ...(activity?.bullets ?? [])].join(" ").toLowerCase();
    assert.match(text, /patient reports/i);
    assert.doesNotMatch(text, /gait abnormality observed/i);
    assert.doesNotMatch(text, /abnormal gait/i);
  });
});
