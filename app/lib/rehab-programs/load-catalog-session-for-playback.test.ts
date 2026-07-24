/**
 * Run: npx tsx --test app/lib/rehab-programs/load-catalog-session-for-playback.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadCatalogSessionForPlayback,
  LoadCatalogSessionForPlaybackError,
} from "./load-catalog-session-for-playback";

// ── Minimal mocked Supabase client — same style as PR 6's
// load-catalog-program-for-assignment.test.ts: .order() genuinely
// re-sorts, so tests can prove the loader requests the right
// column/direction rather than trusting fixture order.

type TableName = "program_sessions" | "treatment_programs" | "program_session_blocks";

type MockTableResult = { data: unknown; error: { message: string } | null };

function createMockClient(responses: Partial<Record<TableName, MockTableResult>>) {
  const writeCalls: string[] = [];

  function chain(table: TableName) {
    const original = responses[table] ?? { data: null, error: null };
    let data = Array.isArray(original.data) ? [...(original.data as Record<string, unknown>[])] : original.data;
    const error = original.error;

    const builder = {
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        if (Array.isArray(data)) {
          const dir = opts?.ascending === false ? -1 : 1;
          const rows = data as Record<string, unknown>[];
          data = [...rows].sort((a, b) => {
            const av = a[column] as string | number;
            const bv = b[column] as string | number;
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
          });
        }
        return builder;
      },
      async maybeSingle() {
        const rows = (data as unknown[] | null) ?? [];
        if (error) return { data: null, error };
        return { data: rows[0] ?? null, error: null };
      },
      insert(...args: unknown[]) {
        writeCalls.push(`insert:${table}`);
        return builder;
      },
      update(...args: unknown[]) {
        writeCalls.push(`update:${table}`);
        return builder;
      },
      delete(...args: unknown[]) {
        writeCalls.push(`delete:${table}`);
        return builder;
      },
      upsert(...args: unknown[]) {
        writeCalls.push(`upsert:${table}`);
        return builder;
      },
      then(
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve({ data, error }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const client = {
    from(table: TableName) {
      return chain(table);
    },
    rpc(...args: unknown[]) {
      writeCalls.push(`rpc:${String(args[0])}`);
      return chain("program_sessions");
    },
    writeCalls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return client;
}

// ── Fixtures — mirror the real seeded Stroke ULRF v1 Session 1 ─────────

const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const PROGRAM_ID = "11111111-1111-1111-1111-111111111111";

const SESSION_ROW = {
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
};

const PUBLISHED_PROGRAM = { status: "published" };
const ARCHIVED_PROGRAM = { status: "archived" };
const DRAFT_PROGRAM = { status: "draft" };

const BLOCK_ROWS = [
  {
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-warm-up",
    block_order: 1,
    block_type: "instructional",
    title: "Warm-up",
    instructions: "Small, slow reaches to prepare the shoulder before active movement.",
    movement_id: null,
    feedback_profile: null,
    target_duration_seconds: 60,
  },
  {
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-reach-the-light",
    block_order: 2,
    block_type: "movement-target",
    title: "Reach the Light",
    instructions: "Lift your arm out to the side and reach toward each therapeutic light.",
    movement_id: "shoulder-abduction-reach",
    feedback_profile: "shoulder-therapeutic-target",
    target_duration_seconds: 240,
  },
  {
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-d1-diagonal-reach",
    block_order: 3,
    block_type: "movement-pattern",
    title: "D1-Inspired Diagonal Reach",
    instructions: "Follow the therapeutic light along the diagonal path.",
    movement_id: "shoulder-abduction-reach",
    feedback_profile: "d1-inspired-diagonal-reach",
    target_duration_seconds: 240,
  },
  {
    program_session_id: SESSION_ID,
    block_key: "stroke-ulrf-v1-session-1-cool-down",
    block_order: 4,
    block_type: "instructional",
    title: "Cool-down",
    instructions: "Slow, reduced-range movement and breathing to finish the session.",
    movement_id: null,
    feedback_profile: null,
    target_duration_seconds: 90,
  },
];

function fullClient(programStatus: { status: string }) {
  return createMockClient({
    program_sessions: { data: [SESSION_ROW], error: null },
    treatment_programs: { data: [programStatus], error: null },
    program_session_blocks: { data: BLOCK_ROWS, error: null },
  });
}

describe("loadCatalogSessionForPlayback", () => {
  it("1. published owning program loads successfully", async () => {
    const client = fullClient(PUBLISHED_PROGRAM);
    const result = await loadCatalogSessionForPlayback(client, SESSION_ID);
    assert.equal(result.id, SESSION_ID);
    assert.equal(result.programId, PROGRAM_ID);
    assert.equal(result.blocks.length, 4);
  });

  it("2. archived owning program loads successfully (archival must not break playback)", async () => {
    const client = fullClient(ARCHIVED_PROGRAM);
    const result = await loadCatalogSessionForPlayback(client, SESSION_ID);
    assert.equal(result.id, SESSION_ID);
    assert.equal(result.blocks.length, 4);
  });

  it("3. draft owning program is rejected", async () => {
    const client = fullClient(DRAFT_PROGRAM);
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "not_eligible");
        return true;
      },
    );
  });

  it("4. missing session is rejected", async () => {
    const client = createMockClient({
      program_sessions: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "not_found");
        return true;
      },
    );
  });

  it("5. missing owning program is rejected as not_eligible (not a separate reason)", async () => {
    const client = createMockClient({
      program_sessions: { data: [SESSION_ROW], error: null },
      treatment_programs: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "not_eligible");
        return true;
      },
    );
  });

  it("6. zero blocks is rejected as invalid_data", async () => {
    const client = createMockClient({
      program_sessions: { data: [SESSION_ROW], error: null },
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_session_blocks: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("7. an unrecognized block_type is rejected as invalid_data", async () => {
    const client = createMockClient({
      program_sessions: { data: [SESSION_ROW], error: null },
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_session_blocks: { data: [{ ...BLOCK_ROWS[0], block_type: "some-future-type" }], error: null },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("8. an unrecognized summary_mode is rejected as invalid_data", async () => {
    const client = createMockClient({
      program_sessions: { data: [{ ...SESSION_ROW, summary_mode: "bogus" }], error: null },
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_session_blocks: { data: BLOCK_ROWS, error: null },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("9. blocks are genuinely ordered by block_order (shuffled fixture proof)", async () => {
    const shuffled = [BLOCK_ROWS[2], BLOCK_ROWS[0], BLOCK_ROWS[3], BLOCK_ROWS[1]];
    const client = createMockClient({
      program_sessions: { data: [SESSION_ROW], error: null },
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_session_blocks: { data: shuffled, error: null },
    });
    const result = await loadCatalogSessionForPlayback(client, SESSION_ID);
    assert.deepEqual(
      result.blocks.map((b) => b.blockId),
      [
        "stroke-ulrf-v1-session-1-warm-up",
        "stroke-ulrf-v1-session-1-reach-the-light",
        "stroke-ulrf-v1-session-1-d1-diagonal-reach",
        "stroke-ulrf-v1-session-1-cool-down",
      ],
    );
  });

  it("10. no write/rpc call ever occurs", async () => {
    const client = fullClient(PUBLISHED_PROGRAM);
    await loadCatalogSessionForPlayback(client, SESSION_ID);
    assert.deepEqual(client.writeCalls, []);
  });

  it("10b. no write/rpc call occurs even on a rejection path", async () => {
    const client = fullClient(DRAFT_PROGRAM);
    await assert.rejects(() => loadCatalogSessionForPlayback(client, SESSION_ID));
    assert.deepEqual(client.writeCalls, []);
  });

  it("11. a raw database error is mapped to a controlled loader error, not leaked", async () => {
    const client = createMockClient({
      program_sessions: {
        data: null,
        error: { message: 'relation "public.program_sessions" permission denied for role internal_detail' },
      },
    });
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, SESSION_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "load_failed");
        assert.ok(
          !err.message.includes("internal_detail"),
          "raw database error text must not leak into the thrown error message",
        );
        return true;
      },
    );
  });

  it("12. missing/blank sourceProgramSessionId is rejected before any query", async () => {
    const client = fullClient(PUBLISHED_PROGRAM);
    await assert.rejects(
      () => loadCatalogSessionForPlayback(client, ""),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogSessionForPlaybackError);
        assert.equal(err.reason, "not_found");
        return true;
      },
    );
    assert.deepEqual(client.writeCalls, []);
  });
});
