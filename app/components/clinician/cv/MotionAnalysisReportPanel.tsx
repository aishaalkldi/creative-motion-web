"use client";

import type { ReactNode } from "react";
import type {
  MotionAnalysisConfidenceLevel,
  MotionAnalysisReport,
  MotionAnalysisSummaryLabel,
} from "@/app/lib/cv/motion-analysis-report";
import {
  formatMotionAnalysisTrackingSignal,
  MOTION_ANALYSIS_CAMERA_DISCLAIMER,
  MOTION_ANALYSIS_REPORT_TITLE,
  MOTION_ANALYSIS_REVIEW_BANNER,
  MOTION_ANALYSIS_RULES_BASED_LABEL,
  trackingSignalDotTone,
} from "@/app/lib/cv/motion-analysis-report";

const SUMMARY_BADGE_CLASS: Record<MotionAnalysisSummaryLabel, string> = {
  "Limited visibility": "border-amber-500/35 bg-amber-500/10 text-amber-200",
  "Review suggested": "border-[#EF9F27]/35 bg-[#EF9F27]/10 text-[#EF9F27]",
  "Movement data available": "border-[#1D9E75]/35 bg-[#1D9E75]/12 text-[#5DCAA5]",
  "Session completed": "border-[#1E2D42] bg-[#0F1825] text-[#9CA3AF]",
};

const CONFIDENCE_BADGE_CLASS: Record<MotionAnalysisConfidenceLevel, string> = {
  high: "border-[#1D9E75]/35 bg-[#1D9E75]/12 text-[#5DCAA5]",
  moderate: "border-[#EF9F27]/35 bg-[#EF9F27]/10 text-[#EF9F27]",
  low: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  limited: "border-rose-400/35 bg-rose-400/10 text-rose-200",
};

const TRACKING_DOT_CLASS = {
  good: "bg-[#1D9E75]",
  fair: "bg-[#EF9F27]",
  poor: "bg-rose-400",
  unknown: "bg-[#6B7280]",
} as const;

const SUPPORT_BADGE_CLASS = {
  supported: "text-[#5DCAA5]",
  moderate: "text-[#EF9F27]",
  limited: "text-rose-300",
} as const;

type MotionAnalysisReportPanelProps = {
  report: MotionAnalysisReport;
};

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
      {children}
    </p>
  );
}

function formatTimelineAt(atSecond: number | null): string | null {
  if (atSecond === null) return null;
  const mm = Math.floor(atSecond / 60);
  const ss = atSecond % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function PilotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">{label}</p>
      <p
        className="mt-0.5 text-xs font-semibold text-[#F9FAFB]"
        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
      >
        {value}
      </p>
    </div>
  );
}

function formatNullableSeconds(value: number | null): string {
  if (value === null) return "—";
  return `${value}s`;
}

function TrackingSignalRow({ signal }: { signal: string }) {
  const tone = trackingSignalDotTone(signal);
  const dotClass = TRACKING_DOT_CLASS[tone];

  return (
    <div className="flex items-center justify-between gap-3 rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Tracking signal</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F9FAFB]">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        {formatMotionAnalysisTrackingSignal(signal)}
      </span>
    </div>
  );
}

const QUALITY_LABEL_CLASS = {
  Consistent: "text-[#5DCAA5]",
  Moderate: "text-[#EF9F27]",
  Variable: "text-rose-300",
  Incomplete: "text-rose-300",
  Clear: "text-[#5DCAA5]",
  "Mostly clear": "text-[#EF9F27]",
  Unclear: "text-rose-300",
  "Insufficient data": "text-[#9CA3AF]",
} as const;

function QualityLabel({ label }: { label: string }) {
  const tone = QUALITY_LABEL_CLASS[label as keyof typeof QUALITY_LABEL_CLASS] ?? "text-[#F9FAFB]";
  return <span className={`font-medium ${tone}`}>{label}</span>;
}

