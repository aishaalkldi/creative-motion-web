/**
 * Run: npx tsx --test app/components/clinician/PtMedicalReportDraftPanel.test.ts
 *
 * No React render harness exists in this repo, so these tests cover exported
 * pure helpers and panel view-model derivation. Component-mount behavior
 * ("no POST fires automatically") is confirmed by code inspection:
 * PtMedicalReportDraftPanel.tsx calls fetch only inside handleGenerate(),
 * which is invoked solely from onClick — no useEffect triggers generation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  PT_MEDICAL_REPORT_DRAFT_LABEL,
  type PtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import {
  buildPtMedicalReportPanelViewModel,
  derivePtMedicalReportPanelState,
  parseGeneratePtReportApiResponse,
} from "./PtMedicalReportDraftPanel";

const APPROVED_FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-29T08:00:00.000Z",
  facts: { chiefComplaint: "The patient reports shoulder pain." },
};

const DRAFT: PtMedicalReportDraft = {
  version: 1,
  status: "draft",
  generatedAt: "2026-07-29T09:00:00.000Z",
  sourceFactsVersion: 1,
  sections: {
    chiefComplaint: "The patient reports shoulder pain.",
    clinicalReviewNote: "Therapist review required.",
  },
};

describe("derivePtMedicalReportPanelState", () => {
  it("requires Gate 1 approval before generation", () => {
    assert.equal(derivePtMedicalReportPanelState(null, null), "gate1_required");
  });

  it("shows generate state after Gate 1 without a draft", () => {
    assert.equal(derivePtMedicalReportPanelState(APPROVED_FACTS, null), "ready_to_generate");
  });

  it("shows draft state after generation", () => {
    assert.equal(derivePtMedicalReportPanelState(APPROVED_FACTS, DRAFT), "draft_ready");
  });
});

describe("buildPtMedicalReportPanelViewModel", () => {
  it("labels generated output as a clinician-review-required draft", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, DRAFT);
    assert.equal(vm.draftLabel, PT_MEDICAL_REPORT_DRAFT_LABEL);
    assert.equal(vm.showRegenerate, true);
    assert.deepEqual(vm.visibleSectionKeys, ["chiefComplaint", "clinicalReviewNote"]);
  });

  it("omits empty sections from the visible list", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, {
      ...DRAFT,
      sections: { chiefComplaint: "Only one section." },
    });
    assert.deepEqual(vm.visibleSectionKeys, ["chiefComplaint"]);
  });
});

describe("parseGeneratePtReportApiResponse", () => {
  it("parses a successful generation response", () => {
    const parsed = parseGeneratePtReportApiResponse({
      generated: true,
      ptMedicalReportDraft: DRAFT,
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.draft?.sections.chiefComplaint, DRAFT.sections.chiefComplaint);
  });

  it("returns safe errors from API failures", () => {
    const parsed = parseGeneratePtReportApiResponse({
      error: "Approve patient-reported information before generating the PT report.",
    });
    assert.equal(parsed.ok, false);
    assert.match(parsed.error ?? "", /Approve patient-reported information/i);
  });
});
