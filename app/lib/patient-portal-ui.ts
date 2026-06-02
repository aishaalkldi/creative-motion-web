import type { ClinicalActionStatus } from "@/app/lib/clinical-action-engine";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

import type { CvSaveOutcome } from "@/app/lib/cv/cv-save-outcome";
import { isHoldClassCvExercise } from "@/app/lib/cv/cv-metrics-display";
import type { CvSaveResult } from "@/app/hooks/useCvSessionCapture";

export type PatientPortalLanguage = PatientExerciseLanguage;

/* ── Plan home ─────────────────────────────────────────────────────────────── */

export type PlanHomeUi = {
  loading: string;
  loadError: string;
  connectionError: string;
  planNotFound: string;
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;
  yourRehabPlan: string;
  yourRehabFocus: string;
  weekOfProgram: (week: number, totalWeeks: number) => string;
  sessionProgram: (total: number) => string;
  assignedByClinician: string;
  yourProgress: string;
  sessionsProgress: (completed: number, total: number) => string;
  allSessionsComplete: string;
  allSessionsCompleteBody: string;
  viewMyProgress: string;
  viewMyProgressArrow: string;
  noteFromTherapist: string;
  noteFromTherapistInline: string;
  totalSessions: string;
  completed: string;
  progress: string;
  inYourPlan: string;
  sessionsDone: string;
  completion: string;
  yourSessions: string;
  tapTodaySession: string;
  completedSessionsListed: string;
  finalizingSchedule: string;
  checkBackLater: string;
  noSessionsScheduled: string;
  startToday: string;
  done: string;
  upcoming: string;
  exercisesMinutes: (count: number, minutes: number) => string;
};

const PLAN_HOME: Record<PatientPortalLanguage, PlanHomeUi> = {
  en: {
    loading: "Loading…",
    loadError: "Unable to load your plan. Please try again.",
    connectionError: "Connection error. Please check your connection and try again.",
    planNotFound: "Plan not found.",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    yourRehabPlan: "Your rehabilitation plan",
    yourRehabFocus: "Your rehab focus",
    weekOfProgram: (week, totalWeeks) => `Week ${week} of ${totalWeeks}`,
    sessionProgram: (total) => `Your ${total}-session program`,
    assignedByClinician: "Assigned by your clinician",
    yourProgress: "Your progress",
    sessionsProgress: (completed, total) =>
      `${completed} of ${total} session${total === 1 ? "" : "s"}`,
    allSessionsComplete: "All sessions complete",
    allSessionsCompleteBody:
      "You have finished every session in your current plan. Your therapist will review your progress and may update your program.",
    viewMyProgress: "View my progress",
    viewMyProgressArrow: "View my progress →",
    noteFromTherapist: "Note from your therapist",
    noteFromTherapistInline: "A note from your therapist:",
    totalSessions: "Total sessions",
    completed: "Completed",
    progress: "Progress",
    inYourPlan: "in your plan",
    sessionsDone: "sessions done",
    completion: "completion",
    yourSessions: "Your sessions",
    tapTodaySession: "Tap today's session when you are ready to begin.",
    completedSessionsListed: "Your completed sessions are listed below.",
    finalizingSchedule: "Your therapist is finalizing your session schedule.",
    checkBackLater: "Please check back later once your rehabilitation sessions are ready.",
    noSessionsScheduled: "No sessions scheduled yet.",
    startToday: "Start today",
    done: "Done",
    upcoming: "Upcoming",
    exercisesMinutes: (count, minutes) =>
      `${count} exercise${count === 1 ? "" : "s"} · ~${minutes} min`,
  },
  ar: {
    loading: "جاري التحميل…",
    loadError: "تعذّر تحميل خطتك. يرجى المحاولة مرة أخرى.",
    connectionError: "خطأ في الاتصال. تحقّق من الشبكة وحاول مرة أخرى.",
    planNotFound: "الخطة غير موجودة.",
    goodMorning: "صباح الخير",
    goodAfternoon: "مساء الخير",
    goodEvening: "مساء الخير",
    yourRehabPlan: "خطتك للتأهيل",
    yourRehabFocus: "تركيز خطتك التأهيلية",
    weekOfProgram: (week, totalWeeks) => `الأسبوع ${week} من ${totalWeeks}`,
    sessionProgram: (total) => `برنامجك (${total} جلسات)`,
    assignedByClinician: "موصى بها من معالجك",
    yourProgress: "تقدّمك",
    sessionsProgress: (completed, total) => `${completed} من ${total} جلسات`,
    allSessionsComplete: "أكملت جميع الجلسات",
    allSessionsCompleteBody:
      "أنهيت كل جلسات خطتك الحالية. سيراجع معالجك تقدّمك وقد يحدّث برنامجك.",
    viewMyProgress: "عرض تقدّمي",
    viewMyProgressArrow: "عرض تقدّمي ←",
    noteFromTherapist: "ملاحظة من معالجك",
    noteFromTherapistInline: "ملاحظة من معالجك:",
    totalSessions: "إجمالي الجلسات",
    completed: "مكتمل",
    progress: "التقدّم",
    inYourPlan: "في خطتك",
    sessionsDone: "جلسات منجزة",
    completion: "نسبة الإكمال",
    yourSessions: "جلساتك",
    tapTodaySession: "اضغط على جلسة اليوم عندما تكون مستعداً للبدء.",
    completedSessionsListed: "جلساتك المكتملة مدرجة أدناه.",
    finalizingSchedule: "معالجك يُجهّز جدول جلساتك.",
    checkBackLater: "يرجى العودة لاحقاً عندما تصبح جلسات التأهيل جاهزة.",
    noSessionsScheduled: "لا توجد جلسات مجدولة بعد.",
    startToday: "ابدأ اليوم",
    done: "منجز",
    upcoming: "قادمة",
    exercisesMinutes: (count, minutes) => `${count} تمارين · ~${minutes} د`,
  },
};

