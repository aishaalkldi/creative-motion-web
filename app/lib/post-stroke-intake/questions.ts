/**
 * Post-stroke intake — bilingual copy for respondent identification and the
 * urgent-symptom stop gate (Stage 2 only). Follows the same LocalizedText /
 * patientText / clinicianText convention as patient-assessment-questions.ts
 * (imported, not duplicated) so the two intake systems stay visually and
 * behaviorally consistent without sharing question data.
 */
import {
  clinicianText,
  patientText,
  type LocalizedText,
  type PatientLang,
} from "@/app/lib/patient-assessment-questions";
import type {
  PostStrokeAssistanceType,
  PostStrokeRespondentType,
  PostStrokeUrgentSymptom,
} from "./types";

export { clinicianText, patientText };
export type { LocalizedText, PatientLang };

export const POST_STROKE_INTAKE_TITLE: LocalizedText = {
  en: "Post-Stroke Intake & Safety Check",
  ar: "استمارة ما بعد السكتة الدماغية والفحص الأمني",
};

export const POST_STROKE_CONSENT_BODY: LocalizedText[] = [
  {
    en: "This form helps your clinician understand who is answering, whether anything urgent needs attention today, and basic information about daily function.",
    ar: "تساعد هذه الاستمارة معالجك على فهم من يجيب، وما إذا كان هناك أي أمر عاجل يحتاج إلى اهتمام اليوم، ومعلومات أساسية عن الأنشطة اليومية.",
  },
  {
    en: "This is not a diagnosis and does not replace your therapist's judgment. Your therapist will review all information before making any clinical decisions.",
    ar: "هذه ليست تشخيصًا ولا تحل محل تقييم معالجك. سيقوم معالجك بمراجعة جميع المعلومات قبل اتخاذ أي قرارات سريرية.",
  },
  {
    en: "If you feel unwell or notice a sudden new symptom right now, the first question in this form will ask about that directly.",
    ar: "إذا شعرت بتوعك أو لاحظت عرضًا جديدًا ومفاجئًا الآن، فسيسألك السؤال الأول في هذه الاستمارة عن ذلك مباشرة.",
  },
];

export const RESPONDENT_STEP_TITLE: LocalizedText = {
  en: "Who is answering these questions?",
  ar: "من الذي يجيب على هذه الأسئلة؟",
};

export const RESPONDENT_TYPE_LABELS: Record<PostStrokeRespondentType, LocalizedText> = {
  patient: {
    en: "The patient is answering",
    ar: "المريض هو من يجيب",
  },
  patient_with_caregiver_assistance: {
    en: "The patient is answering, with a caregiver helping",
    ar: "المريض يجيب، مع مساعدة من مقدم الرعاية",
  },
  caregiver_proxy: {
    en: "A caregiver is answering on the patient's behalf",
    ar: "مقدم الرعاية يجيب نيابة عن المريض",
  },
};

export const RESPONDENT_TYPE_HINT: LocalizedText = {
  en: "Choose “with a caregiver helping” if the patient is giving their own answers but needed help (for example, clarifying a question or using the device). Choose “caregiver answering on the patient’s behalf” only if the caregiver is reporting the information themselves.",
  ar: "اختر “مع مساعدة من مقدم الرعاية” إذا كان المريض يقدّم إجاباته الخاصة لكنه احتاج إلى مساعدة (مثل توضيح سؤال أو استخدام الجهاز). اختر “مقدم الرعاية يجيب نيابة عن المريض” فقط إذا كان مقدم الرعاية هو من يقدّم المعلومات بنفسه.",
};

/**
 * Clarifies who is the actual source of the reported information — shown
 * under the relevant respondent option so the distinction between "caregiver
 * assisted" and "caregiver reported as proxy" is explicit, not just implied
 * by the option label.
 */
export const RESPONDENT_SOURCE_CLARIFICATION: Partial<Record<PostStrokeRespondentType, LocalizedText>> = {
  patient_with_caregiver_assistance: {
    en: "The patient remains the source of the answers. The caregiver only assists with technology, understanding the question, or communication.",
    ar: "يبقى المريض هو مصدر الإجابات، ويقتصر دور مقدم الرعاية على المساعدة في استخدام التقنية أو فهم السؤال أو التواصل.",
  },
  caregiver_proxy: {
    en: "The caregiver is answering on the patient’s behalf and is the source of the reported information.",
    ar: "يجيب مقدم الرعاية نيابةً عن المريض، ويُعدّ هو مصدر المعلومات المبلّغ عنها.",
  },
};

