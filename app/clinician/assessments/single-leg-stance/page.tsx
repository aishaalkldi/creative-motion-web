"use client";

import { AssessmentModuleShell } from "@/app/components/clinician/assessments/AssessmentModuleShell";
import { SINGLE_LEG_STANCE_SHELL } from "@/app/lib/clinician/assessment-module-shells";

export default function SingleLegStanceAssessmentPage() {
  return <AssessmentModuleShell config={SINGLE_LEG_STANCE_SHELL} />;
}
