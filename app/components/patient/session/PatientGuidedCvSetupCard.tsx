"use client";

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import {
  cameraReadinessUi,
  type PatientCvReadinessDisplayState,
  readinessStateLabel,
} from "@/app/lib/patient-portal-ui";

type PatientGuidedCvSetupCardProps = {
  lang: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "ltr" | "rtl";
};

function FloorGuideVisual({
  guideAreaLabel,
  hint,
  arClass = "",
}: {
  guideAreaLabel: string;
  hint: string;
  arClass?: string;
}) {
  return (
    <div
      className={`mt-3 rounded-[8px] border border-dashed border-[#1D9E75]/35 bg-[#F0FAF6] px-3 py-3 ${arClass}`}
      aria-hidden
    >
      <div className="relative mx-auto aspect-[4/3] max-w-[220px] overflow-hidden rounded-[6px] border border-[#D1E7DE] bg-gradient-to-b from-[#E8F5F1] to-[#F4F6F5]">
        <div className="absolute left-[12%] right-[12%] top-[10%] h-[8%] rounded-full bg-[#1D9E75]/20" />
        <div className="absolute bottom-[8%] left-[22%] right-[22%] h-[6%] rounded-full bg-[#1D9E75]/15" />
        <div className="absolute inset-x-[20%] bottom-[14%] top-[20%] rounded-[4px] border-2 border-dashed border-[#1D9E75]/55 bg-[#1D9E75]/[0.06]">
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[9px] font-semibold leading-tight text-[#1D9E75]">
            {guideAreaLabel}
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-[#6B7280]">{hint}</p>
    </div>
  );
}

/** Static camera setup guidance shown before CV tracking starts (preview step). */
export function PatientGuidedCvSetupCard({
  lang,
  arClass = "",
  textDir = "ltr",
}: PatientGuidedCvSetupCardProps) {
  const ui = cameraReadinessUi(lang);

  return (
    <section
      className={`rounded-[12px] border border-[#D1E7DE] bg-[#F9FAFB] px-4 py-3.5 ${arClass}`}
      dir={textDir}
      lang={lang}
      aria-labelledby="cv-setup-card-title"
    >
      <h3
        id="cv-setup-card-title"
        className="text-[14px] font-bold text-[#0A0F1A]"
      >
        {ui.setupCardTitle}
      </h3>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[#6B7280]">
        {ui.setupCardSubtitle}
      </p>

      <ul
        className={`mt-3 list-disc space-y-1.5 text-[12px] text-[#374151] ${
          textDir === "rtl" ? "mr-4" : "ml-4"
        }`}
      >
        {ui.setupBullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <FloorGuideVisual
        guideAreaLabel={ui.floorGuideAreaLabel}
        hint={ui.floorGuideHint}
        arClass={arClass}
      />

      <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
        {ui.assistiveEvidenceNote}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
        {ui.clinicianReviewNote}
      </p>
      <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#374151]">
        {ui.manualFallbackHint}
      </p>
    </section>
  );
}

const READINESS_STYLES: Record<
  PatientCvReadinessDisplayState,
  { border: string; bg: string; text: string; dot: string }
> = {
  ready_to_track: {
    border: "border-[#D1E7DE]",
    bg: "bg-[#F0FAF6]",
    text: "text-[#1D9E75]",
    dot: "bg-[#1D9E75]",
  },
  move_back_slightly: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  keep_full_body_visible: {
    border: "border-[#E2E8E5]",
    bg: "bg-[#F9FAFB]",
    text: "text-[#374151]",
    dot: "bg-[#9CA3AF]",
  },
  improve_lighting: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  limited_camera_evidence: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
};

type PatientGuidedCvReadinessBannerProps = {
  lang: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "ltr" | "rtl";
  state: PatientCvReadinessDisplayState;
};

/** Live readiness status from existing CV capture signals (active step). */
export function PatientGuidedCvReadinessBanner({
  lang,
  arClass = "",
  textDir = "ltr",
  state,
}: PatientGuidedCvReadinessBannerProps) {
  const ui = cameraReadinessUi(lang);
  const styles = READINESS_STYLES[state];
  const label = readinessStateLabel(lang, state);

  return (
    <div
      className={`flex items-start gap-2.5 rounded-[12px] border px-3.5 py-3 ${styles.border} ${styles.bg} ${arClass}`}
      dir={textDir}
      lang={lang}
      role="status"
      aria-live="polite"
    >
      <span
        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-bold ${styles.text}`}>
          {ui.liveReadinessEyebrow}
        </p>
        <p className={`mt-0.5 text-[13px] font-semibold leading-snug ${styles.text}`}>
          {label}
        </p>
        {state === "limited_camera_evidence" ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#6B7280]">
            {ui.manualFallbackHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
