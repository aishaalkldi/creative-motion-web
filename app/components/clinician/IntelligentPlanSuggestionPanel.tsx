"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssessmentListRow } from "@/app/api/assessments/route";
import type { AssessmentRow } from "@/app/api/assessments/route";
import {
  generateIntelligentPlanSuggestion,
  type IntelligentPlanSuggestion,
} from "@/app/lib/clinician/intelligent-plan-generator";
import {
  PILOT_PROGRAM_TEMPLATES,
  type PilotProgramTemplate,
} from "@/app/lib/program-templates";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

type IntelligentPlanSuggestionPanelProps = {
  patient: PatientRow | null;
  assessments: AssessmentListRow[];
  baselineId: string;
  onApplyTemplate: (template: PilotProgramTemplate) => void;
  onSetBaselineId: (id: string) => void;
};

export function IntelligentPlanSuggestionPanel({
  patient,
  assessments,
  baselineId,
  onApplyTemplate,
  onSetBaselineId,
}: IntelligentPlanSuggestionPanelProps) {
  const [structuredData, setStructuredData] = useState<unknown>(null);
  const [assessmentType, setAssessmentType] = useState<string | undefined>();

  const preferredAssessmentId = baselineId || assessments[0]?.id || null;

  useEffect(() => {
    if (!preferredAssessmentId) {
      setStructuredData(null);
      setAssessmentType(undefined);
      return;
    }
    let cancelled = false;
    void fetch(`/api/assessments/${encodeURIComponent(preferredAssessmentId)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AssessmentRow;
      })
      .then((row) => {
        if (cancelled || !row) return;
        setStructuredData(row.structured_data);
        setAssessmentType(row.type);
      })
      .catch(() => {
        if (!cancelled) {
          setStructuredData(null);
          setAssessmentType(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preferredAssessmentId]);

  const suggestion = useMemo<IntelligentPlanSuggestion | null>(() => {
    if (!patient) return null;
    return generateIntelligentPlanSuggestion({
      patient,
      assessments,
      assessmentStructuredData: structuredData,
      assessmentType,
    });
  }, [patient, assessments, structuredData, assessmentType]);

  if (!patient || !suggestion) return null;

  const template = PILOT_PROGRAM_TEMPLATES.find((row) => row.id === suggestion.templateId);
  if (!template) return null;

  return (
    <section className="rounded-[10px] border border-cyan-400/20 bg-cyan-400/5 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/80">
        Intelligent plan suggestion — therapist review required
      </p>
      <h2 className="mt-1 text-sm font-bold text-white">{suggestion.templateTitle}</h2>
      <p className="mt-2 text-xs leading-relaxed text-white/45">
        Suggested from assessment focus and patient record. Not a diagnosis or automatic prescription.
      </p>

      <ul className="mt-3 space-y-1.5">
        {suggestion.rationale.map((line) => (
          <li key={line} className="text-xs text-white/55">
            • {line}
          </li>
        ))}
      </ul>

      {suggestion.programOptions.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestion.programOptions.map((option) => (
            <span
              key={option.templateId}
              className="rounded-[5px] border border-[#1E2D42] bg-[#0B1220] px-2 py-0.5 text-[10px] text-white/45"
            >
              {option.title}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (suggestion.baselineAssessmentId) {
              onSetBaselineId(suggestion.baselineAssessmentId);
            }
            onApplyTemplate(template);
          }}
          className="rounded-[7px] bg-[#1D9E75] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#179165]"
        >
          Apply suggested template
        </button>
        {suggestion.redFlagReviewRequired && (
          <span className="self-center text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Review red flags first
          </span>
        )}
      </div>
    </section>
  );
}
