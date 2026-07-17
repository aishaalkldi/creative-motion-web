/**
 * Run: npx tsx --test app/lib/ai/clinician-summary-persistence.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAiClinicianSummaryDraftInsert,
  buildApproveUpdatePatch,
  filterProviderOwnedApprovedSummaries,
  parseAiSessionSummaryGetParams,
  parseApproveSummaryRequestBody,
  pickLatestApprovedSummary,
  resolveApprovedSummaryText,
  validateApproveUpdateImmutability,
  validateSummaryApprovalAccess,
  validateSummaryProviderAccess,
} from "./clinician-summary-persistence";
import type { AiClinicianSummariesRow } from "@/app/lib/supabase/database.types";

const snapshot = {
  sessionsCompleted: 2,
  totalSessions: 4,
  cvSessionCount: 1,
  assessmentIncluded: false,
};

const baseRow: AiClinicianSummariesRow = {
  id: "summary-1",
  provider_id: "provider-a",
  patient_id: "patient-1",
  plan_id: "plan-1",
  draft_text: "Draft summary text.",
  approved_text: null,
  inputs_snapshot: snapshot,
  schema_version: "ai-clinician-summary-v2",
  status: "draft",
  created_at: "2026-07-17T12:00:00.000Z",
  approved_at: null,
  approved_by: null,
};

const approvedRow: AiClinicianSummariesRow = {
  ...baseRow,
  status: "approved",
  approved_text: "Approved summary text.",
  approved_at: "2026-07-17T13:00:00.000Z",
  approved_by: "provider-a",
};

describe("buildAiClinicianSummaryDraftInsert", () => {
  it("builds a draft row for persistence", () => {
    const row = buildAiClinicianSummaryDraftInsert({
      providerId: "provider-a",
      patientId: "patient-1",
      planId: "plan-1",
      draftText: "  Draft summary text.  ",
      inputsSnapshot: snapshot,
      schemaVersion: "ai-clinician-summary-v2",
    });

    assert.equal(row.provider_id, "provider-a");
    assert.equal(row.patient_id, "patient-1");
    assert.equal(row.plan_id, "plan-1");
    assert.equal(row.draft_text, "Draft summary text.");
    assert.equal(row.status, "draft");
  });
});

describe("parseAiSessionSummaryGetParams", () => {
  it("requires patientId", () => {
    assert.deepEqual(parseAiSessionSummaryGetParams(new URLSearchParams()), { ok: false });
  });

  it("accepts patientId and optional planId", () => {
    assert.deepEqual(
      parseAiSessionSummaryGetParams(new URLSearchParams({ patientId: "patient-1" })),
      { ok: true, patientId: "patient-1", planId: null },
    );
    assert.deepEqual(
      parseAiSessionSummaryGetParams(
        new URLSearchParams({ patientId: "patient-1", planId: "plan-9" }),
      ),
      { ok: true, patientId: "patient-1", planId: "plan-9" },
    );
  });
});

describe("parseApproveSummaryRequestBody", () => {
  it("requires summaryId", () => {
    assert.deepEqual(parseApproveSummaryRequestBody({}), { ok: false });
  });
});

describe("validateSummaryProviderAccess", () => {
  it("rejects cross-provider rows", () => {
    assert.equal(validateSummaryProviderAccess(baseRow, "provider-b"), false);
    assert.equal(validateSummaryProviderAccess(null, "provider-a"), false);
    assert.equal(validateSummaryProviderAccess(baseRow, "provider-a"), true);
  });
});

describe("validateSummaryApprovalAccess", () => {
  it("rejects missing or cross-provider rows", () => {
    assert.deepEqual(validateSummaryApprovalAccess(null, "provider-a"), {
      ok: false,
      httpStatus: 404,
      message: "Summary not found.",
    });
    assert.deepEqual(validateSummaryApprovalAccess(baseRow, "provider-b"), {
      ok: false,
      httpStatus: 404,
      message: "Summary not found.",
    });
  });

  it("rejects already approved summaries (second approval conflict)", () => {
    assert.deepEqual(validateSummaryApprovalAccess(approvedRow, "provider-a"), {
      ok: false,
      httpStatus: 409,
      message: "Only draft summaries can be approved.",
    });
  });

  it("allows draft rows owned by the provider (draft → approved once)", () => {
    assert.deepEqual(validateSummaryApprovalAccess(baseRow, "provider-a"), {
      ok: true,
      row: baseRow,
    });
  });
});

describe("validateApproveUpdateImmutability", () => {
  it("blocks edits to approved rows", () => {
    const patch = buildApproveUpdatePatch({
      approvedText: "New text",
      approvedAt: "2026-07-17T14:00:00.000Z",
      approvedBy: "provider-a",
    });
    assert.deepEqual(validateApproveUpdateImmutability(approvedRow, patch), {
      ok: false,
      message: "Approved rows cannot be edited.",
    });
  });

  it("allows approval patch on draft rows", () => {
    const patch = buildApproveUpdatePatch({
      approvedText: "Approved copy",
      approvedAt: "2026-07-17T14:00:00.000Z",
      approvedBy: "provider-a",
    });
    assert.deepEqual(validateApproveUpdateImmutability(baseRow, patch), { ok: true });
  });
});

describe("resolveApprovedSummaryText", () => {
  it("uses approvedText when provided", () => {
    assert.equal(
      resolveApprovedSummaryText(baseRow, "Edited approval text"),
      "Edited approval text",
    );
  });
});

describe("filterProviderOwnedApprovedSummaries", () => {
  it("returns only provider-owned approved rows for the patient/plan scope", () => {
    const otherProvider = { ...approvedRow, id: "summary-2", provider_id: "provider-b" };
    const otherPatient = {
      ...approvedRow,
      id: "summary-3",
      patient_id: "patient-9",
    };
    const otherPlan = { ...approvedRow, id: "summary-4", plan_id: "plan-9" };
    const draftRow = { ...baseRow, id: "summary-5" };

    const filtered = filterProviderOwnedApprovedSummaries(
      [approvedRow, otherProvider, otherPatient, otherPlan, draftRow],
      { providerId: "provider-a", patientId: "patient-1", planId: "plan-1" },
    );

    assert.deepEqual(filtered.map((row) => row.id), ["summary-1"]);
  });

  it("excludes cross-provider approved rows from hydration candidates", () => {
    const crossProvider = { ...approvedRow, id: "summary-x", provider_id: "provider-b" };
    const filtered = filterProviderOwnedApprovedSummaries([crossProvider], {
      providerId: "provider-a",
      patientId: "patient-1",
      planId: "plan-1",
    });
    assert.deepEqual(filtered, []);
  });
});

describe("pickLatestApprovedSummary", () => {
  it("picks the newest approved summary for hydration", () => {
    const older = {
      ...approvedRow,
      id: "summary-old",
      approved_at: "2026-07-17T10:00:00.000Z",
    };
    const newer = {
      ...approvedRow,
      id: "summary-new",
      approved_at: "2026-07-17T15:00:00.000Z",
    };

    const picked = pickLatestApprovedSummary([older, newer], {
      providerId: "provider-a",
      patientId: "patient-1",
      planId: "plan-1",
    });

    assert.equal(picked?.id, "summary-new");
  });
});
