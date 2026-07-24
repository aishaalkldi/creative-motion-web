-- ============================================================
-- Migration 018 — atomic catalog-to-plan assignment
--
-- Adds one RPC, create_plan_from_catalog_program(), that atomically
-- creates a treatment_plans row, its plan_sessions rows, and its
-- patient_access_tokens row in a single database transaction, sourced
-- from a published rehabilitation catalog program
-- (014_rehabilitation_program_catalog.sql /
-- 015_rehabilitation_catalog_security_hardening.sql /
-- 016_seed_stroke_upper_limb_recovery_foundation.sql), using the
-- provenance columns and triggers added in
-- 017_treatment_plan_catalog_provenance.sql.
--
-- This directly replaces the non-transactional, compensating-cleanup
-- pattern in the existing POST /api/plans route
-- (app/api/plans/route.ts's rollbackPlanCreation()) for this one new
-- catalog-sourced path only. The existing route and its behavior for
-- non-catalog plans are completely untouched by this migration.
--
-- Scope, deliberately narrow:
--   - No catalog block is read, copied, or materialized into
--     plan_sessions.exercises here. Every created session gets
--     exercises = '[]'::jsonb — the column's own NOT NULL DEFAULT,
--     already a safe, already-supported state in the patient runtime
--     (the session player shows an explicit "No exercises in this
--     session yet" screen for total === 0, rather than crashing or
--     auto-completing).
--   - total_weeks is fixed at 1: a session count is not a week count,
--     and program_sessions carries no week/schedule field to derive
--     one from. The created plan is an unscheduled catalog-assignment
--     shell; real scheduling is a later, separate contract.
--   - structured_data is NULL: source_treatment_program_id is already
--     the authoritative provenance pointer; a partial
--     PlanStructuredData-shaped object here would just be a second,
--     driftable source of the same fact. Existing readers
--     (extractPlanProgramMetadata / resolvePatientRehabFocus) are
--     already null-safe and fall back to generic copy.
--   - No patient portal token is generated inside SQL. Token entropy
--     stays in Node (generateSecurePatientToken(), crypto.randomBytes)
--     — this migration adds no pgcrypto dependency and no SQL-side
--     token convention. The RPC only accepts an already-generated
--     token string from its (service-role-only) caller and inserts it
--     inside the same transaction as the plan/sessions, which is what
--     makes the whole assignment atomic without needing SQL-side
--     token generation.
--
-- Revision note (pre-Staging correction, still unapplied everywhere):
-- a strict read-only review of the original version of this migration
-- found the fresh treatment_plans INSERT had no race-safe conflict
-- target — two genuinely concurrent calls with the same
-- catalog_assignment_request_id could both pass the initial replay
-- SELECT (neither had committed yet), and the loser's plain INSERT
-- would then raise an unhandled unique_violation instead of gracefully
-- returning the winner's result. Corrected below: the fresh INSERT now
-- uses `ON CONFLICT (catalog_assignment_request_id) DO NOTHING
-- RETURNING id`, scoped to exactly that one constraint (not a broad
-- `EXCEPTION WHEN unique_violation` handler, which would risk
-- swallowing an unrelated failure — a duplicate patient_access_tokens
-- .token, or a duplicate plan_sessions(plan_id, session_number) — as a
-- false idempotency replay). A NULL result from that INSERT re-selects
-- the now-committed row and treats the call as a replay. This also
-- adds explicit session-count integrity checks (both on the fresh
-- INSERT, via GET DIAGNOSTICS, and again in the shared result-
-- gathering tail that runs for every path) rather than relying solely
-- on migration 014's upstream publish-time completeness guarantee.
--
-- ============================================================
-- Idempotency column
-- ============================================================
--
-- catalog_assignment_request_id is supplied by the calling clinician
-- UI (one value per "assign this program" action) so a network retry
-- or double-click replays the same result instead of creating a
-- second plan/session/token set. Plain UNIQUE, not a partial index:
-- PostgreSQL's own UNIQUE semantics already treat every NULL as
-- distinct from every other NULL, so legacy/non-catalog treatment_plans
-- rows (which never set this column) never conflict with each other —
-- no WHERE ... IS NOT NULL filter is needed for that, unlike the plain
-- (non-unique) indexes 017 added on its own provenance columns for
-- query-performance reasons.
--
-- INSERT-only, not "set once then editable": once any row exists with
-- a given catalog_assignment_request_id, that value can never be
-- changed by an UPDATE on that row — not to a different id, and not
-- back to NULL. This is stricter than 017's own null -> populated-once
-- pattern (see 017's source_treatment_program_id) deliberately: a
-- request id is an idempotency key tied to one specific historical
-- creation attempt, not a piece of plan content that could ever
-- legitimately need to transition from unset. Enforced below by
-- rejecting every UPDATE that changes the value, full stop.
-- ============================================================

alter table public.treatment_plans
  add column if not exists catalog_assignment_request_id uuid;

comment on column public.treatment_plans.catalog_assignment_request_id is
  'Client-supplied idempotency key for one create_plan_from_catalog_program() '
  'call. NULL for every legacy/non-catalog plan and for any plan created '
  'without an idempotency key. INSERT-only -- once a row is created with a '
  'given value (including NULL), no UPDATE may ever change it, in either '
  'direction. Enforced by trigger, not by the unique constraint alone.';

alter table public.treatment_plans
  add constraint treatment_plans_catalog_assignment_request_id_key
    unique (catalog_assignment_request_id);

create or replace function public.enforce_catalog_assignment_request_id_immutability()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- INSERT-only: reject every change, in every direction --
  -- NULL -> UUID, UUID -> NULL, and UUID A -> UUID B alike. Unlike
  -- 017's provenance triggers (which allow exactly one null ->
  -- populated transition), this column is set only at the moment of
  -- creation by the RPC below and never legitimately changes
  -- afterward for any row, sourced or not.
  if new.catalog_assignment_request_id is distinct from old.catalog_assignment_request_id then
    raise exception
      'treatment_plans: catalog_assignment_request_id cannot be changed after creation (old=%, new=%)',
      old.catalog_assignment_request_id, new.catalog_assignment_request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists treatment_plans_catalog_assignment_request_id_immutability on public.treatment_plans;
create trigger treatment_plans_catalog_assignment_request_id_immutability
  before update on public.treatment_plans
  for each row execute function public.enforce_catalog_assignment_request_id_immutability();

-- SECURITY INVOKER, not DEFINER: this trigger only ever compares OLD
-- and NEW on the same row it already has full trigger-context access
-- to -- no cross-table lookup, so there is no RLS-visibility question
-- for DEFINER to solve here, unlike 017's provenance triggers.
revoke all on function public.enforce_catalog_assignment_request_id_immutability() from public;
revoke all on function public.enforce_catalog_assignment_request_id_immutability() from anon;
revoke all on function public.enforce_catalog_assignment_request_id_immutability() from authenticated;

-- ============================================================
-- RPC: create_plan_from_catalog_program
--
-- Callable only by service_role (see EXECUTE grants at the end of this
-- section), through a new server route
-- (app/api/plans/from-catalog-program/route.ts) that authenticates the
-- clinician via the normal session client, derives provider_id from
-- auth.getUser(), generates the patient token in Node, and passes only
-- trusted identifiers and that token in. The route never accepts a
-- provider id, session/block content, exercises, provenance ids, a
-- token, or a patient name from the request body.
--
-- SECURITY INVOKER, not DEFINER: the only caller is service_role,
-- which already has full privileges on every table this function
-- touches and already bypasses RLS entirely -- INVOKER sees exactly
-- what DEFINER would see for this caller, with no benefit from
-- elevating. Unlike 017's provenance triggers (whose caller can
-- legitimately be an authenticated provider with RLS-filtered catalog
-- visibility), there is no caller here whose privileges differ from
-- what the query needs. Using DEFINER would only add an avoidable
-- risk: if EXECUTE were ever mistakenly granted to a lesser role in
-- the future, DEFINER would silently hand that role service-role-
-- equivalent query visibility through this function; INVOKER ties
-- visibility strictly to whoever actually calls it. search_path is
-- still pinned and every object still fully schema-qualified, as
-- defense-in-depth independent of DEFINER/INVOKER. No dynamic SQL.
--
-- Idempotency / concurrency design:
--   1. A fast-path SELECT by catalog_assignment_request_id runs first,
--      before any patient/program validation -- an already-committed
--      replay short-circuits immediately, returning the original
--      result even if the source program's status has since changed
--      (e.g. archived after the original assignment).
--   2. If not found, the fresh path validates patient/assessment/
--      program, then attempts the treatment_plans INSERT with
--      `ON CONFLICT (catalog_assignment_request_id) DO NOTHING
--      RETURNING id` -- a conflict target scoped to exactly that one
--      constraint, not a broad exception handler. Two genuinely
--      concurrent callers can both reach this INSERT; only one wins.
--   3. If the INSERT returns an id, this call is the winner: it
--      proceeds to insert sessions and the token and returns
--      created=true.
--   4. If the INSERT returns no id (lost the race against a
--      concurrently-committed row with the same request id), this
--      call re-selects the now-committed row, verifies it matches on
--      provider_id/patient_id/source_treatment_program_id/
--      assessment_id, and returns created=false with the winner's
--      persisted sessions/token -- never an unhandled
--      unique_violation.
--   5. Replay match requires ALL of provider_id, patient_id,
--      source_treatment_program_id, and assessment_id (IS NOT
--      DISTINCT FROM, so two NULLs count as a match) -- a bare UUID
--      match on catalog_assignment_request_id alone is not sufficient
--      to treat two calls as "the same request"; a mismatch raises one
--      generic conflict error, disclosing no existing identifiers.
--
-- Atomicity: every insert below is a plain statement inside this
-- function's own implicit transaction -- there is no exception
-- handler anywhere in this function body (the ON CONFLICT clause
-- above is a declarative insert modifier, not an exception handler,
-- and applies only to the one constraint it names), so ANY other
-- failure (a failed patient/program/assessment/integrity check via
-- RAISE EXCEPTION, or a constraint violation on any other insert,
-- including a duplicate patient_access_tokens.token or a duplicate
-- plan_sessions(plan_id, session_number)) aborts the whole function
-- and rolls back every insert already performed within this call,
-- including the treatment_plans and plan_sessions rows. No
-- unique_violation is ever caught broadly, so a genuine constraint
-- failure on an unrelated table can never be mistaken for -- or
-- silently swallowed as -- an idempotency replay of a different
-- request.
--
-- Session integrity: does not rely solely on migration 014's
-- publish-time completeness guarantee (that a published program has
-- at least one session, each with at least one block). On a fresh
-- assignment, GET DIAGNOSTICS immediately after the plan_sessions
-- INSERT confirms at least one row was actually created. The shared
-- result-gathering tail below (which runs for every path: fast
-- replay, race-loser replay, and fresh winner alike) independently
-- re-verifies at least one catalog-sourced session exists for the
-- resolved plan before ever building the JSON result, so sessionIds
-- can never come back as JSON null or an empty array -- either
-- integrity failure raises one generic, caller-safe exception instead.
-- ============================================================

