/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Pure orchestration for the patient-linked runtime's on-mount "find
 * the latest assignment, then its latest session result" read. Kept
 * separate from the React effect so it can be tested with injected
 * fakes (no DOM, no real fetch) — the component wraps this in a plain
 * per-invocation `cancelled` flag and turns the result into state
 * updates; it deliberately does NOT wrap this in a single-flight guard
 * (see ForwardReachMotorScreenSession.tsx for why that combination is
 * unsafe under React StrictMode's mount→cleanup→remount replay).
 *
 * Read-only: never creates an assignment or a session result.
 */

import type { UpperLimbClientResult } from "@/app/lib/api/upper-limb-motor-screen-client";
import type { UpperLimbMotorScreenAssignmentPublic } from "./assignment-persistence";
import type { UpperLimbMotorScreenSessionResultPublic } from "./session-result-persistence";

export type ForwardReachSessionLoadResult =
  | { cancelled: true }
  | {
      cancelled: false;
      ok: true;
      assignment: UpperLimbMotorScreenAssignmentPublic | null;
      sessionResult: UpperLimbMotorScreenSessionResultPublic | null;
    }
  | { cancelled: false; ok: false; error: string | null };

export type ForwardReachSessionLoadInput = {
  isUuidPatient: boolean;
  patientId: string;
  screenDefinitionId: string;
  /** Checked after every await — must reflect the calling effect invocation's own cancellation, never a shared/guarded one. */
  isCancelled: () => boolean;
  fetchAssignment: (
    patientId: string,
    screenDefinitionId: string,
  ) => Promise<UpperLimbClientResult<{ assignment: UpperLimbMotorScreenAssignmentPublic | null }>>;
  fetchSessionResult: (
    assignmentId: string,
  ) => Promise<UpperLimbClientResult<{ sessionResult: UpperLimbMotorScreenSessionResultPublic | null }>>;
};

export async function loadForwardReachSessionState(
  input: ForwardReachSessionLoadInput,
): Promise<ForwardReachSessionLoadResult> {
  if (!input.isUuidPatient) {
    return { cancelled: false, ok: true, assignment: null, sessionResult: null };
  }

  const assignmentResult = await input.fetchAssignment(input.patientId, input.screenDefinitionId);
  if (input.isCancelled()) return { cancelled: true };

  if (!assignmentResult.ok) {
    const error = "skipped" in assignmentResult ? null : assignmentResult.error;
    return { cancelled: false, ok: false, error };
  }

  const assignment = assignmentResult.data.assignment;
  if (!assignment) {
    return { cancelled: false, ok: true, assignment: null, sessionResult: null };
  }

  const resultResult = await input.fetchSessionResult(assignment.assignment.id);
  if (input.isCancelled()) return { cancelled: true };

  const sessionResult = resultResult.ok ? resultResult.data.sessionResult : null;
  return { cancelled: false, ok: true, assignment, sessionResult };
}
