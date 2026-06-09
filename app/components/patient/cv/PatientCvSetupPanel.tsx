"use client";

import type { PatientCvCopy } from "@/app/lib/cv/bio-0-contracts";
import {
  CAPTURE_READINESS_STABLE_SECONDS,
  type CaptureReadinessCheck,
  type CaptureReadinessCheckId,
  type CaptureSetupGuidance,
} from "@/app/lib/cv/patient-cv-capture-readiness";

type PatientCvSetupPanelProps = {
  copy: PatientCvCopy;
  arClass?: string;
  textDir?: "ltr" | "rtl";
  checks: CaptureReadinessCheck[];
  primaryGuidance: CaptureSetupGuidance;
  canStartTracking: boolean;
  stableSeconds: number;
  previewActive: boolean;
  onContinueAnyway: () => void;
};

function checkLabel(copy: PatientCvCopy, id: CaptureReadinessCheckId): string {
  switch (id) {
    case "body_visible":
      return copy.setupCheckBodyVisible;
    case "lower_joints_visible":
      return copy.setupCheckHipKneeAnkleVisible;
    case "feet_visible":
      return copy.setupCheckFeetVisible;
    case "upper_reach_visible":
      return copy.setupCheckWristShoulderVisible;
    case "correct_distance":
      return copy.setupCheckCorrectDistance;
    case "lighting_acceptable":
      return copy.setupCheckLightingAcceptable;
    case "tracking_stable":
      return copy.setupCheckTrackingStable;
    default:
      return id;
  }
}

function guidanceLabel(copy: PatientCvCopy, guidance: CaptureSetupGuidance): string {
  switch (guidance) {
    case "move_farther":
      return copy.setupGuidanceMoveFarther;
    case "step_into_frame":
      return copy.setupGuidanceStepIntoFrame;
    case "improve_lighting":
      return copy.setupGuidanceImproveLighting;
    case "show_feet":
      return copy.setupGuidanceFeetVisible;
    case "keep_reach_arm_in_frame":
      return copy.setupGuidanceReachArmInFrame;
    case "ready":
      return copy.setupStateReadyToStart;
    default:
      return copy.setupGuidanceAdjustPosition;
  }
}

export function PatientCvSetupPanel({
  copy,
  arClass = "",
  textDir = "ltr",
  checks,
  primaryGuidance,
  canStartTracking,
  stableSeconds,
  previewActive,
  onContinueAnyway,
}: PatientCvSetupPanelProps) {
  const requiredChecks = checks.filter((c) => c.required);
  const showOverride = previewActive && !canStartTracking;

  return (
    <div className={`mt-3 rounded-[8px] border border-[#D1E7DE] bg-[#F9FAFB] px-3.5 py-3 ${arClass}`}>
      <h3 className="text-[14px] font-bold text-[#0A0F1A]">{copy.setupWizardTitle}</h3>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#0A0F1A]">
        {copy.setupExerciseHint}
      </p>
      <p className="mt-2 rounded-[6px] border border-[#D1E7DE] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#6B7280]">
        {copy.setupPrivacyMicroConsent}
      </p>

      <ul className={`mt-2 list-disc space-y-1 text-[12px] text-[#374151] ${textDir === "rtl" ? "mr-4" : "ml-4"}`}>
        {copy.setupPreCaptureBullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {copy.setupExerciseTips.length > 0 ? (
        <ul
          className={`mt-2 list-disc space-y-1 text-[12px] font-medium text-[#1D9E75] ${textDir === "rtl" ? "mr-4" : "ml-4"}`}
        >
          {copy.setupExerciseTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}

      {copy.setupReachDirectionCue && primaryGuidance === "keep_reach_arm_in_frame" ? (
        <p className="mt-2 text-[12px] font-semibold text-[#374151]">{copy.setupReachDirectionCue}</p>
      ) : null}

      {previewActive ? (
        <>
          <p
            className={`mt-3 text-[12px] font-semibold ${
              primaryGuidance === "ready" ? "text-[#1D9E75]" : "text-[#374151]"
            }`}
            role="status"
            aria-live="polite"
          >
            {guidanceLabel(copy, primaryGuidance)}
          </p>

          <ul className="mt-2 space-y-1.5" role="list">
            {requiredChecks.map((check) => (
              <li
                key={check.id}
                className="flex items-center gap-2 text-[12px] text-[#374151]"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    check.met
                      ? "bg-[#1D9E75] text-white"
                      : "border border-[#D1E7DE] bg-white text-[#9CA3AF]"
                  }`}
                  aria-hidden
                >
                  {check.met ? "✓" : ""}
                </span>
                <span>
                  {check.id === "tracking_stable" && !check.met
                    ? copy.setupTrackingStableProgress(
                        stableSeconds,
                        CAPTURE_READINESS_STABLE_SECONDS,
                      )
                    : checkLabel(copy, check.id)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-[#6B7280]">{copy.setupCheckingCamera}</p>
      )}

      {showOverride ? (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinueAnyway}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-amber-300 bg-amber-50 text-[14px] font-semibold text-amber-900 transition hover:border-amber-400"
          >
            {copy.setupStartAnyway}
          </button>
          <p className="text-[11px] leading-relaxed text-[#6B7280]">
            {copy.setupStartAnywayWarning}
          </p>
        </div>
      ) : null}
    </div>
  );
}
