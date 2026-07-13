/**
 * STS shadow-mode comparison log (Input Acquisition Layer validation, v0).
 *
 * In-memory-only accumulator for `compareStsShadowFrame` results. No
 * network calls, no database writes, no UI rendering — console logging
 * only, and only for frames that actually diverge (never one line per
 * frame). Nothing here is wired into the live capture loop; it is the
 * session-level entry point for feeding a recorded or synthetic landmark
 * sequence through the shadow comparison and reviewing the result.
 */

import type { PoseLandmark } from "@/app/lib/cv/pose-landmark-overlay";
import {
  compareStsShadowFrame,
  DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS,
  type StsShadowDivergenceReason,
  type StsShadowFrameComparison,
  type StsShadowVisibilityThresholds,
} from "@/app/lib/cv/sts-shadow-comparison";
import type { InputAcquisitionContext } from "@/app/lib/input-acquisition";

const MAX_SAMPLE_DIVERGENCES = 20;

export type StsShadowSessionLog = {
  frameCount: number;
  divergentFrameCount: number;
  divergenceReasonCounts: Partial<Record<StsShadowDivergenceReason, number>>;
  /** Capped sample of divergent comparisons for manual review. */
  sampleDivergences: StsShadowFrameComparison[];
};

export function createStsShadowSessionLog(): StsShadowSessionLog {
  return {
    frameCount: 0,
    divergentFrameCount: 0,
    divergenceReasonCounts: {},
    sampleDivergences: [],
  };
}

function logDivergenceToConsole(comparison: StsShadowFrameComparison): void {
  if (typeof console === "undefined" || typeof console.debug !== "function") {
    return;
  }
  console.debug(
    `[sts-shadow] frame ${comparison.frameIndex} diverged: ${comparison.divergenceReasons.join(", ")}`,
    {
      legacy: comparison.legacy,
      next: comparison.next,
      hipVisibilitySumDelta: comparison.hipVisibilitySumDelta,
    },
  );
}

/** Records one comparison into the log. Mutates `log` in place; no return value. */
export function recordStsShadowComparison(
  log: StsShadowSessionLog,
  comparison: StsShadowFrameComparison,
): void {
  log.frameCount += 1;

  if (!comparison.divergent) {
    return;
  }

  log.divergentFrameCount += 1;
  for (const reason of comparison.divergenceReasons) {
    log.divergenceReasonCounts[reason] = (log.divergenceReasonCounts[reason] ?? 0) + 1;
  }
  if (log.sampleDivergences.length < MAX_SAMPLE_DIVERGENCES) {
    log.sampleDivergences.push(comparison);
  }

  logDivergenceToConsole(comparison);
}

export type StsShadowSessionSummary = {
  frameCount: number;
  divergentFrameCount: number;
  divergenceRate: number;
  divergenceReasonCounts: Partial<Record<StsShadowDivergenceReason, number>>;
};

export function summarizeStsShadowSessionLog(log: StsShadowSessionLog): StsShadowSessionSummary {
  return {
    frameCount: log.frameCount,
    divergentFrameCount: log.divergentFrameCount,
    divergenceRate: log.frameCount > 0 ? log.divergentFrameCount / log.frameCount : 0,
    divergenceReasonCounts: { ...log.divergenceReasonCounts },
  };
}

export type StsShadowSessionFrameInput = {
  landmarks: readonly PoseLandmark[];
  context: InputAcquisitionContext;
};

/**
 * Run the frame-by-frame shadow comparison across a full session's landmark
 * sequence and produce an aggregate log + summary. This is the "run the new
 * pipeline in parallel with the existing implementation for internal
 * comparison" entry point for this sprint — a validation harness fed
 * recorded or synthetic sessions, not a live browser runtime hook. See
 * `docs/sts-shadow-mode-validation.md` for how to feed it a real session and
 * the deferred plan for live, flag-gated wiring into the capture loop.
 */
export function runStsShadowSessionComparison(
  frames: readonly StsShadowSessionFrameInput[],
  thresholds: StsShadowVisibilityThresholds = DEFAULT_STS_SHADOW_VISIBILITY_THRESHOLDS,
): { log: StsShadowSessionLog; summary: StsShadowSessionSummary } {
  const log = createStsShadowSessionLog();

  for (const { landmarks, context } of frames) {
    const comparison = compareStsShadowFrame(landmarks, context, thresholds);
    recordStsShadowComparison(log, comparison);
  }

  return { log, summary: summarizeStsShadowSessionLog(log) };
}
