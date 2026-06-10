/**
 * Run: npx tsx --test app/lib/patient-movement-check.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPatientMovementCheckView,
  patientMovementCheckValue,
} from "./patient-movement-check";

describe("patient movement check", () => {
  it("maps functional-reach to rep count and SLS to hold seconds", () => {
    assert.equal(patientMovementCheckValue("functional-reach", 5, 30), 5);
    assert.equal(patientMovementCheckValue("single-leg-stance", 0, 22), 22);
    assert.equal(patientMovementCheckValue("sit-to-stand", 10, 30), null);
  });

  it("builds latest, best, and before vs latest summaries", () => {
    const view = buildPatientMovementCheckView([
      {
        exerciseId: "functional-reach",
        recordedAt: "2026-01-01T10:00:00.000Z",
        value: 4,
      },
      {
        exerciseId: "functional-reach",
        recordedAt: "2026-01-08T10:00:00.000Z",
        value: 6,
      },
      {
        exerciseId: "functional-reach",
        recordedAt: "2026-01-15T10:00:00.000Z",
        value: 5,
      },
    ]);

    const fr = view.exercises.find((row) => row.exerciseId === "functional-reach");
    assert.ok(fr);
    assert.equal(fr?.latest?.value, 5);
    assert.equal(fr?.best?.value, 6);
    assert.equal(fr?.before?.value, 4);
    assert.equal(fr?.hasComparison, true);
    assert.equal(view.hasAnyResults, true);
  });
});
