"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";
import { PATIENT_PORTAL_REFRESH_EVENT } from "@/app/lib/patient-portal-refresh";

export function usePatientLogs(token: string) {
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const fetchLogs = useCallback(async () => {
    if (!token) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        setLogs((await res.json()) as SessionLogEntry[]);
      }
    } catch {
      /* logs are optional */
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchLogs();
    };
    window.addEventListener(PATIENT_PORTAL_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PATIENT_PORTAL_REFRESH_EVENT, onRefresh);
  }, [fetchLogs]);

  return { logs, isLoading };
}
