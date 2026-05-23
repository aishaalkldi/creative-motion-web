/**
 * Patient assessment copy — bilingual config for remote patient link only.
 * Clinician UI always uses English via clinicianText().
 */
import type { PatientAssessmentDraft, PatientSectionId } from "./api/remote-assessments";

export type LocalizedText = { en: string; ar: string };
export type PatientLang = "en" | "ar";

export function patientText(text: LocalizedText, lang: PatientLang): string {
  return lang === "ar" ? text.ar : text.en;
}

/** Clinician-facing pages always use English. */
export function clinicianText(text: LocalizedText): string {
  return text.en;
}

export const PATIENT_SECTION_TITLES: Record<PatientSectionId, LocalizedText> = {
  pain:       { en: "Pain & Symptoms",       ar: "الألم والأعراض" },
  rom:        { en: "Movement Range",        ar: "مدى الحركة" },
  strength:   { en: "Strength & Activity",   ar: "القوة والنشاط" },
  balance:    { en: "Balance",               ar: "التوازن" },
  gait:       { en: "Walking & Gait",        ar: "المشي والخطوة" },
  functional: { en: "Daily Activities",      ar: "الأنشطة اليومية" },
};

export const PATIENT_SECTION_LABELS_EN: Record<PatientSectionId, string> = Object.fromEntries(
  (Object.entries(PATIENT_SECTION_TITLES) as [PatientSectionId, LocalizedText][]).map(
    ([id, t]) => [id, t.en],
  ),
) as Record<PatientSectionId, string>;

export type PatientQuestionField = {
  key: string;
  text: LocalizedText;
  hint?: LocalizedText;
  placeholder?: LocalizedText;
  kind: "textarea" | "text" | "painScale";
  rows?: number;
};

