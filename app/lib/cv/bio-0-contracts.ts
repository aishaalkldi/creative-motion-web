/**
 * Sprint CV-Y1A — BIO-0 thin contracts (types, config, copy).
 * No biomechanics agent runtime. No clinical scoring. No AI.
 */

import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import { isCvMotionPilotWiredForCopy } from "@/app/lib/cv/cv-patient-motion-pilot-flags";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

/* ── Metrics payload (future patient API) ─────────────────────────────────── */

export type CvTrackingQuality = "good" | "fair" | "poor" | "unknown";

/** Allowed patient-portal CV exercise ids (allowlist). */
export type PatientCvExerciseId =
  | "sit-to-stand"
  | "mini-squat"
  | "single-leg-stance"
  | "heel-raise"
  | "step-up"
  | "lateral-step"
  | "functional-reach";

/** Client → server body for POST /api/patient/cv-session-metrics. */
export type PatientCvMetricsPayload = {
  token: string;
  sessionId: string;
  exerciseId: PatientCvExerciseId;
  repCount?: number;
  sessionDurationS?: number;
  trackingQuality?: CvTrackingQuality;
  movementDetected?: boolean;
  framesWithPose?: number;
  framesTotal?: number;
};

/** Snapshot produced on-device after a tracking session stops. */
export type SitToStandDerivedMetrics = {
  exerciseId: "sit-to-stand";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type MiniSquatDerivedMetrics = {
  exerciseId: "mini-squat";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type SingleLegStanceDerivedMetrics = {
  exerciseId: "single-leg-stance";
  repCount: 0;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type HeelRaiseDerivedMetrics = {
  exerciseId: "heel-raise";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type StepUpDerivedMetrics = {
  exerciseId: "step-up";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type LateralStepDerivedMetrics = {
  exerciseId: "lateral-step";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type FunctionalReachDerivedMetrics = {
  exerciseId: "functional-reach";
  repCount: number;
  sessionDurationS: number;
  trackingQuality: CvTrackingQuality;
  movementDetected: boolean;
  framesWithPose: number;
  framesTotal: number;
};

export type PatientCvDerivedMetrics =
  | SitToStandDerivedMetrics
  | MiniSquatDerivedMetrics
  | SingleLegStanceDerivedMetrics
  | HeelRaiseDerivedMetrics
  | StepUpDerivedMetrics
  | LateralStepDerivedMetrics
  | FunctionalReachDerivedMetrics;

/* ── Sit-to-Stand detector config ─────────────────────────────────────────── */

/** absolute = CV Lab fixed hip-Y thresholds; baseline = patient seated hip calibration */
export type SitToStandRepCountingMode = "absolute" | "baseline";

export type SitToStandCvConfig = {
  wasmUrl: string;
  modelUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initTimeoutMs: number;
  uiFrameUpdateInterval: number;
  hipUpThreshold: number;
  hipDownThreshold: number;
  visibilityGood: number;
  visibilityFair: number;
  minSaveDurationS: number;
  prototypeVersion: string;
  landmarkDotColor: string;
  lowerBodyLandmarkIndices: readonly number[];
  /** Patient portal: relative hip-Y rep counting from seated baseline */
  repCountingMode?: SitToStandRepCountingMode;
  baselineDurationMs?: number;
  /** Standing: hipY must fall at least this far below seated baseline (normalized 0–1) */
  baselineStandDelta?: number;
  /** Seated reset: hipY must rise to at least baseline minus this delta */
  baselineResetDelta?: number;
  minMsBetweenReps?: number;
  /** Used when baseline window has no pose samples */
  fallbackSeatedHipY?: number;
  /** Patient baseline: scale stand/reset deltas by shoulder–hip span (normalized frame) */
  baselineScaleByTorso?: boolean;
  /** Fraction of torso span required to count a stand (when baselineScaleByTorso) */
  baselineStandDeltaRatio?: number;
  /** Fraction of torso span to reset seated phase */
  baselineResetDeltaRatio?: number;
  /** Floors when torso span is small or shoulders are occluded */
  baselineStandDeltaMin?: number;
  baselineResetDeltaMin?: number;
  /** Patient portal: pose readiness gate before rep counting */
  readinessEnabled?: boolean;
  readinessCheckMs?: number;
  /** Minimum per-hip landmark visibility (0–1) to count reps */
  minHipVisibility?: number;
  /** MQ-REP-1 shadow: enable in-memory RepQualityFsm (default off in production). */
  repQualityEnabled?: boolean;
  /** MQ-REP-1 shadow: run FSM in parallel without affecting repCount or save payload. */
  repQualityShadowMode?: boolean;
  /** MQ-REP-1 shadow: minimum full-cycle duration before complete_rep flag. */
  minRepDurationMs?: number;
  /** MQ-REP-1 shadow: per-rep timeout before incomplete flags. */
  repTimeoutMs?: number;
  /** SMT-1: in-memory 1 Hz timeline + session summary (browser only; never POSTed). */
  motionTimelineEnabled?: boolean;
  /** Patient portal: rise = Sit-to-Stand, drop = Mini Squat (default rise). */
  repPolarity?: "rise" | "drop";
  /** Metrics payload exercise id (default sit-to-stand). */
  metricsExerciseId?: PatientCvExerciseId;
  /** Patient portal body framing profile (distance guide). */
  bodyFramingProfileId?: BodyFramingProfileId;
  /** Patient portal: draw pose dots on a transparent overlay; video element stays visible underneath. */
  landmarksOverlayOnly?: boolean;
};

/** Patient portal pose model — Full (better landmark stability than Lite). */
export const POSE_LANDMARKER_FULL_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export const DEFAULT_STS_CONFIG: SitToStandCvConfig = {
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm",
  modelUrl: POSE_LANDMARKER_FULL_MODEL_URL,
  canvasWidth: 640,
  canvasHeight: 480,
  initTimeoutMs: 45_000,
  uiFrameUpdateInterval: 15,
  hipUpThreshold: 0.42,
  hipDownThreshold: 0.58,
  visibilityGood: 1.4,
  visibilityFair: 0.8,
  minSaveDurationS: 3,
  prototypeVersion: "y1",
  landmarkDotColor: "#1D9E75",
  lowerBodyLandmarkIndices: [11, 12, 23, 24, 25, 26, 27, 28],
};

/* ── Patient-safe CV copy (EN/AR) — PatientCvCapture (sit-to-stand only) ─── */

export type PatientCvCopy = {
  consentTitle: string;
  consentDoIntro: string;
  consentDoBullets: string[];
  consentDontIntro: string;
  consentDontBullets: string[];
  consentSecureNote: string;
  consentDerivedNote: string;
  consentAccept: string;
  startTracking: string;
  stopTracking: string;
  repsCounted: (n: number) => string;
  movementDetectedYes: string;
  movementDetectedNo: string;
  trackingSignalLabel: string;
  trackingGood: string;
  trackingFair: string;
  trackingPoor: string;
  sessionDuration: (formatted: string) => string;
  savedTherapistReview: string;
  savingMetrics: string;
  saveError: string;
  loadingPoseLibrary: string;
  loadingPoseModel: string;
  startingCamera: string;
  prototypeNotice: string;
  therapistReviewOnly: string;
  optionalCameraNote: string;
  continueWithoutCamera: string;
  moveComfortably: string;
  trackingStatusReady: string;
  trackingStatusDetecting: string;
  startSeatedHint: string;
  baselineStandStillHint: string;
  framingInstruction: string;
  startWhenReadyHint: string;
  movementInstruction: string;
  checkingCameraPosition: string;
  cameraReadyLabel: string;
  almostReadyLabel: string;
  adjustPhoneBodyChairLabel: string;
  poseNotDetectedLabel: string;
  tryAgainLabel: string;
  hipLandmarksHint: string;
  framingGoodDistance: string;
  framingMoveBack: string;
  framingMoveCloser: string;
  framingAdjustAngle: string;
  framingLowVisibility: string;
  /** Hold-class exercises — stance leg picker (single-leg-stance). */
  stanceLegPickerTitle?: string;
  stanceLegLeftLabel?: string;
  stanceLegRightLabel?: string;
  supportNearWallHint?: string;
  /** Hold-class exercises — primary live metric label. */
  holdTimeTracked?: (formatted: string) => string;
  /** Simplified live body-detection indicator (patient canvas). */
  liveSignalBodyVisible: string;
  liveSignalAdjustPosition: string;
  liveSignalMoveBackLighting: string;
  /** Pre-tracking camera setup wizard. */
  setupWizardTitle: string;
  setupExerciseHint: string;
  setupExerciseTips: string[];
  setupPreCaptureBullets: string[];
  setupCheckBodyVisible: string;
  setupCheckHipKneeAnkleVisible: string;
  setupCheckWristShoulderVisible: string;
  setupCheckFeetVisible: string;
  setupCheckCorrectDistance: string;
  setupCheckFeetAnklesVisible: string;
  setupCheckLightingAcceptable: string;
  setupCheckFullBodyInFrame: string;
  setupCheckTrackingStable: string;
  setupTrackingStableProgress: (seconds: number, targetSeconds: number) => string;
  setupStateReadyToStart: string;
  setupStateMoveBack: string;
  setupStateMoveCloser: string;
  setupStateImproveLighting: string;
  setupStateShowFeetAnkles: string;
  setupStateAdjustCameraAngle: string;
  setupStartTracking: string;
  setupTrackingStartedAutomatically: string;
  setupStartAnyway: string;
  setupStartAnywayWarning: string;
  setupCheckingCamera: string;
  setupReachDirectionCue: string;
  setupGuidanceMoveFarther: string;
  setupGuidanceStepIntoFrame: string;
  setupGuidanceImproveLighting: string;
  setupGuidanceFeetVisible: string;
  setupGuidanceReachArmInFrame: string;
  setupGuidanceAdjustPosition: string;
  /** Short privacy note shown before camera access. */
  setupPrivacyMicroConsent: string;
  /** Shown after the patient stops camera tracking. */
  sessionCompleteConfirmation: string;
};

/* ── Patient-safe CV copy (EN/AR) — PatientCvCapture ─────────────────────── */

const PATIENT_CV_CONSENT_DONT_EN = [
  "Record or upload video",
  "Store body coordinates or pose landmarks",
  "Judge whether your movement is correct or wrong",
  "Give a diagnosis, score, or treatment recommendation",
  "Make an automatic progression or treatment decision",
] as const;

const PATIENT_CV_CONSENT_DONT_AR = [
  "لا يسجّل أو يرفع فيديو",
  "لا يخزّن إحداثيات الجسم أو معالم الوضعية",
  "لا يحكم على صحة أو خطأ حركتك",
  "لا يقدّم تشخيصاً أو درجة أو توصية علاجية",
  "لا يتخذ قرار تقدّم أو علاج تلقائياً",
] as const;

const PATIENT_LIVE_SIGNAL_COPY_EN = {
  liveSignalBodyVisible: "Body visible",
  liveSignalAdjustPosition: "Adjust position",
  liveSignalMoveBackLighting: "Move back or improve lighting",
} as const;

const PATIENT_LIVE_SIGNAL_COPY_AR = {
  liveSignalBodyVisible: "الجسم ظاهر",
  liveSignalAdjustPosition: "عدّل وضعيتك",
  liveSignalMoveBackLighting: "ابتعد أو حسّن الإضاءة",
} as const;

const PATIENT_SETUP_WIZARD_COPY_EN = {
  setupWizardTitle: "Camera setup",
  setupPreCaptureBullets: [
    "Stand here, step back, or move closer until your full body fits in frame.",
    "Keep your feet and target joints inside the camera view.",
    "Use good, even lighting — avoid strong backlight.",
  ],
  setupCheckBodyVisible: "Body visible",
  setupCheckHipKneeAnkleVisible: "Hips, knees, and ankles visible",
  setupCheckWristShoulderVisible: "Shoulder and wrist visible",
  setupCheckFeetVisible: "Feet visible",
  setupCheckCorrectDistance: "Correct distance",
  setupCheckFeetAnklesVisible: "Feet and ankles visible",
  setupCheckLightingAcceptable: "Lighting acceptable",
  setupCheckFullBodyInFrame: "Full body in frame",
  setupCheckTrackingStable: "Tracking stable",
  setupTrackingStableProgress: (seconds: number, targetSeconds: number) =>
    `Hold steady — ${Math.min(seconds, targetSeconds).toFixed(0)} / ${targetSeconds}s`,
  setupStateReadyToStart: "Ready to start",
  setupStateMoveBack: "Move back",
  setupStateMoveCloser: "Move closer",
  setupStateImproveLighting: "Improve lighting",
  setupStateShowFeetAnkles: "Show feet and ankles",
  setupStateAdjustCameraAngle: "Adjust camera angle",
  setupStartTracking: "Start tracking",
  setupTrackingStartedAutomatically: "Tracking started automatically",
  setupStartAnyway: "Continue anyway — limited tracking",
  setupStartAnywayWarning:
    "Camera setup is not ideal. Tracking may miss reps or feel less reliable.",
  setupCheckingCamera: "Checking camera setup…",
  setupReachDirectionCue: "Reach forward — keep your arm inside the frame",
  setupGuidanceMoveFarther: "Move farther from the camera",
  setupGuidanceStepIntoFrame: "Step into frame so your body is visible",
  setupGuidanceImproveLighting: "Improve lighting or reduce backlight",
  setupGuidanceFeetVisible: "Make sure your feet are visible",
  setupGuidanceReachArmInFrame: "Keep your reaching arm inside the frame",
  setupGuidanceAdjustPosition: "Adjust your position for a clearer view",
  setupPrivacyMicroConsent:
    "Camera is optional. No video or image is stored. Your therapist only sees derived movement numbers.",
  sessionCompleteConfirmation:
    "Well done — your session is complete. Your therapist will review your results soon.",
} as const;

const PATIENT_SETUP_WIZARD_COPY_AR = {
  setupWizardTitle: "إعداد الكاميرا",
  setupPreCaptureBullets: [
    "قف هنا أو ابتعد أو اقترب حتى يظهر جسمك بالكامل في الإطار.",
    "أبقِ قدميك والمفاصل المستهدفة داخل عرض الكاميرا.",
    "استخدم إضاءة جيدة ومتساوية — تجنّب الإضاءة الخلفية القوية.",
  ],
  setupCheckBodyVisible: "الجسم ظاهر",
  setupCheckHipKneeAnkleVisible: "الوركان والركبتان والكاحلان ظاهرون",
  setupCheckWristShoulderVisible: "الكتف والمعصم ظاهران",
  setupCheckFeetVisible: "القدمان ظاهرتان",
  setupCheckCorrectDistance: "المسافة مناسبة",
  setupCheckFeetAnklesVisible: "القدمان والكاحلان ظاهران",
  setupCheckLightingAcceptable: "الإضاءة مناسبة",
  setupCheckFullBodyInFrame: "الجسم بالكامل داخل الإطار",
  setupCheckTrackingStable: "التتبّع مستقر",
  setupTrackingStableProgress: (seconds: number, targetSeconds: number) =>
    `اثبت — ${Math.min(seconds, targetSeconds).toFixed(0)} / ${targetSeconds} ث`,
  setupStateReadyToStart: "جاهز للبدء",
  setupStateMoveBack: "ابتعد",
  setupStateMoveCloser: "اقترب",
  setupStateImproveLighting: "حسّن الإضاءة",
  setupStateShowFeetAnkles: "أظهر القدمين والكاحلين",
  setupStateAdjustCameraAngle: "عدّل زاوية الكاميرا",
  setupStartTracking: "ابدأ التتبّع",
  setupTrackingStartedAutomatically: "بدأ التتبّع تلقائياً",
  setupStartAnyway: "المتابعة على أي حال — تتبّع محدود",
  setupStartAnywayWarning:
    "إعداد الكاميرا ليس مثالياً. قد يفوت التتبّع بعض التكرارات أو يكون أقل موثوقية.",
  setupCheckingCamera: "جاري فحص إعداد الكاميرا…",
  setupReachDirectionCue: "امتد للأمام — أبقِ ذراعك داخل الإطار",
  setupGuidanceMoveFarther: "ابتعد عن الكاميرا",
  setupGuidanceStepIntoFrame: "ادخل الإطار حتى يظهر جسمك",
  setupGuidanceImproveLighting: "حسّن الإضاءة أو قلّل الإضاءة الخلفية",
  setupGuidanceFeetVisible: "تأكد من ظهور قدميك",
  setupGuidanceReachArmInFrame: "أبقِ ذراع الوصول داخل الإطار",
  setupGuidanceAdjustPosition: "عدّل وضعيتك لرؤية أوضح",
  setupPrivacyMicroConsent:
    "الكاميرا اختيارية. لا يتم حفظ أي فيديو أو صورة. يصل للمعالج فقط أرقام الحركة المشتقة.",
  sessionCompleteConfirmation:
    "أحسنت — اكتملت جلستك. سيراجع معالجك نتائجك قريبًا.",
} as const;

const PATIENT_SETUP_EXERCISE_HINTS: Record<
  PatientCvExerciseId,
  Record<PatientExerciseLanguage, string>
> = {
  "sit-to-stand": {
    en: "Place your phone 1.5 meters in front of you. Make sure your full body is visible from head to feet. Sit on a stable chair.",
    ar: "ضع الهاتف أمامك على بُعد 1.5 متر. تأكد أن جسمك كاملًا داخل الإطار من الرأس إلى القدم. اجلس على كرسي ثابت.",
  },
  "mini-squat": {
    en: "Place your phone in front of you. Make sure your feet and knees are clearly visible.",
    ar: "ضع الهاتف أمامك على بُعد مناسب. تأكد أن قدميك وركبتيك ظاهرة بوضوح.",
  },
  "single-leg-stance": {
    en: "Place your phone in front of you. Stand near a wall or chair for safety.",
    ar: "ضع الهاتف أمامك. قف بجانب حائط أو كرسي للأمان.",
  },
  "heel-raise": {
    en: "Place your phone in front or slightly to the side. Make sure your feet and ankles are clearly visible.",
    ar: "ضع الهاتف أمامك أو بجانبك. تأكد أن القدمين والكاحلين ظاهرين بوضوح.",
  },
  "step-up": {
    en: "Place your phone where the step/platform and lower body are visible.",
    ar: "ضع الهاتف أمامك بزاوية يظهر فيها السلم أو المنصة والجزء السفلي من الجسم.",
  },
  "lateral-step": {
    en: "Make sure you have enough side space and both feet stay inside the frame.",
    ar: "تأكد أن لديك مساحة جانبية كافية وأن القدمين ظاهرتان داخل الإطار.",
  },
  "functional-reach": {
    en: "Stand side-on if needed. Make sure your shoulder and hand stay inside the frame during the reach.",
    ar: "قف بشكل جانبي إذا لزم الأمر. تأكد أن الكتف واليد داخل الإطار أثناء الوصول للأمام.",
  },
};

const PATIENT_SETUP_EXERCISE_TIPS: Record<
  PatientCvExerciseId,
  Record<PatientExerciseLanguage, readonly string[]>
> = {
  "sit-to-stand": {
    en: [
      "Keep the chair visible in frame.",
      "Use a full body side or front angle.",
      "Hips and knees must stay visible.",
    ],
    ar: [
      "أبقِ الكرسي ظاهراً في الإطار.",
      "استخدم زاوية جانبية أو أمامية للجسم بالكامل.",
      "يجب أن يبقى الوركان والركبتان ظاهرين.",
    ],
  },
  "mini-squat": {
    en: [
      "Show your full lower body.",
      "Keep both feet visible.",
      "Use a front-facing camera angle.",
    ],
    ar: [
      "أظهر الجزء السفلي من جسمك بالكامل.",
      "أبقِ القدمين ظاهرتين.",
      "استخدم زاوية كاميرا أمامية.",
    ],
  },
  "single-leg-stance": {
    en: [
      "Show your full body in a stable frame.",
      "Keep both feet visible before lifting one leg.",
      "Stand near support if you need balance help.",
    ],
    ar: [
      "أظهر جسمك بالكامل في إطار ثابت.",
      "أبقِ القدمين ظاهرتين قبل رفع إحداهما.",
      "قف قرب الدعم إذا احتجت مساعدة في التوازن.",
    ],
  },
  "heel-raise": {
    en: [
      "Frame feet and ankles clearly.",
      "Use a side or front lower-body view.",
      "Do not stand too close to the camera.",
    ],
    ar: [
      "أظهر القدمين والكاحلين بوضوح.",
      "استخدم منظراً جانبياً أو أمامياً للجزء السفلي.",
      "لا تقف قريباً جداً من الكاميرا.",
    ],
  },
  "step-up": {
    en: [
      "Keep the step or platform visible.",
      "Show your full lower body.",
      "Face the step with hips and knees in view.",
    ],
    ar: [
      "أبقِ الدرجة أو المنصة ظاهرة.",
      "أظهر الجزء السفلي من جسمك بالكامل.",
      "واجه الدرجة مع ظهور الوركين والركبتين.",
    ],
  },
  "lateral-step": {
    en: [
      "Leave enough side space for stepping.",
      "Keep both feet visible.",
      "Use a stable, full-body frame.",
    ],
    ar: [
      "اترك مساحة جانبية كافية للخطوة.",
      "أبقِ القدمين ظاهرتين.",
      "استخدم إطاراً ثابتاً للجسم بالكامل.",
    ],
  },
  "functional-reach": {
    en: [
      "Shoulder and wrist must stay visible.",
      "Stand side-on if needed for reach space.",
      "Reach forward — keep your arm inside the frame.",
    ],
    ar: [
      "يجب أن يبقى الكتف والمعصم ظاهرين.",
      "قف جانبياً إن احتجت مساحة للوصول.",
      "امتد للأمام — أبقِ ذراعك داخل الإطار.",
    ],
  },
};

type PatientCvCopyBase = Omit<
  PatientCvCopy,
  | keyof typeof PATIENT_SETUP_WIZARD_COPY_EN
  | "setupExerciseHint"
  | "setupExerciseTips"
>;

const PATIENT_STS_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    consentTitle: "Camera for movement counting",
    consentDoIntro: "What this does:",
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts sit-to-stand movements during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontIntro: "What this does not do:",
    consentDontBullets: [...PATIENT_CV_CONSENT_DONT_EN],
    consentSecureNote: "Camera access requires a secure connection (HTTPS).",
    consentDerivedNote:
      "Only derived session metrics are saved. No video or body coordinates are stored.",
    consentAccept: "I understand — enable camera",
    startTracking: "Start movement tracking",
    stopTracking: "Stop tracking",
    repsCounted: (n) => `Reps counted: ${n}`,
    movementDetectedYes: "Movement detected",
    movementDetectedNo: "Movement not detected — step into frame or adjust distance",
    trackingSignalLabel: "Tracking signal",
    trackingGood: "Tracking signal: Good",
    trackingFair: "Tracking signal: Fair — results may vary",
    trackingPoor: "Tracking signal: Weak — adjust phone or lighting",
    sessionDuration: (formatted) => `Session duration: ${formatted}`,
    savedTherapistReview: "Saved — your therapist can review this session",
    savingMetrics: "Saving session…",
    saveError: "Session data could not be saved. You can continue your exercise.",
    loadingPoseLibrary: "Loading pose library…",
    loadingPoseModel: "Loading pose model…",
    startingCamera: "Starting camera…",
    prototypeNotice:
      "Movement counting is assistive only. It is not clinically validated and does not replace your therapist's guidance.",
    therapistReviewOnly: "For therapist review only — not a clinical assessment.",
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Sit-to-stand only (experimental). The pilot workflow does not depend on camera tracking.",
    continueWithoutCamera: "Continue without camera",
    moveComfortably: "Take your time and move comfortably.",
    trackingStatusReady: "Ready",
    trackingStatusDetecting: "Detecting movement…",
    startSeatedHint: "Start seated, then stand when ready.",
    baselineStandStillHint: "Stay seated while the camera adjusts.",
    framingInstruction:
      "Place your phone so your hips, upper body, and chair are visible.",
    startWhenReadyHint: "Start after the camera shows ready.",
    movementInstruction: "Sit, stand fully, then sit again slowly.",
    checkingCameraPosition: "Checking camera position…",
    cameraReadyLabel: "Camera ready ✓",
    almostReadyLabel: "Almost ready — adjust your phone slightly",
    adjustPhoneBodyChairLabel:
      "Adjust phone position so your body and chair are visible",
    poseNotDetectedLabel: "Step into frame — make sure your body is visible",
    tryAgainLabel: "Try again",
    hipLandmarksHint:
      "Wait until the points appear on your shoulders and hips before standing.",
    framingGoodDistance: "Good distance",
    framingMoveBack: "Step back",
    framingMoveCloser: "Move closer",
    framingAdjustAngle: "Adjust camera angle",
    framingLowVisibility: "Low visibility",
    ...PATIENT_LIVE_SIGNAL_COPY_EN,
  },
  ar: {
    consentTitle: "الكاميرا لعدّ الحركة",
    consentDoIntro: "ماذا يفعل هذا:",
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ حركات الجلوس والوقوف أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontIntro: "ماذا لا يفعل هذا:",
    consentDontBullets: [
      "لا يسجّل أو يرفع فيديو",
      "لا يخزّن إحداثيات الجسم أو معالم الوضعية",
      "لا يحكم على صحة أو خطأ حركتك",
      "لا يقدّم تشخيصاً أو درجة أو توصية علاجية",
      "لا يتخذ قرار تقدّم أو علاج تلقائياً",
    ],
    consentSecureNote: "يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS).",
    consentDerivedNote: "تُحفظ مقاييس الجلسة المشتقة فقط. لا يُخزَّن فيديو أو إحداثيات جسم.",
    consentAccept: "أفهم — تفعيل الكاميرا",
    startTracking: "بدء تتبّع الحركة",
    stopTracking: "إيقاف التتبّع",
    repsCounted: (n) => `التكرارات المحسوبة: ${n}`,
    movementDetectedYes: "تم اكتشاف الحركة",
    movementDetectedNo: "لم تُكتشف الحركة — ادخل الإطار أو عدّل المسافة",
    trackingSignalLabel: "إشارة التتبّع",
    trackingGood: "إشارة التتبّع: جيدة",
    trackingFair: "إشارة التتبّع: متوسطة — قد تختلف النتائج",
    trackingPoor: "إشارة التتبّع: ضعيفة — عدّل الهاتف أو الإضاءة",
    sessionDuration: (formatted) => `مدة الجلسة: ${formatted}`,
    savedTherapistReview: "تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة",
    savingMetrics: "جاري حفظ الجلسة…",
    saveError: "تعذّر حفظ بيانات الجلسة. يمكنك متابعة التمرين.",
    loadingPoseLibrary: "جاري تحميل مكتبة الوضعية…",
    loadingPoseModel: "جاري تحميل نموذج الوضعية…",
    startingCamera: "جاري تشغيل الكاميرا…",
    prototypeNotice:
      "عدّ الحركة مساعد فقط. غير مُتحقّق سريرياً ولا يُغني عن إرشاد معالجك.",
    therapistReviewOnly: "لمراجعة المعالج فقط — وليس تقييماً سريرياً.",
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · لمراجعة المعالج فقط · غير مُتحقّق سريرياً. تمرين الجلوس والوقوف فقط (تجريبي). مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    continueWithoutCamera: "المتابعة دون كاميرا",
    moveComfortably: "خذ وقتك وتحرّك براحة.",
    trackingStatusReady: "جاهز",
    trackingStatusDetecting: "جاري اكتشاف الحركة…",
    startSeatedHint: "ابدأ جالساً، ثم قف عندما تكون مستعداً.",
    baselineStandStillHint: "ابقَ جالساً ريثما تضبط الكاميرا.",
    framingInstruction: "ضع هاتفك بحيث تظهر الوركان والجزء العلوي من جسمك والكرسي.",
    startWhenReadyHint: "ابدأ بعد أن تظهر الكاميرا أنها جاهزة.",
    movementInstruction: "اجلس، قف بالكامل، ثم اجلس مرة أخرى ببطء.",
    checkingCameraPosition: "جاري فحص موضع الكاميرا…",
    cameraReadyLabel: "الكاميرا جاهزة ✓",
    almostReadyLabel: "يكاد يكون جاهزاً — عدّل الهاتف قليلاً",
    adjustPhoneBodyChairLabel: "عدّل موضع الهاتف حتى يظهر جسمك والكرسي",
    poseNotDetectedLabel: "ادخل الإطار — تأكد من ظهور جسمك",
    tryAgainLabel: "حاول مرة أخرى",
    hipLandmarksHint: "انتظر حتى تظهر النقاط على الكتفين والوركين قبل الوقوف.",
    framingGoodDistance: "المسافة مناسبة",
    framingMoveBack: "ابتعد قليلاً",
    framingMoveCloser: "اقترب قليلاً",
    framingAdjustAngle: "عدّل زاوية الكاميرا",
    framingLowVisibility: "وضوح منخفض",
    ...PATIENT_LIVE_SIGNAL_COPY_AR,
  },
};

const PATIENT_MINI_SQUAT_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    consentTitle: "Camera for movement counting",
    consentDoIntro: "What this does:",
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts mini squat movements during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontIntro: "What this does not do:",
    consentDontBullets: [...PATIENT_CV_CONSENT_DONT_EN],
    consentSecureNote: "Camera access requires a secure connection (HTTPS).",
    consentDerivedNote:
      "Only derived session metrics are saved. No video or body coordinates are stored.",
    consentAccept: "I understand — enable camera",
    startTracking: "Start movement tracking",
    stopTracking: "Stop tracking",
    repsCounted: (n) => `Reps counted: ${n}`,
    movementDetectedYes: "Movement detected",
    movementDetectedNo: "Movement not detected — step into frame or adjust distance",
    trackingSignalLabel: "Tracking signal",
    trackingGood: "Tracking signal: Good",
    trackingFair: "Tracking signal: Fair — results may vary",
    trackingPoor: "Tracking signal: Weak — adjust phone or lighting",
    sessionDuration: (formatted) => `Session duration: ${formatted}`,
    savedTherapistReview: "Saved — your therapist can review this session",
    savingMetrics: "Saving session…",
    saveError: "Session data could not be saved. You can continue your exercise.",
    loadingPoseLibrary: "Loading pose library…",
    loadingPoseModel: "Loading pose model…",
    startingCamera: "Starting camera…",
    prototypeNotice:
      "Movement counting is assistive only. It is not clinically validated and does not replace your therapist's guidance.",
    therapistReviewOnly: "For therapist review only — not a clinical assessment.",
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Mini squat (experimental). The pilot workflow does not depend on camera tracking.",
    continueWithoutCamera: "Continue without camera",
    moveComfortably: "Take your time and move comfortably.",
    trackingStatusReady: "Ready",
    trackingStatusDetecting: "Detecting movement…",
    startSeatedHint: "Stand facing the camera, feet shoulder-width apart.",
    baselineStandStillHint: "Stand still while the camera adjusts.",
    framingInstruction: "Stand facing the camera; hips and upper body visible.",
    startWhenReadyHint: "Start after the camera shows ready.",
    movementInstruction: "Squat down slowly, then stand again at a comfortable depth.",
    checkingCameraPosition: "Checking camera position…",
    cameraReadyLabel: "Camera ready ✓",
    almostReadyLabel: "Almost ready — adjust your phone slightly",
    adjustPhoneBodyChairLabel: "Adjust phone position so your body is visible",
    poseNotDetectedLabel: "Step into frame — make sure your body is visible",
    tryAgainLabel: "Try again",
    hipLandmarksHint: "Wait until the points appear on your shoulders and hips before squatting.",
    framingGoodDistance: "Good distance",
    framingMoveBack: "Step back",
    framingMoveCloser: "Move closer",
    framingAdjustAngle: "Adjust camera angle",
    framingLowVisibility: "Low visibility",
    ...PATIENT_LIVE_SIGNAL_COPY_EN,
  },
  ar: {
    consentTitle: "الكاميرا لعدّ الحركة",
    consentDoIntro: "ماذا يفعل هذا:",
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ حركات القرفصاء الصغيرة أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontIntro: "ماذا لا يفعل هذا:",
    consentDontBullets: [...PATIENT_CV_CONSENT_DONT_AR],
    consentSecureNote: "يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS).",
    consentDerivedNote: "تُحفظ مقاييس الجلسة المشتقة فقط. لا يُخزَّن فيديو أو إحداثيات جسم.",
    consentAccept: "أفهم — تفعيل الكاميرا",
    startTracking: "بدء تتبّع الحركة",
    stopTracking: "إيقاف التتبّع",
    repsCounted: (n) => `العدات المحسوبة: ${n}`,
    movementDetectedYes: "تم اكتشاف الحركة",
    movementDetectedNo: "لم تُكتشف الحركة — ادخل الإطار أو عدّل المسافة",
    trackingSignalLabel: "إشارة التتبّع",
    trackingGood: "إشارة التتبّع: جيدة",
    trackingFair: "إشارة التتبّع: متوسطة — قد تختلف النتائج",
    trackingPoor: "إشارة التتبّع: ضعيفة — عدّل الهاتف أو الإضاءة",
    sessionDuration: (formatted) => `مدة الجلسة: ${formatted}`,
    savedTherapistReview: "تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة",
    savingMetrics: "جاري حفظ الجلسة…",
    saveError: "تعذّر حفظ بيانات الجلسة. يمكنك متابعة التمرين.",
    loadingPoseLibrary: "جاري تحميل مكتبة الوضعية…",
    loadingPoseModel: "جاري تحميل نموذج الوضعية…",
    startingCamera: "جاري تشغيل الكاميرا…",
    prototypeNotice:
      "عدّ الحركة مساعد فقط. غير مُتحقّق سريرياً ولا يُغني عن إرشاد معالجك.",
    therapistReviewOnly: "لمراجعة المعالج فقط — وليس تقييماً سريرياً.",
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. القرفصاء الصغيرة (تجريبي). مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    continueWithoutCamera: "المتابعة بدون كاميرا",
    moveComfortably: "خذ وقتك وتحرك براحة.",
    trackingStatusReady: "جاهز",
    trackingStatusDetecting: "جاري اكتشاف الحركة…",
    startSeatedHint: "قف مواجهاً للكاميرا، القدمان بعرض الكتفين.",
    baselineStandStillHint: "قف ثابتاً ريثما تضبط الكاميرا.",
    framingInstruction: "قف مواجهاً للكاميرا؛ الوركان والجزء العلوي من الجسم ظاهران.",
    startWhenReadyHint: "ابدأ بعد أن تظهر الكاميرا أنها جاهزة.",
    movementInstruction: "انزل ببطء في القرفصاء ثم قف مجدداً بعمق مريح.",
    checkingCameraPosition: "جاري فحص موضع الكاميرا…",
    cameraReadyLabel: "الكاميرا جاهزة ✓",
    almostReadyLabel: "يكاد يكون جاهزاً — عدّل الهاتف قليلاً",
    adjustPhoneBodyChairLabel: "عدّل موضع الهاتف حتى يظهر جسمك",
    poseNotDetectedLabel: "ادخل الإطار — تأكد من ظهور جسمك",
    tryAgainLabel: "حاول مرة أخرى",
    hipLandmarksHint: "انتظر حتى تظهر النقاط على الكتفين والوركين قبل القرفصاء.",
    framingGoodDistance: "المسافة مناسبة",
    framingMoveBack: "ابتعد قليلاً",
    framingMoveCloser: "اقترب قليلاً",
    framingAdjustAngle: "عدّل زاوية الكاميرا",
    framingLowVisibility: "وضوح منخفض",
    ...PATIENT_LIVE_SIGNAL_COPY_AR,
  },
};

/** Server-side prototype_version for patient_session CV saves (CV-Y1B). */
export const CV_Y1B_PATIENT_PROTOTYPE_VERSION = "cv-y1b-sit-to-stand";

/** Server-side prototype_version for mini squat patient_session saves (CV-Y2). */
export const CV_Y2_MINI_SQUAT_PATIENT_PROTOTYPE_VERSION = "cv-y2-mini-squat";

/** Server-side prototype_version for single-leg stance patient_session saves (CV-Y3). */
export const CV_Y3_SINGLE_LEG_STANCE_PATIENT_PROTOTYPE_VERSION = "cv-y3-single-leg-stance";

/** Server-side prototype_version for double heel raise patient_session saves (CV-Y4). */
export const CV_Y4_HEEL_RAISE_PATIENT_PROTOTYPE_VERSION = "cv-y4-heel-raise";

/** Server-side prototype_version for step up patient_session saves (CV-Y5). */
export const CV_Y5_STEP_UP_PATIENT_PROTOTYPE_VERSION = "cv-y5-step-up";
export const CV_Y6_LATERAL_STEP_PATIENT_PROTOTYPE_VERSION = "cv-y6-lateral-step";
export const CV_Y7_FUNCTIONAL_REACH_PATIENT_PROTOTYPE_VERSION = "cv-y7-functional-reach";

const PATIENT_HEEL_RAISE_CONSENT_DONT_EN = [
  ...PATIENT_CV_CONSENT_DONT_EN,
  "Measure heel height or ankle strength",
  "Score movement quality",
] as const;

const PATIENT_HEEL_RAISE_CONSENT_DONT_AR = [
  ...PATIENT_CV_CONSENT_DONT_AR,
  "لا يقيس ارتفاع الكعب أو قوة الكاحل",
  "لا يقيّم جودة الحركة",
] as const;

const PATIENT_SLS_CONSENT_DONT_EN = [
  ...PATIENT_CV_CONSENT_DONT_EN,
  "Give a balance score or pass/fail rating",
] as const;

const PATIENT_SLS_CONSENT_DONT_AR = [
  ...PATIENT_CV_CONSENT_DONT_AR,
  "لا يقدّم درجة توازن أو تقييم نجاح/فشل",
] as const;

const PATIENT_SLS_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    consentTitle: "Camera for hold tracking",
    consentDoIntro: "What this does:",
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Tracks assistive hold time during single-leg stance",
      "Shows whether hold time is being detected",
      "Saves derived hold duration for your therapist to review",
    ],
    consentDontIntro: "What this does not do:",
    consentDontBullets: [...PATIENT_SLS_CONSENT_DONT_EN],
    consentSecureNote: "Camera access requires a secure connection (HTTPS).",
    consentDerivedNote:
      "Only derived session metrics are saved. No video or body coordinates are stored.",
    consentAccept: "I understand — enable camera",
    startTracking: "Start hold tracking",
    stopTracking: "Stop tracking",
    repsCounted: () => "",
    holdTimeTracked: (formatted) => `Hold time tracked: ${formatted}`,
    movementDetectedYes: "Hold detected",
    movementDetectedNo: "Hold not detected yet — adjust camera angle",
    trackingSignalLabel: "Tracking signal",
    trackingGood: "Tracking signal: Good",
    trackingFair: "Tracking signal: Fair — results may vary",
    trackingPoor: "Tracking signal: Weak — adjust phone or lighting",
    sessionDuration: (formatted) => `Hold time tracked: ${formatted}`,
    savedTherapistReview: "Saved — your therapist can review this session",
    savingMetrics: "Saving session…",
    saveError: "Session data could not be saved. You can continue your exercise.",
    loadingPoseLibrary: "Loading pose library…",
    loadingPoseModel: "Loading pose model…",
    startingCamera: "Starting camera…",
    prototypeNotice:
      "Hold tracking is assistive only. It is not a balance test and is not clinically validated.",
    therapistReviewOnly: "For therapist review only — not a clinical assessment.",
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Single-leg stance (experimental). The pilot workflow does not depend on camera tracking.",
    continueWithoutCamera: "Continue without camera",
    moveComfortably: "Take your time and move comfortably.",
    trackingStatusReady: "Ready",
    trackingStatusDetecting: "Detecting hold…",
    startSeatedHint: "Stand facing the camera, feet hip-width apart.",
    baselineStandStillHint: "Stand on both feet while the camera adjusts.",
    framingInstruction:
      "Stand facing the camera — full body from head to feet visible when possible.",
    startWhenReadyHint: "Start after the camera shows ready.",
    movementInstruction:
      "Lift one foot off the ground and hold. Lower gently when you need a break.",
    checkingCameraPosition: "Checking camera position…",
    cameraReadyLabel: "Camera ready ✓",
    almostReadyLabel: "Almost ready — adjust your phone slightly",
    adjustPhoneBodyChairLabel: "Adjust phone position so your full body is visible",
    poseNotDetectedLabel: "Step into frame — make sure your body is visible",
    tryAgainLabel: "Try again",
    hipLandmarksHint:
      "Wait until points appear on shoulders, hips, and ankles before lifting your foot.",
    framingGoodDistance: "Good distance",
    framingMoveBack: "Step back",
    framingMoveCloser: "Move closer",
    framingAdjustAngle: "Adjust camera angle",
    framingLowVisibility: "Low visibility",
    stanceLegPickerTitle: "Which leg are you standing on?",
    stanceLegLeftLabel: "Left leg standing",
    stanceLegRightLabel: "Right leg standing",
    supportNearWallHint:
      "Stand near a wall or chair for light support if your plan allows.",
    ...PATIENT_LIVE_SIGNAL_COPY_EN,
  },
  ar: {
    consentTitle: "الكاميرا لتتبّع الثبات",
    consentDoIntro: "ماذا يفعل هذا:",
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يتتبّع وقت الثبات المساعد أثناء الوقوف على رجل واحدة",
      "يُظهر ما إذا كان وقت الثبات يُكتشف",
      "يحفظ مدة الثبات المشتقة لمراجعة معالجك",
    ],
    consentDontIntro: "ماذا لا يفعل هذا:",
    consentDontBullets: [...PATIENT_SLS_CONSENT_DONT_AR],
    consentSecureNote: "يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS).",
    consentDerivedNote: "تُحفظ مقاييس الجلسة المشتقة فقط. لا يُخزَّن فيديو أو إحداثيات جسم.",
    consentAccept: "أفهم — تفعيل الكاميرا",
    startTracking: "بدء تتبّع الثبات",
    stopTracking: "إيقاف التتبّع",
    repsCounted: () => "",
    holdTimeTracked: (formatted) => `وقت الثبات المتتبّع: ${formatted}`,
    movementDetectedYes: "تم اكتشاف الثبات",
    movementDetectedNo: "لم يُكتشف الثبات بعد — عدّل زاوية الكاميرا",
    trackingSignalLabel: "إشارة التتبّع",
    trackingGood: "إشارة التتبّع: جيدة",
    trackingFair: "إشارة التتبّع: متوسطة — قد تختلف النتائج",
    trackingPoor: "إشارة التتبّع: ضعيفة — عدّل الهاتف أو الإضاءة",
    sessionDuration: (formatted) => `وقت الثبات المتتبّع: ${formatted}`,
    savedTherapistReview: "تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة",
    savingMetrics: "جاري حفظ الجلسة…",
    saveError: "تعذّر حفظ بيانات الجلسة. يمكنك متابعة التمرين.",
    loadingPoseLibrary: "جاري تحميل مكتبة الوضعية…",
    loadingPoseModel: "جاري تحميل نموذج الوضعية…",
    startingCamera: "جاري تشغيل الكاميرا…",
    prototypeNotice:
      "تتبّع الثبات مساعد فقط. ليس اختبار توازن وغير مُتحقّق سريرياً.",
    therapistReviewOnly: "لمراجعة المعالج فقط — وليس تقييماً سريرياً.",
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. الوقوف على رجل واحدة (تجريبي). مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    continueWithoutCamera: "المتابعة دون كاميرا",
    moveComfortably: "خذ وقتك وتحرّك براحة.",
    trackingStatusReady: "جاهز",
    trackingStatusDetecting: "جاري اكتشاف الثبات…",
    startSeatedHint: "قف مواجهاً للكاميرا، القدمان بعرض الوركين.",
    baselineStandStillHint: "قف على القدمين ريثما تضبط الكاميرا.",
    framingInstruction:
      "قف مواجهاً للكاميرا — يُفضّل ظهور الجسم كاملاً من الرأس إلى القدمين.",
    startWhenReadyHint: "ابدأ بعد أن تظهر الكاميرا أنها جاهزة.",
    movementInstruction: "ارفع قدماً عن الأرض وثبّت. انزل بلطف عند الحاجة.",
    checkingCameraPosition: "جاري فحص موضع الكاميرا…",
    cameraReadyLabel: "الكاميرا جاهزة ✓",
    almostReadyLabel: "يكاد يكون جاهزاً — عدّل الهاتف قليلاً",
    adjustPhoneBodyChairLabel: "عدّل موضع الهاتف حتى يظهر جسمك بالكامل",
    poseNotDetectedLabel: "ادخل الإطار — تأكد من ظهور جسمك",
    tryAgainLabel: "حاول مرة أخرى",
    hipLandmarksHint:
      "انتظر حتى تظهر النقاط على الكتفين والوركين والكاحلين قبل رفع القدم.",
    framingGoodDistance: "المسافة مناسبة",
    framingMoveBack: "ابتعد قليلاً",
    framingMoveCloser: "اقترب قليلاً",
    framingAdjustAngle: "عدّل زاوية الكاميرا",
    framingLowVisibility: "وضوح منخفض",
    stanceLegPickerTitle: "على أي ساق تقف؟",
    stanceLegLeftLabel: "الوقوف على الساق اليسرى",
    stanceLegRightLabel: "الوقوف على الساق اليمنى",
    supportNearWallHint: "قف قرب جدار أو كرسي للدعم الخفيف إذا سمح برنامجك بذلك.",
    ...PATIENT_LIVE_SIGNAL_COPY_AR,
  },
};

