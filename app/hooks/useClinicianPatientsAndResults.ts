"use client";

import { useEffect, useState } from "react";
import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import {
  collectDemoMeta,
  fetchClinicianResults,
  fetchPatientsList,
} from "@/app/lib/api/demo-fallback-client";
import type { PatientRow } from "@/app/lib/validate-patient-ownership";

type UseClinicianPatientsAndResultsOptions = {
  /** Throw when /api/patients fails (non-demo). Default: false. */
  strictPatients?: boolean;
};

export function useClinicianPatientsAndResults(
  options: UseClinicianPatientsAndResultsOptions = {},
) {
  const { strictPatients = false } = options;
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [results, setResults] = useState<ClinicianResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      fetchPatientsList({ strict: strictPatients }),
      fetchClinicianResults().catch(() => null),
    ])
      .then(([patientsPayload, resultsData]) => {
        if (!isMounted) return;
        setPatients(patientsPayload.patients);
        setResults(resultsData);
        const meta = collectDemoMeta(patientsPayload, resultsData);
        setDemoMode(meta.demoMode);
        setDemoNotice(meta.demoNotice);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Could not load clinician data.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [strictPatients]);

  return {
    patients,
    setPatients,
    results,
    loading,
    error,
    demoMode,
    demoNotice,
  };
}
