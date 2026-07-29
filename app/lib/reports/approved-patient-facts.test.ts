/**
 * Run: npx tsx --test app/lib/reports/approved-patient-facts.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import {
  buildApprovedPatientReportFactsSnapshot,
  containsForbiddenClinicalClaim,
  isChiefComplaintExtractionReviewed,
  readApprovedPatientReportFacts,
  resolveApprovedFieldValue,
} from "./approved-patient-facts";
import { isTranslationReviewed } from "./patient-clinical-translation";

const ARABIC_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "ألم في الظهر عند الجلوس",
    painLocation: "الظهر",
    painScore: "7",
    aggravating: "الجلوس لفترات طويلة",
    easing: "المشي",
    dailyImpact: "صعوبة في العمل",
    goals: "العودة للعمل دون ألم",
  },
};

const ENGLISH_DRAFT: PatientAssessmentDraft = {
  pain: {
    chiefComplaint: "Low back pain when sitting",
    painLocation: "Lower back",
    painScore: "6",
    aggravating: "Prolonged sitting",
    easing: "Walking",
    dailyImpact: "Difficulty working at desk",
    goals: "Return to work without pain",
  },
};

const SHOULDER_EXTRACTION = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.92,
};

describe("isTranslationReviewed", () => {
  it("requires exact true", () => {
    assert.equal(isTranslationReviewed({ chiefComplaint_en_reviewed: true }, "chiefComplaint"), true);
    assert.equal(isTranslationReviewed({ chiefComplaint_en_reviewed: false }, "chiefComplaint"), false);
    assert.equal(isTranslationReviewed({}, "chiefComplaint"), false);
  });
});

describe("resolveApprovedFieldValue", () => {
  it("includes reviewed Arabic-to-English translation", () => {
    const value = resolveApprovedFieldValue(
      "chiefComplaint",
      "ألم في الظهر",
      {
        chiefComplaint_en: "Low back pain.",
        chiefComplaint_en_reviewed: true,
      },
      "ar",
    );
    assert.equal(value, "Low back pain.");
  });

  it("excludes unreviewed translation for Arabic fields", () => {
    const value = resolveApprovedFieldValue(
      "chiefComplaint",
      "ألم في الظهر",
      {
        chiefComplaint_en: "Low back pain.",
        chiefComplaint_en_reviewed: false,
      },
      "ar",
    );
    assert.equal(value, null);
  });

  it("includes English patient input without AI translation", () => {
    const value = resolveApprovedFieldValue(
      "chiefComplaint",
      "Low back pain when sitting",
      {},
      "en",
    );
    assert.equal(value, "Low back pain when sitting");
  });

  it("includes pain score for Arabic assessments without translation", () => {
    const value = resolveApprovedFieldValue("painScore", "7", {}, "ar");
    assert.equal(value, "7");
  });
});

describe("buildApprovedPatientReportFactsSnapshot", () => {
  it("includes reviewed extraction when flagged reviewed", () => {
    const snapshot = buildApprovedPatientReportFactsSnapshot(
      {
        chiefComplaint_en: "Low back pain when sitting.",
        chiefComplaint_en_reviewed: true,
        painLocation_en: "Lower back.",
        painLocation_en_reviewed: true,
        chiefComplaint_extraction: SHOULDER_EXTRACTION,
        chiefComplaint_extraction_reviewed: true,
      },
      ARABIC_DRAFT,
      ["pain"],
      "ar",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(snapshot.facts.chiefComplaint, "Low back pain when sitting.");
    assert.equal(snapshot.facts.painLocation, "Lower back.");
    assert.equal(snapshot.facts.painScore, "7 / 10");
    assert.deepEqual(snapshot.chiefComplaintExtraction, SHOULDER_EXTRACTION);
  });

  it("excludes unreviewed extraction", () => {
    const snapshot = buildApprovedPatientReportFactsSnapshot(
      {
        chiefComplaint_en: "Low back pain when sitting.",
        chiefComplaint_en_reviewed: true,
        chiefComplaint_extraction: SHOULDER_EXTRACTION,
        chiefComplaint_extraction_reviewed: false,
      },
      ARABIC_DRAFT,
      ["pain"],
      "ar",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(snapshot.chiefComplaintExtraction, undefined);
  });

  it("does not invent missing fields", () => {
    const snapshot = buildApprovedPatientReportFactsSnapshot(
      {
        chiefComplaint_en: "Low back pain when sitting.",
        chiefComplaint_en_reviewed: true,
      },
      ARABIC_DRAFT,
      ["pain"],
      "ar",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(snapshot.facts.chiefComplaint, "Low back pain when sitting.");
    assert.equal(snapshot.facts.painLocation, undefined);
    assert.equal(snapshot.facts.aggravating, undefined);
  });

  it("builds facts from English patient input without translations", () => {
    const snapshot = buildApprovedPatientReportFactsSnapshot(
      {},
      ENGLISH_DRAFT,
      ["pain"],
      "en",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(snapshot.facts.chiefComplaint, "Low back pain when sitting");
    assert.equal(snapshot.facts.painLocation, "Lower back");
    assert.equal(snapshot.facts.painScore, "6 / 10");
    assert.equal(snapshot.facts.goals, "Return to work without pain");
  });

  it("does not introduce diagnosis, prognosis, or treatment recommendation text", () => {
    const snapshot = buildApprovedPatientReportFactsSnapshot(
      {},
      {
        pain: {
          ...ENGLISH_DRAFT.pain!,
          chiefComplaint: "Patient reports lumbar radiculopathy diagnosis from GP",
          goals: "Treatment recommendation: surgery within 2 weeks",
        },
      },
      ["pain"],
      "en",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(snapshot.facts.chiefComplaint, undefined);
    assert.equal(snapshot.facts.goals, undefined);
    assert.equal(snapshot.facts.painLocation, "Lower back");
  });

  it("preserves unrelated structured_data keys when used as read-only input", () => {
    const structuredData = {
      pain: ARABIC_DRAFT.pain,
      rom: { limitations: "cannot raise arm" },
      chiefComplaint_en: "Low back pain.",
      chiefComplaint_en_reviewed: true,
      assessmentLanguage: "ar",
    };
    const before = JSON.stringify(structuredData);

    buildApprovedPatientReportFactsSnapshot(
      structuredData,
      ARABIC_DRAFT,
      ["pain"],
      "ar",
      "2026-07-24T10:00:00.000Z",
    );

    assert.equal(JSON.stringify(structuredData), before);
    assert.equal((structuredData.pain as { chiefComplaint: string }).chiefComplaint, "ألم في الظهر عند الجلوس");
  });
});

describe("containsForbiddenClinicalClaim", () => {
  it("flags diagnosis, prognosis, and treatment recommendation wording", () => {
    assert.equal(containsForbiddenClinicalClaim("confirmed diagnosis of stroke"), true);
    assert.equal(containsForbiddenClinicalClaim("prognosis is poor"), true);
    assert.equal(containsForbiddenClinicalClaim("treatment recommendation: rest"), true);
    assert.equal(containsForbiddenClinicalClaim("pain when sitting"), false);
  });
});

describe("readApprovedPatientReportFacts", () => {
  it("reads a persisted approved snapshot", () => {
    const stored = readApprovedPatientReportFacts({
      approvedPatientReportFacts: {
        version: 1,
        approvedAt: "2026-07-24T10:00:00.000Z",
        facts: { chiefComplaint: "Low back pain." },
      },
    });

    assert.ok(stored);
    assert.equal(stored!.facts.chiefComplaint, "Low back pain.");
  });

  it("reads a valid reviewed extraction from a persisted snapshot", () => {
    const stored = readApprovedPatientReportFacts({
      approvedPatientReportFacts: {
        version: 1,
        approvedAt: "2026-07-24T10:00:00.000Z",
        facts: { chiefComplaint: "Low back pain." },
        chiefComplaintExtraction: SHOULDER_EXTRACTION,
      },
    });

    assert.deepEqual(stored?.chiefComplaintExtraction, SHOULDER_EXTRACTION);
  });

  it("excludes invalid extraction payloads safely", () => {
    const stored = readApprovedPatientReportFacts({
      approvedPatientReportFacts: {
        version: 1,
        approvedAt: "2026-07-24T10:00:00.000Z",
        facts: { chiefComplaint: "Low back pain." },
        chiefComplaintExtraction: {
          body_region: "",
          side: "right",
          primary_symptom: "pain",
          aggravating_factor: null,
          language: "ar",
          confidence: 0.5,
        },
      },
    });

    assert.equal(stored?.chiefComplaintExtraction, undefined);
  });

  it("returns null when snapshot is missing or invalid", () => {
    assert.equal(readApprovedPatientReportFacts(null), null);
    assert.equal(readApprovedPatientReportFacts({ approvedPatientReportFacts: { version: 2 } }), null);
  });
});

describe("approved-patient-facts import boundary", () => {
  it("does not import from client components or app/components", () => {
    const filePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "approved-patient-facts.ts",
    );
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /from ["']@\/app\/components\//);
    assert.doesNotMatch(source, /["']use client["']/);
  });
});

describe("isChiefComplaintExtractionReviewed", () => {
  it("requires exact true", () => {
    assert.equal(isChiefComplaintExtractionReviewed({ chiefComplaint_extraction_reviewed: true }), true);
    assert.equal(isChiefComplaintExtractionReviewed({ chiefComplaint_extraction_reviewed: false }), false);
  });
});
