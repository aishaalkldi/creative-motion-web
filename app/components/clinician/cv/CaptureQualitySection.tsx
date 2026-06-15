"use client";

import type { CaptureQualityResult, CaptureQualityLevel } from "@/app/lib/cv/capture-quality";

const QUALITY_BADGE_CLASS: Record<CaptureQualityLevel, string> = {
  high: "border-[#1D9E75]/35 bg-[#1D9E75]/12 text-[#5DCAA5]",
  medium: "border-[#EF9F27]/35 bg-[#EF9F27]/10 text-[#EF9F27]",
  low: "border-amber-500/35 bg-amber-500/10 text-amber-200",
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
      <dt className="text-[10px] uppercase tracking-[0.06em] text-[#6B7280]">{label}</dt>
      <dd className="text-[11px] font-medium text-[#F9FAFB] sm:text-right">{value}</dd>
    </div>
  );
}

type CaptureQualitySectionProps = {
  captureQuality: CaptureQualityResult | null;
  showFallback: boolean;
};

export function CaptureQualitySection({
  captureQuality,
  showFallback,
}: CaptureQualitySectionProps) {
  if (!showFallback) return null;

  return (
    <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
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

      <p className="mt-1.5 text-[10px] leading-relaxed text-[#6B7280]">
        Capture quality reflects camera and tracking reliability.
      </p>

      {!captureQuality ? (
        <p className="mt-2 text-[10px] leading-relaxed text-[#9CA3AF]">
          Capture quality was not available for this session.
        </p>
      ) : (
        <>
          {captureQuality.qualityLevel === "low" ? (
            <p className="mt-2 rounded-[5px] border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-200">
              Use caution when quality is low. Therapist review required.
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-relaxed text-[#9CA3AF]">
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
            <div className="mt-3 rounded-[5px] border border-[#1E2D42] bg-[#070D16] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#6B7280]">Warnings</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[#D1D5DB]">
                {captureQuality.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