export const ASSISTANCE_TYPE_STEP_TITLE: LocalizedText = {
  en: "What kind of assistance was used? (optional)",
  ar: "ما نوع المساعدة التي تم استخدامها؟ (اختياري)",
};

export const ASSISTANCE_TYPE_LABELS: Record<PostStrokeAssistanceType, LocalizedText> = {
  technology_support: { en: "Help using the phone or device", ar: "مساعدة في استخدام الهاتف أو الجهاز" },
  question_clarification: { en: "Help understanding the questions", ar: "مساعدة في فهم الأسئلة" },
  communication_support: { en: "Help communicating an answer", ar: "مساعدة في التواصل بالإجابة" },
  caregiver_answered_for_patient: { en: "Caregiver provided the answers", ar: "قدَّم مقدم الرعاية الإجابات" },
  other: { en: "Other", ar: "أخرى" },
};

export const URGENT_GATE_STEP_TITLE: LocalizedText = {
  en: "Today, or since your last assessment if applicable, have you experienced any new or sudden symptom or a clear worsening in your condition?",
  ar: "هل ظهر اليوم، أو منذ آخر تقييم إن وُجد، أي عرض جديد أو مفاجئ أو تدهور واضح في حالتك؟",
};

export const URGENT_GATE_STEP_HINT: LocalizedText = {
  en: "Select everything that applies. If none of these apply, choose “No new urgent symptoms.”",
  ar: "اختر كل ما ينطبق. إذا لم ينطبق أي منها، اختر “لا توجد أعراض عاجلة جديدة”.",
};

export const URGENT_SYMPTOM_LABELS: Record<PostStrokeUrgentSymptom, LocalizedText> = {
  new_weakness_or_numbness: {
    en: "New weakness or numbness in the face, arm, or leg",
    ar: "ضعف أو خدر جديد في الوجه أو الذراع أو الساق",
  },
  new_speech_or_understanding_change: {
    en: "New change in speech or understanding",
    ar: "تغيّر جديد في الكلام أو الفهم",
  },
  new_severe_dizziness_balance_or_coordination: {
    en: "New severe dizziness, loss of balance, or coordination difficulty",
    ar: "دوخة شديدة جديدة، أو فقدان توازن، أو صعوبة في التناسق",
  },
  sudden_visual_change: {
    en: "Sudden change in vision",
    ar: "تغيّر مفاجئ في الرؤية",
  },
  sudden_severe_headache: {
    en: "Sudden, severe headache",
    ar: "صداع شديد ومفاجئ",
  },
  chest_pain_or_shortness_of_breath: {
    en: "Chest pain or shortness of breath",
    ar: "ألم في الصدر أو ضيق في التنفس",
  },
  loss_of_consciousness: {
    en: "Loss of consciousness",
    ar: "فقدان الوعي",
  },
  fall_with_injury: {
    en: "A fall with injury",
    ar: "سقوط مصحوب بإصابة",
  },
  other_sudden_deterioration: {
    en: "A clear and sudden worsening in your condition not listed above",
    ar: "تدهور مفاجئ وواضح في حالتك لم يُذكر أعلاه",
  },
  no_new_urgent_symptoms: {
    en: "None of the new or sudden symptoms listed above",
    ar: "لا توجد أي من الأعراض الجديدة أو المفاجئة المذكورة أعلاه",
  },
};

/**
 * Non-diagnostic urgent-care copy, in required priority order. Deliberately
 * contains no country-specific emergency phone number, and no instruction
 * asking the patient to manually record symptoms or time — the system
 * already saves the answers; `savedNote` confirms that without asking the
 * patient to do anything about it before seeking help.
 */
