import OpenAI from "openai";

export type TranslationErrorCode =
  | "not_configured"
  | "invalid_key"
  | "quota_or_billing"
  | "rate_limit"
  | "provider_error";

type ClassifiedError = {
  code: TranslationErrorCode;
  httpStatus: number;
  message: string;
};

export function classifyOpenAiError(error: unknown): ClassifiedError {
  if (error instanceof OpenAI.APIError) {
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
