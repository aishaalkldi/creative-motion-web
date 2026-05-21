-- ============================================================
-- Migration 002 — treatment_plans, plan_sessions, session_logs,
--                 patient_access_tokens
--
-- Run manually in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql/new
--
-- Prerequisites (all already applied):
--   - 001_providers.sql   → public.providers
--   - schema.sql          → public.patients, public.assessments
--   - public.set_updated_at() function exists
-- ============================================================


-- ============================================================
-- TABLE 1: treatment_plans
-- One plan per patient per provider. assessment_id is optional
-- (a plan can exist without a formal assessment).
-- ============================================================

create table if not exists public.treatment_plans (
  id              uuid        primary key default gen_random_uuid(),
  provider_id     uuid        not null references public.providers(id)    on delete restrict,
  patient_id      uuid        not null references public.patients(id)     on delete cascade,
  assessment_id   uuid                    references public.assessments(id) on delete set null,

  title           text        not null,
  diagnosis       text,
  phase           integer     not null default 1,
  total_weeks     integer     not null default 6,
  current_week    integer     not null default 1,
  status          text        not null default 'active',
  clinician_note  text,

  -- Full structured plan object from the plan builder (replaces localStorage rasq_plans).
  -- Allows backward-compatible schema evolution without ALTER TABLE.
  structured_data jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint treatment_plans_status_chk
    check (status in ('active', 'completed', 'paused', 'cancelled')),
  constraint treatment_plans_phase_chk
    check (phase >= 1),
  constraint treatment_plans_weeks_chk
    check (total_weeks >= 1 and current_week >= 1 and current_week <= total_weeks + 1)
);

drop trigger if exists treatment_plans_updated_at on public.treatment_plans;
create trigger treatment_plans_updated_at
  before update on public.treatment_plans
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists treatment_plans_provider_idx
  on public.treatment_plans (provider_id);

create index if not exists treatment_plans_patient_status_idx
  on public.treatment_plans (patient_id, status);

create index if not exists treatment_plans_created_at_idx
  on public.treatment_plans (created_at desc);

-- RLS
alter table public.treatment_plans enable row level security;

create policy "treatment_plans: provider selects own"
  on public.treatment_plans for select
  using (provider_id = auth.uid());

create policy "treatment_plans: provider inserts own"
  on public.treatment_plans for insert
  with check (provider_id = auth.uid());

create policy "treatment_plans: provider updates own"
  on public.treatment_plans for update
  using (provider_id = auth.uid());

create policy "treatment_plans: provider deletes own"
  on public.treatment_plans for delete
  using (provider_id = auth.uid());


-- ============================================================
-- TABLE 2: plan_sessions
-- Ordered exercise sessions within a treatment plan.
-- provider_id and patient_id are denormalised for efficient
-- RLS evaluation without a join through treatment_plans.
-- ============================================================

create table if not exists public.plan_sessions (
  id             uuid        primary key default gen_random_uuid(),
  plan_id        uuid        not null references public.treatment_plans(id) on delete cascade,
  provider_id    uuid        not null references public.providers(id)       on delete restrict,
  patient_id     uuid        not null references public.patients(id)        on delete cascade,

  session_number integer     not null,
  title          text        not null,
  description    text,
  exercises      jsonb       not null default '[]',

  status         text        not null default 'upcoming',
  scheduled_at   timestamptz,
  completed_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint plan_sessions_status_chk
    check (status in ('upcoming', 'today', 'completed', 'skipped')),
  constraint plan_sessions_number_chk
    check (session_number >= 1),
  -- Within one plan, session numbers must be unique
  unique (plan_id, session_number)
);

drop trigger if exists plan_sessions_updated_at on public.plan_sessions;
create trigger plan_sessions_updated_at
  before update on public.plan_sessions
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists plan_sessions_plan_order_idx
  on public.plan_sessions (plan_id, session_number asc);

create index if not exists plan_sessions_patient_idx
  on public.plan_sessions (patient_id);

create index if not exists plan_sessions_provider_idx
  on public.plan_sessions (provider_id);

create index if not exists plan_sessions_status_idx
  on public.plan_sessions (status);

-- RLS
alter table public.plan_sessions enable row level security;

create policy "plan_sessions: provider selects own"
  on public.plan_sessions for select
  using (provider_id = auth.uid());

create policy "plan_sessions: provider inserts own"
  on public.plan_sessions for insert
  with check (provider_id = auth.uid());