export const PATIENT_SECTION_QUESTIONS: Record<PatientSectionId, PatientQuestionField[]> = {
  pain: [
    {
      key: "chiefComplaint",
      kind: "textarea",
      text: {
        en: "What is your main complaint or reason for this assessment?",
        ar: "ما هي شكواك الرئيسية أو سبب هذا التقييم؟",
      },
      placeholder: {
        en: "e.g. Pain in my right knee after running…",
        ar: "مثال: ألم في الركبة اليمنى بعد الجري…",
      },
    },
    {
      key: "painLocation",
      kind: "text",
      text: {
        en: "Where do you feel the pain or discomfort?",
        ar: "أين تشعر بالألم أو الانزعاج؟",
      },
      placeholder: {
        en: "e.g. Right knee, outer side",
        ar: "مثال: الركبة اليمنى، الجانب الخارجي",
      },
    },
    {
      key: "painScore",
      kind: "painScale",
      text: {
        en: "Right now, how would you rate your pain? (0 = no pain, 10 = worst)",
        ar: "كيف تقيّم مستوى ألمك الآن؟ (٠ = لا ألم، ١٠ = أسوأ ألم)",
      },
    },
    {
      key: "aggravating",
      kind: "textarea",
      text: {
        en: "What makes the pain worse?",
        ar: "ما الذي يزيد الألم سوءًا؟",
      },
      hint: {
        en: "Activities, positions, or times of day that increase your symptoms",
        ar: "الأنشطة أو الوضعيات أو أوقات اليوم التي تزيد الأعراض",
      },
      placeholder: {
        en: "e.g. Going up stairs, sitting for long periods…",
        ar: "مثال: صعود السلالم، الجلوس لفترات طويلة…",
      },
    },
    {
      key: "easing",
      kind: "textarea",
      text: {
        en: "What helps relieve the pain?",
        ar: "ما الذي يساعد على تخفيف الألم؟",
      },
      placeholder: {
        en: "e.g. Rest, ice, gentle movement…",
        ar: "مثال: الراحة، الثلج، الحركة الخفيفة…",
      },
    },
    {
      key: "dailyImpact",
      kind: "textarea",
      rows: 4,
      text: {
        en: "How does this affect your daily life?",
        ar: "كيف يؤثر هذا على حياتك اليومية؟",
      },
      hint: {
        en: "Work, exercise, sleep, hobbies — what can you no longer do comfortably?",
        ar: "العمل، التمارين، النوم، الهوايات — ما الذي لم تعد تستطيع فعله بارتياح؟",
      },
      placeholder: {
        en: "e.g. I can no longer jog or play with my kids…",
        ar: "مثال: لم أعد أستطيع الجري أو اللعب مع أطفالي…",
      },
    },
    {
      key: "goals",
      kind: "textarea",
      text: {
        en: "What are your goals for this rehabilitation?",
        ar: "ما هي أهدافك من هذا البرنامج التأهيلي؟",
      },
      placeholder: {
        en: "e.g. Return to football, walk without pain…",
        ar: "مثال: العودة لكرة القدم، المشي دون ألم…",
      },
    },
  ],
  rom: [
    {
      key: "limitations",
      kind: "textarea",
      rows: 4,
      text: {
        en: "Describe any movements that feel restricted or limited",
        ar: "صف أي حركات تشعر أنها مقيدة أو محدودة",
      },
      hint: {
        en: "Think about bending, reaching, turning, or straightening your joints",
        ar: "فكّر في الانحناء، الوصول، الدوران، أو استقامة المفاصل",
      },
      placeholder: {
        en: "e.g. I can't fully bend my knee past 90°…",
        ar: "مثال: لا أستطيع ثني الركبة بالكامل أكثر من ٩٠ درجة…",
      },
    },
    {
      key: "worseWith",
      kind: "textarea",
      text: {
        en: "Are there any movements that make your symptoms worse?",
        ar: "هل توجد حركات تزيد أعراضك سوءًا؟",
      },
      placeholder: {
        en: "e.g. Reaching overhead causes shoulder pain…",
        ar: "مثال: رفع الذراع فوق الرأس يسبب ألمًا في الكتف…",
      },
    },
  ],
  strength: [
    {
      key: "weaknessDescription",
      kind: "textarea",
      rows: 4,
      text: {
        en: "Do you notice any weakness in your muscles or limbs?",
        ar: "هل تلاحظ أي ضعف في عضلاتك أو أطرافك؟",
      },
      hint: {
        en: "Where do you feel weak, and during which activities?",
        ar: "أين تشعر بالضعف، وخلال أي أنشطة؟",
      },
      placeholder: {
        en: "e.g. My left leg feels weak when climbing stairs…",
        ar: "مثال: أشعر بضعف في ساقي اليسرى عند صعود السلالم…",
      },
    },
    {
      key: "activitiesAffected",
      kind: "textarea",
      text: {
        en: "Which activities are most affected by this weakness?",
        ar: "ما الأنشطة الأكثر تأثرًا بهذا الضعف؟",
      },
      placeholder: {
        en: "e.g. Carrying groceries, lifting objects…",
        ar: "مثال: حمل البقالة، رفع الأشياء…",
      },
    },
  ],
  balance: [
    {
      key: "difficultyDescription",
      kind: "textarea",
      rows: 4,
      text: {
        en: "Do you have any difficulty with balance or stability?",
        ar: "هل تواجه صعوبة في التوازن أو الثبات؟",
      },
      hint: {
        en: "Standing, turning, uneven surfaces, or low-light environments",
        ar: "الوقوف، الدوران، الأسطح غير المستوية، أو الإضاءة المنخفضة",
      },
      placeholder: {
        en: "e.g. I feel unsteady when standing on one leg…",
        ar: "مثال: أشعر بعدم الثبات عند الوقوف على ساق واحدة…",
      },
    },
    {
      key: "fallHistory",
      kind: "text",
      text: {
        en: "Have you had any falls in the past 6 months?",
        ar: "هل تعرضت لأي سقوط خلال الأشهر الستة الماضية؟",
      },
      placeholder: {
        en: "e.g. No falls / 2 falls in the past 3 months…",
        ar: "مثال: لا سقوط / سقوطان خلال ٣ أشهر…",
      },
    },
  ],
  gait: [
    {
      key: "walkingDescription",
      kind: "textarea",
      rows: 4,
      text: {
        en: "Describe how you walk and any difficulties you notice",
        ar: "صف كيفية مشيك وأي صعوبات تلاحظها",
      },
      hint: {
        en: "Limping, pain while walking, uneven steps, fatigue after short distances",
        ar: "العرج، الألم أثناء المشي، خطوات غير متساوية، التعب بعد مسافات قصيرة",
      },
      placeholder: {
        en: "e.g. I limp on my right leg, especially after the first few steps…",
        ar: "مثال: أعرج على ساقي اليمنى، خاصة بعد الخطوات الأولى…",
      },
    },
    {
      key: "aids",
      kind: "text",
      text: {
        en: "Do you use any walking aids? (crutches, cane, brace, etc.)",
        ar: "هل تستخدم أي وسائل مساعدة للمشي؟ (عكازات، عصا، دعامة، إلخ)",
      },
      placeholder: {
        en: "e.g. None / Right knee brace / Crutches",
        ar: "مثال: لا شيء / دعامة للركبة اليمنى / عكازات",
      },
    },
  ],
  functional: [
    {
      key: "standingDuration",
      kind: "text",
      text: {
        en: "How long can you stand comfortably without sitting down?",
        ar: "كم من الوقت تستطيع الوقوف بارتياح دون الجلوس؟",
      },
      placeholder: {
        en: "e.g. 5 minutes / 30 minutes / all day",
        ar: "مثال: ٥ دقائق / ٣٠ دقيقة / طوال اليوم",
      },
    },
    {
      key: "walkingDistance",
      kind: "text",
      text: {
        en: "How far can you walk before pain or discomfort stops you?",
        ar: "ما المسافة التي تستطيع المشي قبل أن يوقفك الألم أو الانزعاج؟",
      },
      placeholder: {
        en: "e.g. 100 metres / 2 blocks / unlimited",
        ar: "مثال: ١٠٠ متر / مبنيان / بلا حدود",
      },
    },
    {
      key: "stairsAbility",
      kind: "text",
      text: {
        en: "Can you climb stairs? If yes, how difficult is it?",
        ar: "هل تستطيع صعود السلالم؟ إن نعم، ما مدى الصعوبة؟",
      },
      placeholder: {
        en: "e.g. Yes but slowly / One step at a time / Not at all",
        ar: "مثال: نعم لكن ببطء / خطوة بخطوة / لا أستطيع",
      },
    },
    {
      key: "otherNotes",
      kind: "textarea",
      rows: 3,
      text: {
        en: "Anything else you would like your therapist to know?",
        ar: "هل توجد أي معلومات إضافية تود مشاركتها مع المعالج؟",
      },
      placeholder: {
        en: "Any other symptoms, concerns, or important context…",
        ar: "أي أعراض أو مخاوف أو معلومات مهمة أخرى…",
      },
    },
  ],
};

