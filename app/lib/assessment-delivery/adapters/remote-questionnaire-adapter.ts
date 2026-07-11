import type { MotionInputAdapterDescriptor } from "../types";

/** Metadata-only map to the existing remote questionnaire assessment flow. */
export const REMOTE_QUESTIONNAIRE_ADAPTER: MotionInputAdapterDescriptor = {
  id: "remote_questionnaire",
  label: "Remote Questionnaire",
  description:
    "Tokenized patient questionnaire intake with optional voice transcription for remote assessments.",
  supportedModes: ["remote"],
  assessmentKinds: ["remote_questionnaire"],
  existingFlowRefs: [
    {
      label: "Patient remote assessment client",
      modulePath: "app/assessment/[token]/PatientAssessmentClient.tsx",
      routeOrApi: "/assessment/[token]",
    },
    {
      label: "Remote assessment API",
      modulePath: "app/api/remote-assessments/[token]/route.ts",
      routeOrApi: "/api/remote-assessments/[token]",
    },
    {
      label: "Remote assessment submit API",
      modulePath: "app/api/remote-assessments/[token]/submit/route.ts",
      routeOrApi: "/api/remote-assessments/[token]/submit",
    },
    {
      label: "Remote questionnaire summary",
      modulePath: "app/lib/remote-questionnaire-summary.ts",
    },
    {
      label: "Remote assessment client service",
      modulePath: "app/lib/api/remote-assessments.ts",
    },
  ],
  metadata: {
    inputTechnology: "patient_questionnaire",
    supportsVoiceTranscription: true,
    deferredInputTechnologies: ["depth_camera_sdk", "iot", "digital_twin", "xr"],
  },
};