const PATIENT_HEEL_RAISE_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    consentTitle: "Camera for movement counting",
    consentDoIntro: "What this does:",
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts double heel raise reps during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontIntro: "What this does not do:",
    consentDontBullets: [...PATIENT_HEEL_RAISE_CONSENT_DONT_EN],
    consentSecureNote: "Camera access requires a secure connection (HTTPS).",
    consentDerivedNote:
      "Only derived session metrics are saved. No video or body coordinates are stored.",
    consentAccept: "I understand — enable camera",
    startTracking: "Start movement tracking",
    stopTracking: "Stop tracking",
    repsCounted: (n) => `Reps counted: ${n}`,
    movementDetectedYes: "Movement detected",
    movementDetectedNo: "Movement not detected — step into frame or adjust distance",
    trackingSignalLabel: "Tracking signal",
    trackingGood: "Tracking signal: Good",
    trackingFair: "Tracking signal: Fair — results may vary",
    trackingPoor: "Tracking signal: Weak — adjust phone or lighting",
    sessionDuration: (formatted) => `Session duration: ${formatted}`,
    savedTherapistReview: "Saved — your therapist can review this session",
    savingMetrics: "Saving session…",
    saveError: "Session data could not be saved. You can continue your exercise.",
    loadingPoseLibrary: "Loading pose library…",
    loadingPoseModel: "Loading pose model…",
    startingCamera: "Starting camera…",
    prototypeNotice:
      "Movement counting is assistive only. It is not clinically validated and does not replace your therapist's guidance.",
    therapistReviewOnly: "For therapist review only — not a clinical assessment.",
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Double heel raise (experimental). No height or strength score. The pilot workflow does not depend on camera tracking.",
    continueWithoutCamera: "Continue without camera",
    moveComfortably: "Take your time and move comfortably.",
    trackingStatusReady: "Ready",
    trackingStatusDetecting: "Detecting movement…",
    startSeatedHint:
      "Stand at a slight angle (~45°) to the camera so both feet and ankles are visible.",
    baselineStandStillHint: "Stand still on flat feet while the camera adjusts.",
    framingInstruction:
      "Place your phone so your full body and both ankles are visible at a slight angle (~45°).",
    startWhenReadyHint: "Start after the camera shows ready.",
    movementInstruction: "Rise onto both toes slowly, hold briefly, then lower slowly.",
    checkingCameraPosition: "Checking camera position…",
    cameraReadyLabel: "Camera ready ✓",
    almostReadyLabel: "Almost ready — adjust your phone slightly",
    adjustPhoneBodyChairLabel: "Adjust phone position so your body and ankles are visible",
    poseNotDetectedLabel: "Step into frame — make sure your body is visible",
    tryAgainLabel: "Try again",
    hipLandmarksHint:
      "Wait until points appear on your shoulders, hips, and ankles before rising onto your toes.",
    framingGoodDistance: "Good distance",
    framingMoveBack: "Step back",
    framingMoveCloser: "Move closer",
    framingAdjustAngle: "Adjust camera angle (~45°)",
    framingLowVisibility: "Low visibility",
    supportNearWallHint:
      "Stand near a wall or chair for light support if your plan allows.",
    ...PATIENT_LIVE_SIGNAL_COPY_EN,
  },
  ar: {
    consentTitle: "الكاميرا لعدّ الحركة",
    consentDoIntro: "ماذا يفعل هذا:",
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ تكرارات رفع الكعبين معاً أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontIntro: "ماذا لا يفعل هذا:",
    consentDontBullets: [...PATIENT_HEEL_RAISE_CONSENT_DONT_AR],
    consentSecureNote: "يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS).",
    consentDerivedNote: "تُحفظ مقاييس الجلسة المشتقة فقط. لا يُخزَّن فيديو أو إحداثيات جسم.",
    consentAccept: "أفهم — تفعيل الكاميرا",
    startTracking: "بدء تتبّع الحركة",
    stopTracking: "إيقاف التتبّع",
    repsCounted: (n) => `التكرارات المحسوبة: ${n}`,
    movementDetectedYes: "تم اكتشاف الحركة",
    movementDetectedNo: "لم تُكتشف الحركة — ادخل الإطار أو عدّل المسافة",
    trackingSignalLabel: "إشارة التتبّع",
    trackingGood: "إشارة التتبّع: جيدة",
    trackingFair: "إشارة التتبّع: متوسطة — قد تختلف النتائج",
    trackingPoor: "إشارة التتبّع: ضعيفة — عدّل الهاتف أو الإضاءة",
    sessionDuration: (formatted) => `مدة الجلسة: ${formatted}`,
    savedTherapistReview: "تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة",
    savingMetrics: "جاري حفظ الجلسة…",
    saveError: "تعذّر حفظ بيانات الجلسة. يمكنك متابعة التمرين.",
    loadingPoseLibrary: "جاري تحميل مكتبة الوضعية…",
    loadingPoseModel: "جاري تحميل نموذج الوضعية…",
    startingCamera: "جاري تشغيل الكاميرا…",
    prototypeNotice:
      "عدّ الحركة مساعد فقط. غير مُتحقّق سريرياً ولا يُغني عن إرشاد معالجك.",
    therapistReviewOnly: "لمراجعة المعالج فقط — وليس تقييماً سريرياً.",
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. رفع الكعبين معاً (تجريبي). لا درجة ارتفاع أو قوة. مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    continueWithoutCamera: "المتابعة دون كاميرا",
    moveComfortably: "خذ وقتك وتحرّك براحة.",
    trackingStatusReady: "جاهز",
    trackingStatusDetecting: "جاري اكتشاف الحركة…",
    startSeatedHint:
      "قف بزاوية ~45° للكاميرا بحيث تظهر القدمان والكاحلان.",
    baselineStandStillHint: "قف ثابتاً على القدمين مسطحتين ريثما تضبط الكاميرا.",
    framingInstruction:
      "ضع هاتفك بحيث يظهر جسمك كاملاً وكاحلاك معاً بزاوية ~45°.",
    startWhenReadyHint: "ابدأ بعد أن تظهر الكاميرا أنها جاهزة.",
    movementInstruction: "ارفع على أطراف القدمين ببطء، ثبّت قليلاً، ثم انزل ببطء.",
    checkingCameraPosition: "جاري فحص موضع الكاميرا…",
    cameraReadyLabel: "الكاميرا جاهزة ✓",
    almostReadyLabel: "يكاد يكون جاهزاً — عدّل الهاتف قليلاً",
    adjustPhoneBodyChairLabel: "عدّل موضع الهاتف حتى يظهر جسمك والكاحلان",
    poseNotDetectedLabel: "ادخل الإطار — تأكد من ظهور جسمك",
    tryAgainLabel: "حاول مرة أخرى",
    hipLandmarksHint:
      "انتظر حتى تظهر النقاط على الكتفين والوركين والكاحلين قبل الرفع على أطراف القدم.",
    framingGoodDistance: "المسافة مناسبة",
    framingMoveBack: "ابتعد قليلاً",
    framingMoveCloser: "اقترب قليلاً",
    framingAdjustAngle: "عدّل زاوية الكاميرا (~45°)",
    framingLowVisibility: "وضوح منخفض",
    supportNearWallHint: "قف قرب جدار أو كرسي للدعم الخفيف إذا سمح برنامجك بذلك.",
    ...PATIENT_LIVE_SIGNAL_COPY_AR,
  },
};

