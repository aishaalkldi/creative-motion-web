/**
 * MOTION-WIN-0 — build SessionMotionSummary from in-memory windows (QA / future MQE).
 */

import type {
  CvTrackingQuality,
  MovementPhase,
  MotionWindow,
  RepQualitySummary,
  SessionMotionSummary,
} from "@/app/lib/cv/bio-0-contracts";
import { MOTION_WINDOW_MS } from "@/app/lib/cv/motion-window-accumulator";

const QUALITY_RANK: Record<CvTrackingQuality, number> = {
  unknown: 0,
  poor: 1,
  fair: 2,
  good: 3,
};

const EMPTY_PHASE_COUNTS: Record<MovementPhase, number> = {
  seated: 0,
  rising: 0,
  standing: 0,
  returning: 0,
  unclear: 0,
};

export type BuildSessionSummaryInput = {
  windows: MotionWindow[];
  repCompletedAtMs: readonly number[];
  repCountDetector: number;
  sessionDurationMs: number;
  framesTotal: number;
  framesWithPose: number;
};

function dominantQuality(windows: MotionWindow[]): CvTrackingQuality {
  const counts: Record<CvTrackingQuality, number> = {
    unknown: 0,
    poor: 0,
    fair: 0,
    good: 0,
  };
  for (const w of windows) {
    counts[w.trackingQuality] += 1;
  }
  let best: CvTrackingQuality = "unknown";
  let bestRank = -1;
  for (const [q, n] of Object.entries(counts) as [CvTrackingQuality, number][]) {
    const rank = QUALITY_RANK[q] * 1000 + n;
    if (rank > bestRank) {
      bestRank = rank;
      best = q;
    }
  }
  return best;
}

function windowsNearRep(windows: MotionWindow[], atMs: number): MotionWindow[] {
  const half = MOTION_WINDOW_MS * 2;
  return windows.filter((w) => w.endMs >= atMs - half && w.startMs <= atMs + half);
}

function buildRepSummaries(
  windows: MotionWindow[],
  repCompletedAtMs: readonly number[],
): RepQualitySummary[] {
  return repCompletedAtMs.map((completedAtMs, i) => {
    const near = windowsNearRep(windows, completedAtMs);
    const phase =
      near.length > 0
        ? near.reduce((a, b) => (a.framesWithPose >= b.framesWithPose ? a : b)).phase
        : "unclear";
    const trackingQuality =
      near.length > 0
        ? near.reduce((a, b) =>
            QUALITY_RANK[a.trackingQuality] >= QUALITY_RANK[b.trackingQuality] ? a : b,
          ).trackingQuality
        : "unknown";

    return {
      repIndex: i + 1,
      completedAtMs,
      trackingQuality,
      phase,
      windowCount: near.length,
    };
  });
}

export function buildSessionMotionSummary(
  input: BuildSessionSummaryInput,
): SessionMotionSummary {
  const phaseCounts = { ...EMPTY_PHASE_COUNTS };
  for (const w of input.windows) {
    phaseCounts[w.phase] += 1;
  }

  return {
    exerciseId: "sit-to-stand",
    sessionDurationMs: input.sessionDurationMs,
    repCountDetector: input.repCountDetector,
    framesTotal: input.framesTotal,
    framesWithPose: input.framesWithPose,
    windowCount: input.windows.length,
    windows: input.windows,
    repSummaries: buildRepSummaries(input.windows, input.repCompletedAtMs),
    dominantTrackingQuality: dominantQuality(input.windows),
    phaseCounts,
  };
}

/** Dev / Vercel preview branch QA — never log on production patient URL. */
export function shouldLogSessionMotionSummary(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.includes("-git-") || host.includes("aishaalkldi")) return true;
  return false;
}

export function logSessionMotionSummary(summary: SessionMotionSummary): void {
  if (!shouldLogSessionMotionSummary()) return;
  console.info("[RASQ Motion] SessionMotionSummary", summary);
}