create or replace function public.create_plan_from_catalog_program(
  p_provider_id                   uuid,
  p_patient_id                    uuid,
  p_program_id                    uuid,
  p_assessment_id                 uuid,
  p_catalog_assignment_request_id uuid,
  p_patient_token                 text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_patient_provider_id uuid;
  v_patient_name        text;
  v_program_status      text;
  v_program_name        text;
  v_plan_id             uuid;
  v_created             boolean;
  v_existing            record;
  v_session_ids         uuid[];
  v_token               text;
  v_session_count       integer;
begin
  -- Required-input validation -- fail fast, before any lookup.
  if p_provider_id is null or p_patient_id is null or p_program_id is null then
    raise exception
      'create_plan_from_catalog_program: provider, patient, and program identifiers are required';
  end if;

  if p_catalog_assignment_request_id is null then
    raise exception
      'create_plan_from_catalog_program: catalog_assignment_request_id is required';
  end if;

  if p_patient_token is null or btrim(p_patient_token) = '' then
    raise exception
      'create_plan_from_catalog_program: patient_token is required';
  end if;

  -- Fast-path replay lookup -- BEFORE the published-program check
  -- (and before any patient/assessment check) so an already-committed
  -- retry short-circuits on the original result even if the source
  -- program's status has since changed.
  select id, provider_id, patient_id, source_treatment_program_id, assessment_id
    into v_existing
    from public.treatment_plans
    where catalog_assignment_request_id = p_catalog_assignment_request_id;

  if found then
    if v_existing.provider_id is distinct from p_provider_id
       or v_existing.patient_id is distinct from p_patient_id
       or v_existing.source_treatment_program_id is distinct from p_program_id
       or v_existing.assessment_id is distinct from p_assessment_id then
      -- Generic on purpose: does not disclose the other plan's id,
      -- patient, or provider.
      raise exception
        'create_plan_from_catalog_program: catalog_assignment_request_id was already used for a different assignment';
    end if;

    v_plan_id := v_existing.id;
    v_created := false;
  else
    -- Not found by the fast-path SELECT. Validate, then attempt a
    -- race-safe fresh insert -- a concurrent caller with the same
    -- request id may reach this same branch at the same time; only
    -- one INSERT below will actually win.

    -- Patient must exist and be owned by the caller.
    select provider_id, full_name into v_patient_provider_id, v_patient_name
      from public.patients
      where id = p_patient_id;

    if v_patient_provider_id is null or v_patient_provider_id <> p_provider_id then
      raise exception
        'create_plan_from_catalog_program: patient/provider verification failed';
    end if;

    -- assessment_id, if supplied, must belong to the same patient.
    -- assessments has no provider_id of its own -- ownership is
    -- transitive through the already-verified patient_id.
    if p_assessment_id is not null then
      if not exists (
        select 1 from public.assessments
        where id = p_assessment_id and patient_id = p_patient_id
      ) then
        raise exception
          'create_plan_from_catalog_program: assessment verification failed';
      end if;
    end if;

    -- Source program must exist and be published. Generic on purpose:
    -- does not distinguish nonexistent / draft / archived, matching
    -- 017's own provenance-check wording exactly.
    select status, name into v_program_status, v_program_name
      from public.treatment_programs
      where id = p_program_id;

    if v_program_status is null or v_program_status <> 'published' then
      raise exception
        'create_plan_from_catalog_program: source treatment program is not eligible for assignment';
    end if;

    -- Race-safe fresh insert: ON CONFLICT scoped to exactly the one
    -- constraint that matters here. If a concurrent call already
    -- committed a row with this exact request id between the
    -- fast-path SELECT above and this statement, this INSERT affects
    -- zero rows and returns no id -- handled explicitly below, never
    -- as an unhandled unique_violation.
    insert into public.treatment_plans (
      provider_id, patient_id, assessment_id, title, status,
      total_weeks, current_week, structured_data,
      source_treatment_program_id, catalog_assignment_request_id
    )
    values (
      p_provider_id, p_patient_id, p_assessment_id, v_program_name, 'active',
      1, 1, null,
      p_program_id, p_catalog_assignment_request_id
    )
    on conflict (catalog_assignment_request_id) do nothing
    returning id into v_plan_id;

    if v_plan_id is null then
      -- Lost the race. Re-select the now-committed row and treat this
      -- call as a replay -- a targeted re-check against the one
      -- conflict target this INSERT declared, not a broad
      -- unique_violation catch (which would risk absorbing an
      -- unrelated failure, e.g. a duplicate token, as a false
      -- replay).
      select id, provider_id, patient_id, source_treatment_program_id, assessment_id
        into v_existing
        from public.treatment_plans
        where catalog_assignment_request_id = p_catalog_assignment_request_id;

      if not found then
        -- Should not happen: ON CONFLICT DO NOTHING returns no row
        -- only when a conflicting row exists. Fail loudly rather than
        -- silently proceeding with a null plan id.
        raise exception
          'create_plan_from_catalog_program: catalog assignment integrity error -- conflict without a resolvable row';
      end if;

      if v_existing.provider_id is distinct from p_provider_id
         or v_existing.patient_id is distinct from p_patient_id
         or v_existing.source_treatment_program_id is distinct from p_program_id
         or v_existing.assessment_id is distinct from p_assessment_id then
        raise exception
          'create_plan_from_catalog_program: catalog_assignment_request_id was already used for a different assignment';
      end if;

      v_plan_id := v_existing.id;
      v_created := false;
    else
      v_created := true;

      -- One plan_session per catalog program_session, ordered by
      -- session_number. exercises is the column's own '[]'::jsonb
      -- default -- no block is read or materialized here.
      insert into public.plan_sessions (
        plan_id, provider_id, patient_id, session_number, title,
        exercises, status, source_program_session_id
      )
      select
        v_plan_id, p_provider_id, p_patient_id, ps.session_number, ps.title,
        '[]'::jsonb, 'upcoming', ps.id
      from public.program_sessions ps
      where ps.treatment_program_id = p_program_id
      order by ps.session_number;

      -- Does not rely solely on migration 014's publish-time
      -- completeness trigger. GET DIAGNOSTICS reads the actual
      -- affected-row count of the INSERT immediately above.
      get diagnostics v_session_count = row_count;
      if v_session_count < 1 then
        raise exception
          'create_plan_from_catalog_program: catalog assignment integrity error -- source program has no sessions';
      end if;

      -- Not wrapped in any exception handler: a failure here (e.g.
      -- the caller-supplied token colliding with an existing
      -- patient_access_tokens.token) propagates unmodified and aborts
      -- this whole function, rolling back the treatment_plans and
      -- plan_sessions rows inserted above in the same transaction.
      insert into public.patient_access_tokens (
        provider_id, patient_id, patient_name, plan_id, token, expires_at
      )
      values (
        p_provider_id, p_patient_id, v_patient_name, v_plan_id,
        p_patient_token, now() + interval '365 days'
      );
    end if;
  end if;

  -- Shared result-gathering tail -- runs for every path (fast replay,
  -- race-loser replay, fresh winner alike). Re-verifies session
  -- integrity independently of which path reached here, rather than
  -- trusting the fresh path's own GET DIAGNOSTICS check alone: only
  -- catalog-sourced sessions count (a clinician may since have added
  -- an unsourced session to a sourced plan; that must not appear
  -- here), ordered deterministically, and zero is always an integrity
  -- error -- array_agg() returns SQL NULL over zero rows, so this is
  -- checked explicitly rather than ever letting sessionIds reach the
  -- JSON result as null or an empty array.
  select array_agg(id order by session_number) into v_session_ids
    from public.plan_sessions
    where plan_id = v_plan_id
      and source_program_session_id is not null;

  if v_session_ids is null or array_length(v_session_ids, 1) is null then
    raise exception
      'create_plan_from_catalog_program: catalog assignment integrity error -- no sourced sessions found';
  end if;

  -- INTO STRICT: raises NO_DATA_FOUND / TOO_MANY_ROWS unless exactly
  -- one token row exists for this plan, rather than silently picking
  -- an arbitrary one (no LIMIT is used anywhere in this function).
  select token into strict v_token
    from public.patient_access_tokens
    where plan_id = v_plan_id;

  return jsonb_build_object(
    'planId', v_plan_id,
    'sessionIds', to_jsonb(v_session_ids),
    'patientToken', v_token,
    'created', v_created
  );
end;
$$;

revoke all on function public.create_plan_from_catalog_program(uuid, uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.create_plan_from_catalog_program(uuid, uuid, uuid, uuid, uuid, text) from anon;
revoke all on function public.create_plan_from_catalog_program(uuid, uuid, uuid, uuid, uuid, text) from authenticated;
grant execute on function public.create_plan_from_catalog_program(uuid, uuid, uuid, uuid, uuid, text) to service_role;

-- ============================================================
-- No RLS changes. No table grant changes beyond the function-level
-- EXECUTE grants above. Migrations 014-017 are untouched. No
-- patient_access_tokens.plan_id uniqueness constraint is added here --
-- a read-only Staging check (run before this migration was written)
-- found zero existing patient_access_tokens rows, so no duplicate-
-- plan-id data exists today, but adding a table-wide constraint on a
-- column this migration does not otherwise touch is out of scope; the
-- RPC's own exactly-one-insert-per-transaction plus a
-- SELECT ... INTO STRICT lookup already guarantees "exactly one token
-- per newly created plan" at the application level for every row this
-- function itself creates.
--
-- Rollback (no down-migration file exists in this repository; same
-- documented-manual-DROP convention as every migration in this chain).
-- Dependency-safe order:
--
--   drop function if exists public.create_plan_from_catalog_program(uuid, uuid, uuid, uuid, uuid, text);
--
--   drop trigger if exists treatment_plans_catalog_assignment_request_id_immutability on public.treatment_plans;
--   drop function if exists public.enforce_catalog_assignment_request_id_immutability();
--
--   alter table public.treatment_plans drop constraint if exists treatment_plans_catalog_assignment_request_id_key;
--   alter table public.treatment_plans drop column if exists catalog_assignment_request_id;
-- ============================================================