const PATIENT_STEP_UP_CONSENT_DONT_EN = [
  ...PATIENT_CV_CONSENT_DONT_EN,
  "Measure step height or limb strength",
  "Score movement quality",
] as const;

const PATIENT_STEP_UP_CONSENT_DONT_AR = [
  ...PATIENT_CV_CONSENT_DONT_AR,
  "لا يقيس ارتفاع الدرجة أو قوة الطرف",
  "لا يقيّم جودة الحركة",
] as const;

const PATIENT_STEP_UP_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    consentTitle: "Camera for movement counting",
    consentDoIntro: "What this does:",
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts step-up reps during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontIntro: "What this does not do:",
    consentDontBullets: [...PATIENT_STEP_UP_CONSENT_DONT_EN],
    consentSecureNote: "Camera access requires a secure connection (HTTPS).",
    consentDerivedNote:
      "Only derived session metrics are saved. No video or body coordinates are stored.",
    consentAccept: "I understand — enable camera",
    startTracking: "Start movement tracking",
    stopTracking: "Stop tracking",
    repsCounted: (n) => `Reps counted: ${n}`,
    movementDetectedYes: "Movement detected",
    movementDetectedNo: "Movement not detected — step into frame or adjust distance",
    trackingSignalLabel: "Tracking signal",
    trackingGood: "Tracking signal: Good",
    trackingFair: "Tracking signal: Fair — results may vary",
    trackingPoor: "Tracking signal: Weak — adjust phone or lighting",
    sessionDuration: (formatted) => `Session duration: ${formatted}`,
    savedTherapistReview: "Saved — your therapist can review this session",
    savingMetrics: "Saving session…",
    saveError: "Session data could not be saved. You can continue your exercise.",
    loadingPoseLibrary: "Loading pose library…",
    loadingPoseModel: "Loading pose model…",
    startingCamera: "Starting camera…",
    prototypeNotice:
      "Movement counting is assistive only. It is not clinically validated and does not replace your therapist's guidance.",
    therapistReviewOnly: "For therapist review only — not a clinical assessment.",
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Step up (experimental). No height or strength score. The pilot workflow does not depend on camera tracking.",
    continueWithoutCamera: "Continue without camera",
    moveComfortably: "Take your time and move comfortably.",
    trackingStatusReady: "Ready",
    trackingStatusDetecting: "Detecting movement…",
    startSeatedHint:
      "Stand facing the step with your full body visible — hips and knees in view.",
    baselineStandStillHint: "Stand still on the floor while the camera adjusts.",
    framingInstruction:
      "Place your phone so your full body, hips, and the step are visible from the side.",
    startWhenReadyHint: "Start after the camera shows ready.",
    movementInstruction: "Step up onto the platform slowly, pause briefly, then step down with control.",
    checkingCameraPosition: "Checking camera position…",
    cameraReadyLabel: "Camera ready ✓",
    almostReadyLabel: "Almost ready — adjust your phone slightly",
    adjustPhoneBodyChairLabel: "Adjust phone position so your body and hips are visible",
    poseNotDetectedLabel: "Step into frame — make sure your body is visible",
    tryAgainLabel: "Try again",
    hipLandmarksHint:
      "Wait until points appear on your shoulders and hips before stepping onto the platform.",
    framingGoodDistance: "Good distance",
    framingMoveBack: "Step back",
    framingMoveCloser: "Move closer",
    framingAdjustAngle: "Adjust camera angle",
    framingLowVisibility: "Low visibility",
    supportNearWallHint:
      "Stand near a handrail or counter for light support if your plan allows.",
    ...PATIENT_LIVE_SIGNAL_COPY_EN,
  },
  ar: {
    consentTitle: "الكاميرا لعدّ الحركة",
    consentDoIntro: "ماذا يفعل هذا:",
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ تكرارات صعود الدرجة أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontIntro: "ماذا لا يفعل هذا:",
    consentDontBullets: [...PATIENT_STEP_UP_CONSENT_DONT_AR],
    consentSecureNote: "يتطلب الوصول للكاميرا اتصالاً آمناً (HTTPS).",
    consentDerivedNote: "تُحفظ مقاييس الجلسة المشتقة فقط. لا يُخزَّن فيديو أو إحداثيات جسم.",
    consentAccept: "أفهم — تفعيل الكاميرا",
    startTracking: "بدء تتبّع الحركة",
    stopTracking: "إيقاف التتبّع",
    repsCounted: (n) => `التكرارات المحسوبة: ${n}`,
    movementDetectedYes: "تم اكتشاف الحركة",
    movementDetectedNo: "لم تُكتشف الحركة — ادخل الإطار أو عدّل المسافة",
    trackingSignalLabel: "إشارة التتبّع",
    trackingGood: "إشارة التتبّع: جيدة",
    trackingFair: "إشارة التتبّع: متوسطة — قد تختلف النتائج",
    trackingPoor: "إشارة التتبّع: ضعيفة — عدّل الهاتف أو الإضاءة",
    sessionDuration: (formatted) => `مدة الجلسة: ${formatted}`,
    savedTherapistReview: "تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة",
    savingMetrics: "جاري حفظ الجلسة…",
    saveError: "تعذّر حفظ بيانات الجلسة. يمكنك متابعة التمرين.",
    loadingPoseLibrary: "جاري تحميل مكتبة الوضعية…",
    loadingPoseModel: "جاري تحميل نموذج الوضعية…",
    startingCamera: "جاري تشغيل الكاميرا…",
    prototypeNotice:
      "عدّ الحركة مساعد فقط. غير مُتحقّق سريرياً ولا يُغني عن إرشاد معالجك.",
    therapistReviewOnly: "لمراجعة المعالج فقط — وليس تقييماً سريرياً.",
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. صعود الدرجة (تجريبي). لا درجة ارتفاع أو قوة. مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    continueWithoutCamera: "المتابعة دون كاميرا",
    moveComfortably: "خذ وقتك وتحرّك براحة.",
    trackingStatusReady: "جاهز",
    trackingStatusDetecting: "جاري اكتشاف الحركة…",
    startSeatedHint:
      "قف مواجهاً للدرجة مع ظهور جسمك بالكامل — الوركان والركبتان في الإطار.",
    baselineStandStillHint: "قف ثابتاً على الأرض ريثما تضبط الكاميرا.",
    framingInstruction:
      "ضع هاتفك بحيث يظهر جسمك كاملاً والوركان والدرجة من الجانب.",
    startWhenReadyHint: "ابدأ بعد أن تظهر الكاميرا أنها جاهزة.",
    movementInstruction: "اصعد على الدرجة ببطء، ثبّت قليلاً، ثم انزل بتحكم.",
    checkingCameraPosition: "جاري فحص موضع الكاميرا…",
    cameraReadyLabel: "الكاميرا جاهزة ✓",
    almostReadyLabel: "يكاد يكون جاهزاً — عدّل الهاتف قليلاً",
    adjustPhoneBodyChairLabel: "عدّل موضع الهاتف حتى يظهر جسمك ووركاك",
    poseNotDetectedLabel: "ادخل الإطار — تأكد من ظهور جسمك",
    tryAgainLabel: "حاول مرة أخرى",
    hipLandmarksHint:
      "انتظر حتى تظهر النقاط على الكتفين والوركين قبل الصعود على الدرجة.",
    framingGoodDistance: "المسافة مناسبة",
    framingMoveBack: "ابتعد قليلاً",
    framingMoveCloser: "اقترب قليلاً",
    framingAdjustAngle: "عدّل زاوية الكاميرا",
    framingLowVisibility: "وضوح منخفض",
    supportNearWallHint: "قف قرب درابزين أو سطح للدعم الخفيف إذا سمح برنامجك بذلك.",
    ...PATIENT_LIVE_SIGNAL_COPY_AR,
  },
};

