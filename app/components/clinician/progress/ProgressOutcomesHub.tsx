"use client";

import Link from "next/link";
import { getCvReadyExercises } from "@/app/lib/cv/cv-ready-exercises";
import {
  CV_CLINICIAN_DISCLAIMER,
  formatCvDuration,
  formatCvRecordedAt,
  formatCvSource,
  formatCvTrackingSignal,
} from "@/app/lib/cv/cv-metrics-display";
import type { CaptureQualityLevel } from "@/app/lib/cv/capture-quality";
import type { ProgressOutcomesBundle } from "@/app/lib/progress/progress-outcomes-bundle";
import {
  PROGRESS_OUTCOMES_SAFETY_BANNER,
  PROGRESS_OUTCOMES_THERAPIST_REVIEW_LABEL,
  assessmentTypeDisplayLabel,
} from "@/app/lib/progress/progress-outcomes-bundle";

const QUALITY_BADGE_CLASS: Record<CaptureQualityLevel, string> = {
  high: "border-[#1D9E75]/35 bg-[#1D9E75]/12 text-[#5DCAA5]",
  medium: "border-[#EF9F27]/35 bg-[#EF9F27]/10 text-[#EF9F27]",
  low: "border-amber-500/35 bg-amber-500/10 text-amber-200",
};

type ProgressOutcomesHubProps = {
  bundle: ProgressOutcomesBundle;
};

