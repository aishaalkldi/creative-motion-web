import type { PatientLang } from "@/app/components/patient/LanguageToggle";

export const VOICE_UI_LABELS = {
  listen: { en: "Listen", ar: "استمع" },
  recordAnswer: { en: "Record answer", ar: "سجّل الإجابة" },
  listening: { en: "Listening…", ar: "جارٍ الاستماع…" },
  stopRecording: { en: "Stop recording", ar: "إيقاف التسجيل" },
  speakNow: {
    en: "Speak now. Your answer will appear as text below.",
    ar: "تحدّث الآن. ستظهر إجابتك كنص أدناه.",
  },
  transcribed: {
    en: "Voice answer transcribed. Please review before submitting.",
    ar: "تم تحويل الإجابة الصوتية إلى نص. يرجى المراجعة قبل الإرسال.",
  },
  unsupported: {
    en: "Voice input is not supported in this browser.",
    ar: "الإدخال الصوتي غير مدعوم في هذا المتصفح.",
  },
} as const;

export function voiceLabel(key: keyof typeof VOICE_UI_LABELS, lang: PatientLang): string {
  return lang === "ar" ? VOICE_UI_LABELS[key].ar : VOICE_UI_LABELS[key].en;
}
