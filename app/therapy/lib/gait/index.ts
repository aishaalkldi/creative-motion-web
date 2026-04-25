/**
 * lib/gait/index.ts — Public barrel for the Gait Training Program module.
 *
 * PURPOSE
 * ───────
 * This file is the single stable import surface for the gait module.
 * External consumers — API adapters, the main platform, test suites,
 * future microservices — should import from here, not from individual files:
 *
 *   import { computeGaitPhase, type GaitPhaseInfo } from "@/lib/gait";
 *   import { aggregate, type AggregatedData }       from "@/lib/gait";
 *
 * Internal files within lib/gait/ continue to use direct relative imports
 * between siblings (e.g. session-plan imports ./gait-progression directly).
 * They must NEVER import from this barrel — that would create circular deps.
 *
 * WHAT IS EXPORTED
 * ────────────────
 * All public types and functions from every module in the gait package.
 * These were all previously at lib/ root with full public visibility,
 * so no API surface is being restricted.
 *
 *   biomechanics         — joint angles, ROM, step metrics, movement quality
 *   gait-progression     — exercise ladder, success rules, recommendation engine
 *   gait-phase           — protocol phase abstraction (Phase 1 / 2 / 3)
 *   session-plan         — session prescription: generate, persist, evaluate
 *   exercise-session-config — per-exercise detection parameters
 *   decision-engine      — hybrid clinical decision and prediction
 *   progress-engine      — session aggregation, classification, risk warnings
 *   adaptive-targets     — personalised target generation
 *   patient-memory       — patient trend memory, online ML weights
 *   ml-engine            — kNN movement quality classifier
 *
 * WHAT IS NOT EXPORTED HERE
 * ─────────────────────────
 * Shared platform infrastructure stays at lib/ root and is imported directly:
 *   @/lib/session-store  — session storage (shared across all programs)
 *   @/lib/programs       — cross-program registry
 *
 * CIRCULAR DEPENDENCY RULE
 * ────────────────────────
 * No file inside lib/gait/ may import from lib/gait/index (this file).
 * Import siblings directly: import { foo } from "./foo", not from "./index".
 *
 * VERSIONING NOTE
 * ───────────────
 * This barrel is the stable contract. Internal reorganisation within lib/gait/
 * is invisible to callers as long as all current exports remain available here.
 * When removing an export, deprecate first (add a JSDoc @deprecated comment
 * and keep the export for at least one release cycle).
 *
 * Decision-support only · Not a clinical system.
 */

/* ── Measurement & biomechanics ───────────────────────────────────────────── */
export * from "./biomechanics";

/* ── Exercise progression framework ──────────────────────────────────────── */
export * from "./gait-progression";

/* ── Protocol phase abstraction ──────────────────────────────────────────── */
export * from "./gait-phase";

/* ── Session prescription ─────────────────────────────────────────────────── */
export * from "./session-plan";

/* ── Exercise detection configuration ────────────────────────────────────── */
export * from "./exercise-session-config";

/* ── Clinical decision engine ────────────────────────────────────────────── */
export * from "./decision-engine";

/* ── Progress analytics & classification ─────────────────────────────────── */
export * from "./progress-engine";

/* ── Adaptive target generation ───────────────────────────────────────────── */
export * from "./adaptive-targets";

/* ── Patient memory & online learning ────────────────────────────────────── */
export * from "./patient-memory";

/* ── Movement quality classifier (kNN) ───────────────────────────────────── */
export * from "./ml-engine";
