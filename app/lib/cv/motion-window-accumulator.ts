/**
 * MOTION-WIN-0 — parallel in-memory 500ms motion windows.
 * Derived frame metrics only — no landmarks, video, storage, or API.
 */

import type {
  CvTrackingQuality,
  MovementPhase,
  MotionWindow,
} from "@/app/lib/cv/bio-0-contracts";

export const MOTION_WINDOW_MS = 500;

/** Per-frame derived input (no raw landmarks). */
export type MotionFrameData = {
  timestampMs: number;
  hasPose: boolean;
  trackingQuality: CvTrackingQuality | null;
  hipY: number | null;
  hipVisibilityAvg: number | null;
  kneeVisibilityAvg: number | null;
  standPhase: "up" | "down";
  baselineHipY: number | null;
};

type FrameSample = MotionFrameData;

type OpenBucket = {
  startMs: number;
  samples: FrameSample[];
};

const QUALITY_RANK: Record<CvTrackingQuality, number> = {
  unknown: 0,
  poor: 1,
  fair: 2,
  good: 3,
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function worstQuality(qualities: CvTrackingQuality[]): CvTrackingQuality {
  let worst: CvTrackingQuality = "unknown";
  let rank = -1;
  for (const q of qualities) {
    const r = QUALITY_RANK[q] ?? 0;
    if (r > rank) {
      rank = r;
      worst = q;
    }
  }
  return worst;
}

function hipYTrend(samples: FrameSample[]): MotionWindow["hipYTrend"] {
  const ys = samples
    .filter((s) => s.hasPose && s.hipY != null)
    .map((s) => s.hipY as number);
  if (ys.length < 2) return "unknown";
  const split = Math.max(1, Math.floor(ys.length / 3));
  const startMean = avg(ys.slice(0, split)) ?? ys[0]!;
  const endMean = avg(ys.slice(-split)) ?? ys[ys.length - 1]!;
  const delta = endMean - startMean;
  if (Math.abs(delta) < 0.008) return "flat";
  return delta < 0 ? "rising" : "falling";
}

function inferPhase(
  samples: FrameSample[],
  trend: MotionWindow["hipYTrend"],
  baselineHipY: number | null,
): MovementPhase {
  const posed = samples.filter((s) => s.hasPose && s.hipY != null);
  if (posed.length === 0) return "unclear";

  const meanHipY = avg(posed.map((s) => s.hipY as number));
  const upFrames = posed.filter((s) => s.standPhase === "up").length;
  const upRatio = upFrames / posed.length;

  if (baselineHipY != null && meanHipY != null) {
    const standDelta = 0.04;
    if (meanHipY < baselineHipY - standDelta && upRatio > 0.5) return "standing";
    if (meanHipY > baselineHipY - standDelta * 0.5 && upRatio < 0.3) return "seated";
  }

  if (trend === "rising") return "rising";
  if (trend === "falling") return "returning";
  if (trend === "flat" && upRatio > 0.5) return "standing";
  if (trend === "flat") return "seated";
  return "unclear";
}

function finalizeBucket(index: number, bucket: OpenBucket): MotionWindow {
  const { samples } = bucket;
  const endMs = samples.length > 0 ? samples[samples.length - 1]!.timestampMs : bucket.startMs;
  const posed = samples.filter((s) => s.hasPose);
  const hipYs = posed.map((s) => s.hipY).filter((y): y is number => y != null);
  const hipVis = posed.map((s) => s.hipVisibilityAvg).filter((v): v is number => v != null);
  const kneeVis = posed.map((s) => s.kneeVisibilityAvg).filter((v): v is number => v != null);
  const qualities = posed
    .map((s) => s.trackingQuality)
    .filter((q): q is CvTrackingQuality => q != null);

  const trend = hipYTrend(samples);
  const baselineHipY =
    posed.map((s) => s.baselineHipY).find((b) => b != null) ?? null;

  return {
    index,
    startMs: bucket.startMs,
    endMs,
    durationMs: Math.max(0, endMs - bucket.startMs),
    framesTotal: samples.length,
    framesWithPose: posed.length,
    trackingQuality: worstQuality(qualities.length > 0 ? qualities : ["unknown"]),
    hipYMin: hipYs.length > 0 ? Math.min(...hipYs) : null,
    hipYMax: hipYs.length > 0 ? Math.max(...hipYs) : null,
    hipYMean: avg(hipYs),
    hipYTrend: trend,
    hipVisibilityAvg: avg(hipVis),
    kneeVisibilityAvg: avg(kneeVis),
    phase: inferPhase(samples, trend, baselineHipY),
  };
}

export class MotionWindowAccumulator {
  private windows: MotionWindow[] = [];
  private openBucket: OpenBucket | null = null;
  private repCompletedAtMs: number[] = [];

  reset(): void {
    this.windows = [];
    this.openBucket = null;
    this.repCompletedAtMs = [];
  }

  recordRepCompleted(atMs: number): void {
    this.repCompletedAtMs.push(atMs);
  }

  getRepCompletedAtMs(): readonly number[] {
    return this.repCompletedAtMs;
  }

  pushFrame(frame: MotionFrameData): void {
    if (!this.openBucket) {
      this.openBucket = { startMs: frame.timestampMs, samples: [frame] };
      return;
    }

    const bucket = this.openBucket;
    bucket.samples.push(frame);

    if (frame.timestampMs - bucket.startMs >= MOTION_WINDOW_MS) {
      this.windows.push(finalizeBucket(this.windows.length, bucket));
      this.openBucket = { startMs: frame.timestampMs, samples: [] };
    }
  }

  /** Close open bucket and return all windows (in-memory only). */
  flush(): MotionWindow[] {
    if (this.openBucket && this.openBucket.samples.length > 0) {
      this.windows.push(finalizeBucket(this.windows.length, this.openBucket));
      this.openBucket = null;
    }
    return [...this.windows];
  }
}
