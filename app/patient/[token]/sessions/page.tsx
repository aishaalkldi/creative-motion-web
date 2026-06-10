"use client";

import { useParams } from "next/navigation";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { PatientWorkspacePlanGate } from "@/app/components/patient/workspace/PatientWorkspacePlanGate";
import { PatientWorkspaceSessions } from "@/app/components/patient/workspace/PatientWorkspaceSessions";
import { usePatientLogs } from "@/app/hooks/usePatientLogs";

export default function PatientWorkspaceSessionsPage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const { plan } = usePatientPlan();
  const { language, arClass, textDir } = usePatientLanguage();
  const { logs } = usePatientLogs(token);

  return (
    <PatientWorkspacePlanGate>
      {plan ? (
        <PatientWorkspaceSessions
          plan={plan}
          logs={logs}
          token={token}
          lang={language}
          arClass={arClass}
          textDir={textDir}
        />
      ) : null}
    </PatientWorkspacePlanGate>
  );
}
