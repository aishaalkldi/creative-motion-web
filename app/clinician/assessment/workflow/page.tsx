import { Suspense } from "react";
import { WorkflowPageClient } from "./WorkflowPageClient";

export default function ClinicalAssessmentWorkflowPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0B1220] px-6 py-16 text-white">
          <p className="text-center text-sm text-white/60">Loading clinical workflow…</p>
        </main>
      }
    >
      <WorkflowPageClient />
    </Suspense>
  );
}
