import OpenAI from "openai";
import {
  classifyOpenAiError,
  type TranslationErrorCode,
} from "@/app/lib/openai/classify-openai-error";
import {
  containsForbiddenClinicalClaim,
  type ApprovedPatientReportFacts,
} from "@/app/lib/reports/approved-patient-facts";

export const PT_MEDICAL_REPORT_DRAFT_STATUS = "draft" as const;

export type PtMedicalReportSectionKey =
  | "title"
  | "chiefComplaint"
  | "painAndSymptoms"
  | "aggravatingAndEasing"
  | "functionalLimitations"
  | "mobilityBalanceAndFalls"
  | "patientGoals"
  | "additionalInformation"
  | "clinicalReviewNote";

export type PtMedicalReportDraftSections = Partial<
  Record<PtMedicalReportSectionKey, string>
>;

export type PtMedicalReportDraft = {
  version: number;
  status: typeof PT_MEDICAL_REPORT_DRAFT_STATUS;
  generatedAt: string;
  sourceFactsVersion: number;
  sections: PtMedicalReportDraftSections;
};

export type PtMedicalReportGeneratorInput = {
  approvedAt: string;
  facts: ApprovedPatientReportFacts["facts"];
  chiefComplaintExtraction?: ApprovedPatientReportFacts["chiefComplaintExtraction"];
};

export type PtMedicalReportGenerationResult =
  | { ok: true; sections: PtMedicalReportDraftSections }
  | {
      ok: false;
      code: TranslationErrorCode | "no_content" | "invalid_output";
    };

export const PT_MEDICAL_REPORT_SECTION_KEYS: readonly PtMedicalReportSectionKey[] = [
  "title",
  "chiefComplaint",
  "painAndSymptoms",
  "aggravatingAndEasing",
  "functionalLimitations",
  "mobilityBalanceAndFalls",
  "patientGoals",
  "additionalInformation",
  "clinicalReviewNote",
] as const;

export const PT_MEDICAL_REPORT_SECTION_LABELS: Record<PtMedicalReportSectionKey, string> = {
  title: "Physical Therapy Assessment Report",
  chiefComplaint: "Patient-Reported Chief Complaint",
  painAndSymptoms: "Pain and Symptom Information",
  aggravatingAndEasing: "Aggravating and Easing Factors",
  functionalLimitations: "Functional Limitations",
  mobilityBalanceAndFalls: "Mobility, Balance, and Falls Information",
  patientGoals: "Patient Goals",
  additionalInformation: "Additional Patient-Reported Information",
  clinicalReviewNote: "Clinical Review Note",
};

export const PT_MEDICAL_REPORT_DRAFT_LABEL =
  "Draft — clinician review required" as const;

const DEFAULT_TITLE = PT_MEDICAL_REPORT_SECTION_LABELS.title;

const DEFAULT_CLINICAL_REVIEW_NOTE =
  "This draft is compiled from clinician-approved patient-reported information only. " +
  "It does not include examination findings or therapist clinical decisions. " +
  "Therapist review is required before any clinical use.";

const FORBIDDEN_PHRASES = [
  "diagnosis",
  "diagnosed",
  "prognosis",
  "treatment recommendation",
  "prescribe",
  "prescription",
  "recommend treatment",
  "physical examination revealed",
  "on examination",
  "objective findings",
] as const;

const MAX_SECTION_LENGTH = 4_000;

export const PT_MEDICAL_REPORT_SYSTEM_PROMPT = `You are a clinical documentation assistant for licensed physiotherapists.

Your task: write a structured English Physical Therapy medical report draft for therapist review ONLY, using strictly the clinician-approved patient-reported facts provided in JSON.

Return valid JSON with only these optional string section fields (omit any section with no supporting facts):
- title
- chiefComplaint
- painAndSymptoms
- aggravatingAndEasing
- functionalLimitations
- mobilityBalanceAndFalls
- patientGoals
- additionalInformation
- clinicalReviewNote

Rules:
- Use ONLY facts present in the approved JSON. Do not invent information.
- Organize approved facts into coherent clinical English narrative paragraphs — not a literal field-by-field list.
- Prefer cautious patient-reported wording such as "The patient reports…" or "The patient states…".
- Do NOT provide a diagnosis, prognosis, treatment plan, or examination findings.
- Do NOT recommend tests, exercises, or interventions.
- Do NOT claim objective examination or observation findings that were not provided.
- title should be "Physical Therapy Assessment Report" when included.
- clinicalReviewNote must state that the content is patient-reported and requires therapist review.
- Return JSON only — no markdown fences or preamble.`;

export function buildPtMedicalReportGeneratorInput(
  facts: ApprovedPatientReportFacts,
): PtMedicalReportGeneratorInput {
  const input: PtMedicalReportGeneratorInput = {
    approvedAt: facts.approvedAt,
    facts: { ...facts.facts },
  };
  if (facts.chiefComplaintExtraction) {
    input.chiefComplaintExtraction = { ...facts.chiefComplaintExtraction };
  }
  return input;
}

export function buildPtMedicalReportUserPrompt(input: PtMedicalReportGeneratorInput): string {
  return `Clinician-approved patient-reported facts (English only — use these exclusively):\n${JSON.stringify(input, null, 2)}`;
}

