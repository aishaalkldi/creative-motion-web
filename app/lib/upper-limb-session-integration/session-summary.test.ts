/**
 * Run: npx tsx --test app/lib/upper-limb-session-integration/session-summary.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUpperLimbFactualSessionSummary } from "./session-summary";
import { SCHEMA_VERSION, type NormalizedUpperLimbSessionResult } from "./types";

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

const BANNED_PHRASES = [
  "diagnos",
  "muscle weakness",
  "safe for independent",
  "is safe",
  "unsafe",
  "improved clinically",
  "clinical improvement",
  "increase the exercise difficulty",
  "decrease the exercise difficulty",
  "treatment plan should",
  "adjust the treatment",
  "stroke severity",
  "performed normally",
  "failed the exercise",
  "compared to",
  "clinical norm",
];

function allSummaryText(summary: ReturnType<typeof buildUpperLimbFactualSessionSummary>): string {
  return [...summary.measuredFacts, ...summary.observedBehavior, ...summary.therapistReviewNotes, summary.text]
    .join(" ")
    .toLowerCase();
}

describe("buildUpperLimbFactualSessionSummary — factual content", () => {
  it("contains factual wording matching measured values", () => {
    const summary = buildUpperLimbFactualSessionSummary(buildResult());

    assert.ok(summary.measuredFacts.includes("Session completed in 11 minutes."));
    assert.ok(summary.measuredFacts.includes("18 of 24 target attempts were completed."));
    assert.ok(summary.measuredFacts.includes("Tracking quality was medium."));
    assert.ok(summary.measuredFacts.includes("Tracking was interrupted 3 times."));
    assert.ok(
      summary.observedBehavior.includes("Trunk compensation was observed during 7 attempts."),
    );
  });

  it("preserves the interruption reason as a factual statement", () => {
    const summary = buildUpperLimbFactualSessionSummary(
      buildResult({ completion: { state: "interrupted", interruptionReason: "tracking was lost" } }),
    );
    assert.ok(
      summary.measuredFacts.includes("The session was interrupted because tracking was lost."),
    );
  });

  it("handles missing pain and effort values without fabricating them", () => {
    const summary = buildUpperLimbFactualSessionSummary(
      buildResult({ patientReported: { pain: null, effort: null } }),
    );
    const text = summary.measuredFacts.join(" ");
    assert.ok(!text.includes("pain"));
    assert.ok(!text.includes("effort"));
  });

  it("reports patient-reported pain and effort as neutral scores when present", () => {
    const summary = buildUpperLimbFactualSessionSummary(
      buildResult({ patientReported: { pain: 3, effort: 6 } }),
    );
    assert.ok(summary.measuredFacts.includes("Patient-reported pain score was 3."));
    assert.ok(summary.measuredFacts.includes("Patient-reported effort score was 6."));
  });
});

describe("buildUpperLimbFactualSessionSummary — therapist-review labeling", () => {
  it("clearly labels trunk-compensation observations as requiring therapist review", () => {
    const summary = buildUpperLimbFactualSessionSummary(buildResult({ observations: { trunkCompensationCount: 7 } }));
    assert.ok(
      summary.therapistReviewNotes.some(
        (note) => note.includes("Trunk compensation") && note.includes("requires therapist review"),
      ),
    );
  });

  it("does not raise a therapist-review note when no trunk compensation was observed", () => {
    const summary = buildUpperLimbFactualSessionSummary(
      buildResult({ observations: { trunkCompensationCount: 0 } }),
    );
    assert.ok(!summary.therapistReviewNotes.some((note) => note.includes("Trunk compensation")));
  });

  it("labels non-completed sessions as requiring therapist review", () => {
    const summary = buildUpperLimbFactualSessionSummary(
      buildResult({ completion: { state: "interrupted", interruptionReason: "tracking was lost" } }),
    );
    assert.ok(summary.therapistReviewNotes.some((note) => note.includes("requires therapist review")));
  });

  it("labels low or insufficient tracking quality as requiring therapist review", () => {
    const summary = buildUpperLimbFactualSessionSummary(buildResult({ tracking: { quality: "insufficient", interruptionCount: 0 } }));
    assert.ok(
      summary.therapistReviewNotes.some(
        (note) => note.includes("Tracking quality") && note.includes("requires therapist review"),
      ),
    );
  });
});

describe("buildUpperLimbFactualSessionSummary — no clinical judgment", () => {
  it("never generates diagnosis, safety verdicts, treatment recommendations, or severity wording", () => {
    const scenarios: NormalizedUpperLimbSessionResult[] = [
      buildResult(),
      buildResult({ completion: { state: "interrupted", interruptionReason: "tracking was lost" } }),
      buildResult({ completion: { state: "abandoned", interruptionReason: null } }),
      buildResult({ tracking: { quality: "insufficient", interruptionCount: 5 } }),
      buildResult({ observations: { trunkCompensationCount: 12 } }),
      buildResult({ patientReported: { pain: 8, effort: 9 } }),
    ];

    for (const scenario of scenarios) {
      const summary = buildUpperLimbFactualSessionSummary(scenario);
      const text = allSummaryText(summary);
      for (const banned of BANNED_PHRASES) {
        assert.ok(!text.includes(banned), `summary unexpectedly contained banned phrase: "${banned}"`);
      }
    }
  });

  it("does not compare the session against clinical norms", () => {
    const summary = buildUpperLimbFactualSessionSummary(buildResult());
    const text = allSummaryText(summary);
    assert.ok(!text.includes("average patient"));
    assert.ok(!text.includes("typical patient"));
    assert.ok(!text.includes("expected range"));
  });
});
