"use client";

import type { CaptureQualityResult, CaptureQualityLevel } from "@/app/lib/cv/capture-quality";
import { humanizeCaptureReliabilityFlags } from "@/app/lib/cv/capture-reliability-display";

const QUALITY_BADGE_CLASS: Record<CaptureQualityLevel, string> = {
  high: "border-[var(--brand)]/35 bg-[var(--brand)]/12 text-[var(--brand)]",
  medium: "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  low: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

export type CaptureReliabilityContext = {
  visibilityRatios: { hip: number; knee: number; ankle: number } | null;
  completeReps: number;
  unclearReps: number;
  clinicianFlags: string[] | null;
};

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="text-[10px] uppercase tracking-[0.06em] text-[var(--muted)]">{label}</dt>
      <dd className="text-[11px] font-medium text-[var(--foreground)] sm:text-right">{value}</dd>
    </div>
  );
}

type CaptureQualitySectionProps = {
  captureQuality: CaptureQualityResult | null;
  showFallback: boolean;
  reliability?: CaptureReliabilityContext | null;
};

function shouldShowExpandedReliability(
  captureQuality: CaptureQualityResult | null,
  reliability: CaptureReliabilityContext | null | undefined,
): boolean {
  if (captureQuality?.qualityLevel === "medium" || captureQuality?.qualityLevel === "low") {
    return true;
  }
  if (!captureQuality && reliability) {
    const flags = humanizeCaptureReliabilityFlags(reliability.clinicianFlags ?? []);
    return flags.length > 0;
  }
  return false;
}

export function CaptureQualitySection({
  captureQuality,
  showFallback,
  reliability,
}: CaptureQualitySectionProps) {
  if (!showFallback) return null;

  const reliabilityFlags = humanizeCaptureReliabilityFlags(reliability?.clinicianFlags ?? []);
  const showExpanded = shouldShowExpandedReliability(captureQuality, reliability);

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
          Capture quality
        </p>
        {captureQuality ? (
          <span
            className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${QUALITY_BADGE_CLASS[captureQuality.qualityLevel]}`}
          >
            {formatLabel(captureQuality.qualityLevel)}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
        Capture quality reflects camera and tracking reliability.
      </p>

      {!captureQuality ? (
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          Capture quality was not available for this session.
        </p>
      ) : (
        <>
          {captureQuality.qualityLevel === "low" ? (
            <p className="mt-2 rounded-[5px] border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">
              Use caution when quality is low. Therapist review required.
            </p>
          ) : captureQuality.qualityLevel === "medium" ? (
            <p className="mt-2 rounded-[5px] border border-amber-400/35 bg-amber-400/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">
              Limited capture quality may reduce how much movement evidence supports therapist
              review.
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Therapist review required.
            </p>
          )}

          <dl className="mt-3 space-y-2">
            <MetricRow label="Quality" value={formatLabel(captureQuality.qualityLevel)} />
            <MetricRow
              label="Body visibility"
              value={formatLabel(captureQuality.bodyVisibility)}
            />
            <MetricRow
              label="Tracking confidence"
              value={formatLabel(captureQuality.trackingConfidence)}
            />
            <MetricRow
              label="Camera position"
              value={titleCase(captureQuality.cameraPosition)}
            />
            <MetricRow
              label="Retest recommended"
              value={captureQuality.retestRecommended ? "Yes" : "No"}
            />
          </dl>

          {captureQuality.warnings.length > 0 ? (
            <div className="mt-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">Warnings</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[var(--muted)]">
                {captureQuality.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {showExpanded && reliability ? (
        <div className="mt-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
            Capture limitations
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
            Low or limited capture quality reduces how much movement evidence can support therapist
            review.
          </p>

          {reliability.visibilityRatios ? (
            <dl className="mt-2 space-y-1.5">
              <MetricRow
                label="Hip visible"
                value={`${reliability.visibilityRatios.hip}%`}
              />
              <MetricRow
                label="Knee visible"
                value={`${reliability.visibilityRatios.knee}%`}
              />
              <MetricRow
                label="Ankle visible"
                value={`${reliability.visibilityRatios.ankle}%`}
              />
            </dl>
          ) : null}

          <dl className="mt-2 space-y-1.5">
            <MetricRow
              label="Complete reps"
              value={String(reliability.completeReps)}
            />
            <MetricRow
              label="Unclear reps"
              value={String(reliability.unclearReps)}
            />
          </dl>

          {reliabilityFlags.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[var(--muted)]">
              {reliabilityFlags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!captureQuality && reliabilityFlags.length > 0 ? (
        <div className="mt-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]">
            Capture limitations
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[var(--muted)]">
            {reliabilityFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
