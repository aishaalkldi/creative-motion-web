/**
 * AI-assisted PT clinical report synthesis from approved Clinical English.
 */
import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";
import { FORBIDDEN_INTERPRETATION_TERMS } from "@/app/lib/reports/assessment-interpretation-draft";
import { polishPtClinicalReportDraft } from "@/app/lib/reports/polish-pt-clinical-report";
import {
  buildPtClinicalReportDraftFromSections,
  type PtClinicalReportDraft,
  type PtClinicalReportSection,
  type PtReportSectionId,
  PT_REPORT_SECTION_SPECS,
} from "@/app/lib/reports/pt-clinical-report-schema";
import { listRasqModuleLabels } from "@/app/lib/reports/rasq-assessment-modules";
import {
  bundleToPromptText,
  type StructuredClinicalSourceBundle,
} from "@/app/lib/reports/structured-clinical-source-bundle";

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

export type PtReportSynthesisResult =
  | { ok: true; report: PtClinicalReportDraft }
  | { ok: false; code: TranslationErrorCode | "no_content" | "invalid_output" | "forbidden_terms" };

const SECTION_IDS = PT_REPORT_SECTION_SPECS.map((spec) => spec.id);
const ALLOWED_RASQ = listRasqModuleLabels().join(", ");

const SYNTHESIS_SYSTEM_PROMPT = `You are a physiotherapy clinical documentation assistant for RASQ.

Synthesize APPROVED patient-reported Clinical English into a concise PT Clinical Report draft for physiotherapist review.

You must SYNTHESIZE, not concatenate or repeat source fields.

Section purposes:
- presentation: brief overview of patient-reported presentation only
- primary_complaint: main concern in 1-2 concise statements
- pain_symptom_behavior: aggravating, relieving, and movement-related symptom behavior
- functional_limitations: activity/task limitations and weakness-related functional impact
- activity_participation: balance, gait, standing tolerance, walking tolerance, stairs, aids
- patient_goals: goals only
- pt_interpretation: cautious physiotherapy reasoning about domains needing objective examination — NOT a diagnosis and NOT a restatement of every bullet
- safety: red-flag review language only
- suggested_objective: clinically meaningful assessment domains (movement quality, ROM, strength, balance, gait, hand function) — use "Consider assessing..."
- suggested_rasq_modules: only modules from this allowlist: ${ALLOWED_RASQ}

Rules:
- Each clinical fact should appear once in the most appropriate section.
- Do not copy every source field as its own bullet.
- Use patient-reported phrasing: "The patient reports...", "Patient-reported...", "Based on the submitted questionnaire..."
- Never claim objective examination findings, measured ROM, strength grades, or pathology as fact.
- Never diagnose.
- Preserve durations as durations and anatomical regions as anatomical regions.
- If weakness and pain with movement are both reported, keep them as separate concepts.
- Respond with valid JSON only:
{
  "sections": [
    { "id": "<section id>", "paragraphs": ["string"], "bullets": ["string"] }
  ]
}
Include all ${SECTION_IDS.length} section ids exactly once.`;

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
  bundle: StructuredClinicalSourceBundle,
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
        {
          role: "user",
          content: `Approved structured Clinical English source bundle:\n\n${bundleToPromptText(bundle)}\n\nSynthesize the concise PT Clinical Report JSON now.`,
        },
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

  const source = bundle.sourceLanguage === "ar" ? "clinical_english" : "patient_english";
  const draft = buildPtClinicalReportDraftFromSections(sections, {
    sourceLanguage: bundle.sourceLanguage,
    source,
    generationMethod: "ai",
  });

  return {
    ok: true,
    report: polishPtClinicalReportDraft(draft, bundle),
  };
}
