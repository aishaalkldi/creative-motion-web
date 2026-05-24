-- Migration 007 — append-only clinician review acknowledgments
-- Does not modify session_logs or patient completion data.

create table if not exists public.clinical_review_acknowledgments (
  id              uuid        primary key default gen_random_uuid(),
  provider_id     uuid        not null references public.providers(id) on delete restrict,
  patient_id      uuid        not null references public.patients(id) on delete cascade,
  plan_id         uuid        not null references public.treatment_plans(id) on delete cascade,
  session_log_id  uuid        references public.session_logs(id) on delete set null,
  action_status   text        not null,
  trigger_key     text        not null,
  review_note     text,
  reviewed_by     uuid        not null references public.providers(id) on delete restrict,
  reviewed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint clinical_review_ack_action_status_chk
    check (action_status in (
      'needs_review',
      'pain_increase',
      'high_effort',
      'adherence_follow_up'
    ))
);

create unique index if not exists clinical_review_ack_trigger_unique
  on public.clinical_review_acknowledgments (provider_id, trigger_key);

create index if not exists clinical_review_ack_plan_idx
  on public.clinical_review_acknowledgments (plan_id, reviewed_at desc);

create index if not exists clinical_review_ack_patient_idx
  on public.clinical_review_acknowledgments (patient_id, reviewed_at desc);

alter table public.clinical_review_acknowledgments enable row level security;

create policy "clinical_review_ack: provider reads own"
  on public.clinical_review_acknowledgments for select
  using (provider_id = auth.uid());

create policy "clinical_review_ack: provider inserts own"
  on public.clinical_review_acknowledgments for insert
  with check (provider_id = auth.uid());

-- No UPDATE or DELETE — audit trail is append-only.