/** Patient-facing UI strings (consent, navigation, review). */
export const PATIENT_UI = {
  painScaleMin: { en: "No pain", ar: "لا ألم" } satisfies LocalizedText,
  painScaleMax: { en: "Worst pain", ar: "أسوأ ألم" } satisfies LocalizedText,
  remoteAssessment: { en: "Remote Assessment", ar: "تقييم عن بُعد" } satisfies LocalizedText,
  sectionOf: { en: "of", ar: "من" } satisfies LocalizedText,
  sections: { en: "sections", ar: "أقسام" } satisfies LocalizedText,
  yourRemoteAssessment: { en: "Your Remote Assessment", ar: "تقييمك عن بُعد" } satisfies LocalizedText,
  welcomeBody: {
    en: "Your healthcare provider has sent you this assessment to complete from home. Your answers will help them personalise your treatment plan.",
    ar: "أرسل لك مقدم الرعاية الصحية هذا التقييم لإكماله من المنزل. ستساعد إجاباتك في تخصيص خطة العلاج الخاصة بك.",
  } satisfies LocalizedText,
  linkExpires: { en: "This link expires in", ar: "ينتهي هذا الرابط خلال" } satisfies LocalizedText,
  days: { en: "days", ar: "أيام" } satisfies LocalizedText,
  autoSaveProgress: {
    en: "Your progress is saved automatically.",
    ar: "يتم حفظ تقدمك تلقائيًا.",
  } satisfies LocalizedText,
  assessmentCovers: { en: "This assessment covers", ar: "يغطي هذا التقييم" } satisfies LocalizedText,
  consentLabel: {
    en: "I confirm the information I provide is accurate to the best of my knowledge, and I consent to sharing it with my healthcare provider for treatment purposes.",
    ar: "أؤكد أن المعلومات التي أقدمها دقيقة على حد علمي، وأوافق على مشاركتها مع مقدم الرعاية الصحية لأغراض العلاج.",
  } satisfies LocalizedText,
  disclaimer: {
    en: "This assessment is not a medical diagnosis. Your answers will be reviewed by a qualified healthcare professional.",
    ar: "هذا التقييم ليس تشخيصًا طبيًا. ستتم مراجعة إجاباتك من قبل مختص رعاية صحية مؤهل.",
  } satisfies LocalizedText,
  beginAssessment: { en: "Begin Assessment →", ar: "بدء التقييم ←" } satisfies LocalizedText,
  sectionHeader: { en: "Section", ar: "القسم" } satisfies LocalizedText,
  answerAccurately: {
    en: "Answer as accurately as you can. You can edit your answers on the review page.",
    ar: "أجب بأكبر قدر ممكن من الدقة. يمكنك تعديل إجاباتك في صفحة المراجعة.",
  } satisfies LocalizedText,
  previous: { en: "← Previous", ar: "السابق →" } satisfies LocalizedText,
  nextSection: { en: "Next Section →", ar: "القسم التالي ←" } satisfies LocalizedText,
  reviewAnswers: { en: "Review Answers →", ar: "مراجعة الإجابات ←" } satisfies LocalizedText,
  progressSaved: { en: "Your progress is saved automatically", ar: "يتم حفظ تقدمك تلقائيًا" } satisfies LocalizedText,
  reviewTitle: { en: "Review Your Answers", ar: "راجع إجاباتك" } satisfies LocalizedText,
  reviewSubtitle: {
    en: "Check your answers below. Click any section to go back and edit.",
    ar: "راجع إجاباتك أدناه. انقر على أي قسم للعودة والتعديل.",
  } satisfies LocalizedText,
  edit: { en: "Edit", ar: "تعديل" } satisfies LocalizedText,
  noInfo: { en: "No information provided", ar: "لم تُقدَّم معلومات" } satisfies LocalizedText,
  submitAssessment: { en: "Submit Assessment →", ar: "إرسال التقييم ←" } satisfies LocalizedText,
  submitting: { en: "Submitting…", ar: "جارٍ الإرسال…" } satisfies LocalizedText,
  submitOnceNote: {
    en: "Once submitted, you will not be able to edit your answers.",
    ar: "بعد الإرسال، لن تتمكن من تعديل إجاباتك.",
  } satisfies LocalizedText,
  sending: { en: "Sending your assessment to your therapist…", ar: "جارٍ إرسال تقييمك إلى المعالج…" } satisfies LocalizedText,
  linkUnavailable: { en: "This assessment link is no longer available.", ar: "رابط التقييم هذا لم يعد متاحًا." } satisfies LocalizedText,
  linkUnavailableBody: {
    en: "The link may have expired, already been submitted, or does not exist. Please contact your healthcare provider for a new link.",
    ar: "قد يكون الرابط منتهيًا أو مُرسَلًا مسبقًا أو غير موجود. يرجى التواصل مع مقدم الرعاية الصحية للحصول على رابط جديد.",
  } satisfies LocalizedText,
  verifying: { en: "Verifying assessment link…", ar: "جارٍ التحقق من رابط التقييم…" } satisfies LocalizedText,
  languageLabel: { en: "Language", ar: "اللغة" } satisfies LocalizedText,
} satisfies Record<string, LocalizedText>;

