/**
 * Run: npx tsx --test app/components/clinician/PtMedicalReportDraftPanel.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  PT_MEDICAL_REPORT_APPROVED_LABEL,
  PT_MEDICAL_REPORT_DRAFT_LABEL,
  type PtMedicalReportApproved,
  type PtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import {
  PT_MEDICAL_REPORT_EXPORT_MESSAGES,
} from "@/app/components/reports/PtMedicalReportPrintView";
import {
  buildPtMedicalReportPanelViewModel,
  derivePtMedicalReportPanelState,
  parseApprovePtReportApiResponse,
  parseGeneratePtReportApiResponse,
  parseSavePtReportDraftApiResponse,
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

const APPROVED: PtMedicalReportApproved = {
  version: 1,
  approvedAt: "2026-07-29T10:00:00.000Z",
  sourceDraftVersion: 1,
  sections: {
    chiefComplaint: "The patient reports shoulder pain.",
    clinicalReviewNote: "Therapist review required.",
  },
};

const GATE2_AT = "2026-07-29T10:00:00.000Z";

describe("buildPtMedicalReportPanelViewModel export states", () => {
  it("blocks export without Gate 1 approval", () => {
    const vm = buildPtMedicalReportPanelViewModel(null, null, null);
    assert.equal(vm.showExport, false);
    assert.equal(vm.exportBlockedMessage, PT_MEDICAL_REPORT_EXPORT_MESSAGES.gate1_required);
  });

  it("blocks export without a generated report", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, null, null);
    assert.equal(vm.showExport, false);
    assert.equal(vm.exportBlockedMessage, PT_MEDICAL_REPORT_EXPORT_MESSAGES.draft_required);
  });

  it("blocks export while the report remains a draft", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, DRAFT, null);
    assert.equal(vm.showExport, false);
    assert.equal(vm.exportBlockedMessage, PT_MEDICAL_REPORT_EXPORT_MESSAGES.approval_required);
  });

  it("enables export only with valid Gate 2 approval", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, DRAFT, APPROVED, null, GATE2_AT);
    assert.equal(vm.showExport, true);
    assert.equal(vm.exportBlockedMessage, null);
    assert.equal(vm.showApprove, false);
  });

  it("blocks export after post-approval edits invalidate Gate 2", () => {
    const vm = buildPtMedicalReportPanelViewModel(
      APPROVED_FACTS,
      { ...DRAFT, version: 2 },
      APPROVED,
      null,
      GATE2_AT,
    );
    assert.equal(vm.showExport, false);
    assert.equal(vm.exportBlockedMessage, PT_MEDICAL_REPORT_EXPORT_MESSAGES.stale_approval);
    assert.equal(vm.showApprove, true);
  });
});

describe("derivePtMedicalReportPanelState", () => {
  it("requires Gate 1 approval before generation", () => {
    assert.equal(derivePtMedicalReportPanelState(null, null, null), "gate1_required");
  });

  it("shows generate state after Gate 1 without a draft", () => {
    assert.equal(derivePtMedicalReportPanelState(APPROVED_FACTS, null, null), "ready_to_generate");
  });

  it("shows draft state after generation", () => {
    assert.equal(derivePtMedicalReportPanelState(APPROVED_FACTS, DRAFT, null), "draft_ready");
  });

  it("shows approved state after Gate 2 approval", () => {
    assert.equal(derivePtMedicalReportPanelState(APPROVED_FACTS, DRAFT, APPROVED), "approved");
  });
});

describe("buildPtMedicalReportPanelViewModel", () => {
  it("labels generated output as a clinician-review-required draft", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, DRAFT, null);
    assert.equal(vm.statusLabel, PT_MEDICAL_REPORT_DRAFT_LABEL);
    assert.equal(vm.showRegenerate, true);
    assert.equal(vm.showSaveDraft, true);
    assert.equal(vm.showApprove, true);
    assert.deepEqual(vm.editableSectionKeys, ["chiefComplaint", "clinicalReviewNote"]);
  });

  it("clearly distinguishes approved state from draft state", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, DRAFT, APPROVED, null, GATE2_AT);
    assert.equal(vm.statusLabel, PT_MEDICAL_REPORT_APPROVED_LABEL);
    assert.equal(vm.showApprove, false);
    assert.equal(vm.showExport, true);
    assert.equal(vm.state, "approved");
  });

  it("omits empty sections from the editable list", () => {
    const vm = buildPtMedicalReportPanelViewModel(APPROVED_FACTS, {
      ...DRAFT,
      sections: { chiefComplaint: "Only one section." },
    }, null);
    assert.deepEqual(vm.editableSectionKeys, ["chiefComplaint"]);
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
});

describe("parseSavePtReportDraftApiResponse", () => {
  it("parses a successful save response and reports Gate 2 invalidation", () => {
    const parsed = parseSavePtReportDraftApiResponse({
      saved: true,
      gate2Invalidated: true,
      ptMedicalReportDraft: {
        ...DRAFT,
        sections: { chiefComplaint: "Edited complaint.", clinicalReviewNote: "Review." },
      },
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.gate2Invalidated, true);
    assert.equal(parsed.draft?.sections.chiefComplaint, "Edited complaint.");
  });
});

describe("parseApprovePtReportApiResponse", () => {
  it("parses a successful approval response", () => {
    const parsed = parseApprovePtReportApiResponse({
      approved: true,
      ptMedicalReportApproved: APPROVED,
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.approved?.sourceDraftVersion, 1);
  });

  it("returns safe errors from API failures", () => {
    const parsed = parseApprovePtReportApiResponse({
      error: "Generate and review the PT report draft before approval.",
    });
    assert.equal(parsed.ok, false);
    assert.match(parsed.error ?? "", /Generate and review/i);
  });
});
