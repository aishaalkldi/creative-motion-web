"use client";

import { usePatientLanguage } from "@/app/components/patient/PatientLanguageProvider";
import { patientSafetyNoticeUi } from "@/app/lib/patient-portal-ui";

export function PatientSafetyNotice() {
  const { language, textDir, arClass } = usePatientLanguage();
  const ui = patientSafetyNoticeUi(language);

  return (
    <aside
      className={`mt-8 rounded-[10px] border border-[#E2E8E5] bg-white px-4 py-3.5 ${arClass}`}
      dir={textDir}
      aria-label="Safety notice"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
        {ui.title}
      </p>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#6B7280]">
        <li>{ui.line1}</li>
        <li>{ui.line2}</li>
        <li>{ui.line3}</li>
      </ul>
    </aside>
  );
}
