"use client";

import { useCallback, useState } from "react";

type Props = {
  assessmentId: string;
  fieldKey: string;
  arabicText: string;
  existingTranslation?: string;
  existingGeneratedAt?: string;
  existingReviewed?: boolean;
  isVoiceAnswer?: boolean;
};

type UiState = "idle" | "loading" | "translated" | "error" | "not_configured";

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function TranslatableField({
  assessmentId,
  fieldKey,
  arabicText,
  existingTranslation,
  existingGeneratedAt,
  existingReviewed = false,
  isVoiceAnswer = false,
}: Props) {
  const [uiState, setUiState] = useState<UiState>(
    existingTranslation?.trim() ? "translated" : "idle",
  );
  const [translation, setTranslation] = useState(existingTranslation?.trim() ?? "");
  const [generatedAt, setGeneratedAt] = useState(existingGeneratedAt ?? "");
  const [reviewed, setReviewed] = useState(existingReviewed);
  const [reviewSaving, setReviewSaving] = useState(false);

  const generateTranslation = useCallback(async () => {
    setUiState("loading");
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldKey, text: arabicText }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        translation?: string;
        generatedAt?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !body.translation?.trim()) {
        setUiState(
          res.status === 503 && body.code === "not_configured" ? "not_configured" : "error",
        );
        return;
      }
      setTranslation(body.translation.trim());
      setGeneratedAt(body.generatedAt ?? new Date().toISOString());
      setReviewed(false);
      setUiState("translated");
    } catch {
      setUiState("error");
    }
  }, [assessmentId, arabicText, fieldKey]);

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
      <p dir="rtl" className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
        {isVoiceAnswer ? (
          <span className="mr-1 inline-block text-[10px] text-[#9CA3AF]" aria-hidden>
            🎤
          </span>
        ) : null}
        {arabicText}
      </p>
      {isVoiceAnswer ? (
        <p className="text-[10px] italic text-[#6B7280] print:hidden">
          Patient answered by voice — text as transcribed. Review before clinical use.
        </p>
      ) : null}

      {uiState === "idle" && (
        <button
          type="button"
          onClick={() => void generateTranslation()}
          className="print:hidden rounded-[6px] border border-[#1E2D42] bg-transparent px-2.5 py-[3px] text-[10px] text-[#6B7280] transition hover:border-[#1D9E75]/40 hover:text-[#9CA3AF]"
          style={{ borderWidth: "0.5px" }}
        >
          Generate English translation
        </button>
      )}

      {uiState === "loading" && (
        <p className="text-[10px] italic text-[#9CA3AF] print:hidden">Generating translation…</p>
      )}

      {uiState === "error" && (
        <div className="space-y-1.5 print:hidden">
          <p className="text-[10px] italic text-[#9CA3AF]">Translation unavailable. Try again.</p>
          <button
            type="button"
            onClick={() => void generateTranslation()}
            className="rounded-[6px] border border-[#1E2D42] bg-transparent px-2.5 py-[3px] text-[10px] text-[#6B7280] transition hover:border-[#1D9E75]/40 hover:text-[#9CA3AF]"
            style={{ borderWidth: "0.5px" }}
          >
            Retry
          </button>
        </div>
      )}

      {uiState === "translated" && translation && (
        <div className="translation-print-block space-y-1.5">
          <div
            className="rounded-[6px] border-l-2 border-[#1D9E75] bg-[#F0FAF6] px-3 py-2"
            style={{ borderLeftWidth: "2px" }}
          >
            <p className="text-[13px] leading-relaxed text-[#0D6B4F] whitespace-pre-wrap">
              {translation}
            </p>
          </div>
          <p className="text-[10px] italic text-[#9CA3AF] print:text-gray-500">
            AI-assisted translation — clinician review required
            {generatedAt ? (
              <span className="print:hidden">{` · ${formatGeneratedAt(generatedAt)}`}</span>
            ) : null}
          </p>
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
