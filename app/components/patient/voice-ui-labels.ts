import type { PatientLang } from "@/app/components/patient/LanguageToggle";

export const VOICE_SUBMIT_BLOCK_MESSAGE =
  "Voice transcription failed. Please type your answer manually before submitting.";

export const VOICE_UI_LABELS = {
  listen: { en: "Listen", ar: "استمع" },
  recordAnswer: { en: "Record answer", ar: "سجّل الإجابة" },
  listening: { en: "Recording…", ar: "جارٍ التسجيل…" },
  processing: { en: "Converting speech to text…", ar: "جارٍ تحويل الكلام إلى نص…" },
  stopRecording: { en: "Stop recording", ar: "إيقاف التسجيل" },
  speakNow: {
    en: "Speak now. Your answer will appear as editable text below.",
    ar: "تحدّث الآن. ستظهر إجابتك كنص قابل للتحرير أدناه.",
  },
  privacyNote: {
    en: "Speech input helps convert your spoken answer into editable text. Please review and edit before submitting. Audio is sent only for transcription and is not stored by RASQ.",
    ar: "يساعد الإدخال الصوتي على تحويل إجابتك المنطوقة إلى نص قابل للتحرير. يرجى المراجعة والتعديل قبل الإرسال. يُرسل الصوت للنسخ فقط ولا يخزّنه RASQ.",
  },
  reviewBeforeSubmit: {
    en: "Please review and edit before submitting.",
    ar: "يرجى المراجعة والتعديل قبل الإرسال.",
  },
  manualFallback: {
    en: "Speech transcription is unavailable. Please type your answer manually.",
    ar: "النسخ الصوتي غير متاح. يرجى كتابة إجابتك يدويًا.",
  },
  browserFallbackListening: {
    en: "Server unavailable — speak your answer now (browser recognition)",
    ar: "الخادم غير متاح — تحدّث بإجابتك الآن (التعرّف عبر المتصفح)",
  },
  browserFallbackHint: {
    en: "Listening with your browser. Tap stop when finished, or type manually below.",
    ar: "الاستماع عبر المتصفح. اضغط إيقاف عند الانتهاء، أو اكتب يدويًا أدناه.",
  },
  transcribedSuccess: {
    en: "Voice answer added — please review and edit before submitting.",
    ar: "تمت إضافة الإجابة الصوتية — يرجى المراجعة والتعديل قبل الإرسال.",
  },
  transcribed: {
    en: "Voice answer transcribed. Please review before submitting.",
    ar: "تم تحويل الإجابة الصوتية إلى نص. يرجى المراجعة قبل الإرسال.",
  },
  unsupported: {
    en: "Voice recording is not supported in this browser. Please type your answer.",
    ar: "تسجيل الصوت غير مدعوم في هذا المتصفح. يرجى كتابة إجابتك.",
  },
  permissionDenied: {
    en: "Microphone access was denied. Please allow microphone access or type your answer manually.",
    ar: "تم رفض الوصول إلى الميكروفون. يرجى السماح بالوصول أو كتابة إجابتك يدويًا.",
  },
  noSpeech: {
    en: "No speech detected. Please try again or type your answer manually.",
    ar: "لم يُكتشَف كلام. يرجى المحاولة مرة أخرى أو كتابة إجابتك يدويًا.",
  },
} as const;

export function voiceLabel(key: keyof typeof VOICE_UI_LABELS, lang: PatientLang): string {
  return lang === "ar" ? VOICE_UI_LABELS[key].ar : VOICE_UI_LABELS[key].en;
}
