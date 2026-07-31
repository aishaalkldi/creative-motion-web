/**
 * HTTP-boundary validation for Upper-Limb Motor Screen assignment APIs.
 * Reuses Motor Screen library safety rules without modifying the library.
 */

import { validateUpperLimbMotorScreenAssignment } from "@/app/lib/upper-limb-motor-screen/assignment-validation";
import {
  findForbiddenSafetyVocabularyKeys,
  isRecord,
  isValidUpperLimbSide,
  type UpperLimbMotorScreenAssignment,
} from "@/app/lib/upper-limb-motor-screen/types";

/** Keys permitted on clinician POST body — server fields are excluded. */
export const CLINICIAN_ASSIGNMENT_REQUEST_KEYS = new Set([
  "patientId",
  "screenDefinitionId",
  "affectedSide",
  "configuration",
  "taskAssignmentGroups",
]);

/** Server-controlled assignment fields that must not be client-supplied. */
export const SERVER_CONTROLLED_ASSIGNMENT_KEYS = new Set([
  "id",
  "assignedBy",
  "assignedAt",
  "status",
  "assignmentId",
  "token",
  "tokenHash",
  "patientAccessToken",
  "expiresAt",
  "tokenExpiresAt",
]);

/** Raw capture / trajectory keys rejected at the HTTP boundary. */
export const FORBIDDEN_RAW_CAPTURE_KEYS = new Set([
  "video",
  "image",
  "frame",
  "frames",
  "blob",
  "landmarks",
  "landmark",
  "poselandmarks",
  "rawlandmarks",
  "bodycoordinates",
  "coordinates",
  "trajectory",
  "trajectories",
  "wristtrajectory",
  "rawmotion",
  "motiontimeline",
  "motionsnapshots",
  "snapshots",
  "timeline",
  "rawframes",
]);

export type RequestValidationFailure = {
  ok: false;
  error: string;
  detail?: string;
};

export type RequestValidationSuccess = {
  ok: true;
  patientId: string;
  screenDefinitionId: string;
};

export type RequestValidationResult = RequestValidationSuccess | RequestValidationFailure;

export type StoredAssignmentMvpValidationResult =
  | { ok: true; assignment: UpperLimbMotorScreenAssignment }
  | { ok: false };

function requireNonEmptyTrimmedString(
  value: unknown,
  fieldName: string,
): { ok: true; value: string } | RequestValidationFailure {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} is required and must be a string.`,
    };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${fieldName} is required.` };
  }
  return { ok: true, value: trimmed };
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

export function findForbiddenRawCaptureKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenRawCaptureKeys(item, `${path}[${index}]`),
    );
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, val]) => {
    const keyPath = path ? `${path}.${key}` : key;
    const hit = FORBIDDEN_RAW_CAPTURE_KEYS.has(normalizeKey(key)) ? [keyPath] : [];
    return [...hit, ...findForbiddenRawCaptureKeys(val, keyPath)];
  });
}

export function findUnknownTopLevelKeys(
  body: Record<string, unknown>,
  allowed: Set<string>,
): string[] {
  return Object.keys(body).filter((key) => !allowed.has(key));
}

export function findServerControlledKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findServerControlledKeys(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, val]) => {
    const keyPath = path ? `${path}.${key}` : key;
    const hit = SERVER_CONTROLLED_ASSIGNMENT_KEYS.has(key) ? [keyPath] : [];
    return [...hit, ...findServerControlledKeys(val, keyPath)];
  });
}