export function findForbiddenPhrasesInPtReport(text: string): string[] {
  const normalized = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => normalized.includes(phrase.toLowerCase()));
}

function sanitizeSectionText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_LENGTH);
}

export function omitEmptyPtReportSections(
  sections: PtMedicalReportDraftSections,
): PtMedicalReportDraftSections {
  const result: PtMedicalReportDraftSections = {};
  for (const key of PT_MEDICAL_REPORT_SECTION_KEYS) {
    const value = sections[key];
    if (typeof value === "string" && value.trim()) {
      result[key] = sanitizeSectionText(value);
    }
  }
  return result;
}

export function parsePtReportSectionsFromJson(raw: string): PtMedicalReportDraftSections | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const sections: PtMedicalReportDraftSections = {};
    for (const key of PT_MEDICAL_REPORT_SECTION_KEYS) {
      const value = parsed[key];
      if (value === undefined) continue;
      if (typeof value !== "string") return null;
      sections[key] = value;
    }

    if (Object.keys(sections).length === 0) return null;
    return sections;
  } catch {
    return null;
  }
}

export function validateAndSanitizePtReportSections(sections: PtMedicalReportDraftSections): {
  ok: boolean;
  sections: PtMedicalReportDraftSections;
  forbiddenPhrases: string[];
} {
  const normalized = omitEmptyPtReportSections({
    ...sections,
    title: sections.title?.trim() || DEFAULT_TITLE,
    clinicalReviewNote: sections.clinicalReviewNote?.trim() || DEFAULT_CLINICAL_REVIEW_NOTE,
  });

  const forbidden = new Set<string>();
  for (const value of Object.values(normalized)) {
    if (!value) continue;
    findForbiddenPhrasesInPtReport(value).forEach((phrase) => forbidden.add(phrase));
    if (containsForbiddenClinicalClaim(value)) {
      forbidden.add("forbidden clinical claim pattern");
    }
  }

  if (forbidden.size > 0) {
    return { ok: false, sections: normalized, forbiddenPhrases: [...forbidden] };
  }

  if (!normalized.clinicalReviewNote?.trim()) {
    return { ok: false, sections: normalized, forbiddenPhrases: ["missing clinicalReviewNote"] };
  }

  return { ok: true, sections: normalized, forbiddenPhrases: [] };
}

export function buildPtMedicalReportDraftRecord(
  existingDraft: PtMedicalReportDraft | null,
  facts: ApprovedPatientReportFacts,
  sections: PtMedicalReportDraftSections,
  generatedAt: string,
): PtMedicalReportDraft {
  const version = existingDraft ? existingDraft.version + 1 : 1;
  return {
    version,
    status: PT_MEDICAL_REPORT_DRAFT_STATUS,
    generatedAt,
    sourceFactsVersion: facts.version,
    sections: omitEmptyPtReportSections(sections),
  };
}

export function readPtMedicalReportDraft(structuredData: unknown): PtMedicalReportDraft | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const record = structuredData as Record<string, unknown>;
  const raw = record.ptMedicalReportDraft;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as Record<string, unknown>;
  if (candidate.status !== PT_MEDICAL_REPORT_DRAFT_STATUS) return null;
  if (typeof candidate.version !== "number" || !Number.isFinite(candidate.version) || candidate.version < 1) {
    return null;
  }
  if (typeof candidate.generatedAt !== "string" || !candidate.generatedAt.trim()) return null;
  if (typeof candidate.sourceFactsVersion !== "number" || !Number.isFinite(candidate.sourceFactsVersion)) {
    return null;
  }
  if (!candidate.sections || typeof candidate.sections !== "object" || Array.isArray(candidate.sections)) {
    return null;
  }

  const sections: PtMedicalReportDraftSections = {};
  for (const [key, value] of Object.entries(candidate.sections as Record<string, unknown>)) {
    if (
      (PT_MEDICAL_REPORT_SECTION_KEYS as readonly string[]).includes(key) &&
      typeof value === "string" &&
      value.trim()
    ) {
      sections[key as PtMedicalReportSectionKey] = sanitizeSectionText(value);
    }
  }

  if (Object.keys(sections).length === 0) return null;

  return {
    version: candidate.version,
    status: PT_MEDICAL_REPORT_DRAFT_STATUS,
    generatedAt: candidate.generatedAt.trim(),
    sourceFactsVersion: candidate.sourceFactsVersion,
    sections,
  };
}

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;

export async function generatePtMedicalReportSections(
  apiKey: string,
  facts: ApprovedPatientReportFacts,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
): Promise<PtMedicalReportGenerationResult> {
  const input = buildPtMedicalReportGeneratorInput(facts);

  let raw: string;
  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      max_tokens: 1_800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PT_MEDICAL_REPORT_SYSTEM_PROMPT },
        { role: "user", content: buildPtMedicalReportUserPrompt(input) },
      ],
    });
    raw = response.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    const classified = classifyOpenAiError(err);
    return { ok: false, code: classified.code };
  }

  if (!raw) {
    return { ok: false, code: "no_content" };
  }

  const parsed = parsePtReportSectionsFromJson(raw);
  if (!parsed) {
    return { ok: false, code: "invalid_output" };
  }

  const validated = validateAndSanitizePtReportSections(parsed);
  if (!validated.ok) {
    return { ok: false, code: "invalid_output" };
  }

  return { ok: true, sections: validated.sections };
}
