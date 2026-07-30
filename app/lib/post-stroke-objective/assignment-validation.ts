/**
 * Server-side validation for Post-Stroke Objective 5×STS assignment.
 *
 * @see POST_STROKE_OBJECTIVE_PHASE1_ASSIGNMENT_INVARIANT in types.ts
 */

import {
  readPtMedicalReportApproved,
  readPtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import { readApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  FIVE_TIMES_STS_TARGET_REPETITIONS,
  isActiveFiveTimesStsAssignmentStatus,
  isValidFiveTimesStsDeliveryMode,
  isValidFiveTimesStsProtocol,
  readFiveTimesStsAssignment,
  type FiveTimesStsAssignment,
  type FiveTimesStsDeliveryMode,
  type FiveTimesStsProtocol,
  type ObjectiveAssignmentClientRequest,
} from "@/app/lib/post-stroke-objective/types";

export type Gate2ValidationFailure =
  | "gate1_required"
  | "draft_required"
  | "gate2_required"
  | "stale_gate2";

export type Gate2ValidationResult =
  | { ok: true }
  | { ok: false; reason: Gate2ValidationFailure };

export type AssignmentRequestValidationFailure =
  | Gate2ValidationFailure
  | "invalid_protocol"
  | "invalid_delivery_mode"
  | "supervision_confirmation_required"
  | "supervision_confirmation_not_applicable"
  | "active_assignment_conflict";

export type AssignmentRequestValidationResult =
  | {
      ok: true;
      protocol: FiveTimesStsProtocol;
      deliveryMode: FiveTimesStsDeliveryMode;
      supervisionConfirmed: boolean;
    }
  | { ok: false; reason: AssignmentRequestValidationFailure };

export function readGate2ApprovedAt(structuredData: unknown): string | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const raw = (structuredData as Record<string, unknown>).gate2ApprovedAt;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Mirrors export eligibility version checks — timestamp alone is insufficient. */
export function validateCurrentGate2Approval(structuredData: unknown): Gate2ValidationResult {
  const approvedFacts = readApprovedPatientReportFacts(structuredData);
  if (!approvedFacts) {
    return { ok: false, reason: "gate1_required" };
  }

  const draft = readPtMedicalReportDraft(structuredData);
  if (!draft) {
    return { ok: false, reason: "draft_required" };
  }

  const approved = readPtMedicalReportApproved(structuredData);
  const gate2ApprovedAt = readGate2ApprovedAt(structuredData);
  if (!approved || !gate2ApprovedAt) {
    return { ok: false, reason: "gate2_required" };
  }

  if (
    approved.sourceDraftVersion !== draft.version ||
    draft.sourceFactsVersion !== approvedFacts.version
  ) {
    return { ok: false, reason: "stale_gate2" };
  }

  return { ok: true };
}

export function isGate2ValidForObjectiveAssignment(structuredData: unknown): boolean {
  return validateCurrentGate2Approval(structuredData).ok;
}

const REJECTED_DELIVERY_MODES = new Set([
  "remote_self",
  "remote",
  "self",
]);

export function validateObjectiveAssignmentRequest(
  structuredData: unknown,
  body: ObjectiveAssignmentClientRequest,
  existingAssignment: FiveTimesStsAssignment | null,
): AssignmentRequestValidationResult {
  const gate2 = validateCurrentGate2Approval(structuredData);
  if (!gate2.ok) {
    return gate2;
  }

  if (!isValidFiveTimesStsProtocol(body.protocol)) {
    return { ok: false, reason: "invalid_protocol" };
  }

  const deliveryRaw = body.deliveryMode;
  if (
    typeof deliveryRaw !== "string" ||
    REJECTED_DELIVERY_MODES.has(deliveryRaw) ||
    !isValidFiveTimesStsDeliveryMode(deliveryRaw)
  ) {
    return { ok: false, reason: "invalid_delivery_mode" };
  }

  const deliveryMode = deliveryRaw;
  const supervisionConfirmed = body.supervisionConfirmed === true;

  if (deliveryMode === "remote_supervised" && !supervisionConfirmed) {
    return { ok: false, reason: "supervision_confirmation_required" };
  }

  if (deliveryMode === "in_clinic" && body.supervisionConfirmed === true) {
    return { ok: false, reason: "supervision_confirmation_not_applicable" };
  }

  if (
    existingAssignment &&
    isActiveFiveTimesStsAssignmentStatus(existingAssignment.status)
  ) {
    const sameRequest =
      existingAssignment.protocol === body.protocol &&
      existingAssignment.deliveryMode === deliveryMode &&
      Boolean(existingAssignment.supervisionConfirmed) === supervisionConfirmed;

    if (!sameRequest) {
      return { ok: false, reason: "active_assignment_conflict" };
    }
  }

  return {
    ok: true,
    protocol: body.protocol,
    deliveryMode,
    supervisionConfirmed,
  };
}

export function buildFiveTimesStsAssignmentRecord(input: {
  assignmentId: string;
  protocol: FiveTimesStsProtocol;
  deliveryMode: FiveTimesStsDeliveryMode;
  assignedAt: string;
  assignedBy: string;
  supervisionConfirmed: boolean;
}): FiveTimesStsAssignment {
  const assignment: FiveTimesStsAssignment = {
    id: input.assignmentId,
    assessmentType: "five_times_sit_to_stand",
    protocol: input.protocol,
    deliveryMode: input.deliveryMode,
    status: "assigned",
    targetRepetitions: FIVE_TIMES_STS_TARGET_REPETITIONS,
    assignedAt: input.assignedAt,
    assignedBy: input.assignedBy,
  };

  if (input.deliveryMode === "remote_supervised") {
    assignment.supervisionConfirmed = true;
  }

  return assignment;
}

/** Ensures persisted objective payload contains no forbidden clinical verdict fields. */
export function assertObjectiveAssignmentPayloadSafe(
  objectiveAssessment: Record<string, unknown>,
): boolean {
  const serialized = JSON.stringify(objectiveAssessment).toLowerCase();
  const forbidden = [
    "diagnosis",
    "severity",
    "fall_risk",
    "fall-risk",
    "exercise_clearance",
    "treatment_recommendation",
    "remote_self",
    "eligible",
    "ineligible",
    "safe_for",
    "unsafe",
  ];
  return !forbidden.some((term) => serialized.includes(term));
}

export function mergeObjectiveAssignmentIntoStructuredData(
  structuredData: Record<string, unknown>,
  assignment: FiveTimesStsAssignment,
): Record<string, unknown> {
  const postStrokeIntake = structuredData.postStrokeIntake;
  const intakeRecord =
    typeof postStrokeIntake === "object" &&
    postStrokeIntake !== null &&
    !Array.isArray(postStrokeIntake)
      ? { ...(postStrokeIntake as Record<string, unknown>) }
      : {};

  const existingObjective = intakeRecord.objectiveAssessment;
  const objectiveRecord =
    typeof existingObjective === "object" &&
    existingObjective !== null &&
    !Array.isArray(existingObjective)
      ? { ...(existingObjective as Record<string, unknown>) }
      : {};

  return {
    ...structuredData,
    postStrokeIntake: {
      ...intakeRecord,
      objectiveAssessment: {
        ...objectiveRecord,
        assignment,
      },
    },
  };
}
