import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";

/**
 * Constrained structured-field extraction from a patient's own statement
 * (Arabic or English). Extraction only — never a diagnosis, treatment
 * recommendation, or any field beyond the fixed six below. The model's
 * JSON output is never trusted as-is: every field is validated and
 * clamped server-side, and any unexpected key is discarded.
 */

export type BodyRegion =
  | "shoulder"
  | "knee"
  | "back"
  | "hip"
  | "ankle"
  | "neck"
  | "other"
  | "unclear";

export type ExtractionSide = "left" | "right" | "bilateral" | "unclear";

export type PrimarySymptom =
  | "pain"
  | "weakness"
  | "numbness"
  | "stiffness"
  | "instability"
  | "other";

export type ExtractionLanguage = "ar" | "en";

export interface StructuredExtraction {
  body_region: BodyRegion;
  side: ExtractionSide;
  primary_symptom: PrimarySymptom;
  aggravating_factor: string | null;
  language: ExtractionLanguage;
  confidence: number;
}

export type ClinicalExtractionResult =
  | { ok: true; extraction: StructuredExtraction }
  | { ok: false; code: TranslationErrorCode | "no_content" | "invalid_output" };

const BODY_REGIONS: readonly BodyRegion[] = [
  "shoulder", "knee", "back", "hip", "ankle", "neck", "other", "unclear",
];
const SIDES: readonly ExtractionSide[] = ["left", "right", "bilateral", "unclear"];
const SYMPTOMS: readonly PrimarySymptom[] = [
  "pain", "weakness", "numbness", "stiffness", "instability", "other",
];
const MAX_AGGRAVATING_FACTOR_LENGTH = 300;

const EXTRACTION_SYSTEM_PROMPT = `You are a clinical information extraction assistant for a physiotherapy pre-assessment intake system.

Your ONLY task: read the patient's own statement (in Arabic or English) and extract structured facts about what they said. You must NEVER diagnose, NEVER recommend treatment or tests, and NEVER add any clinical conclusion beyond what the patient explicitly stated.

Return a single JSON object with EXACTLY these six fields, no others:
- body_region: one of "shoulder", "knee", "back", "hip", "ankle", "neck", "other", "unclear"
- side: one of "left", "right", "bilateral", "unclear"
- primary_symptom: one of "pain", "weakness", "numbness", "stiffness", "instability", "other"
- aggravating_factor: a short English phrase describing what makes it worse, or null if not mentioned
- language: "ar" or "en" — the language the patient's statement is written in
- confidence: a number from 0 to 1 for how confident you are in this extraction

Rules:
- Extract only what the patient explicitly stated.
- Do not infer symptoms, causes, or conditions not mentioned.
- Do not provide a diagnosis, prognosis, or treatment recommendation.
- Do not include any field other than the six listed above.
- If a field cannot be determined, use "unclear" (body_region/side), "other" (primary_symptom), or null (aggravating_factor).
- Respond with valid JSON only — no explanation, no markdown, no extra text.`;

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

/**
 * `createChatCompletion` is injectable so unit tests can exercise the
 * parsing/validation logic without depending on module-mocking the
 * (CommonJS) "openai" SDK — defaults to a real client in production.
 */
export async function extractStructuredClinicalFields(
  apiKey: string,
  text: string,
  language: ExtractionLanguage,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
): Promise<ClinicalExtractionResult> {
  let raw: string;
  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Patient statement (${language === "ar" ? "Arabic" : "English"}): ${text}`,
        },
      ],
    });
    raw = response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    const classified = classifyOpenAiError(error);
    return { ok: false, code: classified.code };
  }

  if (!raw) {
    return { ok: false, code: "no_content" };
  }

  const parsed = safeJsonObjectParse(raw);
  if (!parsed) {
    return { ok: false, code: "invalid_output" };
  }

  return { ok: true, extraction: validateExtraction(parsed, language) };
}

function safeJsonObjectParse(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whitelists and clamps every field. The return value only ever contains
 * these six keys — any other key the model produced (e.g. a diagnosis
 * or treatment suggestion) is silently discarded, never forwarded.
 */
export function validateExtraction(
  raw: Record<string, unknown>,
  fallbackLanguage: ExtractionLanguage,
): StructuredExtraction {
  const body_region = isOneOf(raw.body_region, BODY_REGIONS) ? raw.body_region : "unclear";
  const side = isOneOf(raw.side, SIDES) ? raw.side : "unclear";
  const primary_symptom = isOneOf(raw.primary_symptom, SYMPTOMS) ? raw.primary_symptom : "other";

  const aggravating_factor =
    typeof raw.aggravating_factor === "string" && raw.aggravating_factor.trim()
      ? raw.aggravating_factor.trim().slice(0, MAX_AGGRAVATING_FACTOR_LENGTH)
      : null;

  const language = raw.language === "ar" || raw.language === "en" ? raw.language : fallbackLanguage;

  const confidenceRaw = typeof raw.confidence === "number" ? raw.confidence : Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0;

  return { body_region, side, primary_symptom, aggravating_factor, language, confidence };
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
