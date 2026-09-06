import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";
import { normalizeClinicalEnglishText } from "@/app/lib/reports/normalize-clinical-english";
import type { QuestionnaireFieldSpec } from "@/app/lib/reports/questionnaire-clinical-field-registry";

export type ClinicalTranslationContext = {
  fieldKey: string;
  questionLabel: string;
  sectionTitle: string;
  clinicalConcept: string;
  valueType: string;
  isVoiceTranscription?: boolean;
};

const TRANSLATION_SYSTEM_PROMPT = `You are a clinical Arabic-to-English translator for physiotherapy remote questionnaire responses.

Translate the patient's statement into concise, professional patient-reported Clinical English for physiotherapist review.

Rules:
- Translate only what the patient stated in this specific questionnaire field.
- Preserve meaning, laterality, severity, timing, and numbers where actually reported.
- Use third-person patient-reported phrasing when natural: "The patient reports..." or "Patient-reported..."
- Remove obvious speech fillers and repeated words in the translation output.
- Do not add clinical interpretation, diagnosis, pathology labels, or examination findings.
- Do not infer laterality, severity, or pathology not supported by the source wording.
- If meaning is genuinely uncertain, preserve uncertainty in cautious clinical language rather than guessing.
- Do not insert translator notes, brackets, or meta-commentary in the output.
- Do not translate numeric values.
- Return only the translated text with no preamble or quotation marks.`;

function buildContextualUserPrompt(text: string, context?: ClinicalTranslationContext): string {
  if (!context) return text;
  const voiceNote = context.isVoiceTranscription
    ? "Source: voice transcription — clean fillers but preserve meaning."
    : "Source: typed patient response.";
  return `Questionnaire field context:
- Field key: ${context.fieldKey}
- Question: ${context.questionLabel}
- Section: ${context.sectionTitle}
- Clinical concept: ${context.clinicalConcept}
- Value type: ${context.valueType}
- ${voiceNote}

Patient statement:
${text}`;
}

export type ClinicalTranslationResult =
  | { ok: true; translation: string }
  | { ok: false; code: TranslationErrorCode | "no_content" };

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

export async function translateClinicalText(
  apiKey: string,
  text: string,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
  context?: ClinicalTranslationContext,
): Promise<ClinicalTranslationResult> {
  let raw: string;
  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        { role: "system", content: TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: buildContextualUserPrompt(text, context) },
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

  const normalized = normalizeClinicalEnglishText(raw);
  return { ok: true, translation: normalized.text };
}

export function buildTranslationContextFromSpec(
  spec: QuestionnaireFieldSpec,
  isVoiceTranscription = false,
): ClinicalTranslationContext {
  return {
    fieldKey: spec.fieldKey,
    questionLabel: spec.label,
    sectionTitle: spec.sectionTitle,
    clinicalConcept: spec.clinicalConcept,
    valueType: spec.valueType,
    isVoiceTranscription,
  };
}
