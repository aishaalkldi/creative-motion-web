/**
 * Sprint CV-Y1A — BIO-0 thin contracts (types, config, copy).
 * No biomechanics agent runtime. No clinical scoring. No AI.
 */

import type { BodyFramingProfileId } from "@/app/lib/cv/body-framing-profiles";
import { isPatientCvCaptureWired } from "@/app/lib/cv/cv-patient-config";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

/* ── Metrics payload (future patient API) ─────────────────────────────────── */

export type CvTrackingQuality = "good" | "fair" | "poor" | "unknown";

/** Allowed patient-portal CV exercise ids (allowlist). */
export type PatientCvExerciseId =
  | "sit-to-stand"
  | "mini-squat"
  | "single-leg-stance"
  | "heel-raise";

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

export type PatientCvDerivedMetrics =
  | SitToStandDerivedMetrics
  | MiniSquatDerivedMetrics
  | SingleLegStanceDerivedMetrics
  | HeelRaiseDerivedMetrics;

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
  setupCheckBodyVisible: string;
  setupCheckCorrectDistance: string;
  setupCheckFeetAnklesVisible: string;
  setupCheckLightingAcceptable: string;
  setupStateReadyToStart: string;
  setupStateMoveBack: string;
  setupStateMoveCloser: string;
  setupStateImproveLighting: string;
  setupStateShowFeetAnkles: string;
  setupStateAdjustCameraAngle: string;
  setupStartAnyway: string;
  setupStartAnywayWarning: string;
  setupCheckingCamera: string;
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
  setupCheckBodyVisible: "Body visible",
  setupCheckCorrectDistance: "Correct distance",
  setupCheckFeetAnklesVisible: "Feet and ankles visible",
  setupCheckLightingAcceptable: "Lighting acceptable",
  setupStateReadyToStart: "Ready to start",
  setupStateMoveBack: "Move back",
  setupStateMoveCloser: "Move closer",
  setupStateImproveLighting: "Improve lighting",
  setupStateShowFeetAnkles: "Show feet and ankles",
  setupStateAdjustCameraAngle: "Adjust camera angle",
  setupStartAnyway: "Start anyway",
  setupStartAnywayWarning:
    "Camera setup is not ideal. Tracking may miss reps or feel less reliable.",
  setupCheckingCamera: "Checking camera setup…",
} as const;

const PATIENT_SETUP_WIZARD_COPY_AR = {
  setupWizardTitle: "إعداد الكاميرا",
  setupCheckBodyVisible: "الجسم ظاهر",
  setupCheckCorrectDistance: "المسافة مناسبة",
  setupCheckFeetAnklesVisible: "القدمان والكاحلان ظاهران",
  setupCheckLightingAcceptable: "الإضاءة مناسبة",
  setupStateReadyToStart: "جاهز للبدء",
  setupStateMoveBack: "ابتعد",
  setupStateMoveCloser: "اقترب",
  setupStateImproveLighting: "حسّن الإضاءة",
  setupStateShowFeetAnkles: "أظهر القدمين والكاحلين",
  setupStateAdjustCameraAngle: "عدّل زاوية الكاميرا",
  setupStartAnyway: "ابدأ على أي حال",
  setupStartAnywayWarning:
    "إعداد الكاميرا ليس مثالياً. قد يفوت التتبّع بعض التكرارات أو يكون أقل موثوقية.",
  setupCheckingCamera: "جاري فحص إعداد الكاميرا…",
} as const;

const PATIENT_SETUP_EXERCISE_HINTS: Record<
  PatientCvExerciseId,
  Record<PatientExerciseLanguage, string>
> = {
  "sit-to-stand": {
    en: "Show the chair and your full body.",
    ar: "أظهر الكرسي وجسمك بالكامل.",
  },
  "mini-squat": {
    en: "Stand with your full body visible.",
    ar: "قف مع ظهور جسمك بالكامل.",
  },
  "single-leg-stance": {
    en: "Stand near support with your full body visible.",
    ar: "قف قرب الدعم مع ظهور جسمك بالكامل.",
  },
  "heel-raise": {
    en: "Stand at a slight 45° angle with both ankles visible.",
    ar: "قف بزاوية 45° تقريباً مع ظهور الكاحلين معاً.",
  },
};

type PatientCvCopyBase = Omit<
  PatientCvCopy,
  keyof typeof PATIENT_SETUP_WIZARD_COPY_EN | "setupExerciseHint"
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
    movementDetectedNo: "Movement not detected — adjust camera angle",
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
    poseNotDetectedLabel: "Pose not detected — adjust your phone",
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
    movementDetectedNo: "لم تُكتشف الحركة — عدّل زاوية الكاميرا",
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
    poseNotDetectedLabel: "لم تُكتشف الوضعية — عدّل الهاتف",
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
    movementDetectedNo: "Movement not detected — adjust camera angle",
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
    poseNotDetectedLabel: "Pose not detected — adjust your phone",
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
    movementDetectedNo: "لم تُكتشف الحركة — عدّل زاوية الكاميرا",
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
    poseNotDetectedLabel: "لم تُكتشف الوضعية — عدّل الهاتف",
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
    poseNotDetectedLabel: "Pose not detected — adjust your phone",
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
    poseNotDetectedLabel: "لم تُكتشف الوضعية — عدّل الهاتف",
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
    movementDetectedNo: "Movement not detected — adjust camera angle",
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
    poseNotDetectedLabel: "Pose not detected — adjust your phone",
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
    movementDetectedNo: "لم تُكتشف الحركة — عدّل زاوية الكاميرا",
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
    poseNotDetectedLabel: "لم تُكتشف الوضعية — عدّل الهاتف",
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
  }
}

export function patientCvCopy(
  lang: PatientExerciseLanguage,
  exerciseId: PatientCvExerciseId = "sit-to-stand",
): PatientCvCopy {
  const setupCopy =
    lang === "ar" ? PATIENT_SETUP_WIZARD_COPY_AR : PATIENT_SETUP_WIZARD_COPY_EN;
  const setupExerciseHint = PATIENT_SETUP_EXERCISE_HINTS[exerciseId][lang];

  let base: PatientCvCopyBase;
  if (exerciseId === "mini-squat") base = PATIENT_MINI_SQUAT_CV_COPY[lang];
  else if (exerciseId === "single-leg-stance") base = PATIENT_SLS_CV_COPY[lang];
  else if (exerciseId === "heel-raise") base = PATIENT_HEEL_RAISE_CV_COPY[lang];
  else base = PATIENT_STS_CV_COPY[lang];

  if (exerciseId === "heel-raise" && isPatientCvCaptureWired("heel-raise")) {
    base = {
      ...base,
      optionalCameraNote:
        lang === "ar"
          ? "تتبّع بالكاميرا متاح · لمراجعة المعالج فقط · غير مُتحقّق سريرياً."
          : "Camera-assisted tracking available · therapist review only · not clinically validated.",
    };
  }

  return { ...base, ...setupCopy, setupExerciseHint };
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
