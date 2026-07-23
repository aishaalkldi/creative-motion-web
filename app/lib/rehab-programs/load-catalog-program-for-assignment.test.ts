/**
 * Run: npx tsx --test app/lib/rehab-programs/load-catalog-program-for-assignment.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadCatalogProgramForAssignment,
  LoadCatalogProgramError,
} from "./load-catalog-program-for-assignment";

// ── Minimal mocked Supabase client ──────────────────────────────────────
//
// Implements the chain shapes this loader actually calls
// (.select().eq().maybeSingle(), .select().eq().order(),
// .select().in().order()), plus write methods that record whether they
// were ever invoked, for the "no write call occurs" assertion.
//
// .eq()/.in() genuinely filter the fixture rows (not a pass-through), and
// .order() genuinely re-sorts them — all three operate on a private,
// per-chain-instance copy of the fixture array, exactly the way a real
// PostgREST query builder narrows/orders a result set. This is what lets
// tests prove the loader requests the right column/value/direction by
// feeding fixtures that include deliberately non-matching or unsorted
// "decoy" rows and asserting the decoys never leak into the result,
// rather than trusting that whatever the fixture already contained comes
// straight through.

type TableName = "treatment_programs" | "program_sessions" | "program_session_blocks";

type MockTableResult = { data: unknown; error: { message: string } | null };

function createMockClient(responses: Partial<Record<TableName, MockTableResult>>) {
  const writeCalls: string[] = [];

  function chain(table: TableName) {
    const original = responses[table] ?? { data: [], error: null };
    // Own mutable copy per chain instance.
    let rows = Array.isArray(original.data) ? [...(original.data as Record<string, unknown>[])] : [];
    const error = original.error;

    const builder = {
      select() {
        return builder;
      },
      eq(column: string, value: unknown) {
        rows = rows.filter((row) => row[column] === value);
        return builder;
      },
      in(column: string, values: readonly unknown[]) {
        const allowed = new Set(values);
        rows = rows.filter((row) => allowed.has(row[column] as never));
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        const dir = opts?.ascending === false ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const av = a[column] as string | number;
          const bv = b[column] as string | number;
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
        return builder;
      },
      async maybeSingle() {
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
      // Chain itself resolves like a real PostgREST builder when awaited
      // directly (no .maybeSingle()).
      then(
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve({ data: error ? null : rows, error }).then(onFulfilled, onRejected);
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
      return chain("treatment_programs");
    },
    writeCalls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return client;
}

// ── Fixtures ─────────────────────────────────────────────────────────

const PROGRAM_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROGRAM_ID = "99999999-9999-9999-9999-999999999999";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_SESSION_ID = "88888888-8888-8888-8888-888888888888";

const PUBLISHED_PROGRAM = {
  id: PROGRAM_ID,
  slug: "stroke-upper-limb-recovery-foundation-v1",
  name: "Upper Limb Recovery Foundation",
  version: 1,
  status: "published",
};

// A second, unrelated published program. Used only to prove the loader's
// .eq("id", ...) / .eq("treatment_program_id", ...) calls genuinely
// filter to the requested program rather than returning whatever row(s)
// a fixture happens to contain.
const OTHER_PROGRAM = {
  id: OTHER_PROGRAM_ID,
  slug: "other-unrelated-program-v1",
  name: "Other Unrelated Program",
  version: 1,
  status: "published",
};

const DRAFT_PROGRAM = { ...PUBLISHED_PROGRAM, status: "draft" };
const ARCHIVED_PROGRAM = { ...PUBLISHED_PROGRAM, status: "archived" };

// treatment_program_id is not part of the loader's own select list for
// program_sessions, but the mock's .eq("treatment_program_id", ...) call
// filters on it exactly as a real Postgres WHERE clause would filter on
// an unselected column -- so fixtures still need it present.
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

// Belongs to OTHER_PROGRAM_ID, not PROGRAM_ID. Used only to prove
// program_sessions filtering excludes another program's sessions.
const OTHER_PROGRAM_SESSION_ROW = {
  id: OTHER_SESSION_ID,
  treatment_program_id: OTHER_PROGRAM_ID,
  session_key: "other-program-session-1",
  session_number: 1,
  title: "Other Program — Session 1",
  goal: "Unrelated",
  estimated_duration_minutes_min: 5,
  estimated_duration_minutes_max: 10,
  requires_calibration: false,
  summary_mode: "none",
};

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
    instructions:
      "Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.",
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
    instructions: "Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.",
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

// Belongs to OTHER_SESSION_ID, which is never part of the requested
// program's sessionIds. Used only to prove program_session_blocks
// filtering (.in("program_session_id", sessionIds)) excludes blocks
// belonging to a session outside the loaded program.
const OTHER_SESSION_BLOCK_ROW = {
  program_session_id: OTHER_SESSION_ID,
  block_key: "other-program-session-1-only-block",
  block_order: 1,
  block_type: "instructional",
  title: "Other program's block",
  instructions: "Must never appear in a load of PROGRAM_ID.",
  movement_id: null,
  feedback_profile: null,
  target_duration_seconds: 30,
};

function publishedClient() {
  return createMockClient({
    treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
    program_sessions: { data: [SESSION_ROW], error: null },
    program_session_blocks: { data: BLOCK_ROWS, error: null },
  });
}

describe("loadCatalogProgramForAssignment", () => {
  it("1. published program loads successfully", async () => {
    const client = publishedClient();
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.equal(result.sourceTreatmentProgramId, PROGRAM_ID);
    assert.equal(result.slug, "stroke-upper-limb-recovery-foundation-v1");
    assert.equal(result.name, "Upper Limb Recovery Foundation");
    assert.equal(result.version, 1);
    assert.equal(result.sessions.length, 1);
  });

  it("2. sessions are ordered by session_number", async () => {
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: {
        data: [
          { ...SESSION_ROW, id: "s2", session_key: "session-2", session_number: 2 },
          { ...SESSION_ROW, id: "s1", session_key: "session-1", session_number: 1 },
        ],
        error: null,
      },
      program_session_blocks: {
        data: [
          { ...BLOCK_ROWS[0], program_session_id: "s1" },
          { ...BLOCK_ROWS[0], program_session_id: "s2", block_key: "s2-block" },
        ],
        error: null,
      },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    // Fixture is deliberately inserted out of order (session_number 2
    // before 1). The mock's .order() genuinely re-sorts by whichever
    // column/direction the loader requests — so the result coming back
    // ascending (1, then 2) proves the loader actually calls
    // .order("session_number", { ascending: true }), not merely that it
    // passes through whatever order the fixture happened to use.
    assert.deepEqual(
      result.sessions.map((s) => s.sessionNumber),
      [1, 2],
    );
  });

  it("3. blocks are ordered by block_order", async () => {
    // Deliberately shuffled input — same reasoning as test 2: if the
    // loader didn't call .order("block_order", { ascending: true }),
    // this would come back in the shuffled order instead.
    const shuffledBlocks = [BLOCK_ROWS[2], BLOCK_ROWS[0], BLOCK_ROWS[3], BLOCK_ROWS[1]];
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [SESSION_ROW], error: null },
      program_session_blocks: { data: shuffledBlocks, error: null },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.deepEqual(
      result.sessions[0].blocks.map((b) => b.blockOrder),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      result.sessions[0].blocks.map((b) => b.blockKey),
      [
        "stroke-ulrf-v1-session-1-warm-up",
        "stroke-ulrf-v1-session-1-reach-the-light",
        "stroke-ulrf-v1-session-1-d1-diagonal-reach",
        "stroke-ulrf-v1-session-1-cool-down",
      ],
    );
  });

  it("4. database UUIDs and business identifiers remain distinct", async () => {
    const client = publishedClient();
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.equal(result.sourceTreatmentProgramId, PROGRAM_ID);
    assert.notEqual(result.sourceTreatmentProgramId, result.slug);
    assert.equal(result.sessions[0].sourceProgramSessionId, SESSION_ID);
    assert.notEqual(result.sessions[0].sourceProgramSessionId, result.sessions[0].sessionKey);
    // Blocks carry only the business identifier (blockKey), per the
    // approved return contract — no database id field is exposed for
    // blocks at all.
    assert.deepEqual(Object.keys(result.sessions[0].blocks[0]).includes("id"), false);
  });

  it("5. draft program is rejected", async () => {
    const client = createMockClient({
      treatment_programs: { data: [DRAFT_PROGRAM], error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "not_published");
        return true;
      },
    );
  });

  it("6. archived program is rejected for new assignment", async () => {
    const client = createMockClient({
      treatment_programs: { data: [ARCHIVED_PROGRAM], error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "not_published");
        return true;
      },
    );
  });

  it("7. missing program is rejected", async () => {
    const client = createMockClient({
      treatment_programs: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "not_found");
        return true;
      },
    );
  });

  it("8a. a published program with no sessions is rejected as invalid data", async () => {
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("8b. a session with no blocks is rejected as invalid data", async () => {
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [SESSION_ROW], error: null },
      program_session_blocks: { data: [], error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("8c. an unrecognized block_type is rejected as invalid data", async () => {
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [SESSION_ROW], error: null },
      program_session_blocks: {
        data: [{ ...BLOCK_ROWS[0], block_type: "some-future-type" }],
        error: null,
      },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("8d. an unrecognized summary_mode is rejected as invalid data", async () => {
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [{ ...SESSION_ROW, summary_mode: "bogus" }], error: null },
      program_session_blocks: { data: BLOCK_ROWS, error: null },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "invalid_data");
        return true;
      },
    );
  });

  it("9. no insert/update/delete/upsert/rpc write call occurs", async () => {
    const client = publishedClient();
    await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.deepEqual(client.writeCalls, []);
  });

  it("9b. no write call occurs even on a rejection path", async () => {
    const client = createMockClient({
      treatment_programs: { data: [DRAFT_PROGRAM], error: null },
    });
    await assert.rejects(() => loadCatalogProgramForAssignment(client, PROGRAM_ID));
    assert.deepEqual(client.writeCalls, []);
  });

  it("10. a raw database error is mapped to a controlled loader error, not leaked", async () => {
    const client = createMockClient({
      treatment_programs: {
        data: null,
        error: { message: "relation \"public.treatment_programs\" permission denied for role internal_detail" },
      },
    });
    await assert.rejects(
      () => loadCatalogProgramForAssignment(client, PROGRAM_ID),
      (err: unknown) => {
        assert.ok(err instanceof LoadCatalogProgramError);
        assert.equal(err.reason, "load_failed");
        assert.ok(
          !err.message.includes("internal_detail"),
          "raw database error text must not leak into the thrown error message",
        );
        return true;
      },
    );
  });

  it("11. the program query filters by the exact requested database UUID (a hardcoded/wrong id would fail this test)", async () => {
    // OTHER_PROGRAM is listed FIRST. If the loader's .eq("id", ...) call
    // were a no-op, or used the wrong column, or used a hardcoded value,
    // .maybeSingle() would return whichever row comes first in the
    // (unfiltered) fixture array — OTHER_PROGRAM, not PUBLISHED_PROGRAM
    // — and every assertion below would fail. Only a genuine
    // .eq("id", PROGRAM_ID) filter narrows this down to the single
    // matching row before .maybeSingle() ever runs.
    const client = createMockClient({
      treatment_programs: { data: [OTHER_PROGRAM, PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [SESSION_ROW], error: null },
      program_session_blocks: { data: BLOCK_ROWS, error: null },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.equal(result.sourceTreatmentProgramId, PROGRAM_ID);
    assert.equal(result.slug, PUBLISHED_PROGRAM.slug);
    assert.notEqual(result.slug, OTHER_PROGRAM.slug);
  });

  it("12. session loading filters by the selected treatment-program UUID", async () => {
    // OTHER_PROGRAM_SESSION_ROW belongs to OTHER_PROGRAM_ID. If the
    // loader's .eq("treatment_program_id", ...) call were a no-op, this
    // decoy session would leak into the result (as a second session, or
    // by causing an unrelated invalid_data failure) even though it does
    // not belong to the requested program.
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [OTHER_PROGRAM_SESSION_ROW, SESSION_ROW], error: null },
      program_session_blocks: { data: BLOCK_ROWS, error: null },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0].sourceProgramSessionId, SESSION_ID);
    assert.ok(
      result.sessions.every((s) => s.sourceProgramSessionId !== OTHER_SESSION_ID),
      "a session belonging to a different treatment program must never appear",
    );
  });

  it("13. block loading filters only sessions belonging to the loaded program", async () => {
    // OTHER_SESSION_BLOCK_ROW belongs to OTHER_SESSION_ID, which is not
    // among this program's sessionIds. If the loader's
    // .in("program_session_id", sessionIds) call were a no-op, this
    // decoy block would leak into session 1's block list.
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [SESSION_ROW], error: null },
      program_session_blocks: { data: [...BLOCK_ROWS, OTHER_SESSION_BLOCK_ROW], error: null },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);
    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0].blocks.length, BLOCK_ROWS.length);
    assert.ok(
      result.sessions[0].blocks.every((b) => b.blockKey !== OTHER_SESSION_BLOCK_ROW.block_key),
      "a block belonging to a session outside the loaded program must never appear",
    );
  });

  it("14. multiple sessions and multiple shuffled blocks are ordered correctly together", async () => {
    const sessionTwo = {
      ...SESSION_ROW,
      id: "s2",
      session_key: "session-2",
      session_number: 2,
    };
    const sessionOne = {
      ...SESSION_ROW,
      id: "s1",
      session_key: "session-1",
      session_number: 1,
    };
    const blocksForSessionOne = [
      { ...BLOCK_ROWS[1], program_session_id: "s1" }, // block_order 2
      { ...BLOCK_ROWS[0], program_session_id: "s1" }, // block_order 1
    ];
    const blocksForSessionTwo = [
      { ...BLOCK_ROWS[3], program_session_id: "s2" }, // block_order 4
      { ...BLOCK_ROWS[1], program_session_id: "s2" }, // block_order 2
      { ...BLOCK_ROWS[0], program_session_id: "s2" }, // block_order 1
    ];
    // Deliberately interleaved and reversed across both dimensions:
    // sessions inserted 2-before-1, and each session's own blocks
    // shuffled. Also includes OTHER_SESSION_BLOCK_ROW as a decoy to
    // simultaneously prove .in() filtering still holds when combined
    // with ordering.
    const client = createMockClient({
      treatment_programs: { data: [PUBLISHED_PROGRAM], error: null },
      program_sessions: { data: [sessionTwo, sessionOne], error: null },
      program_session_blocks: {
        data: [...blocksForSessionTwo, OTHER_SESSION_BLOCK_ROW, ...blocksForSessionOne],
        error: null,
      },
    });
    const result = await loadCatalogProgramForAssignment(client, PROGRAM_ID);

    assert.deepEqual(
      result.sessions.map((s) => s.sessionNumber),
      [1, 2],
    );
    assert.deepEqual(
      result.sessions[0].blocks.map((b) => b.blockOrder),
      [1, 2],
    );
    assert.deepEqual(
      result.sessions[1].blocks.map((b) => b.blockOrder),
      [1, 2, 4],
    );
    assert.ok(
      result.sessions.flatMap((s) => s.blocks).every((b) => b.blockKey !== OTHER_SESSION_BLOCK_ROW.block_key),
    );
  });
});
