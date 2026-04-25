/**
 * programs.ts — Centralised program registry for Creative Motion.
 *
 * PURPOSE
 * ───────
 * Defines every rehabilitation program available in the platform as a typed
 * constant. This is the single source of truth for program identifiers — no
 * other file should hardcode a program ID string directly.
 *
 * USAGE
 * ─────
 *   import { PROGRAMS, type ProgramId } from "./programs";
 *
 *   PROGRAMS.GAIT_TRAINING.id          → "gait_training"   (stored in data)
 *   PROGRAMS.GAIT_TRAINING.displayName → "Gait Training Program" (shown in UI)
 *   PROGRAMS.GAIT_TRAINING.slug        → "gait"            (used in URL paths)
 *
 * INTEGRATION NOTES
 * ─────────────────
 * • `id` is the stable contract shared with the main platform backend.
 *   Never rename an existing id — create a migration and add an alias.
 *
 * • `slug` will become the URL prefix once routing is namespaced:
 *   /gait/session, /gait/report, /balance/session, etc.
 *
 * • `ProgramId` is a typed union of all known IDs. Use it anywhere a
 *   program identity is stored, filtered on, or passed over an API boundary.
 *
 * • Adding a new program: add a new key to PROGRAMS. The ProgramId union
 *   and programById lookup update automatically via TypeScript inference.
 *
 * Decision-support only · Not a clinical classification system.
 */

/* ── Program registry ─────────────────────────────────────────────────────── */

export const PROGRAMS = {
  GAIT_TRAINING: {
    /** Stable identifier stored in SessionRecord, SessionPlan, etc. */
    id:          "gait_training" as const,
    /** Human-readable name shown in UI headings and badges. */
    displayName: "Gait Training Program",
    /**
     * URL slug — will become the route prefix once routing is namespaced.
     * e.g. /gait/session, /gait/report
     */
    slug:        "gait",
    /**
     * Short label used in compact UI contexts (cards, chips, breadcrumbs).
     */
    shortName:   "Gait Training",
  },

  // ── Future programs — add here when implemented ──────────────────────────
  //
  // BALANCE_STABILITY: {
  //   id:          "balance_stability" as const,
  //   displayName: "Balance & Stability Program",
  //   slug:        "balance",
  //   shortName:   "Balance",
  // },
  //
  // STRENGTH_CONDITIONING: {
  //   id:          "strength_conditioning" as const,
  //   displayName: "Strength & Conditioning Program",
  //   slug:        "strength",
  //   shortName:   "Strength",
  // },
} as const;

/* ── Derived types ────────────────────────────────────────────────────────── */

/**
 * Union of all stable program IDs.
 * Use this type for any field that stores a program identity:
 *   programId: ProgramId
 * TypeScript will catch typos and flag unknown IDs at compile time.
 */
export type ProgramId = typeof PROGRAMS[keyof typeof PROGRAMS]["id"];

/**
 * Lookup a program descriptor by its stable ID string.
 * Returns undefined for unknown IDs — callers should handle gracefully.
 *
 * @example
 *   programById("gait_training")?.displayName  // "Gait Training Program"
 */
export function programById(
  id: string,
): (typeof PROGRAMS)[keyof typeof PROGRAMS] | undefined {
  return Object.values(PROGRAMS).find((p) => p.id === id);
}
