/**
 * Run: npx tsx --test app/lib/openai/classify-openai-error.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import OpenAI from "openai";
import {
  classifyOpenAiError,
  extractSafeOpenAiErrorDiagnostics,
  formatSafeOpenAiErrorLog,
} from "./classify-openai-error";

describe("classifyOpenAiError", () => {
  it("maps provider 400 invalid schema to invalid_request", () => {
    const error = OpenAI.APIError.generate(
      400,
      {
        error: {
          message: "Invalid schema: required must include every property",
          type: "invalid_request_error",
          param: "response_format",
          code: "invalid_json_schema",
        },
      },
      undefined,
      new Headers({ "x-request-id": "req_schema400" }),
    );
    const classified = classifyOpenAiError(error);
    assert.equal(classified.code, "invalid_request");
    assert.equal(classified.httpStatus, 502);
  });

  it("maps authentication failures to invalid_key", () => {
    const error = OpenAI.APIError.generate(
      401,
      { error: { message: "Incorrect API key provided", type: "invalid_request_error" } },
      undefined,
      new Headers(),
    );
    assert.equal(classifyOpenAiError(error).code, "invalid_key");
  });
});

describe("extractSafeOpenAiErrorDiagnostics", () => {
  it("records only safe provider metadata", () => {
    const error = OpenAI.APIError.generate(
      400,
      {
        error: {
          message: "Invalid schema with secret patient complaint text",
          type: "invalid_request_error",
          param: "response_format",
          code: "invalid_json_schema",
        },
      },
      undefined,
      new Headers({ "x-request-id": "req_safe_diag" }),
    );

    const diagnostics = extractSafeOpenAiErrorDiagnostics(error);
    assert.equal(diagnostics.errorClass, "BadRequestError");
    assert.equal(diagnostics.httpStatus, 400);
    assert.equal(diagnostics.providerCode, "invalid_json_schema");
    assert.equal(diagnostics.providerParam, "response_format");
    assert.equal(diagnostics.requestId, "req_safe_diag");

    const logLine = formatSafeOpenAiErrorLog(diagnostics);
    assert.match(logLine, /BadRequestError/);
    assert.match(logLine, /invalid_json_schema/);
    assert.match(logLine, /response_format/);
    assert.match(logLine, /req_safe_diag/);
    assert.doesNotMatch(logLine, /secret patient complaint|Invalid schema with/i);
  });
});
