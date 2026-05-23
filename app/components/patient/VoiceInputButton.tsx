"use client";

import { useEffect } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Props = {
  lang: "ar" | "en";
  onTranscript: (text: string, method: "voice") => void;
  consentGiven: boolean;
  onConsentNeeded: () => void;
};

const showUnsupportedMic = process.env.NODE_ENV === "development";

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
        className="mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.03] text-base opacity-40"
        aria-hidden
      >
        🎤
      </span>
    );
  }

  if (!isSupported && !showUnsupportedMic) return null;

  function handleClick() {
    if (!isSupported) return
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

  const disabled = !isSupported;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        disabled
          ? "Voice input is not supported in this browser."
          : isListening
            ? "Stop voice input"
            : "Start voice input"
      }
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={`mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border text-base leading-none transition ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"
          : isListening
            ? "rasq-voice-listening border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
            : "border-white/30 bg-white/[0.08] text-white/90 hover:border-[#1D9E75] hover:text-[#1D9E75]"
      }`}
      style={{ borderWidth: "0.5px" }}
    >
      🎤
    </button>
  );
}
