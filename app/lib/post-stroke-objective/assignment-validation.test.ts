/**
 * Run: npx tsx --test app/lib/post-stroke-objective/assignment-validation.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import type {
  PtMedicalReportApproved,
  PtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import {
  assertObjectiveAssignmentPayloadSafe,
  buildFiveTimesStsAssignmentRecord,
  mergeObjectiveAssignmentIntoStructuredData,
  validateCurrentGate2Approval,
  validateObjectiveAssignmentRequest,
} from "@/app/lib/post-stroke-objective/assignment-validation";
import { readFiveTimesStsAssignment } from "@/app/lib/post-stroke-objective/types";

const FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-30T10:00:00.000Z",
  facts: { chiefComplaint: "Patient-reported summary." },
};

const DRAFT: PtMedicalReportDraft = {
  status: "draft",
  version: 1,
  generatedAt: "2026-07-30T10:05:00.000Z",
  sourceFactsVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

const APPROVED: PtMedicalReportApproved = {
  version: 1,
  approvedAt: "2026-07-30T10:10:00.000Z",
  sourceDraftVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

function gate2ReadyStructuredData(overrides: Record<string, unknown> = {}) {
  return {
    approvedPatientReportFacts: FACTS,
    ptMedicalReportDraft: DRAFT,
    ptMedicalReportApproved: APPROVED,
    gate2ApprovedAt: "2026-07-30T10:10:00.000Z",
    postStrokeIntake: {
      respondent: { type: "patient" },
      functionalIntake: { functionalGoal: "Walk safely" },
    },
    ...overrides,
  };
}

describe("validateCurrentGate2Approval", () => {
  it("accepts current Gate 2 approval with matching versions", () => {
    assert.equal(validateCurrentGate2Approval(gate2ReadyStructuredData()).ok, true);
  });

  it("rejects stale Gate 2 when draft version drifts", () => {
    const data = gate2ReadyStructuredData({
      ptMedicalReportDraft: { ...DRAFT, version: 2 },
    });
    const result = validateCurrentGate2Approval(data);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "stale_gate2");
  });

  it("rejects missing ptMedicalReportApproved", () => {
    const data = gate2ReadyStructuredData();
    delete (data as Record<string, unknown>).ptMedicalReportApproved;
    const result = validateCurrentGate2Approval(data);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "gate2_required");
  });
});

describe("validateObjectiveAssignmentRequest", () => {
  it("accepts standard_5xsts with remote_supervised when supervision is confirmed", () => {
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "standard_5xsts",
        deliveryMode: "remote_supervised",
        supervisionConfirmed: true,
      },
      null,
    );
    assert.equal(result.ok, true);
  });

  it("accepts modified protocol for in_clinic", () => {
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      },
      null,
    );
    assert.equal(result.ok, true);
  });

  it("rejects remote_supervised without supervision confirmation", () => {
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "standard_5xsts",
        deliveryMode: "remote_supervised",
        supervisionConfirmed: false,
      },
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "supervision_confirmation_required");
  });

  it("rejects remote_self", () => {
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "standard_5xsts",
        deliveryMode: "remote_self",
      },
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_delivery_mode");
  });

  it("rejects unknown delivery modes", () => {
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "standard_5xsts",
        deliveryMode: "teleport",
      },
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_delivery_mode");
  });

  it("rejects a second active assignment with different protocol", () => {
    const existing = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-1",
      protocol: "standard_5xsts",
      deliveryMode: "in_clinic",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: false,
    });
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      },
      existing,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "active_assignment_conflict");
  });

  it("rejects parameter changes when an assignment is completed", () => {
    const completed = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-completed",
      protocol: "standard_5xsts",
      deliveryMode: "in_clinic",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: false,
    });
    completed.status = "completed";
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      },
      completed,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "active_assignment_conflict");
  });

  it("allows replacement after a cancelled assignment", () => {
    const cancelled = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-cancelled",
      protocol: "standard_5xsts",
      deliveryMode: "in_clinic",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: false,
    });
    cancelled.status = "cancelled";
    const result = validateObjectiveAssignmentRequest(
      gate2ReadyStructuredData(),
      {
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      },
      cancelled,
    );
    assert.equal(result.ok, true);
  });
});

describe("assignment persistence helpers", () => {
  it("generates server-side assignment with target repetitions 5", () => {
    const assignment = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-1",
      protocol: "standard_5xsts",
      deliveryMode: "remote_supervised",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: true,
    });
    assert.equal(assignment.targetRepetitions, 5);
    assert.equal(assignment.supervisionConfirmed, true);
  });

  it("preserves existing post-stroke structured data when merging assignment", () => {
    const base = gate2ReadyStructuredData();
    const assignment = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-1",
      protocol: "standard_5xsts",
      deliveryMode: "in_clinic",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: false,
    });
    const merged = mergeObjectiveAssignmentIntoStructuredData(base, assignment);
    assert.equal(readFiveTimesStsAssignment(merged)?.id, "uuid-1");
    assert.deepEqual(
      (merged.postStrokeIntake as Record<string, unknown>).functionalIntake,
      { functionalGoal: "Walk safely" },
    );
    assert.deepEqual(merged.approvedPatientReportFacts, FACTS);
    assert.deepEqual(merged.ptMedicalReportApproved, APPROVED);
  });

  it("does not persist forbidden clinical verdict fields in assignment payload", () => {
    const assignment = buildFiveTimesStsAssignmentRecord({
      assignmentId: "uuid-1",
      protocol: "standard_5xsts",
      deliveryMode: "in_clinic",
      assignedAt: "2026-07-30T12:00:00.000Z",
      assignedBy: "provider-1",
      supervisionConfirmed: false,
    });
    const merged = mergeObjectiveAssignmentIntoStructuredData(gate2ReadyStructuredData(), assignment);
    const objective = (merged.postStrokeIntake as Record<string, unknown>)
      .objectiveAssessment as Record<string, unknown>;
    assert.equal(assertObjectiveAssignmentPayloadSafe(objective), true);
    assert.equal("result" in objective, false);
  });
});