function SectionShell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 scroll-mt-6"
    >
      <h2 className="text-[12px] font-medium text-[#F9FAFB]">{title}</h2>
      <p className="mb-4 mt-1 text-[11px] text-white/35">{description}</p>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic text-[#6B7280]">{children}</p>;
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2">
      <p className="text-[10px] text-white/35">{label}</p>
      <p
        className="mt-0.5 text-sm font-semibold text-[#5DCAA5]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}

export function ProgressOutcomesHub({ bundle }: ProgressOutcomesHubProps) {
  const exerciseNameById = Object.fromEntries(
    getCvReadyExercises().map((exercise) => [exercise.exerciseId, exercise.nameEn]),
  );

  const lastSessionAt =
    bundle.painTrend.length > 0
      ? bundle.painTrend[bundle.painTrend.length - 1]?.completedAt
      : null;

  const profileHref = `/clinician/patients/${bundle.patientId}`;
  const reportBase = `/clinician/assessment/report?patientId=${encodeURIComponent(bundle.patientId)}`;

  return (
    <div className="space-y-6">
      <div className="rounded-[8px] border border-amber-400/25 bg-amber-400/8 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-200/90">
          {PROGRESS_OUTCOMES_THERAPIST_REVIEW_LABEL}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/70">
          {PROGRESS_OUTCOMES_SAFETY_BANNER}
        </p>
      </div>

      <SectionShell
        id="session-activity"
        title="Session activity"
        description="Plan adherence counts from completed plan sessions. Factual activity only — therapist interpretation required."
      >
        {bundle.adherence ? (
          <div className="space-y-4">
            {bundle.planTitle && (
              <p className="text-[12px] text-white/55">
                Plan: <span className="font-semibold text-white/80">{bundle.planTitle}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile
                label="Sessions completed"
                value={`${bundle.adherence.completed} / ${bundle.adherence.total}`}
              />
              <MetricTile label="Adherence" value={`${bundle.adherence.progressPct}%`} />
              <MetricTile
                label="Logged sessions"
                value={String(bundle.painTrend.length)}
              />
              <MetricTile
                label="Last session logged"
                value={
                  lastSessionAt
                    ? formatCvRecordedAt(lastSessionAt)
                    : "—"
                }
              />
            </div>
            <Link
              href={`${profileHref}#rehabilitation-plan`}
              className="inline-flex text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
            >
              View plan &amp; sessions →
            </Link>
          </div>
        ) : (
          <EmptyNote>
            No treatment plan on file. Session activity will appear when a plan is assigned.
          </EmptyNote>
        )}
      </SectionShell>

      <SectionShell
        id="patient-reported-pain"
        title="Patient-reported pain"
        description="Patient-reported trends from session check-ins. Not a clinical score — therapist interpretation required."
      >
        {bundle.painTrend.length === 0 ? (
          <EmptyNote>
            No patient-reported pain entries yet. Data appears after the patient completes session check-ins.
          </EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#1E2D42] text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Session</th>
                  <th className="pb-2 pr-3 font-semibold">Pain before</th>
                  <th className="pb-2 pr-3 font-semibold">Pain after</th>
                  <th className="pb-2 font-semibold">Effort</th>
                </tr>
              </thead>
              <tbody>
                {bundle.painTrend.map((row) => (
                  <tr
                    key={row.sessionLogId}
                    className="border-b border-[#1E2D42]/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3 text-white/70">
                      {formatCvRecordedAt(row.completedAt)}
                    </td>
                    <td className="py-2.5 pr-3 text-white/70">
                      {row.sessionNumber != null ? `#${row.sessionNumber}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-white/80">
                      {row.painBefore != null ? `${row.painBefore}/10` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-white/80">
                      {row.painAfter != null ? `${row.painAfter}/10` : "—"}
                    </td>
                    <td className="py-2.5 text-white/80">
                      {row.effortScore != null ? `${row.effortScore}/10` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionShell>

      <SectionShell
        id="assessment-history"
        title="Assessment history"
        description="Submitted assessments for this patient. Derived observations from intake data — therapist interpretation required."
      >
        {bundle.assessments.length === 0 ? (
          <EmptyNote>
            No assessments on file. Send or record an assessment to populate this section.
          </EmptyNote>
        ) : (
          <ul className="divide-y divide-[#1E2D42]">
            {bundle.assessments.map((row) => (
              <li key={row.assessmentId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#F9FAFB]">
                    {assessmentTypeDisplayLabel(row.assessmentType)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">
                    {formatCvRecordedAt(row.submittedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
                    {row.painAtRest && <span>Pain at rest: {row.painAtRest}</span>}
                    {row.painOnMovement && (
                      <span>Pain on movement: {row.painOnMovement}</span>
                    )}
                    {row.bodyRegion && <span>Body region: {row.bodyRegion}</span>}
                  </div>
                </div>
                <Link
                  href={`${reportBase}&assessmentId=${encodeURIComponent(row.assessmentId)}`}
                  className="shrink-0 text-xs font-semibold text-[#5DCAA5] transition hover:text-[#1D9E75]"
                >
                  Open report →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionShell>

      <SectionShell
        id="camera-assisted-evidence"
        title="Camera-assisted evidence"
        description="Derived movement observations from optional camera-assisted sessions. Therapist interpretation required."
      >
        {bundle.cvEvidence.length === 0 ? (
          <EmptyNote>
            No camera-assisted evidence recorded yet. Sessions appear when CV-enabled exercises are completed.
          </EmptyNote>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-[#1E2D42]">
              {bundle.cvEvidence.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#F9FAFB]">
                      {exerciseNameById[row.exerciseId] ?? row.exerciseId}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#6B7280]">
                      {formatCvRecordedAt(row.recordedAt)} · {formatCvSource(row.source)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
                      <span>Duration: {formatCvDuration(row.sessionDurationS)}</span>
                      <span>
                        Reps: {row.repCount != null ? String(row.repCount) : "—"}
                      </span>
                      <span>
                        Tracking: {formatCvTrackingSignal(row.trackingQuality)}
                      </span>
                      <span>
                        Movement detected: {row.movementDetected ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[10px] leading-relaxed text-[#6B7280]">{CV_CLINICIAN_DISCLAIMER}</p>
          </div>
        )}
      </SectionShell>

      <SectionShell
        id="capture-quality-history"
        title="Capture quality history"
        description="Technical capture reliability only. Not movement quality or clinical assessment."
      >
        {bundle.captureQualityHistory.length === 0 ? (
          <EmptyNote>
            No capture quality records yet. Available when pilot capture quality is stored with a session.
          </EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#1E2D42] text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Exercise</th>
                  <th className="pb-2 pr-3 font-semibold">Reliability</th>
                  <th className="pb-2 font-semibold">Retest</th>
                </tr>
              </thead>
              <tbody>
                {bundle.captureQualityHistory.map((row) => (
                  <tr
                    key={row.cvMetricId}
                    className="border-b border-[#1E2D42]/60 last:border-0"
                  >
                    <td className="py-2.5 pr-3 text-white/70">
                      {formatCvRecordedAt(row.recordedAt)}
                    </td>
                    <td className="py-2.5 pr-3 text-white/80">
                      {exerciseNameById[row.exerciseId] ?? row.exerciseId}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${QUALITY_BADGE_CLASS[row.qualityLevel]}`}
                      >
                        {row.qualityLevel}
                      </span>
                    </td>
                    <td className="py-2.5 text-white/80">
                      {row.retestRecommended ? "Suggested" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionShell>
    </div>
  );
}
