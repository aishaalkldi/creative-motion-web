-- ============================================================
-- Migration 017 — treatment_plans / plan_sessions catalog provenance
--
-- Adds a minimal, database-enforced provenance bridge from the existing,
-- patient-assigned, mutable treatment_plans/plan_sessions tables
-- (002_core_tables.sql) to the persisted, immutable-once-published
-- rehabilitation catalog (014_rehabilitation_program_catalog.sql,
-- 015_rehabilitation_catalog_security_hardening.sql,
-- 016_seed_stroke_upper_limb_recovery_foundation.sql).
--
-- This migration does NOT create or persist a treatment plan, and does
-- NOT materialize catalog blocks into plan_sessions.exercises. It is
-- schema only. Nothing in this migration touches 014, 015, or 016.
--
-- Why persistence is deliberately out of scope here: the existing
-- POST /api/plans route (app/api/plans/route.ts) creates treatment_plans
-- and plan_sessions via separate, non-transactional Supabase client
-- calls, with a "best-effort cleanup" compensating-delete fallback if a
-- later insert fails (see rollbackPlanCreation() in that file) — not a
-- real database transaction. A future "create plan from catalog
-- program" write path must not repeat that pattern for catalog-sourced
-- plans; it needs a genuine atomic mechanism (most likely a Postgres
-- function/RPC) designed and reviewed on its own. This migration only
-- adds the columns and integrity triggers that write path will need,
-- so provenance can never be created inconsistently once that later
-- work lands.
--
-- Revision note (pre-Staging correction, still unapplied everywhere):
-- a strict read-only review of the original version of this migration
-- found three defects, all corrected in place below since this file
-- has never been applied to any environment:
--   1. The triggers validated a supplied catalog UUID's status but
--      never checked WHO was allowed to set provenance in the first
--      place. treatment_plans/plan_sessions RLS (002_core_tables.sql)
--      grants authenticated providers direct, column-unrestricted
--      INSERT/UPDATE on rows they own, so any provider could have
--      fabricated provenance on a hand-built plan by simply supplying
--      a real published program's id. A trusted-writer check (see
--      "Trigger security model" below) now gates the one moment
--      provenance is actually created (null -> populated).
--   2. Exception messages echoed the looked-up catalog status
--      ("found status draft"/"archived") and existence back to the
--      caller. Combined with (1), this let an authenticated caller
--      enumerate treatment_program ids and learn their exact lifecycle
--      state — including draft programs, which treatment_programs'
--      own RLS deliberately hides from authenticated SELECT. All
--      caller-visible provenance-rejection messages are now generic.
--   3. The plan_sessions immutability short-circuit returned early
--      whenever source_program_session_id was unchanged, without
--      checking whether plan_id itself had changed. That let a sourced
--      plan_session be reparented (UPDATE plan_sessions SET plan_id =
--      ...) onto a plan with mismatched or null provenance, bypassing
--      the cross-level guarantee entirely. The short-circuit now also
--      requires plan_id to be unchanged; a plan_id change re-runs full
--      cross-level validation against NEW.plan_id.
--
-- ============================================================
-- Columns
-- ============================================================
--
-- Both new columns are nullable, no default, ON DELETE RESTRICT (not
-- SET NULL — published/archived catalog rows are meant to be permanent,
-- and a patient plan must never silently lose its provenance; see the
-- column comments below and the trigger section for how "permanent" is
-- actually enforced). No existing row requires a backfill — every
-- pre-catalog treatment_plans/plan_sessions row simply has NULL here
-- and remains fully valid.
-- ============================================================

alter table public.treatment_plans
  add column if not exists source_treatment_program_id uuid
    references public.treatment_programs(id) on delete restrict;

comment on column public.treatment_plans.source_treatment_program_id is
  'Immutable provenance reference to the published rehabilitation catalog '
  'treatment_programs row this plan was created from, if any. NOT a live '
  'runtime source -- the plan''s own mutable fields (status, phase, '
  'clinician_note, structured_data, sessions, exercises) remain fully '
  'authoritative and editable for clinical use exactly as before. Set at '
  'most once, at creation (null -> a published program''s id), and only '
  'by a trusted writer (service_role or direct admin execution — see the '
  '"Trigger security model" section below); every further change is '
  'rejected by trigger, including after the source program is later '
  'archived.';

alter table public.plan_sessions
  add column if not exists source_program_session_id uuid
    references public.program_sessions(id) on delete restrict;

