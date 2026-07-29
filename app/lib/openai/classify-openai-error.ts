import OpenAI from "openai";

export type TranslationErrorCode =
  | "not_configured"
  | "invalid_key"
  | "quota_or_billing"
  | "rate_limit"
  | "invalid_request"
  | "provider_error";

export type SafeOpenAiErrorDiagnostics = {
  errorClass: string;
  httpStatus: number | null;
  providerCode: string | null;
  providerParam: string | null;
  requestId: string | null;
};

type ClassifiedError = {
  code: TranslationErrorCode;
  httpStatus: number;
  message: string;
};

export function extractSafeOpenAiErrorDiagnostics(error: unknown): SafeOpenAiErrorDiagnostics {
  if (error instanceof OpenAI.APIError) {
    return {
      errorClass: error.constructor.name,
      httpStatus: error.status ?? null,
      providerCode: error.code ?? null,
      providerParam: error.param ?? null,
      requestId: error.requestID ?? null,
    };
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return {
      errorClass: error.constructor.name,
      httpStatus: null,
      providerCode: null,
      providerParam: null,
      requestId: null,
    };
  }

  return {
    errorClass: error instanceof Error ? error.constructor.name : "UnknownError",
    httpStatus: null,
    providerCode: null,
    providerParam: null,
    requestId: null,
  };
}

/** Safe for server logs — never includes prompts, patient text, keys, or raw provider bodies. */
export function formatSafeOpenAiErrorLog(diagnostics: SafeOpenAiErrorDiagnostics): string {
  return JSON.stringify({
    errorClass: diagnostics.errorClass,
    httpStatus: diagnostics.httpStatus,
    providerCode: diagnostics.providerCode,
    providerParam: diagnostics.providerParam,
    requestId: diagnostics.requestId,
  });
}

export function classifyOpenAiError(error: unknown): ClassifiedError {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 400) {
      return {
        code: "invalid_request",
        httpStatus: 502,
        message: "Translation service rejected the request.",
      };
    }
    if (error.status === 401) {
      return {
        code: "invalid_key",
        httpStatus: 503,
        message: "Translation service authentication failed.",
      };
    }
    if (error.status === 429) {
      return {
        code: "rate_limit",
        httpStatus: 503,
        message: "Translation service is temporarily rate limited.",
      };
    }
    if (error.status === 402 || error.status === 403) {
      return {
        code: "quota_or_billing",
        httpStatus: 503,
        message: "Translation service billing or quota issue.",
      };
    }
    return {
      code: "provider_error",
      httpStatus: 503,
      message: "Translation service unavailable.",
    };
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("incorrect api key") || message.includes("invalid api key")) {
    return {
      code: "invalid_key",
      httpStatus: 503,
      message: "Translation service authentication failed.",
    };
  }
  if (message.includes("insufficient_quota") || message.includes("billing")) {
    return {
      code: "quota_or_billing",
      httpStatus: 503,
      message: "Translation service billing or quota issue.",
    };
  }
  if (message.includes("rate limit") || message.includes("rate_limit")) {
    return {
      code: "rate_limit",
      httpStatus: 503,
      message: "Translation service is temporarily rate limited.",
    };
  }

  return {
    code: "provider_error",
    httpStatus: 503,
    message: "Translation service unavailable.",
  };
}
