/**
 * CV Lab / internal Mini Squat rep counter (drop polarity).
 * Not enabled for patient portal in MINI-SQUAT-CV-PR-1.
 */

import type { CvTrackingQuality } from "@/app/lib/cv/bio-0-contracts";
import {
  baselineConfigFromSts,
  createSagittalHipRepState,
  resetSagittalHipRepBaseline,
  type PoseLandmark,
  type SagittalHipRepBaselineConfig,
  type SagittalHipRepPhase,
  type SagittalHipRepState,
  tickSagittalHipRepBaseline,
} from "@/app/lib/cv/sagittal-hip-rep-core";

export type MiniSquatDerivedMetrics = {
  exerciseId: "mini-squat";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

/** CV Lab starting config — separate from future PATIENT_MINI_SQUAT_CONFIG. */
export const LAB_MINI_SQUAT_REP_CONFIG: SagittalHipRepBaselineConfig = {
  baselineDurationMs: 3_000,
  fallbackBaselineHipY: 0.45,
  baselineScaleByTorso: true,
  baselinePrimaryDelta: 0.06,
  baselineResetDelta: 0.03,
  baselinePrimaryDeltaRatio: 0.11,
  baselineResetDeltaRatio: 0.055,
  baselinePrimaryDeltaMin: 0.025,
  baselineResetDeltaMin: 0.015,
  minMsBetweenReps: 1_000,
};

export type MiniSquatRepCounterSnapshot = {
  repCount: number;
  repPhase: SagittalHipRepPhase;
  baselineHipY: number | null;
  isBaselineCalibrating: boolean;
  movementDetected: boolean;
};

/**
 * Frame-driven mini squat rep engine for unit tests and future CV Lab wiring.
 * Standing baseline → squat down → return up = one rep.
 */
export class MiniSquatRepCounter {
  private readonly config: SagittalHipRepBaselineConfig;
  private readonly state: SagittalHipRepState = createSagittalHipRepState();
  private movementDetected = false;

  constructor(config: SagittalHipRepBaselineConfig = LAB_MINI_SQUAT_REP_CONFIG) {
    this.config = config;
  }

  get repCount(): number {
    return this.state.repCount;
  }

  get repPhase(): SagittalHipRepPhase {
    return this.state.repPhase;
  }

  get baselineHipY(): number | null {
    return this.state.baselineHipY;
  }

  set baselineHipY(value: number | null) {
    this.state.baselineHipY = value;
    if (value !== null) {
      this.state.isBaselineCalibrating = false;
    }
  }

  get isBaselineCalibrating(): boolean {
    return this.state.isBaselineCalibrating;
  }

  resetReps(): void {
    this.state.repCount = 0;
    this.state.repPhase = "rest";
    this.state.lastRepAtMs = 0;
  }

  resetBaseline(): void {
    resetSagittalHipRepBaseline(this.state);
    this.state.repCount = 0;
  }

  startBaselineWindow(nowMs: number): void {
    if (this.state.baselineHipY !== null || this.state.baselineWindowEndMs > 0) return;
    this.state.baselineWindowEndMs = nowMs + this.config.baselineDurationMs;
    this.state.isBaselineCalibrating = true;
  }

  updateRepCountFromHipY(hipY: number, nowMs: number, torsoSpan: number | null): void {
    this.movementDetected = true;
    tickSagittalHipRepBaseline({
      state: this.state,
      polarity: "drop",
      hipY,
      nowMs,
      torsoSpan,
      config: this.config,
      canCollectBaseline: this.state.baselineWindowEndMs > 0,
      canIncrementReps: (s) => s.baselineHipY !== null,
    });
  }

  driveFrame(hipY: number, nowMs: number, torsoSpan: number | null = 0.25): void {
    this.updateRepCountFromHipY(hipY, nowMs, torsoSpan);
  }

  getSnapshot(): MiniSquatRepCounterSnapshot {
    return {
      repCount: this.state.repCount,
      repPhase: this.state.repPhase,
      baselineHipY: this.state.baselineHipY,
      isBaselineCalibrating: this.state.isBaselineCalibrating,
      movementDetected: this.movementDetected,
    };
  }

  getDerivedMetrics(sessionDurationS: number, framesWithPose: number, framesTotal: number): MiniSquatDerivedMetrics {
    return {
      exerciseId: "mini-squat",
      repCount: this.state.repCount,
      sessionDurationS,
      trackingQuality: "unknown",
      movementDetected: this.movementDetected && this.state.repCount > 0,
      framesWithPose,
      framesTotal,
    };
  }
}

/** @internal Test helper — build landmarks with given hip Y. */
export function mockMiniSquatLandmarks(hipY: number, vis = 0.6): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: vis,
  }));
  landmarks[11] = { x: 0.4, y: 0.25, visibility: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.25, visibility: 0.9 };
  landmarks[23] = { x: 0.4, y: hipY, visibility: vis };
  landmarks[24] = { x: 0.6, y: hipY, visibility: vis };
  landmarks[25] = { x: 0.4, y: hipY + 0.12, visibility: vis };
  landmarks[26] = { x: 0.6, y: hipY + 0.12, visibility: vis };
  return landmarks;
}

export { baselineConfigFromSts };