/* ── Session shell ─────────────────────────────────────────────────────────── */

export type SessionShellUi = {
  sessionNotFound: string;
  backToPlan: string;
  backToMyPlan: string;
  todaysRehabGoal: string;
  todaysGoal: (sessionTitle: string) => string;
  painBefore: string;
  safetyQuestion: string;
  yes: string;
  no: string;
  startSession: string;
  safetyStopTitle: string;
  safetyAcknowledge: string;
  therapistReviewNote: string;
  nextExercise: string;
  previousExercise: string;
  completeSession: string;
  saving: string;
  finalExerciseHint: string;
  effortQuestion: string;
  painAfter: string;
  optionalNoteLabel: string;
  optionalNotePlaceholder: string;
  finishHint: string;
  sessionComplete: string;
  exercisesCompleted: (count: number) => string;
  effort: string;
  painAfterLabel: string;
  viewProgress: string;
  completionSafetyNote: string;
  sessionSavedForReview: string;
  wellDone: string;
  progressUpdated: string;
  alreadyCompleted: string;
  finishedExercisesInSession: (count: number) => string;
  completedOn: (when: string) => string;
  noRepeatNeeded: string;
  saveError: string;
  sharpPainFooter: string;
};

const SESSION_SHELL: Record<PatientPortalLanguage, SessionShellUi> = {
  en: {
    sessionNotFound: "Session not found.",
    backToPlan: "← Your plan",
    backToMyPlan: "← Back to my plan",
    todaysRehabGoal: "Today's rehab goal",
    todaysGoal: (title) =>
      title.trim()
        ? `Complete "${title}" gently and safely.`
        : "Complete today's session gently and safely.",
    painBefore: "How is your pain before starting? (0 = none, 10 = worst)",
    safetyQuestion: "Do you feel sharp pain, dizziness, or unusual symptoms today?",
    yes: "Yes",
    no: "No",
    startSession: "Start session",
    safetyStopTitle: "Please stop and contact your therapist before starting.",
    safetyAcknowledge: "I will contact my therapist before continuing",
    therapistReviewNote:
      "Your therapist will review your pain, effort, and session response.",
    nextExercise: "Next exercise →",
    previousExercise: "← Previous exercise",
    completeSession: "Complete session",
    saving: "Saving…",
    finalExerciseHint: "This is your final exercise for this session.",
    effortQuestion: "How did this feel? (1 = easy, 10 = very hard)",
    painAfter: "How is your pain after this session? (0 = none, 10 = worst)",
    optionalNoteLabel: "Anything you want your therapist to know? (optional)",
    optionalNotePlaceholder: "Optional note for your therapist…",
    finishHint: "Select how the session felt and your pain level after exercising to finish.",
    sessionComplete: "Session complete",
    exercisesCompleted: (count) =>
      `${count} exercise${count === 1 ? "" : "s"} completed`,
    effort: "Effort",
    painAfterLabel: "Pain after",
    viewProgress: "View progress",
    completionSafetyNote:
      "If you feel sharp or unusual pain during exercises, stop immediately and contact your therapist.",
    sessionSavedForReview:
      "Your session response has been saved. Your therapist can review what you reported.",
    wellDone: "Well done.",
    progressUpdated: "Your progress has been updated for your therapist to review.",
    alreadyCompleted: "Session already completed",
    finishedExercisesInSession: (count) =>
      `You finished ${count} exercise${count === 1 ? "" : "s"} in this session.`,
    completedOn: (when) => ` Completed ${when}.`,
    noRepeatNeeded:
      "Your therapist can review your progress on the plan dashboard. You do not need to repeat this session.",
    saveError: "Could not save session. Please try again.",
    sharpPainFooter:
      "If you feel sharp or unusual pain during exercises, stop immediately and contact your therapist.",
  },
  ar: {
    sessionNotFound: "الجلسة غير موجودة.",
    backToPlan: "← خطتك",
    backToMyPlan: "← العودة إلى خطتي",
    todaysRehabGoal: "هدف تأهيل اليوم",
    todaysGoal: (title) =>
      title.trim()
        ? `أنجز «${title}» بلطف وأمان.`
        : "أنجز جلسة اليوم بلطف وأمان.",
    painBefore: "ما مستوى ألمك قبل البدء؟ (0 = لا يوجد، 10 = الأسوأ)",
    safetyQuestion: "هل تشعر بألم حاد أو دوخة أو أعراض غير معتادة اليوم؟",
    yes: "نعم",
    no: "لا",
    startSession: "بدء الجلسة",
    safetyStopTitle: "توقّف وتواصل مع معالجك قبل البدء.",
    safetyAcknowledge: "سأتواصل مع معالجك قبل المتابعة",
    therapistReviewNote: "سيراجع معالجك ألمك ومجهودك واستجابتك للجلسة.",
    nextExercise: "← التمرين التالي",
    previousExercise: "التمرين السابق →",
    completeSession: "إنهاء الجلسة",
    saving: "جاري الحفظ…",
    finalExerciseHint: "هذا آخر تمرين في هذه الجلسة.",
    effortQuestion: "كيف كان شعورك؟ (1 = سهل، 10 = صعب جداً)",
    painAfter: "ما مستوى ألمك بعد الجلسة؟ (0 = لا يوجد، 10 = الأسوأ)",
    optionalNoteLabel: "هل تريد إخبار معالجك بشيء؟ (اختياري)",
    optionalNotePlaceholder: "ملاحظة اختيارية لمعالجك…",
    finishHint: "اختر شعور الجلسة ومستوى الألم بعد التمرين لإنهاء الجلسة.",
    sessionComplete: "تم إكمال الجلسة",
    exercisesCompleted: (count) =>
      count === 1 ? "تمرين واحد مكتمل" : `${count} تمارين مكتملة`,
    effort: "المجهود",
    painAfterLabel: "الألم بعد الجلسة",
    viewProgress: "عرض التقدّم",
    completionSafetyNote:
      "إذا شعرت بألم حاد أو غير معتاد أثناء التمارين، توقّف فوراً وتواصل مع معالجك.",
    sessionSavedForReview:
      "تم حفظ استجابتك للجلسة. يمكن لمعالجك مراجعة ما قمت بتسجيله.",
    wellDone: "أحسنت.",
    progressUpdated: "تم تحديث تقدّمك ليراجعه معالجك.",
    alreadyCompleted: "الجلسة مكتملة مسبقاً",
    finishedExercisesInSession: (count) =>
      count === 1
        ? "أنجزت تمريناً واحداً في هذه الجلسة."
        : `أنجزت ${count} تمارين في هذه الجلسة.`,
    completedOn: (when) => ` اكتملت في ${when}.`,
    noRepeatNeeded:
      "يمكن لمعالجك مراجعة تقدّمك. لا حاجة لإعادة هذه الجلسة.",
    saveError: "تعذّر حفظ الجلسة. يرجى المحاولة مرة أخرى.",
    sharpPainFooter:
      "إذا شعرت بألم حاد أو غير معتاد أثناء التمارين، توقّف فوراً وتواصل مع معالجك.",
  },
};

