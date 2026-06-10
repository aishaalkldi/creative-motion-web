"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import { usePatientLanguage, usePatientPlan } from "@/app/components/patient/PatientLanguageProvider";
import { PatientProgressPortal } from "@/app/components/patient/progress/PatientProgressPortal";
import { progressPageUi } from "@/app/lib/patient-portal-ui";

export default function PatientProgressPage() {
  const params = useParams();
  const token = String(params.token ?? "");

  const { plan, planLoadError, isPlanLoading } = usePatientPlan();
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) setLogs((await res.json()) as SessionLogEntry[]);
      })
      .catch(() => {
        /* logs are optional */
      });
  }, [token]);

  const { language: lang, arClass, textDir } = usePatientLanguage();
  const ui = progressPageUi(lang);

  if (isPlanLoading || plan === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className={`text-[13px] text-[#9CA3AF] ${arClass}`}>{ui.loading}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className={`text-[13px] text-rose-400 ${arClass}`}>
          {planLoadError === "connection" ? ui.connectionError : ui.loadError}
        </p>
      </div>
    );
  }

  return (
    <PatientProgressPortal
      plan={plan}
      logs={logs}
      token={token}
      lang={lang}
      arClass={arClass}
      textDir={textDir}
    />
  );
}
