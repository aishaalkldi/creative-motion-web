"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ELEVENLABS_MAX_DURATION_SEC } from "@/app/lib/elevenlabs-constants";
import {
  detectBrowserSpeechRecognitionSupport,
  transcribeWithBrowserSpeech,
} from "@/app/lib/patient/browser-speech-to-text";
import { voiceLabel, VOICE_SUBMIT_BLOCK_MESSAGE } from "@/app/components/patient/voice-ui-labels";
import type { PatientLang } from "@/app/components/patient/LanguageToggle";

type Props = {
  lang: PatientLang;
  assessmentToken: string;
  fieldValue?: string;
  onTranscript: (text: string, method: "voice") => void;
  onTranscriptionFailed?: () => void;
  consentGiven: boolean;
  onConsentNeeded: () => void;
};

type RecordPhase = "idle" | "recording" | "processing" | "browser_listening";

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

function isMediaRecorderSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
}

export function VoiceInputButton({
  lang,
  assessmentToken,
  fieldValue,
  onTranscript,
  onTranscriptionFailed,
  consentGiven,
  onConsentNeeded,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<RecordPhase>("idle");
  const [errorKey, setErrorKey] = useState<
    "manual" | "permission_denied" | "no_speech" | "voice_corrupted" | null
  >(null);
  const [transcribedOk, setTranscribedOk] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const stopTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  const stopMediaCapture = useCallback(() => {
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (tickTimerRef.current != null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    setRecordingSeconds(0);
  }, []);

  const runBrowserSpeechFallback = useCallback(async () => {
    if (!detectBrowserSpeechRecognitionSupport()) {
      setErrorKey("manual");
      onTranscriptionFailed?.();
      setPhase("idle");
      return;
    }

    setPhase("browser_listening");
    setErrorKey(null);
    const result = await transcribeWithBrowserSpeech(lang);
    if (result.ok) {
      setTranscribedOk(true);
      onTranscript(result.text, "voice");
      setPhase("idle");
      return;
    }

    if (result.error === "permission_denied") {
      setErrorKey("permission_denied");
    } else if (result.error === "no_speech") {
      setErrorKey("no_speech");
    } else {
      setErrorKey("manual");
    }
    onTranscriptionFailed?.();
    setPhase("idle");
  }, [lang, onTranscript, onTranscriptionFailed]);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setPhase("processing");
      setErrorKey(null);
      let delegatedToBrowser = false;
      try {
        const form = new FormData();
        form.append("audio", blob, "assessment-answer.webm");
        form.append("language", lang);
        const res = await fetch(`/api/remote-assessments/${encodeURIComponent(assessmentToken)}/transcribe`, {
          method: "POST",
          body: form,
        });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string; fallback?: string };
        if (!res.ok || !body.text?.trim()) {
          delegatedToBrowser = true;
          await runBrowserSpeechFallback();
          return;
        }
        setTranscribedOk(true);
        onTranscript(body.text.trim(), "voice");
      } catch {
        delegatedToBrowser = true;
        await runBrowserSpeechFallback();
      } finally {
        if (!delegatedToBrowser) {
          setPhase("idle");
        }
      }
    },
    [assessmentToken, lang, onTranscript, runBrowserSpeechFallback],
  );

  const startRecording = useCallback(async () => {
    if (!isMediaRecorderSupported()) {
      if (detectBrowserSpeechRecognitionSupport()) {
        await runBrowserSpeechFallback();
        return;
      }
      setErrorKey("manual");
      return;
    }

    setTranscribedOk(false);
    setErrorKey(null);
    chunksRef.current = [];
    mimeTypeRef.current = pickRecorderMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        stopMediaCapture();
        setPhase("idle");
        void runBrowserSpeechFallback();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];
        void uploadRecording(blob);
      };

      recorder.start();
      setPhase("recording");
      setRecordingSeconds(0);
      tickTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      stopTimerRef.current = window.setTimeout(() => {
        stopMediaCapture();
      }, ELEVENLABS_MAX_DURATION_SEC * 1000);
    } catch {
      setPhase("idle");
      setErrorKey("permission_denied");
    }
  }, [runBrowserSpeechFallback, stopMediaCapture, uploadRecording]);

  useEffect(() => {
    setMounted(true);
    return () => {
      stopMediaCapture();
    };
  }, [stopMediaCapture]);

  function handleRecordClick() {
    if (!consentGiven) {
      onConsentNeeded();
      return;
    }
    if (phase === "browser_listening") return;
    if (phase === "recording") {
      stopMediaCapture();
      return;
    }
    if (phase === "processing") return;
    void startRecording();
  }

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

  if (!isMediaRecorderSupported() && !detectBrowserSpeechRecognitionSupport()) {
    return (
      <p className="w-full basis-full text-[11px] italic text-white/40">
        {voiceLabel("unsupported", lang)}
      </p>
    );
  }

  const isRecording = phase === "recording";
  const isProcessing = phase === "processing";
  const isBrowserListening = phase === "browser_listening";

  return (
    <>
      <button
        type="button"
        onClick={handleRecordClick}
        disabled={isProcessing || isBrowserListening}
        aria-label={isRecording ? "Stop voice input" : "Start voice input"}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isRecording || isBrowserListening
            ? "rasq-voice-listening border-[#1D9E75] bg-[#1D9E75]/15 text-[#5DCAA5]"
            : "border-[#1D9E75] bg-[#1D9E75]/10 text-[#5DCAA5] hover:bg-[#1D9E75]/20"
        }`}
        style={{ borderWidth: "0.5px" }}
      >
        🎤{" "}
        {isProcessing
          ? voiceLabel("processing", lang)
          : isBrowserListening
            ? voiceLabel("browserFallbackListening", lang)
            : isRecording
              ? `${voiceLabel("listening", lang)} ${recordingSeconds}s`
              : voiceLabel("recordAnswer", lang)}
      </button>
      {isRecording ? (
        <button
          type="button"
          onClick={stopMediaCapture}
          aria-label="Stop recording"
          className="inline-flex min-h-9 items-center rounded-[7px] border border-white/20 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          style={{ borderWidth: "0.5px" }}
        >
          {voiceLabel("stopRecording", lang)}
        </button>
      ) : null}
      {isRecording ? (
        <p className="w-full basis-full text-[11px] text-[#5DCAA5]/90">{voiceLabel("speakNow", lang)}</p>
      ) : null}
      {isBrowserListening ? (
        <p className="w-full basis-full text-[11px] text-[#5DCAA5]/90">{voiceLabel("browserFallbackHint", lang)}</p>
      ) : null}
      {transcribedOk && phase === "idle" ? (
        <p className="w-full basis-full rounded-[6px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-2.5 py-1.5 text-[11px] text-[#5DCAA5]">
          ✓ {voiceLabel("transcribedSuccess", lang)}
        </p>
      ) : null}
      {errorKey === "manual" ? (
        <p className="w-full basis-full text-[11px] italic text-[#D97706]">
          {voiceLabel("manualFallback", lang)}
        </p>
      ) : null}
      {errorKey === "voice_corrupted" ? (
        <p className="w-full basis-full text-[11px] italic text-[#D97706]">{VOICE_SUBMIT_BLOCK_MESSAGE}</p>
      ) : null}
      {errorKey === "permission_denied" ? (
        <p className="w-full basis-full text-[11px] italic text-[#D97706]">
          {voiceLabel("permissionDenied", lang)}
        </p>
      ) : null}
      {errorKey === "no_speech" ? (
        <p className="w-full basis-full text-[11px] italic text-[#9CA3AF]">
          {voiceLabel("noSpeech", lang)}
        </p>
      ) : null}
    </>
  );
}
