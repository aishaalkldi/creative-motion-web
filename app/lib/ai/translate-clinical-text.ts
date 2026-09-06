import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";

/**
 * Core Arabic-to-English clinical translation call, shared by the
 * clinician-authenticated report route and the token-authenticated
 * remote pre-assessment route. Prompt and model are unchanged from
 * the original /api/assessments/[id]/translate implementation.
 */
const TRANSLATION_SYSTEM_PROMPT = `You are a clinical Arabic-to-English translator for physiotherapy assessment reports.

Your task: translate the provided Arabic patient statement into concise, professional physiotherapy/clinical English for clinician review.

Rules:
- Translate only what the patient stated.
- Preserve the original meaning; do not change, add, or omit clinical content.
- Frame patient statements in third person when natural, e.g. "The patient reports..." or "Patient-reported..."
- Do not add clinical interpretation, diagnosis, or pathology labels.
- Do not infer symptoms, severity, laterality, pathology, or examination findings not explicitly mentioned.
- Do not generate diagnosis or clinical impression.
- Do not add medical terminology not supported by the original wording.
- Use concise clinical English phrasing suitable for physiotherapy documentation — avoid unnecessarily literal first-person wording.
- Distinguish patient-reported information from clinician-observed information (only patient-reported content appears here).
- If a word is ambiguous, use the most literal translation and add [translator note: ambiguous term] in brackets.
- Return only the translated text.
- Do not include preamble, explanation, or quotation marks.
- Do not translate numeric values.

Examples:
Arabic: الألم في الكتف الأيمن عند رفع الذراع
English: The patient reports pain in the right shoulder when lifting the arm.

Arabic: عندي ضعف في عضلات اليد اليمنى
English: The patient reports weakness affecting the right hand.

Output format: translated clinical English text only, one paragraph.`;

export type ClinicalTranslationResult =
  | { ok: true; translation: string }
  | { ok: false; code: TranslationErrorCode | "no_content" };

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

/**
 * `createChatCompletion` is injectable so unit tests can exercise the
 * classification/parsing logic without depending on module-mocking the
 * (CommonJS) "openai" SDK — defaults to a real client in production.
 */
export async function translateClinicalText(
  apiKey: string,
  text: string,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
): Promise<ClinicalTranslationResult> {
  let raw: string;
  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        { role: "system", content: TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: text },
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

  return { ok: true, translation: raw };
}
