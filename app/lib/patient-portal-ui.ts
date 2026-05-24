import type { ClinicalActionStatus } from "@/app/lib/clinical-action-engine";
import type { PatientExerciseLanguage } from "@/app/lib/exercise-resolve";

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
