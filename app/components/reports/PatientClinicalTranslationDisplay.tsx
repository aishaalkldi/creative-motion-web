import {
  PATIENT_ANSWER_CLINICAL_ENGLISH_LABEL,
  PATIENT_ANSWER_ORIGINAL_LABEL,
  PATIENT_ANSWER_TRANSLATION_DISCLAIMER,
} from "@/app/lib/reports/clinical-report-copy";

type Props = {
  originalText: string;
  clinicalEnglish?: string;
  variant?: "screen" | "print";
  isVoiceAnswer?: boolean;
  isLoading?: boolean;
};

export function PatientClinicalTranslationDisplay({
  originalText,
  clinicalEnglish = "",
  variant = "screen",
  isVoiceAnswer = false,
  isLoading = false,
}: Props) {
  const showTranslation = clinicalEnglish.trim().length > 0;
  const originalLabelClass =
    variant === "print"
      ? "text-[10px] font-semibold uppercase tracking-wider text-gray-500"
      : "text-[10px] font-semibold uppercase tracking-wider text-white/40";
  const originalTextClass =
    variant === "print"
      ? "text-sm leading-relaxed text-gray-900 whitespace-pre-wrap"
      : "text-sm leading-relaxed text-white/80 whitespace-pre-wrap";
  const clinicalLabelClass =
    variant === "print"
      ? "mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#0D6B4F]"
      : "mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#5DCAA5]";
  const clinicalTextClass =
    variant === "print"
      ? "mt-1 text-sm leading-relaxed text-[#0D6B4F] whitespace-pre-wrap"
      : "mt-1 text-sm leading-relaxed text-[#B8F0DC] whitespace-pre-wrap";
  const disclaimerClass =
    variant === "print"
      ? "mt-1.5 text-[10px] italic leading-relaxed text-gray-500"
      : "mt-1.5 text-[10px] italic leading-relaxed text-white/35";
  const translationBoxClass =
    variant === "print"
      ? "mt-1 rounded border-l-2 border-[#1D9E75] bg-[#F0FAF6] px-3 py-2"
      : "mt-1 rounded-[6px] border-l-2 border-[#1D9E75] bg-[#F0FAF6]/10 px-3 py-2";

  return (
    <div className="space-y-1">
      <p className={originalLabelClass}>{PATIENT_ANSWER_ORIGINAL_LABEL}</p>
      <p dir="rtl" className={originalTextClass}>
        {isVoiceAnswer ? (
          <span className="mr-1 inline-block text-[10px] text-[#9CA3AF]" aria-hidden>
            🎤
          </span>
        ) : null}
        {originalText}
      </p>
      {isVoiceAnswer ? (
        <p
          className={
            variant === "print"
              ? "text-[10px] italic text-gray-500"
              : "text-[10px] italic text-[#6B7280] print:hidden"
          }
        >
          Patient answered by voice — text as transcribed. Review before clinical use.
        </p>
      ) : null}

      {isLoading ? (
        <p
          className={
            variant === "print"
              ? "mt-2 text-[10px] italic text-gray-500"
              : "mt-2 text-[10px] italic text-[#9CA3AF] print:hidden"
          }
        >
          Generating clinical English translation...
        </p>
      ) : null}

      {showTranslation ? (
        <div className={translationBoxClass}>
          <p className={clinicalLabelClass}>{PATIENT_ANSWER_CLINICAL_ENGLISH_LABEL}</p>
          <p className={clinicalTextClass}>{clinicalEnglish}</p>
          <p className={disclaimerClass}>{PATIENT_ANSWER_TRANSLATION_DISCLAIMER}</p>
        </div>
      ) : null}
    </div>
  );
}
