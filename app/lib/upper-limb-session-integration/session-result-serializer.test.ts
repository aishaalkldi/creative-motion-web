/**
 * Run: npx tsx --test app/lib/upper-limb-session-integration/session-result-serializer.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeUpperLimbSessionResult } from "./session-result-serializer";
import {
  SCHEMA_VERSION,
  type NormalizedUpperLimbSessionResult,
} from "./types";

function buildResult(
  overrides: Partial<NormalizedUpperLimbSessionResult> = {},
): NormalizedUpperLimbSessionResult {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: "session-1",
    patientId: "patient-1",
    exerciseId: "shoulder-reach",
    affectedSide: "left",
    timing: {
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:11:00.000Z",
      elapsedSeconds: 660,
    },
    performance: {
      targetAttempts: 24,
      successfulTargets: 18,
      incompleteAttempts: 2,
    },
    tracking: {
      quality: "medium",
      interruptionCount: 3,
    },
    observations: {
      trunkCompensationCount: 7,
    },
    patientReported: {
      pain: null,
      effort: null,
    },
    completion: {
      state: "completed",
      interruptionReason: null,
    },
    ...overrides,
  };
}

function hasUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefinedDeep);
}

describe("serializeUpperLimbSessionResult", () => {
  it("contains no undefined values anywhere in the output", () => {
    const serialized = serializeUpperLimbSessionResult(buildResult());
    assert.equal(hasUndefinedDeep(serialized), false);
  });

  it("uses explicit null for missing optional values instead of omitting fields", () => {
    const serialized = serializeUpperLimbSessionResult(
      buildResult({
        patientReported: { pain: null, effort: null },
        completion: { state: "abandoned", interruptionReason: null },
      }),
    );
    assert.equal(serialized.patientReported.pain, null);
    assert.equal(serialized.patientReported.effort, null);
    assert.equal(serialized.completion.interruptionReason, null);
    assert.ok("pain" in serialized.patientReported);
    assert.ok("interruptionReason" in serialized.completion);
  });

  it("produces JSON-safe string timestamps, never Date objects", () => {
    const serialized = serializeUpperLimbSessionResult(buildResult());
    assert.equal(typeof serialized.timing.startedAt, "string");
    assert.equal(typeof serialized.timing.endedAt, "string");
    assert.equal(serialized.timing.startedAt, "2026-01-01T10:00:00.000Z");
  });

  it("produces deterministic output for the same input", () => {
    const input = buildResult();
    const first = serializeUpperLimbSessionResult(input);
    const second = serializeUpperLimbSessionResult(input);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it("includes the schema version", () => {
    const serialized = serializeUpperLimbSessionResult(buildResult());
    assert.equal(serialized.schemaVersion, SCHEMA_VERSION);
    assert.equal(typeof serialized.schemaVersion, "string");
  });

  it("preserves factual interruption reasons", () => {
    const serialized = serializeUpperLimbSessionResult(
      buildResult({
        completion: { state: "interrupted", interruptionReason: "tracking was lost" },
      }),
    );
    assert.equal(serialized.completion.interruptionReason, "tracking was lost");
  });

  it("distinguishes completed, interrupted, and abandoned sessions", () => {
    const completed = serializeUpperLimbSessionResult(
      buildResult({ completion: { state: "completed", interruptionReason: null } }),
    );
    const interrupted = serializeUpperLimbSessionResult(
      buildResult({ completion: { state: "interrupted", interruptionReason: "lost tracking" } }),
    );
    const abandoned = serializeUpperLimbSessionResult(
      buildResult({ completion: { state: "abandoned", interruptionReason: null } }),
    );

    assert.equal(completed.completion.state, "completed");
    assert.equal(interrupted.completion.state, "interrupted");
    assert.equal(abandoned.completion.state, "abandoned");
  });

  it("round-trips cleanly through JSON with no functions or classes", () => {
    const serialized = serializeUpperLimbSessionResult(buildResult());
    const roundTripped = JSON.parse(JSON.stringify(serialized));
    assert.deepEqual(roundTripped, serialized);
  });
});
