/**
 * Run: npx tsx --test app/lib/patient-lifetime-summary.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_PATIENT_LIFETIME_SUMMARY,
  shouldShowPatientLifetimeSummary,
  type PatientLifetimeSummary,
} from "./patient-lifetime-summary";

describe("shouldShowPatientLifetimeSummary", () => {
  it("hides when all counts are zero and no last activity", () => {
    assert.equal(shouldShowPatientLifetimeSummary(EMPTY_PATIENT_LIFETIME_SUMMARY), false);
  });

  it("shows when completed sessions > 0", () => {
    const summary: PatientLifetimeSummary = {
      ...EMPTY_PATIENT_LIFETIME_SUMMARY,
      totalCompletedSessions: 3,
    };
    assert.equal(shouldShowPatientLifetimeSummary(summary), true);
  });

  it("shows when programs assigned > 0", () => {
    const summary: PatientLifetimeSummary = {
      ...EMPTY_PATIENT_LIFETIME_SUMMARY,
      totalProgramsAssigned: 2,
    };
    assert.equal(shouldShowPatientLifetimeSummary(summary), true);
  });

  it("shows when movement captures > 0", () => {
    const summary: PatientLifetimeSummary = {
      ...EMPTY_PATIENT_LIFETIME_SUMMARY,
      totalCvSessions: 1,
    };
    assert.equal(shouldShowPatientLifetimeSummary(summary), true);
  });

  it("shows when lastActivityAt is set", () => {
    const summary: PatientLifetimeSummary = {
      ...EMPTY_PATIENT_LIFETIME_SUMMARY,
      lastActivityAt: "2026-06-01T12:00:00.000Z",
    };
    assert.equal(shouldShowPatientLifetimeSummary(summary), true);
  });
});
