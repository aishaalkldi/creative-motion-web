/**
 * Run: npx tsx --test app/lib/reports/assessment-report-resolver.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssessmentDetailResponse } from "@/app/api/assessments/[id]/route";
import { resolveAssessmentReportFromDetail } from "./assessment-report-resolver";

const POST_STROKE_STRUCTURED_DATA = {
  assessmentLanguage: "en",
  postStrokeIntake: {
    respondent: { type: "patient" },
    functionalIntake: { functionalGoal: "Return to walking independently" },
    subjectiveNarrative: {
      responses: [{ questionId: "mainDifficulty", inputMode: "text", text: "Weakness on the left side." }],
      patientConfirmedAt: "2026-07-30T08:00:00.000Z",
    },
  },
};

function baseDetail(overrides: Partial<AssessmentDetailResponse["patient"]> = {}): AssessmentDetailResponse {
  return {
    id: "assessment-1",
    patient_id: "patient-1",
    provider_id: "provider-1",
    type: "general_msk",
    structured_data: null,
    notes: null,
    status: "draft",
    created_at: "2026-07-29T08:00:00.000Z",
    updated_at: "2026-07-29T08:00:00.000Z",
    patient: {
      id: "patient-1",
      full_name: "Test Patient",
      diagnosis: "Shoulder pain",
      age: 42,
      gender: null,
      sport: null,
      status: "active",
      file_number: "P-0001",
      ...overrides,
    },
  };
}

describe("resolveAssessmentReportFromDetail — patient reference", () => {
  it("carries patients.file_number through as patientFileNumber", () => {
    const resolved = resolveAssessmentReportFromDetail(baseDetail());
    assert.equal(resolved.patientFileNumber, "P-0001");
  });

  it("resolves to null (never the patient id) when file_number is missing", () => {
    const resolved = resolveAssessmentReportFromDetail(baseDetail({ file_number: null }));
    assert.equal(resolved.patientFileNumber, null);
    assert.notEqual(resolved.patientFileNumber, resolved.resolvedPatientId);
  });

  it("carries patients.age through onto the resolved patient", () => {
    const resolved = resolveAssessmentReportFromDetail(baseDetail({ age: 65 }));
    assert.equal(resolved.patient?.age, 65);
  });

  it("never exposes patient_id or assessment id inside patientFileNumber", () => {
    const resolved = resolveAssessmentReportFromDetail(baseDetail());
    assert.notEqual(resolved.patientFileNumber, "patient-1");
    assert.notEqual(resolved.patientFileNumber, "assessment-1");
  });
});

describe("resolveAssessmentReportFromDetail — post_stroke_intake", () => {
  it("recognizes submitted post_stroke_intake and does not set unsupported-format loadError", () => {
    const resolved = resolveAssessmentReportFromDetail({
      ...baseDetail(),
      type: "post_stroke_intake",
      structured_data: POST_STROKE_STRUCTURED_DATA,
    });
    assert.equal(resolved.kind, "post_stroke_intake");
    assert.equal(resolved.loadError, "");
    assert.ok(resolved.remoteSubmissionMeta);
    assert.equal(resolved.remoteQuestionnaireDraft, null);
  });

  it("still rejects unrelated assessment payloads with the unsupported-format message", () => {
    const resolved = resolveAssessmentReportFromDetail({
      ...baseDetail(),
      type: "post_stroke_intake",
      structured_data: { unrelated: true },
    });
    assert.equal(resolved.kind, null);
    assert.equal(resolved.loadError, "Assessment data format is not supported for this report.");
  });

  it("preserves remote_questionnaire resolution unchanged", () => {
    const resolved = resolveAssessmentReportFromDetail({
      ...baseDetail(),
      type: "remote_questionnaire",
      structured_data: {
        pain: { chiefComplaint: "Shoulder pain" },
      },
    });
    assert.equal(resolved.kind, "remote_questionnaire");
    assert.equal(resolved.loadError, "");
    assert.ok(resolved.remoteQuestionnaireDraft);
  });
});
