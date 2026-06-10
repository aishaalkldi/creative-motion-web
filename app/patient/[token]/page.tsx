"use client";

import { useParams } from "next/navigation";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { PatientWorkspaceHome } from "@/app/components/patient/workspace/PatientWorkspaceHome";
import { PatientWorkspacePlanGate } from "@/app/components/patient/workspace/PatientWorkspacePlanGate";
import { usePatientLogs } from "@/app/hooks/usePatientLogs";
import { usePatientMovementCheck } from "@/app/hooks/usePatientMovementCheck";

export default function PatientWorkspaceHomePage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const { plan } = usePatientPlan();
  const { language, arClass, textDir } = usePatientLanguage();
  const { logs } = usePatientLogs(token);
  const movementCheck = usePatientMovementCheck(token);

  return (
    <PatientWorkspacePlanGate>
      {plan ? (
        <PatientWorkspaceHome
          plan={plan}
          logs={logs}
          token={token}
          lang={language}
          arClass={arClass}
          textDir={textDir}
          movementCheck={movementCheck}
        />
      ) : null}
    </PatientWorkspacePlanGate>
  );
}
