"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import type { PatientPlanData } from "@/app/api/patient/plan/route";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import { portalTextDir, tokenLayoutUi } from "@/app/lib/patient-portal-ui";

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function PatientTokenLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const token = String(params.token ?? "");

  const [assignedBy, setAssignedBy] = useState("");
  const [patientLanguage, setPatientLanguage] = useState<PatientExerciseLanguage>("en");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/patient/plan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as PatientPlanData;
        if (data.assignedBy) setAssignedBy(data.assignedBy);
        setPatientLanguage(data.patientLanguage === "ar" ? "ar" : "en");
      })
      .catch(() => {
        /* assignedBy is cosmetic */
      });
  }, [token]);

  const isArabic = patientLanguage === "ar";
  const layoutUi = tokenLayoutUi(patientLanguage);
  const textDir = portalTextDir(patientLanguage);
  const arClass = isArabic ? arabicFont.className : "";

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
        {assignedBy && (
          <span className="text-[11px] text-[#9CA3AF]" dir="ltr">
            {layoutUi.assignedBy(assignedBy)}
          </span>
        )}
      </nav>

      <main className="mx-auto max-w-[680px] px-6 py-8 md:px-8">{children}</main>
    </div>
  );
}
