-- ============================================================
-- Migration 003 — add provider_id to public.patients + RLS
--
-- Run manually in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql/new
--
-- Prerequisites (all already applied):
--   - 001_providers.sql   → public.providers
--   - schema.sql          → public.patients (exists, no provider_id yet)
--
-- Safety: uses ADD COLUMN IF NOT EXISTS — safe to re-run.
-- Does NOT touch existing rows or drop any data.
-- ============================================================

-- ── 1. Add provider_id column ─────────────────────────────────────────────────
--
-- ON DELETE RESTRICT: deleting a provider is blocked while they own patients.
-- Clinical records are never cascade-deleted by an account deletion.

alter table public.patients
  add column if not exists provider_id uuid
    not null
    references public.providers (id)
    on delete restrict;

-- ── 2. Index ──────────────────────────────────────────────────────────────────

create index if not exists patients_provider_id_idx
  on public.patients (provider_id);

-- ── 3. updated_at trigger ─────────────────────────────────────────────────────
-- patients may not have had a trigger before — add it idempotently.

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- ── 4. Enable RLS ─────────────────────────────────────────────────────────────
--
-- Once RLS is enabled with no policies, ALL access is denied by default.
-- Policies below restore the correct access pattern.

alter table public.patients enable row level security;

-- ── 5. RLS Policies ───────────────────────────────────────────────────────────

-- Provider can read only their own patients.
create policy "patients: provider selects own"
  on public.patients
  for select
  using (provider_id = auth.uid());

-- Provider can create patients owned by themselves.
create policy "patients: provider inserts own"
  on public.patients
  for insert
  with check (provider_id = auth.uid());

-- Provider can update their own patients only.
create policy "patients: provider updates own"
  on public.patients
  for update
  using (provider_id = auth.uid());

-- Provider can delete their own patients only.
-- (Cascades to treatment_plans, assessments, session_logs, patient_access_tokens.)
create policy "patients: provider deletes own"
  on public.patients
  for delete
  using (provider_id = auth.uid());
