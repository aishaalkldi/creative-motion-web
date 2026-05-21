import { Suspense } from "react";
import { AssessmentReportClient } from "./AssessmentReportClient";

export default function AssessmentReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#071a2f] px-6 py-16 text-white">
          <p className="text-center text-sm text-white/50">Loading assessment report…</p>
        </main>
      }
    >
      <AssessmentReportClient />
    </Suspense>
  );
}
