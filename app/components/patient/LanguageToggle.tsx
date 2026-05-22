"use client";

export type PatientLang = "en" | "ar";

type Props = {
  current: PatientLang;
  onChange: (lang: PatientLang) => void;
};

export function LanguageToggle({ current, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-[8px] border border-[#1E2D42] bg-[#0F1825] p-0.5"
      role="group"
      aria-label="Assessment language"
    >
      <button
        type="button"
        aria-pressed={current === "en"}
        onClick={() => onChange("en")}
        className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
          current === "en"
            ? "bg-[#1D9E75] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={current === "ar"}
        onClick={() => onChange("ar")}
        className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
          current === "ar"
            ? "bg-[#1D9E75] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        عربي
      </button>
    </div>
  );
}
