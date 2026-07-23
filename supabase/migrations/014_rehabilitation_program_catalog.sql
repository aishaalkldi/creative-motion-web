-- ============================================================
-- Migration 014 — rehabilitation_conditions, rehabilitation_pathways,
--                 treatment_programs, program_sessions,
--                 program_session_blocks
--
-- Neuro Rehabilitation program catalog — the persisted, versioned
-- CATALOG DEFINITION hierarchy behind the TypeScript catalog already
-- shipped in app/lib/rehab-programs/ (PR #165) and consumed by the
-- runtime adapter (PR #166).
--
-- "program" vs "plan" — these are deliberately different concepts:
--   - a treatment_program (this migration) is a shared, versioned,
--     ownerless CATALOG DEFINITION — nobody's patient, nobody's
--     provider owns it, exactly like a menu entry.
--   - a treatment_plan (002_core_tables.sql) is a PATIENT-ASSIGNED,
--     individualized, mutable instance owned by one provider for one
--     patient.
-- This migration does not bridge them. No treatment_plans or
-- plan_sessions row will ever reference these new tables as a result
-- of this migration — that bridge is explicitly a later PR's job.
--
-- Additive only. No existing table is altered. No seed data is
-- included — every table created here starts empty; a later PR
-- inserts the one real Stroke -> Upper Limb Recovery Foundation row
-- set via SQL, mirroring the TypeScript catalog's single hardcoded
-- entry.
--
-- No patient data, measured results, runtime/detector state, timers,
-- refs, or AI decisions are ever stored in these tables — that is the
-- job of a future results table (e.g. session_block_results), never
-- this one. See rehab-program-types.ts's own module doc for the same
-- separation stated on the TypeScript side.
--
-- Rollback order (no down-migration file exists in this repository;
-- migrations 000-013 follow the same convention — rollback is a
-- documented manual DROP in strict reverse-dependency order). Functions
-- are independent objects, not owned by any table — DROP TABLE removes
-- their triggers automatically but never the underlying function
-- definitions, so a complete rollback must drop both:
--   drop function if exists public.enforce_program_session_blocks_lifecycle();
--   drop function if exists public.enforce_program_sessions_lifecycle();
--   drop function if exists public.enforce_treatment_program_lifecycle();
--   drop function if exists public.rehab_catalog_program_status_for_session(uuid);
--   drop function if exists public.enforce_rehabilitation_pathway_identity();
--   drop function if exists public.enforce_rehabilitation_condition_identity();
--
--   drop table if exists public.program_session_blocks;
--   drop table if exists public.program_sessions;
--   drop table if exists public.treatment_programs;
--   drop table if exists public.rehabilitation_pathways;
--   drop table if exists public.rehabilitation_conditions;
--
-- Run manually in Supabase SQL Editor, or via `supabase db push`:
--   https://supabase.com/dashboard/project/_/sql/new
-- Apply on Staging first; do not apply to Production until explicitly
-- approved (same convention as 013_service_role_table_grants.sql).
--
-- Prerequisites (all already applied):
--   - 000_schema_baseline.sql  → pgcrypto extension, public.patients
--   - 001_providers.sql        → public.set_updated_at()
--   - 013_service_role_table_grants.sql → service_role default
--     privileges on future tables created by role postgres (this
--     migration still grants service_role explicitly below, for a
--     self-contained, unambiguous record independent of that default).
-- ============================================================


-- ============================================================
-- TABLE 1: rehabilitation_conditions
-- Top-level taxonomy node (e.g. "Stroke"). Globally unique slug —
-- nothing sits above it to scope uniqueness to.
-- ============================================================

create table if not exists public.rehabilitation_conditions (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists rehabilitation_conditions_updated_at on public.rehabilitation_conditions;
create trigger rehabilitation_conditions_updated_at
  before update on public.rehabilitation_conditions
  for each row execute function public.set_updated_at();

-- Identity protection: slug is the stable catalog key a treatment
-- program's ancestry is resolved through — it must never move under a
-- published program. name is a display label and remains editable.
create or replace function public.enforce_rehabilitation_condition_identity()
returns trigger language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'rehabilitation_conditions: slug is immutable once created (got % -> %)', old.slug, new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists rehabilitation_conditions_identity on public.rehabilitation_conditions;
create trigger rehabilitation_conditions_identity
  before update on public.rehabilitation_conditions
  for each row execute function public.enforce_rehabilitation_condition_identity();

-- RLS
alter table public.rehabilitation_conditions enable row level security;

create policy "rehabilitation_conditions: authenticated reads all"
  on public.rehabilitation_conditions
  for select
  to authenticated
  using (true);

-- No authenticated insert/update/delete policy — writes are
-- service-role-only (see the GRANTS section at the end of this file).
-- No anon policy of any kind.


-- ============================================================
-- TABLE 2: rehabilitation_pathways
-- Second-level taxonomy node (e.g. "Upper Limb Recovery Foundation").
-- slug is scoped to condition_id, not globally unique — pathway
-- *names* are domain concepts genuinely likely to recur across
-- different conditions (e.g. a future Parkinson's pathway plausibly
-- wanting a similarly-named "Upper Limb Recovery Foundation").
-- ============================================================

create table if not exists public.rehabilitation_pathways (
  id            uuid        primary key default gen_random_uuid(),
  condition_id  uuid        not null references public.rehabilitation_conditions(id) on delete restrict,
  slug          text        not null,
  name          text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (condition_id, slug)
);

drop trigger if exists rehabilitation_pathways_updated_at on public.rehabilitation_pathways;
create trigger rehabilitation_pathways_updated_at
  before update on public.rehabilitation_pathways
  for each row execute function public.set_updated_at();

-- Identity protection: neither slug nor condition_id may change once
-- created — a pathway must never be silently reclassified under a
-- different condition or given a different stable key. name remains
-- editable.
create or replace function public.enforce_rehabilitation_pathway_identity()
returns trigger language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'rehabilitation_pathways: slug is immutable once created (got % -> %)', old.slug, new.slug;
  end if;
  if new.condition_id is distinct from old.condition_id then
    raise exception 'rehabilitation_pathways: condition_id is immutable once created — a pathway cannot be moved between conditions';
  end if;
  return new;
end;
$$;

drop trigger if exists rehabilitation_pathways_identity on public.rehabilitation_pathways;
create trigger rehabilitation_pathways_identity
  before update on public.rehabilitation_pathways
  for each row execute function public.enforce_rehabilitation_pathway_identity();

-- RLS
alter table public.rehabilitation_pathways enable row level security;

create policy "rehabilitation_pathways: authenticated reads all"
  on public.rehabilitation_pathways
  for select
  to authenticated
  using (true);


-- ============================================================
-- TABLE 3: treatment_programs
-- Versioned catalog program definition (e.g. "Upper Limb Recovery
-- Foundation v1"). A new version is always a NEW ROW — published and
-- archived rows are never edited in place (see the lifecycle trigger
-- at the end of this file). slug is the full catalog id string
-- (matches TreatmentProgram.id / getTreatmentProgramById's flat
-- lookup signature exactly) and is globally unique; (pathway_id,
-- version) is the separate semantic-versioning integrity key.
-- ============================================================

create table if not exists public.treatment_programs (
  id           uuid        primary key default gen_random_uuid(),
  pathway_id   uuid        not null references public.rehabilitation_pathways(id) on delete restrict,
  slug         text        not null unique,
  name         text        not null,
  version      integer     not null,
  status       text        not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint treatment_programs_version_chk check (version >= 1),
  constraint treatment_programs_status_chk check (status in ('draft', 'published', 'archived')),
  unique (pathway_id, version)
);

drop trigger if exists treatment_programs_updated_at on public.treatment_programs;
create trigger treatment_programs_updated_at
  before update on public.treatment_programs
  for each row execute function public.set_updated_at();

-- Not covered by any unique index's leading column (unlike pathway_id,
-- which (pathway_id, version) already indexes) — a genuine, separate
-- query shape: "all published/archived programs across every pathway."
create index if not exists treatment_programs_status_idx
  on public.treatment_programs (status);

-- RLS
alter table public.treatment_programs enable row level security;

-- Draft programs must never be readable by authenticated users —
-- only published and archived. Archived stays readable indefinitely
-- for historical plans, audit, and reporting; it is simply excluded
-- from new-assignment selection at the application/bridge layer, not
-- from this table's visibility.
create policy "treatment_programs: authenticated reads published or archived"
  on public.treatment_programs
  for select
  to authenticated
  using (status in ('published', 'archived'));


-- ============================================================
-- TABLE 4: program_sessions
-- Ordered sessions within a treatment_program (e.g. "Session 1").
-- session_key is the full catalog id string (matches ProgramSession.id
-- / SessionDefinition.sessionId's flat usage in the PR #166 adapter
-- exactly) and is globally unique. session_number provides
-- deterministic, parent-scoped ordering — it need not be contiguous.
--
-- requires_calibration / summary_mode are session-level LIFECYCLE
-- METADATA (SessionOrchestrator pre-block/post-block states) — they
-- are never represented as rows in program_session_blocks.
-- ============================================================

create table if not exists public.program_sessions (
  id                              uuid        primary key default gen_random_uuid(),
  treatment_program_id            uuid        not null references public.treatment_programs(id) on delete cascade,
  session_key                     text        not null unique,
  session_number                  integer     not null,
  title                           text        not null,
  goal                            text        not null,
  estimated_duration_minutes_min  integer     not null,
  estimated_duration_minutes_max  integer     not null,
  requires_calibration            boolean     not null default true,
  summary_mode                    text        not null default 'standard',
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint program_sessions_number_chk check (session_number >= 1),
  constraint program_sessions_summary_mode_chk check (summary_mode in ('standard', 'none')),
  constraint program_sessions_duration_min_chk check (estimated_duration_minutes_min > 0),
  constraint program_sessions_duration_max_chk check (estimated_duration_minutes_max > 0),
  constraint program_sessions_duration_range_chk
    check (estimated_duration_minutes_max >= estimated_duration_minutes_min),
  -- Scoped ordering key — mirrors plan_sessions' unique(plan_id, session_number) exactly.
  unique (treatment_program_id, session_number)
);

drop trigger if exists program_sessions_updated_at on public.program_sessions;
create trigger program_sessions_updated_at
  before update on public.program_sessions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.program_sessions enable row level security;

create policy "program_sessions: authenticated reads sessions of published or archived programs"
  on public.program_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.treatment_programs tp
      where tp.id = program_sessions.treatment_program_id
        and tp.status in ('published', 'archived')
    )
  );


-- ============================================================
-- TABLE 5: program_session_blocks
-- Executable blocks only — Calibration and Summary are never rows
-- here (they are program_sessions.requires_calibration/summary_mode).
-- block_key is the full catalog blockId string and is globally
-- unique, matching how the PR #166 adapter already treats blockId as
-- a flat key (STROKE_ULRF_V1_SESSION_1_SUPPORTED_POSITIONS,
-- resolveMovementId) with no session-scoping anywhere in that code.
-- block_order provides deterministic, parent-scoped ordering — it
-- need not be contiguous.
--
-- target_duration_seconds is required (not null, > 0): the current
-- persisted runtime model and PR #166 adapter support duration-based
-- blocks only (resolveCompletionMode derives "duration" or throws — it
-- has no other completion model to fall back to). A later additive
-- migration may relax this once the TypeScript catalog and runtime
-- adapter support another completion mode.
-- ============================================================

create table if not exists public.program_session_blocks (
  id                      uuid        primary key default gen_random_uuid(),
  program_session_id      uuid        not null references public.program_sessions(id) on delete cascade,
  block_key               text        not null unique,
  block_order             integer     not null,
  block_type              text        not null,
  title                   text        not null,
  instructions            text        not null,
  movement_id             text,
  feedback_profile        text,
  target_duration_seconds integer     not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint program_session_blocks_order_chk check (block_order >= 1),
  constraint program_session_blocks_type_chk
    check (block_type in ('movement-target', 'movement-pattern', 'instructional')),
  constraint program_session_blocks_duration_chk check (target_duration_seconds > 0),
  -- Bidirectional: instructional blocks must never carry a movement_id
  -- (including the PR #166 adapter's synthesized "instructional:<blockId>"
  -- operational label, which is generated at runtime-conversion time and
  -- must never be persisted here); movement-target/movement-pattern
  -- blocks must always carry a real one.
  constraint program_session_blocks_movement_id_chk check (
    (block_type = 'instructional' and movement_id is null)
    or
    (block_type in ('movement-target', 'movement-pattern') and movement_id is not null)
  ),
  -- feedback_profile is deliberately NOT constrained by block_type:
  -- ProgramSessionBlock.feedbackProfile is optional for every block
  -- type in the TypeScript source with no code-level correlation to
  -- blockType (unlike movementId, which the PR #166 adapter's
  -- resolveMovementId genuinely enforces) — adding a stricter DB rule
  -- here would put the schema ahead of a guarantee the code doesn't
  -- actually make.
  unique (program_session_id, block_order)
);

drop trigger if exists program_session_blocks_updated_at on public.program_session_blocks;
create trigger program_session_blocks_updated_at
  before update on public.program_session_blocks
  for each row execute function public.set_updated_at();

-- RLS
alter table public.program_session_blocks enable row level security;

create policy "program_session_blocks: authenticated reads blocks of published or archived programs"
  on public.program_session_blocks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.program_sessions ps
      join public.treatment_programs tp on tp.id = ps.treatment_program_id
      where ps.id = program_session_blocks.program_session_id
        and tp.status in ('published', 'archived')
    )
  );


