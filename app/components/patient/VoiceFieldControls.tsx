"use client";

import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { VoiceInputButton } from "@/app/components/patient/VoiceInputButton";
import { voiceLabel } from "@/app/components/patient/voice-ui-labels";
import type { PatientLang } from "@/app/components/patient/LanguageToggle";

type Props = {
  lang: PatientLang;
  questionText: string;
  fieldValue?: string;
  consentGiven: boolean;
  onConsentNeeded: () => void;
  onTranscript: (text: string) => void;
  onTranscriptionFailed?: () => void;
  showRecord?: boolean;
};

export function VoiceFieldControls({
  lang,
  questionText,
  fieldValue,
  consentGiven,
  onConsentNeeded,
  onTranscript,
  onTranscriptionFailed,
  showRecord = true,
}: Props) {
  const { mounted, isSupported, speak } = useSpeechSynthesis();

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {mounted && isSupported ? (
        <button
          type="button"
          onClick={() => speak(questionText, lang)}
          aria-label="Listen to question"
          title={voiceLabel("listen", lang)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border border-white/20 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/75 transition hover:border-white/35 hover:text-white"
          style={{ borderWidth: "0.5px" }}
        >
          🔊 {voiceLabel("listen", lang)}
        </button>
      ) : null}
      {showRecord ? (
        <VoiceInputButton
          lang={lang}
          fieldValue={fieldValue}
          consentGiven={consentGiven}
          onConsentNeeded={onConsentNeeded}
          onTranscript={onTranscript}
          onTranscriptionFailed={onTranscriptionFailed}
        />
      ) : null}
    </div>
  );
}
