-- ============================================================
-- Migration 008 — cv_session_metrics (Model C derived metrics)
--
-- Stores derived computer vision session metrics only.
-- No video, images, landmarks, or clinical interpretation.
--
-- Run manually in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql/new
--
-- Prerequisites:
--   - 001_providers.sql
--   - 002_core_tables.sql
--   - 003_patients_provider_id.sql
-- ============================================================

create table if not exists public.cv_session_metrics (
  id                  uuid        primary key default gen_random_uuid(),
  provider_id         uuid        not null references public.providers(id) on delete cascade,
  patient_id          uuid        references public.patients(id) on delete set null,
  plan_id             uuid        references public.treatment_plans(id) on delete set null,
  plan_session_id     uuid        references public.plan_sessions(id) on delete set null,
  exercise_id         text        not null,
  rep_count           integer,
  session_duration_s  integer,
  tracking_quality    text        check (tracking_quality in ('good', 'fair', 'poor', 'unknown')),
  movement_detected   boolean     not null default false,
  frames_with_pose    integer,
  frames_total        integer,
  source              text        not null default 'cv_lab'
                        check (source in ('cv_lab', 'patient_session', 'assessment_movement')),
  prototype_version   text        not null default '0.1',
  recorded_at         timestamptz not null default now(),

  constraint cv_session_metrics_rep_count_chk
    check (rep_count is null or rep_count >= 0),
  constraint cv_session_metrics_session_duration_chk
    check (session_duration_s is null or session_duration_s >= 0),
  constraint cv_session_metrics_frames_with_pose_chk
    check (frames_with_pose is null or frames_with_pose >= 0),
  constraint cv_session_metrics_frames_total_chk
    check (frames_total is null or frames_total >= 0)
);

create index if not exists cv_session_metrics_provider_recorded_idx
  on public.cv_session_metrics (provider_id, recorded_at desc);

create index if not exists cv_session_metrics_patient_recorded_idx
  on public.cv_session_metrics (patient_id, recorded_at desc)
  where patient_id is not null;

create index if not exists cv_session_metrics_plan_recorded_idx
  on public.cv_session_metrics (plan_id, recorded_at desc)
  where plan_id is not null;

create index if not exists cv_session_metrics_plan_session_recorded_idx
  on public.cv_session_metrics (plan_session_id, recorded_at desc)
  where plan_session_id is not null;

create index if not exists cv_session_metrics_exercise_recorded_idx
  on public.cv_session_metrics (exercise_id, recorded_at desc);

alter table public.cv_session_metrics enable row level security;

create policy "cv_session_metrics: provider selects own"
  on public.cv_session_metrics
  for select
  using (provider_id = auth.uid());

create policy "cv_session_metrics: provider inserts own"
  on public.cv_session_metrics
  for insert
  with check (provider_id = auth.uid());

create policy "cv_session_metrics: provider updates own"
  on public.cv_session_metrics
  for update
  using (provider_id = auth.uid());

create policy "cv_session_metrics: provider deletes own"
  on public.cv_session_metrics
  for delete
  using (provider_id = auth.uid());
