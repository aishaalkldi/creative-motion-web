"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isLegacyDemoAllowed,
  LEGACY_ROUTE_TARGETS,
} from "@/app/lib/legacy-routes";

/**
 * Redirects legacy `/patient/*` demo pages to /patient/invalid unless ?demo=1
 * (or session flag from a prior demo entry).
 */
export function useLegacyDemoRedirect(): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const ok = isLegacyDemoAllowed(searchParams);
    setAllowed(ok);
    if (!ok) {
      router.replace(LEGACY_ROUTE_TARGETS.patientInvalid);
    }
  }, [router, searchParams]);

  return allowed;
}
