import type { MotionInputAdapterDescriptor } from "../types";

/** Metadata-only map to existing web camera + MediaPipe pose capture flows. */
export const WEB_CAMERA_POSE_ADAPTER: MotionInputAdapterDescriptor = {
  id: "web_camera_pose",
  label: "Web Camera Pose",
  description:
    "Browser-based MediaPipe pose capture for clinician assessment center and optional patient portal sessions.",
  supportedModes: ["in_clinic", "remote"],
  assessmentKinds: ["structured", "cv_motion_capture"],
  existingFlowRefs: [
    {
      label: "Clinician CV capture session",
      modulePath: "app/components/clinician/assessments/AssessmentCvCaptureSession.tsx",
      routeOrApi: "/clinician/assessments/*",
    },
    {
      label: "Patient CV capture",
      modulePath: "app/components/patient/cv/PatientCvCapture.tsx",
      routeOrApi: "/patient/[token]/session/*",
    },
    {
      label: "Clinician CV metrics API",
      modulePath: "app/api/cv/session-metrics/route.ts",
      routeOrApi: "/api/cv/session-metrics",
    },
    {
      label: "Patient CV metrics API",
      modulePath: "app/api/patient/cv-session-metrics/route.ts",
      routeOrApi: "/api/patient/cv-session-metrics",
    },
  ],
  metadata: {
    inputTechnology: "mediapipe_web_camera",
    supportedExerciseIds: [
      "sit-to-stand",
      "mini-squat",
      "single-leg-stance",
      "heel-raise",
      "step-up",
      "lateral-step",
      "functional-reach",
    ],
    deferredInputTechnologies: ["depth_camera_sdk", "iot", "digital_twin", "xr"],
  },
};
