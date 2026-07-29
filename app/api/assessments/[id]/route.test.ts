/**
 * Focused mocked coverage for PATCH /api/assessments/[id]'s
 * markChiefComplaintExtractionReviewed confirmation branch. No real
 * Supabase, OpenAI, or external network call is made anywhere in this
 * file â€” every external dependency is mocked, and a global fetch guard
 * fails any test that attempts a real network call.
 *
 * Run: npx tsx --experimental-test-module-mocks --test app/api/assessments/[id]/route.test.ts
 * (must be run from within this directory, or from a shell that does not
 * treat the "[id]" path segment as a glob â€” see Stage 1's report for the
 * same Node test-runner quirk.)
 */
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

type FakeUser = { id: string; email?: string } | null;
type FakePatient = { id: string; provider_id: string } | null;
type FakeAssessment = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: Record<string, unknown> | null;
} | null;

const SHOULDER_EXTRACTION = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.92,
};

function defaultStructuredData(): Record<string, unknown> {
  return {
    assessmentLanguage: "ar",
    pain: {
      chiefComplaint: "عندي ألم في الكتف الأيمن لما أرفع يدي.",
      painLocation: "shoulder",
    },
    rom: { limitations: "cannot raise arm overhead" },
    painLocation_en: "Right shoulder pain.",
    painLocation_en_generated_at: "2026-01-01T00:00:00.000Z",
    painLocation_en_reviewed: true,
    chiefComplaint_extraction: SHOULDER_EXTRACTION,
    chiefComplaint_extraction_generated_at: "2026-01-02T00:00:00.000Z",
    chiefComplaint_extraction_reviewed: false,
  };
}

let authUser: FakeUser = { id: "user-123", email: "provider@example.com" };
let authError: unknown = null;
let assessmentRow: FakeAssessment = {
  id: "assess-1",
  patient_id: "patient-1",
  provider_id: "user-123",
  type: "remote_questionnaire",
  structured_data: defaultStructuredData(),
};
let assessmentQueryError: { code?: string; message?: string } | null = null;
let patientRow: FakePatient = { id: "patient-1", provider_id: "user-123" };
let patientQueryError: { code?: string; message?: string } | null = null;
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
    structured_data: defaultStructuredData(),
  };
  assessmentQueryError = null;
  patientRow = { id: "patient-1", provider_id: "user-123" };
  patientQueryError = null;
  updateCalls = [];
  updateError = null;
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

