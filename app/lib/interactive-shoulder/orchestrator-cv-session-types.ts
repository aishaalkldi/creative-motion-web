import type { CaptureSetupGuidance } from "@/app/lib/cv/patient-cv-capture-readiness";
import { createPatientCvCameraConsentRecord } from "@/app/lib/cv/patient-cv-consent";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";

export type InteractiveShoulderSessionProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
  /** Future-safe: pass when an existing session/prescription side field is available. */
  prescribedSide?: string | null;
  onSkipped?: () => void;
  onRegisterMetricsFlush?: (flush: () => void) => void;
  onRegisterCaptureConsent?: (
    getter: () => ReturnType<typeof createPatientCvCameraConsentRecord> | null,
  ) => void;
  onCaptureReadinessChange?: (payload: {
    primaryGuidance: CaptureSetupGuidance;
    canStartTracking: boolean;
    minimumMet: boolean;
    previewActive: boolean;
  }) => void;
};

export type OrchestratorCvSessionCoreProps = InteractiveShoulderSessionProps & {
  sessionDefinition: SessionDefinition;
};