/* ── Exercise card (Sprint 4) ──────────────────────────────────────────────── */

export type SessionExerciseUi = {
  exerciseOf: string;
  safetyBanner: string;
  whyThisMatters: string;
  stopIf: string;
  therapistNote: string;
  doseFallback: string;
  asPrescribed: string;
  exerciseFallback: string;
};

/* ── Exercise session flow (Sprint W-0) ───────────────────────────────────── */

export type SessionExerciseFlowUi = {
  sessionOverviewTitle: string;
  sessionOverviewBody: string;
  exercisesInSession: (count: number) => string;
  beginExercises: string;
  demoMediaPlaceholder: string;
  bodyRegionLabel: string;
  doseSets: string;
  doseReps: string;
  doseDuration: string;
  doseRest: string;
  doseNotSet: string;
  durationSeconds: (sec: number) => string;
  restSeconds: (sec: number) => string;
  startThisExercise: string;
  completeSet: string;
  setProgress: (done: number, total: number) => string;
  completeExercise: string;
  exerciseCompleteTitle: string;
  exerciseCompleteBody: string;
  nextExercise: string;
  takeYourTime: string;
  restBetweenSets: string;
  followTherapistPlan: string;
  stopSharpPain: string;
  therapistCanReview: string;
  sessionProgressLabel: string;
  inProgressLabel: string;
  sessionWrapUpTitle: string;
  continueToFinish: string;
  cvSavedForReview: string;
  cvNotSavedManual: string;
  cvPostErrorContinue: string;
  cvSaving: string;
  cvSavedCheck: string;
  cvSaveFailedSessionRecorded: string;
  cvHoldTooShort: string;
};

const BODY_REGION_PATIENT: Record<
  PatientPortalLanguage,
  Record<string, string>
> = {
  en: {
    knee: "Knee",
    lumbar: "Lower back",
    shoulder: "Shoulder",
    cervical: "Neck",
    ankle: "Ankle",
    hip: "Hip",
    general: "General",
  },
  ar: {
    knee: "الركبة",
    lumbar: "أسفل الظهر",
    shoulder: "الكتف",
    cervical: "الرقبة",
    ankle: "الكاحل",
    hip: "الورك",
    general: "عام",
  },
};

const SESSION_EXERCISE_FLOW_UI: Record<
  PatientPortalLanguage,
  SessionExerciseFlowUi