// See app/api/assessments/[id]/extract/route.test.ts for why only
// @supabase/ssr's createServerClient is mocked here (mock.module() does
// not reliably intercept @supabase/supabase-js's createClient in this
// tsx/Node setup) â€” we never set SUPABASE_SERVICE_ROLE_KEY, so
// buildClients() falls back to `adminClient = sessionClient`, exactly as
// in production with no service key configured.
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
                if (patch.structured_data && assessmentRow) {
                  assessmentRow.structured_data = patch.structured_data as Record<string, unknown>;
                }
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

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/assessments/assess-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("PATCH /api/assessments/[id] â€” markChiefComplaintExtractionReviewed", { concurrency: 1 }, () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    for (const key of Object.keys(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    }
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ({ PATCH } = await import("./route"));
  });

  beforeEach(() => {
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

  it("returns 401 for an unauthenticated confirmation request", async () => {
    resetState();
    authUser = null;
    authError = { message: "Auth session missing" };

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 401);
  });

  it("returns the existing safe response when the assessment is not found", async () => {
    resetState();
    assessmentRow = null;

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Not found");
  });

  it("rejects an ownership failure safely, without leaking the patient or provider id", async () => {
    resetState();
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Patient not found.");
    assert.doesNotMatch(body.error, /patient-1|user-123/);
  });

  it("returns a safe 400 when no extraction exists to confirm", async () => {
    resetState();
    const data = defaultStructuredData();
    delete data.chiefComplaint_extraction;
    assessmentRow!.structured_data = data;

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "No extraction to confirm.");
    assert.equal(updateCalls.length, 0);
  });

  it("returns a safe 400 when chiefComplaint_extraction is present but not a valid object", async () => {
    resetState();
    const data = defaultStructuredData();
    data.chiefComplaint_extraction = "not an object";
    assessmentRow!.structured_data = data;

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 400);
    assert.equal(updateCalls.length, 0);
  });

  it("succeeds and returns { reviewed: true } for a valid confirmation", async () => {
    resetState();

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as { reviewed: boolean };
    assert.deepEqual(body, { reviewed: true });
  });

  it("sets only chiefComplaint_extraction_reviewed to true", async () => {
    resetState();

    await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(updateCalls.length, 1);
    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(patch.chiefComplaint_extraction_reviewed, true);
  });

  it("leaves the original pain.chiefComplaint text byte-for-byte unchanged", async () => {
    resetState();
    const original = (assessmentRow!.structured_data as Record<string, unknown>).pain;
    const originalChiefComplaint = (original as Record<string, unknown>).chiefComplaint;

    await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const pain = patch.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, originalChiefComplaint);
  });

  it("leaves chiefComplaint_extraction byte-for-byte unchanged", async () => {
    resetState();

    await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.deepEqual(patch.chiefComplaint_extraction, SHOULDER_EXTRACTION);
  });

  it("leaves chiefComplaint_extraction_generated_at unchanged", async () => {
    resetState();

    await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(patch.chiefComplaint_extraction_generated_at, "2026-01-02T00:00:00.000Z");
  });

  it("leaves existing translation keys and unrelated patient answers unchanged", async () => {
    resetState();

    await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(patch.painLocation_en, "Right shoulder pain.");
    assert.equal(patch.painLocation_en_generated_at, "2026-01-01T00:00:00.000Z");
    assert.equal(patch.painLocation_en_reviewed, true);
    assert.deepEqual(patch.rom, { limitations: "cannot raise arm overhead" });
    const pain = patch.pain as Record<string, unknown>;
    assert.equal(pain.painLocation, "shoulder");
  });

  it("confirming an already-reviewed extraction remains safely reviewed and uncorrupted", async () => {
    resetState();
    const data = defaultStructuredData();
    data.chiefComplaint_extraction_reviewed = true;
    assessmentRow!.structured_data = data;

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as { reviewed: boolean };
    assert.deepEqual(body, { reviewed: true });
    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(patch.chiefComplaint_extraction_reviewed, true);
    assert.deepEqual(patch.chiefComplaint_extraction, SHOULDER_EXTRACTION);
  });

  it("returns a safe error when the Supabase assessment read fails, without leaking the DB error", async () => {
    resetState();
    assessmentQueryError = { code: "500", message: "connection terminated unexpectedly" };

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());
    const text = await res.text();

    assert.equal(res.status, 404);
    assert.doesNotMatch(text, /connection terminated|500/i);
  });

  it("returns a safe error when the Supabase update fails, without leaking the DB error", async () => {
    resetState();
    updateError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const res = await PATCH(makeRequest({ markChiefComplaintExtractionReviewed: true }), ctx());
    const text = await res.text();

    assert.equal(res.status, 500);
    assert.doesNotMatch(text, /duplicate key|23505|constraint/i);
  });

  it("an unrelated PATCH body does not trigger extraction confirmation", async () => {
    resetState();

    const res = await PATCH(makeRequest({ notes: "just a routine note update" }), ctx());

    assert.notEqual(res.status, 200);
    const body = (await res.json().catch(() => ({}))) as { reviewed?: boolean };
    assert.notEqual(body.reviewed, true);
    assert.equal(updateCalls.length, 0);
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});

const GATE1_FACTS = {
  version: 1,
  approvedAt: "2026-07-29T08:00:00.000Z",
  facts: {
    chiefComplaint: "The patient reports right shoulder pain.",
    painLocation: "Right shoulder pain.",
  },
};

