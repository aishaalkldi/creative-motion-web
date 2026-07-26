import type { SessionCompleteResponse } from "@/app/api/patient/session-complete/route";
import type { PatientSession } from "@/app/api/patient/plan/route";

/**
 * True when the plan API attached catalog provenance (source_program_session_id).
 * Legacy sessions omit the catalogSession key entirely.
 */
export function isCatalogPlaybackSession(session: PatientSession): boolean {
  return Object.prototype.hasOwnProperty.call(session, "catalogSession");
}

export type PatientSessionCompleteInput = {
  token: string;
  sessionId: string;
  effortScore: number | null;
  painScore: number | null;
  exercisesCompleted: number;
  notes?: string | null;
};

export type PatientSessionCompleteResult =
  | { ok: true; body: SessionCompleteResponse }
  | { ok: false; error: string; status: number };

/** Route-layer persistence helper — not used inside CatalogSessionPlayer or runtime core. */
export async function submitPatientSessionComplete(
  input: PatientSessionCompleteInput,
): Promise<PatientSessionCompleteResult> {
  const res = await fetch("/api/patient/session-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: input.token,
      sessionId: input.sessionId,
      effortScore: input.effortScore,
      painScore: input.painScore,
      exercisesCompleted: input.exercisesCompleted,
      notes: input.notes ?? null,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as SessionCompleteResponse & {
    error?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? `Session could not be saved (${res.status}). Please try again.`,
      status: res.status,
    };
  }

  return { ok: true, body };
}
