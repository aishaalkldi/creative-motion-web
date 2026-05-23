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
import { TranslatableField } from "@/app/components/clinician/TranslatableField";

type Props = {
  patientDraft?: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  assessmentLanguage?: AssessmentLanguage | null;
  submissionMeta?: Record<string, unknown> | null;
  assessmentId?: string;
  compact?: boolean;
};

const NON_TRANSLATABLE_FIELD_KEYS = new Set(["painScore"]);

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readMetaBoolean(meta: Record<string, unknown> | null | undefined, key: string): boolean {
  return meta?.[key] === true;
}

function isVoiceAnswered(
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string | undefined,
): boolean {
  if (!fieldKey || !submissionMeta) return false;
  return submissionMeta[`${fieldKey}_method`] === "voice";
}

/**
 * English-only clinician view of patient-submitted assessment answers.
 */
export function PatientSubmittedAnswersReview({
  patientDraft,
  includedSections,
  assessmentLanguage = null,
  submissionMeta = null,
  assessmentId,
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
            {block.entries.map((entry) => {
              const voiceAnswered = isVoiceAnswered(submissionMeta, entry.fieldKey);
              const fieldKey = entry.fieldKey;
              const useTranslation =
                assessmentLanguage === "ar" &&
                !!assessmentId &&
                !!fieldKey &&
                !NON_TRANSLATABLE_FIELD_KEYS.has(fieldKey) &&
                !!entry.value.trim();

              return (
                <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {entry.label}
                  </dt>
                  <dd className="mt-0.5">
                    {useTranslation ? (
                      <TranslatableField
                        assessmentId={assessmentId}
                        fieldKey={fieldKey}
                        arabicText={entry.value}
                        existingTranslation={readMetaString(submissionMeta, `${fieldKey}_en`)}
                        existingGeneratedAt={readMetaString(submissionMeta, `${fieldKey}_en_generated_at`)}
                        existingReviewed={readMetaBoolean(submissionMeta, `${fieldKey}_en_reviewed`)}
                        isVoiceAnswer={voiceAnswered}
                      />
                    ) : (
                      <>
                        <p
                          dir={valueTextDirection(entry.value)}
                          className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap"
                        >
                          {voiceAnswered ? (
                            <span
                              className="mr-1 inline-block text-[10px] text-[#9CA3AF]"
                              aria-hidden
                            >
                              🎤
                            </span>
                          ) : null}
                          {entry.value}
                        </p>
                        {voiceAnswered ? (
                          <p className="mt-1 text-[10px] italic text-[#6B7280]">
                            Patient answered by voice — text as transcribed. Review before clinical use.
                          </p>
                        ) : null}
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
