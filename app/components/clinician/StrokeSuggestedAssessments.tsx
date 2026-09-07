"use client";

import Link from "next/link";
import {
  routeStrokeRasqModules,
  type StrokeModuleSuggestion,
} from "@/app/lib/stroke-questionnaire/stroke-module-routing";
import type { StrokeQuestionnaireSubmission } from "@/app/lib/stroke-questionnaire/stroke-questionnaire-schema";

type StrokeSuggestedAssessmentsProps = {
  submission: Pick<StrokeQuestionnaireSubmission, "responses" | "safetyState">;
  patientId?: string;
};

const MODULE_PATHS: Record<StrokeModuleSuggestion["id"], string | null> = {
  upper_limb_motor_screen: "/clinician/assessments/upper-limb-motor-screen",
  sit_to_stand: "/clinician/assessments/sit-to-stand",
  gait_observation: "/clinician/assessments/gait",
  timed_up_and_go: "/clinician/assessments/timed-up-and-go",
  functional_reach: "/clinician/assessments/functional-reach",
  single_leg_stance: "/clinician/assessments/single-leg-stance",
  mini_squat: null,
};

function dispositionLabel(disposition: StrokeModuleSuggestion["disposition"]): string {
  return disposition === "DEFER_PENDING_SAFETY_REVIEW"
    ? "Defer pending safety review"
    : "Consider";
}

function moduleHref(moduleId: StrokeModuleSuggestion["id"], patientId?: string): string | null {
  const path = MODULE_PATHS[moduleId];
  if (!path) return null;
  if (!patientId) return path;
  return `${path}?patientId=${encodeURIComponent(patientId)}`;
}

export function StrokeSuggestedAssessments({
  submission,
  patientId,
}: StrokeSuggestedAssessmentsProps) {
  const suggestions = routeStrokeRasqModules(submission);

  return (
    <section
      id="stroke-suggested"
      className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 print:hidden"
    >
      <h2 className="text-base font-bold text-white">Suggested Assessments</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/40">
        Therapist-selected next steps from the existing Stroke routing rules.
        Nothing is assigned automatically.
      </p>
      {suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">
          No additional objective assessments are suggested from this intake.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {suggestions.map((suggestion) => {
            const href = moduleHref(suggestion.id, patientId);
            return (
              <li
                key={suggestion.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{suggestion.label}</p>
                  <p className="mt-0.5 text-xs text-[#5DCAA5]">{dispositionLabel(suggestion.disposition)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/45">{suggestion.rationale}</p>
                </div>
                {href ? (
                  <Link
                    href={href}
                    className="shrink-0 rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-3 py-1.5 text-[11px] font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/16"
                  >
                    Open module
                  </Link>
                ) : (
                  <p className="shrink-0 text-[11px] text-white/35">No dedicated workspace yet</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
