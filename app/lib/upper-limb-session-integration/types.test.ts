/**
 * Run: npx tsx --test app/lib/upper-limb-session-integration/types.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AFFECTED_SIDES,
  COMPLETION_STATES,
  SCHEMA_VERSION,
  TRACKING_QUALITIES,
  UPPER_LIMB_EVENT_TYPES,
  UpperLimbSessionValidationError,
} from "./types";

describe("upper-limb-session-integration types", () => {
  it("defines the expected closed enum values", () => {
    assert.deepEqual([...AFFECTED_SIDES], ["left", "right"]);
    assert.deepEqual([...COMPLETION_STATES], ["completed", "interrupted", "abandoned"]);
    assert.deepEqual([...TRACKING_QUALITIES], ["high", "medium", "low", "insufficient"]);
    assert.deepEqual(
      [...UPPER_LIMB_EVENT_TYPES],
      [
        "target_attempt",
        "target_hit",
        "target_incomplete",
        "tracking_interrupted",
        "tracking_restored",
        "trunk_compensation_observed",
        "session_started",
        "session_completed",
        "session_interrupted",
        "session_abandoned",
        "patient_reported_pain",
        "patient_reported_effort",
      ],
    );
  });

  it("exposes a non-empty schema version string", () => {
    assert.equal(typeof SCHEMA_VERSION, "string");
    assert.ok(SCHEMA_VERSION.length > 0);
  });

  it("builds a validation error carrying a code and message", () => {
    const error = new UpperLimbSessionValidationError("invalid_affected_side", "bad value");
    assert.ok(error instanceof Error);
    assert.equal(error.name, "UpperLimbSessionValidationError");
    assert.equal(error.code, "invalid_affected_side");
    assert.equal(error.message, "bad value");
  });
});
