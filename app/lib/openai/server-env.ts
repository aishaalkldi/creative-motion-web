export type OpenAiKeyConfig =
  | { ok: true; apiKey: string }
  | { ok: false; code: "not_configured" | "invalid_key" };

/**
 * Resolve OPENAI_API_KEY without logging or exposing the value.
 * Trims whitespace and optional surrounding quotes from Vercel paste mistakes.
 */
export function resolveOpenAiApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY?.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "").trim();
  return unquoted || null;
}

export function isOpenAiKeyPrefixValid(apiKey: string): boolean {
  return apiKey.startsWith("sk-");
}

export function getOpenAiKeyConfig(): OpenAiKeyConfig {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, code: "not_configured" };
  }
  if (!isOpenAiKeyPrefixValid(apiKey)) {
    return { ok: false, code: "invalid_key" };
  }
  return { ok: true, apiKey };
}

/** Safe diagnostics for operator health checks — never returns the key. */
export function getOpenAiKeyDiagnostics(): {
  openaiKeyPresent: boolean;
  openaiKeyPrefixValid: boolean;
  openaiKeyLength: number;
} {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    return { openaiKeyPresent: false, openaiKeyPrefixValid: false, openaiKeyLength: 0 };
  }
  return {
    openaiKeyPresent: true,
    openaiKeyPrefixValid: isOpenAiKeyPrefixValid(apiKey),
    openaiKeyLength: apiKey.length,
  };
}

/** Clinician health endpoint payload — no key value, no PHI. */
export function getOpenAiHealthResponse(): {
  openaiKeyPresent: boolean;
  openaiKeyPrefixValid: boolean;
  openaiKeyLength: number;
  nodeEnv: string | null;
} {
  return {
    ...getOpenAiKeyDiagnostics(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}
