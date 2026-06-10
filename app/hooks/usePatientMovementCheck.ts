"use client";

import { useEffect, useState } from "react";
import type { PatientMovementCheckResponse } from "@/app/api/patient/movement-check/route";
import {
  buildPatientMovementCheckView,
  type PatientMovementCheckView,
} from "@/app/lib/patient-movement-check";

export function usePatientMovementCheck(token: string) {
  const [view, setView] = useState<PatientMovementCheckView | null>(null);

  useEffect(() => {
    if (!token) {
      setView(null);
      return;
    }

    fetch(`/api/patient/movement-check?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as PatientMovementCheckResponse;
        setView(buildPatientMovementCheckView(data.metrics));
      })
      .catch(() => {
        /* movement check is optional */
      });
  }, [token]);

  return view;
}
