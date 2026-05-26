import Link from "next/link";
import {
  formatCvDuration,
  formatCvMovementDetected,
  formatCvRecordedAt,
  formatCvSource,
  formatCvTrackingQuality,
  type CvSessionMetricPublic,
} from "@/app/lib/cv/cv-metrics-display";

type CvReviewSummaryProps = {
  metrics: CvSessionMetricPublic[];
  exerciseNameById: Record<string, string>;
  loading?: boolean;
  error?: boolean;
  showPatientLinks?: boolean;
  maxSessions?: number;
};

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">{label}</dt>
      <dd className="text-xs text-[#F9FAFB] sm:text-right">{value}</dd>
    </div>
  );
}

function SessionReviewCard({
  row,
  exerciseName,
  showPatientLink,
}: {
  row: CvSessionMetricPublic;
  exerciseName: string;
  showPatientLink: boolean;
}) {
  return (
    <article
      className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] p-4"
      style={{ borderWidth: "0.5px" }}
    >
      <dl className="space-y-2.5">
        <MetricRow label="Exercise" value={exerciseName} />
        <MetricRow label="Reps" value={row.repCount != null ? String(row.repCount) : "—"} />
        <MetricRow label="Duration" value={formatCvDuration(row.sessionDurationS)} />
        <MetricRow label="Tracking quality" value={formatCvTrackingQuality(row.trackingQuality)} />
        <MetricRow
          label="Movement detected"
          value={formatCvMovementDetected(row.movementDetected)}
        />
        <MetricRow label="Recorded" value={formatCvRecordedAt(row.recordedAt)} />
        <MetricRow label="Source" value={formatCvSource(row.source)} />
      </dl>
      {showPatientLink && row.patientId ? (
        <Link
          href={`/clinician/patients/${row.patientId}`}
          className="mt-3 inline-flex text-[11px] font-semibold text-[#5DCAA5] hover:text-[#1D9E75]"
        >
          Open patient profile →
        </Link>
      ) : null}
    </article>
  );
}

export function CvReviewSummary({
  metrics,
  exerciseNameById,
  loading = false,
  error = false,
  showPatientLinks = false,
  maxSessions = 5,
}: CvReviewSummaryProps) {
  const reviewMetrics = metrics.slice(0, maxSessions);

  return (
    <section className="mt-8">
      <p className="text-[10px] uppercase tracking-[0.06em] text-[#9CA3AF]">CV Review Summary</p>
      <p className="mb-2 mt-1 text-[11px] font-medium text-[#9CA3AF]">For clinician review</p>

      <div
        className="mb-4 rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3"
        style={{ borderWidth: "0.5px" }}
      >
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#6B7280]">
          <li>Derived movement metrics only</li>
          <li>Not clinically validated</li>
          <li>No video or body coordinates stored</li>
        </ul>
        <p className="mt-2 text-[10px] italic text-[#EF9F27]">
          Displayed values are recorded outputs from the CV prototype. They are not a clinical
          assessment and must not be used alone for treatment decisions.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-[#6B7280]">Loading review summary…</p>
      ) : error ? (
        <p className="text-xs text-rose-300">Could not load CV review summary.</p>
      ) : reviewMetrics.length === 0 ? (
        <p className="rounded-[8px] border border-[#1E2D42] bg-[#0F1825] px-4 py-6 text-center text-xs text-[#6B7280]">
          No saved CV sessions yet. Complete a session above to review derived metrics here.
        </p>
      ) : (
        <div className="space-y-3">
          {reviewMetrics.map((row, index) => (
            <div key={row.id}>
              {index === 0 ? (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#1D9E75]">
                  Latest session
                </p>
              ) : null}
              <SessionReviewCard
                row={row}
                exerciseName={exerciseNameById[row.exerciseId] ?? row.exerciseId}
                showPatientLink={showPatientLinks}
              />
            </div>
          ))}
          {metrics.length > maxSessions ? (
            <p className="text-[11px] text-[#6B7280]">
              Showing {maxSessions} of {metrics.length} recent sessions. See the table below for the
              full list.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
