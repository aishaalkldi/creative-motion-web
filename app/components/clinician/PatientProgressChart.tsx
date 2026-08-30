"use client";

/**
 * Lightweight dependency-free SVG line chart — patient-reported pain vs. effort
 * across logged sessions. Trends only; therapist interpretation required.
 */

export type ProgressChartPoint = {
  sessionLogId: string;
  sessionNumber: number | null;
  completedAt: string;
  painScore: number | null;
  effortScore: number | null;
};

type PatientProgressChartProps = {
  points: ProgressChartPoint[];
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PAD_LEFT = 28;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const SCALE_MAX = 10;

function xFor(index: number, count: number): number {
  if (count <= 1) return PAD_LEFT;
  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  return PAD_LEFT + (innerWidth * index) / (count - 1);
}

function yFor(value: number): number {
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const clamped = Math.max(0, Math.min(SCALE_MAX, value));
  return PAD_TOP + innerHeight * (1 - clamped / SCALE_MAX);
}

function buildPath(values: (number | null)[]): string {
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const cmd = d === "" ? "M" : "L";
    d += `${cmd}${xFor(i, values.length).toFixed(1)},${yFor(v).toFixed(1)} `;
  });
  return d.trim();
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function PatientProgressChart({ points }: PatientProgressChartProps) {
  if (points.length === 0) {
    return (
      <p className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
        No logged sessions yet. A progress chart will appear here once the patient completes session check-ins.
      </p>
    );
  }

  const painValues = points.map((p) => p.painScore);
  const effortValues = points.map((p) => p.effortScore);
  const painPath = buildPath(painValues);
  const effortPath = buildPath(effortValues);
  const gridLines = [0, 2.5, 5, 7.5, 10];

  // Show at most ~6 x-axis labels to avoid crowding.
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold">
        <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
          Pain (0–10)
        </span>
        <span className="flex items-center gap-1.5 text-[var(--brand)]">
          <span className="h-2 w-2 rounded-full bg-[var(--brand)]" aria-hidden />
          Effort (0–10)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Patient-reported pain and effort trend across logged sessions"
      >
        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={PAD_LEFT}
              x2={CHART_WIDTH - PAD_RIGHT}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={2} y={yFor(g) + 3} fontSize={9} fill="var(--muted-soft)">
              {g}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text
              key={p.sessionLogId}
              x={xFor(i, points.length)}
              y={CHART_HEIGHT - 6}
              fontSize={9}
              textAnchor="middle"
              fill="var(--muted-soft)"
            >
              {formatShortDate(p.completedAt)}
            </text>
          ) : null,
        )}

        {effortPath && <path d={effortPath} fill="none" stroke="var(--brand)" strokeWidth={2} />}
        {painPath && (
          <path d={painPath} fill="none" stroke="rgb(244 63 94)" strokeWidth={2} />
        )}

        {points.map((p, i) => (
          <g key={`${p.sessionLogId}-dots`}>
            {p.effortScore != null && (
              <circle cx={xFor(i, points.length)} cy={yFor(p.effortScore)} r={2.5} fill="var(--brand)" />
            )}
            {p.painScore != null && (
              <circle cx={xFor(i, points.length)} cy={yFor(p.painScore)} r={2.5} fill="rgb(244 63 94)" />
            )}
          </g>
        ))}
      </svg>

      <p className="mt-2 text-[10px] italic leading-relaxed text-[var(--muted-soft)]">
        Patient-reported values from session check-ins. Not a clinical score — therapist interpretation required.
      </p>
    </div>
  );
}
