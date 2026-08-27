/**
 * RASQ patient portal — Interactive Shoulder movement-outcome
 * submission client (O2).
 *
 * Mirrors submitPatientSessionComplete's exact fetch/error-mapping
 * shape (catalog-session-playback.ts) — same try/catch structure, same
 * "network failure before a response exists" handling — for the
 * completely separate /api/patient/interactive-shoulder-outcomes
 * endpoint. This call is independent of, and must never block or be
 * blocked by, the patient-reported session-complete submission.
 */
import type { InteractiveShoulderSessionCompletionSnapshot } from "@/app/lib/interactive-shoulder/orchestrator-cv-session-types";

export type InteractiveShoulderOutcomeSubmissionStatus = "idle" | "submitting" | "submitted";

/**
 * Pure decision extracted from CatalogPatientSessionPlayback's
 * movementOutcomeSubmissionRef guard so it is unit-testable without a
 * DOM/React renderer (none exists in this repo's test infra). Only
 * "idle" may start a submission attempt — a concurrent "submitting"
 * attempt is never duplicated, and a completed "submitted" attempt is
 * never resubmitted, however many times a caller (e.g. a repeated
 * onSessionComplete invocation, or a re-render) asks.
 */
export function shouldSubmitInteractiveShoulderOutcome(
  status: InteractiveShoulderOutcomeSubmissionStatus,
): boolean {
  return status === "idle";
}

export type SubmitInteractiveShoulderOutcomeInput = {
  token: string;
  planSessionId: string;
  snapshot: InteractiveShoulderSessionCompletionSnapshot;
};

export type SubmitInteractiveShoulderOutcomeResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string; status: number };

export const INTERACTIVE_SHOULDER_OUTCOME_NETWORK_ERROR =
  "Movement outcome could not be saved. It will not block your session.";

/**
 * Builds the exact request body the API expects — only the real
 * runtime facts (sessionState, elapsed time, block results) plus
 * planSessionId/token. Never includes providerId, patientId, planId,
 * or prescribedSide; those are always server-resolved.
 */
export function buildInteractiveShoulderOutcomeRequestBody(
  input: SubmitInteractiveShoulderOutcomeInput,
): Record<string, unknown> {
  return {
    token: input.token,
    planSessionId: input.planSessionId,
    sessionState: input.snapshot.sessionState,
    totalElapsedSeconds: input.snapshot.sessionElapsedSeconds,
    blocksCompleted: input.snapshot.accumulatedBlockResults.length,
    blocksTotal: input.snapshot.accumulatedBlockResults.length,
    blockResults: input.snapshot.accumulatedBlockResults,
  };
}

export async function submitInteractiveShoulderOutcome(
  input: SubmitInteractiveShoulderOutcomeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitInteractiveShoulderOutcomeResult> {
  try {
    const res = await fetchImpl("/api/patient/interactive-shoulder-outcomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildInteractiveShoulderOutcomeRequestBody(input)),
    });

    const body = (await res.json().catch(() => ({}))) as { created?: boolean; error?: string };

    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? INTERACTIVE_SHOULDER_OUTCOME_NETWORK_ERROR,
        status: res.status,
      };
    }

    return { ok: true, created: body.created ?? false };
  } catch {
    return { ok: false, error: INTERACTIVE_SHOULDER_OUTCOME_NETWORK_ERROR, status: 0 };
  }
}
