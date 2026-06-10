"use client";

import { useEffect, useState } from "react";
import type { SessionLogEntry } from "@/app/api/patient/logs/route";

export function usePatientLogs(token: string) {
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/patient/logs?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) setLogs((await res.json()) as SessionLogEntry[]);
      })
      .catch(() => {
        /* logs are optional */
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  return { logs, isLoading };
}
