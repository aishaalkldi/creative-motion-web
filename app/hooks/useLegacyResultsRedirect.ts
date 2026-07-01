"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseNumericDemoPatientId } from "@/app/lib/api/patient-id-utils";
import { resolveLegacyResultsRedirect } from "@/app/lib/legacy-routes";

/**
 * Redirects legacy `/results` to clinician surfaces when appropriate.
 * Numeric demo patient ids remain on the legacy page.
 */
export function useLegacyResultsRedirect(): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const redirectTo = resolveLegacyResultsRedirect(searchParams);
    if (redirectTo) {
      setAllowed(false);
      router.replace(redirectTo);
      return;
    }

    const patientId = searchParams.get("patientId")?.trim();
    const numeric = patientId ? parseNumericDemoPatientId(patientId) : null;
    setAllowed(numeric !== null);
  }, [router, searchParams]);

  return allowed;
}
