/**
 * Run: npx tsx --test app/lib/ai/translate-clinical-text.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import OpenAI from "openai";
import { translateClinicalText, type ChatCompletionCreator } from "./translate-clinical-text";

describe("translateClinicalText", () => {
  it("returns the translated text on success", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [{ message: { content: "Pain in the right shoulder when lifting the arm." } }],
    });

    const result = await translateClinicalText(
      "sk-test",
      "الألم في الكتف الأيمن عند رفع الذراع",
      fakeCreate,
    );

    assert.deepEqual(result, {
      ok: true,
      translation: "Pain in the right shoulder when lifting the arm.",
    });
  });

  it("returns no_content when the model returns an empty response", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({
      choices: [{ message: { content: "" } }],
    });
    const result = await translateClinicalText("sk-test", "نص عربي", fakeCreate);
    assert.deepEqual(result, { ok: false, code: "no_content" });
  });

  it("returns no_content when the model returns no choices at all", async () => {
    const fakeCreate: ChatCompletionCreator = async () => ({ choices: [] });
    const result = await translateClinicalText("sk-test", "نص عربي", fakeCreate);
    assert.deepEqual(result, { ok: false, code: "no_content" });
  });

  it("classifies an upstream 401 as invalid_key without leaking the raw error", async () => {
    const fakeCreate: ChatCompletionCreator = async () => {
      throw new OpenAI.APIError(401, { message: "Incorrect API key provided" }, "Incorrect API key provided", undefined);
    };
    const result = await translateClinicalText("sk-test", "نص عربي", fakeCreate);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_key");
    }
  });

  it("classifies an upstream 429 as rate_limit", async () => {
    const fakeCreate: ChatCompletionCreator = async () => {
      throw new OpenAI.APIError(429, { message: "Rate limit exceeded" }, "Rate limit exceeded", undefined);
    };
    const result = await translateClinicalText("sk-test", "نص عربي", fakeCreate);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "rate_limit");
    }
  });

  it("uses the exact patient text as the user message, unmodified", async () => {
    const original = "عندي ألم في الكتف الأيمن لما أرفع يدي.";
    let capturedUserContent = "";
    const fakeCreate: ChatCompletionCreator = async (params) => {
      const userMsg = params.messages.find((m) => m.role === "user");
      capturedUserContent = typeof userMsg?.content === "string" ? userMsg.content : "";
      return { choices: [{ message: { content: "translated" } }] };
    };
    await translateClinicalText("sk-test", original, fakeCreate);
    assert.equal(capturedUserContent, original);
  });
});
