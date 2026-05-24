import type { TranslationErrorCode } from "@/app/lib/openai/classify-openai-error";

export const AI_ERROR_CODES = {
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  AI_KEY_MISSING: "AI_KEY_MISSING",
  AI_RATE_LIMITED: "AI_RATE_LIMITED",
  AI_INVALID_INPUT: "AI_INVALID_INPUT",
  AI_NO_CONTENT: "AI_NO_CONTENT",
  AI_CONTEXT_INVALID: "AI_CONTEXT_INVALID",
} as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];

const SAFE_MESSAGES: Record<AiErrorCode, string> = {
  [AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: "AI service is temporarily unavailable.",
  [AI_ERROR_CODES.AI_KEY_MISSING]: "AI service is not configured.",
  [AI_ERROR_CODES.AI_RATE_LIMITED]: "AI service rate limit reached. Try again shortly.",
  [AI_ERROR_CODES.AI_INVALID_INPUT]: "Invalid input for AI processing.",
  [AI_ERROR_CODES.AI_NO_CONTENT]: "AI service returned no content.",
  [AI_ERROR_CODES.AI_CONTEXT_INVALID]: "Request context is invalid or not found.",
};

export function aiErrorMessage(code: AiErrorCode): string {
  return SAFE_MESSAGES[code];
}

export function aiErrorHttpStatus(code: AiErrorCode): number {
  switch (code) {
    case AI_ERROR_CODES.AI_RATE_LIMITED:
      return 429;
    case AI_ERROR_CODES.AI_INVALID_INPUT:
      return 400;
    case AI_ERROR_CODES.AI_CONTEXT_INVALID:
      return 404;
    case AI_ERROR_CODES.AI_NO_CONTENT:
      return 502;
    case AI_ERROR_CODES.AI_KEY_MISSING:
    case AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE:
    default:
      return 503;
  }
}

export function fromKeyConfigCode(code: "not_configured" | "invalid_key"): AiErrorCode {
  return code === "not_configured"
    ? AI_ERROR_CODES.AI_KEY_MISSING
    : AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE;
}

export function fromOpenAiClassified(code: TranslationErrorCode): AiErrorCode {
  switch (code) {
    case "not_configured":
      return AI_ERROR_CODES.AI_KEY_MISSING;
    case "invalid_key":
    case "quota_or_billing":
    case "provider_error":
      return AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE;
    case "rate_limit":
      return AI_ERROR_CODES.AI_RATE_LIMITED;
    default:
      return AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE;
  }
}
