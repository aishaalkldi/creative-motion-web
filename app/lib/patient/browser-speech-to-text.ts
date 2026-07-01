/**
 * Browser Web Speech API fallback for patient assessment answers.
 * Used when server transcription is unavailable — on-device only, not persisted as audio.
 */

export type BrowserSpeechLang = "ar" | "en";

export type BrowserSpeechError =
  | "not_supported"
  | "permission_denied"
  | "no_speech"
  | "failed";

export type BrowserSpeechResult =
  | { ok: true; text: string }
  | { ok: false; error: BrowserSpeechError };

export function mapPatientLangToSpeechRecognitionLang(lang: BrowserSpeechLang): string {
  return lang === "ar" ? "ar-SA" : "en-US";
}

export function detectBrowserSpeechRecognitionSupport(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & typeof globalThis & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { length: number; [index: number]: { 0: { transcript?: string } } } }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

/**
 * One-shot browser speech capture. Resolves when the user stops speaking or timeout elapses.
 */
export function transcribeWithBrowserSpeech(
  lang: BrowserSpeechLang,
  timeoutMs = 20_000,
): Promise<BrowserSpeechResult> {
  if (!detectBrowserSpeechRecognitionSupport()) {
    return Promise.resolve({ ok: false, error: "not_supported" });
  }

  const w = window as Window & typeof globalThis & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  const SpeechRecognitionClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    return Promise.resolve({ ok: false, error: "not_supported" });
  }

  return new Promise((resolve) => {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = mapPatientLangToSpeechRecognitionLang(lang);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    const finish = (result: BrowserSpeechResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timerId = window.setTimeout(() => {
      finish({ ok: false, error: "no_speech" });
    }, timeoutMs);

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim() ?? "";
      if (text) {
        finish({ ok: true, text });
      } else {
        finish({ ok: false, error: "no_speech" });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        finish({ ok: false, error: "permission_denied" });
        return;
      }
      if (event.error === "no-speech") {
        finish({ ok: false, error: "no_speech" });
        return;
      }
      finish({ ok: false, error: "failed" });
    };

    recognition.onend = () => {
      if (!settled) {
        finish({ ok: false, error: "no_speech" });
      }
    };

    try {
      recognition.start();
    } catch {
      finish({ ok: false, error: "failed" });
    }
  });
}
