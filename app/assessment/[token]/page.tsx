import { Suspense } from "react";
import { PatientAssessmentClient } from "./PatientAssessmentClient";

export default function AssessmentTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#071a2f]">
          <p className="text-sm text-white/50">Loading assessment…</p>
        </div>
      }
    >
      <PatientAssessmentClient />
    </Suspense>
  );
}
