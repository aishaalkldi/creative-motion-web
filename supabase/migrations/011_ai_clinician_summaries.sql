-- ============================================================
-- Migration 011 — ai_clinician_summaries (Sprint 1 D2)
--
-- Persists AI-generated clinician session summary drafts and
-- approved copies. Append-only after approval (no UPDATE on approved).
--
-- Prerequisites:
--   - 001_providers.sql
--   - 002_core_tables.sql
--   - 003_patients_provider_id.sql
-- ============================================================

create table if not exists public.ai_clinician_summaries (
  id              uuid        primary key default gen_random_uuid(),
  provider_id     uuid        not null references public.providers(id) on delete restrict,
  patient_id      uuid        not null references public.patients(id) on delete cascade,
  plan_id         uuid        references public.treatment_plans(id) on delete set null,
  draft_text      text        not null,
  approved_text   text,
  inputs_snapshot jsonb       not null,
  schema_version  text        not null,
  status          text        not null default 'draft',
  created_at      timestamptz not null default now(),
  approved_at     timestamptz,
  approved_by     uuid        references public.providers(id) on delete set null,

  constraint ai_clinician_summaries_status_chk
    check (status in ('draft', 'approved', 'dismissed'))
);

create index if not exists ai_clinician_summaries_provider_created_idx
  on public.ai_clinician_summaries (provider_id, created_at desc);

create index if not exists ai_clinician_summaries_patient_created_idx
  on public.ai_clinician_summaries (patient_id, created_at desc);

create index if not exists ai_clinician_summaries_plan_created_idx
  on public.ai_clinician_summaries (plan_id, created_at desc)
  where plan_id is not null;

create index if not exists ai_clinician_summaries_provider_patient_approved_idx
  on public.ai_clinician_summaries (provider_id, patient_id, approved_at desc)
  where status = 'approved';

alter table public.ai_clinician_summaries enable row level security;

create policy "ai_clinician_summaries: provider selects own"
  on public.ai_clinician_summaries for select
  using (provider_id = auth.uid());

create policy "ai_clinician_summaries: provider inserts draft"
  on public.ai_clinician_summaries for insert
  with check (provider_id = auth.uid() and status = 'draft');

-- USING: only existing draft rows owned by the provider may be updated.
-- WITH CHECK: the new row must remain provider-owned and transition to
-- approved/dismissed only (no in-place draft edits; approved rows cannot
-- be updated because USING requires OLD.status = 'draft').
create policy "ai_clinician_summaries: provider updates draft only"
  on public.ai_clinician_summaries for update
  using (provider_id = auth.uid() and status = 'draft')
  with check (
    provider_id = auth.uid()
    and status in ('approved', 'dismissed')
  );

-- Defense in depth: block identity / draft field mutation during approval.
create or replace function public.enforce_ai_clinician_summary_immutability()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' then
      raise exception 'ai_clinician_summaries: approved or dismissed rows are immutable';
    end if;

    if new.status = 'approved' then
      if new.provider_id is distinct from old.provider_id
         or new.patient_id is distinct from old.patient_id
         or new.plan_id is distinct from old.plan_id
         or new.draft_text is distinct from old.draft_text
         or new.inputs_snapshot is distinct from old.inputs_snapshot
         or new.schema_version is distinct from old.schema_version
         or new.created_at is distinct from old.created_at
      then
        raise exception 'ai_clinician_summaries: immutable fields cannot change on approval';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_clinician_summaries_immutability on public.ai_clinician_summaries;
create trigger ai_clinician_summaries_immutability
  before update on public.ai_clinician_summaries
  for each row execute function public.enforce_ai_clinician_summary_immutability();

-- No DELETE policy — records are retained for audit.
