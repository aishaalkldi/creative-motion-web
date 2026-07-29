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