const PATIENT_LATERAL_STEP_CONSENT_DONT_EN = [
  ...PATIENT_CV_CONSENT_DONT_EN,
  "Measure step width or hip strength",
  "Score movement quality",
] as const;

const PATIENT_LATERAL_STEP_CONSENT_DONT_AR = [
  ...PATIENT_CV_CONSENT_DONT_AR,
  "لا يقيس عرض الخطوة أو قوة الورك",
  "لا يقيّم جودة الحركة",
] as const;

const PATIENT_LATERAL_STEP_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    ...PATIENT_STEP_UP_CV_COPY.en,
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts lateral-step cycles during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontBullets: [...PATIENT_LATERAL_STEP_CONSENT_DONT_EN],
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Lateral step (experimental). No width or strength score. The pilot workflow does not depend on camera tracking.",
    startSeatedHint:
      "Stand with your full body visible — hips and knees in view for lateral stepping.",
    baselineStandStillHint: "Stand still at center while the camera adjusts.",
    framingInstruction:
      "Place your phone so your full body and hips are visible for lateral steps.",
    movementInstruction:
      "Step sideways onto the line or step slowly, pause briefly, then return to center with control.",
    hipLandmarksHint:
      "Wait until points appear on your shoulders and hips before lateral stepping.",
  },
  ar: {
    ...PATIENT_STEP_UP_CV_COPY.ar,
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ دورات الخطوة الجانبية أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontBullets: [...PATIENT_LATERAL_STEP_CONSENT_DONT_AR],
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. الخطوة الجانبية (تجريبي). لا درجة عرض أو قوة. مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    startSeatedHint:
      "قف مع ظهور جسمك بالكامل — الوركان والركبتان في الإطار للخطوة الجانبية.",
    baselineStandStillHint: "قف ثابتاً في المنتصف ريثما تضبط الكاميرا.",
    framingInstruction:
      "ضع هاتفك بحيث يظهر جسمك كاملاً والوركان للخطوات الجانبية.",
    movementInstruction:
      "خطُ جانباً على الخط أو الدرجة ببطء، ثبّت قليلاً، ثم عد للمنتصف بتحكم.",
    hipLandmarksHint:
      "انتظر حتى تظهر النقاط على الكتفين والوركين قبل الخطوة الجانبية.",
  },
};

