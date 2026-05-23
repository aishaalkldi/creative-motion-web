"use client";

import type { PatientSectionId } from "@/app/lib/api/remote-assessments";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import type { AssessmentLanguage } from "@/app/lib/assessment-payload";
import {
  ARABIC_READABILITY_NOTICE,
  isArabicAssessmentContent,
  valueTextDirection,
} from "@/app/lib/arabic-readability";
import { buildFullClinicianReview } from "@/app/lib/patient-assessment-questions";

type Props = {
  patientDraft?: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  assessmentLanguage?: AssessmentLanguage | null;
  compact?: boolean;
};

/**
 * English-only clinician view of patient-submitted assessment answers.
 */
export function PatientSubmittedAnswersReview({
  patientDraft,
  includedSections,
  assessmentLanguage = null,
  compact = false,
}: Props) {
  const blocks = buildFullClinicianReview(patientDraft, includedSections);

  if (blocks.length === 0) {
    return (
      <p className="text-xs italic text-white/35">
        No patient answers recorded for this submission.
      </p>
    );
  }

  const allValues = blocks.flatMap((block) => block.entries.map((entry) => entry.value));
  const showArabicNotice = isArabicAssessmentContent(assessmentLanguage, allValues);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {showArabicNotice && (
        <div className="rounded-[7px] border border-amber-300/25 bg-amber-400/10 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-amber-100/90">{ARABIC_READABILITY_NOTICE}</p>
        </div>
      )}

      {blocks.map((block) => (
        <div
          key={block.section}
          className="overflow-hidden rounded-[7px] border border-[#1E2D42] bg-[#0B1220]"
        >
          <div className="border-b border-[#1E2D42] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5DCAA5]">
              {block.sectionTitle}
            </p>
          </div>
          <dl className="divide-y divide-[#1E2D42]">
            {block.entries.map((entry) => (
              <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {entry.label}
                </dt>
                <dd
                  dir={valueTextDirection(entry.value)}
                  className="mt-0.5 text-sm leading-relaxed text-white/80 whitespace-pre-wrap"
                >
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