create policy "plan_sessions: provider updates own"
  on public.plan_sessions for update
  using (provider_id = auth.uid());

create policy "plan_sessions: provider deletes own"
  on public.plan_sessions for delete
  using (provider_id = auth.uid());


-- ============================================================
-- TABLE 3: session_logs
-- Immutable completion records written by the patient portal
-- (server-side, via service role key — no public insert policy).
-- Providers can read logs for plans they own.
-- ============================================================

create table if not exists public.session_logs (
  id                   uuid        primary key default gen_random_uuid(),
  plan_id              uuid        not null references public.treatment_plans(id) on delete cascade,
  plan_session_id      uuid                    references public.plan_sessions(id) on delete set null,
  provider_id          uuid        not null references public.providers(id)        on delete restrict,
  patient_id           uuid        not null references public.patients(id)         on delete cascade,

  -- Denormalised token string for correlation with patient portal events
  -- (avoids a join through patient_access_tokens on every log read).
  patient_token        text        not null,

  effort_score         integer,
  exercises_completed  integer     not null default 0,
  pain_score           integer,
  notes                text,

  -- completed_at is set by the client; created_at is the server insert time.
  completed_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),

  constraint session_logs_effort_chk
    check (effort_score is null or (effort_score between 1 and 10)),
  constraint session_logs_pain_chk
    check (pain_score is null or (pain_score between 0 and 10)),
  constraint session_logs_exercises_chk
    check (exercises_completed >= 0)
);

-- No updated_at — session logs are append-only records.
-- No public insert policy — insertion goes through service role only.

-- Indexes
create index if not exists session_logs_plan_idx
  on public.session_logs (plan_id);

create index if not exists session_logs_patient_idx
  on public.session_logs (patient_id);

create index if not exists session_logs_token_completed_idx
  on public.session_logs (patient_token, completed_at desc);

create index if not exists session_logs_session_idx
  on public.session_logs (plan_session_id);

-- RLS
alter table public.session_logs enable row level security;

-- Providers can read logs for their own patients directly.
create policy "session_logs: provider reads own patient logs"
  on public.session_logs for select
  using (provider_id = auth.uid());

-- No INSERT policy for authenticated users.
-- No UPDATE policy — logs are immutable.
-- No DELETE policy — logs are immutable.
-- Service role bypasses RLS for server-side writes.


-- ============================================================
-- TABLE 4: patient_access_tokens
-- Token-gated patient portal access. Each row links one token
-- string to one plan. Token validation uses service role from
-- a Next.js API route — no anon SELECT policy exposed.
-- ============================================================

create table if not exists public.patient_access_tokens (
  id           uuid        primary key default gen_random_uuid(),
  token        text        not null unique,
  plan_id      uuid        not null references public.treatment_plans(id) on delete cascade,
  patient_id   uuid        not null references public.patients(id)        on delete cascade,
  provider_id  uuid        not null references public.providers(id)       on delete restrict,

  -- Denormalised display name so the portal can greet the patient
  -- without fetching the patients table directly.
  patient_name text        not null,

  is_active    boolean     not null default true,
  expires_at   timestamptz,                    -- null = never expires

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists patient_access_tokens_updated_at on public.patient_access_tokens;
create trigger patient_access_tokens_updated_at
  before update on public.patient_access_tokens
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists patient_access_tokens_token_idx
  on public.patient_access_tokens (token);           -- unique already, but explicit for planner

create index if not exists patient_access_tokens_patient_idx
  on public.patient_access_tokens (patient_id);

create index if not exists patient_access_tokens_provider_idx
  on public.patient_access_tokens (provider_id);

create index if not exists patient_access_tokens_plan_idx
  on public.patient_access_tokens (plan_id);

-- RLS
alter table public.patient_access_tokens enable row level security;

-- Providers can manage tokens for their own plans.
create policy "patient_access_tokens: provider selects own"
  on public.patient_access_tokens for select
  using (provider_id = auth.uid());

create policy "patient_access_tokens: provider inserts own"
  on public.patient_access_tokens for insert
  with check (provider_id = auth.uid());

create policy "patient_access_tokens: provider updates own"
  on public.patient_access_tokens for update
  using (provider_id = auth.uid());

create policy "patient_access_tokens: provider deletes own"
  on public.patient_access_tokens for delete
  using (provider_id = auth.uid());

-- No anon or public insert policy.
-- Token validation (patient portal) uses service role from server-side API route.
