/**
 * Run: npx tsx --test app/lib/progress/interactive-shoulder-motion-analysis.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InteractiveShoulderOutcomeBlockReport } from "@/app/lib/interactive-shoulder/movement-outcome-report";
import type { InteractiveShoulderOutcomeReportEntry } from "@/app/lib/progress/progress-outcomes-bundle";
import { COMPENSATION_SIGNAL_CAVEAT } from "@/app/lib/progress/interactive-shoulder-outcome-clinician-display";
import {
  FORBIDDEN_OBSERVATION_TERMS,
  averageTargetResponseTimeMs,
  buildBlockMotionProfile,
  buildRecordedSessionObservation,
  buildSessionMotionSnapshot,
  peakMovementAngleDegrees,
  sessionPeakMovementAngleDegrees,
} from "./interactive-shoulder-motion-analysis";

function block(
  overrides: Partial<InteractiveShoulderOutcomeBlockReport> = {},
): InteractiveShoulderOutcomeBlockReport {
  return {
    blockId: "reach-the-light",
    movementId: "shoulder-abduction-reach",
    title: "Reach the Light",
    blockType: "movement-target",
    displayCategory: "target",
    completionReason: "duration",
    durationSeconds: 90,
    interaction: {
      targetsContacted: 24,
      patternsCompleted: 0,
      timingSamplesMs: [1000, 1400],
      responseConsistency: null,
      participationDurationSeconds: 90,
    },
    measured: {
      validRepetitions: 42,
      invalidRepetitions: 0,
      rangeValuesDegrees: [72, 82],
      holdDurationSeconds: null,
      movementSpeed: null,
      returnControl: null,
      trackingConfidence: null,
    },
    interpreted: {
      compensationEvents: 0,
      asymmetryObservations: [],
      fatigueTrend: "unknown",
      reducedControl: false,
      trackingLimitations: [],
    },
    ...overrides,
  };
}

function sessionEntry(
  blocks: InteractiveShoulderOutcomeBlockReport[],
): InteractiveShoulderOutcomeReportEntry {
  return {
    id: "session-1",
    planSessionId: null,
    planId: "plan-1",
    prescribedSide: "LEFT",
    totalElapsedSeconds: 300,
    blocksCompleted: blocks.length,
    blocksTotal: blocks.length,
    schemaVersion: "v1",
    recognizedSchemaVersion: true,
    createdAt: "2026-08-30T00:00:00.000Z",
    blocks,
  };
}

describe("interactive-shoulder-motion-analysis", () => {
  it("derives peak movement angle only from recorded rangeValuesDegrees", () => {
    assert.equal(peakMovementAngleDegrees(block()), 82);
    assert.equal(
      peakMovementAngleDegrees(block({ measured: { ...block().measured, rangeValuesDegrees: [] } })),
      null,
    );
    assert.equal(sessionPeakMovementAngleDegrees(sessionEntry([block(), block({ measured: { ...block().measured, rangeValuesDegrees: [76] } })])), 82);
  });

  it("derives avg target response time only from timingSamplesMs", () => {
    assert.equal(averageTargetResponseTimeMs([1000, 1400]), 1200);
    assert.equal(averageTargetResponseTimeMs([]), null);
  });

  it("hides empty angle and response metrics in block profiles", () => {
    const sparse = buildBlockMotionProfile(
      block({
        interaction: { ...block().interaction, timingSamplesMs: [], targetsContacted: 0 },
        measured: { ...block().measured, rangeValuesDegrees: [], validRepetitions: 0 },
      }),
    );
    assert.deepEqual(sparse, []);
  });

  it("renders D1 pattern performance in block profiles", () => {
    const profile = buildBlockMotionProfile(
      block({
        blockId: "d1-diagonal-reach",
        title: "D1 Diagonal Reach",
        blockType: "movement-pattern",
        displayCategory: "pattern",
        interaction: {
          ...block().interaction,
          targetsContacted: 0,
          patternsCompleted: 5,
          timingSamplesMs: [],
        },
        measured: { ...block().measured, rangeValuesDegrees: [76], validRepetitions: 18 },
      }),
    );
    assert.ok(profile.some((line) => line.label === "Patterns completed" && line.value === "5"));
    const cycles = profile.find((line) => line.label === "Detected reach-return cycles");
    assert.ok(cycles);
    assert.equal(cycles?.secondary, true);
  });

  it("always includes compensation caveat in session snapshot", () => {
    const snapshot = buildSessionMotionSnapshot(
      sessionEntry([
        block({
          interpreted: { ...block().interpreted, compensationEvents: 2 },
        }),
      ]),
    );
    const compensation = snapshot.find((metric) => metric.label === "Compensation signal");
    assert.ok(compensation);
    assert.equal(compensation?.helper, COMPENSATION_SIGNAL_CAVEAT);
  });

  it("never uses evaluative or diagnostic language in session observation", () => {
    const observation = buildRecordedSessionObservation(
      sessionEntry([
        block(),
        block({
          blockId: "d1-diagonal-reach",
          title: "D1 Diagonal Reach",
          blockType: "movement-pattern",
          displayCategory: "pattern",
          interaction: {
            ...block().interaction,
            targetsContacted: 0,
            patternsCompleted: 5,
            timingSamplesMs: [],
          },
          measured: { ...block().measured, rangeValuesDegrees: [76], validRepetitions: 0 },
        }),
      ]),
    );
    assert.ok(observation);
    const lower = observation!.toLowerCase();
    for (const term of FORBIDDEN_OBSERVATION_TERMS) {
      assert.ok(!lower.includes(term), `observation must not include "${term}"`);
    }
    assert.ok(observation!.includes("24 successful interactions"));
    assert.ok(observation!.includes("average response time of 1.2 seconds"));
    assert.ok(observation!.includes("5 completed patterns"));
    assert.ok(observation!.endsWith("For therapist review only."));
  });

  it("renders old outcomes with missing measured samples safely", () => {
    const legacy = sessionEntry([
      block({
        interaction: {
          ...block().interaction,
          timingSamplesMs: [],
          targetsContacted: 3,
        },
        measured: {
          ...block().measured,
          rangeValuesDegrees: [],
          validRepetitions: 0,
        },
      }),
    ]);
    const snapshot = buildSessionMotionSnapshot(legacy);
    assert.equal(snapshot.find((metric) => metric.label === "Peak movement angle"), undefined);
    assert.equal(snapshot.find((metric) => metric.label === "Avg target response time"), undefined);
    const profile = buildBlockMotionProfile(legacy.blocks[0]);
    assert.deepEqual(profile, [{ label: "Target interactions", value: "3" }]);
    const observation = buildRecordedSessionObservation(legacy);
    assert.ok(observation?.includes("3 successful interactions"));
    assert.ok(!observation?.includes("response time"));
  });

  it("does not expose session-wide valid repetition totals in motion analysis", () => {
    const snapshot = buildSessionMotionSnapshot(sessionEntry([block()]));
    assert.equal(snapshot.find((metric) => metric.label === "Valid repetitions"), undefined);
    const observation = buildRecordedSessionObservation(sessionEntry([block()]));
    assert.ok(observation);
    assert.ok(!observation!.toLowerCase().includes("valid repetition"));
  });
});