comment on column public.plan_sessions.source_program_session_id is
  'Immutable provenance reference to the catalog program_sessions row '
  'this plan session was created from, if any. NOT a live runtime source. '
  'When set, must belong to the same treatment_programs row as the '
  'parent treatment_plans.source_treatment_program_id -- enforced by '
  'trigger, not by the foreign key alone, and re-checked against '
  'NEW.plan_id whenever a sourced session is reparented to a different '
  'treatment_plans row. Set at most once, and only by a trusted writer; '
  'every further change to the value itself is rejected.';

-- ============================================================
-- Indexes
-- ============================================================
-- Partial: most rows will have NULL here (every pre-catalog plan, and
-- every plan session a clinician adds by hand under a sourced plan),
-- matching the existing partial-index convention already used in this
-- repo (e.g. ai_clinician_summaries_plan_created_idx).
-- ============================================================

create index if not exists treatment_plans_source_program_idx
  on public.treatment_plans (source_treatment_program_id)
  where source_treatment_program_id is not null;

create index if not exists plan_sessions_source_program_session_idx
  on public.plan_sessions (source_program_session_id)
  where source_program_session_id is not null;

-- ============================================================
-- Trigger security model
--
-- treatment_plans and plan_sessions are NOT service-role-only writers
-- like the catalog tables in 014/015 -- their existing RLS policies
-- (002_core_tables.sql) explicitly grant `authenticated` providers
-- direct INSERT/UPDATE privilege, gated only by `provider_id =
-- auth.uid()`, with no column-level restriction. That has two separate
-- consequences, both addressed below:
--
--   (a) Cross-table lookups against treatment_programs/program_sessions
--       cannot safely rely on SECURITY INVOKER: if the writer is an
--       authenticated provider (not service_role), an INVOKER-mode
--       lookup would itself be filtered by that provider's own RLS
--       view of the catalog tables (e.g. a draft program's row would
--       simply be invisible rather than visibly "draft"), making the
--       trigger's behavior depend on which role happens to be writing.
--       Both functions below are SECURITY DEFINER, with an explicitly
--       pinned search_path and every referenced table fully
--       schema-qualified (public.treatment_programs,
--       public.program_sessions, public.treatment_plans), so the same,
--       correct, unfiltered lookup applies regardless of who writes.
--
--   (b) SECURITY DEFINER only fixes *what the trigger can see* — it
--       does nothing to restrict *who is allowed to trigger it in the
--       first place*. Because authenticated providers have direct,
--       column-unrestricted write access to their own rows, an
--       unrestricted trigger would let any provider assign provenance
--       to a hand-built plan simply by supplying a real published
--       program id, with no actual relationship to how that plan was
--       created. Both functions therefore add an explicit
--       trusted-writer check, evaluated only at the one moment
--       provenance is actually created (an INSERT with a non-null
--       value, or an UPDATE from null to a non-null value — never on
--       ordinary edits of an already-sourced row):
--
--         v_is_trusted := (auth.role() = 'service_role')
--                       or (session_user = 'postgres');
--
--       auth.role() reads the original PostgREST/Supabase JWT role for
--       this request (the standard Supabase auth-schema helper also
--       relied on by every auth.uid() check in 002_core_tables.sql) —
--       it reflects the real caller even inside a SECURITY DEFINER
--       function, because SECURITY DEFINER changes the SQL privilege
--       role (and current_user) but not PostgREST's per-request GUC
--       settings. current_user is deliberately NOT used as the trust
--       check: under SECURITY DEFINER, current_user is always this
--       function's owner, for every caller, trusted or not, so it
--       cannot distinguish anything.
--
--       session_user = 'postgres' covers direct migration/admin
--       execution outside PostgREST entirely (Supabase SQL Editor,
--       `supabase db push`) — 'postgres' is not a guess: it is this
--       repository's own documented convention for the role migrations
--       run as (see 013_service_role_table_grants.sql's header,
--       "Migrations 000-012 create public tables as postgres", and its
--       "alter default privileges for role postgres" statements).
--
--       An untrusted writer attempting to set provenance gets one
--       generic rejection ("can only be assigned by a trusted writer")
--       raised before any catalog lookup runs, so it cannot be used to
--       probe whether a given catalog id exists.
--
-- Neither function grants any new table privilege: SECURITY DEFINER
-- functions run with the privileges of their owning role (the
-- migration-applying role, matching every other function in this
-- schema), not of any grant statement. Both functions return `trigger`,
-- which PostgreSQL structurally refuses to invoke outside trigger
-- context regardless of EXECUTE privilege (the same reasoning already
-- established for 014's rehab_catalog_program_status_for_session) — as
-- defense in depth, EXECUTE is still explicitly revoked from
-- public/anon/authenticated below, purely for a clean, unambiguous
-- privilege record (this is not functionally load-bearing; nothing
-- outside trigger context can call a trigger-returning function even
-- with EXECUTE granted).
-- ============================================================

create or replace function public.enforce_treatment_plan_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_needs_validation boolean;
  v_is_trusted boolean;
begin
  if tg_op = 'INSERT' then
    v_needs_validation := new.source_treatment_program_id is not null;
  else
    -- tg_op = 'UPDATE'
    if old.source_treatment_program_id is not null then
      if new.source_treatment_program_id is distinct from old.source_treatment_program_id then
        raise exception
          'treatment_plans: source_treatment_program_id is immutable once set (old=%, new=%)',
          old.source_treatment_program_id, new.source_treatment_program_id;
      end if;
      -- Unchanged (same non-null id) -- already validated (including
      -- the trusted-writer check) when first set; do not re-require a
      -- trusted writer or re-check status = 'published' on every later
      -- edit, since the source program may legitimately be archived
      -- after assignment and the plan must remain freely editable by
      -- its owning provider.
      return new;
    end if;
    v_needs_validation := new.source_treatment_program_id is not null;
  end if;

  if not v_needs_validation then
    return new; -- null -> null: ordinary edit of an unsourced plan
  end if;

  -- INSERT with a value, or UPDATE null -> populated: the one moment
  -- provenance is actually created. Check the writer before touching
  -- the catalog at all, so an untrusted caller learns nothing about
  -- whether the supplied id exists.
  v_is_trusted := (auth.role() = 'service_role') or (session_user = 'postgres');

  -- IS NOT TRUE, not `not v_is_trusted`: PostgreSQL's three-valued logic
  -- makes v_is_trusted NULL (not FALSE) whenever auth.role() is NULL
  -- (any connection outside PostgREST -- no request.jwt.claim.role GUC
  -- set) and session_user is not 'postgres' -- `NULL or false` is NULL,
  -- and PL/pgSQL's IF treats a NULL condition as not-true, so
  -- `if not v_is_trusted` would silently skip this branch instead of
  -- rejecting. `is not true` is true for both FALSE and NULL, so every
  -- non-trusted state is rejected, not just the ones that happen to
  -- resolve to a literal FALSE.
  if v_is_trusted is not true then
    raise exception
      'treatment_plans: source_treatment_program_id can only be assigned by a trusted writer';
  end if;

  select status into v_status
    from public.treatment_programs
    where id = new.source_treatment_program_id;

  -- Generic on purpose: does not distinguish nonexistent / draft /
  -- archived. treatment_programs' own RLS hides draft rows from
  -- authenticated SELECT; a status-specific message here would leak
  -- that distinction back through a trusted-writer's own error text
  -- (and, prior to this correction, through an untrusted caller's).
  if v_status is null or v_status <> 'published' then
    raise exception
      'treatment_plans: source treatment program is not eligible for assignment';
  end if;

  return new;
end;
$$;

drop trigger if exists treatment_plans_provenance on public.treatment_plans;
create trigger treatment_plans_provenance
  before insert or update on public.treatment_plans
  for each row execute function public.enforce_treatment_plan_provenance();


create or replace function public.enforce_plan_session_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_found boolean;
  v_plan_program_id uuid;
  v_session_program_id uuid;
  v_is_trusted boolean;
begin
  if tg_op = 'UPDATE' and old.source_program_session_id is not null then
    -- Immutability: once set, the value itself can never change.
    if new.source_program_session_id is distinct from old.source_program_session_id then
      raise exception
        'plan_sessions: source_program_session_id is immutable once set (old=%, new=%)',
        old.source_program_session_id, new.source_program_session_id;
    end if;

    if new.plan_id is not distinct from old.plan_id then
      -- Unchanged value, unchanged parent -- already validated
      -- (including cross-level consistency) when first set; an
      -- ordinary, unrelated edit. No re-validation needed.
      return new;
    end if;

    -- Unchanged value, but the session is being reparented to a
    -- different treatment_plans row (plan_id changed). The previous
    -- cross-level validation was only ever checked against the OLD
    -- parent -- it says nothing about the NEW one. Falling through
    -- (rather than returning here) re-runs the full cross-level check
    -- below against NEW.plan_id. Reparenting itself does not require a
    -- trusted writer -- only newly creating provenance does -- so
    -- v_is_trusted is intentionally left unchecked on this path.
  else
    -- INSERT, or UPDATE where source_program_session_id was
    -- previously null.
    if new.source_program_session_id is null then
      return new; -- not sourced: legacy row, or a clinician-added
                  -- session under a sourced plan -- both allowed.
    end if;

    -- This is the one moment session-level provenance is actually
    -- created (INSERT with a value, or UPDATE null -> populated) --
    -- restrict it to a trusted writer, before any lookup, using the
    -- same rule as enforce_treatment_plan_provenance() above.
    v_is_trusted := (auth.role() = 'service_role') or (session_user = 'postgres');
    -- IS NOT TRUE, not `not v_is_trusted` -- see the identical
    -- three-valued-logic note in enforce_treatment_plan_provenance()
    -- above: v_is_trusted can be NULL, and `not v_is_trusted` would
    -- fail open in that case.
    if v_is_trusted is not true then
      raise exception
        'plan_sessions: source_program_session_id can only be assigned by a trusted writer';
    end if;
  end if;

  -- Cross-level validation, always resolved against NEW.plan_id --
  -- covers both a fresh assignment and a reparent of an
  -- already-sourced session onto a new parent plan.
  select true, source_treatment_program_id
    into v_plan_found, v_plan_program_id
    from public.treatment_plans
    where id = new.plan_id;

  -- Generic on purpose, for every failure branch below: does not
  -- distinguish a missing plan, an unsourced parent, a missing catalog
  -- session, or a genuine program mismatch, so no branch can be used
  -- to probe the existence or lifecycle state of a hidden catalog row.
  if v_plan_found is null or v_plan_program_id is null then
    raise exception
      'plan_sessions: catalog provenance is not valid for the parent treatment plan';
  end if;

  select treatment_program_id into v_session_program_id
    from public.program_sessions
    where id = new.source_program_session_id;

  if v_session_program_id is null or v_session_program_id <> v_plan_program_id then
    raise exception
      'plan_sessions: catalog provenance is not valid for the parent treatment plan';
  end if;

  return new;
end;
$$;

drop trigger if exists plan_sessions_provenance on public.plan_sessions;
create trigger plan_sessions_provenance
  before insert or update on public.plan_sessions
  for each row execute function public.enforce_plan_session_provenance();

-- ============================================================
-- Defense-in-depth EXECUTE revocation
--
-- Not functionally load-bearing (see "Trigger security model" above —
-- PostgreSQL already refuses to invoke a `returns trigger` function
-- outside trigger context, for any role, with or without EXECUTE).
-- Revoked explicitly anyway, purely for an unambiguous privilege
-- record, matching 014's revoke of its own non-trigger helper
-- function. No table privileges are touched by this section.
-- ============================================================

revoke all on function public.enforce_treatment_plan_provenance() from public;
revoke all on function public.enforce_treatment_plan_provenance() from anon;
revoke all on function public.enforce_treatment_plan_provenance() from authenticated;

revoke all on function public.enforce_plan_session_provenance() from public;
revoke all on function public.enforce_plan_session_provenance() from anon;
revoke all on function public.enforce_plan_session_provenance() from authenticated;

-- ============================================================
-- No RLS changes. No table grant changes. Migrations 014-016 are
-- untouched. (The EXECUTE revocations above are function-level, not
-- table-level, and grant no one anything new.)
--
-- Rollback (no down-migration file exists in this repository; same
-- documented-manual-DROP convention as every migration in this chain).
-- Dependency-safe order: triggers depend on their functions; the
-- functions' EXECUTE revocations and the columns' own indexes are both
-- removed automatically when the functions/columns are dropped, but
-- are listed explicitly here for a complete record:
--
--   drop trigger if exists plan_sessions_provenance on public.plan_sessions;
--   drop trigger if exists treatment_plans_provenance on public.treatment_plans;
--
--   drop function if exists public.enforce_plan_session_provenance();
--   drop function if exists public.enforce_treatment_plan_provenance();
--
--   drop index if exists public.plan_sessions_source_program_session_idx;
--   drop index if exists public.treatment_plans_source_program_idx;
--
--   alter table public.plan_sessions drop column if exists source_program_session_id;
--   alter table public.treatment_plans drop column if exists source_treatment_program_id;
-- ============================================================
