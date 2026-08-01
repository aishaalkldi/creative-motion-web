/**
 * Run: npx tsx --test app/lib/ai/generate-pt-medical-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  buildPtMedicalReportDraftRecord,
  buildPtMedicalReportGeneratorInput,
  buildPtMedicalReportApprovedSnapshot,
  buildPtMedicalReportResponseFormat,
  clearPtMedicalReportGate2Approval,
  coercePtReportModelPayload,
  extractPtReportModelText,
  generatePtMedicalReportSections,
  invalidatePtMedicalReportForGate1Reapproval,
  omitEmptyPtReportSections,
  parseAndValidatePtMedicalReportModelOutput,
  parseClientPtReportSections,
  parsePtReportSectionsFromJson,
  POST_STROKE_INTAKE_DRAFT_LABEL,
  POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT,
  PT_MEDICAL_REPORT_DRAFT_LABEL,
  PT_MEDICAL_REPORT_JSON_SCHEMA,
  PT_MEDICAL_REPORT_SECTION_KEYS,
  PT_MEDICAL_REPORT_SECTION_LABELS,
  PT_MEDICAL_REPORT_STATUS_LINE,
  PT_MEDICAL_REPORT_SYSTEM_PROMPT,
  readPtMedicalReportApproved,
  readPtMedicalReportDraft,
  requestPtMedicalReportModelOutput,
  stripMarkdownJsonFences,
  validateAndSanitizePtReportSections,
} from "./generate-pt-medical-report";
import OpenAI from "openai";

const APPROVED_FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-29T08:00:00.000Z",
  facts: {
    chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
    painLocation: "Right shoulder",
    painScore: "6/10",
    aggravating: "Overhead reaching and lifting.",
    easing: "Rest and ice.",
    goals: "Return to overhead work without pain.",
  },
  chiefComplaintExtraction: {
    body_region: "shoulder",
    side: "right",
    primary_symptom: "pain",
    aggravating_factor: "overhead arm elevation",
    language: "en",
    confidence: 0.9,
  },
};

describe("buildPtMedicalReportGeneratorInput", () => {
  it("includes only approved facts and optional reviewed extraction", () => {
    const input = buildPtMedicalReportGeneratorInput(APPROVED_FACTS);
    assert.equal(input.approvedAt, APPROVED_FACTS.approvedAt);
    assert.deepEqual(input.facts, APPROVED_FACTS.facts);
    assert.deepEqual(input.chiefComplaintExtraction, APPROVED_FACTS.chiefComplaintExtraction);
  });
});

describe("parsePtReportSectionsFromJson", () => {
  it("parses supported sections and ignores unknown keys", () => {
    const parsed = parsePtReportSectionsFromJson(
      JSON.stringify({
        chiefComplaint: "The patient reports shoulder pain.",
        diagnosis: "should be ignored",
        painAndSymptoms: "Pain rated 6/10.",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed.chiefComplaint, "The patient reports shoulder pain.");
    assert.equal(parsed.painAndSymptoms, "Pain rated 6/10.");
    assert.equal("diagnosis" in parsed, false);
  });

  it("rejects invalid section value types", () => {
    assert.equal(parsePtReportSectionsFromJson(JSON.stringify({ chiefComplaint: 42 })), null);
  });

  it("unwraps nested sections payloads from real provider shapes", () => {
    const parsed = parsePtReportSectionsFromJson(
      JSON.stringify({
        sections: {
          chiefComplaint: "The patient reports shoulder pain.",
          clinicalReviewNote: "Patient-reported draft for therapist review.",
        },
      }),
    );
    assert.equal(parsed?.chiefComplaint, "The patient reports shoulder pain.");
  });

  it("strips markdown fences before parsing", () => {
    const parsed = parsePtReportSectionsFromJson(
      "```json\n" +
        JSON.stringify({
          chiefComplaint: "The patient reports shoulder pain.",
          clinicalReviewNote: "Patient-reported draft for therapist review.",
        }) +
        "\n```",
    );
    assert.equal(parsed?.chiefComplaint, "The patient reports shoulder pain.");
  });

  it("omits empty sections", () => {
    const parsed = parsePtReportSectionsFromJson(
      JSON.stringify({
        chiefComplaint: "The patient reports shoulder pain.",
        painAndSymptoms: "   ",
      }),
    );
    assert.equal(parsed?.painAndSymptoms, undefined);
  });

  it("omits null sections from strict provider output", () => {
    const parsed = parsePtReportSectionsFromJson(
      JSON.stringify({
        title: null,
        chiefComplaint: "The patient reports shoulder pain.",
        painAndSymptoms: null,
        aggravatingAndEasing: null,
        functionalLimitations: null,
        mobilityBalanceAndFalls: null,
        patientGoals: null,
        additionalInformation: null,
        clinicalReviewNote: "Patient-reported draft for therapist review.",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed?.title, undefined);
    assert.equal(parsed?.painAndSymptoms, undefined);
    assert.equal(parsed?.chiefComplaint, "The patient reports shoulder pain.");
  });
});

describe("stripMarkdownJsonFences", () => {
  it("removes json code fences", () => {
    assert.equal(stripMarkdownJsonFences('```json\n{"a":1}\n```'), '{"a":1}');
  });
});

describe("coercePtReportModelPayload", () => {
  it("unwraps a nested report object", () => {
    const payload = coercePtReportModelPayload({
      report: { chiefComplaint: "Shoulder pain." },
    });
    assert.deepEqual(payload, { chiefComplaint: "Shoulder pain." });
  });
});

describe("extractPtReportModelText", () => {
  it("detects provider refusal safely", () => {
    assert.deepEqual(extractPtReportModelText({ refusal: "I can't help with that." }), {
      kind: "refusal",
    });
  });

  it("detects empty provider content", () => {
    assert.deepEqual(extractPtReportModelText({ content: "   " }), { kind: "empty" });
  });
});

describe("buildPtMedicalReportResponseFormat", () => {
  it("requests strict json_schema output for known section keys only", () => {
    const format = buildPtMedicalReportResponseFormat();
    assert.equal(format.type, "json_schema");
    assert.equal(format.json_schema.strict, true);
    assert.equal(format.json_schema.name, "pt_medical_report_sections");
    const schema = format.json_schema.schema as {
      type: string;
      properties: Record<string, { type: string[] }>;
      required: string[];
      additionalProperties: boolean;
    };
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.required.length, PT_MEDICAL_REPORT_SECTION_KEYS.length);
    for (const key of PT_MEDICAL_REPORT_SECTION_KEYS) {
      assert.ok(schema.required.includes(key), `missing required key: ${key}`);
      assert.deepEqual(schema.properties[key]?.type, ["string", "null"]);
    }
    assert.equal("diagnosis" in schema.properties, false);
  });

  it("matches the exported strict schema definition", () => {
    assert.deepEqual(
      buildPtMedicalReportResponseFormat().json_schema.schema,
      PT_MEDICAL_REPORT_JSON_SCHEMA.schema,
    );
  });
});

describe("parseAndValidatePtMedicalReportModelOutput", () => {
  it("accepts valid structured output", () => {
    const result = parseAndValidatePtMedicalReportModelOutput(
      JSON.stringify({
        chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
        clinicalReviewNote:
          "Compiled from clinician-approved patient-reported information. Therapist review required.",
      }),
    );
    assert.equal(result.ok, true);
  });

  it("accepts strict provider output with null absent sections", () => {
    const result = parseAndValidatePtMedicalReportModelOutput(
      JSON.stringify({
        title: null,
        chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
        painAndSymptoms: null,
        aggravatingAndEasing: null,
        functionalLimitations: null,
        mobilityBalanceAndFalls: null,
        patientGoals: null,
        additionalInformation: null,
        clinicalReviewNote:
          "Compiled from clinician-approved patient-reported information. Therapist review required.",
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sections.painAndSymptoms, undefined);
      assert.match(result.sections.chiefComplaint ?? "", /patient reports/i);
    }
  });

  it("rejects prose-only malformed output", () => {
    const result = parseAndValidatePtMedicalReportModelOutput(
      "The patient reports shoulder pain and needs review.",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_output");
    }
  });
});

describe("validateAndSanitizePtReportSections", () => {
  it("omits empty sections and adds default review note", () => {
    const result = validateAndSanitizePtReportSections({
      chiefComplaint: "The patient reports shoulder pain.",
      painAndSymptoms: "   ",
      clinicalReviewNote: "",
    });
    assert.equal(result.ok, true);
    assert.equal(result.sections.chiefComplaint, "The patient reports shoulder pain.");
    assert.equal(result.sections.painAndSymptoms, undefined);
    assert.match(result.sections.clinicalReviewNote ?? "", /Therapist review is required/i);
  });

  it("defaults the document title to the confirmed Subjective-only name when omitted", () => {
    const result = validateAndSanitizePtReportSections({
      chiefComplaint: "The patient reports shoulder pain.",
    });
    assert.equal(result.sections.title, "Patient-Reported Subjective Summary");
    assert.equal(result.sections.title, PT_MEDICAL_REPORT_SECTION_LABELS.title);
    assert.notEqual(result.sections.title, "Physical Therapy Assessment Report");
  });

  it("rejects diagnosis, prognosis, and treatment recommendation wording", () => {
    for (const unsafe of [
      "The diagnosis is rotator cuff tear.",
      "Prognosis is good with therapy.",
      "Treatment recommendation includes manual therapy.",
    ]) {
      const result = validateAndSanitizePtReportSections({
        chiefComplaint: unsafe,
        clinicalReviewNote: "Patient-reported draft for therapist review.",
      });
      assert.equal(result.ok, false);
      assert.ok(result.forbiddenPhrases.length > 0);
    }
  });
});

describe("PT_MEDICAL_REPORT_STATUS_LINE", () => {
  it("states Subjective-only clinical completeness, not a full PT assessment", () => {
    assert.equal(PT_MEDICAL_REPORT_STATUS_LINE, "Subjective findings approved; Objective assessment pending");
    assert.doesNotMatch(PT_MEDICAL_REPORT_STATUS_LINE, /objective.*(approved|complete)/i);
  });
});

describe("omitEmptyPtReportSections", () => {
  it("drops unsupported empty sections", () => {
    const sections = omitEmptyPtReportSections({
      chiefComplaint: "The patient reports pain.",
      functionalLimitations: "  ",
    });
    assert.deepEqual(Object.keys(sections), ["chiefComplaint"]);
  });
});

describe("parseClientPtReportSections", () => {
  it("accepts known section keys and ignores unknown keys", () => {
    const parsed = parseClientPtReportSections({
      chiefComplaint: "Edited complaint.",
      unknownSection: "ignored",
    });
    assert.deepEqual(parsed, { chiefComplaint: "Edited complaint." });
  });

  it("rejects invalid value types", () => {
    assert.equal(parseClientPtReportSections({ chiefComplaint: 42 }), null);
  });
});

describe("buildPtMedicalReportApprovedSnapshot", () => {
  it("freezes the current draft and records source draft version", () => {
    const draft = buildPtMedicalReportDraftRecord(
      null,
      APPROVED_FACTS,
      { chiefComplaint: "Draft text." },
      "2026-07-29T09:00:00.000Z",
    );
    const approved = buildPtMedicalReportApprovedSnapshot(
      draft,
      "2026-07-29T10:00:00.000Z",
      null,
    );
    assert.equal(approved.version, 1);
    assert.equal(approved.sourceDraftVersion, draft.version);
    assert.deepEqual(approved.sections, draft.sections);
  });
});

describe("clearPtMedicalReportGate2Approval", () => {
  it("removes approved snapshot and gate2 timestamp", () => {
    const cleared = clearPtMedicalReportGate2Approval({
      ptMedicalReportDraft: { version: 1 },
      ptMedicalReportApproved: { version: 1 },
      gate2ApprovedAt: "2026-07-29T10:00:00.000Z",
      pain: { chiefComplaint: "Arabic" },
    });
    assert.equal("ptMedicalReportApproved" in cleared, false);
    assert.equal("gate2ApprovedAt" in cleared, false);
    assert.deepEqual(cleared.ptMedicalReportDraft, { version: 1 });
  });
});

describe("invalidatePtMedicalReportForGate1Reapproval", () => {
  it("clears draft and Gate 2 approval on Gate 1 re-approval", () => {
    const invalidated = invalidatePtMedicalReportForGate1Reapproval({
      ptMedicalReportDraft: { version: 2 },
      ptMedicalReportApproved: { version: 1 },
      gate2ApprovedAt: "2026-07-29T10:00:00.000Z",
      approvedPatientReportFacts: { version: 1 },
    });
    assert.equal("ptMedicalReportDraft" in invalidated, false);
    assert.equal("ptMedicalReportApproved" in invalidated, false);
    assert.equal("gate2ApprovedAt" in invalidated, false);
    assert.ok(invalidated.approvedPatientReportFacts);
  });
});

describe("readPtMedicalReportApproved", () => {
  it("reads a stored approved snapshot", () => {
    const approved = readPtMedicalReportApproved({
      ptMedicalReportApproved: {
        version: 1,
        approvedAt: "2026-07-29T10:00:00.000Z",
        sourceDraftVersion: 2,
        sections: { chiefComplaint: "Approved text." },
      },
    });
    assert.equal(approved?.sourceDraftVersion, 2);
    assert.equal(approved?.sections.chiefComplaint, "Approved text.");
  });
});

describe("buildPtMedicalReportDraftRecord", () => {
  it("creates version 1 on first generation", () => {
    const record = buildPtMedicalReportDraftRecord(
      null,
      APPROVED_FACTS,
      { chiefComplaint: "Draft text." },
      "2026-07-29T09:00:00.000Z",
    );
    assert.equal(record.version, 1);
    assert.equal(record.status, "draft");
    assert.equal(record.sourceFactsVersion, 1);
  });

  it("increments version and replaces sections on regeneration", () => {
    const existing = buildPtMedicalReportDraftRecord(
      null,
      APPROVED_FACTS,
      { chiefComplaint: "First draft." },
      "2026-07-29T09:00:00.000Z",
    );
    const regenerated = buildPtMedicalReportDraftRecord(
      existing,
      APPROVED_FACTS,
      { chiefComplaint: "Second draft." },
      "2026-07-29T10:00:00.000Z",
    );
    assert.equal(regenerated.version, 2);
    assert.equal(regenerated.sections.chiefComplaint, "Second draft.");
    assert.notEqual(regenerated.generatedAt, existing.generatedAt);
  });
});

describe("readPtMedicalReportDraft", () => {
  it("reads a stored draft and ignores invalid records", () => {
    const draft = {
      version: 1,
      status: "draft",
      generatedAt: "2026-07-29T09:00:00.000Z",
      sourceFactsVersion: 1,
      sections: { chiefComplaint: "Draft text." },
    };
    const read = readPtMedicalReportDraft({ ptMedicalReportDraft: draft });
    assert.deepEqual(read?.sections.chiefComplaint, "Draft text.");
    assert.equal(readPtMedicalReportDraft({ ptMedicalReportDraft: { ...draft, status: "approved" } }), null);
  });
});

describe("generatePtMedicalReportSections", () => {
  it("uses injectable AI helper and validates output", async () => {
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                clinicalReviewNote:
                  "Compiled from clinician-approved patient-reported information. Therapist review required.",
              }),
            },
          },
        ],
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.sections.chiefComplaint ?? "", /patient reports/i);
    }
  });

  it("requests strict json_schema output from the provider", async () => {
    let capturedFormat: unknown;
    await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async (params) => {
        capturedFormat = params.response_format;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                  clinicalReviewNote:
                    "Compiled from clinician-approved patient-reported information. Therapist review required.",
                }),
              },
            },
          ],
        };
      },
    );
    assert.deepEqual(capturedFormat, buildPtMedicalReportResponseFormat());
  });

  it("passes only approved facts in the user prompt", async () => {
    let userPrompt = "";
    await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async (params) => {
        const userMessage = params.messages.find((message) => message.role === "user");
        userPrompt = typeof userMessage?.content === "string" ? userMessage.content : "";
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                  clinicalReviewNote:
                    "Compiled from clinician-approved patient-reported information. Therapist review required.",
                }),
              },
            },
          ],
        };
      },
    );
    assert.match(userPrompt, /The patient reports right shoulder pain with overhead reaching\./);
    assert.doesNotMatch(userPrompt, /ألم/);
  });

  it("retries once after malformed provider output", async () => {
    let calls = 0;
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => {
        calls += 1;
        if (calls === 1) {
          return { choices: [{ message: { content: "not json" } }] };
        }
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                  clinicalReviewNote:
                    "Compiled from clinician-approved patient-reported information. Therapist review required.",
                }),
              },
            },
          ],
        };
      },
    );
    assert.equal(calls, 2);
    assert.equal(result.ok, true);
  });

  it("fails safely on provider refusal", async () => {
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => ({
        choices: [{ message: { refusal: "Refused to generate clinical content." } }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_output");
    }
  });

  it("rejects unsafe model output", async () => {
    const result = await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                chiefComplaint: "Diagnosis: rotator cuff tear.",
                clinicalReviewNote: "Review required.",
              }),
            },
          },
        ],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_output");
    }
  });
});

describe("requestPtMedicalReportModelOutput", () => {
  it("returns no_content for empty provider output", async () => {
    const result = await requestPtMedicalReportModelOutput(
      "sk-test",
      APPROVED_FACTS,
      async () => ({ choices: [{ message: { content: "" } }] }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "no_content");
    }
  });

  it("classifies provider 400 invalid schema errors safely without leaking patient text", async () => {
    const logs: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      const result = await requestPtMedicalReportModelOutput(
        "sk-test",
        APPROVED_FACTS,
        async () => {
          throw OpenAI.APIError.generate(
            400,
            {
              error: {
                message:
                  "Invalid schema: required is empty and includes patient shoulder pain details",
                type: "invalid_request_error",
                param: "response_format",
                code: "invalid_json_schema",
              },
            },
            undefined,
            new Headers({ "x-request-id": "req_test123" }),
          );
        },
      );
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "invalid_request");
      }
      const logText = logs.join("\n");
      assert.match(logText, /BadRequestError/);
      assert.match(logText, /400/);
      assert.match(logText, /invalid_json_schema/);
      assert.match(logText, /response_format/);
      assert.match(logText, /req_test123/);
      assert.doesNotMatch(logText, /shoulder pain|sk-test|patient reports/i);
    } finally {
      console.error = originalError;
    }
  });
});

describe("Stage 4 — post_stroke_intake prompt-building branch", () => {
  it("defaults to the existing remote_questionnaire system prompt when no override is passed — remote_questionnaire behavior is unchanged", async () => {
    let capturedSystemPrompt = "";
    await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async (params) => {
        capturedSystemPrompt = params.messages.find((m) => m.role === "system")?.content as string;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                  clinicalReviewNote:
                    "Compiled from clinician-approved patient-reported information. Therapist review required.",
                }),
              },
            },
          ],
        };
      },
    );
    assert.equal(capturedSystemPrompt, PT_MEDICAL_REPORT_SYSTEM_PROMPT);
  });

  it("uses the extended post-stroke-intake system prompt when explicitly passed", async () => {
    let capturedSystemPrompt = "";
    await generatePtMedicalReportSections(
      "sk-test",
      APPROVED_FACTS,
      async (params) => {
        capturedSystemPrompt = params.messages.find((m) => m.role === "system")?.content as string;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chiefComplaint: "The patient reports right shoulder pain with overhead reaching.",
                  clinicalReviewNote:
                    "Compiled from clinician-approved patient-reported information. Therapist review required.",
                }),
              },
            },
          ],
        };
      },
      POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT,
    );
    assert.equal(capturedSystemPrompt, POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT);
    assert.notEqual(capturedSystemPrompt, PT_MEDICAL_REPORT_SYSTEM_PROMPT);
  });

  it("the post-stroke-intake prompt permits translating non-English facts but keeps every other clinical boundary", () => {
    assert.match(POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT, /translate/i);
    assert.match(POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT, /do not provide a diagnosis/i);
    for (const phrase of [
      "stroke severity",
      "fall-risk score",
      "safe or unsafe",
      "exercise clearance",
      "remote_self",
      "remote_supervised",
      "in_clinic",
      "Objective findings",
      "treatment plan",
    ]) {
      assert.match(
        POST_STROKE_INTAKE_SUBJECTIVE_SYSTEM_PROMPT,
        new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        `expected the prompt to explicitly forbid: ${phrase}`,
      );
    }
  });

  it("the required exact post-stroke-intake draft label is distinct from the remote_questionnaire label", () => {
    assert.equal(POST_STROKE_INTAKE_DRAFT_LABEL, "AI-generated draft — requires therapist review");
    assert.notEqual(POST_STROKE_INTAKE_DRAFT_LABEL, PT_MEDICAL_REPORT_DRAFT_LABEL);
  });
});
