"use client";

import { AssessmentModuleShell } from "@/app/components/clinician/assessments/AssessmentModuleShell";
import { FUNCTIONAL_REACH_SHELL } from "@/app/lib/clinician/assessment-module-shells";

export default function FunctionalReachAssessmentPage() {
  return <AssessmentModuleShell config={FUNCTIONAL_REACH_SHELL} />;
}
