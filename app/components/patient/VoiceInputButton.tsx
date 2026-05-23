"use client";

import { useEffect } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Props = {
  lang: "ar" | "en";
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
  const { isSupported, isListening, transcript, startListening, stopListening } =
    useSpeechRecognition(lang);

  useEffect(() => {
    if (transcript.trim()) {
      onTranscript(transcript, "voice");
    }
  }, [transcript, onTranscript]);

  if (!isSupported) return null;

  function handleClick() {
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
    <button
      type="button"
      onClick={handleClick}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border bg-transparent text-base transition ${
        isListening ? "rasq-voice-listening text-[#1D9E75]" : "border-[#E2E8E5] text-[#9CA3AF]"
      }`}
      style={{ borderWidth: "0.5px" }}
    >
      🎤
    </button>
  );
}
