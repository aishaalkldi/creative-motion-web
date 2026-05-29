/**
 * Sprint CV-Y1A — BIO-0 thin contracts (types, config, copy).
 * No biomechanics agent runtime. No clinical scoring. No AI.
 */

import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

/* ── Metrics payload (future patient API) ─────────────────────────────────── */

export type CvTrackingQuality = "good" | "fair" | "poor" | "unknown";

/** Client → server body for POST /api/patient/cv-session-metrics (future). */
export type PatientCvMetricsPayload = {
  token: string;
  sessionId: string;
  exerciseId: "sit-to-stand";
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
};

export const DEFAULT_STS_CONFIG: SitToStandCvConfig = {
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
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
  lowerBodyLandmarkIndices: [23, 24, 25, 26, 27, 28],
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
};

const PATIENT_CV_COPY: Record<PatientExerciseLanguage, PatientCvCopy> = {
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
    consentDontBullets: [
      "Record or upload video",
      "Store body coordinates or pose landmarks",
      "Judge whether your movement is correct or wrong",
      "Give a diagnosis, score, or treatment recommendation",
      "Make an automatic progression or treatment decision",
    ],
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
  },
};

/** Server-side prototype_version for patient_session CV saves (CV-Y1B). */
export const CV_Y1B_PATIENT_PROTOTYPE_VERSION = "cv-y1b-sit-to-stand";

export function patientCvCopy(lang: PatientExerciseLanguage): PatientCvCopy {
  return PATIENT_CV_COPY[lang];
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
