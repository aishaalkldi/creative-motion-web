"use client";

import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { PatientWorkspacePlanGate } from "@/app/components/patient/workspace/PatientWorkspacePlanGate";
import { PatientWorkspaceProfile } from "@/app/components/patient/workspace/PatientWorkspaceProfile";

export default function PatientWorkspaceProfilePage() {
  const { plan } = usePatientPlan();
  const { language, arClass, textDir } = usePatientLanguage();

  return (
    <PatientWorkspacePlanGate>
      {plan ? (
        <PatientWorkspaceProfile
          plan={plan}
          lang={language}
          arClass={arClass}
          textDir={textDir}
        />
      ) : null}
    </PatientWorkspacePlanGate>
  );
}
