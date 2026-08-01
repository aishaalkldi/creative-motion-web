/**
 * Run: npx tsx --test app/lib/post-stroke-intake/submission-validation.test.ts
 *
 * The submit route (app/api/remote-assessments/[token]/submit/route.ts) calls
 * this module for post_stroke_intake submissions before the DB insert. These
 * tests cover the server-authoritative decision logic directly — the DB round
 * trip itself is exercised at the route-test level (see token-submit-route.test.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validatePostStrokeIntakeCompletion,
  validatePostStrokeIntakeDraftSave,
  validatePostStrokeIntakeSubmission,
} from "./submission-validation";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    postStrokeIntake: {
      respondent: { type: "patient" },
      urgentGate: { symptoms: ["fall_with_injury"] },
    },
    assessmentLanguage: "en",
    ...overrides,
  };
}

describe("validatePostStrokeIntakeSubmission — server-authoritative normalization", () => {
  it("ignores a client-supplied timestamp and replaces it with a server timestamp", () => {
    const spoofedRecordedAt = "1999-01-01T00:00:00.000Z";
    const result = validatePostStrokeIntakeSubmission({
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["fall_with_injury"], recordedAt: spoofedRecordedAt, stopped: false },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      recordedAt: string;
    };
    assert.notEqual(urgentGate.recordedAt, spoofedRecordedAt);
    // A real server timestamp was generated instead.
    assert.ok(!Number.isNaN(Date.parse(urgentGate.recordedAt)));
  });

  it("does not let a spoofed stopped: false bypass a real urgent symptom", () => {
    const result = validatePostStrokeIntakeSubmission({
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["loss_of_consciousness"], stopped: false, flags: ["clinician_review_required"] },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stopped, true);
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      stopped: boolean;
    };
    assert.equal(urgentGate.stopped, true);
  });

  it("discards spoofed flags and recomputes the server-authoritative flag set", () => {
    const result = validatePostStrokeIntakeSubmission({
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["fall_with_injury"], flags: ["totally_safe_for_remote_self"] },
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      flags: string[];
    };
    assert.deepEqual(urgentGate.flags, ["urgent_symptoms_reported", "intake_stopped", "clinician_review_required"]);
    assert.ok(!urgentGate.flags.includes("totally_safe_for_remote_self"));
  });

  it("produces stopped: true for valid real urgent symptoms", () => {
    const result = validatePostStrokeIntakeSubmission(validPayload());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stopped, true);
  });

  it("produces stopped: false when only no_new_urgent_symptoms is selected", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stopped, false);
  });

  it("fails closed when no_new_urgent_symptoms is combined with another symptom", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms", "sudden_severe_headache"] },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stopped, true);
  });

  it("rejects an invalid/unrecognized symptom value", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["totally_made_up_symptom"] },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an empty symptom list", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: { respondent: { type: "patient" }, urgentGate: { symptoms: [] } },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects a missing urgentGate.symptoms field entirely", () => {
    const result = validatePostStrokeIntakeSubmission({
      postStrokeIntake: { respondent: { type: "patient" } },
    });
    assert.equal(result.ok, false);
  });

  it("rejects an invalid respondent type", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "not_a_real_respondent_type" },
          urgentGate: { symptoms: ["fall_with_injury"] },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects a missing respondent entirely", () => {
    const result = validatePostStrokeIntakeSubmission({
      postStrokeIntake: { urgentGate: { symptoms: ["fall_with_injury"] } },
    });
    assert.equal(result.ok, false);
  });

  it("rejects an invalid assistance type when provided", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "patient_with_caregiver_assistance", assistanceType: "not_real" },
          urgentGate: { symptoms: ["fall_with_injury"] },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("accepts a valid optional assistance type", () => {
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: {
          respondent: { type: "patient_with_caregiver_assistance", assistanceType: "technology_support" },
          urgentGate: { symptoms: ["fall_with_injury"] },
        },
      }),
    );
    assert.equal(result.ok, true);
  });

  it("rejects non-object structured_data", () => {
    assert.equal(validatePostStrokeIntakeSubmission(null).ok, false);
    assert.equal(validatePostStrokeIntakeSubmission("a string").ok, false);
    assert.equal(validatePostStrokeIntakeSubmission([]).ok, false);
  });

  it("never diagnoses, scores risk, or infers additional symptoms beyond what was selected", () => {
    const selected = ["chest_pain_or_shortness_of_breath"];
    const result = validatePostStrokeIntakeSubmission(
      validPayload({
        postStrokeIntake: { respondent: { type: "patient" }, urgentGate: { symptoms: selected } },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      symptoms: string[];
    };
    assert.deepEqual(urgentGate.symptoms, selected);
  });
});

function draftPayload(overrides: Record<string, unknown> = {}) {
  return {
    postStrokeIntake: {
      respondent: { type: "patient" },
      urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
    },
    assessmentLanguage: "en",
    ...overrides,
  };
}

describe("validatePostStrokeIntakeDraftSave — partial no-urgent draft", () => {
  it("accepts exactly ['no_new_urgent_symptoms'] and produces stopped: false", () => {
    const result = validatePostStrokeIntakeDraftSave(draftPayload());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      stopped: boolean;
      flags: string[];
      symptoms: string[];
    };
    assert.equal(urgentGate.stopped, false);
    assert.deepEqual(urgentGate.flags, ["clinician_review_required"]);
    assert.deepEqual(urgentGate.symptoms, ["no_new_urgent_symptoms"]);
  });

  it("generates a server-side recordedAt timestamp, ignoring any client value", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"], recordedAt: "1999-01-01T00:00:00.000Z" },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      recordedAt: string;
    };
    assert.notEqual(urgentGate.recordedAt, "1999-01-01T00:00:00.000Z");
    assert.ok(!Number.isNaN(Date.parse(urgentGate.recordedAt)));
  });

  it("rejects a real urgent symptom — must go through the submit endpoint instead", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: { respondent: { type: "patient" }, urgentGate: { symptoms: ["fall_with_injury"] } },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects no_new_urgent_symptoms combined with a real symptom", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms", "fall_with_injury"] },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an empty or missing symptom list", () => {
    assert.equal(
      validatePostStrokeIntakeDraftSave(
        draftPayload({ postStrokeIntake: { respondent: { type: "patient" }, urgentGate: { symptoms: [] } } }),
      ).ok,
      false,
    );
    assert.equal(
      validatePostStrokeIntakeDraftSave(draftPayload({ postStrokeIntake: { respondent: { type: "patient" } } })).ok,
      false,
    );
  });

  it("discards spoofed stopped and flags entirely", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"], stopped: true, flags: ["urgent_symptoms_reported", "intake_stopped"] },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const urgentGate = (result.structuredData.postStrokeIntake as Record<string, unknown>).urgentGate as {
      stopped: boolean;
      flags: string[];
    };
    assert.equal(urgentGate.stopped, false);
    assert.deepEqual(urgentGate.flags, ["clinician_review_required"]);
  });

  it("rejects an invalid respondent type", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: { respondent: { type: "not_real" }, urgentGate: { symptoms: ["no_new_urgent_symptoms"] } },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("never produces a diagnosis, severity, safety-clearance, or delivery-mode field", () => {
    const result = validatePostStrokeIntakeDraftSave(draftPayload());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.structuredData);
    assert.doesNotMatch(serialized, /diagnos|severity|safe|unsafe|cleared|remote_self|remote_supervised|in_clinic/i);
  });
});

const COMPLETE_FUNCTIONAL_INTAKE_INPUT = {
  moreAffectedSide: "left",
  sittingAbility: "independent",
  standingAbility: "independent",
  walkingAbility: "with_assistive_device",
  assistiveDevice: "cane",
  recentFalls: "none",
  upperLimbUse: "limited_use",
  communicationSupport: "extra_time",
  functionalGoal: "  Walk to the kitchen safely  ",
};

function functionalIntakeFrom(result: { ok: true; structuredData: Record<string, unknown> }) {
  const postStroke = result.structuredData.postStrokeIntake as Record<string, unknown>;
  return postStroke.functionalIntake as Record<string, unknown> | undefined;
}

describe("validatePostStrokeIntakeDraftSave — Stage 3 functionalIntake (partial)", () => {
  it("omits functionalIntake entirely from the output when absent from the input", () => {
    const result = validatePostStrokeIntakeDraftSave(draftPayload());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(functionalIntakeFrom(result), undefined);
  });

  it("accepts a partial subset of Stage 3 fields (screen 1 only)", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: {
            moreAffectedSide: "left",
            sittingAbility: "independent",
            standingAbility: "independent",
            walkingAbility: "independent",
            assistiveDevice: "none",
            recentFalls: "none",
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const fi = functionalIntakeFrom(result);
    assert.equal(fi?.moreAffectedSide, "left");
    assert.equal(fi?.upperLimbUse, undefined);
    assert.ok(!Number.isNaN(Date.parse(fi?.recordedAt as string)));
    assert.deepEqual(fi?.flags, ["clinician_review_required"]);
  });

  it("trims and accepts a valid partial functionalGoal on its own", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { functionalGoal: "  Hold a cup  " },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(functionalIntakeFrom(result)?.functionalGoal, "Hold a cup");
  });

  it("rejects a functionalGoal shorter than 2 characters after trimming", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { functionalGoal: "  a  " },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects a functionalGoal longer than 500 characters", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { functionalGoal: "a".repeat(501) },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an invalid enum value for any Stage 3 field", () => {
    for (const [field, value] of [
      ["moreAffectedSide", "diagonal"],
      ["sittingAbility", "sometimes"],
      ["standingAbility", "sometimes"],
      ["walkingAbility", "sometimes"],
      ["assistiveDevice", "scooter"],
      ["recentFalls", "many"],
      ["upperLimbUse", "great"],
      ["communicationSupport", "telepathy"],
    ] as const) {
      const result = validatePostStrokeIntakeDraftSave(
        draftPayload({
          postStrokeIntake: {
            respondent: { type: "patient" },
            urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
            functionalIntake: { [field]: value },
          },
        }),
      );
      assert.equal(result.ok, false, `expected ${field}="${value}" to be rejected`);
    }
  });

  it("rejects an unexpected/unrecognized field inside functionalIntake (fails closed, never silently dropped)", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { moreAffectedSide: "left", diagnosis: "stroke" },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects a prohibited field disguised as a Stage 3 answer (fall-risk score, safety verdict, delivery mode)", () => {
    for (const badField of ["fallRiskScore", "safetyClearance", "remoteSelf", "exerciseEligibility"]) {
      const result = validatePostStrokeIntakeDraftSave(
        draftPayload({
          postStrokeIntake: {
            respondent: { type: "patient" },
            urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
            functionalIntake: { [badField]: "anything" },
          },
        }),
      );
      assert.equal(result.ok, false, `expected ${badField} to be rejected`);
    }
  });

  it("requires assistiveDeviceOtherText when assistiveDevice is 'other'", () => {
    const missing = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { assistiveDevice: "other" },
        },
      }),
    );
    assert.equal(missing.ok, false);

    const provided = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { assistiveDevice: "other", assistiveDeviceOtherText: "Custom rollator" },
        },
      }),
    );
    assert.equal(provided.ok, true);
    if (!provided.ok) return;
    assert.equal(functionalIntakeFrom(provided)?.assistiveDeviceOtherText, "Custom rollator");
  });

  it("requires communicationSupportOtherText when communicationSupport is 'other'", () => {
    const missing = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { communicationSupport: "other" },
        },
      }),
    );
    assert.equal(missing.ok, false);

    const provided = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { communicationSupport: "other", communicationSupportOtherText: "Picture board" },
        },
      }),
    );
    assert.equal(provided.ok, true);
  });

  it("ignores a client-supplied recordedAt/flags inside functionalIntake — always server-recomputed", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: {
            moreAffectedSide: "left",
            recordedAt: "1999-01-01T00:00:00.000Z",
            flags: ["safe_for_exercise"],
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const fi = functionalIntakeFrom(result);
    assert.notEqual(fi?.recordedAt, "1999-01-01T00:00:00.000Z");
    assert.deepEqual(fi?.flags, ["clinician_review_required"]);
  });

  it("preserves respondent and urgentGate unchanged alongside a Stage 3 partial save", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient_with_caregiver_assistance", assistanceType: "technology_support" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: { moreAffectedSide: "right" },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const postStroke = result.structuredData.postStrokeIntake as Record<string, unknown>;
    assert.deepEqual(postStroke.respondent, {
      type: "patient_with_caregiver_assistance",
      assistanceType: "technology_support",
    });
    const urgentGate = postStroke.urgentGate as { stopped: boolean };
    assert.equal(urgentGate.stopped, false);
  });
});

const COMPLETE_SUBJECTIVE_NARRATIVE_INPUT = {
  responses: [
    { questionId: "mainDifficulty", inputMode: "text", text: "Trouble gripping objects with my right hand." },
    { questionId: "onsetOrChange", inputMode: "text", text: "Started three weeks ago after the stroke." },
    { questionId: "dailyImpact", inputMode: "text", text: "Makes cooking and dressing harder." },
    { questionId: "mostDifficultActivities", inputMode: "voice", text: "Buttoning shirts and opening jars." },
  ],
};

describe("validatePostStrokeIntakeCompletion — final Stage 3 submission", () => {
  function completionPayload(overrides: Record<string, unknown> = {}) {
    return {
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
        functionalIntake: COMPLETE_FUNCTIONAL_INTAKE_INPUT,
        subjectiveNarrative: COMPLETE_SUBJECTIVE_NARRATIVE_INPUT,
        ...overrides,
      },
      assessmentLanguage: "en",
    };
  }

  it("accepts a fully answered functionalIntake", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const fi = functionalIntakeFrom(result);
    assert.equal(fi?.functionalGoal, "Walk to the kitchen safely");
    assert.deepEqual(fi?.flags, ["clinician_review_required"]);
    assert.ok(!Number.isNaN(Date.parse(fi?.recordedAt as string)));
  });

  it("rejects when any required field is missing", () => {
    const { moreAffectedSide: _moreAffectedSide, ...incomplete } = COMPLETE_FUNCTIONAL_INTAKE_INPUT;
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({
        functionalIntake: incomplete,
      }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects when functionalIntake is entirely absent", () => {
    const result = validatePostStrokeIntakeCompletion(
      {
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
        },
      },
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects when the Stage 2 urgent gate is missing", () => {
    const result = validatePostStrokeIntakeCompletion(
      {
        postStrokeIntake: {
          respondent: { type: "patient" },
          functionalIntake: COMPLETE_FUNCTIONAL_INTAKE_INPUT,
        },
      },
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects when the Stage 2 urgent gate is not cleared (a real urgent symptom present)", () => {
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({ urgentGate: { symptoms: ["fall_with_injury"] } }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects an unexpected field inside functionalIntake even on a complete payload", () => {
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({
        functionalIntake: { ...COMPLETE_FUNCTIONAL_INTAKE_INPUT, fallRiskScore: 3 },
      }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("requires assistiveDeviceOtherText when assistiveDevice is 'other' on final submission", () => {
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({
        functionalIntake: { ...COMPLETE_FUNCTIONAL_INTAKE_INPUT, assistiveDevice: "other" },
      }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("never produces a diagnosis, severity, safety-clearance, or delivery-mode field", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.structuredData);
    assert.doesNotMatch(
      serialized,
      /diagnos|severity|\bsafe\b|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i,
    );
  });
});

function subjectiveNarrativeFrom(result: { ok: true; structuredData: Record<string, unknown> }) {
  const postStroke = result.structuredData.postStrokeIntake as Record<string, unknown>;
  return postStroke.subjectiveNarrative as Record<string, unknown> | undefined;
}

describe("validatePostStrokeIntakeDraftSave — subjective narrative (partial)", () => {
  it("omits subjectiveNarrative entirely from the output when absent from the input", () => {
    const result = validatePostStrokeIntakeDraftSave(draftPayload());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(subjectiveNarrativeFrom(result), undefined);
  });

  it("accepts a partial subset of open-ended responses (screen A only)", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [
              { questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking." },
              { questionId: "onsetOrChange", inputMode: "voice", text: "Two weeks ago." },
            ],
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const narrative = subjectiveNarrativeFrom(result);
    const responses = narrative?.responses as Array<{ questionId: string; inputMode: string; text: string }>;
    assert.equal(responses.length, 2);
    assert.equal(responses[0].text, "Trouble walking.");
    assert.equal(responses[1].inputMode, "voice");
  });

  it("rejects a client-supplied patientConfirmedAt on a draft save — it is never an accepted field", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking." }],
            patientConfirmedAt: "2020-01-01T00:00:00.000Z",
          },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("draft saves never contain patientConfirmedAt when no confirmation field is sent at all", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking." }],
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(subjectiveNarrativeFrom(result)?.patientConfirmedAt, undefined);
  });

  it("treats additionalInformation as optional — an empty answer is dropped, not rejected", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "additionalInformation", inputMode: "text", text: "   " }],
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(subjectiveNarrativeFrom(result), undefined);
  });

  it("rejects a required answer shorter than 2 characters after trimming", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "text", text: " a " }],
          },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an answer longer than 1000 characters", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "a".repeat(1001) }],
          },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an invalid question id or input mode", () => {
    const invalidQuestion = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: { responses: [{ questionId: "affectedSide", inputMode: "text", text: "left" }] },
        },
      }),
    );
    assert.equal(invalidQuestion.ok, false);

    const invalidMode = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "handwriting", text: "left" }],
          },
        },
      }),
    );
    assert.equal(invalidMode.ok, false);
  });

  it("rejects an unexpected field inside a response entry (fails closed)", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [
              { questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking.", diagnosis: "stroke" },
            ],
          },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects an unexpected top-level field inside subjectiveNarrative", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: { responses: [], aiDraft: "not allowed here" },
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it("never persists a diagnosis, fall-risk score, or delivery-mode field", () => {
    const result = validatePostStrokeIntakeDraftSave(
      draftPayload({
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          subjectiveNarrative: {
            responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Trouble walking daily." }],
          },
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.structuredData);
    assert.doesNotMatch(serialized, /diagnos|severity|\bsafe\b|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i);
  });
});

describe("validatePostStrokeIntakeCompletion — subjective narrative (complete)", () => {
  function completionPayload(overrides: Record<string, unknown> = {}) {
    return {
      postStrokeIntake: {
        respondent: { type: "patient" },
        urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
        functionalIntake: COMPLETE_FUNCTIONAL_INTAKE_INPUT,
        subjectiveNarrative: COMPLETE_SUBJECTIVE_NARRATIVE_INPUT,
        ...overrides,
      },
      assessmentLanguage: "en",
    };
  }

  it("accepts a fully answered narrative when patientConfirmed is exactly true, and generates patientConfirmedAt server-side", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const narrative = subjectiveNarrativeFrom(result);
    assert.ok(!Number.isNaN(Date.parse(narrative?.patientConfirmedAt as string)));
  });

  it("rejects a client-supplied patientConfirmedAt inside subjectiveNarrative as an unexpected field — even when patientConfirmed is true", () => {
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({
        subjectiveNarrative: {
          ...COMPLETE_SUBJECTIVE_NARRATIVE_INPUT,
          patientConfirmedAt: "1999-01-01T00:00:00.000Z",
        },
      }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects final submission when patientConfirmed is missing", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), undefined);
    assert.equal(result.ok, false);
  });

  it("rejects final submission when patientConfirmed is false", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), false);
    assert.equal(result.ok, false);
  });

  it("rejects final submission when patientConfirmed is a non-boolean truthy value (string/number)", () => {
    assert.equal(validatePostStrokeIntakeCompletion(completionPayload(), "true").ok, false);
    assert.equal(validatePostStrokeIntakeCompletion(completionPayload(), 1).ok, false);
  });

  it("never persists patientConfirmed itself anywhere in the output", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.structuredData);
    assert.doesNotMatch(serialized, /"patientConfirmed"\s*:/);
  });

  it("rejects final submission when subjectiveNarrative is entirely absent", () => {
    const result = validatePostStrokeIntakeCompletion(
      {
        postStrokeIntake: {
          respondent: { type: "patient" },
          urgentGate: { symptoms: ["no_new_urgent_symptoms"] },
          functionalIntake: COMPLETE_FUNCTIONAL_INTAKE_INPUT,
        },
      },
      true,
    );
    assert.equal(result.ok, false);
  });

  it("rejects when a required open-ended question is missing", () => {
    const incompleteResponses = COMPLETE_SUBJECTIVE_NARRATIVE_INPUT.responses.filter(
      (r) => r.questionId !== "onsetOrChange",
    );
    const result = validatePostStrokeIntakeCompletion(
      completionPayload({
        subjectiveNarrative: { responses: incompleteResponses },
      }),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("accepts a complete narrative without additionalInformation — it remains optional", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const narrative = subjectiveNarrativeFrom(result);
    const responses = narrative?.responses as Array<{ questionId: string }>;
    assert.ok(!responses.some((r) => r.questionId === "additionalInformation"));
  });

  it("preserves respondent, urgentGate, and functionalIntake alongside the confirmed narrative", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const postStroke = result.structuredData.postStrokeIntake as Record<string, unknown>;
    assert.deepEqual(postStroke.respondent, { type: "patient" });
    assert.ok(postStroke.functionalIntake);
    assert.ok(postStroke.urgentGate);
  });

  it("never produces a diagnosis, fall-risk score, or delivery-mode field", () => {
    const result = validatePostStrokeIntakeCompletion(completionPayload(), true);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.structuredData);
    assert.doesNotMatch(serialized, /diagnos|severity|\bsafe\b|unsafe|cleared|remote_self|remote_supervised|in_clinic|risk_score/i);
  });
});
