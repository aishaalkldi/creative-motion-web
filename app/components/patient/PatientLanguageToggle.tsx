"use client";

import { usePatientLanguage } from "@/app/components/patient/PatientLanguageProvider";

export function PatientLanguageToggle() {
  const { language, setLanguage } = usePatientLanguage();

  return (
    <div
      className="inline-flex rounded-[6px] border border-[#E2E8E5] bg-[#F4F6F5] p-0.5"
      role="group"
      aria-label="Portal language"
      dir="ltr"
    >
      <button
        type="button"
        aria-pressed={language === "ar"}
        onClick={() => setLanguage("ar")}
        className={`rounded-[5px] px-2 py-1 text-[11px] font-semibold transition ${
          language === "ar"
            ? "bg-white text-[#0A0F1A] shadow-sm"
            : "text-[#6B7280] hover:text-[#374151]"
        }`}
      >
        العربية
      </button>
      <button
        type="button"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
        className={`rounded-[5px] px-2 py-1 text-[11px] font-semibold transition ${
          language === "en"
            ? "bg-white text-[#0A0F1A] shadow-sm"
            : "text-[#6B7280] hover:text-[#374151]"
        }`}
      >
        English
      </button>
    </div>
  );
}
