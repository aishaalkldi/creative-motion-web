-- ============================================================
-- Migration 019 — prescribed_laterality and laterality_policy
--
-- Additive, nullable schema only for therapy laterality (PR 2).
-- No treatment_plans backfill under any circumstances.
-- Exactly four reviewed Stroke ULRF v1 Session 1 catalog blocks
-- receive an explicit laterality_policy backfill below.
--
-- program_session_blocks_lifecycle is disabled only for the narrow
-- four-row UPDATE on the published catalog, then re-enabled and
-- verified — catalog immutability is not permanently weakened.
--
-- Prerequisites: 014–018 (catalog chain), including
-- 016_seed_stroke_upper_limb_recovery_foundation.sql.
-- Apply on Staging first; do not apply to Production until
-- explicitly approved. Not applied anywhere at PR creation time.
-- ============================================================

alter table public.treatment_plans
  add column if not exists prescribed_laterality text;

alter table public.treatment_plans
  drop constraint if exists treatment_plans_prescribed_laterality_chk;

alter table public.treatment_plans
  add constraint treatment_plans_prescribed_laterality_chk
  check (
    prescribed_laterality is null
    or prescribed_laterality in ('left', 'right', 'bilateral', 'not_applicable')
  );

comment on column public.treatment_plans.prescribed_laterality is
  'Clinician-assigned laterality for this treatment plan, when set. '
  'Nullable with no default — existing and new rows remain valid with '
  'NULL until explicitly authored. Never backfilled by migration.';

alter table public.program_session_blocks
  add column if not exists laterality_policy text;

alter table public.program_session_blocks
  drop constraint if exists program_session_blocks_laterality_policy_chk;

alter table public.program_session_blocks
  add constraint program_session_blocks_laterality_policy_chk
  check (
    laterality_policy is null
    or laterality_policy in ('use_prescription', 'bilateral', 'not_applicable')
  );

comment on column public.program_session_blocks.laterality_policy is
  'Catalog-authored laterality execution policy for this block. '
  'Nullable with no default — NULL is an invalid/un-authored state and '
  'must never be silently treated as use_prescription. Only the four '
  'reviewed Stroke ULRF v1 Session 1 blocks are backfilled here.';

do $laterality_catalog_backfill$
declare
  trigger_exists boolean;
  trigger_enabled char;
  updated_count bigint;
begin
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'program_session_blocks'
      and t.tgname = 'program_session_blocks_lifecycle'
      and not t.tgisinternal
  ) into trigger_exists;

  if not trigger_exists then
    raise exception
      'program_session_blocks_lifecycle trigger must exist before laterality backfill';
  end if;

  select t.tgenabled
  into trigger_enabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'program_session_blocks'
    and t.tgname = 'program_session_blocks_lifecycle'
    and not t.tgisinternal;

  if trigger_enabled not in ('O', 'A') then
    raise exception
      'program_session_blocks_lifecycle trigger must be enabled before backfill (got %)',
      trigger_enabled;
  end if;

  if (
    select count(*)
    from public.program_session_blocks psb
    where psb.block_key in (
      'stroke-ulrf-v1-session-1-warm-up',
      'stroke-ulrf-v1-session-1-reach-the-light',
      'stroke-ulrf-v1-session-1-d1-diagonal-reach',
      'stroke-ulrf-v1-session-1-cool-down'
    )
  ) <> 4 then
    raise exception
      'Expected exactly four Stroke ULRF v1 Session 1 catalog blocks before backfill';
  end if;

  if exists (
    select psb.block_key
    from public.program_session_blocks psb
    where psb.block_key in (
      'stroke-ulrf-v1-session-1-warm-up',
      'stroke-ulrf-v1-session-1-reach-the-light',
      'stroke-ulrf-v1-session-1-d1-diagonal-reach',
      'stroke-ulrf-v1-session-1-cool-down'
    )
    group by psb.block_key
    having count(*) <> 1
  ) then
    raise exception
      'Each expected block_key must exist exactly once before backfill';
  end if;

  if exists (
    select 1
    from (
      values
        ('stroke-ulrf-v1-session-1-warm-up', 'instructional'),
        ('stroke-ulrf-v1-session-1-reach-the-light', 'movement-target'),
        ('stroke-ulrf-v1-session-1-d1-diagonal-reach', 'movement-pattern'),
        ('stroke-ulrf-v1-session-1-cool-down', 'instructional')
    ) as expected(block_key, block_type)
    left join public.program_session_blocks psb
      on psb.block_key = expected.block_key
    where psb.block_key is null
       or psb.block_type is distinct from expected.block_type
  ) then
    raise exception
      'Catalog block preconditions failed: expected block_keys with matching block_types';
  end if;

  execute 'alter table public.program_session_blocks disable trigger program_session_blocks_lifecycle';

  update public.program_session_blocks
  set laterality_policy = 'not_applicable'
  where block_key = 'stroke-ulrf-v1-session-1-warm-up';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception
      'Expected to backfill warm-up laterality_policy for exactly one row, updated %',
      updated_count;
  end if;

  update public.program_session_blocks
  set laterality_policy = 'use_prescription'
  where block_key = 'stroke-ulrf-v1-session-1-reach-the-light';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception
      'Expected to backfill reach-the-light laterality_policy for exactly one row, updated %',
      updated_count;
  end if;

  update public.program_session_blocks
  set laterality_policy = 'use_prescription'
  where block_key = 'stroke-ulrf-v1-session-1-d1-diagonal-reach';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception
      'Expected to backfill d1-diagonal-reach laterality_policy for exactly one row, updated %',
      updated_count;
  end if;

  update public.program_session_blocks
  set laterality_policy = 'not_applicable'
  where block_key = 'stroke-ulrf-v1-session-1-cool-down';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception
      'Expected to backfill cool-down laterality_policy for exactly one row, updated %',
      updated_count;
  end if;

  execute 'alter table public.program_session_blocks enable trigger program_session_blocks_lifecycle';

  select t.tgenabled
  into trigger_enabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'program_session_blocks'
    and t.tgname = 'program_session_blocks_lifecycle'
    and not t.tgisinternal;

  if trigger_enabled not in ('O', 'A') then
    raise exception
      'program_session_blocks_lifecycle trigger must be re-enabled after backfill (got %)',
      trigger_enabled;
  end if;
end;
$laterality_catalog_backfill$;
