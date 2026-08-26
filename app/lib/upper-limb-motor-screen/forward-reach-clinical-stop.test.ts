/**
 * Run:
 *   $env:JITI_ALIAS = @{ '@' = (Get-Location).Path } | ConvertTo-Json -Compress
 *   node --import jiti/register --test "app/lib/upper-limb-motor-screen/forward-reach-clinical-stop.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClinicianClinicalStopEvent } from "./forward-reach-clinical-stop";

describe("buildClinicianClinicalStopEvent", () => {
  it("stamps recordedBy as clinician and reviewRequired as true", () => {
    const event = buildClinicianClinicalStopEvent("patient_requested_stop", "2026-08-17T00:00:00.000Z");
    assert.equal(event.recordedBy, "clinician");
    assert.equal(event.reviewRequired, true);
  });

  it("carries the exact reason the clinician selected, unmodified", () => {
    const event = buildClinicianClinicalStopEvent(
      "new_severe_or_increasing_pain",
      "2026-08-17T00:00:00.000Z",
    );
    assert.equal(event.reason, "new_severe_or_increasing_pain");
  });

  it("uses the explicit recordedAt when supplied", () => {
    const event = buildClinicianClinicalStopEvent("chest_pain", "2026-08-17T12:34:56.000Z");
    assert.equal(event.recordedAt, "2026-08-17T12:34:56.000Z");
  });

  it("defaults recordedAt to the current time when not supplied", () => {
    const before = Date.now();
    const event = buildClinicianClinicalStopEvent("patient_requested_stop");
    const after = Date.now();
    const recordedAtMs = new Date(event.recordedAt).getTime();
    assert.ok(recordedAtMs >= before && recordedAtMs <= after);
  });
});
