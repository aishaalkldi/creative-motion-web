"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyArabicPtPhrasebook,
  buildVoiceIntakeClinicalPackage,
  previewClinicalParagraphFromLiveEnglish,
  refineClinicalTranslation,
  VOICE_INTAKE_DISCLAIMER,
  type VoiceIntakeClinicalFields,
} from "@/app/lib/clinicalTranslation";
import {
  buildInterpretationDraft,
  getPatientPrompt,
  getPatientPromptCount,
  normalizeTranscriptText,
  translateArabicToEnglish,
  translateEnglishToArabic,
} from "./voice-clinical-assistant";

export type VoiceAssistantPayload = {
  originalTranscriptRaw: string;
  clinicalTranslationParagraph: string;
  clinicalFields: VoiceIntakeClinicalFields;
  supportingDraftText: string;
};

type VoiceMode = "patient" | "therapist";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
  };
};

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

async function pollAssemblyTranscript(transcriptId: string): Promise<string> {
  const maxAttempts = 45;
  const delayMs = 1500;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const res = await fetch(`/api/assemblyai/status?transcriptId=${encodeURIComponent(transcriptId)}`);
    const data = (await res.json()) as {
      status?: string;
      text?: string | null;
      error?: string | null;
    };
    if (data.status === "completed" && data.text?.trim()) return data.text.trim();
    if (data.status === "error" || data.error) {
      throw new Error(data.error || "Transcription failed.");
    }
  }
  throw new Error("Transcription is taking too long. Try a shorter clip.");
}

type Props = {
  onInsertIntoForm: (payload: VoiceAssistantPayload) => void;
  onInsertIntoSoap: (payload: VoiceAssistantPayload) => void;
  /** Label for the panel toggle when closed (default: Open voice intake) */
  openButtonLabel?: string;
  /** Heading above the feature (default: AI PT Assistant — voice intake) */
  featureTitle?: string;
  /** SOAP insert button label (default: Insert into SOAP Subjective) */
  insertSoapButtonLabel?: string;
};

const DEFAULT_FEATURE_TITLE = "AI Voice Clinical Assistant";

