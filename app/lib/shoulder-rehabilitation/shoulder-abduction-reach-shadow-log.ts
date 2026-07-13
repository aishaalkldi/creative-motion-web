/**
 * Shoulder Abduction Reach shadow mode — in-memory session log.
 *
 * Unlike the STS shadow-mode log (`app/lib/cv/sts-shadow-log.ts`), there is
 * no legacy shoulder detector to diff against — this is a brand-new
 * exercise. "Shadow" here means: observe the detector's own behavior on
 * real frames without affecting anything the user sees. Notable events
 * (rep completions, phase changes) are recorded and console-logged; no
 * network calls, no database writes, no UI rendering.
 */

import {
  SHOULDER_ABDUCTION_REACH_SIDES,
  type ShoulderAbductionReachPhase,
  type ShoulderAbductionReachSide,
} from "./shoulder-abduction-reach-contract";
import type {
  ShoulderAbductionReachFrameResult,
  ShoulderAbductionReachSideResult,
} from "./shoulder-abduction-reach-detector";

const MAX_LOGGED_EVENTS = 50;

export type ShoulderAbductionReachShadowRepEvent = {
  side: ShoulderAbductionReachSide;
  repCount: number;
  peakAngleDegrees: number | null;
  frameIndex: number;
  capturedAtMs: number;
};

export type ShoulderAbductionReachShadowPhaseChangeEvent = {
  side: ShoulderAbductionReachSide;
  fromPhase: ShoulderAbductionReachPhase;
  toPhase: ShoulderAbductionReachPhase;
  frameIndex: number;
  capturedAtMs: number;
};

export type ShoulderAbductionReachShadowSideSnapshot = {
  phase: ShoulderAbductionReachPhase;
  repCount: number;
};

export type ShoulderAbductionReachShadowPreviousSnapshot = Record<
  ShoulderAbductionReachSide,
  ShoulderAbductionReachShadowSideSnapshot
>;

export type ShoulderAbductionReachShadowSessionLog = {
  frameCount: number;
  frameContractInvalidCount: number;
  repCompletedCount: Record<ShoulderAbductionReachSide, number>;
  /** Capped sample of rep-completion events for manual review. */
  repEvents: ShoulderAbductionReachShadowRepEvent[];
  /** Capped sample of phase-change events for manual review. */
  phaseChangeEvents: ShoulderAbductionReachShadowPhaseChangeEvent[];
};

export function createShoulderAbductionReachShadowSessionLog(): ShoulderAbductionReachShadowSessionLog {
  return {
    frameCount: 0,
    frameContractInvalidCount: 0,
    repCompletedCount: { left: 0, right: 0 },
    repEvents: [],
    phaseChangeEvents: [],
  };
}

function snapshotSide(sideResult: ShoulderAbductionReachSideResult): ShoulderAbductionReachShadowSideSnapshot {
  return { phase: sideResult.phase, repCount: sideResult.repCount };
}

function logToConsole(message: string, data: unknown): void {
  if (typeof console === "undefined" || typeof console.debug !== "function") return;
  console.debug(`[shoulder-shadow] ${message}`, data);
}

/**
 * Record one frame's result into the log. `previous` is the snapshot
 * returned by the prior call (or null for the first frame) — rep
 * completions and phase changes are detected by comparing against it, not
 * re-derived from the phase alone (a phase change into "resting" does not
 * always mean a rep completed). Returns the snapshot to pass into the next
 * call.
 */
export function recordShoulderAbductionReachShadowFrame(
  log: ShoulderAbductionReachShadowSessionLog,
  result: ShoulderAbductionReachFrameResult,
  previous: ShoulderAbductionReachShadowPreviousSnapshot | null,
): ShoulderAbductionReachShadowPreviousSnapshot {
  log.frameCount += 1;
  if (!result.frameContractValid) {
    log.frameContractInvalidCount += 1;
  }

  for (const side of SHOULDER_ABDUCTION_REACH_SIDES) {
    const current = result[side];
    const prev = previous?.[side];

    if (prev && current.repCount > prev.repCount) {
      log.repCompletedCount[side] += 1;
      const event: ShoulderAbductionReachShadowRepEvent = {
        side,
        repCount: current.repCount,
        peakAngleDegrees: current.peakAngleDegrees,
        frameIndex: result.frameIndex,
        capturedAtMs: result.capturedAtMs,
      };
      if (log.repEvents.length < MAX_LOGGED_EVENTS) {
        log.repEvents.push(event);
      }
      logToConsole(`${side} rep completed (#${current.repCount}, peak ${current.peakAngleDegrees}°)`, event);
    }

    if (prev && current.phase !== prev.phase) {
      const event: ShoulderAbductionReachShadowPhaseChangeEvent = {
        side,
        fromPhase: prev.phase,
        toPhase: current.phase,
        frameIndex: result.frameIndex,
        capturedAtMs: result.capturedAtMs,
      };
      if (log.phaseChangeEvents.length < MAX_LOGGED_EVENTS) {
        log.phaseChangeEvents.push(event);
      }
      logToConsole(`${side} phase ${event.fromPhase} -> ${event.toPhase}`, event);
    }
  }

  return { left: snapshotSide(result.left), right: snapshotSide(result.right) };
}

export type ShoulderAbductionReachShadowSessionSummary = {
  frameCount: number;
  frameContractInvalidRate: number;
  repCompletedCount: Record<ShoulderAbductionReachSide, number>;
};

export function summarizeShoulderAbductionReachShadowSessionLog(
  log: ShoulderAbductionReachShadowSessionLog,
): ShoulderAbductionReachShadowSessionSummary {
  return {
    frameCount: log.frameCount,
    frameContractInvalidRate: log.frameCount > 0 ? log.frameContractInvalidCount / log.frameCount : 0,
    repCompletedCount: { ...log.repCompletedCount },
  };
}
