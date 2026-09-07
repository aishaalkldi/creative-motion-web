/**
 * Run: npx tsx --test app/lib/clinician/patient-assessments-summary.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAssessmentStatus,
  latestAssessmentPerType,
} from "./patient-assessments-summary";
import type { AssessmentListRow } from "@/app/api/assessments/route";

function row(
  partial: Partial<AssessmentListRow> & Pick<AssessmentListRow, "id" | "type" | "created_at">,
): AssessmentListRow {
  return {
    patient_id: "patient-1",
    provider_id: "provider-1",
    status: "submitted",
    notes: null,
    updated_at: partial.created_at,
    ...partial,
  };
}

describe("latestAssessmentPerType", () => {
  it("keeps only the latest row per assessment type", () => {
    const latest = latestAssessmentPerType([
      row({ id: "intake-old", type: "remote_questionnaire", created_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "intake-new", type: "remote_questionnaire", created_at: "2026-03-01T00:00:00.000Z" }),
      row({ id: "battery", type: "upper_limb_motor_screen", created_at: "2026-02-01T00:00:00.000Z" }),
    ]);

    assert.deepEqual(
      latest.map((item) => item.id),
      ["intake-new", "battery"],
    );
  });
});

describe("formatAssessmentStatus", () => {
  it("formats workflow enums for clinician display", () => {
    assert.equal(formatAssessmentStatus("draft_ready"), "Draft Ready");
    assert.equal(formatAssessmentStatus("approved"), "Approved");
  });
});
