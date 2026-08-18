/**
 * RASQ Upper-Limb Motor Screen — Forward Reach runtime integration layer.
 *
 * Pure on-mount lifecycle-phase resolution. The rendered UI state is
 * always derived from what was actually fetched (assignment / latest
 * session result), never from an internal "have I already created one"
 * flag alone — this is what prevents a rerender, StrictMode double
 * mount, reload, or navigation from ever silently producing a second
 * assignment or session result. Creation actions are only ever offered
 * in "setup" (create assignment) or "finalized" (start new session)
 * phases; "readyToRun"/"computedUnfinalized" never expose a create
 * action for the object that already exists.
 */

export type ForwardReachSessionPhase =
  | "blockedNonUuidPatient"
  | "setup"
  | "readyToRun"
  | "computedUnfinalized"
  | "finalized";

export type ForwardReachSessionPhaseInput = {
  isUuidPatient: boolean;
  assignment: { id: string } | null;
  sessionResult: { status: "computed" | "finalized" } | null;
};

export function resolveForwardReachSessionPhase(
  input: ForwardReachSessionPhaseInput,
): ForwardReachSessionPhase {
  if (!input.isUuidPatient) return "blockedNonUuidPatient";
  if (!input.assignment) return "setup";
  if (!input.sessionResult) return "readyToRun";
  return input.sessionResult.status === "finalized" ? "finalized" : "computedUnfinalized";
}
