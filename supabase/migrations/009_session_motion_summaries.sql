-- ============================================================
-- Migration 009 — session_motion_summaries (Phase 1 motion evidence)
--
-- Stores SessionMotionEvidenceSummary JSON only (sms-1).
-- No timeline, video, images, landmarks, or clinical interpretation.
--
-- Prerequisites: 008_cv_session_metrics.sql
-- ============================================================

create table if not exists public.session_motion_summaries (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references public.providers(id) on delete cascade,
  patient_id            uuid references public.patients(id) on delete set null,
  session_id            uuid not null references public.plan_sessions(id) on delete cascade,
  cv_session_metrics_id uuid not null references public.cv_session_metrics(id) on delete cascade,
  exercise_id           text not null,
  schema_version        text not null default 'sms-1',
  summary_json          jsonb not null,
  ai_review_draft       jsonb,
  created_at            timestamptz not null default now(),

  constraint session_motion_summaries_exercise_chk
    check (exercise_id = 'sit-to-stand'),

  constraint session_motion_summaries_one_per_cv_metric
    unique (cv_session_metrics_id)
);

create index if not exists session_motion_summaries_provider_created_idx
  on public.session_motion_summaries (provider_id, created_at desc);

create index if not exists session_motion_summaries_patient_exercise_idx
  on public.session_motion_summaries (patient_id, exercise_id, created_at desc)
  where patient_id is not null;

create index if not exists session_motion_summaries_session_idx
  on public.session_motion_summaries (session_id, created_at desc);

alter table public.session_motion_summaries enable row level security;

create policy "session_motion_summaries: provider selects own"
  on public.session_motion_summaries for select
  using (provider_id = auth.uid());

create policy "session_motion_summaries: provider inserts own"
  on public.session_motion_summaries for insert
  with check (provider_id = auth.uid());

create policy "session_motion_summaries: provider updates own"
  on public.session_motion_summaries for update
  using (provider_id = auth.uid());

create policy "session_motion_summaries: provider deletes own"
  on public.session_motion_summaries for delete
  using (provider_id = auth.uid());