type FieldKey =
  | "chiefComplaint" | "painLocation" | "painScore" | "aggravating" | "easing" | "dailyImpact" | "goals"
  | "limitations" | "worseWith"
  | "weaknessDescription" | "activitiesAffected"
  | "difficultyDescription" | "fallHistory"
  | "walkingDescription" | "aids"
  | "standingDuration" | "walkingDistance" | "stairsAbility" | "otherNotes";

const FIELD_LABELS: Record<FieldKey, LocalizedText> = {
  chiefComplaint:        { en: "Main complaint",         ar: "الشكوى الرئيسية" },
  painLocation:          { en: "Pain location",          ar: "موقع الألم" },
  painScore:             { en: "Pain score",             ar: "درجة الألم" },
  aggravating:           { en: "Makes it worse",         ar: "ما يزيد الألم" },
  easing:                { en: "Provides relief",        ar: "ما يخفف الألم" },
  dailyImpact:           { en: "Daily impact",           ar: "التأثير اليومي" },
  goals:                 { en: "Goals",                  ar: "الأهداف" },
  limitations:           { en: "Movement limitations", ar: "قيود الحركة" },
  worseWith:             { en: "Worsened by",            ar: "يزداد مع" },
  weaknessDescription:   { en: "Weakness",               ar: "الضعف" },
  activitiesAffected:    { en: "Affected activities",    ar: "الأنشطة المتأثرة" },
  difficultyDescription: { en: "Balance difficulty",     ar: "صعوبة التوازن" },
  fallHistory:           { en: "Fall history",           ar: "تاريخ السقوط" },
  walkingDescription:    { en: "Walking pattern",        ar: "نمط المشي" },
  aids:                  { en: "Walking aids",           ar: "وسائل المساعدة" },
  standingDuration:      { en: "Standing tolerance",     ar: "تحمل الوقوف" },
  walkingDistance:       { en: "Walking distance",       ar: "مسافة المشي" },
  stairsAbility:         { en: "Stairs",                 ar: "السلالم" },
  otherNotes:            { en: "Additional notes",       ar: "ملاحظات إضافية" },
};

