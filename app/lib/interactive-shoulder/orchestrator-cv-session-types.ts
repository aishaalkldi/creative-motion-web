import type { CaptureSetupGuidance } from "@/app/lib/cv/patient-cv-capture-readiness";
import { createPatientCvCameraConsentRecord } from "@/app/lib/cv/patient-cv-consent";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";
import type { SessionDefinition } from "@/app/lib/session-orchestrator/types";

export type InteractiveShoulderSessionProps = {
  language: PatientExerciseLanguage;
  arClass?: string;
  textDir?: "rtl" | "ltr";
  /**
   * Therapist-authored treatment side from the authenticated patient-plan contract.
   * Patient portal call sites must pass `session.prescribedSide` only — never URL or form input.
   */
  prescribedSide?: string | null;
  /**
   * When true, runtime requires a valid server-authored prescribed side and blocks
   * before camera start. Volunteer/research and clinician lab flows omit this flag.
   */
  clinicalPrescribedSideRequired?: boolean;
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
  /** Fires once when the orchestrator reaches full-session completion. */
  onSessionComplete?: () => void;
};

export type OrchestratorCvSessionCoreProps = InteractiveShoulderSessionProps & {
  sessionDefinition: SessionDefinition;
};
