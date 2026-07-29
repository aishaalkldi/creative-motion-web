/**
 * Run: npx tsx --experimental-test-module-mocks --test app/api/assessments/[id]/generate-pt-report/route.test.ts
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import type { PtMedicalReportDraftSections } from "@/app/lib/ai/generate-pt-medical-report";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;
type FakeAssessment = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: Record<string, unknown> | null;
} | null;

type GenerateOutcome =
  | { ok: true; sections: PtMedicalReportDraftSections }
  | {
      ok: false;
      code: "invalid_key" | "quota_or_billing" | "rate_limit" | "provider_error" | "no_content" | "invalid_output";
    };

const APPROVED_FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-29T08:00:00.000Z",
  facts: {
    chiefComplaint: "The patient reports right shoulder pain.",
    painLocation: "Right shoulder",
  },
};

const GENERATED_SECTIONS: PtMedicalReportDraftSections = {
  title: "Physical Therapy Assessment Report",
  chiefComplaint: "The patient reports right shoulder pain.",
  clinicalReviewNote: "Patient-reported draft for therapist review.",
};

let authUser: FakeUser = { id: "user-123", email: "provider@example.com" };
let authError: unknown = null;
let assessmentRow: FakeAssessment = {
  id: "assess-1",
  patient_id: "patient-1",
  provider_id: "user-123",
  type: "remote_questionnaire",
  structured_data: {
    pain: { chiefComplaint: "ألم في الكتف" },
    approvedPatientReportFacts: APPROVED_FACTS,
  },
};
let assessmentQueryError: { code?: string; message?: string } | null = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "user-123" };
let patientQueryError: { code?: string; message?: string } | null = null;
let generateOutcome: GenerateOutcome = { ok: true, sections: GENERATED_SECTIONS };
let capturedGenerateFacts: ApprovedPatientReportFacts | null = null;
let updateCalls: Array<{ patch: Record<string, unknown> }> = [];
let updateError: { code?: string; message?: string } | null = null;

function resetState() {
  authUser = { id: "user-123", email: "provider@example.com" };
  authError = null;
  assessmentRow = {
    id: "assess-1",
    patient_id: "patient-1",
    provider_id: "user-123",
    type: "remote_questionnaire",
    structured_data: {
      pain: { chiefComplaint: "ألم في الكتف" },
      chiefComplaint_en: "Shoulder pain.",
      chiefComplaint_en_reviewed: false,
      approvedPatientReportFacts: APPROVED_FACTS,
    },
  };
  assessmentQueryError = null;
  patientRow = { id: "patient-1", provider_id: "user-123" };
  patientQueryError = null;
  generateOutcome = { ok: true, sections: GENERATED_SECTIONS };
  capturedGenerateFacts = null;
  updateCalls = [];
  updateError = null;
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

function makeFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authError }),
    },
    from: (table: string) => {
      if (table === "assessments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: assessmentRow, error: assessmentQueryError }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                updateCalls.push({ patch });
                return { error: updateError };
              },
            }),
          }),
        };
      }
      if (table === "patients") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: patientRow, error: patientQueryError }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => makeFakeClient(),
  },
});

mock.module("@/app/lib/ai/generate-pt-medical-report", {
  namedExports: {
    generatePtMedicalReportSections: async (_apiKey: string, facts: ApprovedPatientReportFacts) => {
      capturedGenerateFacts = facts;
      return generateOutcome;
    },
    buildPtMedicalReportDraftRecord: (
      existingDraft: { version: number } | null,
      facts: ApprovedPatientReportFacts,
      sections: PtMedicalReportDraftSections,
      generatedAt: string,
    ) => ({
      version: existingDraft ? existingDraft.version + 1 : 1,
      status: "draft" as const,
      generatedAt,
      sourceFactsVersion: facts.version,
      sections,
    }),
    readPtMedicalReportDraft: (structuredData: unknown) => {
      if (typeof structuredData !== "object" || structuredData === null) return null;
      const raw = (structuredData as Record<string, unknown>).ptMedicalReportDraft;
      return raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as { version: number })
        : null;
    },
    clearPtMedicalReportGate2Approval: (structuredData: Record<string, unknown>) => {
      const next = { ...structuredData };
      delete next.ptMedicalReportApproved;
      delete next.gate2ApprovedAt;
      return next;
    },
  },
});

function makeRequest(body: unknown = {}): NextRequest {
  return new Request("http://localhost/api/assessments/assess-1/generate-pt-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/assessments/[id]/generate-pt-report", { concurrency: 1 }, () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      OPENAI_API_KEY: "sk-test-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    for (const key of Object.keys(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    }
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ({ POST } = await import("./route"));
  });

  after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    resetState();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("no real network call is permitted in this test file");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function ctx() {
    return { params: Promise.resolve({ id: "assess-1" }) };
  }

  it("requires clinician authentication", async () => {
    authUser = null;
    authError = { message: "Auth session missing" };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Unauthorized");
  });

  it("rejects wrong clinician ownership with a safe error", async () => {
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, "AI_CONTEXT_INVALID");
    assert.doesNotMatch(body.error, /patient-1|user-123/);
  });

  it("blocks generation when Gate 1 approved facts are missing", async () => {
    assessmentRow = {
      ...assessmentRow!,
      structured_data: { pain: { chiefComplaint: "ألم في الكتف" } },
    };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Approve patient-reported information/i);
  });

  it("ignores client-supplied facts and passes only stored approved facts to the generator", async () => {
    const res = await POST(
      makeRequest({
        approvedPatientReportFacts: {
          facts: { chiefComplaint: "Client injected complaint." },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(capturedGenerateFacts, APPROVED_FACTS);
    const body = (await res.json()) as { ptMedicalReportDraft: { sections: PtMedicalReportDraftSections } };
    assert.equal(
      body.ptMedicalReportDraft.sections.chiefComplaint,
      "The patient reports right shoulder pain.",
    );
  });

  it("does not pass unreviewed translations to the generator", async () => {
    assessmentRow = {
      ...assessmentRow!,
      structured_data: {
        pain: { chiefComplaint: "ألم في الكتف" },
        chiefComplaint_en: "Unreviewed shoulder pain.",
        chiefComplaint_en_reviewed: false,
        approvedPatientReportFacts: APPROVED_FACTS,
      },
    };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 200);
    assert.deepEqual(capturedGenerateFacts?.facts, APPROVED_FACTS.facts);
    assert.equal(capturedGenerateFacts?.facts.chiefComplaint, "The patient reports right shoulder pain.");
  });

  it("preserves original Arabic and existing structured_data while saving the draft", async () => {
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 200);
    assert.equal(updateCalls.length, 1);
    const patch = updateCalls[0]!.patch.structured_data as Record<string, unknown>;
    const pain = patch.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, "ألم في الكتف");
    assert.equal(patch.chiefComplaint_en_reviewed, false);
    assert.ok(patch.approvedPatientReportFacts);
    assert.ok(patch.ptMedicalReportDraft);
  });

  it("stores generated report as draft version 1", async () => {
    const res = await POST(makeRequest(), ctx());
    const body = (await res.json()) as {
      ptMedicalReportDraft: { version: number; status: string };
    };
    assert.equal(body.ptMedicalReportDraft.version, 1);
    assert.equal(body.ptMedicalReportDraft.status, "draft");
  });

  it("increments version and replaces the previous draft on explicit regeneration", async () => {
    assessmentRow = {
      ...assessmentRow!,
      structured_data: {
        ...(assessmentRow!.structured_data as Record<string, unknown>),
        ptMedicalReportDraft: {
          version: 1,
          status: "draft",
          generatedAt: "2026-07-29T08:30:00.000Z",
          sourceFactsVersion: 1,
          sections: { chiefComplaint: "Old draft." },
        },
        ptMedicalReportApproved: {
          version: 1,
          approvedAt: "2026-07-29T09:30:00.000Z",
          sourceDraftVersion: 1,
          sections: { chiefComplaint: "Old draft." },
        },
        gate2ApprovedAt: "2026-07-29T09:30:00.000Z",
      },
    };
    generateOutcome = {
      ok: true,
      sections: {
        chiefComplaint: "Regenerated draft.",
        clinicalReviewNote: "Review required.",
      },
    };
    const res = await POST(makeRequest(), ctx());
    const body = (await res.json()) as {
      ptMedicalReportDraft: { version: number; sections: PtMedicalReportDraftSections };
    };
    assert.equal(body.ptMedicalReportDraft.version, 2);
    assert.equal(body.ptMedicalReportDraft.sections.chiefComplaint, "Regenerated draft.");
    assert.equal(updateCalls.length, 1);
    const patch = updateCalls[0]!.patch.structured_data as Record<string, unknown>;
    assert.equal("ptMedicalReportApproved" in patch, false);
    assert.equal("gate2ApprovedAt" in patch, false);
  });

  it("returns safe generic errors for provider failures", async () => {
    generateOutcome = { ok: false, code: "provider_error" };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 503);
    const text = await res.text();
    const body = JSON.parse(text) as { error: string; code: string };
    assert.equal(body.code, "AI_PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(text, /provider_error|OpenAI|sk-test/i);
  });

  it("returns safe generic errors when the assessment query fails", async () => {
    assessmentQueryError = { code: "500", message: "connection terminated unexpectedly" };
    const res = await POST(makeRequest(), ctx());
    const text = await res.text();
    assert.equal(res.status, 503);
    assert.doesNotMatch(text, /connection terminated|PGRST|500/i);
  });

  it("rejects non-remote_questionnaire assessments", async () => {
    assessmentRow = { ...assessmentRow!, type: "general_msk" };
    const res = await POST(makeRequest(), ctx());
    assert.equal(res.status, 400);
  });
});
