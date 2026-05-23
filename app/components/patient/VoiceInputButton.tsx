"use client";

import { useEffect } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { voiceLabel } from "@/app/components/patient/voice-ui-labels";
import type { PatientLang } from "@/app/components/patient/LanguageToggle";

type Props = {
  lang: PatientLang;
  onTranscript: (text: string, method: "voice") => void;
  consentGiven: boolean;
  onConsentNeeded: () => void;
};

export function VoiceInputButton({
  lang,
  onTranscript,
  consentGiven,
  onConsentNeeded,
}: Props) {
  const { mounted, isSupported, isListening, transcript, startListening, stopListening } =
    useSpeechRecognition(lang);

  useEffect(() => {
    if (transcript.trim()) {
      onTranscript(transcript, "voice");
    }
  }, [transcript, onTranscript]);

  if (!mounted) {
    return (
      <span
        className="inline-flex min-h-9 items-center rounded-[7px] border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/30 opacity-60"
        aria-hidden
      >
        🎤 {voiceLabel("recordAnswer", lang)}
      </span>
    );
  }

  if (!isSupported) {
    return (
      <p className="w-full basis-full text-[11px] italic text-white/40">
        {voiceLabel("unsupported", lang)}
      </p>
    );
  }

  function handleRecordClick() {
    if (!consentGiven) {
      onConsentNeeded();
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleRecordClick}
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border px-3 py-2 text-xs font-semibold transition ${
          isListening
            ? "rasq-voice-listening border-[#1D9E75] bg-[#1D9E75]/15 text-[#5DCAA5]"
            : "border-[#1D9E75] bg-[#1D9E75]/10 text-[#5DCAA5] hover:bg-[#1D9E75]/20"
        }`}
        style={{ borderWidth: "0.5px" }}
      >
        🎤 {isListening ? voiceLabel("listening", lang) : voiceLabel("recordAnswer", lang)}
      </button>
      {isListening ? (
        <button
          type="button"
          onClick={stopListening}
          aria-label="Stop recording"
          className="inline-flex min-h-9 items-center rounded-[7px] border border-white/20 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          style={{ borderWidth: "0.5px" }}
        >
          {voiceLabel("stopRecording", lang)}
        </button>
      ) : null}
      {isListening ? (
        <p className="w-full basis-full text-[11px] text-[#5DCAA5]/90">
          {voiceLabel("speakNow", lang)}
        </p>
      ) : null}
    </>
  );
}
