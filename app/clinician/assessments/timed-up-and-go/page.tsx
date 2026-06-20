"use client";

import { AssessmentModuleShell } from "@/app/components/clinician/assessments/AssessmentModuleShell";
import { TIMED_UP_AND_GO_SHELL } from "@/app/lib/clinician/assessment-module-shells";

export default function TimedUpAndGoAssessmentPage() {
  return <AssessmentModuleShell config={TIMED_UP_AND_GO_SHELL} />;
}