export type PatientReviewEntry = { label: string; value: string; fieldKey?: FieldKey };

function push(
  entries: PatientReviewEntry[],
  key: FieldKey,
  value: string | undefined,
  format?: (v: string) => string,
): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  entries.push({
    label: clinicianText(FIELD_LABELS[key]),
    value: format ? format(trimmed) : trimmed,
    fieldKey: key,
  });
}

/** Flatten patient draft into English clinician review rows. */
export function buildClinicianReviewEntries(
  section: PatientSectionId,
  draft: PatientAssessmentDraft,
): PatientReviewEntry[] {
  const entries: PatientReviewEntry[] = [];

  switch (section) {
    case "pain":
      if (draft.pain) {
        push(entries, "chiefComplaint", draft.pain.chiefComplaint);
        push(entries, "painLocation", draft.pain.painLocation);
        push(entries, "painScore", draft.pain.painScore, (v) => `${v} / 10`);
        push(entries, "aggravating", draft.pain.aggravating);
        push(entries, "easing", draft.pain.easing);
        push(entries, "dailyImpact", draft.pain.dailyImpact);
        push(entries, "goals", draft.pain.goals);
      }
      break;
    case "rom":
      if (draft.rom) {
        push(entries, "limitations", draft.rom.limitations);
        push(entries, "worseWith", draft.rom.worseWith);
      }
      break;
    case "strength":
      if (draft.strength) {
        push(entries, "weaknessDescription", draft.strength.weaknessDescription);
        push(entries, "activitiesAffected", draft.strength.activitiesAffected);
      }
      break;
    case "balance":
      if (draft.balance) {
        push(entries, "difficultyDescription", draft.balance.difficultyDescription);
        push(entries, "fallHistory", draft.balance.fallHistory);
      }
      break;
    case "gait":
      if (draft.gait) {
        push(entries, "walkingDescription", draft.gait.walkingDescription);
        push(entries, "aids", draft.gait.aids);
      }
      break;
    case "functional":
      if (draft.functional) {
        push(entries, "standingDuration", draft.functional.standingDuration);
        push(entries, "walkingDistance", draft.functional.walkingDistance);
        push(entries, "stairsAbility", draft.functional.stairsAbility);
        push(entries, "otherNotes", draft.functional.otherNotes);
      }
      break;
  }

  return entries;
}