const PT_DRAFT = {
  version: 1,
  status: "draft" as const,
  generatedAt: "2026-07-29T09:00:00.000Z",
  sourceFactsVersion: 1,
  sections: {
    chiefComplaint: "The patient reports right shoulder pain.",
    clinicalReviewNote: "Therapist review required.",
  },
};

function structuredWithPtDraft(): Record<string, unknown> {
  return {
    ...defaultStructuredData(),
    approvedPatientReportFacts: GATE1_FACTS,
    gate1ApprovedAt: GATE1_FACTS.approvedAt,
    ptMedicalReportDraft: PT_DRAFT,
  };
}

describe("PATCH /api/assessments/[id] â€” PT report draft save and Gate 2 approval", { concurrency: 1 }, () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    for (const key of Object.keys(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    }
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ({ PATCH } = await import("./route"));
  });

  beforeEach(() => {
    resetState();
    assessmentRow!.structured_data = structuredWithPtDraft();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("no real network call is permitted in this test file");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function ctx() {
    return { params: Promise.resolve({ id: "assess-1" }) };
  }

  it("returns 401 for an unauthenticated save request", async () => {
    authUser = null;
    authError = { message: "Auth session missing" };
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: { chiefComplaint: "Edited complaint." },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 401);
  });

  it("rejects wrong clinician ownership for save", async () => {
    patientRow = null;
    patientQueryError = { code: "PGRST116", message: "no rows" };
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: { chiefComplaint: "Edited complaint." },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 404);
  });

  it("blocks Gate 2 approval when the report draft is missing", async () => {
    assessmentRow!.structured_data = {
      ...structuredWithPtDraft(),
    };
    delete (assessmentRow!.structured_data as Record<string, unknown>).ptMedicalReportDraft;

    const res = await PATCH(makeRequest({ approvePtMedicalReport: true }), ctx());
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Generate and review/i);
  });

  it("ignores unknown report section keys while saving known sections", async () => {
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: {
            chiefComplaint: "Edited complaint.",
            diagnosis: "must be ignored",
            clinicalReviewNote: "Therapist review required.",
          },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      saved: boolean;
      ptMedicalReportDraft: { sections: Record<string, string> };
    };
    assert.equal(body.saved, true);
    assert.equal(body.ptMedicalReportDraft.sections.chiefComplaint, "Edited complaint.");
    assert.equal("diagnosis" in body.ptMedicalReportDraft.sections, false);
  });

  it("saves edited known sections without approving the report", async () => {
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: {
            chiefComplaint: "Edited complaint.",
            clinicalReviewNote: "Therapist review required.",
          },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { saved: boolean; approved?: boolean };
    assert.equal(body.saved, true);
    assert.notEqual(body.approved, true);

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const pain = patch.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, "عندي ألم في الكتف الأيمن لما أرفع يدي.");
    assert.deepEqual(patch.approvedPatientReportFacts, GATE1_FACTS);
    assert.deepEqual(patch.rom, { limitations: "cannot raise arm overhead" });
    assert.equal("ptMedicalReportApproved" in patch, false);
    assert.equal("gate2ApprovedAt" in patch, false);
  });

  it("creates ptMedicalReportApproved on explicit approval", async () => {
    const res = await PATCH(makeRequest({ approvePtMedicalReport: true }), ctx());
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      approved: boolean;
      ptMedicalReportApproved: {
        sourceDraftVersion: number;
        sections: Record<string, string>;
      };
    };
    assert.equal(body.approved, true);
    assert.equal(body.ptMedicalReportApproved.sourceDraftVersion, 1);
    assert.equal(
      body.ptMedicalReportApproved.sections.chiefComplaint,
      PT_DRAFT.sections.chiefComplaint,
    );

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal(typeof patch.gate2ApprovedAt, "string");
    assert.deepEqual(
      (patch.ptMedicalReportApproved as { sections: Record<string, string> }).sections.chiefComplaint,
      PT_DRAFT.sections.chiefComplaint,
    );
  });

  it("does not approve automatically from unrelated PATCH bodies", async () => {
    const res = await PATCH(makeRequest({ notes: "routine note" }), ctx());
    assert.notEqual(res.status, 200);
    assert.equal(updateCalls.length, 0);
  });

  it("invalidates Gate 2 when saving edits after approval", async () => {
    assessmentRow!.structured_data = {
      ...structuredWithPtDraft(),
      ptMedicalReportApproved: {
        version: 1,
        approvedAt: "2026-07-29T10:00:00.000Z",
        sourceDraftVersion: 1,
        sections: PT_DRAFT.sections,
      },
      gate2ApprovedAt: "2026-07-29T10:00:00.000Z",
    };

    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: {
            chiefComplaint: "Edited after approval.",
            clinicalReviewNote: "Therapist review required.",
          },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { gate2Invalidated: boolean };
    assert.equal(body.gate2Invalidated, true);

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    assert.equal("ptMedicalReportApproved" in patch, false);
    assert.equal("gate2ApprovedAt" in patch, false);
    assert.equal(
      (patch.ptMedicalReportDraft as { sections: Record<string, string> }).sections.chiefComplaint,
      "Edited after approval.",
    );
  });

  it("rejects forbidden clinical claims in saved draft sections", async () => {
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: {
            chiefComplaint: "Diagnosis: rotator cuff tear.",
            clinicalReviewNote: "Review required.",
          },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 400);
    assert.equal(updateCalls.length, 0);
  });

  it("returns a safe error when the update fails", async () => {
    updateError = { code: "500", message: "db unavailable" };
    const res = await PATCH(
      makeRequest({
        savePtMedicalReportDraft: {
          sections: {
            chiefComplaint: "Edited complaint.",
            clinicalReviewNote: "Therapist review required.",
          },
        },
      }),
      ctx(),
    );
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.doesNotMatch(text, /db unavailable|500/i);
  });
});

