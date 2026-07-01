"use client";

import { useMemo } from "react";
import {
  buildLongitudinalComparison,
  formatComparisonDirection,
  type LongitudinalComparison,
} from "@/app/lib/progress/longitudinal-comparison";
import type { ProgressOutcomesBundle } from "@/app/lib/progress/progress-outcomes-bundle";
import { formatCvRecordedAt } from "@/app/lib/cv/cv-metrics-display";

type LongitudinalComparisonPanelProps = {
  bundle: ProgressOutcomesBundle;
};

function DirectionBadge({ comparison }: { comparison: LongitudinalComparison }) {
  if (!comparison.pain?.direction || comparison.pain.direction === "unknown") return null;
  const tone =
    comparison.pain.direction === "improved"
      ? "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#5DCAA5]"
      : comparison.pain.direction === "worse"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-[#1E2D42] bg-[#0B1220] text-white/45";
  return (
    <span className={`rounded-[5px] border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {formatComparisonDirection(comparison.pain.direction)}
    </span>
  );
}

export function LongitudinalComparisonPanel({ bundle }: LongitudinalComparisonPanelProps) {
  const comparison = useMemo(() => buildLongitudinalComparison(bundle), [bundle]);
  if (!comparison.hasComparison) return null;

  return (
    <section
      aria-labelledby="longitudinal-comparison-title"
      className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id="longitudinal-comparison-title" className="text-[12px] font-medium text-[#F9FAFB]">
          Longitudinal comparison
        </h2>
        <span className="rounded-[4px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
          Baseline vs latest
        </span>
        <DirectionBadge comparison={comparison} />
      </div>
      <p className="mb-4 mt-1 text-[11px] text-white/35">{comparison.disclaimer}</p>

      <div className="grid gap-3 md:grid-cols-3">
        {comparison.pain && (
          <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
              Session pain (after)
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-white">
              {comparison.pain.baselinePainAfter ?? "—"} → {comparison.pain.latestPainAfter ?? "—"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {comparison.pain.delta != null
                ? `Change: ${comparison.pain.delta > 0 ? "+" : ""}${comparison.pain.delta} over ${comparison.pain.sessionCount} logged sessions`
                : `${comparison.pain.sessionCount} logged sessions`}
            </p>
          </div>
        )}

        {comparison.assessment && (
          <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
              Assessment pain at rest
            </p>
            <p className="mt-2 text-sm text-white/75">
              {comparison.assessment.baselinePainAtRest ?? "—"} →{" "}
              {comparison.assessment.latestPainAtRest ?? "—"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {comparison.assessment.baselineBodyRegion ?? "Region not recorded"}
            </p>
          </div>
        )}

        {comparison.cv && (
          <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
              Camera-assisted ({comparison.cv.exerciseId.replace(/-/g, " ")})
            </p>
            <p className="mt-2 text-sm text-white/75">
              Reps:{" "}
              {comparison.cv.repDelta != null
                ? `${comparison.cv.repDelta >= 0 ? "+" : ""}${comparison.cv.repDelta}`
                : "—"}
              {" · "}
              Duration:{" "}
              {comparison.cv.durationDeltaS != null
                ? `${comparison.cv.durationDeltaS >= 0 ? "+" : ""}${comparison.cv.durationDeltaS}s`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {comparison.cv.baselineRecordedAt
                ? formatCvRecordedAt(comparison.cv.baselineRecordedAt)
                : "—"}{" "}
              →{" "}
              {comparison.cv.latestRecordedAt
                ? formatCvRecordedAt(comparison.cv.latestRecordedAt)
                : "—"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
