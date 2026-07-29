/**
 * Run: npx tsx --test app/lib/post-stroke-intake/questions.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSISTANCE_TYPE_LABELS,
  POST_STROKE_UI,
  RESPONDENT_SOURCE_CLARIFICATION,
  RESPONDENT_TYPE_LABELS,
  URGENT_GATE_STEP_TITLE,
  URGENT_STOP_SCREEN,
  URGENT_STOP_SCREEN_ORDER,
  URGENT_SYMPTOM_LABELS,
  clinicianText,
  patientText,
} from "./questions";
import { URGENT_SYMPTOM_VALUES } from "./urgent-gate";
import type {
  PostStrokeAssistanceType,
  PostStrokeRespondentType,
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

describe("patientText / clinicianText re-export", () => {
  it("selects the correct language for a LocalizedText value", () => {
    assert.equal(patientText(RESPONDENT_TYPE_LABELS.patient, "ar"), RESPONDENT_TYPE_LABELS.patient.ar);
    assert.equal(patientText(RESPONDENT_TYPE_LABELS.patient, "en"), RESPONDENT_TYPE_LABELS.patient.en);
    assert.equal(clinicianText(RESPONDENT_TYPE_LABELS.patient), RESPONDENT_TYPE_LABELS.patient.en);
  });
});