export function VoiceClinicalAssistant({
  onInsertIntoForm,
  onInsertIntoSoap,
  openButtonLabel = "Open voice intake",
  featureTitle = DEFAULT_FEATURE_TITLE,
  insertSoapButtonLabel = "Insert into SOAP Subjective",
}: Props) {
  const [browserReady, setBrowserReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("therapist");
  const [speechLang, setSpeechLang] = useState<"en-US" | "ar-SA">("en-US");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalChunks, setFinalChunks] = useState<string[]>([]);
  const [patientStep, setPatientStep] = useState(0);
  const [sessionLog, setSessionLog] = useState<string[]>([]);

  const [lastOriginalRaw, setLastOriginalRaw] = useState("");
  const [lastEnglishWorking, setLastEnglishWorking] = useState("");
  const [clinicalParagraph, setClinicalParagraph] = useState("");
  const [clinicalParagraphAr, setClinicalParagraphAr] = useState<string | null>(null);
  const [paragraphView, setParagraphView] = useState<"en" | "ar">("en");
  const [lastClinicalFields, setLastClinicalFields] = useState<VoiceIntakeClinicalFields | null>(null);
  const [supportingDraft, setSupportingDraft] = useState("");
  const [wasTranslated, setWasTranslated] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [err, setErr] = useState("");
  const [assemblyAiConfigured, setAssemblyAiConfigured] = useState(false);

  const recRef = useRef<RecognitionLike | null>(null);
  /** Parallel browser STT during AssemblyAI capture — live summary only; final text comes from cloud. */
  const previewRecRef = useRef<RecognitionLike | null>(null);
  const captureRef = useRef<{ finals: string[]; interim: string }>({ finals: [], interim: "" });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const lastRecorderMimeRef = useRef<string>("audio/webm");

  const liveText = useMemo(
    () => [...finalChunks, interim].filter(Boolean).join(" ").trim(),
    [finalChunks, interim],
  );

  const liveClinicalPreview = useMemo(() => {
    if (!liveText.trim()) return "";
    const work =
      speechLang.startsWith("ar") ? applyArabicPtPhrasebook(liveText) : normalizeTranscriptText(liveText);
    return previewClinicalParagraphFromLiveEnglish(work);
  }, [liveText, speechLang]);

  useEffect(() => {
    setBrowserReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/assemblyai/status");
        const data = (await res.json()) as { configured?: boolean };
        if (!cancelled) setAssemblyAiConfigured(Boolean(data.configured));
      } catch {
        if (!cancelled) setAssemblyAiConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const browserSttSupported = browserReady && Boolean(getRecognitionCtor());
  const mediaCaptureSupported = browserReady && Boolean(navigator.mediaDevices?.getUserMedia);
  const captureSupported = assemblyAiConfigured ? mediaCaptureSupported : browserSttSupported;

  const stopPreviewRecognition = useCallback(() => {
    const pr = previewRecRef.current;
    previewRecRef.current = null;
    if (!pr) return;
    try {
      pr.abort();
    } catch {
      try {
        pr.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const stopMediaCapture = useCallback(() => {
    stopPreviewRecognition();
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setListening(false);
  }, [stopPreviewRecognition]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      stopPreviewRecognition();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopPreviewRecognition]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setErr("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setErr("");
    setInterim("");
    setFinalChunks([]);
    captureRef.current = { finals: [], interim: "" };
    setLastOriginalRaw("");
    setLastEnglishWorking("");
    setClinicalParagraph("");
    setClinicalParagraphAr(null);
    setParagraphView("en");
    setLastClinicalFields(null);
    setSupportingDraft("");

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev: RecognitionEventLike) => {
      let interimPiece = "";
      const finals: string[] = [];
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        const bit = row[0]?.transcript ?? "";
        if (row.isFinal) finals.push(bit);
        else interimPiece += bit;
      }
      if (finals.length) {
        captureRef.current.finals = [...captureRef.current.finals, ...finals];
        setFinalChunks([...captureRef.current.finals]);
      }
      captureRef.current.interim = interimPiece;
      setInterim(interimPiece);
    };

    rec.onerror = (e) => {
      setErr(e.error === "not-allowed" ? "Microphone permission denied." : `Speech error: ${e.error ?? "unknown"}`);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setErr("Could not start microphone.");
      setListening(false);
    }
  }, [speechLang]);

  const startMediaRecording = useCallback(async () => {
    stopPreviewRecognition();
    setErr("");
    setInterim("");
    setFinalChunks([]);
    captureRef.current = { finals: [], interim: "" };
    setLastOriginalRaw("");
    setLastEnglishWorking("");
    setClinicalParagraph("");
    setClinicalParagraphAr(null);
    setParagraphView("en");
    setLastClinicalFields(null);
    setSupportingDraft("");
    mediaChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mime = pickRecorderMime();
      lastRecorderMimeRef.current = mime ?? "audio/webm";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) mediaChunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        setErr("Recording error.");
        stopMediaCapture();
      };
      rec.start(250);
      setListening(true);

      const Ctor = getRecognitionCtor();
      if (Ctor) {
        try {
          const pr = new Ctor();
          previewRecRef.current = pr;
          pr.lang = speechLang;
          pr.continuous = true;
          pr.interimResults = true;
          pr.onresult = (ev: RecognitionEventLike) => {
            let interimPiece = "";
            const finals: string[] = [];
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
              const row = ev.results[i];
              const bit = row[0]?.transcript ?? "";
              if (row.isFinal) finals.push(bit);
              else interimPiece += bit;
            }
            if (finals.length) {
              captureRef.current.finals = [...captureRef.current.finals, ...finals];
              setFinalChunks([...captureRef.current.finals]);
            }
            captureRef.current.interim = interimPiece;
            setInterim(interimPiece);
          };
          pr.onerror = () => {
            previewRecRef.current = null;
          };
          pr.onend = () => {
            previewRecRef.current = null;
          };
          pr.start();
        } catch {
          previewRecRef.current = null;
        }
      }
    } catch {
      setErr("Microphone permission denied or unavailable.");
      setListening(false);
    }
  }, [stopMediaCapture, speechLang, stopPreviewRecognition]);

  const beginCapture = useCallback(() => {
    if (assemblyAiConfigured) {
      void startMediaRecording();
      return;
    }
    startRecognition();
  }, [assemblyAiConfigured, startMediaRecording, startRecognition]);

  const runClinicalPipeline = useCallback(
    async (rawStt: string) => {
      let glossed = speechLang.startsWith("ar") ? applyArabicPtPhrasebook(rawStt) : rawStt;
      let englishWorking = normalizeTranscriptText(glossed);
      let translated = false;

      if (speechLang.startsWith("ar")) {
        const en = await translateArabicToEnglish(glossed);
        if (en) {
          englishWorking = normalizeTranscriptText(en);
          translated = true;
        }
      }

      setWasTranslated(translated);
      setLastEnglishWorking(englishWorking);

      const { rawFields, clinicalFields, clinicalParagraph: para } = buildVoiceIntakeClinicalPackage(englishWorking);
      setLastClinicalFields(clinicalFields);
      setClinicalParagraph(para);
      setClinicalParagraphAr(null);
      setParagraphView("en");

      const interp = buildInterpretationDraft({
        mode,
        speechLang,
        wasTranslated: translated,
        englishWorkingText: englishWorking,
        fields: rawFields,
      });
      setSupportingDraft(interp);

      return { englishWorking, clinicalFields, para, rawFields, interp };
    },
    [mode, speechLang],
  );

  const handleStopRecording = useCallback(async () => {
    const cap = captureRef.current;
    const rawStt = [...cap.finals, cap.interim].filter(Boolean).join(" ").trim();
    stopRecognition();
    captureRef.current = { finals: [], interim: "" };
    setInterim("");
    setFinalChunks([]);
    if (!rawStt) {
      setErr("No speech captured.");
      return;
    }
    setProcessing(true);
    setErr("");
    setLastOriginalRaw(rawStt);

    await runClinicalPipeline(rawStt);
    setProcessing(false);

    if (mode === "patient") {
      const prompt = getPatientPrompt(patientStep);
      setSessionLog((s) => [...s, `Q: ${prompt}`, `A: ${rawStt.slice(0, 400)}`]);
      setPatientStep((p) => Math.min(p + 1, getPatientPromptCount() - 1));
    }
  }, [stopRecognition, mode, patientStep, runClinicalPipeline]);

  const handleStopCapture = useCallback(async () => {
    if (assemblyAiConfigured) {
      stopPreviewRecognition();
      const rec = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;
      if (!rec) {
        stopMediaCapture();
        return;
      }
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
      stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      setListening(false);

      const blob = new Blob(mediaChunksRef.current, { type: lastRecorderMimeRef.current });
      mediaChunksRef.current = [];
      if (blob.size < 64) {
        setErr("No audio captured.");
        return;
      }
      setInterim("");
      setFinalChunks([]);
      captureRef.current = { finals: [], interim: "" };
      setProcessing(true);
      setErr("");
      try {
        const form = new FormData();
        form.append("audio", blob, "capture.webm");
        form.append("language_code", speechLang.startsWith("ar") ? "ar" : "en");
        const trRes = await fetch("/api/assemblyai/transcribe", { method: "POST", body: form });
        const trJson = (await trRes.json()) as { transcriptId?: string; error?: string; detail?: string };
        if (!trRes.ok) {
          const msg = trJson.error || trJson.detail || "Transcription request failed.";
          throw new Error(typeof msg === "string" ? msg : "Transcription request failed.");
        }
        if (!trJson.transcriptId) throw new Error("No transcript id returned.");
        const text = await pollAssemblyTranscript(trJson.transcriptId);
        setLastOriginalRaw(text);
        await runClinicalPipeline(text);
        if (mode === "patient") {
          const prompt = getPatientPrompt(patientStep);
          setSessionLog((s) => [...s, `Q: ${prompt}`, `A: ${text.slice(0, 400)}`]);
          setPatientStep((p) => Math.min(p + 1, getPatientPromptCount() - 1));
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Cloud transcription failed.";
        // Surface a clear message distinguishing key vs API errors so the clinician can act.
        const isKeyError = raw.toLowerCase().includes("not configured") || raw.toLowerCase().includes("503");
        setErr(
          isKeyError
            ? "Voice transcription is unavailable (ASSEMBLYAI_API_KEY not set on the server). You can continue typing manually."
            : `Transcription failed: ${raw}. You can continue typing manually.`,
        );
      } finally {
        setProcessing(false);
      }
      return;
    }
    await handleStopRecording();
  }, [
    assemblyAiConfigured,
    speechLang,
    mode,
    patientStep,
    runClinicalPipeline,
    stopMediaCapture,
    handleStopRecording,
  ]);

  const handleRefineClinical = useCallback(() => {
    if (!lastClinicalFields) return;
    setClinicalParagraph(refineClinicalTranslation(clinicalParagraph, lastClinicalFields));
    setClinicalParagraphAr(null);
    setParagraphView("en");
  }, [clinicalParagraph, lastClinicalFields]);

  const handleTranslateToArabic = useCallback(async () => {
    if (!clinicalParagraph.trim()) return;
    setTranslating(true);
    setErr("");
    const ar = await translateEnglishToArabic(clinicalParagraph);
    setTranslating(false);
    if (ar) {
      setClinicalParagraphAr(ar);
      setParagraphView("ar");
    } else {
      setErr("Arabic translation unavailable. Try again or shorten text.");
    }
  }, [clinicalParagraph]);

  const handleTranslateToEnglish = useCallback(async () => {
    if (paragraphView === "ar" && clinicalParagraphAr) {
      setTranslating(true);
      setErr("");
      const back = await translateArabicToEnglish(clinicalParagraphAr);
      setTranslating(false);
      if (back) {
        setClinicalParagraph(normalizeTranscriptText(back));
        setClinicalParagraphAr(null);
        setParagraphView("en");
      } else {
        setErr("Could not translate back to English.");
      }
    } else {
      setParagraphView("en");
      setClinicalParagraphAr(null);
    }
  }, [paragraphView, clinicalParagraphAr]);

  const effectivePayload: VoiceAssistantPayload | null =
    lastOriginalRaw && lastClinicalFields
      ? {
          originalTranscriptRaw: lastOriginalRaw,
          clinicalTranslationParagraph: clinicalParagraph,
          clinicalFields: lastClinicalFields,
          supportingDraftText: supportingDraft,
        }
      : null;

  const displayedParagraph =
    paragraphView === "ar" && clinicalParagraphAr ? clinicalParagraphAr : clinicalParagraph;

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] p-4">
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-3 text-[11px] leading-relaxed text-amber-100/90">
        <p className="font-semibold text-amber-50/95">{VOICE_INTAKE_DISCLAIMER}</p>
        <p className="mt-1 text-amber-100/85">
          AI is assistive only. Therapist must validate all clinical text before the record or report.
        </p>
      </div>

      {/* Unavailable banner — shown before the toggle so clinicians understand immediately */}
      {browserReady && !captureSupported && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-white/75">Voice transcription is unavailable.</p>
            <p className="mt-0.5 text-xs text-white/45">
              {assemblyAiConfigured
                ? "Microphone access is blocked or not supported by this browser."
                : "Neither AssemblyAI (ASSEMBLYAI_API_KEY not set) nor browser speech recognition is available."}
              {" "}You can continue typing manually in the fields below.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">{featureTitle}</p>
          <p className="mt-1 text-[11px] text-white/50">
            {assemblyAiConfigured
              ? "Cloud capture via AssemblyAI. Arabic path includes phrase hints and translation."
              : captureSupported
                ? "Using browser speech recognition (no AssemblyAI key configured)."
                : "Voice input is not available — type directly into the fields below."}
          </p>
        </div>
        {captureSupported || !browserReady ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            {open ? "Close" : openButtonLabel}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {browserReady && !captureSupported ? (
            <p className="text-sm text-amber-200/90">
              Voice transcription is unavailable. Continue typing manually into the assessment fields.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-2 text-white/70">
              <input
                type="radio"
                name="vmode"
                checked={mode === "patient"}
                onChange={() => setMode("patient")}
                className="border-white/30"
              />
              Patient voice intake (guided)
            </label>
            <label className="flex items-center gap-2 text-white/70">
              <input
                type="radio"
                name="vmode"
                checked={mode === "therapist"}
                onChange={() => setMode("therapist")}
                className="border-white/30"
              />
              Therapist voice notes
            </label>
          </div>

          {mode === "patient" ? (
            <div className="rounded-xl border border-white/10 bg-[#0B1220]/80 p-3 text-sm text-white/75">
              <span className="text-white/45">Current prompt: </span>
              {getPatientPrompt(patientStep)}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-white/60">
              Speech language{" "}
              <select
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value as "en-US" | "ar-SA")}
                disabled={listening}
                className="ml-2 rounded-lg border border-white/15 bg-[#0B1220] px-2 py-1 text-white"
              >
                <option value="en-US">English (US)</option>
                <option value="ar-SA">العربية (Arabic)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {!listening ? (
              <button
                type="button"
                onClick={beginCapture}
                disabled={!captureSupported}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
              >
                Record voice
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStopCapture()}
                className="rounded-xl border border-rose-400/30 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-100"
              >
                Stop recording
              </button>
            )}
            {listening ? (
              <span className="flex items-center gap-2 text-xs text-cyan-200">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                Recording…
              </span>
            ) : null}
          </div>

          {processing ? <p className="text-xs text-white/55">Generating clinical translation…</p> : null}
          {translating ? <p className="text-xs text-white/55">Translating…</p> : null}
          {err ? <p className="text-xs text-rose-300/90">{err}</p> : null}

          <div className="rounded-xl border border-white/10 bg-[#0B1220]/90 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">Live clinical preview</p>
            <p className="mt-2 max-h-32 overflow-y-auto text-[11px] leading-relaxed text-white/70">
              {listening || liveText
                ? liveClinicalPreview || "Processing speech…"
                : "Start recording to preview clinical phrasing."}
            </p>
            {assemblyAiConfigured && listening && !liveText ? (
              <p className="mt-2 text-[10px] text-white/45">
                Live preview uses browser speech when available; final transcript uses cloud when configured.
              </p>
            ) : null}
            {liveText ? (
              <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-white/45">
                Interim STT: {liveText.slice(0, 220)}
                {liveText.length > 220 ? "…" : ""}
              </p>
            ) : null}
          </div>

          {sessionLog.length > 0 ? (
            <details className="rounded-xl border border-white/10 bg-[#0B1220]/60 p-3 text-xs text-white/55">
              <summary className="cursor-pointer text-white/70">Patient intake log ({sessionLog.length} lines)</summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{sessionLog.join("\n")}</pre>
            </details>
          ) : null}

          {effectivePayload ? (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#0B1220]/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Last capture</p>

              <details className="rounded-lg border border-white/10 bg-[#0B1220]/90 text-xs">
                <summary className="cursor-pointer px-3 py-2 font-medium text-cyan-200/90">
                  Original transcript — not for final report
                </summary>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-white/5 px-3 py-2 text-white/65">
                  {effectivePayload.originalTranscriptRaw}
                </pre>
              </details>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
                    Clinical translation
                  </p>
                  <span className="text-[10px] text-white/40">
                    {paragraphView === "ar" ? "العربية" : "English"}
                    {wasTranslated ? " · Assisted from Arabic" : ""}
                  </span>
                </div>
                <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm leading-relaxed text-emerald-50/95">
                  {displayedParagraph || "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRefineClinical}
                    disabled={!clinicalParagraph.trim()}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    Refine clinical translation
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTranslateToArabic()}
                    disabled={!clinicalParagraph.trim() || translating}
                    className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 disabled:opacity-40"
                  >
                    Translate to Arabic
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTranslateToEnglish()}
                    disabled={translating}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    Translate to English
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Structured fields (SOAP-ready)
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <ClinicalField label="Pain location" f={effectivePayload.clinicalFields.painLocation} />
                  <ClinicalField label="Severity (NPRS)" f={effectivePayload.clinicalFields.nprs} />
                  <ClinicalField label="Aggravating factors" f={effectivePayload.clinicalFields.aggravating} />
                  <ClinicalField label="Relieving factors" f={effectivePayload.clinicalFields.easing} />
                  <ClinicalField
                    label="Functional limitation"
                    f={effectivePayload.clinicalFields.functionalLimitation}
                  />
                  <ClinicalField label="Chief complaint" f={effectivePayload.clinicalFields.chiefComplaint} />
                  <ClinicalField label="Red flags" f={effectivePayload.clinicalFields.redFlags} />
                  <ClinicalField label="Goals" f={effectivePayload.clinicalFields.goals} />
                </div>
              </div>

              <details className="text-[10px] text-white/45">
                <summary className="cursor-pointer text-white/55">Biomechanical interpretation support (draft)</summary>
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-white/55">{supportingDraft}</pre>
              </details>

              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => onInsertIntoForm(effectivePayload)}
                  className="rounded-xl border border-cyan-400/35 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100"
                >
                  Apply structured fields to subjective
                </button>
                <button
                  type="button"
                  onClick={() => onInsertIntoSoap(effectivePayload)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
                >
                  {insertSoapButtonLabel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClinicalField({
  label,
  f,
}: {
  label: string;
  f: { value: string; confirmation: "Confirmed" | "Needs confirmation" };
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0B1220]/90 p-2">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium text-white/50">{label}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            f.confirmation === "Confirmed"
              ? "bg-emerald-400/20 text-emerald-200"
              : "bg-amber-400/15 text-amber-200/90"
          }`}
        >
          {f.confirmation}
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-white/85">{f.value.trim() || "—"}</p>
    </div>
  );
}
