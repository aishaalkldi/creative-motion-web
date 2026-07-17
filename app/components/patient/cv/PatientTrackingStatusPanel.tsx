"use client";

/**
 * Tracking observability foundation — always-visible (not debug-gated) live
 * status panel: pose detected, tracking readiness, calibration progress,
 * current movement state, and the outcome of the most recent rep attempt.
 *
 * Deliberately generic/presentational: it takes pre-localized strings and
 * plain values only, with no exercise-specific enum types, so a future
 * exercise (Shoulder, Knee, Balance) can reuse it by supplying its own copy.
 * Only wired to real data for Sit-to-Stand today.
 */

export type PatientTrackingStatusPanelProps = {
  poseDetectedLabel: string;
  readinessLabel: string;
  isReady: boolean;
  /** 0-100 while calibrating; null when not currently calibrating. */
  calibrationProgressPct: number | null;
  calibratingLabel: string;
  /** Localized current movement phase (e.g. "Standing"); null when not applicable. */
  movementStateLabel: string | null;
  /** Localized outcome of the most recent finished attempt; null until one exists. */
  lastOutcomeLabel: string | null;
  lastOutcomeWasSuccess: boolean;
  isRtl?: boolean;
};

export function PatientTrackingStatusPanel({
  poseDetectedLabel,
  readinessLabel,
  isReady,
  calibrationProgressPct,
  calibratingLabel,
  movementStateLabel,
  lastOutcomeLabel,
  lastOutcomeWasSuccess,
  isRtl = false,
}: PatientTrackingStatusPanelProps) {
  const isCalibrating = calibrationProgressPct !== null;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="space-y-2 rounded-[10px] border border-[#1E2D42] bg-[#0F1825]/90 px-4 py-3 text-sm text-white/80"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isReady ? "bg-[#1D9E75]" : "bg-amber-400"}`}
          aria-hidden="true"
        />
        <span>{poseDetectedLabel}</span>
      </div>

      <p className="text-xs text-white/60">{readinessLabel}</p>

      {isCalibrating ? (
        <div>
          <p className="text-xs text-white/60">{calibratingLabel}</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#1E2D42]">
            <div
              className="h-full rounded-full bg-[#1D9E75] transition-all duration-200 ease-out"
              style={{ width: `${calibrationProgressPct}%` }}
            />
          </div>
        </div>
      ) : movementStateLabel ? (
        <p className="text-xs font-semibold text-white/70">{movementStateLabel}</p>
      ) : null}

      {lastOutcomeLabel && (
        <p
          className={`text-xs font-semibold ${
            lastOutcomeWasSuccess ? "text-[#5DCAA5]" : "text-amber-300"
          }`}
        >
          {lastOutcomeLabel}
        </p>
      )}
    </div>
  );
}
