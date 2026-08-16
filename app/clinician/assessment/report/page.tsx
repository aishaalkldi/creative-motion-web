import { Suspense } from "react";
import { AssessmentReportClient } from "./AssessmentReportClient";

export default function AssessmentReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
          <p className="text-center text-sm text-[var(--muted)]">Loading assessment report…</p>
        </main>
      }
    >
      <AssessmentReportClient />
    </Suspense>
  );
}
