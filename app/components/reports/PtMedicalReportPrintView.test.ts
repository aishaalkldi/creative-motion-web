/**
 * Run: npx tsx --test app/components/reports/PtMedicalReportPrintView.test.ts
 *
 * Component-mount behavior ("no window.print() on render") is confirmed by
 * code inspection: PtMedicalReportPrintView.tsx contains no print calls.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import type { PtMedicalReportApproved, PtMedicalReportDraft } from "@/app/lib/ai/generate-pt-medical-report";
import {
  getApprovedPrintSectionKeys,
  PT_MEDICAL_REPORT_EXPORT_MESSAGES,
  PT_MEDICAL_REPORT_PRINT_BODY_SECTION_KEYS,
  PT_MEDICAL_REPORT_PRINT_FOOTER,
  readGate2ApprovedAt,
  resolvePtMedicalReportExportEligibility,
  shouldInvokeApprovedPtMedicalReportPrint,
} from "./PtMedicalReportPrintView";

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
    chiefComplaint: "Draft text that must not export.",
    clinicalReviewNote: "Draft review note.",
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

function eligibility(overrides: Partial<Parameters<typeof resolvePtMedicalReportExportEligibility>[0]> = {}) {
  return resolvePtMedicalReportExportEligibility({
    approvedFacts: APPROVED_FACTS,
    draft: DRAFT,
    approved: APPROVED,
    gate2ApprovedAt: GATE2_AT,
    ...overrides,
  });
}

describe("readGate2ApprovedAt", () => {
  it("reads gate2ApprovedAt from server structured_data", () => {
    assert.equal(readGate2ApprovedAt({ gate2ApprovedAt: GATE2_AT }), GATE2_AT);
    assert.equal(readGate2ApprovedAt({ gate2ApprovedAt: "  " }), null);
    assert.equal(readGate2ApprovedAt(null), null);
  });
});

describe("approved export content safety", () => {
  it("does not expose draft-only section text in the approved snapshot", () => {
    const result = eligibility();
    assert.notEqual(result.approvedSnapshot?.sections.chiefComplaint, DRAFT.sections.chiefComplaint);
  });

  it("never treats live questionnaire fields as export input", () => {
    const result = eligibility({
      approvedFacts: {
        ...APPROVED_FACTS,
        facts: { chiefComplaint: "Live editable Arabic or English questionnaire value." },
      },
    });
    assert.equal(result.approvedSnapshot?.sections.chiefComplaint, APPROVED.sections.chiefComplaint);
  });
});

describe("resolvePtMedicalReportExportEligibility", () => {
  it("blocks export without Gate 1 approval", () => {
    const result = eligibility({ approvedFacts: null });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "gate1_required");
    assert.equal(result.message, PT_MEDICAL_REPORT_EXPORT_MESSAGES.gate1_required);
  });

  it("blocks export without a generated report draft", () => {
    const result = eligibility({ draft: null });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "draft_required");
    assert.equal(result.message, PT_MEDICAL_REPORT_EXPORT_MESSAGES.draft_required);
  });

  it("blocks export while the report remains a draft", () => {
    const result = eligibility({ approved: null, gate2ApprovedAt: null });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "approval_required");
    assert.equal(result.message, PT_MEDICAL_REPORT_EXPORT_MESSAGES.approval_required);
  });

  it("blocks export when Gate 2 approval was invalidated", () => {
    const result = eligibility({ approved: null, gate2ApprovedAt: null, draft: DRAFT });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "approval_required");
  });

  it("enables export only with a valid approved snapshot", () => {
    const result = eligibility();
    assert.equal(result.exportable, true);
    assert.deepEqual(result.approvedSnapshot, APPROVED);
  });

  it("uses ptMedicalReportApproved rather than draft sections for export", () => {
    const result = eligibility();
    assert.notEqual(result.approvedSnapshot?.sections.chiefComplaint, DRAFT.sections.chiefComplaint);
    assert.equal(result.approvedSnapshot?.sections.chiefComplaint, APPROVED.sections.chiefComplaint);
  });

  it("blocks export after post-approval draft edits (stale sourceDraftVersion)", () => {
    const result = eligibility({
      draft: { ...DRAFT, version: 2, sections: { chiefComplaint: "Edited after approval." } },
    });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "stale_approval");
  });

  it("blocks export after regeneration (stale sourceDraftVersion)", () => {
    const result = eligibility({
      draft: { ...DRAFT, version: 2, sections: APPROVED.sections },
    });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "stale_approval");
  });

  it("blocks export after Gate 1 re-approval (sourceFactsVersion mismatch)", () => {
    const result = eligibility({
      approvedFacts: { ...APPROVED_FACTS, version: 2, approvedAt: "2026-07-29T11:00:00.000Z" },
    });
    assert.equal(result.exportable, false);
    assert.equal(result.blockReason, "stale_approval");
  });
});

describe("getApprovedPrintSectionKeys", () => {
  it("omits empty report sections", () => {
    const keys = getApprovedPrintSectionKeys({
      ...APPROVED,
      sections: {
        chiefComplaint: "The patient reports shoulder pain.",
        painAndSymptoms: "   ",
      },
    });
    assert.deepEqual(keys, ["chiefComplaint"]);
  });

  it("keeps approved section ordering stable", () => {
    const keys = getApprovedPrintSectionKeys({
      ...APPROVED,
      sections: {
        patientGoals: "Return to work.",
        chiefComplaint: "Shoulder pain.",
        clinicalReviewNote: "Review required.",
      },
    });
    assert.deepEqual(keys, ["chiefComplaint", "patientGoals", "clinicalReviewNote"]);
    assert.deepEqual(
      keys,
      PT_MEDICAL_REPORT_PRINT_BODY_SECTION_KEYS.filter((key) =>
        ["chiefComplaint", "patientGoals", "clinicalReviewNote"].includes(key),
      ),
    );
  });
});

describe("shouldInvokeApprovedPtMedicalReportPrint", () => {
  it("returns true only for explicit approved export workflow", () => {
    assert.equal(shouldInvokeApprovedPtMedicalReportPrint(eligibility()), true);
    assert.equal(
      shouldInvokeApprovedPtMedicalReportPrint(eligibility({ approved: null, gate2ApprovedAt: null })),
      false,
    );
  });
});

describe("PT_MEDICAL_REPORT_PRINT_FOOTER", () => {
  it("includes required safety wording", () => {
    assert.match(PT_MEDICAL_REPORT_PRINT_FOOTER, /Clinician-reviewed patient-reported information/i);
    assert.match(PT_MEDICAL_REPORT_PRINT_FOOTER, /does not constitute an automated diagnosis/i);
  });
});