export const URGENT_STOP_SCREEN = {
  title: {
    en: "Seek urgent medical help now.",
    ar: "يرجى طلب المساعدة الطبية العاجلة الآن.",
  } satisfies LocalizedText,
  instruction: {
    en: "You reported a new or sudden symptom that may require urgent medical assessment. Contact your local emergency services or go to the nearest emergency department now.",
    ar: "لقد أبلغت عن عرض جديد أو مفاجئ قد يحتاج إلى تقييم طبي عاجل. تواصل الآن مع خدمات الطوارئ المحلية أو توجّه إلى أقرب قسم طوارئ.",
  } satisfies LocalizedText,
  noWaitForTherapist: {
    en: "Do not wait for your therapist to review this form.",
    ar: "لا تنتظر مراجعة المعالج لهذه الاستمارة.",
  } satisfies LocalizedText,
  noExercise: {
    en: "Do not begin any exercise or movement assessment.",
    ar: "لا تبدأ أي تمرين أو تقييم حركي الآن.",
  } satisfies LocalizedText,
  savedNote: {
    en: "Your reported answers have been saved for the clinical team, but do not wait for therapist review before seeking urgent help.",
    ar: "تم حفظ إجاباتك لإبلاغ الفريق العلاجي، لكن لا تنتظر تواصل المعالج قبل طلب المساعدة العاجلة.",
  } satisfies LocalizedText,
  disclaimer: {
    en: "This is a precautionary safety action and not a medical diagnosis.",
    ar: "هذه الرسالة إجراء احترازي وليست تشخيصًا طبيًا.",
  } satisfies LocalizedText,
} satisfies Record<string, LocalizedText>;

/** Ordered keys matching the required priority order for rendering. */
export const URGENT_STOP_SCREEN_ORDER: readonly (keyof typeof URGENT_STOP_SCREEN)[] = [
  "title",
  "instruction",
  "noWaitForTherapist",
  "noExercise",
  "savedNote",
  "disclaimer",
];

export const POST_STROKE_UI = {
  // Arabic arrow is intentionally the opposite glyph from the English one —
  // confirmed correction: the RTL "continue" affordance must visually point
  // the way this UI's RTL flow actually renders, not just mirror the LTR
  // choice by convention. Keep this in sync with `back` below if that arrow
  // is ever revisited for the same reason.
  continueLabel: { en: "Continue →", ar: "متابعة →" } satisfies LocalizedText,
  back: { en: "← Back", ar: "→ رجوع" } satisfies LocalizedText,
  beginLabel: { en: "I understand — begin", ar: "أفهم — ابدأ" } satisfies LocalizedText,
  selectRespondentRequired: {
    en: "Please select who is answering to continue.",
    ar: "يرجى اختيار من يجيب للمتابعة.",
  } satisfies LocalizedText,
  selectSymptomRequired: {
    en: "Please select at least one option to continue.",
    ar: "يرجى اختيار خيار واحد على الأقل للمتابعة.",
  } satisfies LocalizedText,
  // Shown only after the partial no-urgent draft is successfully persisted.
  // Must never imply cleared/approved/safe/ready-for-assessment.
  noUrgentDraftSavedNotice: {
    en: "No new urgent symptoms were reported. Your intake is incomplete and still requires completion and clinician review.",
    ar: "لم يتم الإبلاغ عن أعراض عاجلة جديدة. لا يزال الاستبيان غير مكتمل ويتطلب استكماله ومراجعة الأخصائي.",
  } satisfies LocalizedText,
  submitting: { en: "Saving…", ar: "جارٍ الحفظ…" } satisfies LocalizedText,
  submitError: {
    en: "Could not save this right now. Please try again or contact your clinic directly.",
    ar: "تعذر حفظ هذا الآن. يرجى المحاولة مرة أخرى أو التواصل مع عيادتك مباشرة.",
  } satisfies LocalizedText,
  retry: { en: "Try again", ar: "أعد المحاولة" } satisfies LocalizedText,
  // Local-only acknowledgement — must never continue the intake or change
  // any persisted state; see URGENT_STOP_SCREEN usage in PostStrokeIntakeClient.
  acknowledgeHelp: {
    en: "I understand — I will seek help now",
    ar: "فهمت — سأطلب المساعدة الآن",
  } satisfies LocalizedText,
} satisfies Record<string, LocalizedText>;
