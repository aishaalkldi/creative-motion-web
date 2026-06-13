-- ============================================================
-- Migration 010 — patients.file_number (clinic-visible file ref)
--
-- Internal stable ID remains patients.id (uuid).
-- Nullable for safe rollout; assign on create for new patients.
-- Run manually in Supabase SQL Editor after 003_patients_provider_id.sql.
-- ============================================================

alter table public.patients
  add column if not exists file_number text;

create unique index if not exists patients_provider_file_number_unique
  on public.patients (provider_id, file_number)
  where file_number is not null;

comment on column public.patients.file_number is
  'Clinic-visible patient file reference scoped per provider. Not a clinical diagnosis identifier.';