> = {
  en: {
    sessionOverviewTitle: "Session overview",
    sessionOverviewBody:
      "You will move through each exercise one at a time. Take your time and follow your therapist's plan.",
    exercisesInSession: (count) =>
      `${count} exercise${count === 1 ? "" : "s"} in this session`,
    beginExercises: "Begin exercises",
    demoMediaPlaceholder: "Demo media placeholder",
    bodyRegionLabel: "Body region",
    doseSets: "Sets",
    doseReps: "Reps",
    doseDuration: "Duration",
    doseRest: "Rest",
    doseNotSet: "—",
    durationSeconds: (sec) => `${sec}s`,
    restSeconds: (sec) => `${sec}s rest`,
    startThisExercise: "Start this exercise",
    completeSet: "Complete set",
    setProgress: (done, total) => `Set ${done} of ${total}`,
    completeExercise: "Complete exercise",
    exerciseCompleteTitle: "Exercise complete",
    exerciseCompleteBody: "Take a short rest before the next exercise when you are ready.",
    nextExercise: "Next exercise",
    takeYourTime: "Take your time",
    restBetweenSets: "Rest between sets",
    followTherapistPlan: "Follow your therapist's plan",
    stopSharpPain: "Stop if you feel sharp or unusual pain",
    therapistCanReview: "Your therapist can review your progress",
    sessionProgressLabel: "Session progress",
    inProgressLabel: "In progress",
    sessionWrapUpTitle: "Finish your session",
    continueToFinish: "Continue to finish session",
    cvSavedForReview: "Camera result saved for therapist review.",
    cvNotSavedManual: "Camera result not saved — session completed manually.",
    cvPostErrorContinue: "Could not save camera result — you can continue.",
    cvSaving: "Saving camera result…",
    cvSavedCheck: "Camera result saved ✓",
    cvSaveFailedSessionRecorded:
      "Camera data could not be saved — your session is still recorded",
    cvHoldTooShort:
      "Hold time was under 3 seconds, so camera metrics were not saved.",
  },
  ar: {
    sessionOverviewTitle: "نظرة على الجلسة",
    sessionOverviewBody:
      "ستنتقل من تمرين إلى آخر. خذ وقتك واتبع خطة معالجك.",
    exercisesInSession: (count) =>
      count === 1 ? "تمرين واحد في هذه الجلسة" : `${count} تمارين في هذه الجلسة`,
    beginExercises: "بدء التمارين",
    demoMediaPlaceholder: "عنصر توضيحي للعرض التجريبي",
    bodyRegionLabel: "منطقة الجسم",
    doseSets: "مجموعات",
    doseReps: "تكرارات",
    doseDuration: "المدة",
    doseRest: "راحة",
    doseNotSet: "—",
    durationSeconds: (sec) => `${sec} ث`,
    restSeconds: (sec) => `راحة ${sec} ث`,
    startThisExercise: "بدء هذا التمرين",
    completeSet: "إكمال المجموعة",
    setProgress: (done, total) => `المجموعة ${done} من ${total}`,
    completeExercise: "إكمال التمرين",
    exerciseCompleteTitle: "اكتمل التمرين",
    exerciseCompleteBody: "خذ راحة قصيرة قبل التمرين التالي عندما تكون مستعداً.",
    nextExercise: "التمرين التالي",
    takeYourTime: "خذ وقتك",
    restBetweenSets: "راحة بين المجموعات",
    followTherapistPlan: "اتبع خطة معالجك",
    stopSharpPain: "توقّف عند الشعور بألم حاد أو غير معتاد",
    therapistCanReview: "يمكن لمعالجك مراجعة تقدّمك",
    sessionProgressLabel: "تقدّم الجلسة",
    inProgressLabel: "قيد التنفيذ",
    sessionWrapUpTitle: "إنهاء الجلسة",
    continueToFinish: "متابعة لإنهاء الجلسة",
    cvSavedForReview: "تم حفظ نتيجة الكاميرا لمراجعة المعالج.",
    cvNotSavedManual: "لم يتم حفظ نتيجة الكاميرا — تم إكمال الجلسة يدويًا.",
    cvPostErrorContinue: "تعذر حفظ نتيجة الكاميرا — يمكنك المتابعة.",
    cvSaving: "جاري حفظ نتيجة الكاميرا…",
    cvSavedCheck: "تم حفظ نتيجة الكاميرا ✓",
    cvSaveFailedSessionRecorded: "تعذر حفظ بيانات الكاميرا — تم تسجيل جلستك",
    cvHoldTooShort:
      "مدة الثبات أقل من 3 ثوانٍ، لذلك لم تُحفظ مقاييس الكاميرا.",
  },
};

/** Patient notice after parent-owned CV save on exercise completion. */
export function cvSessionCapturePatientMessage(
  lang: PatientPortalLanguage,
  result: CvSaveResult,
  exerciseId?: string,
): string | null {
  if (result === "not_applicable") return null;
  const ui = sessionExerciseFlowUi(lang);
  if (result === "saved" || result === "already_saved") return ui.cvSavedCheck;
  if (result === "post_error") return ui.cvSaveFailedSessionRecorded;
  if (result === "too_short" && isHoldClassCvExercise(exerciseId)) {
    return ui.cvHoldTooShort;
  }
  return ui.cvNotSavedManual;
}

export function cvSessionCaptureSavingMessage(lang: PatientPortalLanguage): string {
  return sessionExerciseFlowUi(lang).cvSaving;
}

/** Patient notice after Complete exercise when optional CV ran or was eligible. */
export function cvSaveOutcomePatientMessage(
  lang: PatientPortalLanguage,
  outcome: CvSaveOutcome,
): string | null {
  if (outcome === "not_applicable") return null;
  if (outcome === "saved" || outcome === "already_saved") {
    return sessionExerciseFlowUi(lang).cvSavedForReview;
  }
  if (outcome === "post_error") {
    return sessionExerciseFlowUi(lang).cvPostErrorContinue;
  }
  return sessionExerciseFlowUi(lang).cvNotSavedManual;
}

export function sessionExerciseFlowUi(
  lang: PatientPortalLanguage,
): SessionExerciseFlowUi {
  return SESSION_EXERCISE_FLOW_UI[lang];
}

export function formatBodyRegionForPatient(
  lang: PatientPortalLanguage,
  region: string | undefined,
): string | null {
  if (!region?.trim()) return null;
  return BODY_REGION_PATIENT[lang][region] ?? region;
}

/* ── Exercise media area (Sprint MEDIA-1) ─────────────────────────────────── */

export type ExerciseMediaUi = {
  movementGuideTitle: string;
  movementGuideSubtitle: string;
  followTherapistInstructions: string;
  mediaAlt: (name: string) => string;
};

const EXERCISE_MEDIA_UI: Record<PatientPortalLanguage, ExerciseMediaUi> = {
  en: {
    movementGuideTitle: "Movement guide",
    movementGuideSubtitle: "Review the movement before you start",
    followTherapistInstructions: "Follow your therapist's instructions",
    mediaAlt: (name) => (name.trim() ? `Exercise guide: ${name}` : "Exercise guide"),
  },
  ar: {
    movementGuideTitle: "دليل الحركة",
    movementGuideSubtitle: "راجع الحركة قبل بدء التمرين",
    followTherapistInstructions: "اتبع تعليمات معالجك",
    mediaAlt: (name) => (name.trim() ? `دليل التمرين: ${name}` : "دليل التمرين"),
  },
};

