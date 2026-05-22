-- Migration 006: Remote assessment request tokens (cross-device patient links)

create table if not exists public.remote_assessment_requests (
  id                uuid primary key default gen_random_uuid(),
  token             text unique not null,
  patient_id        uuid not null references public.patients(id),
  provider_id       uuid not null references public.providers(id),
  assessment_type   text not null default 'remote_questionnaire',
  included_sections jsonb default '[]',
  status            text not null default 'pending',
  assessment_id     uuid references public.assessments(id),
  expires_at        timestamptz not null default (now() + interval '7 days'),
  created_at        timestamptz not null default now(),
  submitted_at      timestamptz
);

alter table public.remote_assessment_requests
  enable row level security;

drop policy if exists "remote_req_provider" on public.remote_assessment_requests;

create policy "remote_req_provider"
  on public.remote_assessment_requests for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

create index if not exists idx_remote_req_token
  on public.remote_assessment_requests (token)
  where status = 'pending';
