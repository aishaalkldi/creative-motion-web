"use client";

import type { ReactNode } from "react";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { planHomeUi } from "@/app/lib/patient-portal-ui";

export function PatientWorkspacePlanGate({ children }: { children: ReactNode }) {
  const { plan, planLoadError, isPlanLoading } = usePatientPlan();
  const { language, arClass } = usePatientLanguage();
  const ui = planHomeUi(language);

  if (isPlanLoading || plan === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className={`text-[13px] text-[#9CA3AF] ${arClass}`}>{ui.loading}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className={`text-[13px] text-rose-400 ${arClass}`}>
          {planLoadError === "connection" ? ui.connectionError : ui.loadError}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