-- ============================================================
-- CROSS-TABLE LIFECYCLE ENFORCEMENT
-- Placed after all five tables exist so every reference below is
-- resolvable at both creation and execution time (plpgsql function
-- bodies are not validated against table existence until they first
-- execute, but there is no reason to rely on that here now that every
-- table this section touches already exists).
-- ============================================================

-- Shared two-level lookup: resolves the owning treatment_programs.status
-- for a given program_sessions.id, used by the program_session_blocks
-- ownership-guard trigger below. Returns null when the session row does
-- not exist — the one case that must be treated as "allow" (cascade
-- delete of a draft program's sessions/blocks), never as "deny".
create or replace function public.rehab_catalog_program_status_for_session(p_session_id uuid)
returns text language sql stable as $$
  select tp.status
  from public.program_sessions ps
  join public.treatment_programs tp on tp.id = ps.treatment_program_id
  where ps.id = p_session_id;
$$;

-- Not exposed as a callable RPC to anon/authenticated: it would let a
-- caller probe a draft program's status indirectly (by session id),
-- bypassing the RLS policies above that hide drafts entirely. Revoked
-- from PUBLIC (which would otherwise include anon and authenticated by
-- default); explicitly re-granted to service_role only, since the
-- trigger functions below call it as part of service-role-only writes.
revoke all on function public.rehab_catalog_program_status_for_session(uuid) from public;
grant execute on function public.rehab_catalog_program_status_for_session(uuid) to service_role;


-- treatment_programs: closed lifecycle (draft -> published -> archived
-- only), content-field immutability once non-draft, and
-- publish-time completeness validation.
create or replace function public.enforce_treatment_program_lifecycle()
returns trigger language plpgsql as $$
declare
  content_changed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'treatment_programs: % rows cannot be deleted (status=%)', old.slug, old.status;
    end if;
    return old;
  end if;

  -- tg_op = 'UPDATE' from here on. Compare ONLY explicit business-
  -- content fields — never id, created_at, updated_at, or status
  -- itself (status is governed by the transition checks below).
  -- updated_at changes on every UPDATE via public.set_updated_at();
  -- excluding it here makes correctness independent of whether that
  -- trigger or this one fires first (both are BEFORE UPDATE on the
  -- same table).
  content_changed :=
       new.pathway_id is distinct from old.pathway_id
    or new.slug        is distinct from old.slug
    or new.name         is distinct from old.name
    or new.version       is distinct from old.version;

  if old.status = 'draft' then
    if new.status = 'draft' then
      return new; -- free content edits while draft
    elsif new.status = 'published' then
      -- Publish-time completeness validation: at least one session,
      -- and every session has at least one block.
      if not exists (
        select 1 from public.program_sessions ps where ps.treatment_program_id = new.id
      ) then
        raise exception 'treatment_programs: cannot publish % — program has no sessions', new.slug;
      end if;
      if exists (
        select 1
        from public.program_sessions ps
        where ps.treatment_program_id = new.id
          and not exists (
            select 1 from public.program_session_blocks psb where psb.program_session_id = ps.id
          )
      ) then
        raise exception 'treatment_programs: cannot publish % — every session must have at least one block', new.slug;
      end if;
      return new;
    else
      raise exception 'treatment_programs: invalid status transition % -> %', old.status, new.status;
    end if;
  end if;

  if old.status = 'published' then
    if new.status = 'published' then
      if content_changed then
        raise exception 'treatment_programs: published rows are immutable — content fields cannot change';
      end if;
      return new;
    elsif new.status = 'archived' then
      if content_changed then
        raise exception 'treatment_programs: content fields cannot change during archival';
      end if;
      return new;
    else
      raise exception 'treatment_programs: invalid status transition % -> %', old.status, new.status;
    end if;
  end if;

  if old.status = 'archived' then
    if new.status = 'archived' and not content_changed then
      return new;
    end if;
    raise exception 'treatment_programs: archived rows are immutable and cannot change status or content';
  end if;

  raise exception 'treatment_programs: unrecognized status %', old.status; -- fail closed
end;
$$;

drop trigger if exists treatment_programs_lifecycle on public.treatment_programs;
create trigger treatment_programs_lifecycle
  before update or delete on public.treatment_programs
  for each row execute function public.enforce_treatment_program_lifecycle();


-- program_sessions: INSERT checks the NEW owning program is draft;
-- DELETE checks the OLD owning program is draft; UPDATE checks BOTH —
-- rejecting a move into OR out of a published/archived program. The
-- "owner not found -> allow" fallback exists only in the DELETE branch,
-- for cascade deletion of a draft program's sessions; INSERT/UPDATE
-- fail closed if an owner cannot be resolved (should not occur given
-- the FK, but this trigger does not rely on FK ordering to be correct).
create or replace function public.enforce_program_sessions_lifecycle()
returns trigger language plpgsql as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op = 'DELETE' then
    select status into old_status from public.treatment_programs where id = old.treatment_program_id;
    if old_status is not null and old_status <> 'draft' then
      raise exception 'program_sessions: cannot delete a session owned by a % program', old_status;
    end if;
    return old;
  end if;

  select status into new_status from public.treatment_programs where id = new.treatment_program_id;
  if new_status is null then
    raise exception 'program_sessions: treatment_program_id % not found', new.treatment_program_id;
  end if;
  if new_status <> 'draft' then
    raise exception 'program_sessions: cannot insert/update a session under a % program', new_status;
  end if;

  if tg_op = 'UPDATE' then
    select status into old_status from public.treatment_programs where id = old.treatment_program_id;
    if old_status is null then
      raise exception 'program_sessions: previous treatment_program_id % not found (unexpected)', old.treatment_program_id;
    end if;
    if old_status <> 'draft' then
      raise exception 'program_sessions: cannot move a session out of a % program', old_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists program_sessions_lifecycle on public.program_sessions;
create trigger program_sessions_lifecycle
  before insert or update or delete on public.program_sessions
  for each row execute function public.enforce_program_sessions_lifecycle();


-- program_session_blocks: identical shape to program_sessions above,
-- resolved through the two-level rehab_catalog_program_status_for_session
-- helper (block -> session -> program). Its null-return (session not
-- found) is what makes the cascade-from-draft-deletion path work at
-- both levels: a program's cascade removes its sessions, whose own
-- cascade removes their blocks, and at each step "owner not found"
-- resolves to "allow" only inside the DELETE branch.
create or replace function public.enforce_program_session_blocks_lifecycle()
returns trigger language plpgsql as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op = 'DELETE' then
    old_status := public.rehab_catalog_program_status_for_session(old.program_session_id);
    if old_status is not null and old_status <> 'draft' then
      raise exception 'program_session_blocks: cannot delete a block owned (via session) by a % program', old_status;
    end if;
    return old;
  end if;

  new_status := public.rehab_catalog_program_status_for_session(new.program_session_id);
  if new_status is null then
    raise exception 'program_session_blocks: program_session_id % not found', new.program_session_id;
  end if;
  if new_status <> 'draft' then
    raise exception 'program_session_blocks: cannot insert/update a block under a % program', new_status;
  end if;

  if tg_op = 'UPDATE' then
    old_status := public.rehab_catalog_program_status_for_session(old.program_session_id);
    if old_status is null then
      raise exception 'program_session_blocks: previous program_session_id % not found (unexpected)', old.program_session_id;
    end if;
    if old_status <> 'draft' then
      raise exception 'program_session_blocks: cannot move a block out of a % program', old_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists program_session_blocks_lifecycle on public.program_session_blocks;
create trigger program_session_blocks_lifecycle
  before insert or update or delete on public.program_session_blocks
  for each row execute function public.enforce_program_session_blocks_lifecycle();


-- ============================================================
-- GRANTS AND PRIVILEGES
--
-- Policies alone do not grant table privileges — RLS only narrows
-- what an already-privileged role may do. Supabase's project-level
-- bootstrap (outside this migration chain) is what has historically
-- given `anon`/`authenticated` their baseline table privileges on
-- public-schema tables; migration 013's own header explains the
-- equivalent gap for service_role on tables created after that
-- bootstrap. Rather than depend on assumptions about what a given
-- Supabase project's baseline already grants to anon/authenticated on
-- these five brand-new tables, this section makes the intended
-- privilege model explicit and self-contained:
--   - authenticated: SELECT only, on all five tables.
--   - anon: no access at all.
--   - service_role: full DML (bypasses RLS already; also gets the
--     explicit table grants 013's ALTER DEFAULT PRIVILEGES should
--     already provide, restated here for an unambiguous record).
-- ============================================================

grant usage on schema public to authenticated;

grant select on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
to authenticated;

revoke insert, update, delete on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
from authenticated;

revoke all on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
from anon;

grant select, insert, update, delete on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
to service_role;
