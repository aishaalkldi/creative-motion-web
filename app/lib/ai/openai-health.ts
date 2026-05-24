import OpenAI from "openai";
import { classifyOpenAiError } from "@/app/lib/openai/classify-openai-error";
import {
  getOpenAiKeyConfig,
  getOpenAiKeyDiagnostics,
  resolveOpenAiApiKey,
} from "@/app/lib/openai/server-env";
import {
  AI_ERROR_CODES,
  fromOpenAiClassified,
  type AiErrorCode,
} from "@/app/lib/ai/ai-errors";

export type OpenAiHealthReport = {
  openaiKeyPresent: boolean;
  openaiKeyPrefixValid: boolean;
  openaiKeyLength: number;
  apiReachable: boolean;
  apiError: AiErrorCode | null;
  nodeEnv: string | null;
  timestamp: string;
};

async function probeOpenAiReachability(apiKey: string): Promise<{
  reachable: boolean;
  errorCode: AiErrorCode | null;
}> {
  try {
    const openai = new OpenAI({ apiKey, timeout: 8_000 });
    await openai.models.list();
    return { reachable: true, errorCode: null };
  } catch (error) {
    const classified = classifyOpenAiError(error);
    return {
      reachable: false,
      errorCode: fromOpenAiClassified(classified.code),
    };
  }
}

/** Safe OpenAI health diagnostics — never returns the key or PHI. */
export async function buildOpenAiHealthReport(): Promise<OpenAiHealthReport> {
  const timestamp = new Date().toISOString();
  const diagnostics = getOpenAiKeyDiagnostics();
  const keyConfig = getOpenAiKeyConfig();

  if (!resolveOpenAiApiKey()) {
    return {
      ...diagnostics,
      apiReachable: false,
      apiError: AI_ERROR_CODES.AI_KEY_MISSING,
      nodeEnv: process.env.NODE_ENV ?? null,
      timestamp,
    };
  }

  if (!keyConfig.ok) {
    return {
      ...diagnostics,
      apiReachable: false,
      apiError: AI_ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      nodeEnv: process.env.NODE_ENV ?? null,
      timestamp,
    };
  }

  const probe = await probeOpenAiReachability(keyConfig.apiKey);

  return {
    ...diagnostics,
    apiReachable: probe.reachable,
    apiError: probe.errorCode,
    nodeEnv: process.env.NODE_ENV ?? null,
    timestamp,
  };
}
