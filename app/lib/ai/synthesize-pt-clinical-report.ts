/**
 * AI-assisted PT clinical report synthesis from approved Clinical English.
 * Uses the project's existing OpenAI chat completion pattern (injectable for tests).
 */
import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";
import { FORBIDDEN_INTERPRETATION_TERMS } from "@/app/lib/reports/assessment-interpretation-draft";
import {
  buildPtClinicalReportDraftFromSections,
  type ApprovedClinicalEnglishPayload,
  type PtClinicalReportDraft,
  type PtClinicalReportSection,
  type PtReportSectionId,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

export type PtReportSynthesisResult =
  | { ok: true; report: PtClinicalReportDraft }
  | { ok: false; code: TranslationErrorCode | "no_content" | "invalid_output" | "forbidden_terms" };

const SECTION_IDS = PT_REPORT_SECTION_SPECS.map((spec) => spec.id);

const SYNTHESIS_SYSTEM_PROMPT = `You are a physiotherapy clinical documentation assistant for RASQ.

Your task: synthesize APPROVED patient-reported Clinical English into a structured PT Clinical Report draft for physiotherapist review.

You may:
- Summarize and organize related patient-reported information across sections
- Convert patient language into concise PT clinical documentation
- Identify functional themes for therapist review
- Suggest appropriate objective assessment areas/modules for therapist consideration
- Use cautious clinical reasoning language such as "may indicate", "for therapist review", "consider assessing"

You must NOT:
- Diagnose or name pathology as fact
- Invent objective findings (ROM, strength, neurological, functional test results, examination findings)
- Infer pathology, severity, or laterality not supported by the approved source data
- Prescribe treatment automatically
- Add information unsupported by the approved source data
- Present patient statements as confirmed objective findings

Required phrasing patterns:
- Use "The patient reports...", "Patient-reported...", or "Based on the submitted questionnaire..." for patient-reported content
- Use "Consider assessing..." or "May warrant examination..." for suggested assessment areas
- Never use "the patient has [condition]" as a confirmed finding

Return a single JSON object with EXACTLY this shape:
{
  "sections": [
    {
      "id": "<one of: ${SECTION_IDS.join(", ")}>",
      "paragraphs": ["string"],
      "bullets": ["string"]
    }
  ]
}

Rules:
- Include ALL ${SECTION_IDS.length} sections in order, each id exactly once
- paragraphs and bullets are string arrays (may be empty)
- Do not include section titles — only id, paragraphs, bullets
- Do not include any keys other than "sections"
- Respond with valid JSON only — no markdown, no explanation`;

function buildUserPrompt(payload: ApprovedClinicalEnglishPayload): string {
  const fieldLines = payload.fields
    .map((field) => `- [${field.section} / ${field.label}] (${field.fieldKey}): ${field.clinicalEnglish}`)
    .join("\n");

  return `Approved Clinical English source data (patient-reported only):

Source language: ${payload.sourceLanguage}
Patient-reported pain score (numeric): ${payload.painScore ?? "not documented"}
Red-flag indicator from questionnaire: ${payload.hasRedFlag ? "yes — flag for therapist review" : "no specific red flag documented"}

Approved fields:
${fieldLines || "(no free-text fields)"}

Synthesize the PT Clinical Report draft JSON now.`;
}

function safeJsonObjectParse(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsForbiddenTerm(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return FORBIDDEN_INTERPRETATION_TERMS.some((term) => normalized.includes(term.trim()));
}

function reportContainsForbiddenTerms(sections: PtClinicalReportSection[]): boolean {
  for (const section of sections) {
    for (const line of [...section.paragraphs, ...section.bullets]) {
      if (containsForbiddenTerm(line)) return true;
    }
  }
  return false;
}

export function validateAndNormalizePtReportSections(
  rawSections: unknown,
): PtClinicalReportSection[] | null {
  if (!Array.isArray(rawSections)) return null;

  const byId = new Map<PtReportSectionId, { paragraphs: string[]; bullets: string[] }>();
  for (const item of rawSections) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== "string" || !SECTION_IDS.includes(id as PtReportSectionId)) continue;
    byId.set(id as PtReportSectionId, {
      paragraphs: asStringArray(record.paragraphs),
      bullets: asStringArray(record.bullets),
    });
  }

  if (byId.size !== SECTION_IDS.length) return null;

  return PT_REPORT_SECTION_SPECS.map((spec) => {
    const content = byId.get(spec.id)!;
    return {
      id: spec.id,
      title: spec.title,
      paragraphs: content.paragraphs,
      bullets: content.bullets,
    };
  });
}

export async function synthesizePtClinicalReport(
  apiKey: string,
  payload: ApprovedClinicalEnglishPayload,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
): Promise<PtReportSynthesisResult> {
  let raw: string;
  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(payload) },
      ],
    });
    raw = response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    const classified = classifyOpenAiError(error);
    return { ok: false, code: classified.code };
  }

  if (!raw) return { ok: false, code: "no_content" };

  const parsed = safeJsonObjectParse(raw);
  if (!parsed) return { ok: false, code: "invalid_output" };

  const sections = validateAndNormalizePtReportSections(parsed.sections);
  if (!sections) return { ok: false, code: "invalid_output" };
  if (reportContainsForbiddenTerms(sections)) {
    return { ok: false, code: "forbidden_terms" };
  }

  const source = payload.sourceLanguage === "ar" ? "clinical_english" : "patient_english";
  return {
    ok: true,
    report: buildPtClinicalReportDraftFromSections(sections, {
      sourceLanguage: payload.sourceLanguage,
      source,
      generationMethod: "ai",
    }),
  };
}
