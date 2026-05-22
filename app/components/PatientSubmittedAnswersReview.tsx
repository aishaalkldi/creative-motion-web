"use client";

import type { PatientSectionId } from "@/app/lib/api/remote-assessments";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import { buildFullClinicianReview } from "@/app/lib/patient-assessment-questions";

type Props = {
  patientDraft?: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  compact?: boolean;
};

/**
 * English-only clinician view of patient-submitted assessment answers.
 */
export function PatientSubmittedAnswersReview({
  patientDraft,
  includedSections,
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

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
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
                <dd className="mt-0.5 text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
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