export function MotionAnalysisReportPanel({ report }: MotionAnalysisReportPanelProps) {
  const header = report.reportHeader;
  const snapshot = report.clinicalSnapshot;
  const movementQuality = report.movementQuality;
  const smtPilot = report.smtPilot;
  const kinesiology = report.kinesiologyInsight;
  const phaseInterpretation = report.phaseInterpretation;
  const clinicalObservations = report.clinicalObservations;
  const reviewGrouped = report.reviewNextGrouped;
  const isLegacy = report.reportMode === "legacy";
  const badgeClass = SUMMARY_BADGE_CLASS[report.summaryLabel];

  return (
    <details
      open
      className="mt-3 overflow-hidden rounded-[8px] border border-[#1E2D42] bg-[#070D16]"
      style={{ borderWidth: "0.5px" }}
    >
      <summary className="cursor-pointer list-none border-b border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#F9FAFB]">{MOTION_ANALYSIS_REPORT_TITLE}</span>
          <span className="rounded-[4px] border border-[#1E2D42] bg-[#0F1825] px-2 py-0.5 text-[9px] font-medium text-[#9CA3AF]">
            {MOTION_ANALYSIS_RULES_BASED_LABEL}
          </span>
          <span
            className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
          >
            {report.summaryLabel}
          </span>
        </span>
      </summary>

      <div className="space-y-2 px-3 py-2.5">
        {header ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-gradient-to-br from-[#0B1220] to-[#070D16] px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#F9FAFB]">{header.exerciseLabel}</p>
                {header.recordedAtLabel ? (
                  <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{header.recordedAtLabel}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-[4px] border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CONFIDENCE_BADGE_CLASS[header.confidenceLevel]}`}
                >
                  {header.confidenceLabel}
                </span>
                {header.reviewRequired ? (
                  <span className="rounded-[4px] border border-[#EF9F27]/35 bg-[#EF9F27]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#EF9F27]">
                    Review required
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {header.metricLabel ? (
                <div className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Session metric</p>
                  <p className="mt-0.5 text-xs font-medium text-[#F9FAFB]">{header.metricLabel}</p>
                </div>
              ) : null}
              <div className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Tracking quality</p>
                <p className="mt-0.5 text-xs font-medium text-[#F9FAFB]">{header.trackingLabel}</p>
              </div>
            </div>
          </div>
        ) : null}

        {snapshot ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
            <SectionHeading>Clinical snapshot</SectionHeading>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#D1D5DB]">{snapshot.movementCaptured}</p>

            {snapshot.phasesDetected ? (
              <p className="mt-2 text-[10px] leading-relaxed text-[#9CA3AF]">
                <span className="font-medium text-[#6B7280]">Phases detected: </span>
                {snapshot.phasesDetected}
              </p>
            ) : isLegacy ? (
              <p className="mt-2 text-[10px] italic text-[#6B7280]">
                Phase distribution not available for this session.
              </p>
            ) : null}

            <p className={`mt-2 text-[10px] font-medium ${SUPPORT_BADGE_CLASS[snapshot.interpretationSupport]}`}>
              Interpretation support: {snapshot.interpretationSupport}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-[#9CA3AF]">
              {snapshot.interpretationSupportNote}
            </p>

            {snapshot.keyObservations.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[#D1D5DB]">
                {snapshot.keyObservations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {movementQuality ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
            <SectionHeading>Movement quality</SectionHeading>
            <p className="mt-1 text-[9px] leading-relaxed text-[#6B7280]">
              Camera-derived movement quality signals — assistive summary only, not a clinical score.
            </p>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <PilotMetric
                label="Average repetition time"
                value={formatNullableSeconds(movementQuality.averageRepTimeSec)}
              />
              <PilotMetric
                label="Fastest repetition"
                value={formatNullableSeconds(movementQuality.fastestRepTimeSec)}
              />
              <PilotMetric
                label="Slowest repetition"
                value={formatNullableSeconds(movementQuality.slowestRepTimeSec)}
              />
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[5px] border border-[#1E2D42] bg-[#070D16] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Pacing consistency</p>
                <p className="mt-0.5 text-xs">
                  <QualityLabel label={movementQuality.pacingConsistency} />
                </p>
              </div>
              <div className="rounded-[5px] border border-[#1E2D42] bg-[#070D16] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Phase consistency</p>
                <p className="mt-0.5 text-xs">
                  <QualityLabel label={movementQuality.phaseConsistency} />
                </p>
              </div>
              <div className="rounded-[5px] border border-[#1E2D42] bg-[#070D16] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Completion clarity</p>
                <p className="mt-0.5 text-xs">
                  <QualityLabel label={movementQuality.completionClarity} />
                </p>
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <PilotMetric
                label="Observed standing phase"
                value={
                  movementQuality.observedStandingPhaseRatio !== null
                    ? `${movementQuality.observedStandingPhaseRatio}%`
                    : "—"
                }
              />
              <PilotMetric
                label="Observed returning phase"
                value={
                  movementQuality.observedReturningPhaseRatio !== null
                    ? `${movementQuality.observedReturningPhaseRatio}%`
                    : "—"
                }
              />
            </div>

            {movementQuality.qualitySignals.length > 0 ? (
              <div className="mt-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">
                  Movement quality signals
                </p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[#D1D5DB]">
                  {movementQuality.qualitySignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {movementQuality.clinicianReviewFocus.length > 0 ? (
              <div className="mt-2">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">
                  Clinician review focus
                </p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[#D1D5DB]">
                  {movementQuality.clinicianReviewFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isLegacy && phaseInterpretation && phaseInterpretation.length > 0 ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
            <SectionHeading>Movement interpretation</SectionHeading>
            <p className="mt-1 text-[9px] leading-relaxed text-[#6B7280]">
              Assistive phase distribution from captured snapshots — not a clinical score.
            </p>
            <ul className="mt-2 space-y-1">
              {phaseInterpretation.map((phase) => (
                <li
                  key={phase.phaseId}
                  className="flex justify-between gap-2 text-[10px] text-[#D1D5DB]"
                >
                  <span className="text-[#9CA3AF]">{phase.phaseLabel}</span>
                  <span
                    className="shrink-0 font-medium text-[#F9FAFB]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    {phase.snapshotPct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isLegacy && clinicalObservations && clinicalObservations.length > 0 ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
            <SectionHeading>Session observations</SectionHeading>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-[10px] leading-snug text-[#D1D5DB]">
              {clinicalObservations.map((observation) => (
                <li key={observation.id}>{observation.text}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {kinesiology ? (
          <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
            <SectionHeading>Kinesiology insight</SectionHeading>
            <p className="mt-1 text-[9px] leading-relaxed text-[#6B7280]">
              Expected movement context for clinician review — not a diagnosis or muscle assessment.
            </p>

            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Expected primary muscles</p>
              <ul className="mt-0.5 list-inside list-disc text-[10px] leading-snug text-[#D1D5DB]">
                {kinesiology.primaryMuscles.map((muscle) => (
                  <li key={muscle}>{muscle}</li>
                ))}
              </ul>
            </div>

            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Expected movement phases</p>
              <ul className="mt-0.5 space-y-1">
                {kinesiology.movementPhases.map((phase) => (
                  <li key={phase.id} className="text-[10px] leading-snug text-[#D1D5DB]">
                    <span className="font-medium text-[#F9FAFB]">{phase.label}</span>
                    <span className="text-[#9CA3AF]"> — {phase.description}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Expected movement strategy</p>
              <ul className="mt-0.5 list-inside list-disc text-[10px] leading-snug text-[#D1D5DB]">
                {kinesiology.movementStrategy.map((pattern) => (
                  <li key={pattern}>{pattern}</li>
                ))}
              </ul>
            </div>

            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Functional relevance</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#D1D5DB]">
                {kinesiology.functionalRelevance}
              </p>
            </div>
          </div>
        ) : null}

        {reviewGrouped && reviewGrouped.length > 0 ? (
          <div className="rounded-[6px] border border-[#EF9F27]/25 bg-[#EF9F27]/5 px-3 py-2.5">
            <SectionHeading>Review next</SectionHeading>
            <div className="mt-1.5 space-y-2.5">
              {reviewGrouped.map((group) => (
                <div key={group.category}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#EF9F27]">
                    {group.categoryLabel}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[#D1D5DB]">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
          <SectionHeading>Confidence &amp; limitations</SectionHeading>
          <p className="mt-1 text-[10px] leading-relaxed text-[#6B7280]">{MOTION_ANALYSIS_CAMERA_DISCLAIMER}</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[#9CA3AF]">
            {report.confidenceLimitations.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>

        {smtPilot ? (
          <details className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2">
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF] marker:content-none [&::-webkit-details-marker]:hidden">
              Capture evidence
            </summary>

            <div className="mt-2 space-y-2 border-t border-[#1E2D42] pt-2">
              {smtPilot.showReviewBanner ? (
                <p className="rounded-[5px] border border-[#EF9F27]/35 bg-[#EF9F27]/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-[#EF9F27]">
                  {MOTION_ANALYSIS_REVIEW_BANNER}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <PilotMetric label="Snapshots" value={String(smtPilot.snapshotCount)} />
                <PilotMetric label="Complete reps" value={String(smtPilot.completeReps)} />
                <PilotMetric label="Unclear reps" value={String(smtPilot.unclearReps)} />
              </div>
              <TrackingSignalRow signal={smtPilot.trackingSignal} />

              {smtPilot.repTimings ? (
                <div className="grid grid-cols-3 gap-2">
                  <PilotMetric label="Avg rep" value={formatNullableSeconds(smtPilot.repTimings.avgS)} />
                  <PilotMetric label="Fastest rep" value={formatNullableSeconds(smtPilot.repTimings.fastestS)} />
                  <PilotMetric label="Slowest rep" value={formatNullableSeconds(smtPilot.repTimings.slowestS)} />
                </div>
              ) : null}

              {smtPilot.visibilityRatios ? (
                <div className="grid grid-cols-3 gap-2">
                  <PilotMetric label="Hip visible" value={`${smtPilot.visibilityRatios.hip}%`} />
                  <PilotMetric label="Knee visible" value={`${smtPilot.visibilityRatios.knee}%`} />
                  <PilotMetric label="Ankle visible" value={`${smtPilot.visibilityRatios.ankle}%`} />
                </div>
              ) : null}

              {smtPilot.clinicianFlags && smtPilot.clinicianFlags.length > 0 ? (
                <div className="rounded-[5px] border border-[#1E2D42] bg-[#070D16] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Capture flags</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-[#D1D5DB]">
                    {smtPilot.clinicianFlags.map((flag) => (
                      <li key={flag} className="capitalize">
                        {flag.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {report.movementTimeline.length > 0 ? (
                <ol className="space-y-1.5">
                  {report.movementTimeline.map((item, index) => {
                    const at = formatTimelineAt(item.atSecond);
                    return (
                      <li
                        key={`${item.label}-${index}`}
                        className="flex gap-2 text-[11px] leading-snug text-[#D1D5DB]"
                      >
                        {at ? (
                          <span
                            className="shrink-0 tabular-nums text-[#6B7280]"
                            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                          >
                            {at}
                          </span>
                        ) : (
                          <span className="w-[42px] shrink-0 text-[#4B5563]">—</span>
                        )}
                        <span>
                          <span className="font-medium text-[#F9FAFB]">{item.label}</span>
                          {item.detail ? (
                            <span className="text-[#9CA3AF]"> — {item.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>
          </details>
        ) : report.movementTimeline.length > 0 ? (
          <details className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2">
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF] marker:content-none [&::-webkit-details-marker]:hidden">
              Capture evidence
            </summary>
            <ol className="mt-2 space-y-1.5 border-t border-[#1E2D42] pt-2">
              {report.movementTimeline.map((item, index) => {
                const at = formatTimelineAt(item.atSecond);
                return (
                  <li
                    key={`${item.label}-${index}`}
                    className="flex gap-2 text-[11px] leading-snug text-[#D1D5DB]"
                  >
                    {at ? (
                      <span
                        className="shrink-0 tabular-nums text-[#6B7280]"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {at}
                      </span>
                    ) : (
                      <span className="w-[42px] shrink-0 text-[#4B5563]">—</span>
                    )}
                    <span>
                      <span className="font-medium text-[#F9FAFB]">{item.label}</span>
                      {item.detail ? (
                        <span className="text-[#9CA3AF]"> — {item.detail}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </details>
        ) : null}
      </div>
    </details>
  );
}
