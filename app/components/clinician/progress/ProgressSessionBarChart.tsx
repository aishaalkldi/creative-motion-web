import type {
  ProgressChartPointLabel,
  ProgressChartSeries,
} from "@/app/lib/progress/interactive-shoulder-progress-charts";

type ProgressSessionBarChartProps = {
  pointLabels: ProgressChartPointLabel[];
  series: ProgressChartSeries;
  variant?: "clinician" | "patient";
};

function chartMaxValue(values: Array<number | null>): number {
  const numeric = values.filter((value): value is number => value != null);
  if (numeric.length === 0) return 1;
  return Math.max(...numeric, 1);
}

export function ProgressSessionBarChart({
  pointLabels,
  series,
  variant = "clinician",
}: ProgressSessionBarChartProps) {
  const max = chartMaxValue(series.values);
  const isPatient = variant === "patient";

  return (
    <div
      className={
        isPatient
          ? "rounded-[8px] border border-[#E2E8E5] bg-[#F9FAFB] px-3 py-3"
          : "rounded-[8px] border border-[#1E2D42]/50 bg-[#0B1220]/40 px-3 py-3"
      }
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
          series.secondary
            ? isPatient
              ? "text-[#9CA3AF]"
              : "text-white/35"
            : isPatient
              ? "text-[#374151]"
              : "text-white/55"
        }`}
      >
        {series.label}
      </p>
      {series.helper ? (
        <p className={`mt-1 text-[9px] leading-relaxed ${isPatient ? "text-[#9CA3AF]" : "text-white/30"}`}>
          {series.helper}
        </p>
      ) : null}
      <div className="mt-3 flex items-end gap-2" style={{ minHeight: 88 }}>
        {pointLabels.map((point, index) => {
          const value = series.values[index];
          const heightPct =
            value != null && value > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;

          return (
            <div key={`${series.id}-${point.sessionId}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <p
                className={`text-[9px] font-medium ${isPatient ? "text-[#6B7280]" : "text-white/45"}`}
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
              >
                {value != null ? series.valueFormatter(value) : "—"}
              </p>
              <div className="flex w-full max-w-[44px] flex-col justify-end" style={{ height: 56 }}>
                <div
                  className={`w-full rounded-t-[4px] ${
                    series.secondary
                      ? isPatient
                        ? "bg-[#CBD5E1]"
                        : "bg-white/20"
                      : isPatient
                        ? "bg-[#1D9E75]"
                        : "bg-[#1D9E75]/75"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <p className={`text-[9px] ${isPatient ? "text-[#9CA3AF]" : "text-white/35"}`}>
                {point.sessionLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
