-- ============================================================
-- Migration 016 — seed: Stroke -> Upper Limb Recovery Foundation v1
--
-- Mirrors, field-for-field, the TypeScript catalog already shipped in
-- app/lib/rehab-programs/stroke-upper-limb-recovery-foundation.ts
-- (NEURO_STROKE_CONDITION, STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PATHWAY,
-- STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_PROGRAM_V1,
-- STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1, and its four block
-- constants). The two feedback-profile string values are copied from
-- app/lib/interactive-shoulder/motion-patterns/motion-pattern-registry.ts
-- (REACH_THE_LIGHT_TARGET_FEEDBACK_PROFILE = "shoulder-therapeutic-target")
-- and d1-inspired-diagonal-reach-pattern.ts
-- (feedbackProfileKey = "d1-inspired-diagonal-reach"). No value below is
-- invented — every string is a direct transcription from one of those
-- TypeScript source files. block_order is the one field with no direct
-- TypeScript counterpart: the TS catalog encodes block order implicitly
-- via array position in STROKE_UPPER_LIMB_RECOVERY_FOUNDATION_SESSION_1
-- .blocks; this migration makes that ordering explicit.
--
-- Exactly 8 rows are inserted, once: 1 rehabilitation_conditions,
-- 1 rehabilitation_pathways, 1 treatment_programs, 1 program_sessions,
-- 4 program_session_blocks. No other table is touched. No schema,
-- policy, trigger, grant, or application code changes — this migration
-- is data only, and does not modify 014 or 015 in any way.
--
-- Publication sequence: the program is inserted as 'draft', its session
-- and all four blocks are inserted while it is still draft (required —
-- 014's ownership triggers reject inserting a session/block under a
-- non-draft program), and only then is it updated to 'published'. That
-- UPDATE is the one point 014's enforce_treatment_program_lifecycle()
-- trigger's publish-time completeness check actually runs, validating —
-- using the rows this same migration just inserted — that the program
-- has at least one session and every session has at least one block.
-- No trigger is disabled, weakened, or bypassed anywhere in this file.
--
-- Calibration and Session Summary are session-level lifecycle metadata
-- (program_sessions.requires_calibration / summary_mode below) — they
-- are never inserted as program_session_blocks rows, and no
-- "calibration"/"summary" block_type exists to insert one as.
--
-- No treatment_plans/plan_sessions bridge, no clinician assignment UI,
-- no patient-facing route or API is introduced by this migration.
--
-- Immutability, unchanged from 014/015: once this UPDATE lands and the
-- program is 'published', 014's lifecycle trigger makes it and its
-- session/blocks permanently unmodifiable and undeletable (published
-- -> archived is the only further legal transition; there is no legal
-- path back to draft or to deletion). If this v1 content is ever found
-- to need a correction, the fix is a new treatment_programs row with
-- version = 2 under the same pathway, archiving v1 — never editing or
-- deleting this migration's rows in place.
--
-- Conflict strategy: plain INSERTs only, no ON CONFLICT clause of any
-- kind. rehabilitation_conditions.slug is globally unique and is
-- inserted first, so if this migration is ever re-run against a
-- database where the seed already exists, it fails loudly at the very
-- first statement with a specific unique_violation — never a silent
-- no-op, never a silent overwrite of already-published content.
--
-- UUIDs are never hardcoded: every table's uuid primary key uses its
-- existing `default gen_random_uuid()`, and every foreign key below is
-- resolved by a subquery against a stable text business identifier
-- (slug / session_key) rather than a literal id.
--
-- Atomicity: every insert, the publication update, and the row-count
-- assertion below are contained in exactly one PL/pgSQL DO statement.
-- A DO block executes as a single top-level statement, so PostgreSQL
-- guarantees all-or-nothing execution of everything inside it on its
-- own — independent of whether the migration runner additionally wraps
-- the whole file in a transaction. If any insert, FK resolution,
-- trigger, constraint, or the final row-count assertion fails, nothing
-- this DO block did survives.
--
-- Row-count enforcement: PostgreSQL's UPDATE succeeds silently even
-- when it affects zero rows. Relying on the final SELECTed status alone
-- cannot distinguish "this statement published it" from "it was
-- already published by something else and this statement matched
-- nothing." GET DIAGNOSTICS immediately after the publish UPDATE reads
-- its actual affected-row count, and the block raises explicitly unless
-- that count is exactly 1 — turning an otherwise-silent no-op into a
-- loud, specific failure.
--
-- Prerequisites: 014_rehabilitation_program_catalog.sql,
-- 015_rehabilitation_catalog_security_hardening.sql.
-- Apply on Staging first; do not apply to Production until explicitly
-- approved (same convention as every migration in this chain).
-- ============================================================

do $seed$
declare
  published_row_count bigint;
