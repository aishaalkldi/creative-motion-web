/**
 * Run: npx tsx --test app/lib/ai/extract-clinical-fields.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import OpenAI from "openai";
import {
  extractStructuredClinicalFields,
  validateExtraction,
  type ChatCompletionCreator,
} from "./extract-clinical-fields";

describe("validateExtraction", () => {
  it("accepts the shoulder acceptance example", () => {
    // Model output for: "عندي ألم في الكتف الأيمن لما أرفع يدي."
    const raw = {
      body_region: "shoulder",
      side: "right",
      primary_symptom: "pain",
      aggravating_factor: "overhead arm elevation",
      language: "ar",
      confidence: 0.92,
    };

    const result = validateExtraction(raw, "ar");

    assert.deepEqual(result, {
      body_region: "shoulder",
      side: "right",
      primary_symptom: "pain",
      aggravating_factor: "overhead arm elevation",
      language: "ar",
      confidence: 0.92,
    });
  });

  it("returns exactly six keys, never more", () => {
    const raw = { body_region: "shoulder", side: "right", primary_symptom: "pain" };
    const result = validateExtraction(raw, "ar");
    assert.deepEqual(Object.keys(result).sort(), [
      "aggravating_factor",
      "body_region",
      "confidence",
      "language",
      "primary_symptom",
      "side",
    ]);
  });

  it("strips an invented diagnosis field instead of forwarding it", () => {
    const raw = {
      body_region: "shoulder",
      side: "right",
      primary_symptom: "pain",
      diagnosis: "rotator cuff tear",
      treatment_recommendation: "physical therapy 3x/week",
    };
    const result = validateExtraction(raw, "ar") as unknown as Record<string, unknown>;
    assert.equal("diagnosis" in result, false);
    assert.equal("treatment_recommendation" in result, false);
  });

  it("defaults out-of-enum body_region to unclear instead of passing it through", () => {
    const raw = { body_region: "elbow_fracture_grade_3", side: "right", primary_symptom: "pain" };
    const result = validateExtraction(raw, "ar");
    assert.equal(result.body_region, "unclear");
  });

  it("defaults out-of-enum side to unclear", () => {
    const raw = { body_region: "shoulder", side: "sideways", primary_symptom: "pain" };
    const result = validateExtraction(raw, "ar");
    assert.equal(result.side, "unclear");
  });

  it("defaults out-of-enum primary_symptom to other", () => {
    const raw = { body_region: "shoulder", side: "right", primary_symptom: "burning_sensation_severe" };
    const result = validateExtraction(raw, "ar");
    assert.equal(result.primary_symptom, "other");
  });

  it("nulls a non-string aggravating_factor", () => {
    const raw = { body_region: "shoulder", side: "right", primary_symptom: "pain", aggravating_factor: 12345 };
    const result = validateExtraction(raw, "ar");
    assert.equal(result.aggravating_factor, null);
  });

  it("truncates an overlong aggravating_factor", () => {
    const raw = {
      body_region: "shoulder",
      side: "right",
      primary_symptom: "pain",
      aggravating_factor: "x".repeat(1000),
    };
    const result = validateExtraction(raw, "ar");
    assert.equal(result.aggravating_factor?.length, 300);
  });

  it("clamps confidence into [0, 1]", () => {
    assert.equal(
      validateExtraction({ body_region: "shoulder", side: "right", primary_symptom: "pain", confidence: 5 }, "ar")
        .confidence,
      1,
    );
    assert.equal(
      validateExtraction({ body_region: "shoulder", side: "right", primary_symptom: "pain", confidence: -3 }, "ar")
        .confidence,
      0,
    );
  });

  it("defaults confidence to 0 when missing or non-numeric", () => {
    assert.equal(
      validateExtraction({ body_region: "shoulder", side: "right", primary_symptom: "pain" }, "ar").confidence,
      0,
    );
    assert.equal(
      validateExtraction(
        { body_region: "shoulder", side: "right", primary_symptom: "pain", confidence: "very confident" },
        "ar",
      ).confidence,
      0,
    );
  });

  it("falls back to the caller-supplied language when the model omits it or returns an invalid value", () => {
    assert.equal(
      validateExtraction({ body_region: "shoulder", side: "right", primary_symptom: "pain" }, "ar").language,
      "ar",
    );
    assert.equal(
      validateExtraction(
        { body_region: "shoulder", side: "right", primary_symptom: "pain", language: "fr" },
        "en",
      ).language,
      "en",
    );
  });

  it("defaults every field safely on a completely empty object", () => {
    const result = validateExtraction({}, "ar");
    assert.deepEqual(result, {
      body_region: "unclear",
      side: "unclear",
      primary_symptom: "other",
      aggravating_factor: null,
      language: "ar",
      confidence: 0,
    });
  });
});

describe("extractStructuredClinicalFields", () => {
  it("returns the acceptance-example extraction end-to-end through a fake model call", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              body_region: "shoulder",
              side: "right",
              primary_symptom: "pain",
              aggravating_factor: "overhead arm elevation",
              language: "ar",
              confidence: 0.92,
            }),
          },
        },
      ],
    });

    const result = await extractStructuredClinicalFields(
      "sk-test",
      "عندي ألم في الكتف الأيمن لما أرفع يدي.",
      "ar",
      fakeCreate,
    );

    assert.deepEqual(result, {
      ok: true,
      extraction: {
        body_region: "shoulder",
        side: "right",
        primary_symptom: "pain",
        aggravating_factor: "overhead arm elevation",
        language: "ar",
        confidence: 0.92,
      },
    });
  });

  it("rejects unparseable JSON from the model as invalid_output", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [{ message: { content: "not json at all {{{" } }],
    });
    const result = await extractStructuredClinicalFields("sk-test", "نص", "ar", fakeCreate);
    assert.deepEqual(result, { ok: false, code: "invalid_output" });
  });

  it("rejects a JSON array (not an object) from the model as invalid_output", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [{ message: { content: "[1, 2, 3]" } }],
    });
    const result = await extractStructuredClinicalFields("sk-test", "نص", "ar", fakeCreate);
    assert.deepEqual(result, { ok: false, code: "invalid_output" });
  });

  it("returns no_content when the model returns an empty response", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [{ message: { content: "" } }],
    });
    const result = await extractStructuredClinicalFields("sk-test", "نص", "ar", fakeCreate);
    assert.deepEqual(result, { ok: false, code: "no_content" });
  });

  it("safely handles a model response that includes an invented diagnosis field", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              body_region: "shoulder",
              side: "right",
              primary_symptom: "pain",
              diagnosis: "possible rotator cuff tear",
              recommended_treatment: "physiotherapy",
            }),
          },
        },
      ],
    });
    const result = await extractStructuredClinicalFields("sk-test", "نص", "ar", fakeCreate);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal("diagnosis" in result.extraction, false);
      assert.equal("recommended_treatment" in result.extraction, false);
    }
  });

  it("classifies an upstream 401 as invalid_key without leaking the raw error", async () => {
    const fakeCreate: ChatCompletionCreator = async () => {
      throw new OpenAI.APIError(401, { message: "Incorrect API key provided" }, "Incorrect API key provided", undefined);
    };
    const result = await extractStructuredClinicalFields("sk-test", "نص", "ar", fakeCreate);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_key");
    }
  });
});
