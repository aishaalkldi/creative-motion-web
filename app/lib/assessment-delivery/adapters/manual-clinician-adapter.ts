import type { MotionInputAdapterDescriptor } from "../types";

/** Metadata-only map to clinician-entered in-clinic assessment documentation flows. */
export const MANUAL_CLINICIAN_ADAPTER: MotionInputAdapterDescriptor = {
  id: "manual_clinician",
  label: "Manual Clinician Entry",
  description:
    "Clinician-documented subjective, objective, and workflow assessments without automated motion capture.",
  supportedModes: ["in_clinic"],
  assessmentKinds: ["general_msk", "structured"],
  existingFlowRefs: [
    {
      label: "General MSK assessment page",
      modulePath: "app/clinician/assessment/GeneralAssessmentPageClient.tsx",
      routeOrApi: "/clinician/assessment",
    },
    {
      label: "Clinician assessment workflow",
      modulePath: "app/clinician/assessment/workflow/WorkflowPageClient.tsx",
      routeOrApi: "/clinician/assessment/workflow",
    },
    {
      label: "In-clinic session setup",
      modulePath: "app/clinician/assessment/in-clinic/page.tsx",
      routeOrApi: "/clinician/assessment/in-clinic",
    },
    {
      label: "Assessments API",
      modulePath: "app/api/assessments/route.ts",
      routeOrApi: "/api/assessments",
    },
    {
      label: "General MSK payload helpers",
      modulePath: "app/lib/assessment-payload.ts",
    },
  ],
  metadata: {
    inputTechnology: "clinician_manual_entry",
    deferredInputTechnologies: ["depth_camera_sdk", "iot", "digital_twin", "xr"],
  },
};
