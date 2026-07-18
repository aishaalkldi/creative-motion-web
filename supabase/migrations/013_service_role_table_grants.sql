-- ============================================================
-- Migration 013 — service_role table grants
--
-- Why this exists:
--   Migrations 000–012 create public tables as postgres without
--   GRANT statements. PostgREST connects as service_role for
--   server-side clients (sb_secret_ / SUPABASE_SERVICE_ROLE_KEY).
--   service_role bypasses RLS, but still requires SQL-level
--   privileges on schema public and its tables.
--
--   Without these grants, valid Staging keys authenticate but
--   requests fail with:
--     42501 — permission denied for table providers
--
-- Scope:
--   service_role only. Does not change RLS policies or grant
--   privileges to anon or authenticated.
--
-- Apply on Staging first; do not apply to Production until
-- explicitly approved.
-- ============================================================

-- Required before any table or sequence operation in public.
grant usage on schema public to service_role;

-- Existing tables from migrations 000–012 (and any other public tables).
grant select, insert, update, delete on all tables in schema public to service_role;

-- Existing sequences (identity/serial columns, if any).
grant usage, select on all sequences in schema public to service_role;

-- Future objects created by postgres in later migrations.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
