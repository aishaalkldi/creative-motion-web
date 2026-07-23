-- ============================================================
-- Migration 015 — rehabilitation catalog security hardening
--
-- Formally records, as a real migration, two corrections that were
-- first discovered and applied by hand directly on Staging during
-- validation of migration 014, then reverted out of 014 itself so
-- that 014 stays an exact, reproducible record of what was originally
-- applied. This migration is what actually re-applies those
-- corrections going forward — including on a project where 014 has
-- never been patched by hand (a fresh database, or Production).
--
-- ============================================================
-- Correction 1 — authenticated privilege over-grant
--
-- 014's original GRANTS section only revoked INSERT/UPDATE/DELETE
-- from authenticated before granting SELECT. Staging validation
-- showed Supabase's project-level baseline grants authenticated more
-- than DML on new public tables — TRUNCATE, REFERENCES, and TRIGGER
-- were all still present after 014 ran. TRUNCATE in particular
-- bypasses row-level triggers entirely and is not gated by RLS at
-- all, so leaving it in place would have let any authenticated user
-- empty every catalog table regardless of every lifecycle/
-- immutability trigger 014 built. The fix: REVOKE ALL from
-- authenticated first, then GRANT back exactly SELECT — the only way
-- to be certain no other ambient baseline privilege survives
-- unnoticed. anon and service_role privileges are restated here too,
-- for one complete, self-contained privilege record rather than a
-- partial diff.
--
-- ============================================================
-- Correction 2 — RLS policy name truncation
--
-- The two child-table SELECT policies' intended names exceeded
-- PostgreSQL's 63-byte identifier limit and were silently truncated
-- on creation (NOTICE 42622). The truncation did not affect the
-- USING predicates — verified identical before and after on Staging
-- — but the stored names were confusing and did not match the source
-- file. This migration drops whichever name is currently live (the
-- original long string always truncates to the same 63 bytes, so a
-- fresh 014 application produces the exact truncated names below;
-- an already-patched database, e.g. Staging, already has the short
-- names) and recreates both policies with the approved short names
-- and the exact original predicates, unchanged.
--
-- Idempotent by design — safe to run against either:
--   (a) a fresh database that just applied the original, unpatched
--       014 (still has the long-source-truncated names below); or
--   (b) Staging, already hand-patched to the short names during 014
--       validation (DROP POLICY IF EXISTS on the long names is then
--       simply a no-op).
--
-- Prerequisites: 014_rehabilitation_program_catalog.sql
-- Apply on Staging first; do not apply to Production until explicitly
-- approved (same convention as every migration in this chain).
-- ============================================================


-- ============================================================
-- Correction 1 — authenticated / anon / service_role privileges
-- ============================================================

revoke all on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
from authenticated;

grant select on
  public.rehabilitation_conditions,
  public.rehabilitation_pathways,
  public.treatment_programs,
  public.program_sessions,
  public.program_session_blocks
to authenticated;

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


-- ============================================================
-- Correction 2 — policy name repair (program_sessions)
--
-- Old truncated name is the first 63 bytes of the original source
-- string "program_sessions: authenticated reads sessions of
-- published or archived programs" — PostgreSQL's truncation is
-- deterministic, so a fresh application of the original 014 produces
-- exactly this name.
-- ============================================================

drop policy if exists "program_sessions: authenticated reads sessions of published or "
  on public.program_sessions;

drop policy if exists "program_sessions: readable when published/archived"
  on public.program_sessions;

create policy "program_sessions: readable when published/archived"
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
-- Correction 2 — policy name repair (program_session_blocks)
--
-- Old truncated name is the first 63 bytes of the original source
-- string "program_session_blocks: authenticated reads blocks of
-- published or archived programs".
-- ============================================================

drop policy if exists "program_session_blocks: authenticated reads blocks of published"
  on public.program_session_blocks;

drop policy if exists "program_session_blocks: readable when published/archived"
  on public.program_session_blocks;

create policy "program_session_blocks: readable when published/archived"
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
