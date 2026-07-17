/**
 * Run: npx tsx --test app/api/clinician/ai-session-summary/__tests__/get-route.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAiSessionSummaryGetParams } from "@/app/lib/ai/clinician-summary-persistence";

describe("GET /api/clinician/ai-session-summary query params", () => {
  it("requires patientId", () => {
    assert.deepEqual(parseAiSessionSummaryGetParams(new URLSearchParams()), { ok: false });
  });

  it("scopes hydration reads by patient and optional plan", () => {
    assert.deepEqual(
      parseAiSessionSummaryGetParams(new URLSearchParams({ patientId: "patient-1" })),
      { ok: true, patientId: "patient-1", planId: null },
    );
    assert.deepEqual(
      parseAiSessionSummaryGetParams(
        new URLSearchParams({ patientId: "patient-1", planId: "plan-1" }),
      ),
      { ok: true, patientId: "patient-1", planId: "plan-1" },
    );
  });
});
