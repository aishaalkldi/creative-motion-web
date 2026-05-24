"use client";

import { useParams } from "next/navigation";
import { PatientLanguageProvider, usePatientLanguage } from "@/app/components/patient/PatientLanguageProvider";
import { PatientLanguageToggle } from "@/app/components/patient/PatientLanguageToggle";
import { PatientSafetyNotice } from "@/app/components/patient/PatientSafetyNotice";
import { TrustFooter } from "@/app/components/trust/TrustFooter";
import { tokenLayoutUi, trustFooterUi } from "@/app/lib/patient-portal-ui";

export default function PatientTokenLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const token = String(params.token ?? "");

  return (
    <PatientLanguageProvider token={token}>
      <PatientTokenLayoutShell>{children}</PatientTokenLayoutShell>
    </PatientLanguageProvider>
  );
}

function PatientTokenLayoutShell({ children }: { children: React.ReactNode }) {
  const { language, assignedBy, textDir, arClass } = usePatientLanguage();
  const layoutUi = tokenLayoutUi(language);

  return (
    <div
      className={`min-h-screen bg-[#F4F6F5] ${arClass}`}
      dir={textDir}
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}
    >
      <nav className="sticky top-0 z-10 flex h-[52px] items-center justify-between border-b border-[#E2E8E5] bg-white px-5">
        <span
          className="text-[14px] font-bold text-[#0A0F1A]"
          style={{
            fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)",
            letterSpacing: "2px",
          }}
        >
          RASQ
        </span>
        <div className="flex items-center gap-3">
          <PatientLanguageToggle />
          {assignedBy && (
            <span className="text-[11px] text-[#9CA3AF]" dir="ltr">
              {layoutUi.assignedBy(assignedBy)}
            </span>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-[680px] px-6 py-8 md:px-8">
        {children}
        <PatientSafetyNotice />
      </main>

      <TrustFooter
        variant="light"
        labels={trustFooterUi(language)}
        className="mx-auto max-w-[680px] px-6 pb-8 md:px-8"
      />
    </div>
  );
}
