/**
 * Run:
 *   npx tsx --test app/lib/interactive-shoulder/movement-outcome-report.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInteractiveShoulderOutcomeReportEntries,
  buildInteractiveShoulderOutcomeReportEntry,
} from "./movement-outcome-report";
import type { InteractiveShoulderOutcomeReportRow } from "./movement-outcome-persistence";
import { INTERACTIVE_SHOULDER_MOVEMENT_OUTCOME_SCHEMA_VERSION } from "./movement-outcome-types";

const ROW_ID = "55555555-5555-5555-5555-555555555555";
const PLAN_SESSION_ID = "33333333-3333-3333-3333-333333333333";
const PLAN_ID = "44444444-4444-4444-4444-444444444444";
const NOW = "2026-08-27T10:00:00.000Z";

function blockResult(overrides: Record<string, unknown> = {}) {
  return {
    blockId: "d1-inspired-diagonal-reach-main",
    movementId: "shoulder-abduction-reach",
    startedAtMs: 0,
    completedAtMs: 92000,
    completionReason: "duration",
    interaction: {
      targetsContacted: 5,
      patternsCompleted: 0,
      timingSamplesMs: [400, 420],
      responseConsistency: 0.8,
      participationDurationSeconds: 90,
    },
    measured: {
      validRepetitions: 5,
      invalidRepetitions: 1,
      rangeValuesDegrees: [90, 92],
      holdDurationSeconds: null,
      movementSpeed: 1.2,
      returnControl: 0.7,
      trackingConfidence: 0.9,
    },
    interpreted: {
      compensationEvents: 1,
      asymmetryObservations: ["Slight trunk lean during reach"],
      fatigueTrend: "stable",
      reducedControl: false,
      trackingLimitations: [],
    },
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    planSessionId: PLAN_SESSION_ID,
    prescribedSide: "right",
    sessionState: "completed",
    totalElapsedSeconds: 95,
    blocksCompleted: 1,
    blocksTotal: 1,
    blockResults: [blockResult()],
    schemaVersion: INTERACTIVE_SHOULDER_MOVEMENT_OUTCOME_SCHEMA_VERSION,
    ...overrides,
  };
}

function row(overrides: Partial<InteractiveShoulderOutcomeReportRow> = {}): InteractiveShoulderOutcomeReportRow {
  return {
    id: ROW_ID,
    plan_session_id: PLAN_SESSION_ID,
    plan_id: PLAN_ID,
    prescribed_side: "right",
    session_state: "completed",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outcome_payload: payload() as any,
    schema_version: INTERACTIVE_SHOULDER_MOVEMENT_OUTCOME_SCHEMA_VERSION,
    created_at: NOW,
    ...overrides,
  };
}

describe("buildInteractiveShoulderOutcomeReportEntry — happy path", () => {
  it("maps session-level facts through unchanged", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row());
    assert.equal(entry.id, ROW_ID);
    assert.equal(entry.planSessionId, PLAN_SESSION_ID);
    assert.equal(entry.planId, PLAN_ID);
    assert.equal(entry.prescribedSide, "right");
    assert.equal(entry.totalElapsedSeconds, 95);
    assert.equal(entry.blocksCompleted, 1);
    assert.equal(entry.blocksTotal, 1);
    assert.equal(entry.createdAt, NOW);
    assert.equal(entry.recognizedSchemaVersion, true);
  });

  it("preserves the interaction / measured / interpreted separation per block — never collapsed into one shape", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row());
    const block = entry.blocks[0];
    assert.ok(block);
    assert.ok("interaction" in block);
    assert.ok("measured" in block);
    assert.ok("interpreted" in block);
    assert.deepEqual(Object.keys(block.interaction).sort(), [
      "participationDurationSeconds",
      "patternsCompleted",
      "responseConsistency",
      "targetsContacted",
      "timingSamplesMs",
    ]);
    assert.deepEqual(Object.keys(block.measured).sort(), [
      "holdDurationSeconds",
      "invalidRepetitions",
      "movementSpeed",
      "rangeValuesDegrees",
      "returnControl",
      "trackingConfidence",
      "validRepetitions",
    ]);
    assert.deepEqual(Object.keys(block.interpreted).sort(), [
      "asymmetryObservations",
      "compensationEvents",
      "fatigueTrend",
      "reducedControl",
      "trackingLimitations",
    ]);
    // No field from one category leaks into another.
    assert.equal("compensationEvents" in block.measured, false);
    assert.equal("validRepetitions" in block.interpreted, false);
  });

  it("derives block durationSeconds only as a literal difference of the two persisted timestamps", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row());
    assert.equal(entry.blocks[0]?.durationSeconds, 92);
  });

  it("no invented score/grade/percentage field appears anywhere on the entry or its blocks", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row());
    const entryKeys = Object.keys(entry);
    const forbidden = [
      "score",
      "grade",
      "risk",
      "diagnosis",
      "percentage",
      "progressPct",
      "completionPct",
      "accuracy",
      "symmetryScore",
      "impairment",
      "recovery",
    ];
    for (const key of entryKeys) {
      for (const bad of forbidden) {
        assert.equal(
          key.toLowerCase().includes(bad.toLowerCase()),
          false,
          `entry field "${key}" looks like an invented score/grade`,
        );
      }
    }
    for (const block of entry.blocks) {
      for (const key of [...Object.keys(block), ...Object.keys(block.measured), ...Object.keys(block.interaction), ...Object.keys(block.interpreted)]) {
        for (const bad of forbidden) {
          assert.equal(
            key.toLowerCase().includes(bad.toLowerCase()),
            false,
            `block field "${key}" looks like an invented score/grade`,
          );
        }
      }
    }
  });

  it("never derives a percentage from blocksCompleted/blocksTotal — both are passed through as raw counts only", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({ outcome_payload: payload({ blocksCompleted: 1, blocksTotal: 3 }) as never }),
    );
    assert.equal(entry.blocksCompleted, 1);
    assert.equal(entry.blocksTotal, 3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal("completionPercentage" in (entry as any), false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal("progressPct" in (entry as any), false);
  });
});

describe("buildInteractiveShoulderOutcomeReportEntry — missing/legacy/malformed data", () => {
  it("null plan_session_id (historical, later-deleted session) does not crash and is preserved as null", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row({ plan_session_id: null }));
    assert.equal(entry.planSessionId, null);
  });

  it("prescribed_side null resolves to null, never a fabricated side", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row({ prescribed_side: null }));
    assert.equal(entry.prescribedSide, null);
  });

  it("an unexpected stored prescribed_side value resolves to null rather than a guess", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row({ prescribed_side: "bilateral" }));
    assert.equal(entry.prescribedSide, null);
  });

  it("an unrecognized future schemaVersion is flagged but does not crash — session-level facts still render", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({
        schema_version: "interactive-shoulder-movement-outcome/v99",
        outcome_payload: payload({ schemaVersion: "interactive-shoulder-movement-outcome/v99" }) as never,
      }),
    );
    assert.equal(entry.recognizedSchemaVersion, false);
    assert.equal(entry.totalElapsedSeconds, 95);
    assert.equal(entry.schemaVersion, "interactive-shoulder-movement-outcome/v99");
  });

  it("outcome_payload that is not an object (corrupt/empty) degrades to safe defaults, never throws", () => {
    assert.doesNotThrow(() => {
      const entry = buildInteractiveShoulderOutcomeReportEntry(row({ outcome_payload: null as never }));
      assert.equal(entry.totalElapsedSeconds, 0);
      assert.equal(entry.blocksCompleted, 0);
      assert.equal(entry.blocksTotal, 0);
      assert.deepEqual(entry.blocks, []);
    });
  });

  it("blockResults missing entirely from the payload -> empty blocks array, not a crash", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({ outcome_payload: { totalElapsedSeconds: 10, blocksCompleted: 0, blocksTotal: 1 } as never }),
    );
    assert.deepEqual(entry.blocks, []);
    assert.equal(entry.totalElapsedSeconds, 10);
  });

  it("blockResults present but not an array -> empty blocks array, not a crash", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({ outcome_payload: payload({ blockResults: "not-an-array" }) as never }),
    );
    assert.deepEqual(entry.blocks, []);
  });

  it("a single malformed block within an otherwise valid array is omitted, not fabricated — siblings still render", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({
        outcome_payload: payload({
          blockResults: [blockResult({ blockId: "block-a" }), { totally: "malformed" }, blockResult({ blockId: "block-b" })],
        }) as never,
      }),
    );
    assert.equal(entry.blocks.length, 2);
    assert.deepEqual(
      entry.blocks.map((b) => b.blockId),
      ["block-a", "block-b"],
    );
  });

  it("a block missing completedAtMs (still in progress at capture time) -> durationSeconds null, not fabricated", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({ outcome_payload: payload({ blockResults: [blockResult({ completedAtMs: null, completionReason: null })] }) as never }),
    );
    assert.equal(entry.blocks[0]?.durationSeconds, null);
    assert.equal(entry.blocks[0]?.completionReason, null);
  });

  it("totalElapsedSeconds/blocksCompleted/blocksTotal of the wrong type degrade to 0, never NaN or a thrown error", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(
      row({
        outcome_payload: {
          totalElapsedSeconds: "not-a-number",
          blocksCompleted: null,
          blocksTotal: undefined,
          blockResults: [],
        } as never,
      }),
    );
    assert.equal(entry.totalElapsedSeconds, 0);
    assert.equal(entry.blocksCompleted, 0);
    assert.equal(entry.blocksTotal, 0);
    assert.equal(Number.isNaN(entry.totalElapsedSeconds), false);
  });

  it("schema_version missing/non-string -> empty string, unrecognized, never crashes", () => {
    const entry = buildInteractiveShoulderOutcomeReportEntry(row({ schema_version: undefined as never }));
    assert.equal(entry.schemaVersion, "");
    assert.equal(entry.recognizedSchemaVersion, false);
  });
});

describe("buildInteractiveShoulderOutcomeReportEntries", () => {
  it("maps every row independently, preserving caller-provided order (the persistence layer owns sort order)", () => {
    const rowA = row({ id: "aaaaaaaa-1111-1111-1111-111111111111", created_at: "2026-08-27T09:00:00.000Z" });
    const rowB = row({ id: "bbbbbbbb-2222-2222-2222-222222222222", created_at: "2026-08-27T11:00:00.000Z" });
    const entries = buildInteractiveShoulderOutcomeReportEntries([rowB, rowA]);
    assert.deepEqual(entries.map((e) => e.id), [rowB.id, rowA.id]);
  });

  it("an empty row list -> empty entries, valid empty state", () => {
    assert.deepEqual(buildInteractiveShoulderOutcomeReportEntries([]), []);
  });
});
