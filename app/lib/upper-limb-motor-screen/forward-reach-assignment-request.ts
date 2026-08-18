/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Builds the POST /api/upper-limb-motor-screen/assignments request body
 * for the first Forward Reach vertical slice from explicit clinician
 * setup-form input. No clinical value is ever fabricated or defaulted —
 * every field the assignment domain requires (assignment-validation.ts,
 * unchanged) must be present in the form before a request body is built.
 * Full shape/enum validation still happens server-side, unchanged; this
 * builder only checks presence so the "Start" action cannot fire with a
 * silently-invented value.
 *
 * Fixed for this slice only (not collected from the clinician):
 * deliveryMode, taskId, attempts, restPeriodSeconds, eligible,
 * screenDefinitionId. Engine geometry/timing config (ForwardReachConfig)
 * is never part of this payload — it stays local to the runtime shell.
 */

import type {
  AffectedArmSupportLevel,
  BackTrunkSupportLevel,
  CaregiverSupervisionRequirement,
  StartingSittingPosition,
  UpperLimbPermittedMovementRange,
  UpperLimbSide,
} from "./types";

export const FORWARD_REACH_SCREEN_DEFINITION_ID = "upper-limb-forward-reach-v1" as const;

export type ForwardReachSetupFormState = {
  affectedSide: UpperLimbSide | null;
  /** Kept independent of affectedSide — drives engine landmark selection only. */
  testedSide: UpperLimbSide | null;
  startingSittingPosition: StartingSittingPosition | null;
  backTrunkSupport: BackTrunkSupportLevel | null;
  affectedArmSupport: AffectedArmSupportLevel | null;
  baselinePainScore: number | null;
  permittedMovementRange: UpperLimbPermittedMovementRange | null;
  caregiverSupervisionRequirement: CaregiverSupervisionRequirement | null;
  /** Explicit array, may be empty — emptiness must be an explicit clinician choice. */
  patientSpecificStopCriteria: string[];
  targetDirection: string;
  targetHeight: string;
  targetDistance: string;
};

export const EMPTY_FORWARD_REACH_SETUP_FORM: ForwardReachSetupFormState = {
  affectedSide: null,
  testedSide: null,
  startingSittingPosition: null,
  backTrunkSupport: null,
  affectedArmSupport: null,
  baselinePainScore: null,
  permittedMovementRange: null,
  caregiverSupervisionRequirement: null,
  patientSpecificStopCriteria: [],
  targetDirection: "",
  targetHeight: "",
  targetDistance: "",
};

export type ForwardReachAssignmentRequestBody = {
  patientId: string;
  screenDefinitionId: typeof FORWARD_REACH_SCREEN_DEFINITION_ID;
  affectedSide: UpperLimbSide;
  configuration: {
    startingSittingPosition: StartingSittingPosition;
    backTrunkSupport: BackTrunkSupportLevel;
    affectedArmSupport: AffectedArmSupportLevel;
    baselinePainScore: number;
    permittedMovementRange: UpperLimbPermittedMovementRange;
    caregiverSupervisionRequirement: CaregiverSupervisionRequirement;
    deliveryMode: "in_clinic";
    patientSpecificStopCriteria: string[];
  };
  taskAssignmentGroups: [
    {
      taskId: "forwardReach";
      testedSide: UpperLimbSide;
      eligible: true;
      attempts: 1;
      restPeriodSeconds: 0;
      targetPlacement: { direction: string; height: string; distance: string };
    },
  ];
};

export type ForwardReachAssignmentRequestMissingField =
  | "patientId"
  | "affectedSide"
  | "testedSide"
  | "startingSittingPosition"
  | "backTrunkSupport"
  | "affectedArmSupport"
  | "baselinePainScore"
  | "permittedMovementRange"
  | "caregiverSupervisionRequirement"
  | "targetDirection"
  | "targetHeight"
  | "targetDistance";

export type ForwardReachAssignmentRequestResult =
  | { ok: true; body: ForwardReachAssignmentRequestBody }
  | { ok: false; missing: ForwardReachAssignmentRequestMissingField[] };

export function buildForwardReachAssignmentRequest(
  patientId: string,
  form: ForwardReachSetupFormState,
): ForwardReachAssignmentRequestResult {
  const missing: ForwardReachAssignmentRequestMissingField[] = [];

  if (!patientId.trim()) missing.push("patientId");
  if (!form.affectedSide) missing.push("affectedSide");
  if (!form.testedSide) missing.push("testedSide");
  if (!form.startingSittingPosition) missing.push("startingSittingPosition");
  if (!form.backTrunkSupport) missing.push("backTrunkSupport");
  if (!form.affectedArmSupport) missing.push("affectedArmSupport");
  if (form.baselinePainScore === null) missing.push("baselinePainScore");
  if (!form.permittedMovementRange) missing.push("permittedMovementRange");
  if (!form.caregiverSupervisionRequirement) missing.push("caregiverSupervisionRequirement");
  if (!form.targetDirection.trim()) missing.push("targetDirection");
  if (!form.targetHeight.trim()) missing.push("targetHeight");
  if (!form.targetDistance.trim()) missing.push("targetDistance");

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    body: {
      patientId,
      screenDefinitionId: FORWARD_REACH_SCREEN_DEFINITION_ID,
      affectedSide: form.affectedSide as UpperLimbSide,
      configuration: {
        startingSittingPosition: form.startingSittingPosition as StartingSittingPosition,
        backTrunkSupport: form.backTrunkSupport as BackTrunkSupportLevel,
        affectedArmSupport: form.affectedArmSupport as AffectedArmSupportLevel,
        baselinePainScore: form.baselinePainScore as number,
        permittedMovementRange: form.permittedMovementRange as UpperLimbPermittedMovementRange,
        caregiverSupervisionRequirement:
          form.caregiverSupervisionRequirement as CaregiverSupervisionRequirement,
        deliveryMode: "in_clinic",
        patientSpecificStopCriteria: form.patientSpecificStopCriteria,
      },
      taskAssignmentGroups: [
        {
          taskId: "forwardReach",
          testedSide: form.testedSide as UpperLimbSide,
          eligible: true,
          attempts: 1,
          restPeriodSeconds: 0,
          targetPlacement: {
            direction: form.targetDirection,
            height: form.targetHeight,
            distance: form.targetDistance,
          },
        },
      ],
    },
  };
}