/** Patient review rows in selected language. */
export function buildPatientReviewEntries(
  section: PatientSectionId,
  draft: PatientAssessmentDraft,
  lang: PatientLang,
): PatientReviewEntry[] {
  const entries: PatientReviewEntry[] = [];
  const label = (key: FieldKey) => patientText(FIELD_LABELS[key], lang);

  switch (section) {
    case "pain":
      if (draft.pain) {
        if (draft.pain.chiefComplaint.trim()) entries.push({ label: label("chiefComplaint"), value: draft.pain.chiefComplaint });
        if (draft.pain.painLocation.trim()) entries.push({ label: label("painLocation"), value: draft.pain.painLocation });
        if (draft.pain.painScore.trim()) entries.push({ label: label("painScore"), value: `${draft.pain.painScore} / 10` });
        if (draft.pain.aggravating.trim()) entries.push({ label: label("aggravating"), value: draft.pain.aggravating });
        if (draft.pain.easing.trim()) entries.push({ label: label("easing"), value: draft.pain.easing });
        if (draft.pain.dailyImpact.trim()) entries.push({ label: label("dailyImpact"), value: draft.pain.dailyImpact });
        if (draft.pain.goals.trim()) entries.push({ label: label("goals"), value: draft.pain.goals });
      }
      break;
    case "rom":
      if (draft.rom) {
        if (draft.rom.limitations.trim()) entries.push({ label: label("limitations"), value: draft.rom.limitations });
        if (draft.rom.worseWith.trim()) entries.push({ label: label("worseWith"), value: draft.rom.worseWith });
      }
      break;
    case "strength":
      if (draft.strength) {
        if (draft.strength.weaknessDescription.trim()) entries.push({ label: label("weaknessDescription"), value: draft.strength.weaknessDescription });
        if (draft.strength.activitiesAffected.trim()) entries.push({ label: label("activitiesAffected"), value: draft.strength.activitiesAffected });
      }
      break;
    case "balance":
      if (draft.balance) {
        if (draft.balance.difficultyDescription.trim()) entries.push({ label: label("difficultyDescription"), value: draft.balance.difficultyDescription });
        if (draft.balance.fallHistory.trim()) entries.push({ label: label("fallHistory"), value: draft.balance.fallHistory });
      }
      break;
    case "gait":
      if (draft.gait) {
        if (draft.gait.walkingDescription.trim()) entries.push({ label: label("walkingDescription"), value: draft.gait.walkingDescription });
        if (draft.gait.aids.trim()) entries.push({ label: label("aids"), value: draft.gait.aids });
      }
      break;
    case "functional":
      if (draft.functional) {
        if (draft.functional.standingDuration.trim()) entries.push({ label: label("standingDuration"), value: draft.functional.standingDuration });
        if (draft.functional.walkingDistance.trim()) entries.push({ label: label("walkingDistance"), value: draft.functional.walkingDistance });
        if (draft.functional.stairsAbility.trim()) entries.push({ label: label("stairsAbility"), value: draft.functional.stairsAbility });
        if (draft.functional.otherNotes.trim()) entries.push({ label: label("otherNotes"), value: draft.functional.otherNotes });
      }
      break;
  }

  return entries;
}

export function buildFullClinicianReview(
  draft: PatientAssessmentDraft | undefined,
  includedSections: PatientSectionId[],
): { section: PatientSectionId; sectionTitle: string; entries: PatientReviewEntry[] }[] {
  if (!draft) return [];
  return includedSections
    .map((section) => ({
      section,
      sectionTitle: clinicianText(PATIENT_SECTION_TITLES[section]),
      entries: buildClinicianReviewEntries(section, draft),
    }))
    .filter((block) => block.entries.length > 0);
}
