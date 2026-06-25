"use client";

import { useState } from "react";
import { AILabel } from "@/app/components/clinician/AILabel";
import { PatientClinicalTranslationDisplay } from "@/app/components/reports/PatientClinicalTranslationDisplay";

type Props = {
  assessmentId: string;
  fieldKey: string;
  arabicText: string;
  fieldState: "idle" | "loading" | "done" | "failed" | "cached";
  translation?: string;
  generatedAt?: string;
  existingReviewed?: boolean;
  isVoiceAnswer?: boolean;
  onTranslate: () => void;
  preferAutoTranslate?: boolean;
};

export function TranslatableField({
  assessmentId,
  fieldKey,
  arabicText,
  fieldState,
  translation = "",
  generatedAt = "",
  existingReviewed = false,
  isVoiceAnswer = false,
  onTranslate,
  preferAutoTranslate = false,
}: Props) {
  const [reviewed, setReviewed] = useState(existingReviewed);
  const [reviewSaving, setReviewSaving] = useState(false);

  const showTranslation =
    (fieldState === "done" || fieldState === "cached") && translation.trim().length > 0;

  async function handleReviewChange(checked: boolean) {
    if (!checked || reviewed) return;
    setReviewSaving(true);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldKey, markTranslationReviewed: true }),
      });
      if (res.ok) {
        setReviewed(true);
      }
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <PatientClinicalTranslationDisplay
        originalText={arabicText}
        clinicalEnglish={showTranslation ? translation : ""}
        isVoiceAnswer={isVoiceAnswer}
        isLoading={fieldState === "loading"}
        variant="screen"
      />

      {fieldState === "idle" && !preferAutoTranslate && (
        <button
          type="button"
          onClick={onTranslate}
          className="print:hidden rounded-[6px] border border-[#1E2D42] bg-transparent px-2.5 py-[3px] text-[10px] text-[#6B7280] transition hover:border-[#1D9E75]/40 hover:text-[#9CA3AF]"
          style={{ borderWidth: "0.5px" }}
        >
          Generate clinical English translation
        </button>
      )}

      {showTranslation && (
        <div className="translation-print-block space-y-1.5">
          <AILabel generatedAt={generatedAt || undefined} />
          <span
            role="button"
            tabIndex={0}
            onClick={onTranslate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTranslate();
              }
            }}
            className="mt-[3px] block cursor-pointer text-[9px] text-[#374151] print:hidden"
          >
            Retranslate
          </span>
          <label className="print:hidden flex cursor-pointer items-center gap-2 text-[10px] text-[#6B7280]">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={reviewed || reviewSaving}
              onChange={(e) => void handleReviewChange(e.target.checked)}
              className="rounded border-[#1E2D42]"
            />
            {reviewed ? (
              <span className="text-[#5DCAA5]">✓ Reviewed</span>
            ) : (
              "Mark as reviewed"
            )}
          </label>
        </div>
      )}
    </div>
  );
}
