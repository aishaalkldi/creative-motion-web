import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";
import {
  cvDurationMetricLabel,
  cvRepMetricLabel,
  formatCvDuration,
  formatCvMovementDetected,
  formatCvRecordedAt,
  formatCvSource,
  formatCvTrackingQuality,
} from "@/app/lib/cv/cv-metrics-display";
import { buildAssessmentMovementSummary } from "@/app/lib/cv/assessment-movement-summary";
import { SECTION_CV_MOVEMENT_OBSERVATIONS, THERAPIST_REVIEW_BANNER } from "@/app/lib/reports/clinical-report-copy";

type Props = {
  metrics: CvSessionMetricPublic[];
  exerciseNameById: Record<string, string>;
  variant?: "screen" | "print";
};

function MetricGrid({
  rows,
  variant,
}: {
  rows: { label: string; value: string }[];
  variant: "screen" | "print";
}) {
  if (rows.length === 0) return null;
  const cellClass =
    variant === "print"
      ? "border border-gray-200 bg-gray-50 px-3 py-2"
      : "rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2";
  const labelClass =
    variant === "print"
      ? "text-[10px] font-bold uppercase tracking-wider text-gray-500"
      : "text-[10px] uppercase tracking-[0.06em] text-[#6B7280]";
  const valueClass =
    variant === "print" ? "mt-0.5 text-sm font-semibold text-gray-900" : "mt-0.5 text-xs font-semibold text-[#F9FAFB]";

  return (
    <dl className={`grid gap-2 ${variant === "print" ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      {rows.map((row) => (
        <div key={row.label} className={cellClass}>
          <dt className={labelClass}>{row.label}</dt>
          <dd className={valueClass}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CaptureBlock({
  row,
  exerciseName,
  variant,
}: {
  row: CvSessionMetricPublic;
  exerciseName: string;
  variant: "screen" | "print";
}) {
  const summary = buildAssessmentMovementSummary(row);
  const repLabel = cvRepMetricLabel(row.exerciseId);
  const baseRows = [
    { label: "Exercise", value: exerciseName },
    { label: "Recorded", value: formatCvRecordedAt(row.recordedAt) },
    { label: "Source", value: formatCvSource(row.source) },
    ...(repLabel
      ? [{ label: repLabel, value: row.repCount != null ? String(row.repCount) : "—" }]
      : []),
    { label: cvDurationMetricLabel(row.exerciseId), value: formatCvDuration(row.sessionDurationS) },
    { label: "Tracking quality", value: formatCvTrackingQuality(row.trackingQuality) },
    { label: "Movement detected", value: formatCvMovementDetected(row.movementDetected) },
  ];

  const boxClass =
    variant === "print"
      ? "print-document-section border border-gray-200"
      : "rounded-[8px] border border-[#1E2D42] bg-[#0F1825] p-4";

  return (
    <article className={boxClass}>
      <h3
        className={
          variant === "print"
            ? "border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700"
            : "text-sm font-semibold text-white"
        }
      >
        {exerciseName}
      </h3>
      <div className={variant === "print" ? "space-y-3 p-3" : "mt-3 space-y-3"}>
        <MetricGrid rows={baseRows} variant={variant} />
        {summary ? (
          <div className={variant === "print" ? "space-y-2 text-sm text-gray-800" : "space-y-2"}>
            <p
              className={
                variant === "print"
                  ? "text-[10px] font-semibold uppercase tracking-wider text-gray-500"
                  : "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]"
              }
            >
              Assistive interpretation
            </p>
            <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-[#D1D5DB] print:text-gray-800">
              {summary.interpretationLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function CvCapturesClinicalSection({
  metrics,
  exerciseNameById,
  variant = "screen",
}: Props) {
  if (metrics.length === 0) {
    if (variant === "print") return null;
    return (
      <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
        <h2 className="text-base font-bold text-white">{SECTION_CV_MOVEMENT_OBSERVATIONS}</h2>
        <p className="mt-2 text-sm text-white/40">
          No camera-assisted movement observations are linked to this patient yet.
        </p>
      </section>
    );
  }

  const bannerClass =
    variant === "print"
      ? "rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900"
      : "rounded-[6px] border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100";

  return (
    <section className={variant === "print" ? "space-y-3" : "space-y-4"}>
      {variant === "screen" ? (
        <>
          <h2 className="text-base font-bold text-white">{SECTION_CV_MOVEMENT_OBSERVATIONS}</h2>
          <p className="text-xs leading-relaxed text-white/40">{THERAPIST_REVIEW_BANNER}</p>
        </>
      ) : null}
      {variant === "print" ? (
        <p className={bannerClass}>{THERAPIST_REVIEW_BANNER}</p>
      ) : null}
      <div className="space-y-3">
        {metrics.map((row) => (
          <CaptureBlock
            key={row.id}
            row={row}
            exerciseName={exerciseNameById[row.exerciseId] ?? row.exerciseId}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
