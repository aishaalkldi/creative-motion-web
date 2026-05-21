import { Suspense } from "react";
import { GeneralAssessmentPageClient } from "./GeneralAssessmentPageClient";

export default function ClinicianGeneralAssessmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0B1220] px-6 py-16 text-white">
          <p className="text-center text-sm text-white/60">Loading assessment…</p>
        </main>
      }
    >
      <GeneralAssessmentPageClient />
    </Suspense>
  );
}
