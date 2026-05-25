"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ClinicianProgressRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = String(params.id || "");

  useEffect(() => {
    router.replace(patientId ? `/clinician/patients/${patientId}` : "/clinician/results");
  }, [router, patientId]);

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-16 text-white">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-white/50">Opening patient progress…</p>
        <Link
          href={patientId ? `/clinician/patients/${patientId}` : "/clinician/results"}
          className="mt-4 inline-block text-sm font-semibold text-[#5DCAA5] hover:text-[#1D9E75]"
        >
          Continue →
        </Link>
      </div>
    </main>
  );
}
