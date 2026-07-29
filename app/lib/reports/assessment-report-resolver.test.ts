/**
 * Run: npx tsx --test app/lib/reports/assessment-report-resolver.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssessmentDetailResponse } from "@/app/api/assessments/[id]/route";
import { resolveAssessmentReportFromDetail } from "./assessment-report-resolver";

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
