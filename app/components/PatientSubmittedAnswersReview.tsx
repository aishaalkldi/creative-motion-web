"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ExtractedFieldsPanel } from "@/app/components/clinician/ExtractedFieldsPanel";
import {
  AI_TRANSLATION_SETUP_NOTICE,
  isAiTranslationEnabled,
} from "@/app/lib/ai/ai-features";
import { patientReportedLabel } from "@/app/lib/reports/clinical-report-copy";
import {
  readApprovedPatientReportFacts,
  type ApprovedPatientReportFacts,
} from "@/app/lib/reports/approved-patient-facts";
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
  onApprovedFactsChange?: (facts: ApprovedPatientReportFacts) => void;
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

/** Snapshot of the primitive values reported to the parent's onTranslationProgress callback. */
export type TranslationProgressSnapshot = {
  doneCount: number;
  totalCount: number;
  allTranslated: boolean;
  anyLoading: boolean;
};

/**
 * Compares only the primitive progress values — deliberately ignores the
 * `translateAll` function identity, which can change reference across
 * renders (e.g. when an upstream memo recomputes) without any of these
 * primitives actually changing. Reporting on identity churn alone is what
 * previously caused an infinite parent-update loop.
 */
export function hasTranslationProgressChanged(
  prev: TranslationProgressSnapshot | null,
  next: TranslationProgressSnapshot,
): boolean {
  if (!prev) return true;
  return (
    prev.doneCount !== next.doneCount ||
    prev.totalCount !== next.totalCount ||
    prev.allTranslated !== next.allTranslated ||
    prev.anyLoading !== next.anyLoading
  );
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
  onApprovedFactsChange,
}: Props) {
  const aiTranslationEnabled = isAiTranslationEnabled();
  // Memoized so its identity is stable across renders when patientDraft/
  // includedSections haven't changed — buildFullClinicianReview is pure but
  // was previously called unmemoized on every render, which cascaded into a
  // new arabicFields array and a new translateAll closure identity every
  // time, defeating the progress-reporting effect's dependency comparison.
  const blocks = useMemo(
    () => buildFullClinicianReview(patientDraft, includedSections),
    [patientDraft, includedSections],
  );
  const initialApprovedFacts = useMemo(
    () => readApprovedPatientReportFacts(submissionMeta),
    [submissionMeta],
  );
  const [approvedFacts, setApprovedFacts] = useState<ApprovedPatientReportFacts | null>(
    initialApprovedFacts,
  );
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    setApprovedFacts(initialApprovedFacts);
  }, [initialApprovedFacts]);

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

  const lastReportedProgressRef = useRef<TranslationProgressSnapshot | null>(null);
  const lastReportedAssessmentIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!aiTranslationEnabled || !onTranslationProgress || assessmentLanguage !== "ar" || !assessmentId) {
      return;
    }
    if (lastReportedAssessmentIdRef.current !== assessmentId) {
      // A different assessment is now being reviewed — always report its
      // initial progress, even if the primitive values happen to coincide
      // with the previous assessment's last-reported snapshot.
      lastReportedAssessmentIdRef.current = assessmentId;
      lastReportedProgressRef.current = null;
    }
    const next: TranslationProgressSnapshot = { doneCount, totalCount, allTranslated, anyLoading };
    // Guards against calling the parent callback on every render: even if
    // translateAll's identity changes without a real progress change (e.g.
    // from upstream identity churn), the parent is only ever notified when
    // one of these primitive values actually differs from what was last
    // reported — belt-and-suspenders alongside the blocks memoization above.
    if (!hasTranslationProgressChanged(lastReportedProgressRef.current, next)) {
      return;
    }
    lastReportedProgressRef.current = next;
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

  async function handleApprovePatientReportFacts() {
    if (!assessmentId || approveSaving) return;
    setApproveSaving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvePatientReportFacts: true }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        approved?: boolean;
        approvedPatientReportFacts?: ApprovedPatientReportFacts;
        error?: string;
      };
      if (!res.ok || !payload.approved || !payload.approvedPatientReportFacts) {
        setApproveError(payload.error ?? "Could not approve patient-reported information.");
        return;
      }
      setApprovedFacts(payload.approvedPatientReportFacts);
      onApprovedFactsChange?.(payload.approvedPatientReportFacts);
    } finally {
      setApproveSaving(false);
    }
  }

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
                  {block.section === "pain" && fieldKey === "chiefComplaint" && assessmentId ? (
                    <ExtractedFieldsPanel
                      assessmentId={assessmentId}
                      originalText={entry.value}
                      initialExtraction={submissionMeta?.chiefComplaint_extraction}
                      initialGeneratedAt={submissionMeta?.chiefComplaint_extraction_generated_at}
                      initialReviewed={submissionMeta?.chiefComplaint_extraction_reviewed}
                    />
                  ) : null}
                </div>
              );
            })}
          </dl>
        </div>
      ))}

      {assessmentId && !compact ? (
        <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3.5">
          {approvedFacts ? (
            <>
              <p className="text-sm text-[#5DCAA5]">
                Patient-reported information approved for PT report generation.
              </p>
              <button
                type="button"
                disabled={approveSaving}
                onClick={() => void handleApprovePatientReportFacts()}
                className="mt-3 rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveSaving
                  ? "Re-approving updated information…"
                  : "Re-approve updated information"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-[#9CA3AF]">
                Review all translated and extracted information before approving it for report
                generation.
              </p>
              <button
                type="button"
                disabled={approveSaving}
                onClick={() => void handleApprovePatientReportFacts()}
                className="mt-3 rounded-[6px] bg-[#1D9E75] px-3.5 py-[6px] text-[11px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveSaving
                  ? "Approving patient-reported information…"
                  : "Approve patient-reported information for report generation"}
              </button>
            </>
          )}
          {approveError ? (
            <p className="mt-2 text-xs text-rose-300/90">{approveError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
