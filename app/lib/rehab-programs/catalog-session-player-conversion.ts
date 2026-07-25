/**
 * Pure catalog ProgramSession → SessionDefinition conversion for CatalogSessionPlayer.
 * Failures are returned explicitly — never silently fall back to legacy content.
 */
import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";
import type { ProgramSession } from "./rehab-program-types";
import { toSessionDefinition } from "./rehab-program-runtime-adapter";

export type CatalogSessionConversionResult =
  | { ok: true; sessionDefinition: SessionDefinition }
  | { ok: false };

export function convertCatalogProgramSession(
  programSession: ProgramSession,
): CatalogSessionConversionResult {
  try {
    return { ok: true, sessionDefinition: toSessionDefinition(programSession) };
  } catch {
    return { ok: false };
  }
}
