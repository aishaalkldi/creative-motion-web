import OpenAI from "openai";
import {
  classifyOpenAiError,
  extractSafeOpenAiErrorDiagnostics,
  formatSafeOpenAiErrorLog,
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
  title: "Patient-Reported Subjective Summary",
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

/** Exact required label for post_stroke_intake drafts — the remote_questionnaire label above is never changed. */
export const POST_STROKE_INTAKE_DRAFT_LABEL =
  "AI-generated draft — requires therapist review" as const;

export const PT_MEDICAL_REPORT_APPROVED_LABEL =
  "Report approved for print and PDF." as const;

/** Concise clinical-completeness status: this document is Subjective-only until Objective assessment integration ships. */
export const PT_MEDICAL_REPORT_STATUS_LINE =
  "Subjective findings approved; Objective assessment pending" as const;

export type PtMedicalReportApproved = {
  version: number;
  approvedAt: string;
  sourceDraftVersion: number;
  sections: PtMedicalReportDraftSections;
};

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

Return a JSON object with exactly these nine section fields. Use null for any section with no supporting facts; use non-empty strings for populated sections:
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
- title should be "Patient-Reported Subjective Summary" when included.
- clinicalReviewNote must state that the content is patient-reported and requires therapist review.
- Return JSON only — no markdown fences or preamble.`;

/**
 * Extended prompt branch for post_stroke_intake — identical constraints to
 * PT_MEDICAL_REPORT_SYSTEM_PROMPT plus one added capability: translating a
 * non-English patient-reported fact into clinical English while organizing
 * it. Kept as a separate constant (not a shared/parameterized string) so the
 * remote_questionnaire prompt is never touched by this change — general-MSK
 * facts are already English-only by construction, so this instruction would
 * be a no-op there, but a separate constant keeps that path's behavior and
 * tests completely unaffected.
 */
export const POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT = `You are a clinical documentation assistant for licensed physiotherapists.

Your task: write a structured English Physical Therapy medical report draft for therapist review ONLY, using strictly the clinician-approved patient-reported facts provided in JSON. Some facts may be written in Arabic — translate them into clear, accurate clinical English as part of organizing this summary.

Return a JSON object with exactly these nine section fields. Use null for any section with no supporting facts; use non-empty strings for populated sections:
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
- If a fact is in Arabic, translate it into clinical English before including it — never leave Arabic text in the output.
- Organize approved facts into coherent clinical English narrative paragraphs — not a literal field-by-field list.
- Prefer cautious patient-reported wording such as "The patient reports…" or "The patient states…".
- Do NOT provide a diagnosis, prognosis, treatment plan, or examination findings.
- Do NOT infer stroke severity, assign a fall-risk score, or state whether anything is safe or unsafe.
- Do NOT grant exercise clearance or select a care-delivery mode (remote_self, remote_supervised, in_clinic).
- Do NOT recommend tests, exercises, or interventions, and do NOT create Objective findings or a treatment plan.
- Do NOT claim objective examination or observation findings that were not provided.
- title should be "Patient-Reported Subjective Summary" when included.
- clinicalReviewNote must state that the content is patient-reported and requires therapist review.
- Return JSON only — no markdown fences or preamble.`;

export const PT_MEDICAL_REPORT_MODEL = "gpt-4o" as const;

const PT_REPORT_NULLABLE_STRING_PROPERTY = {
  type: ["string", "null"],
} as const;

const PT_REPORT_SCHEMA_PROPERTIES = Object.fromEntries(
  PT_MEDICAL_REPORT_SECTION_KEYS.map((key) => [key, PT_REPORT_NULLABLE_STRING_PROPERTY]),
) as Record<
  PtMedicalReportSectionKey,
  { readonly type: readonly ["string", "null"] }
>;

/** Strict structured-output schema — all nine keys required; null means absent section. */
export const PT_MEDICAL_REPORT_JSON_SCHEMA = {
  name: "pt_medical_report_sections",
  strict: true,
  schema: {
    type: "object",
    properties: PT_REPORT_SCHEMA_PROPERTIES,
    required: [...PT_MEDICAL_REPORT_SECTION_KEYS],
    additionalProperties: false,
  },
} as const;

export function buildPtMedicalReportResponseFormat(): {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
} {
  return {
    type: "json_schema",
    json_schema: {
      name: PT_MEDICAL_REPORT_JSON_SCHEMA.name,
      strict: PT_MEDICAL_REPORT_JSON_SCHEMA.strict,
      schema: PT_MEDICAL_REPORT_JSON_SCHEMA.schema,
    },
  };
}

export function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/** Unwrap common nested model shapes without accepting unknown top-level keys into sections. */
export function coercePtReportModelPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  for (const wrapperKey of ["sections", "report", "ptMedicalReport", "pt_medical_report"] as const) {
    const nested = record[wrapperKey];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return record;
}

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

/** Parses client-supplied section edits — unknown keys are ignored. */
export function parseClientPtReportSections(raw: unknown): PtMedicalReportDraftSections | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const sections: PtMedicalReportDraftSections = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(PT_MEDICAL_REPORT_SECTION_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value !== "string") return null;
    sections[key as PtMedicalReportSectionKey] = value;
  }

  if (Object.keys(sections).length === 0) return null;
  return sections;
}

export function clearPtMedicalReportGate2Approval(
  structuredData: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...structuredData };
  delete next.ptMedicalReportApproved;
  delete next.gate2ApprovedAt;
  return next;
}

/** Removes draft and Gate 2 approval when Gate 1 facts are re-approved. */
export function invalidatePtMedicalReportForGate1Reapproval(
  structuredData: Record<string, unknown>,
): Record<string, unknown> {
  const next = clearPtMedicalReportGate2Approval(structuredData);
  delete next.ptMedicalReportDraft;
  return next;
}

export function parsePtReportSectionsFromJson(raw: string): PtMedicalReportDraftSections | null {
  try {
    const parsed = JSON.parse(stripMarkdownJsonFences(raw)) as unknown;
    const payload = coercePtReportModelPayload(parsed);
    if (!payload) return null;

    const sections: PtMedicalReportDraftSections = {};
    for (const key of PT_MEDICAL_REPORT_SECTION_KEYS) {
      const value = payload[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") return null;
      if (value.trim()) {
        sections[key] = value;
      }
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

export function applyEditedSectionsToDraft(
  existingDraft: PtMedicalReportDraft,
  sections: PtMedicalReportDraftSections,
): PtMedicalReportDraft {
  return {
    ...existingDraft,
    sections: omitEmptyPtReportSections(sections),
  };
}

export function buildPtMedicalReportApprovedSnapshot(
  draft: PtMedicalReportDraft,
  approvedAt: string,
  existingApproved: PtMedicalReportApproved | null,
): PtMedicalReportApproved {
  const version = existingApproved ? existingApproved.version + 1 : 1;
  return {
    version,
    approvedAt,
    sourceDraftVersion: draft.version,
    sections: { ...draft.sections },
  };
}

export function readPtMedicalReportApproved(structuredData: unknown): PtMedicalReportApproved | null {
  if (typeof structuredData !== "object" || structuredData === null) return null;
  const record = structuredData as Record<string, unknown>;
  const raw = record.ptMedicalReportApproved;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.version !== "number" || !Number.isFinite(candidate.version) || candidate.version < 1) {
    return null;
  }
  if (typeof candidate.approvedAt !== "string" || !candidate.approvedAt.trim()) return null;
  if (
    typeof candidate.sourceDraftVersion !== "number" ||
    !Number.isFinite(candidate.sourceDraftVersion) ||
    candidate.sourceDraftVersion < 1
  ) {
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
    approvedAt: candidate.approvedAt.trim(),
    sourceDraftVersion: candidate.sourceDraftVersion,
    sections,
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

export type ChatCompletionMessageResult = {
  content?: string | null;
  refusal?: string | null;
};

export type ChatCompletionCreator = (
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
) => Promise<{ choices: Array<{ message?: ChatCompletionMessageResult }> }>;

export function extractPtReportModelText(
  message: ChatCompletionMessageResult | undefined,
): { kind: "content"; text: string } | { kind: "refusal" } | { kind: "empty" } {
  if (message?.refusal?.trim()) {
    return { kind: "refusal" };
  }
  const text = message?.content?.trim() ?? "";
  if (!text) {
    return { kind: "empty" };
  }
  return { kind: "content", text };
}

export async function requestPtMedicalReportModelOutput(
  apiKey: string,
  facts: ApprovedPatientReportFacts,
  createChatCompletion: ChatCompletionCreator,
  systemPrompt: string = PT_MEDICAL_REPORT_SYSTEM_PROMPT,
): Promise<
  | { ok: true; raw: string }
  | { ok: false; code: TranslationErrorCode | "no_content" | "invalid_output" }
> {
  const input = buildPtMedicalReportGeneratorInput(facts);

  try {
    const response = await createChatCompletion({
      model: PT_MEDICAL_REPORT_MODEL,
      max_tokens: 1_800,
      response_format: buildPtMedicalReportResponseFormat(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildPtMedicalReportUserPrompt(input) },
      ],
    });

    const extracted = extractPtReportModelText(response.choices[0]?.message);
    if (extracted.kind === "refusal") {
      return { ok: false, code: "invalid_output" };
    }
    if (extracted.kind === "empty") {
      return { ok: false, code: "no_content" };
    }
    return { ok: true, raw: extracted.text };
  } catch (err) {
    const diagnostics = extractSafeOpenAiErrorDiagnostics(err);
    console.error(
      "[generatePtMedicalReport] provider request failed:",
      formatSafeOpenAiErrorLog(diagnostics),
    );
    const classified = classifyOpenAiError(err);
    return { ok: false, code: classified.code };
  }
}

export function parseAndValidatePtMedicalReportModelOutput(
  raw: string,
): PtMedicalReportGenerationResult {
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

export async function generatePtMedicalReportSections(
  apiKey: string,
  facts: ApprovedPatientReportFacts,
  createChatCompletion: ChatCompletionCreator = (params) =>
    new OpenAI({ apiKey }).chat.completions.create(params),
  systemPrompt: string = PT_MEDICAL_REPORT_SYSTEM_PROMPT,
): Promise<PtMedicalReportGenerationResult> {
  const firstRequest = await requestPtMedicalReportModelOutput(
    apiKey,
    facts,
    createChatCompletion,
    systemPrompt,
  );
  if (!firstRequest.ok) {
    if (firstRequest.code === "invalid_output" || firstRequest.code === "no_content") {
      const retryRequest = await requestPtMedicalReportModelOutput(
        apiKey,
        facts,
        createChatCompletion,
        systemPrompt,
      );
      if (!retryRequest.ok) {
        return { ok: false, code: retryRequest.code };
      }
      return parseAndValidatePtMedicalReportModelOutput(retryRequest.raw);
    }
    return { ok: false, code: firstRequest.code };
  }

  const firstParsed = parseAndValidatePtMedicalReportModelOutput(firstRequest.raw);
  if (firstParsed.ok) {
    return firstParsed;
  }

  const retryRequest = await requestPtMedicalReportModelOutput(
    apiKey,
    facts,
    createChatCompletion,
    systemPrompt,
  );
  if (!retryRequest.ok) {
    return { ok: false, code: retryRequest.code };
  }
  return parseAndValidatePtMedicalReportModelOutput(retryRequest.raw);
}