export function exerciseMediaUi(lang: PatientPortalLanguage): ExerciseMediaUi {
  return EXERCISE_MEDIA_UI[lang];
}

const SESSION_EXERCISE_UI: Record<PatientPortalLanguage, SessionExerciseUi> = {
  en: {
    exerciseOf: "Exercise {current} of {total}",
    safetyBanner:
      "Move slowly and stop if you feel sharp pain, dizziness, or unusual symptoms.",
    whyThisMatters: "Why this matters:",
    stopIf: "Stop if:",
    therapistNote: "Note from your therapist:",
    doseFallback: "As prescribed by your therapist",
    asPrescribed: "As prescribed by your therapist",
    exerciseFallback: "Exercise",
  },
  ar: {
    exerciseOf: "التمرين {current} من {total}",
    safetyBanner:
      "تحرّك ببطء وتوقّف إذا شعرت بألم حاد أو دوخة أو أعراض غير معتادة.",
    whyThisMatters: "لماذا هذا مهم:",
    stopIf: "توقّف إذا:",
    therapistNote: "ملاحظة من معالجك:",
    doseFallback: "حسب ما وصفه معالجك",
    asPrescribed: "حسب ما وصفه معالجك",
    exerciseFallback: "تمرين",
  },
};

const CLINICAL_ACTION_AR: Record<ClinicalActionStatus, string> = {
  needs_review:
    "تمت إشارة استجابتك لمراجعة المعالج. إذا شعرت بأعراض غير معتادة، تواصل مع معالجك.",
  pain_increase:
    "أبلغت عن زيادة في الألم بعد هذه الجلسة. ارتح كما يلزم وتواصل مع معالجك إذا استمر الألم.",
  high_effort:
    "كانت هذه الجلسة صعبة. تحرّك بلطف وأخبر معالجك إذا استمر ذلك.",
  adherence_follow_up:
    "لاحظنا أنك قد تكون فاتتك جلسات. يمكن لمعالجك مساعدتك على العودة للمسار.",
  ready_for_progression_review:
    "أكملت عدة جلسات. سيراجع معالجك ما إذا كان ينبغي تحديث خطتك.",
  stable: "عمل رائع. تم حفظ استجاباتك ليراجعها معالجك.",
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

export function planHomeUi(lang: PatientPortalLanguage): PlanHomeUi {
  return PLAN_HOME[lang];
}

export function sessionShellUi(lang: PatientPortalLanguage): SessionShellUi {
  return SESSION_SHELL[lang];
}

export function sessionExerciseUi(lang: PatientPortalLanguage): SessionExerciseUi {
  return SESSION_EXERCISE_UI[lang];
}

export function getPortalGreeting(lang: PatientPortalLanguage): string {
  const h = new Date().getHours();
  const ui = planHomeUi(lang);
  if (h < 12) return ui.goodMorning;
  if (h < 18) return ui.goodAfternoon;
  return ui.goodEvening;
}

export function formatExerciseProgress(
  lang: PatientPortalLanguage,
  current: number,
  total: number,
): string {
  return sessionExerciseUi(lang).exerciseOf
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

export function localizeScheduleLabel(
  label: string,
  lang: PatientPortalLanguage,
): string {
  if (lang !== "ar") return label;
  const week = /^Week (\d+)$/.exec(label);
  if (week) return `الأسبوع ${week[1]}`;
  const day = /^Day (\d+)$/.exec(label);
  if (day) return `اليوم ${day[1]}`;
  if (label.startsWith("Week of ")) {
    return label.replace("Week of ", "أسبوع ");
  }
  return label;
}

export function formatSessionDisplayTitle(
  sessionNumber: number,
  title: string,
  lang: PatientPortalLanguage,
): string {
  const trimmed = title.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith(`session ${sessionNumber}`)) return title;
  if (lang === "ar") return `الجلسة ${sessionNumber} — ${title}`;
  return `Session ${sessionNumber} — ${title}`;
}

export function localizeClinicalActionMessage(
  status: ClinicalActionStatus,
  lang: PatientPortalLanguage,
  englishMessage: string,
): string {
  if (lang !== "ar") return englishMessage;
  return CLINICAL_ACTION_AR[status] ?? englishMessage;
}

export function portalTextDir(lang: PatientPortalLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

/* ── Progress page ─────────────────────────────────────────────────────────── */

export type ProgressPageUi = {
  loading: string;
  loadError: string;
  connectionError: string;
  planNotFound: string;
  backToPlan: string;
  pageTitle: string;
  pageSubtitle: string;
  sessionsCompleted: string;
  progress: string;
  adherence: string;
  averageEffort: string;
  latestPain: string;
  inYourPlan: string;
  completionRate: string;
  selfReported: string;
  notRecordedYet: string;
  keepGoing: string;
  overallProgress: string;
  sessionHistory: string;
  completeFirstSession: string;
  clinicalReviewNote: string;
  latestPainScore: string;
  noteFromTherapist: string;
  sessionLabel: (n: number) => string;
  completedStatus: string;
  notCompletedStatus: string;
  painAfterSession: string;
  effort: string;
  noteToTherapist: string;
  noSessionDataYet: string;
  exercisesCompleted: (count: number) => string;
  contextNotice: string;
  lastReportedIndicators: string;
  lastReportedPain: (score: number) => string;
  lastReportedEffort: (score: number) => string;
  lastReportedTherapistNote: string;
};

const PROGRESS_PAGE: Record<PatientPortalLanguage, ProgressPageUi> = {
  en: {
    loading: "Loading…",
    loadError: "Unable to load progress data. Please try again.",
    connectionError: "Connection error. Please check your connection and try again.",
    planNotFound: "Plan not found.",
    backToPlan: "← Back to my plan",
    pageTitle: "Your Rehabilitation Progress",
    pageSubtitle:
      "Progress is updated after each completed session. Your therapist reviews this regularly.",
    sessionsCompleted: "Sessions completed",
    progress: "Progress",
    adherence: "Adherence",
    averageEffort: "Average effort",
    latestPain: "Latest pain",
    inYourPlan: "in your plan",
    completionRate: "completion rate",
    selfReported: "self-reported",
    notRecordedYet: "not recorded yet",
    keepGoing: "Keep going — your progress builds as you complete more sessions.",
    overallProgress: "Overall progress",
    sessionHistory: "Session history",
    completeFirstSession: "Complete your first session to see your timeline.",
    clinicalReviewNote: "Detailed clinical progress will be reviewed by your therapist.",
    latestPainScore: "Latest pain score",
    noteFromTherapist: "Note from your therapist",
    sessionLabel: (n) => `Session ${n}`,
    completedStatus: "Completed",
    notCompletedStatus: "Not completed",
    painAfterSession: "Pain after session",
    effort: "Effort",
    noteToTherapist: "Note to your therapist",
    noSessionDataYet: "No session data recorded yet.",
    exercisesCompleted: (count) =>
      `${count} exercise${count === 1 ? "" : "s"} completed`,
    contextNotice:
      "This page reflects the sessions, pain, and effort you have reported. Your therapist uses this information together with clinical assessment to follow your rehabilitation journey.",
    lastReportedIndicators: "Last reported indicators",
    lastReportedPain: (score) => `Last reported pain: ${score}/10`,
    lastReportedEffort: (score) => `Last reported effort: ${score}/10`,
    lastReportedTherapistNote:
      "Your therapist reviews these indicators to follow your response to rehabilitation",
  },
  ar: {
    loading: "جاري التحميل…",
    loadError: "تعذّر تحميل بيانات التقدّم. يرجى المحاولة مرة أخرى.",
    connectionError: "خطأ في الاتصال. تحقّق من الشبكة وحاول مرة أخرى.",
    planNotFound: "الخطة غير موجودة.",
    backToPlan: "← العودة إلى خطتي",
    pageTitle: "تقدّمك في التأهيل",
    pageSubtitle:
      "يُحدَّث التقدّم بعد كل جلسة مكتملة. يراجع معالجك هذا بانتظام.",
    sessionsCompleted: "الجلسات المكتملة",
    progress: "التقدّم",
    adherence: "الالتزام",
    averageEffort: "متوسط الجهد",
    latestPain: "آخر مستوى ألم",
    inYourPlan: "في خطتك",
    completionRate: "نسبة الإكمال",
    selfReported: "حسب تقريرك",
    notRecordedYet: "لم يُسجَّل بعد",
    keepGoing: "واصل — يتكوّن تقدّمك مع كل جلسة تكملها.",
    overallProgress: "التقدّم الإجمالي",
    sessionHistory: "سجل الجلسات",
    completeFirstSession: "أكمل جلستك الأولى لعرض الجدول الزمني.",
    clinicalReviewNote: "سيراجع معالجك التقدّم السريري التفصيلي.",
    latestPainScore: "آخر درجة ألم",
    noteFromTherapist: "ملاحظة من معالجك",
    sessionLabel: (n) => `الجلسة ${n}`,
    completedStatus: "مكتملة",
    notCompletedStatus: "غير مكتملة",
    painAfterSession: "الألم بعد الجلسة",
    effort: "الجهد",
    noteToTherapist: "ملاحظة للمُعالج",
    noSessionDataYet: "لا توجد بيانات مسجّلة لهذه الجلسة بعد.",
    exercisesCompleted: (count) =>
      count === 1 ? "تمرين واحد مكتمل" : `${count} تمارين مكتملة`,
    contextNotice:
      "تعكس هذه الصفحة ما قمت بتسجيله من جلسات، ألم، وجهد. يستخدم معالجك هذه المعلومات مع تقييمه السريري لمتابعة رحلتك التأهيلية.",
    lastReportedIndicators: "آخر مؤشرات مُبلَّغ عنها",
    lastReportedPain: (score) => `آخر ألم مُبلَّغ عنه: ${score}/10`,
    lastReportedEffort: (score) => `آخر جهد مُبلَّغ عنه: ${score}/10`,
    lastReportedTherapistNote:
      "يقوم معالجك بمراجعة هذه المؤشرات لمتابعة استجابتك للتأهيل",
  },
};

/* ── Token layout ──────────────────────────────────────────────────────────── */

export type TokenLayoutUi = {
  assignedBy: (name: string) => string;
};

const TOKEN_LAYOUT: Record<PatientPortalLanguage, TokenLayoutUi> = {
  en: {
    assignedBy: (name) => `Assigned by ${name}`,
  },
  ar: {
    assignedBy: (name) => `موصى بها من ${name}`,
  },
};

export function progressPageUi(lang: PatientPortalLanguage): ProgressPageUi {
  return PROGRESS_PAGE[lang];
}

export function tokenLayoutUi(lang: PatientPortalLanguage): TokenLayoutUi {
  return TOKEN_LAYOUT[lang];
}

/* ── Trust footer & safety notice (Sprint D) ───────────────────────────────── */

export type TrustFooterUi = {
  privacy: string;
  terms: string;
  intendedUse: string;
  clinicalSafety: string;
};

export type PatientSafetyNoticeUi = {
  title: string;
  line1: string;
  line2: string;
  line3: string;
};

const TRUST_FOOTER: Record<PatientPortalLanguage, TrustFooterUi> = {
  en: {
    privacy: "Privacy",
    terms: "Terms",
    intendedUse: "Intended Use",
    clinicalSafety: "Clinical Safety",
  },
  ar: {
    privacy: "الخصوصية",
    terms: "الشروط",
    intendedUse: "الاستخدام المقصود",
    clinicalSafety: "السلامة السريرية",
  },
};

const PATIENT_SAFETY_NOTICE: Record<PatientPortalLanguage, PatientSafetyNoticeUi> = {
  en: {
    title: "Safety notice",
    line1:
      "Stop if you feel sharp pain, dizziness, chest pain, shortness of breath, or unusual symptoms.",
    line2: "Contact your therapist if symptoms worsen.",
    line3:
      "This platform supports your therapist's plan and does not replace clinical assessment.",
  },
  ar: {
    title: "تنبيه السلامة",
    line1: "توقّف إذا شعرت بألم حاد، دوخة، ألم في الصدر، ضيق تنفس، أو أعراض غير معتادة.",
    line2: "تواصل مع معالجك إذا زادت الأعراض.",
    line3: "هذه المنصة تدعم خطة معالجك ولا تستبدل التقييم السريري.",
  },
};

export function trustFooterUi(lang: PatientPortalLanguage): TrustFooterUi {
  return TRUST_FOOTER[lang];
}

export function patientSafetyNoticeUi(lang: PatientPortalLanguage): PatientSafetyNoticeUi {
  return PATIENT_SAFETY_NOTICE[lang];
}

/* ── Journey context card (Sprint G) ─────────────────────────────────────────── */

export type JourneyContextUi = {
  rehabGoalLabel: string;
  sessionsCompletedLabel: string;
  sessionsCompleted: (completed: number, total: number) => string;
  weekOfProgram: (week: number, totalWeeks: number) => string;
  lastReportedLabel: string;
  painScore: (score: number) => string;
  effortScore: (score: number) => string;
  lastReportedNote: string;
  clinicianNoteLabel: string;
  therapistVisibility: string;
};

const JOURNEY_CONTEXT: Record<PatientPortalLanguage, JourneyContextUi> = {
  en: {
    rehabGoalLabel: "Your rehabilitation goal",
    sessionsCompletedLabel: "Sessions completed",
    sessionsCompleted: (completed, total) =>
      `${completed} of ${total} session${total === 1 ? "" : "s"}`,
    weekOfProgram: (week, totalWeeks) => `Week ${week} of ${totalWeeks}`,
    lastReportedLabel: "Last reported",
    painScore: (score) => `Pain: ${score}/10`,
    effortScore: (score) => `Effort: ${score}/10`,
    lastReportedNote:
      "This information helps your therapist follow your rehabilitation journey",
    clinicianNoteLabel: "A note from your therapist",
    therapistVisibility: "Your therapist reviews what you report after each session",
  },
  ar: {
    rehabGoalLabel: "هدفك التأهيلي",
    sessionsCompletedLabel: "الجلسات المكتملة",
    sessionsCompleted: (completed, total) => `${completed} من ${total} جلسة`,
    weekOfProgram: (week, totalWeeks) => `الأسبوع ${week} من ${totalWeeks}`,
    lastReportedLabel: "آخر ما سجّلته",
    painScore: (score) => `الألم: ${score}/10`,
    effortScore: (score) => `الجهد: ${score}/10`,
    lastReportedNote: "هذه المعلومات تساعد معالجك في متابعة رحلتك التأهيلية",
    clinicianNoteLabel: "ملاحظة معالجك",
    therapistVisibility: "معالجك يطّلع على ما تسجّله بعد كل جلسة",
  },
};

export function journeyContextUi(lang: PatientPortalLanguage): JourneyContextUi {
  return JOURNEY_CONTEXT[lang];
}

/* ── Session focus & exercise safety (Sprint G) ──────────────────────────────── */

export type SessionFocusUi = {
  todaysSessionFocus: string;
  exerciseSafetyReminder: string;
};

const SESSION_FOCUS: Record<PatientPortalLanguage, SessionFocusUi> = {
  en: {
    todaysSessionFocus: "Today's session focus",
    exerciseSafetyReminder:
      "Stop if you feel sharp pain or unusual symptoms and contact your therapist",
  },
  ar: {
    todaysSessionFocus: "تركيز جلسة اليوم",
    exerciseSafetyReminder:
      "توقف إذا شعرت بألم حاد أو أعراض غير معتادة وتواصل مع معالجك",
  },
};

export function sessionFocusUi(lang: PatientPortalLanguage): SessionFocusUi {
  return SESSION_FOCUS[lang];
}

/* ── Motivation layer (Sprint V) ─────────────────────────────────────────────── */

export type MotivationUi = {
  todaysSessionStatus: string;
  todayReady: string;
  todayCompleted: string;
  allSessionsCompleteShort: string;
  completedSessionsCount: (completed: number, total: number) => string;
  remainingSessions: (remaining: number) => string;
  gentleEncouragementTitle: string;
  gentleEncouragementBody: string;
  followTherapistPlan: string;
  safetyReminderShort: string;
  preSessionComfort: string;
  greatEffort: string;
  youShowedUpToday: string;
  therapistCanReviewProgress: string;
  smallStepsConsistency: string;
  consistencyActiveDays: (days: number) => string;
  progressRemainingLabel: string;
};

const MOTIVATION: Record<PatientPortalLanguage, MotivationUi> = {
  en: {
    todaysSessionStatus: "Today's session",
    todayReady: "Your next session is ready when you are.",
    todayCompleted: "You completed a session today. Well done.",
    allSessionsCompleteShort: "You have completed all sessions in your current plan.",
    completedSessionsCount: (completed, total) =>
      `${completed} of ${total} session${total === 1 ? "" : "s"} completed`,
    remainingSessions: (remaining) =>
      `${remaining} session${remaining === 1 ? "" : "s"} remaining in your plan`,
    gentleEncouragementTitle: "Keep going at your pace",
    gentleEncouragementBody: "Small steps build consistency. Follow your therapist's instructions.",
    followTherapistPlan: "Follow your therapist's plan",
    safetyReminderShort:
      "Stop and contact your therapist if symptoms feel unusual.",
    preSessionComfort:
      "Move comfortably and stop if you feel unusual pain.",
    greatEffort: "Great effort",
    youShowedUpToday: "You showed up today",
    therapistCanReviewProgress: "Your therapist can review your progress",
    smallStepsConsistency: "Small steps build consistency",
    consistencyActiveDays: (days) =>
      days === 0
        ? "Complete a session to start building your routine."
        : days === 1
          ? "You were active on 1 day in the last 7 days."
          : `You were active on ${days} days in the last 7 days.`,
    progressRemainingLabel: "Sessions remaining",
  },
  ar: {
    todaysSessionStatus: "جلسة اليوم",
    todayReady: "جلستك التالية جاهزة عندما تكون مستعداً.",
    todayCompleted: "أكملت جلسة اليوم. أحسنت.",
    allSessionsCompleteShort: "أكملت جميع جلسات خطتك الحالية.",
    completedSessionsCount: (completed, total) => `${completed} من ${total} جلسات مكتملة`,
    remainingSessions: (remaining) =>
      remaining === 1
        ? "جلسة واحدة متبقية في خطتك"
        : `${remaining} جلسات متبقية في خطتك`,
    gentleEncouragementTitle: "واصل على وتيرتك",
    gentleEncouragementBody: "الخطوات الصغيرة تبني الاستمرارية. اتبع تعليمات معالجك.",
    followTherapistPlan: "اتبع خطة معالجك",
    safetyReminderShort: "توقّف وتواصل مع معالجك إذا شعرت بأعراض غير معتادة.",
    preSessionComfort: "تحرّك براحة وتوقّف إذا شعرت بألم غير معتاد.",
    greatEffort: "جهد رائع",
    youShowedUpToday: "حضرت اليوم",
    therapistCanReviewProgress: "يمكن لمعالجك مراجعة تقدّمك",
    smallStepsConsistency: "الخطوات الصغيرة تبني الاستمرارية",
    consistencyActiveDays: (days) =>
      days === 0
        ? "أكمل جلسة لبدء روتينك."
        : days === 1
          ? "كنت نشطاً يوماً واحداً خلال الأيام السبعة الماضية."
          : `كنت نشطاً ${days} أيام خلال الأيام السبعة الماضية.`,
    progressRemainingLabel: "الجلسات المتبقية",
  },
};

export function motivationUi(lang: PatientPortalLanguage): MotivationUi {
  return MOTIVATION[lang];
}

/* ── Clinician adherence summary (Sprint V) ──────────────────────────────────── */

export type ClinicianAdherenceSummaryUi = {
  title: string;
  forClinicianReview: string;
  completedSessions: string;
  notCompletedSessions: string;
  lastPatientActivity: string;
  noActivityYet: string;
  derivedFromSessionsOnly: string;
};

const CLINICIAN_ADHERENCE_SUMMARY: Record<PatientPortalLanguage, ClinicianAdherenceSummaryUi> = {
  en: {
    title: "Session activity summary",
    forClinicianReview: "For clinician review",
    completedSessions: "Completed sessions",
    notCompletedSessions: "Not completed",
    lastPatientActivity: "Last patient activity",
    noActivityYet: "No session activity recorded yet",
    derivedFromSessionsOnly: "Counts are based on plan session status only. Not a clinical assessment.",
  },
  ar: {
    title: "ملخص نشاط الجلسات",
    forClinicianReview: "لمراجعة المعالج",
    completedSessions: "الجلسات المكتملة",
    notCompletedSessions: "غير مكتملة",
    lastPatientActivity: "آخر نشاط للمريض",
    noActivityYet: "لا يوجد نشاط جلسات مسجّل بعد",
    derivedFromSessionsOnly: "الأرقام مبنية على حالة جلسات الخطة فقط. ليست تقييماً سريرياً.",
  },
};

export function clinicianAdherenceSummaryUi(lang: PatientPortalLanguage): ClinicianAdherenceSummaryUi {
  return CLINICIAN_ADHERENCE_SUMMARY[lang];
}

export function isDescriptiveSessionTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (/^Session\s+\d+(\s*[—–-]\s*)?$/i.test(t)) return false;
  if (/^الجلسة\s+\d+(\s*[—–-]\s*)?$/i.test(t)) return false;
  return true;
}

export function resolveSessionFocusPurpose(
  sessionTitle: string,
  patientFriendlyGoal: string | null | undefined,
): string | null {
  if (isDescriptiveSessionTitle(sessionTitle)) return sessionTitle.trim();
  const goal = patientFriendlyGoal?.trim();
  if (goal) return goal;
  return null;
}

export function getLatestReportedScores(
  logs: { painScore: number | null; effortScore: number | null; completedAt: string }[],
): { painScore: number | null; effortScore: number | null } | null {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  for (const log of sorted) {
    if (log.painScore != null || log.effortScore != null) {
      return { painScore: log.painScore, effortScore: log.effortScore };
    }
  }
  return null;
}

export function formatPortalDate(
  iso: string,
  lang: PatientPortalLanguage,
): string {
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
