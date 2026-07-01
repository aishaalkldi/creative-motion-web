"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isLegacyRouteParam,
  LEGACY_ROUTE_PARAM,
} from "@/app/lib/legacy-routes";

/**
 * Redirects deprecated routes to a modern target unless ?legacy=1 is present.
 */
export function useLegacyRouteRedirect(targetHref: string): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const ok = isLegacyRouteParam(searchParams.get(LEGACY_ROUTE_PARAM));
    setAllowed(ok);
    if (!ok) {
      router.replace(targetHref);
    }
  }, [router, searchParams, targetHref]);

  return allowed;
}
