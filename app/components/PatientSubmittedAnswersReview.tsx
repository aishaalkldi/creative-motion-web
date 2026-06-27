"use client";

import { useEffect, useMemo } from "react";
import type { PatientSectionId } from "@/app/lib/api/remote-assessments";
import type { PatientAssessmentDraft } from "@/app/lib/api/remote-assessments";
import type { AssessmentLanguage } from "@/app/lib/assessment-payload";
import {
  ARABIC_READABILITY_NOTICE,
  isArabicAssessmentContent,
  valueTextDirection,
} from "@/app/lib/arabic-readability";
import {
  buildFullClinicianReview,
  type PatientReviewEntry,
} from "@/app/lib/patient-assessment-questions";
import { TranslatableField } from "@/app/components/clinician/TranslatableField";
import {
  AI_TRANSLATION_SETUP_NOTICE,
  isAiTranslationEnabled,
} from "@/app/lib/ai/ai-features";
import { patientReportedLabel } from "@/app/lib/reports/clinical-report-copy";
import {
  extractTranslationMeta,
  isTranslatablePatientFieldKey,
} from "@/app/lib/reports/patient-clinical-translation";
import {
  useTranslationProgress,
  type FieldTranslationState,
} from "@/hooks/useTranslationProgress";

type Props = {
  patientDraft?: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  assessmentLanguage?: AssessmentLanguage | null;
  submissionMeta?: Record<string, unknown> | null;
  assessmentId?: string;
  compact?: boolean;
  onTranslationProgress?: (progress: {
    doneCount: number;
    totalCount: number;
    allTranslated: boolean;
    anyLoading: boolean;
    translateAll: () => Promise<void>;
  }) => void;
};

function isVoiceAnswered(
  submissionMeta: Record<string, unknown> | null | undefined,
  fieldKey: string | undefined,
): boolean {
  if (!fieldKey || !submissionMeta) return false;
  return submissionMeta[`${fieldKey}_method`] === "voice";
}

function collectArabicFields(
  blocks: { entries: PatientReviewEntry[] }[],
): { fieldKey: string; text: string }[] {
  return blocks
    .flatMap((block) => block.entries)
    .filter(
      (entry) =>
        isTranslatablePatientFieldKey(entry.fieldKey) &&
        entry.value.trim(),
    )
    .map((entry) => ({ fieldKey: entry.fieldKey!, text: entry.value }));
}

function readMetaBoolean(meta: Record<string, unknown> | null | undefined, key: string): boolean {
  return meta?.[key] === true;
}

/**
 * Clinician review of patient-submitted assessment answers.
 * Arabic submissions preserve the original answer with clinical English underneath when available.
 */
export function PatientSubmittedAnswersReview({
  patientDraft,
  includedSections,
  assessmentLanguage = null,
  submissionMeta = null,
  assessmentId,
  compact = false,
  onTranslationProgress,
}: Props) {
  const aiTranslationEnabled = isAiTranslationEnabled();
  const blocks = buildFullClinicianReview(patientDraft, includedSections);

  const arabicFields = useMemo(
    () => (assessmentLanguage === "ar" ? collectArabicFields(blocks) : []),
    [assessmentLanguage, blocks],
  );

  const { translations: existingTranslations, generatedAt: existingGeneratedAt } = useMemo(
    () => extractTranslationMeta(submissionMeta),
    [submissionMeta],
  );

  const translationProgress = useTranslationProgress(
    assessmentId ?? "",
    arabicFields,
    existingTranslations,
    existingGeneratedAt,
    { autoTranslate: aiTranslationEnabled && assessmentLanguage === "ar" && !!assessmentId },
  );

  const {
    states,
    translations,
    generatedAtMap,
    translateField,
    translateAll,
    doneCount,
    totalCount,
    allTranslated,
    anyLoading,
  } = translationProgress;

  useEffect(() => {
    if (!aiTranslationEnabled || !onTranslationProgress || assessmentLanguage !== "ar" || !assessmentId) {
      return;
    }
    onTranslationProgress({
      doneCount,
      totalCount,
      allTranslated,
      anyLoading,
      translateAll,
    });
  }, [
    onTranslationProgress,
    aiTranslationEnabled,
    assessmentLanguage,
    assessmentId,
    doneCount,
    totalCount,
    allTranslated,
    anyLoading,
    translateAll,
  ]);

  if (blocks.length === 0) {
    return (
      <p className="text-xs italic text-white/35">
        No patient answers recorded for this submission.
      </p>
    );
  }

  const allValues = blocks.flatMap((block) => block.entries.map((entry) => entry.value));
  const showArabicNotice =
    aiTranslationEnabled && isArabicAssessmentContent(assessmentLanguage, allValues);
  const showSetupNotice = !aiTranslationEnabled && assessmentLanguage === "ar" && !compact;
  const showTranslateHeader =
    aiTranslationEnabled &&
    !compact &&
    assessmentLanguage === "ar" &&
    !!assessmentId &&
    totalCount > 0;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {showTranslateHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2D42] pb-3">
          <p className="text-sm font-bold text-white">Patient-Reported Summary</p>
          <div className="flex flex-wrap items-center gap-3">
            {!allTranslated && totalCount > 0 ? (
              <p className="text-[10px] text-[#6B7280]">
                Translation progress: {doneCount} of {totalCount} fields translated
              </p>
            ) : null}
            {allTranslated ? (
              <p className="text-[10px] text-[#1D9E75]">All fields translated</p>
            ) : (
              <button
                type="button"
                disabled={anyLoading}
                onClick={() => void translateAll()}
                className="rounded-[6px] bg-[#1D9E75] px-3.5 py-[5px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {anyLoading
                  ? `Translating ${doneCount} of ${totalCount} fields...`
                  : "Regenerate all clinical English translations"}
              </button>
            )}
          </div>
        </div>
      ) : !compact ? (
        <p className="text-sm font-bold text-white">Patient-Reported Summary</p>
      ) : null}

      {showSetupNotice && (
        <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#9CA3AF]">{AI_TRANSLATION_SETUP_NOTICE}</p>
        </div>
      )}

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
                aiTranslationEnabled &&
                assessmentLanguage === "ar" &&
                !!assessmentId &&
                isTranslatablePatientFieldKey(fieldKey) &&
                !!entry.value.trim();

              return (
                <div key={`${block.section}-${entry.label}`} className="px-3 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {patientReportedLabel(entry.label)}
                  </dt>
                  <dd className="mt-0.5">
                    {useTranslation && fieldKey ? (
                      <TranslatableField
                        assessmentId={assessmentId}
                        fieldKey={fieldKey}
                        arabicText={entry.value}
                        fieldState={(states[fieldKey] ?? "idle") as FieldTranslationState}
                        translation={translations[fieldKey]}
                        generatedAt={generatedAtMap[fieldKey]}
                        existingReviewed={readMetaBoolean(submissionMeta, `${fieldKey}_en_reviewed`)}
                        isVoiceAnswer={voiceAnswered}
                        onTranslate={() => void translateField(fieldKey, entry.value)}
                        preferAutoTranslate
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
