/**
 * Run from repo root:
 * npx tsx --experimental-test-module-mocks --test "app/api/assessments/[id]/objective-assignment/route.test.ts"
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import type {
  PtMedicalReportApproved,
  PtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";

type FakeUser = { id: string; email?: string } | null;
type FakeAssessment = {
  id: string;
  patient_id: string;
  provider_id: string;
  type: string;
  structured_data: Record<string, unknown> | null;
} | null;

const FACTS: ApprovedPatientReportFacts = {
  version: 1,
  approvedAt: "2026-07-30T10:00:00.000Z",
  facts: { chiefComplaint: "Patient-reported summary." },
};

const DRAFT: PtMedicalReportDraft = {
  status: "draft",
  version: 1,
  generatedAt: "2026-07-30T10:05:00.000Z",
  sourceFactsVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

const APPROVED: PtMedicalReportApproved = {
  version: 1,
  approvedAt: "2026-07-30T10:10:00.000Z",
  sourceDraftVersion: 1,
  sections: {
    chiefComplaint: "Patient-reported summary.",
    clinicalReviewNote: "Therapist review required.",
  },
};

function gate2ReadyStructuredData(): Record<string, unknown> {
  return {
    approvedPatientReportFacts: FACTS,
    ptMedicalReportDraft: DRAFT,
    ptMedicalReportApproved: APPROVED,
    gate2ApprovedAt: "2026-07-30T10:10:00.000Z",
    postStrokeIntake: {
      respondent: { type: "patient" },
      urgentGate: { symptoms: ["no_new_urgent_symptoms"], flags: [] },
      functionalIntake: { functionalGoal: "Walk safely" },
      subjectiveNarrative: {
        responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Balance" }],
      },
    },
  };
}

let authUser: FakeUser = { id: "user-123", email: "provider@example.com" };
let assessmentRow: FakeAssessment = {
  id: "assess-1",
  patient_id: "patient-1",
  provider_id: "user-123",
  type: "post_stroke_intake",
  structured_data: gate2ReadyStructuredData(),
};
let patientRow = { id: "patient-1", provider_id: "user-123" };
let updateCalls: Array<{ patch: Record<string, unknown> }> = [];

function resetState() {
  authUser = { id: "user-123", email: "provider@example.com" };
  assessmentRow = {
    id: "assess-1",
    patient_id: "patient-1",
    provider_id: "user-123",
    type: "post_stroke_intake",
    structured_data: gate2ReadyStructuredData(),
  };
  patientRow = { id: "patient-1", provider_id: "user-123" };
  updateCalls = [];
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
});

function makeFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: null }),
    },
    from(table: string) {
      if (table === "assessments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: assessmentRow, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              updateCalls.push({ patch });
              if (assessmentRow) {
                assessmentRow = {
                  ...assessmentRow,
                  structured_data: patch.structured_data as Record<string, unknown>,
                };
              }
              return { error: null };
            },
          }),
        };
      }
      if (table === "patients") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              eq: (_column2: string, providerId: string) => ({
                single: async () => {
                  if (
                    patientRow &&
                    patientRow.id === value &&
                    patientRow.provider_id === providerId
                  ) {
                    return { data: patientRow, error: null };
                  }
                  return {
                    data: null,
                    error: { code: "PGRST116", message: "No rows found" },
                  };
                },
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient: () => makeFakeClient(),
  },
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/assessments/assess-1/objective-assignment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function ctx() {
  return { params: Promise.resolve({ id: "assess-1" }) };
}

describe("POST /api/assessments/[id]/objective-assignment", { concurrency: 1 }, () => {
  let POST: (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};

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
    ({ POST } = await import("./route"));
  });

  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => resetState());

  it("assigns 5xSTS for post_stroke_intake with valid Gate 2", async () => {
    const res = await POST(
      makeRequest({
        protocol: "standard_5xsts",
        deliveryMode: "in_clinic",
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { assignment: Record<string, unknown>; idempotent: boolean };
    assert.equal(body.idempotent, false);
    assert.equal(body.assignment.assessmentType, "five_times_sit_to_stand");
    assert.equal(body.assignment.targetRepetitions, 5);
    assert.equal(typeof body.assignment.id, "string");
    assert.equal(typeof body.assignment.assignedAt, "string");
    assert.equal(body.assignment.assignedBy, "user-123");
    assert.equal("result" in body.assignment, false);
  });

  it("rejects non post_stroke_intake assessments", async () => {
    assessmentRow!.type = "remote_questionnaire";
    const res = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(res.status, 400);
  });

  it("rejects when Gate 2 is missing", async () => {
    assessmentRow!.structured_data = {
      ...gate2ReadyStructuredData(),
      ptMedicalReportApproved: undefined,
      gate2ApprovedAt: undefined,
    };
    const res = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(res.status, 409);
  });

  it("rejects stale Gate 2 approval", async () => {
    assessmentRow!.structured_data = {
      ...gate2ReadyStructuredData(),
      ptMedicalReportDraft: { ...DRAFT, version: 2 },
    };
    const res = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(res.status, 409);
  });

  it("rejects remote_self", async () => {
    const res = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "remote_self" }),
      ctx(),
    );
    assert.equal(res.status, 400);
  });

  it("requires supervision confirmation for remote_supervised", async () => {
    const res = await POST(
      makeRequest({
        protocol: "standard_5xsts",
        deliveryMode: "remote_supervised",
        supervisionConfirmed: false,
      }),
      ctx(),
    );
    assert.equal(res.status, 400);
  });

  it("is idempotent when retrying the same immutable assignment", async () => {
    const first = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { assignment: { id: string } };
    const second = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(second.status, 200);
    const secondBody = (await second.json()) as {
      assignment: { id: string };
      idempotent: boolean;
    };
    assert.equal(secondBody.idempotent, true);
    assert.equal(secondBody.assignment.id, firstBody.assignment.id);
    assert.equal(updateCalls.length, 1);
  });

  it("preserves existing post-stroke structured data on assignment", async () => {
    await POST(
      makeRequest({ protocol: "modified_sit_to_stand_observation", deliveryMode: "in_clinic" }),
      ctx(),
    );
    const patch = updateCalls[0]?.patch.structured_data as Record<string, unknown>;
    const intake = patch.postStrokeIntake as Record<string, unknown>;
    assert.deepEqual(intake.functionalIntake, { functionalGoal: "Walk safely" });
    assert.ok(patch.approvedPatientReportFacts);
    assert.ok(patch.ptMedicalReportApproved);
    const objective = intake.objectiveAssessment as Record<string, unknown>;
    assert.equal("result" in objective, false);
    const serialized = JSON.stringify(objective).toLowerCase();
    assert.doesNotMatch(serialized, /diagnosis|severity|fall.risk|clearance|remote_self/);
  });

  it("rejects provider ownership mismatch", async () => {
    patientRow = { id: "patient-1", provider_id: "other-provider" };
    const res = await POST(
      makeRequest({ protocol: "standard_5xsts", deliveryMode: "in_clinic" }),
      ctx(),
    );
    assert.equal(res.status, 404);
  });

  it("rejects parameter changes when a completed assignment already exists", async () => {
    assessmentRow!.structured_data = {
      ...gate2ReadyStructuredData(),
      postStrokeIntake: {
        ...(gate2ReadyStructuredData().postStrokeIntake as Record<string, unknown>),
        objectiveAssessment: {
          assignment: {
            id: "existing-completed",
            assessmentType: "five_times_sit_to_stand",
            protocol: "standard_5xsts",
            deliveryMode: "in_clinic",
            status: "completed",
            targetRepetitions: 5,
            assignedAt: "2026-07-30T11:00:00.000Z",
            assignedBy: "user-123",
          },
        },
      },
    };
    const res = await POST(
      makeRequest({
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      }),
      ctx(),
    );
    assert.equal(res.status, 409);
    assert.equal(updateCalls.length, 0);
  });

  it("permits replacement after a cancelled assignment", async () => {
    assessmentRow!.structured_data = {
      ...gate2ReadyStructuredData(),
      postStrokeIntake: {
        ...(gate2ReadyStructuredData().postStrokeIntake as Record<string, unknown>),
        objectiveAssessment: {
          assignment: {
            id: "existing-cancelled",
            assessmentType: "five_times_sit_to_stand",
            protocol: "standard_5xsts",
            deliveryMode: "in_clinic",
            status: "cancelled",
            targetRepetitions: 5,
            assignedAt: "2026-07-30T11:00:00.000Z",
            assignedBy: "user-123",
          },
        },
      },
    };
    const res = await POST(
      makeRequest({
        protocol: "modified_sit_to_stand_observation",
        deliveryMode: "in_clinic",
      }),
      ctx(),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { assignment: { id: string; assignedBy: string } };
    assert.equal(body.assignment.assignedBy, "user-123");
    assert.notEqual(body.assignment.id, "existing-cancelled");
    assert.equal(updateCalls.length, 1);
  });
});