const PATIENT_FUNCTIONAL_REACH_CONSENT_DONT_EN = [
  ...PATIENT_CV_CONSENT_DONT_EN,
  "Measure reach distance or balance score",
  "Score movement quality",
] as const;

const PATIENT_FUNCTIONAL_REACH_CONSENT_DONT_AR = [
  ...PATIENT_CV_CONSENT_DONT_AR,
  "لا يقيس مسافة الوصول أو درجة التوازن",
  "لا يقيّم جودة الحركة",
] as const;

const PATIENT_FUNCTIONAL_REACH_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopyBase> = {
  en: {
    ...PATIENT_LATERAL_STEP_CV_COPY.en,
    consentDoBullets: [
      "Uses your camera on this device to detect body position",
      "Counts functional-reach cycles during your exercise",
      "Shows whether movement is being detected",
      "Saves derived counts and duration for your therapist to review",
    ],
    consentDontBullets: [...PATIENT_FUNCTIONAL_REACH_CONSENT_DONT_EN],
    optionalCameraNote:
      "Optional camera assist · therapist review only · not clinically validated. Functional reach (experimental). No reach distance or balance score. The pilot workflow does not depend on camera tracking.",
    startSeatedHint:
      "Stand arm's length from support with shoulders and reaching arm visible.",
    baselineStandStillHint: "Stand still while the camera adjusts.",
    framingInstruction:
      "Place your phone so your shoulders, trunk, and reaching arm are visible.",
    movementInstruction:
      "Reach forward at shoulder height as far as comfortable without stepping, pause briefly, then return to upright with control.",
    hipLandmarksHint:
      "Wait until points appear on your shoulders and hips before reaching forward.",
  },
  ar: {
    ...PATIENT_LATERAL_STEP_CV_COPY.ar,
    consentDoBullets: [
      "يستخدم كاميرتك على هذا الجهاز لاكتشاف وضع الجسم",
      "يعدّ دورات الوصول الوظيفي أثناء التمرين",
      "يُظهر ما إذا كانت الحركة تُكتشف",
      "يحفظ العدّ والمدة المشتقة لمراجعة معالجك",
    ],
    consentDontBullets: [...PATIENT_FUNCTIONAL_REACH_CONSENT_DONT_AR],
    optionalCameraNote:
      "مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً. الوصول الوظيفي (تجريبي). لا مسافة وصول أو درجة توازن. مسار التجربة لا يعتمد على تتبّع الكاميرا.",
    startSeatedHint:
      "قف على مسافة ذراع من الدعم مع ظهور الكتفين وذراع الوصول.",
    baselineStandStillHint: "قف ثابتاً ريثما تضبط الكاميرا.",
    framingInstruction:
      "ضع هاتفك بحيث تظهر الكتفان والجذع وذراع الوصول.",
    movementInstruction:
      "امتد للأمام على ارتفاع الكتف بقدر ما يسمح الراحة دون خطوة، ثبّت قليلاً، ثم عد للوضع المنتصب بتحكم.",
    hipLandmarksHint:
      "انتظر حتى تظهر النقاط على الكتفين والوركين قبل الوصول للأمام.",
  },
};

