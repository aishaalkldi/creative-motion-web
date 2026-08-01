/**
 * Client-side API helper for the RASQ Upper-Limb Motor Screen assignment
 * routes (clinician create + patient token read). Mirrors the fetch/error-
 * normalization style of remote-assessments.ts — no shared generic fetch
 * wrapper exists in this codebase.
 */

import type {
  AffectedArmSupportLevel,
  BackTrunkSupportLevel,
  CaregiverSupervisionRequirement,
  StartingSittingPosition,
  UpperLimbDeliveryMode,
  UpperLimbSide,
  ClinicianControlledConfiguration,
  UpperLimbTargetPlacement,
} from "@/app/lib/upper-limb-motor-screen/types";
import type { PatientMotorScreenAssignmentView } from "@/app/lib/upper-limb-motor-screen-api/request-validation";

/** Only screen definition currently supported by the clinician assignment UI. */
export const MOTOR_SCREEN_SCREEN_DEFINITION_ID = "rasq-upper-limb-motor-screen-v1";

export type ForwardReachAssignmentInput = {
  patientId: string;
  affectedSide: UpperLimbSide;
  configuration: ClinicianControlledConfiguration;
  forwardReachTaskGroup: {
    testedSide: UpperLimbSide;
    eligible: boolean;
    restPeriodSeconds: number;
    targetPlacement: UpperLimbTargetPlacement;
  };
};

export type CreatedForwardReachAssignment = {
  assignmentId: string;
  /** Raw patient-access token — returned only once, never persisted here. */
  patientAccessToken: string;
  expiresAt: string;
};

/** Generic, client-safe messages by HTTP status — never echoes server internals. */
async function readAssignmentErrorMessage(res: Response): Promise<string> {
  if (res.status === 400) {
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      if (body.error) {
        return body.detail ? `${body.error} (${body.detail})` : body.error;
      }
    } catch {
      /* ignore parse errors */
    }
    return "This assignment could not be created. Check the selected options and try again.";
  }
  if (res.status === 401) return "Your session has expired. Please sign in again.";
  if (res.status === 403) return "You do not have permission to assign this task.";
  if (res.status === 404) return "Patient not found.";
  if (res.status === 409) {
    return "This assignment could not be created due to a conflict. Please try again.";
  }
  if (res.status === 429) return "Too many requests. Please wait a moment and try again.";
  return "Something went wrong. Please try again.";
}

export async function createForwardReachAssignment(
  input: ForwardReachAssignmentInput,
): Promise<CreatedForwardReachAssignment> {
  let res: Response;
  try {
    res = await fetch("/api/clinician/upper-limb-motor-screen/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: input.patientId,
        screenDefinitionId: MOTOR_SCREEN_SCREEN_DEFINITION_ID,
        affectedSide: input.affectedSide,
        configuration: input.configuration,
        taskAssignmentGroups: [
          {
            taskId: "forwardReach",
            testedSide: input.forwardReachTaskGroup.testedSide,
            eligible: input.forwardReachTaskGroup.eligible,
            attempts: 1,
            restPeriodSeconds: input.forwardReachTaskGroup.restPeriodSeconds,
            targetPlacement: input.forwardReachTaskGroup.targetPlacement,
          },
        ],
      }),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    throw new Error(await readAssignmentErrorMessage(res));
  }

  return (await res.json()) as CreatedForwardReachAssignment;
}

/** Builds the patient-facing link client-side only — never persisted, never logged. */
export function buildMotorScreenPatientLink(patientAccessToken: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/patient/upper-limb-motor-screen/${patientAccessToken}`;
}

export type MotorScreenAssignmentFetchResult =
  | { ok: true; assignment: PatientMotorScreenAssignmentView }
  | { ok: false; kind: "invalid_or_expired" }
  | { ok: false; kind: "server_error" };

/**
 * Patient-side token read. Deliberately collapses every non-2xx/404 failure
 * into a single generic "server_error" bucket, and 404 into "invalid_or_expired"
 * — matching the API's own unified invalid-link response so this helper never
 * distinguishes "token never existed" from "token expired" either.
 */
export async function getForwardReachAssignmentByToken(
  token: string,
): Promise<MotorScreenAssignmentFetchResult> {
  let res: Response;
  try {
    res = await fetch(
      `/api/patient/upper-limb-motor-screen/assignments/${encodeURIComponent(token)}`,
    );
  } catch {
    return { ok: false, kind: "server_error" };
  }

  if (res.status === 404) {
    return { ok: false, kind: "invalid_or_expired" };
  }
  if (!res.ok) {
    return { ok: false, kind: "server_error" };
  }

  try {
    const assignment = (await res.json()) as PatientMotorScreenAssignmentView;
    return { ok: true, assignment };
  } catch {
    return { ok: false, kind: "server_error" };
  }
}

export const UPPER_LIMB_DELIVERY_MODE_LABELS: Record<UpperLimbDeliveryMode, string> = {
  in_clinic: "In clinic",
  remote_supervised: "Remote, clinician supervised",
};

export const UPPER_LIMB_SIDE_LABELS: Record<UpperLimbSide, string> = {
  left: "Left",
  right: "Right",
};

export const STARTING_SITTING_POSITION_LABELS: Record<StartingSittingPosition, string> = {
  edge_of_bed: "Edge of bed",
  chair_with_armrests: "Chair with armrests",
  chair_without_armrests: "Chair without armrests",
  wheelchair: "Wheelchair",
};

export const BACK_TRUNK_SUPPORT_LABELS: Record<BackTrunkSupportLevel, string> = {
  full_back_support: "Full back support",
  partial_back_support: "Partial back support",
  none: "None",
};

export const AFFECTED_ARM_SUPPORT_LABELS: Record<AffectedArmSupportLevel, string> = {
  armrest: "Armrest",
  lap_support: "Lap support",
  sling: "Sling",
  none: "None",
};

export const CAREGIVER_SUPERVISION_LABELS: Record<CaregiverSupervisionRequirement, string> = {
  required: "Required",
  not_required: "Not required",
};