describe("PATCH /api/assessments/[id] â€” approvePatientReportFacts", { concurrency: 1 }, () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  before(async () => {
    const testEnv: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
    for (const key of Object.keys(testEnv)) {
      savedEnv[key] = process.env[key];
      process.env[key] = testEnv[key];
    }
    savedEnv.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    ({ PATCH } = await import("./route"));
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

  it("returns 401 for an unauthenticated approval request", async () => {
    authUser = null;
    authError = { message: "Auth session missing" };

    const res = await PATCH(makeRequest({ approvePatientReportFacts: true }), ctx());

    assert.equal(res.status, 401);
  });

  it("persists an explicit approved fact snapshot without mutating Arabic originals", async () => {
    const res = await PATCH(makeRequest({ approvePatientReportFacts: true }), ctx());

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      approved: boolean;
      approvedPatientReportFacts: { facts: Record<string, string> };
    };
    assert.equal(body.approved, true);
    assert.equal(body.approvedPatientReportFacts.facts.painLocation, "Right shoulder pain.");
    assert.equal(updateCalls.length, 1);

    const patch = updateCalls[0].patch.structured_data as Record<string, unknown>;
    const pain = patch.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, "عندي ألم في الكتف الأيمن لما أرفع يدي.");
    assert.equal(typeof patch.gate1ApprovedAt, "string");
    assert.equal(
      (patch.approvedPatientReportFacts as { facts: Record<string, string> }).facts.painLocation,
      "Right shoulder pain.",
    );
    assert.deepEqual(patch.chiefComplaint_extraction, SHOULDER_EXTRACTION);
    assert.deepEqual(patch.rom, { limitations: "cannot raise arm overhead" });
  });

  it("does not approve automatically from unrelated PATCH bodies", async () => {
    const res = await PATCH(makeRequest({ notes: "routine note" }), ctx());

    assert.notEqual(res.status, 200);
    const body = (await res.json().catch(() => ({}))) as { approved?: boolean };
    assert.notEqual(body.approved, true);
    assert.equal(updateCalls.length, 0);
  });

  it("rejects approval for non-remote questionnaire assessments", async () => {
    assessmentRow!.type = "general_msk";

    const res = await PATCH(makeRequest({ approvePatientReportFacts: true }), ctx());

    assert.equal(res.status, 400);
    assert.equal(updateCalls.length, 0);
  });

  it("replaces the prior snapshot when explicitly re-approved with newly reviewed values", async () => {
    assessmentRow!.structured_data = {
      ...(assessmentRow!.structured_data as Record<string, unknown>),
      approvedPatientReportFacts: {
        version: 1,
        approvedAt: "2026-07-29T08:00:00.000Z",
        facts: { painLocation: "Right shoulder pain." },
      },
      gate1ApprovedAt: "2026-07-29T08:00:00.000Z",
      ptMedicalReportDraft: {
        version: 2,
        status: "draft",
        generatedAt: "2026-07-29T09:00:00.000Z",
        sourceFactsVersion: 1,
        sections: { chiefComplaint: "Old draft." },
      },
      ptMedicalReportApproved: {
        version: 1,
        approvedAt: "2026-07-29T10:00:00.000Z",
        sourceDraftVersion: 2,
        sections: { chiefComplaint: "Old draft." },
      },
      gate2ApprovedAt: "2026-07-29T10:00:00.000Z",
    };

    const firstRes = await PATCH(makeRequest({ approvePatientReportFacts: true }), ctx());
    assert.equal(firstRes.status, 200);
    const firstBody = (await firstRes.json()) as {
      approvedPatientReportFacts: { approvedAt: string; facts: Record<string, string> };
    };
    const firstApprovedAt = firstBody.approvedPatientReportFacts.approvedAt;
    assert.equal(firstBody.approvedPatientReportFacts.facts.painLocation, "Right shoulder pain.");
    assert.equal(firstBody.approvedPatientReportFacts.facts.chiefComplaint, undefined);

    assessmentRow!.structured_data = {
      ...(assessmentRow!.structured_data as Record<string, unknown>),
      chiefComplaint_en: "Pain in the right shoulder when raising the arm.",
      chiefComplaint_en_generated_at: "2026-01-03T00:00:00.000Z",
      chiefComplaint_en_reviewed: true,
      chiefComplaint_extraction_reviewed: true,
    };

    const secondRes = await PATCH(makeRequest({ approvePatientReportFacts: true }), ctx());
    assert.equal(secondRes.status, 200);
    const secondBody = (await secondRes.json()) as {
      approved: boolean;
      approvedPatientReportFacts: {
        approvedAt: string;
        facts: Record<string, string>;
        chiefComplaintExtraction?: unknown;
      };
    };
    assert.equal(secondBody.approved, true);
    assert.equal(
      secondBody.approvedPatientReportFacts.facts.chiefComplaint,
      "Pain in the right shoulder when raising the arm.",
    );
    assert.equal(secondBody.approvedPatientReportFacts.facts.painLocation, "Right shoulder pain.");
    assert.ok(secondBody.approvedPatientReportFacts.approvedAt);
    assert.ok(secondBody.approvedPatientReportFacts.chiefComplaintExtraction);

    assert.equal(updateCalls.length, 2);
    const secondPatch = updateCalls[1].patch.structured_data as Record<string, unknown>;
    const pain = secondPatch.pain as Record<string, unknown>;
    assert.equal(pain.chiefComplaint, "عندي ألم في الكتف الأيمن لما أرفع يدي.");
    assert.equal(secondPatch.gate1ApprovedAt, secondBody.approvedPatientReportFacts.approvedAt);
    assert.deepEqual(secondPatch.rom, { limitations: "cannot raise arm overhead" });
    assert.deepEqual(secondPatch.chiefComplaint_extraction, SHOULDER_EXTRACTION);
    assert.equal("ptMedicalReportDraft" in secondPatch, false);
    assert.equal("ptMedicalReportApproved" in secondPatch, false);
    assert.equal("gate2ApprovedAt" in secondPatch, false);
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});
