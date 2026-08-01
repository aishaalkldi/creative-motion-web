/**
 * Run: npx tsx --test app/lib/post-stroke-intake/questions.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSISTANCE_TYPE_LABELS,
  ASSISTIVE_DEVICE_LABELS,
  COMMUNICATION_SUPPORT_LABELS,
  FUNCTIONAL_ABILITY_LABELS,
  FUNCTIONAL_GOAL_STEP_TITLE,
  FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE,
  FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE,
  FUNCTIONAL_INTAKE_SCREEN_TITLES,
  FUNCTIONAL_INTAKE_SUBMITTED_NOTICE,
  INPUT_MODE_LABELS,
  MORE_AFFECTED_SIDE_LABELS,
  PATIENT_CONFIRMATION_REQUIRED_NOTICE,
  PATIENT_CONFIRMATION_STATEMENT,
  POST_STROKE_UI,
  RECENT_FALLS_LABELS,
  RESPONDENT_SOURCE_CLARIFICATION,
  RESPONDENT_TYPE_LABELS,
  SUBJECTIVE_NARRATIVE_QUESTION_LABELS,
  SUBJECTIVE_NARRATIVE_SCREEN_TITLES,
  SUBMIT_FUNCTIONAL_INTAKE_LABEL,
  UPPER_LIMB_USE_LABELS,
  URGENT_GATE_STEP_TITLE,
  URGENT_STOP_SCREEN,
  URGENT_STOP_SCREEN_ORDER,
  URGENT_SYMPTOM_LABELS,
  WALKING_ABILITY_LABELS,
  clinicianText,
  patientText,
} from "./questions";
import { URGENT_SYMPTOM_VALUES } from "./urgent-gate";
import {
  POST_STROKE_ASSISTIVE_DEVICE_VALUES,
  POST_STROKE_COMMUNICATION_SUPPORT_VALUES,
  POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES,
  POST_STROKE_FUNCTIONAL_ABILITY_VALUES,
  POST_STROKE_MORE_AFFECTED_SIDE_VALUES,
  POST_STROKE_SUBJECTIVE_QUESTION_IDS,
  POST_STROKE_UPPER_LIMB_USE_VALUES,
  POST_STROKE_WALKING_ABILITY_VALUES,
  type PostStrokeAssistanceType,
  type PostStrokeRespondentType,
} from "./types";

const RESPONDENT_TYPES: PostStrokeRespondentType[] = [
  "patient",
  "patient_with_caregiver_assistance",
  "caregiver_proxy",
];

const ASSISTANCE_TYPES: PostStrokeAssistanceType[] = [
  "technology_support",
  "question_clarification",
  "communication_support",
  "caregiver_answered_for_patient",
  "other",
];

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

describe("RESPONDENT_TYPE_LABELS", () => {
  it("has bilingual labels for every respondent type", () => {
    for (const type of RESPONDENT_TYPES) {
      const label = RESPONDENT_TYPE_LABELS[type];
      assert.ok(hasText(label.en), `missing English label for ${type}`);
      assert.ok(hasText(label.ar), `missing Arabic label for ${type}`);
    }
  });

  it("clearly distinguishes caregiver assistance from caregiver proxy reporting", () => {
    const assisted = clinicianText(RESPONDENT_TYPE_LABELS.patient_with_caregiver_assistance);
    const proxy = clinicianText(RESPONDENT_TYPE_LABELS.caregiver_proxy);
    assert.notEqual(assisted, proxy);
    assert.match(assisted, /patient is answering/i);
    assert.match(proxy, /on the patient's behalf/i);
  });
});

describe("RESPONDENT_SOURCE_CLARIFICATION", () => {
  it("clarifies the patient remains the source when a caregiver only assists", () => {
    const clarification = RESPONDENT_SOURCE_CLARIFICATION.patient_with_caregiver_assistance;
    assert.ok(clarification);
    assert.match(clarification!.en, /patient remains the source/i);
    assert.ok(hasText(clarification!.ar));
  });

  it("clarifies the caregiver is the source when reporting as proxy", () => {
    const clarification = RESPONDENT_SOURCE_CLARIFICATION.caregiver_proxy;
    assert.ok(clarification);
    assert.match(clarification!.en, /source of the reported information/i);
    assert.ok(hasText(clarification!.ar));
  });

  it("does not provide clarification copy for the plain patient respondent type", () => {
    assert.equal(RESPONDENT_SOURCE_CLARIFICATION.patient, undefined);
  });
});

describe("ASSISTANCE_TYPE_LABELS", () => {
  it("has bilingual labels for every assistance type", () => {
    for (const type of ASSISTANCE_TYPES) {
      const label = ASSISTANCE_TYPE_LABELS[type];
      assert.ok(hasText(label.en), `missing English label for ${type}`);
      assert.ok(hasText(label.ar), `missing Arabic label for ${type}`);
    }
  });
});

describe("URGENT_GATE_STEP_TITLE", () => {
  it("uses the approved bilingual wording", () => {
    assert.equal(
      URGENT_GATE_STEP_TITLE.en,
      "Today, or since your last assessment if applicable, have you experienced any new or sudden symptom or a clear worsening in your condition?",
    );
    assert.equal(
      URGENT_GATE_STEP_TITLE.ar,
      "هل ظهر اليوم، أو منذ آخر تقييم إن وُجد، أي عرض جديد أو مفاجئ أو تدهور واضح في حالتك؟",
    );
  });
});

describe("URGENT_SYMPTOM_LABELS", () => {
  it("has a bilingual label for every supported urgent symptom value", () => {
    for (const symptom of URGENT_SYMPTOM_VALUES) {
      const label = URGENT_SYMPTOM_LABELS[symptom];
      assert.ok(label, `missing label entry for ${symptom}`);
      assert.ok(hasText(label.en), `missing English label for ${symptom}`);
      assert.ok(hasText(label.ar), `missing Arabic label for ${symptom}`);
    }
  });

  it("uses the approved wording for no_new_urgent_symptoms (enum value unchanged)", () => {
    assert.equal(URGENT_SYMPTOM_LABELS.no_new_urgent_symptoms.en, "None of the new or sudden symptoms listed above");
    assert.equal(
      URGENT_SYMPTOM_LABELS.no_new_urgent_symptoms.ar,
      "لا توجد أي من الأعراض الجديدة أو المفاجئة المذكورة أعلاه",
    );
  });

  it("uses the approved wording for other_sudden_deterioration (enum value unchanged)", () => {
    assert.equal(
      URGENT_SYMPTOM_LABELS.other_sudden_deterioration.en,
      "A clear and sudden worsening in your condition not listed above",
    );
    assert.equal(URGENT_SYMPTOM_LABELS.other_sudden_deterioration.ar, "تدهور مفاجئ وواضح في حالتك لم يُذكر أعلاه");
  });
});

describe("URGENT_STOP_SCREEN", () => {
  it("never names a specific cause or condition", () => {
    const allText = Object.values(URGENT_STOP_SCREEN)
      .map((entry) => `${entry.en} ${entry.ar}`)
      .join(" ");
    assert.doesNotMatch(allText, /\bstroke\b/i);
    assert.doesNotMatch(allText, /\bTIA\b/);
    assert.doesNotMatch(allText, /\baphasia\b/i);
  });

  it("explicitly disclaims making a diagnosis rather than asserting one", () => {
    assert.match(URGENT_STOP_SCREEN.disclaimer.en, /not a medical diagnosis/i);
    assert.doesNotMatch(URGENT_STOP_SCREEN.instruction.en, /diagnos(is|ed|e)/i);
  });

  it("does not hard-code a country-specific emergency phone number", () => {
    const allText = Object.values(URGENT_STOP_SCREEN)
      .map((entry) => entry.en)
      .join(" ");
    assert.doesNotMatch(allText, /\d{3,}/);
  });

  it("tells the patient not to wait for therapist review before seeking help", () => {
    assert.match(URGENT_STOP_SCREEN.noWaitForTherapist.en, /do not wait for your therapist/i);
  });

  it("tells the patient not to begin exercise or movement assessment", () => {
    assert.match(URGENT_STOP_SCREEN.noExercise.en, /do not begin any exercise/i);
  });

  it("confirms answers were saved without asking the patient to manually record anything", () => {
    assert.match(URGENT_STOP_SCREEN.savedNote.en, /have been saved/i);
    // Regression: the old copy asked the patient to rely on the system having
    // recorded things; the new copy must not instead ask the PATIENT to write
    // down or note symptoms/time themselves.
    const allText = Object.values(URGENT_STOP_SCREEN)
      .map((entry) => entry.en)
      .join(" ");
    assert.doesNotMatch(allText, /write down|note the time|record the symptoms yourself|please record/i);
  });

  it("renders in the required priority order", () => {
    assert.deepEqual(URGENT_STOP_SCREEN_ORDER, [
      "title",
      "instruction",
      "noWaitForTherapist",
      "noExercise",
      "savedNote",
      "disclaimer",
    ]);
  });
});

describe("POST_STROKE_UI — continue affordance", () => {
  it("provides a local-only acknowledgement label distinct from continuing the intake", () => {
    assert.match(POST_STROKE_UI.acknowledgeHelp.en, /seek help now/i);
    assert.ok(hasText(POST_STROKE_UI.acknowledgeHelp.ar));
  });
});

describe("POST_STROKE_UI — no-urgent draft saved notice", () => {
  it("uses the approved bilingual wording", () => {
    assert.equal(
      POST_STROKE_UI.noUrgentDraftSavedNotice.en,
      "No new urgent symptoms were reported. Your intake is incomplete and still requires completion and clinician review.",
    );
    assert.equal(
      POST_STROKE_UI.noUrgentDraftSavedNotice.ar,
      "لم يتم الإبلاغ عن أعراض عاجلة جديدة. لا يزال الاستبيان غير مكتمل ويتطلب استكماله ومراجعة الأخصائي.",
    );
  });

  it("never implies the intake is cleared, approved, safe, or ready for assessment", () => {
    const text = `${POST_STROKE_UI.noUrgentDraftSavedNotice.en}`;
    assert.doesNotMatch(text, /\bcleared\b|\bapproved\b|\bsafe\b|ready for assessment/i);
    assert.match(text, /incomplete/i);
  });
});

describe("Stage 3 — bilingual label coverage", () => {
  it("has bilingual labels for every moreAffectedSide value", () => {
    for (const value of POST_STROKE_MORE_AFFECTED_SIDE_VALUES) {
      assert.ok(hasText(MORE_AFFECTED_SIDE_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(MORE_AFFECTED_SIDE_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every sitting/standing functional-ability value", () => {
    for (const value of POST_STROKE_FUNCTIONAL_ABILITY_VALUES) {
      assert.ok(hasText(FUNCTIONAL_ABILITY_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(FUNCTIONAL_ABILITY_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every walkingAbility value", () => {
    for (const value of POST_STROKE_WALKING_ABILITY_VALUES) {
      assert.ok(hasText(WALKING_ABILITY_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(WALKING_ABILITY_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every assistiveDevice value", () => {
    for (const value of POST_STROKE_ASSISTIVE_DEVICE_VALUES) {
      assert.ok(hasText(ASSISTIVE_DEVICE_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(ASSISTIVE_DEVICE_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every recentFalls value", () => {
    for (const value of POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES) {
      assert.ok(hasText(RECENT_FALLS_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(RECENT_FALLS_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every upperLimbUse value", () => {
    for (const value of POST_STROKE_UPPER_LIMB_USE_VALUES) {
      assert.ok(hasText(UPPER_LIMB_USE_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(UPPER_LIMB_USE_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual labels for every communicationSupport value", () => {
    for (const value of POST_STROKE_COMMUNICATION_SUPPORT_VALUES) {
      assert.ok(hasText(COMMUNICATION_SUPPORT_LABELS[value].en), `missing English label for ${value}`);
      assert.ok(hasText(COMMUNICATION_SUPPORT_LABELS[value].ar), `missing Arabic label for ${value}`);
    }
  });

  it("has bilingual titles for all three Stage 3 screens", () => {
    for (const title of Object.values(FUNCTIONAL_INTAKE_SCREEN_TITLES)) {
      assert.ok(hasText(title.en));
      assert.ok(hasText(title.ar));
    }
  });

  it("has a bilingual functional goal step title", () => {
    assert.ok(hasText(FUNCTIONAL_GOAL_STEP_TITLE.en));
    assert.ok(hasText(FUNCTIONAL_GOAL_STEP_TITLE.ar));
  });
});

describe("Stage 3 — non-verdict framing", () => {
  it("the incomplete/review-required notices never use cleared/safe/approved/diagnosis language", () => {
    const allText = [
      FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE.en,
      FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE.en,
      FUNCTIONAL_INTAKE_SUBMITTED_NOTICE.en,
    ].join(" ");
    assert.doesNotMatch(allText, /\bcleared\b|\bsafe\b|\bapproved\b|ready for exercise|clinically completed|diagnos/i);
  });

  it("the incomplete notice states the intake is patient/caregiver reported", () => {
    assert.match(FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE.en, /patient\/caregiver reported/i);
    assert.ok(hasText(FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE.ar));
  });

  it("the review-required notice states clinician review is required and no decision is made", () => {
    assert.match(FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE.en, /review/i);
    assert.match(FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE.en, /no clinical decision/i);
    assert.ok(hasText(FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE.ar));
  });
});

describe("SUBMIT_FUNCTIONAL_INTAKE_LABEL — exact approved wording", () => {
  it("matches the required bilingual final-submit button text exactly", () => {
    assert.equal(SUBMIT_FUNCTIONAL_INTAKE_LABEL.en, "Submit intake for clinician review");
    assert.equal(SUBMIT_FUNCTIONAL_INTAKE_LABEL.ar, "إرسال الاستبيان لمراجعة الأخصائي");
  });
});

describe("FUNCTIONAL_INTAKE_SUBMITTED_NOTICE — exact approved wording", () => {
  it("matches the required bilingual post-submit notice exactly", () => {
    assert.equal(
      FUNCTIONAL_INTAKE_SUBMITTED_NOTICE.en,
      "Your intake was submitted for clinician review. No clinical decision or exercise clearance has been made.",
    );
    assert.equal(
      FUNCTIONAL_INTAKE_SUBMITTED_NOTICE.ar,
      "تم إرسال الاستبيان لمراجعة الأخصائي. لم يتم اتخاذ قرار سريري أو إصدار تصريح للتمارين.",
    );
  });

  it("never implies clinical approval or exercise clearance", () => {
    assert.doesNotMatch(FUNCTIONAL_INTAKE_SUBMITTED_NOTICE.en, /\bcleared\b|\bapproved\b|\bsafe\b/i);
  });
});

describe("patientText / clinicianText re-export", () => {
  it("selects the correct language for a LocalizedText value", () => {
    assert.equal(patientText(RESPONDENT_TYPE_LABELS.patient, "ar"), RESPONDENT_TYPE_LABELS.patient.ar);
    assert.equal(patientText(RESPONDENT_TYPE_LABELS.patient, "en"), RESPONDENT_TYPE_LABELS.patient.en);
    assert.equal(clinicianText(RESPONDENT_TYPE_LABELS.patient), RESPONDENT_TYPE_LABELS.patient.en);
  });
});

describe("Stage 4 — subjective narrative bilingual content", () => {
  it("has bilingual labels for exactly the five approved open-ended questions", () => {
    assert.equal(POST_STROKE_SUBJECTIVE_QUESTION_IDS.length, 5);
    for (const id of POST_STROKE_SUBJECTIVE_QUESTION_IDS) {
      const label = SUBJECTIVE_NARRATIVE_QUESTION_LABELS[id];
      assert.ok(hasText(label.en), `missing English label for ${id}`);
      assert.ok(hasText(label.ar), `missing Arabic label for ${id}`);
    }
  });

  it("matches the exact approved wording for each question", () => {
    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.mainDifficulty.en,
      "What is the main difficulty you are experiencing now?",
    );
    assert.equal(SUBJECTIVE_NARRATIVE_QUESTION_LABELS.mainDifficulty.ar, "ما الصعوبة الرئيسية التي تواجهها الآن؟");

    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.onsetOrChange.en,
      "When did this difficulty begin, or when did it last change?",
    );
    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.onsetOrChange.ar,
      "متى بدأت هذه الصعوبة، أو متى حدث آخر تغير فيها؟",
    );

    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.dailyImpact.en,
      "How does this difficulty affect your daily activities?",
    );
    assert.equal(SUBJECTIVE_NARRATIVE_QUESTION_LABELS.dailyImpact.ar, "كيف تؤثر هذه الصعوبة في أنشطتك اليومية؟");

    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.mostDifficultActivities.en,
      "Which activities are currently most difficult for you?",
    );
    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.mostDifficultActivities.ar,
      "ما الأنشطة الأكثر صعوبة بالنسبة لك حاليًا؟",
    );

    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.additionalInformation.en,
      "Is there anything else you would like your therapist to know?",
    );
    assert.equal(
      SUBJECTIVE_NARRATIVE_QUESTION_LABELS.additionalInformation.ar,
      "هل توجد معلومات أخرى تود أن يعرفها الأخصائي؟",
    );
  });

  it("has bilingual titles for both narrative screens", () => {
    for (const title of Object.values(SUBJECTIVE_NARRATIVE_SCREEN_TITLES)) {
      assert.ok(hasText(title.en));
      assert.ok(hasText(title.ar));
    }
  });

  it("has bilingual input-mode labels for text and voice", () => {
    assert.ok(hasText(INPUT_MODE_LABELS.text.en));
    assert.ok(hasText(INPUT_MODE_LABELS.text.ar));
    assert.ok(hasText(INPUT_MODE_LABELS.voice.en));
    assert.ok(hasText(INPUT_MODE_LABELS.voice.ar));
  });

  it("matches the exact approved patient confirmation statement", () => {
    assert.equal(
      PATIENT_CONFIRMATION_STATEMENT.en,
      "I confirm that these answers accurately reflect what I said or intended to report.",
    );
    assert.equal(
      PATIENT_CONFIRMATION_STATEMENT.ar,
      "أؤكد أن هذه الإجابات تعبّر بدقة عما قلته أو قصدت الإبلاغ عنه.",
    );
  });

  it("has a bilingual confirmation-required notice distinct from the confirmation statement itself", () => {
    assert.ok(hasText(PATIENT_CONFIRMATION_REQUIRED_NOTICE.en));
    assert.ok(hasText(PATIENT_CONFIRMATION_REQUIRED_NOTICE.ar));
    assert.notEqual(PATIENT_CONFIRMATION_REQUIRED_NOTICE.en, PATIENT_CONFIRMATION_STATEMENT.en);
  });

  it("reuses the existing Stage 3 submit label and success notice verbatim — never duplicates them", () => {
    assert.equal(SUBMIT_FUNCTIONAL_INTAKE_LABEL.en, "Submit intake for clinician review");
    assert.equal(SUBMIT_FUNCTIONAL_INTAKE_LABEL.ar, "إرسال الاستبيان لمراجعة الأخصائي");
    assert.equal(
      FUNCTIONAL_INTAKE_SUBMITTED_NOTICE.en,
      "Your intake was submitted for clinician review. No clinical decision or exercise clearance has been made.",
    );
  });
});
