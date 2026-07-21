import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";
import {
  CLINICAL_MOTION_PATTERN_SESSION,
  CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION,
  REACH_THE_LIGHT_SESSION,
} from "./clinical-motion-pattern-session-definition";

export type MotionPatternsFeatureFlag = boolean;

/**
 * Resolves whether Clinical Motion Pattern sessions are enabled.
 * `NEXT_PUBLIC_RASQ_MOTION_PATTERNS_V1 === "true"` enables the diagonal pattern session.
 * Any other value (missing, false, etc.) keeps Reach the Light as the production default.
 */
export function resolveMotionPatternsFeatureFlag(
  envValue: string | undefined,
): MotionPatternsFeatureFlag {
  return envValue === "true";
}

/** Resolves the interactive shoulder session once at initialization — not per animation frame. */
export function resolveInteractiveShoulderSessionDefinition(
  motionPatternsEnabled: MotionPatternsFeatureFlag,
): SessionDefinition {
  return motionPatternsEnabled ? CLINICAL_MOTION_PATTERN_SESSION : REACH_THE_LIGHT_SESSION;
}

export function resolveInteractiveShoulderSessionFromEnv(
  envValue: string | undefined = process.env.NEXT_PUBLIC_RASQ_MOTION_PATTERNS_V1,
): SessionDefinition {
  return resolveInteractiveShoulderSessionDefinition(resolveMotionPatternsFeatureFlag(envValue));
}

export {
  CLINICAL_MOTION_PATTERN_SESSION,
  CLINICAL_MOTION_PATTERN_SEQUENCE_SESSION,
  REACH_THE_LIGHT_SESSION,
};