begin

  -- 1. rehabilitation_conditions — Stroke
  insert into public.rehabilitation_conditions (slug, name)
  values ('neuro-stroke', 'Stroke');

  -- 2. rehabilitation_pathways — Upper Limb Recovery Foundation
  --    (resolved by the condition's slug, not a literal id)
  insert into public.rehabilitation_pathways (condition_id, slug, name)
  values (
    (select id from public.rehabilitation_conditions where slug = 'neuro-stroke'),
    'stroke-upper-limb-recovery-foundation',
    'Upper Limb Recovery Foundation'
  );

  -- 3. treatment_programs — Upper Limb Recovery Foundation v1.
  --    Inserted as draft (status column omitted -> its 'draft' default
  --    applies). Published only at the end, after its session and all
  --    four blocks exist.
  insert into public.treatment_programs (pathway_id, slug, name, version)
  values (
    (
      select id from public.rehabilitation_pathways
      where slug = 'stroke-upper-limb-recovery-foundation'
        and condition_id = (select id from public.rehabilitation_conditions where slug = 'neuro-stroke')
    ),
    'stroke-upper-limb-recovery-foundation-v1',
    'Upper Limb Recovery Foundation',
    1
  );

  -- 4. program_sessions — Session 1 (resolved by the program's slug,
  --    not a literal id)
  insert into public.program_sessions (
    treatment_program_id,
    session_key,
    session_number,
    title,
    goal,
    estimated_duration_minutes_min,
    estimated_duration_minutes_max,
    requires_calibration,
    summary_mode
  )
  values (
    (select id from public.treatment_programs where slug = 'stroke-upper-limb-recovery-foundation-v1'),
    'stroke-upper-limb-recovery-foundation-v1-session-1',
    1,
    'Session 1 — Activation and Functional Reaching',
    'Activation and Functional Reaching',
    10,
    15,
    true,
    'standard'
  );

  -- 5. program_session_blocks — the four executable blocks, in order.
  --    Each resolved by the session's session_key, not a literal id.
  --    Warm-up and Cool-down are instructional: movement_id and
  --    feedback_profile are both null, matching the bidirectional
  --    check constraint and the TypeScript catalog exactly (neither
  --    block sets those fields there either).
  insert into public.program_session_blocks (
    program_session_id, block_key, block_order, block_type, title, instructions,
    movement_id, feedback_profile, target_duration_seconds
  )
  values (
    (select id from public.program_sessions where session_key = 'stroke-upper-limb-recovery-foundation-v1-session-1'),
    'stroke-ulrf-v1-session-1-warm-up',
    1,
    'instructional',
    'Warm-up',
    'Small, slow reaches to prepare the shoulder before active movement.',
    null,
    null,
    60
  );

  insert into public.program_session_blocks (
    program_session_id, block_key, block_order, block_type, title, instructions,
    movement_id, feedback_profile, target_duration_seconds
  )
  values (
    (select id from public.program_sessions where session_key = 'stroke-upper-limb-recovery-foundation-v1-session-1'),
    'stroke-ulrf-v1-session-1-reach-the-light',
    2,
    'movement-target',
    'Reach the Light',
    'Lift your arm out to the side and reach toward each therapeutic light. Move at a comfortable pace.',
    'shoulder-abduction-reach',
    'shoulder-therapeutic-target',
    240
  );

  insert into public.program_session_blocks (
    program_session_id, block_key, block_order, block_type, title, instructions,
    movement_id, feedback_profile, target_duration_seconds
  )
  values (
    (select id from public.program_sessions where session_key = 'stroke-upper-limb-recovery-foundation-v1-session-1'),
    'stroke-ulrf-v1-session-1-d1-diagonal-reach',
    3,
    'movement-pattern',
    'D1-Inspired Diagonal Reach',
    'Follow the therapeutic light along the diagonal path. Move smoothly at a comfortable pace.',
    'shoulder-abduction-reach',
    'd1-inspired-diagonal-reach',
    240
  );

  insert into public.program_session_blocks (
    program_session_id, block_key, block_order, block_type, title, instructions,
    movement_id, feedback_profile, target_duration_seconds
  )
  values (
    (select id from public.program_sessions where session_key = 'stroke-upper-limb-recovery-foundation-v1-session-1'),
    'stroke-ulrf-v1-session-1-cool-down',
    4,
    'instructional',
    'Cool-down',
    'Slow, reduced-range movement and breathing to finish the session.',
    null,
    null,
    90
  );

  -- 6. Publish — the program's session and all four blocks now exist,
  --    so 014's completeness check inside enforce_treatment_program_
  --    lifecycle() can succeed. Targets exactly the one draft program
  --    this block just created, by its own slug — not a broader
  --    predicate that could ever match another row.
  update public.treatment_programs
  set status = 'published'
  where slug = 'stroke-upper-limb-recovery-foundation-v1'
    and status = 'draft';

  get diagnostics published_row_count = row_count;

  if published_row_count <> 1 then
    raise exception
      'Expected to publish exactly one treatment program %, but updated % rows',
      'stroke-upper-limb-recovery-foundation-v1',
      published_row_count;
  end if;

end;
$seed$;
