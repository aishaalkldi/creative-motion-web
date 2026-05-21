"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect from old /live-results route to unified results dashboard
 */
export default function LiveResultsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clinician/results");
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-slate-300">Redirecting to unified results dashboard...</p>
      </div>
    </main>
  );
}