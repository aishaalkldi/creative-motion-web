"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * This page previously generated a local, non-shareable assessment link.
 * Remote assessment creation now lives in the patient profile's
 * "Send Remote Assessment" flow (the real token-based system). Redirect
 * any existing bookmarks/links there instead of 404ing.
 */
function RemoteRequestRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") || "";

  useEffect(() => {
    router.replace(
      patientId
        ? `/clinician/patients/${patientId}?openRemoteAssessment=1`
        : "/clinician/patients"
    );
  }, [router, patientId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071a2f] px-6 text-white">
      <p className="text-sm text-white/50">Redirecting to the current remote assessment flow…</p>
    </main>
  );
}

export default function RemoteRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#071a2f] text-white">
          <p className="text-sm text-white/50">Loading…</p>
        </div>
      }
    >
      <RemoteRequestRedirectContent />
    </Suspense>
  );
}