export function validateClinicianAssignmentRequestBody(body: unknown): RequestValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Invalid request body." };
  }

  const unknownKeys = findUnknownTopLevelKeys(body, CLINICIAN_ASSIGNMENT_REQUEST_KEYS);
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: "Unknown request fields are not allowed.",
      detail: unknownKeys.join(", "),
    };
  }

  const spoofed = findServerControlledKeys(body);
  if (spoofed.length > 0) {
    return {
      ok: false,
      error: "Server-controlled fields must not be supplied by the client.",
      detail: spoofed.join(", "),
    };
  }

  const rawKeys = findForbiddenRawCaptureKeys(body);
  if (rawKeys.length > 0) {
    return {
      ok: false,
      error: "Raw capture data is not allowed in assignment requests.",
      detail: rawKeys.join(", "),
    };
  }

  const safetyKeys = findForbiddenSafetyVocabularyKeys(body);
  if (safetyKeys.length > 0) {
    return {
      ok: false,
      error: "Forbidden clinical or automated-interpretation fields are not allowed.",
      detail: safetyKeys.join(", "),
    };
  }

  const patientIdResult = requireNonEmptyTrimmedString(body.patientId, "patientId");
  if (!patientIdResult.ok) return patientIdResult;

  const screenDefinitionIdResult = requireNonEmptyTrimmedString(
    body.screenDefinitionId,
    "screenDefinitionId",
  );
  if (!screenDefinitionIdResult.ok) return screenDefinitionIdResult;

  if (!isValidUpperLimbSide(body.affectedSide)) {
    return { ok: false, error: "affectedSide is required and must be 'left' or 'right'." };
  }

  if (!Array.isArray(body.taskAssignmentGroups)) {
    return { ok: false, error: "taskAssignmentGroups is required." };
  }

  if (body.taskAssignmentGroups.length !== 1) {
    return {
      ok: false,
      error: "Exactly one task assignment group is supported in this endpoint.",
    };
  }

  const group = body.taskAssignmentGroups[0];
  if (!isRecord(group)) {
    return { ok: false, error: "taskAssignmentGroups[0] must be an object." };
  }

  if (group.taskId !== "forwardReach") {
    return {
      ok: false,
      error: "Only forwardReach is supported in this endpoint.",
      detail: typeof group.taskId === "string" ? group.taskId : undefined,
    };
  }

  if (!isValidUpperLimbSide(group.testedSide)) {
    return {
      ok: false,
      error: "testedSide is required and must be 'left' or 'right'.",
    };
  }

  if (group.attempts !== 1) {
    return {
      ok: false,
      error: "Exactly one attempt is supported in this endpoint.",
    };
  }

  if (!isRecord(body.configuration)) {
    return { ok: false, error: "configuration is required." };
  }

  const deliveryMode = body.configuration.deliveryMode;
  if (deliveryMode !== "in_clinic" && deliveryMode !== "remote_supervised") {
    return {
      ok: false,
      error: "deliveryMode is required and must be in_clinic or remote_supervised.",
    };
  }

  return {
    ok: true,
    patientId: patientIdResult.value,
    screenDefinitionId: screenDefinitionIdResult.value,
  };
}

/**
 * Validates a stored assignment against the general domain contract and the
 * current Forward Reach MVP scope. Used on patient token read — does not
 * require request-only fields such as patientId.
 */
export function validateStoredMotorScreenAssignmentMvp(
  candidate: unknown,
): StoredAssignmentMvpValidationResult {
  const domain = validateUpperLimbMotorScreenAssignment(candidate);
  if (!domain.ok) return { ok: false };

  const assignment = domain.assignment;

  if (!isValidUpperLimbSide(assignment.affectedSide)) return { ok: false };

  if (assignment.taskAssignmentGroups.length !== 1) return { ok: false };

  const group = assignment.taskAssignmentGroups[0];
  if (group.taskId !== "forwardReach") return { ok: false };
  if (!isValidUpperLimbSide(group.testedSide)) return { ok: false };
  if (group.attempts !== 1) return { ok: false };

  const { deliveryMode } = assignment.configuration;
  if (deliveryMode !== "in_clinic" && deliveryMode !== "remote_supervised") {
    return { ok: false };
  }

  return { ok: true, assignment };
}

/** Patient-facing assignment view — excludes internal/provider fields. */
export type PatientMotorScreenAssignmentView = {
  assignmentId: string;
  screenDefinitionId: string;
  status: UpperLimbMotorScreenAssignment["status"];
  affectedSide: UpperLimbMotorScreenAssignment["affectedSide"];
  deliveryMode: UpperLimbMotorScreenAssignment["configuration"]["deliveryMode"];
  configuration: Omit<UpperLimbMotorScreenAssignment["configuration"], never>;
  taskAssignmentGroups: UpperLimbMotorScreenAssignment["taskAssignmentGroups"];
  expiresAt: string;
};

export function toPatientAssignmentView(input: {
  assignment: UpperLimbMotorScreenAssignment;
  expiresAt: string;
}): PatientMotorScreenAssignmentView {
  const { assignment, expiresAt } = input;
  return {
    assignmentId: assignment.id,
    screenDefinitionId: assignment.screenDefinitionId,
    status: assignment.status,
    affectedSide: assignment.affectedSide,
    deliveryMode: assignment.configuration.deliveryMode,
    configuration: assignment.configuration,
    taskAssignmentGroups: assignment.taskAssignmentGroups,
    expiresAt,
  };
}
