/**
 * Run: npx tsx --test app/lib/rehab-programs/catalog-session-playback-bridge.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toProgramSession } from "./catalog-session-playback-bridge";
import { toSessionDefinition } from "./rehab-program-runtime-adapter";
import type {
  ProgramSessionBlocksRow,
  ProgramSessionsRow,
} from "@/app/lib/supabase/database.types";

// ── Fixtures — mirror the real seeded Stroke ULRF v1 Session 1 exactly ──

const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const PROGRAM_ID = "11111111-1111-1111-1111-111111111111";

const SESSION_ROW: ProgramSessionsRow = {
  id: SESSION_ID,
  treatment_program_id: PROGRAM_ID,
  session_key: "stroke-upper-limb-recovery-foundation-v1-session-1",
  session_number: 1,
  title: "Session 1 — Activation and Functional Reaching",
  goal: "Activation and Functional Reaching",
  estimated_duration_minutes_min: 10,
  estimated_duration_minutes_max: 15,
  requires_calibration: true,
  summary_mode: "standard",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const BLOCK_ROWS: ProgramSessionBlocksRow[] = [
  {
    id: "b1111111-0000-0000-0000-000000000001",
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-warm-up",
    block_order: 1,
    block_type: "instructional",
    title: "Warm-up",
    instructions: "Small, slow reaches to prepare the shoulder before active movement.",
    movement_id: null,
    feedback_profile: null,
    target_duration_seconds: 60,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "b1111111-0000-0000-0000-000000000002",
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-reach-the-light",
    block_order: 2,
    block_type: "movement-target",
    title: "Reach the Light",
    instructions:
      "Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.",
    movement_id: "shoulder-abduction-reach",
    feedback_profile: "shoulder-therapeutic-target",
    target_duration_seconds: 240,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "b1111111-0000-0000-0000-000000000003",
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-d1-diagonal-reach",
    block_order: 3,
    block_type: "movement-pattern",
    title: "D1-Inspired Diagonal Reach",
    instructions: "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
    movement_id: "shoulder-abduction-reach",
    feedback_profile: "d1-inspired-diagonal-reach",
    target_duration_seconds: 240,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "b1111111-0000-0000-0000-000000000004",
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-cool-down",
    block_order: 4,
    block_type: "instructional",
    title: "Cool-down",
    instructions: "Slow, reduced-range movement and breathing to finish the session.",
    movement_id: null,
    feedback_profile: null,
    target_duration_seconds: 90,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("toProgramSession", () => {
  it("1. maps every top-level ProgramSession field correctly", () => {
    const result = toProgramSession(SESSION_ROW, BLOCK_ROWS);
    assert.equal(result.id, SESSION_ID);
    assert.equal(result.programId, PROGRAM_ID);
    assert.equal(result.sessionNumber, 1);
    assert.equal(result.title, "Session 1 — Activation and Functional Reaching");
    assert.equal(result.goal, "Activation and Functional Reaching");
    assert.deepEqual(result.estimatedDurationMinutes, { min: 10, max: 15 });
    assert.deepEqual(result.lifecycle, { requiresCalibration: true, summaryMode: "standard" });
  });

  it("2. maps blockId from block_key, not the block's database id", () => {
    const result = toProgramSession(SESSION_ROW, BLOCK_ROWS);
    assert.deepEqual(
      result.blocks.map((b) => b.blockId),
      [
        "stroke-ulrf-v1-session-1-warm-up",
        "stroke-ulrf-v1-session-1-reach-the-light",
        "stroke-ulrf-v1-session-1-d1-diagonal-reach",
        "stroke-ulrf-v1-session-1-cool-down",
      ],
    );
    result.blocks.forEach((b) => {
      assert.ok(!Object.keys(b).includes("id"), "block must not carry a database id field");
    });
  });

  it("3. an instructional block's null movement_id/feedback_profile become undefined, not null (target_duration_seconds is legitimately non-null even for instructional blocks, and passes through)", () => {
    const result = toProgramSession(SESSION_ROW, [BLOCK_ROWS[0]]);
    const block = result.blocks[0];
    assert.equal(block.movementId, undefined);
    assert.equal(block.feedbackProfile, undefined);
    assert.equal(block.targetDurationSeconds, 60);
    assert.ok(!Object.prototype.hasOwnProperty.call(block, "movementId"), "movementId key must be entirely absent, not present-as-undefined");
    assert.ok(!Object.prototype.hasOwnProperty.call(block, "feedbackProfile"), "feedbackProfile key must be entirely absent, not present-as-undefined");
  });

  it("4. a movement block's non-null movement_id/feedback_profile/target_duration_seconds pass through", () => {
    const result = toProgramSession(SESSION_ROW, [BLOCK_ROWS[1]]);
    const block = result.blocks[0];
    assert.equal(block.movementId, "shoulder-abduction-reach");
    assert.equal(block.feedbackProfile, "shoulder-therapeutic-target");
    assert.equal(block.targetDurationSeconds, 240);
  });

  it("5. blockType is passed through verbatim for every recognized value", () => {
    const result = toProgramSession(SESSION_ROW, BLOCK_ROWS);
    assert.deepEqual(
      result.blocks.map((b) => b.blockType),
      ["instructional", "movement-target", "movement-pattern", "instructional"],
    );
  });

  it("6. trusts caller-provided block order verbatim -- does not re-sort", () => {
    const shuffled = [BLOCK_ROWS[2], BLOCK_ROWS[0], BLOCK_ROWS[3], BLOCK_ROWS[1]];
    const result = toProgramSession(SESSION_ROW, shuffled);
    assert.deepEqual(
      result.blocks.map((b) => b.blockId),
      [
        "stroke-ulrf-v1-session-1-d1-diagonal-reach",
        "stroke-ulrf-v1-session-1-warm-up",
        "stroke-ulrf-v1-session-1-cool-down",
        "stroke-ulrf-v1-session-1-reach-the-light",
      ],
    );
  });

  it("7. integration proof: bridge output is accepted by rehab-program-runtime-adapter.ts's toSessionDefinition without throwing", () => {
    const programSession = toProgramSession(SESSION_ROW, BLOCK_ROWS);
    const definition = toSessionDefinition(programSession);
    assert.equal(definition.sessionId, SESSION_ID);
    assert.equal(definition.blocks.length, 4);
    assert.deepEqual(
      definition.blocks.map((b) => b.blockId),
      [
        "stroke-ulrf-v1-session-1-warm-up",
        "stroke-ulrf-v1-session-1-reach-the-light",
        "stroke-ulrf-v1-session-1-d1-diagonal-reach",
        "stroke-ulrf-v1-session-1-cool-down",
      ],
    );
    assert.equal(definition.blocks[0].movementId, "instructional:stroke-ulrf-v1-session-1-warm-up");
    assert.equal(definition.blocks[1].movementId, "shoulder-abduction-reach");
    definition.blocks.forEach((b) => assert.equal(b.completionMode, "duration"));
  });
});