export function patientCvPrototypeVersion(exerciseId: PatientCvExerciseId): string {
  switch (exerciseId) {
    case "sit-to-stand":
      return CV_Y1B_PATIENT_PROTOTYPE_VERSION;
    case "mini-squat":
      return CV_Y2_MINI_SQUAT_PATIENT_PROTOTYPE_VERSION;
    case "single-leg-stance":
      return CV_Y3_SINGLE_LEG_STANCE_PATIENT_PROTOTYPE_VERSION;
    case "heel-raise":
      return CV_Y4_HEEL_RAISE_PATIENT_PROTOTYPE_VERSION;
    case "step-up":
      return CV_Y5_STEP_UP_PATIENT_PROTOTYPE_VERSION;
    case "lateral-step":
      return CV_Y6_LATERAL_STEP_PATIENT_PROTOTYPE_VERSION;
    case "functional-reach":
      return CV_Y7_FUNCTIONAL_REACH_PATIENT_PROTOTYPE_VERSION;
  }
}

export function patientCvCopy(
  lang: PatientExerciseLanguage,
  exerciseId: PatientCvExerciseId = "sit-to-stand",
): PatientCvCopy {
  const setupCopy =
    lang === "ar" ? PATIENT_SETUP_WIZARD_COPY_AR : PATIENT_SETUP_WIZARD_COPY_EN;
  const setupExerciseHint = PATIENT_SETUP_EXERCISE_HINTS[exerciseId][lang];
  const setupExerciseTips = [...PATIENT_SETUP_EXERCISE_TIPS[exerciseId][lang]];

  let base: PatientCvCopyBase;
  if (exerciseId === "mini-squat") base = PATIENT_MINI_SQUAT_CV_COPY[lang];
  else if (exerciseId === "single-leg-stance") base = PATIENT_SLS_CV_COPY[lang];
  else if (exerciseId === "heel-raise") base = PATIENT_HEEL_RAISE_CV_COPY[lang];
  else if (exerciseId === "step-up") base = PATIENT_STEP_UP_CV_COPY[lang];
  else if (exerciseId === "lateral-step") base = PATIENT_LATERAL_STEP_CV_COPY[lang];
  else if (exerciseId === "functional-reach") base = PATIENT_FUNCTIONAL_REACH_CV_COPY[lang];
  else base = PATIENT_STS_CV_COPY[lang];

  if (isCvMotionPilotWiredForCopy(exerciseId)) {
    base = {
      ...base,
      optionalCameraNote:
        lang === "ar"
          ? "تتبّع بالكاميرا متاح · لمراجعة المعالج فقط · غير مُتحقّق سريرياً."
          : "Camera-assisted tracking available · therapist review only · not clinically validated.",
    };
  }

  return {
    ...base,
    ...setupCopy,
    setupPreCaptureBullets: [...setupCopy.setupPreCaptureBullets],
    setupExerciseHint,
    setupExerciseTips,
  };
}

/** Shared prototype / clinician disclaimer strings (CV Lab + future patient). */
export const CV_PROTOTYPE_NOTICE_EN =
  "Prototype-level detection. Not clinically validated. Derived metrics only — not for treatment decisions.";

export const CV_PROTOTYPE_NOTICE_AR =
  "كشف تجريبي. غير مُتحقّق سريرياً. مقاييس مشتقة فقط — لا تُستخدم لقرارات العلاج.";

export const CV_CLINICIAN_REVIEW_DISCLAIMER_EN =
  "Derived movement metrics only. Not clinically validated. No video or body coordinates stored. Not a clinical assessment.";

export const CV_CLINICIAN_REVIEW_DISCLAIMER_AR =
  "مقاييس حركة مشتقة فقط. غير مُتحقّق سريرياً. لا يُخزَّن فيديو أو إحداثيات. ليست تقييماً سريرياً.";
