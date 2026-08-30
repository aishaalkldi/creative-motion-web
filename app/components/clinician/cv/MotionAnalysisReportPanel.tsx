"use client";

import type { ReactNode } from "react";
import type {
  MotionAnalysisConfidenceLevel,
  MotionAnalysisReport,
  MotionAnalysisSummaryLabel,
  MotionAnalysisTimingMetricLabels,
} from "@/app/lib/cv/motion-analysis-report";
import type { StsBiomechanicalFlagConfidence } from "@/app/lib/cv/sts-biomechanical-flags";
import {
  POSTURAL_ALIGNMENT_PROXY_DISCLAIMER,
  POSTURAL_ALIGNMENT_PROXY_LABEL,
} from "@/app/lib/cv/postural-alignment-proxy";
import {
  formatMotionAnalysisTrackingSignal,
  MOTION_ANALYSIS_CAMERA_DISCLAIMER,
  MOTION_ANALYSIS_REPORT_TITLE,
  MOTION_ANALYSIS_REVIEW_BANNER,
  MOTION_ANALYSIS_RULES_BASED_LABEL,
  trackingSignalDotTone,
} from "@/app/lib/cv/motion-analysis-report";
import {
  HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE,
  HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/heel-raise-motion-pilot-record";
import {
  FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE,
  FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/functional-reach-motion-pilot-record";
import {
  LATERAL_STEP_CYCLE_TIMING_ESTIMATED_NOTE,
  LATERAL_STEP_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/lateral-step-motion-pilot-record";
import {
  STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE,
  STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/step-up-motion-pilot-record";
import {
  MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE,
  MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL,
} from "@/app/lib/cv/mini-squat-motion-pilot-record";
import {
  NO_TIMELINE_SNAPSHOTS_CLINICIAN_NOTE,
  NO_TIMELINE_SNAPSHOTS_FLAG,
} from "@/app/lib/cv/patient-cv-capture-reliability";
import {
  CV_EVIDENCE_CLINICIAN_REVIEW_NOTE,
  CV_EVIDENCE_LIMITED_HEADLINE,
  CV_EVIDENCE_REP_ASSISTIVE_NOTE,
  CV_EVIDENCE_UNABLE_JOINT_NOTE,
} from "@/app/lib/cv/cv-evidence-integrity-gate";
import {
  buildCaptureFlagsSummary,
  hasPersistedFunctionalReachPhaseRatios,
  hasPersistedHeelRaisePhaseRatios,
  hasPersistedMiniSquatPhaseRatios,
  hasPersistedLateralStepPhaseRatios,
  hasPersistedStepUpPhaseRatios,
  isSynthesizedFunctionalReachEvidence,
  isSynthesizedHeelRaiseEvidence,
  isSynthesizedLateralStepEvidence,
  isSynthesizedMiniSquatEvidence,
  isSynthesizedStepUpEvidence,
  isStsPolishedReport,
  MOVEMENT_TIMING_PHASE_REVIEW_SUBTITLE,
  MOVEMENT_TIMING_PHASE_REVIEW_TITLE,
  resolveCaptureEvidenceCycleMetricLabel,
  resolveCaptureEvidenceTimingLabels,
} from "@/app/lib/cv/motion-analysis-report-present";
import { CaptureQualitySection, type CaptureReliabilityContext } from "@/app/components/clinician/cv/CaptureQualitySection";

const SUMMARY_BADGE_CLASS: Record<MotionAnalysisSummaryLabel, string> = {
  "Limited visibility": "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  "Review suggested": "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  "Movement data available": "border-[var(--brand)]/35 bg-[var(--brand)]/12 text-[var(--brand)]",
  "Session completed": "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
};

const CONFIDENCE_BADGE_CLASS: Record<MotionAnalysisConfidenceLevel, string> = {
  high: "border-[var(--brand)]/35 bg-[var(--brand)]/12 text-[var(--brand)]",
  moderate: "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  low: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  limited: "border-rose-400/35 bg-rose-400/10 text-rose-200",
};

const TRACKING_DOT_CLASS = {
  good: "bg-[var(--brand)]",
  fair: "bg-amber-500",
  poor: "bg-rose-400",
  unknown: "bg-[var(--muted-soft)]",
} as const;

const SUPPORT_BADGE_CLASS = {
  supported: "text-[var(--brand)]",
  moderate: "text-amber-700 dark:text-amber-400",
  limited: "text-rose-700 dark:text-rose-300",
} as const;

const DEFAULT_TIMING_LABELS: MotionAnalysisTimingMetricLabels = {
  average: "Average repetition time",
  fastest: "Fastest repetition",
  slowest: "Slowest repetition",
};

type MotionAnalysisReportPanelProps = {
  report: MotionAnalysisReport;
};

function stsCaptureReliabilityContext(
  report: MotionAnalysisReport,
): CaptureReliabilityContext | null {
  const pilot = report.smtPilot;
  if (!pilot) return null;
  return {
    visibilityRatios: pilot.visibilityRatios,
    completeReps: pilot.completeReps,
    unclearReps: pilot.unclearReps,
    clinicianFlags: pilot.clinicianFlags,
  };
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
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
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">{label}</p>
      <p
        className="mt-0.5 text-xs font-semibold text-[var(--foreground)]"
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
    <div className="flex items-center justify-between gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Tracking signal</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        {formatMotionAnalysisTrackingSignal(signal)}
      </span>
    </div>
  );
}

const QUALITY_LABEL_CLASS = {
  Consistent: "text-[var(--brand)]",
  Moderate: "text-amber-700 dark:text-amber-400",
  Variable: "text-rose-700 dark:text-rose-300",
  Incomplete: "text-rose-700 dark:text-rose-300",
  Clear: "text-[var(--brand)]",
  "Mostly clear": "text-amber-700 dark:text-amber-400",
  Unclear: "text-rose-700 dark:text-rose-300",
  "Insufficient data": "text-[var(--muted)]",
} as const;

function QualityLabel({ label }: { label: string }) {
  const tone = QUALITY_LABEL_CLASS[label as keyof typeof QUALITY_LABEL_CLASS] ?? "text-[var(--foreground)]";
  return <span className={`font-medium ${tone}`}>{label}</span>;
}

function ReportHeaderStrip({ report }: { report: MotionAnalysisReport }) {
  const header = report.reportHeader;
  if (!header) return null;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--foreground)]">{header.exerciseLabel}</p>
          {header.recordedAtLabel ? (
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">{header.recordedAtLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`rounded-[4px] border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CONFIDENCE_BADGE_CLASS[header.confidenceLevel]}`}
          >
            {header.confidenceLabel}
          </span>
          {header.reviewRequired ? (
            <span className="rounded-[4px] border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Review required
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MovementTimingPhaseReviewSection({
  report,
  compact,
}: {
  report: MotionAnalysisReport;
  compact?: boolean;
}) {
  const movementQuality = report.movementQuality;
  if (!movementQuality) return null;

  const exerciseId =
    report.sessionSummary?.exerciseId ?? report.kinesiologyContext?.exerciseId ?? null;
  const isMiniSquat = exerciseId === "mini-squat";
  const isHeelRaise = exerciseId === "heel-raise";
  const isStepUp = exerciseId === "step-up";
  const isLateralStep = exerciseId === "lateral-step";
  const isFunctionalReach = exerciseId === "functional-reach";
  const isRepCycleExercise =
    isMiniSquat || isHeelRaise || isStepUp || isLateralStep || isFunctionalReach;
  const synthesizedMiniSquat = isSynthesizedMiniSquatEvidence(report);
  const synthesizedHeelRaise = isSynthesizedHeelRaiseEvidence(report);
  const synthesizedStepUp = isSynthesizedStepUpEvidence(report);
  const synthesizedLateralStep = isSynthesizedLateralStepEvidence(report);
  const synthesizedFunctionalReach = isSynthesizedFunctionalReachEvidence(report);
  const synthesizedLimitedEvidence =
    synthesizedMiniSquat ||
    synthesizedHeelRaise ||
    synthesizedStepUp ||
    synthesizedLateralStep ||
    synthesizedFunctionalReach;
  const showMiniSquatPhaseRatios = isMiniSquat && hasPersistedMiniSquatPhaseRatios(report);
  const showHeelRaisePhaseRatios = isHeelRaise && hasPersistedHeelRaisePhaseRatios(report);
  const showStepUpPhaseRatios = isStepUp && hasPersistedStepUpPhaseRatios(report);
  const showLateralStepPhaseRatios =
    isLateralStep && hasPersistedLateralStepPhaseRatios(report);
  const showFunctionalReachPhaseRatios =
    isFunctionalReach && hasPersistedFunctionalReachPhaseRatios(report);
  const showRepCyclePhaseRatios =
    showMiniSquatPhaseRatios ||
    showHeelRaisePhaseRatios ||
    showStepUpPhaseRatios ||
    showLateralStepPhaseRatios ||
    showFunctionalReachPhaseRatios;
  const timingLabels = report.timingMetricLabels ?? DEFAULT_TIMING_LABELS;
  const completionLabel = isRepCycleExercise ? "Cycle detection clarity" : "Completion clarity";
  const secondaryPhaseLabel = isRepCycleExercise
    ? "Observed lowering phase"
    : "Observed returning phase";
  const averageTimingLabel = synthesizedLimitedEvidence
    ? "Estimated avg cycle interval"
    : timingLabels.average;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>{MOVEMENT_TIMING_PHASE_REVIEW_TITLE}</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        {MOVEMENT_TIMING_PHASE_REVIEW_SUBTITLE}
      </p>

      {synthesizedLimitedEvidence ? (
        <p className="mt-2 rounded-[5px] border border-amber-400/25 bg-amber-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {synthesizedFunctionalReach
              ? FUNCTIONAL_REACH_LIMITED_MOTION_EVIDENCE_LABEL
              : synthesizedLateralStep
              ? LATERAL_STEP_LIMITED_MOTION_EVIDENCE_LABEL
              : synthesizedStepUp
                ? STEP_UP_LIMITED_MOTION_EVIDENCE_LABEL
                : synthesizedHeelRaise
                  ? HEEL_RAISE_LIMITED_MOTION_EVIDENCE_LABEL
                  : MINI_SQUAT_LIMITED_MOTION_EVIDENCE_LABEL}
            .{" "}
          </span>
          {synthesizedFunctionalReach
            ? FUNCTIONAL_REACH_CYCLE_TIMING_ESTIMATED_NOTE
            : synthesizedLateralStep
            ? LATERAL_STEP_CYCLE_TIMING_ESTIMATED_NOTE
            : synthesizedStepUp
              ? STEP_UP_CYCLE_TIMING_ESTIMATED_NOTE
              : synthesizedHeelRaise
                ? HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE
                : MINI_SQUAT_CYCLE_TIMING_ESTIMATED_NOTE}
        </p>
      ) : null}

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <PilotMetric
          label={averageTimingLabel}
          value={formatNullableSeconds(movementQuality.averageRepTimeSec)}
        />
        {!synthesizedLimitedEvidence ? (
          <>
            <PilotMetric
              label={timingLabels.fastest}
              value={formatNullableSeconds(movementQuality.fastestRepTimeSec)}
            />
            <PilotMetric
              label={timingLabels.slowest}
              value={formatNullableSeconds(movementQuality.slowestRepTimeSec)}
            />
          </>
        ) : null}
      </div>

      <div className={`mt-2 grid gap-2 ${synthesizedLimitedEvidence ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
        {!synthesizedLimitedEvidence ? (
          <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Pacing consistency</p>
            <p className="mt-0.5 text-xs">
              <QualityLabel label={movementQuality.pacingConsistency} />
            </p>
          </div>
        ) : null}
        {showRepCyclePhaseRatios || !isRepCycleExercise ? (
          <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Phase consistency</p>
            <p className="mt-0.5 text-xs">
              <QualityLabel label={movementQuality.phaseConsistency} />
            </p>
          </div>
        ) : null}
        <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">{completionLabel}</p>
          <p className="mt-0.5 text-xs">
            <QualityLabel label={movementQuality.completionClarity} />
          </p>
        </div>
      </div>

      {showRepCyclePhaseRatios ||
      (!isRepCycleExercise && movementQuality.observedStandingPhaseRatio !== null) ? (
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
            label={secondaryPhaseLabel}
            value={
              movementQuality.observedReturningPhaseRatio !== null
                ? `${movementQuality.observedReturningPhaseRatio}%`
                : "—"
            }
          />
        </div>
      ) : null}

      {!compact && movementQuality.qualitySignals.length > 0 ? (
        <div className="mt-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Timing &amp; phase signals</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
            {movementQuality.qualitySignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && movementQuality.clinicianReviewFocus.length > 0 ? (
        <div className="mt-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Clinician review focus</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
            {movementQuality.clinicianReviewFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const STS_FLAG_CONFIDENCE_CLASS: Record<StsBiomechanicalFlagConfidence, string> = {
  high: "border-[var(--brand)]/35 bg-[var(--brand)]/10 text-[var(--brand)]",
  medium: "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  low: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]",
};

function StsMovementAttemptsSection({ report }: { report: MotionAnalysisReport }) {
  const attempts = report.stsAttemptSummaries;
  if (!attempts || attempts.length === 0) return null;

  const labelForType = (type: string): string => {
    if (type === "complete") return "Complete movement attempt";
    if (type === "partial") return "Partial movement attempt";
    return "Unclear attempt";
  };

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Sit-to-Stand movement attempts</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        Camera-assisted movement evidence only — not a clinical score. Clinician review required.
      </p>
      <ul className="mt-2.5 space-y-2.5">
        {attempts.map((attempt) => (
          <li
            key={attempt.attemptIndex}
            className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2"
          >
            <p className="text-[11px] font-semibold text-[var(--foreground)]">
              {labelForType(attempt.attemptType)} #{attempt.attemptIndex}
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
              <li>Rising detected: {attempt.risingDetected ? "yes" : "no"}</li>
              <li>Standing phase confirmed: {attempt.standingReached ? "yes" : "no"}</li>
              <li>Returning detected: {attempt.returningDetected ? "yes" : "no"}</li>
              <li>Seated return confirmed: {attempt.seatedReturnReached ? "yes" : "no"}</li>
            </ul>
            {attempt.reason ? (
              <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">{attempt.reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PosturalAlignmentProxySection({ report }: { report: MotionAnalysisReport }) {
  const alignment = report.posturalAlignmentProxy;
  if (!alignment || alignment.suppressed || alignment.observations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SectionHeading>{POSTURAL_ALIGNMENT_PROXY_LABEL}</SectionHeading>
        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Estimated proxy
        </span>
        <span className="rounded-[4px] border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Clinician review required
        </span>
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        {alignment.sectionNote || POSTURAL_ALIGNMENT_PROXY_DISCLAIMER}
      </p>

      <ul className="mt-2.5 space-y-2.5">
        {alignment.observations.map((observation) => (
          <li
            key={observation.id}
            className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2"
          >
            <p className="text-[11px] font-semibold text-[var(--foreground)]">{observation.pattern}</p>
            {observation.phaseContext ? (
              <p className="mt-1 text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Phase context: {observation.phaseContext}
              </p>
            ) : null}
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">{observation.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StsBiomechanicalFlagsSection({ report }: { report: MotionAnalysisReport }) {
  const stsFlags = report.stsBiomechanicalFlags;
  if (!stsFlags || stsFlags.flags.length === 0) return null;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Sit-to-Stand movement observations</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">{stsFlags.sectionNote}</p>

      <ul className="mt-2.5 space-y-2.5">
        {stsFlags.flags.map((flag) => (
          <li
            key={flag.id}
            className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold text-[var(--foreground)]">{flag.title}</p>
              <span
                className={`rounded-[4px] border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STS_FLAG_CONFIDENCE_CLASS[flag.confidence]}`}
              >
                {flag.confidence} confidence
              </span>
              <span className="rounded-[4px] border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Clinician review required
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
              <span className="font-medium text-[var(--muted)]">Observed pattern: </span>
              {flag.observedPattern}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
              <span className="font-medium text-[var(--muted)]">Flagged because: </span>
              {flag.flaggedBecause}
            </p>
            <p className="mt-1 text-[9px] italic text-[var(--muted)]">{flag.disclaimer}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BiomechanicalContributionSection({
  report,
  compact,
}: {
  report: MotionAnalysisReport;
  compact?: boolean;
}) {
  const review = report.biomechanicalContributionReview;
  const compactReview = report.biomechanicalContributionReviewCompact;
  if (!review) return null;

  if (compact && compactReview) {
    return (
      <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
        <SectionHeading>Biomechanical contribution review</SectionHeading>
        <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
          Rules-based biomechanical context — not a diagnosis or muscle assessment.
        </p>

        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-[var(--muted)]">Observed pattern: </span>
          {compactReview.observedPattern}
        </p>

        {compactReview.possibleContributors.length > 0 ? (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Possible contributors
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
              {compactReview.possibleContributors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {compactReview.muscleDemandContext.length > 0 ? (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Muscle demand context
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
              {compactReview.muscleDemandContext.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {compactReview.clinicianReview.length > 0 ? (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Clinician review</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
              {compactReview.clinicianReview.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Biomechanical contribution review</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        Rules-based biomechanical context for clinician review — not a diagnosis or muscle assessment.
      </p>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Observed movement pattern</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
          {review.observedMovementPattern.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
          Possible contributors for clinician review
        </p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
          {review.possibleContributors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Muscle demand context</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
          {review.muscleDemandContext.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {review.clinicianReviewPrompts.length > 0 ? (
        <div className="mt-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Clinician review prompts</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
            {review.clinicianReviewPrompts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ReviewNextSection({ report }: { report: MotionAnalysisReport }) {
  const items = report.reviewNext;
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-[6px] border border-amber-400/25 bg-amber-400/5 px-3 py-2.5">
      <SectionHeading>Review next</SectionHeading>
      <ul className="mt-1.5 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
        {items.map((item) => (
          <li key={item.text}>{item.text}</li>
        ))}
      </ul>
    </div>
  );
}

function ClinicalSnapshotSection({
  report,
  isLegacy,
}: {
  report: MotionAnalysisReport;
  isLegacy: boolean;
}) {
  const snapshot = report.clinicalSnapshot;
  if (!snapshot) return null;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Clinical snapshot</SectionHeading>
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">{snapshot.movementCaptured}</p>

      {snapshot.phasesDetected ? (
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-[var(--muted)]">Phases detected: </span>
          {snapshot.phasesDetected}
        </p>
      ) : isLegacy ? (
        <p className="mt-2 text-[10px] italic text-[var(--muted)]">
          Phase distribution not available for this session.
        </p>
      ) : null}

      <p className={`mt-2 text-[10px] font-medium ${SUPPORT_BADGE_CLASS[snapshot.interpretationSupport]}`}>
        Interpretation support: {snapshot.interpretationSupport}
      </p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--muted)]">
        {snapshot.interpretationSupportNote}
      </p>

      {snapshot.keyObservations.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
          {snapshot.keyObservations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PhaseInterpretationSection({ report, isLegacy }: { report: MotionAnalysisReport; isLegacy: boolean }) {
  const phaseInterpretation = report.phaseInterpretation;
  if (isLegacy || !phaseInterpretation || phaseInterpretation.length === 0) return null;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Phase distribution</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        Assistive phase distribution from captured snapshots — not a clinical score.
      </p>
      <ul className="mt-2 space-y-1">
        {phaseInterpretation.map((phase) => (
          <li key={phase.phaseId} className="flex justify-between gap-2 text-[10px] text-[var(--muted)]">
            <span className="text-[var(--muted)]">{phase.phaseLabel}</span>
            <span
              className="shrink-0 font-medium text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {phase.snapshotPct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KinesiologyInsightSection({ report }: { report: MotionAnalysisReport }) {
  const kinesiology = report.kinesiologyInsight;
  if (!kinesiology) return null;

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <SectionHeading>Kinesiology insight</SectionHeading>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
        Expected movement context for clinician review — not a diagnosis or muscle assessment.
      </p>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Expected primary muscles</p>
        <ul className="mt-0.5 list-inside list-disc text-[10px] leading-snug text-[var(--muted)]">
          {kinesiology.primaryMuscles.map((muscle) => (
            <li key={muscle}>{muscle}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Expected movement phases</p>
        <ul className="mt-0.5 space-y-1">
          {kinesiology.movementPhases.map((phase) => (
            <li key={phase.id} className="text-[10px] leading-snug text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">{phase.label}</span>
              <span className="text-[var(--muted)]"> — {phase.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Expected movement strategy</p>
        <ul className="mt-0.5 list-inside list-disc text-[10px] leading-snug text-[var(--muted)]">
          {kinesiology.movementStrategy.map((pattern) => (
            <li key={pattern}>{pattern}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Functional relevance</p>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
          {kinesiology.functionalRelevance}
        </p>
      </div>
    </div>
  );
}

function EvidenceIntegrityBanner({ report }: { report: MotionAnalysisReport }) {
  const gate = report.evidenceIntegrity;
  if (!gate || gate.sufficientForBiomechanicalInterpretation) return null;

  return (
    <div className="rounded-[6px] border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
      <SectionHeading>Evidence integrity</SectionHeading>
      <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
        {gate.headline ?? CV_EVIDENCE_LIMITED_HEADLINE}
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-relaxed text-[var(--muted)]">
        <li>{gate.jointAssessmentNote ?? CV_EVIDENCE_UNABLE_JOINT_NOTE}</li>
        {gate.repCountNote ? <li>{gate.repCountNote ?? CV_EVIDENCE_REP_ASSISTIVE_NOTE}</li> : null}
        <li>{gate.clinicianReviewNote ?? CV_EVIDENCE_CLINICIAN_REVIEW_NOTE}</li>
        <li>Camera-assisted data only — not clinically validated. No diagnosis or automatic recommendation.</li>
      </ul>
      <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">
        Rep count and camera signal are separate: reps remain assistive movement metrics; joint-level
        interpretation is not supported for this capture.
      </p>
    </div>
  );
}

function CaptureEvidenceSection({ report }: { report: MotionAnalysisReport }) {
  const motionPilot =
    report.smtPilot ?? report.msPilot ?? report.hrPilot ?? report.suPilot ?? report.lsPilot ?? report.frPilot;
  const polishedReport = isStsPolishedReport(report);
  const captureTimingLabels = polishedReport
    ? resolveCaptureEvidenceTimingLabels(
        report.timingMetricLabels,
        motionPilot?.phaseRatios ?? null,
      )
    : null;
  const cycleMetricLabel = polishedReport
    ? resolveCaptureEvidenceCycleMetricLabel(report)
    : "Complete reps";

  if (motionPilot) {
    return (
      <details className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] marker:content-none [&::-webkit-details-marker]:hidden">
          Capture evidence
        </summary>

        <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
          {motionPilot.showReviewBanner ? (
            <p className="rounded-[5px] border border-amber-400/35 bg-amber-400/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">
              {MOTION_ANALYSIS_REVIEW_BANNER}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <PilotMetric label="Snapshots" value={String(motionPilot.snapshotCount)} />
            <PilotMetric label={cycleMetricLabel} value={String(motionPilot.completeReps)} />
            <PilotMetric label="Unclear cycles" value={String(motionPilot.unclearReps)} />
          </div>
          <TrackingSignalRow signal={motionPilot.trackingSignal} />

          {motionPilot.repTimings ? (
            <div className="grid grid-cols-3 gap-2">
              <PilotMetric
                label={captureTimingLabels?.average ?? "Avg rep"}
                value={formatNullableSeconds(motionPilot.repTimings.avgS)}
              />
              <PilotMetric
                label={captureTimingLabels?.fastest ?? "Fastest rep"}
                value={formatNullableSeconds(motionPilot.repTimings.fastestS)}
              />
              <PilotMetric
                label={captureTimingLabels?.slowest ?? "Slowest rep"}
                value={formatNullableSeconds(motionPilot.repTimings.slowestS)}
              />
            </div>
          ) : null}

          {motionPilot.visibilityRatios ? (
            <div className="grid grid-cols-3 gap-2">
              <PilotMetric label="Hip visible" value={`${motionPilot.visibilityRatios.hip}%`} />
              <PilotMetric label="Knee visible" value={`${motionPilot.visibilityRatios.knee}%`} />
              <PilotMetric label="Ankle visible" value={`${motionPilot.visibilityRatios.ankle}%`} />
            </div>
          ) : null}

          {motionPilot.clinicianFlags && motionPilot.clinicianFlags.length > 0 ? (
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Capture flags</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-[var(--muted)]">
                {motionPilot.clinicianFlags.map((flag) => (
                  <li key={flag} className="capitalize">
                    {flag.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {motionPilot.snapshotCount === 0 ||
          motionPilot.clinicianFlags?.includes(NO_TIMELINE_SNAPSHOTS_FLAG) ? (
            <p className="rounded-[5px] border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
              {NO_TIMELINE_SNAPSHOTS_CLINICIAN_NOTE}
            </p>
          ) : null}

          {report.movementTimeline.length > 0 ? (
            <ol className="space-y-1.5">
              {report.movementTimeline.map((item, index) => {
                const at = formatTimelineAt(item.atSecond);
                return (
                  <li
                    key={`${item.label}-${index}`}
                    className="flex gap-2 text-[11px] leading-snug text-[var(--muted)]"
                  >
                    {at ? (
                      <span
                        className="shrink-0 tabular-nums text-[var(--muted)]"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {at}
                      </span>
                    ) : (
                      <span className="w-[42px] shrink-0 text-[var(--muted-soft)]">—</span>
                    )}
                    <span>
                      <span className="font-medium text-[var(--foreground)]">{item.label}</span>
                      {item.detail ? (
                        <span className="text-[var(--muted)]"> — {item.detail}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      </details>
    );
  }

  if (report.movementTimeline.length === 0) return null;

  return (
    <details className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
      <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] marker:content-none [&::-webkit-details-marker]:hidden">
        Capture evidence
      </summary>
      <ol className="mt-2 space-y-1.5 border-t border-[var(--border)] pt-2">
        {report.movementTimeline.map((item, index) => {
          const at = formatTimelineAt(item.atSecond);
          return (
            <li key={`${item.label}-${index}`} className="flex gap-2 text-[11px] leading-snug text-[var(--muted)]">
              {at ? (
                <span
                  className="shrink-0 tabular-nums text-[var(--muted)]"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  {at}
                </span>
              ) : (
                <span className="w-[42px] shrink-0 text-[var(--muted-soft)]">—</span>
              )}
              <span>
                <span className="font-medium text-[var(--foreground)]">{item.label}</span>
                {item.detail ? <span className="text-[var(--muted)]"> — {item.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function StsPolishedReportBody({ report }: { report: MotionAnalysisReport }) {
  const isLegacy = report.reportMode === "legacy";
  const clinicalObservations = report.clinicalObservations;
  const captureFlagsSummary = buildCaptureFlagsSummary(
    report.smtPilot?.clinicianFlags ??
      report.msPilot?.clinicianFlags ??
      report.hrPilot?.clinicianFlags ??
      report.suPilot?.clinicianFlags ??
      report.lsPilot?.clinicianFlags ??
      report.frPilot?.clinicianFlags,
  );
  const expandedReviewFocus =
    report.movementQualityReviewFocusDisplay ??
    report.movementQuality?.clinicianReviewFocus ??
    [];

  return (
    <>
      <ReportHeaderStrip report={report} />
      <EvidenceIntegrityBanner report={report} />
      <CaptureQualitySection
        captureQuality={report.captureQuality}
        showFallback={report.smtPilot != null}
        reliability={stsCaptureReliabilityContext(report)}
      />

      {report.executiveSummary ? (
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <SectionHeading>Executive summary</SectionHeading>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {report.executiveSummary.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <MovementTimingPhaseReviewSection report={report} compact />
      <StsBiomechanicalFlagsSection report={report} />
      <StsMovementAttemptsSection report={report} />
      <PosturalAlignmentProxySection report={report} />
      <BiomechanicalContributionSection report={report} compact />
      <ReviewNextSection report={report} />

      <details className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] marker:content-none [&::-webkit-details-marker]:hidden">
          Show details
        </summary>
        <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
          <ClinicalSnapshotSection report={report} isLegacy={isLegacy} />
          {captureFlagsSummary ? (
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
              <SectionHeading>Capture flags summary</SectionHeading>
              <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">{captureFlagsSummary}</p>
            </div>
          ) : null}
          {report.movementQuality &&
          (report.movementQuality.qualitySignals.length > 0 || expandedReviewFocus.length > 0) ? (
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
              <SectionHeading>Expanded timing &amp; phase signals</SectionHeading>
              {report.movementQuality.qualitySignals.length > 0 ? (
                <ul className="mt-1 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
                  {report.movementQuality.qualitySignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : null}
              {expandedReviewFocus.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
                  {expandedReviewFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <KinesiologyInsightSection report={report} />
          <PhaseInterpretationSection report={report} isLegacy={isLegacy} />

          {!isLegacy && clinicalObservations && clinicalObservations.length > 0 ? (
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
              <SectionHeading>Session observations</SectionHeading>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
                {clinicalObservations.map((observation) => (
                  <li key={observation.id}>{observation.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
            <SectionHeading>Confidence &amp; limitations</SectionHeading>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
              {MOTION_ANALYSIS_CAMERA_DISCLAIMER}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
              {report.confidenceLimitations.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <CaptureEvidenceSection report={report} />
    </>
  );
}

function LegacyReportBody({ report }: { report: MotionAnalysisReport }) {
  const isLegacy = report.reportMode === "legacy";
  const clinicalObservations = report.clinicalObservations;
  const reviewGrouped = report.reviewNextGrouped;

  return (
    <>
      <ReportHeaderStrip report={report} />
      <EvidenceIntegrityBanner report={report} />
      <CaptureQualitySection
        captureQuality={report.captureQuality}
        showFallback={report.smtPilot != null}
        reliability={stsCaptureReliabilityContext(report)}
      />
      <ClinicalSnapshotSection report={report} isLegacy={isLegacy} />
      <MovementTimingPhaseReviewSection report={report} />
      <StsBiomechanicalFlagsSection report={report} />
      <StsMovementAttemptsSection report={report} />
      <PosturalAlignmentProxySection report={report} />
      <BiomechanicalContributionSection report={report} />
      <PhaseInterpretationSection report={report} isLegacy={isLegacy} />

      {!isLegacy && clinicalObservations && clinicalObservations.length > 0 ? (
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
          <SectionHeading>Session observations</SectionHeading>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
            {clinicalObservations.map((observation) => (
              <li key={observation.id}>{observation.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <KinesiologyInsightSection report={report} />

      {reviewGrouped && reviewGrouped.length > 0 ? (
        <div className="rounded-[6px] border border-amber-400/25 bg-amber-400/5 px-3 py-2.5">
          <SectionHeading>Review next</SectionHeading>
          <div className="mt-1.5 space-y-2.5">
            {reviewGrouped.map((group) => (
              <div key={group.category}>
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
                  {group.categoryLabel}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[var(--muted)]">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
        <SectionHeading>Confidence &amp; limitations</SectionHeading>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">{MOTION_ANALYSIS_CAMERA_DISCLAIMER}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-[var(--muted)]">
          {report.confidenceLimitations.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <CaptureEvidenceSection report={report} />
    </>
  );
}

export function MotionAnalysisReportPanel({ report }: MotionAnalysisReportPanelProps) {
  const badgeClass = SUMMARY_BADGE_CLASS[report.summaryLabel];
  const polishedSts = isStsPolishedReport(report);

  return (
    <details
      open
      className="mt-3 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)]"
      style={{ borderWidth: "0.5px" }}
    >
      <summary className="cursor-pointer list-none border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--foreground)]">{MOTION_ANALYSIS_REPORT_TITLE}</span>
          <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[9px] font-medium text-[var(--muted)]">
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
        <div className="rounded-[6px] border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/95 sm:text-[11px]">
          {MOTION_ANALYSIS_REVIEW_BANNER}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Duration</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">
              {report.sessionDurationSeconds > 0 ? `${report.sessionDurationSeconds}s` : "—"}
            </p>
          </div>
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Reps / cycles</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">{report.completedReps}</p>
          </div>
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Signal</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">
              {report.captureQuality?.qualityLevel ?? report.summaryLabel}
            </p>
          </div>
        </div>
        {polishedSts ? <StsPolishedReportBody report={report} /> : <LegacyReportBody report={report} />}
      </div>
    </details>
  );
}
