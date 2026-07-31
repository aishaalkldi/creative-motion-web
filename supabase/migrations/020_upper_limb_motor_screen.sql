-- ============================================================
-- Migration 020 — Upper-Limb Motor Screen persistence
--
-- Assignment, session-result, and clinician-review tables for
-- the Motor Screen vertical slice. Patient token lookup uses
-- service role from Next.js API routes — no anon SELECT policy.
--
-- Token expiration matches remote_assessment_requests (7 days).
-- Raw patient-access tokens are never stored — only SHA-256 hash.
--
-- Prerequisites:
--   001_providers.sql, 002_core_tables.sql, 003_patients_provider_id.sql
-- ============================================================


-- ============================================================
-- TABLE 1: upper_limb_motor_screen_assignments
-- ============================================================

create table if not exists public.upper_limb_motor_screen_assignments (
  id                    uuid        primary key default gen_random_uuid(),
  patient_id            uuid        not null references public.patients(id)     on delete cascade,
  provider_id           uuid        not null references public.providers(id)    on delete restrict,
  screen_definition_id  text        not null,
  status                text        not null,
  assigned_at           timestamptz not null,
  affected_side         text        not null,
  delivery_mode         text        not null,
  assignment_payload    jsonb       not null,
  token_hash            text        not null unique,
  token_expires_at      timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint ulms_assignments_status_chk
    check (status in ('assigned', 'started', 'completed', 'cancelled')),
  constraint ulms_assignments_affected_side_chk
    check (affected_side in ('left', 'right')),
  constraint ulms_assignments_delivery_mode_chk
    check (delivery_mode in ('in_clinic', 'remote_supervised'))
);

drop trigger if exists upper_limb_motor_screen_assignments_updated_at
  on public.upper_limb_motor_screen_assignments;
create trigger upper_limb_motor_screen_assignments_updated_at
  before update on public.upper_limb_motor_screen_assignments
  for each row execute function public.set_updated_at();

create index if not exists ulms_assignments_patient_idx
  on public.upper_limb_motor_screen_assignments (patient_id);

create index if not exists ulms_assignments_provider_idx
  on public.upper_limb_motor_screen_assignments (provider_id);

create index if not exists ulms_assignments_active_token_idx
  on public.upper_limb_motor_screen_assignments (token_hash)
  where status in ('assigned', 'started');

alter table public.upper_limb_motor_screen_assignments enable row level security;

create policy "ulms_assignments: provider selects own"
  on public.upper_limb_motor_screen_assignments for select
  using (provider_id = auth.uid());

create policy "ulms_assignments: provider inserts own"
  on public.upper_limb_motor_screen_assignments for insert
  with check (provider_id = auth.uid());

create policy "ulms_assignments: provider updates own"
  on public.upper_limb_motor_screen_assignments for update
  using (provider_id = auth.uid());


-- ============================================================
-- TABLE 2: upper_limb_motor_screen_session_results
-- Stores validated UpperLimbMotorScreenSessionResult JSON only.
-- Attempt completion states (completed, incomplete, interrupted,
-- stopped, not_assessable, not_started) live inside session_result.
-- No raw frames, landmarks, coordinates, video, or trajectories.
-- ============================================================

create table if not exists public.upper_limb_motor_screen_session_results (
  id              uuid        primary key default gen_random_uuid(),
  assignment_id   uuid        not null references public.upper_limb_motor_screen_assignments(id) on delete cascade,
  result_status   text        not null,
  session_result  jsonb       not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint ulms_session_results_status_chk
    check (result_status in ('computed', 'finalized'))
);

drop trigger if exists upper_limb_motor_screen_session_results_updated_at
  on public.upper_limb_motor_screen_session_results;
create trigger upper_limb_motor_screen_session_results_updated_at
  before update on public.upper_limb_motor_screen_session_results
  for each row execute function public.set_updated_at();

create index if not exists ulms_session_results_assignment_idx
  on public.upper_limb_motor_screen_session_results (assignment_id);

alter table public.upper_limb_motor_screen_session_results enable row level security;

create policy "ulms_session_results: provider selects own"
  on public.upper_limb_motor_screen_session_results for select
  using (
    exists (
      select 1
      from public.upper_limb_motor_screen_assignments a
      where a.id = assignment_id
        and a.provider_id = auth.uid()
    )
  );

create policy "ulms_session_results: provider inserts own"
  on public.upper_limb_motor_screen_session_results for insert
  with check (
    exists (
      select 1
      from public.upper_limb_motor_screen_assignments a
      where a.id = assignment_id
        and a.provider_id = auth.uid()
    )
  );

create policy "ulms_session_results: provider updates own"
  on public.upper_limb_motor_screen_session_results for update
  using (
    exists (
      select 1
      from public.upper_limb_motor_screen_assignments a
      where a.id = assignment_id
        and a.provider_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE 3: upper_limb_motor_screen_clinician_reviews
-- Separate from session results — no auto-generated diagnosis,
-- severity, clearance, or treatment decisions.
-- ============================================================

create table if not exists public.upper_limb_motor_screen_clinician_reviews (
  id                uuid        primary key default gen_random_uuid(),
  session_result_id uuid        not null references public.upper_limb_motor_screen_session_results(id) on delete cascade,
  review_status     text        not null,
  reviewed_by       uuid                    references public.providers(id) on delete set null,
  reviewed_at       timestamptz,
  review_outcome    text,
  review_payload    jsonb       not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint ulms_clinician_reviews_status_chk
    check (review_status in ('pending', 'reviewed')),
  constraint ulms_clinician_reviews_outcome_chk
    check (
      review_outcome is null
      or review_outcome in (
        'approved',
        'approved_with_limitations',
        'rejected',
        'insufficient_data'
      )
    ),
  constraint ulms_clinician_reviews_pending_fields_chk
    check (
      (
        review_status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
        and review_outcome is null
      )
      or (
        review_status = 'reviewed'
        and reviewed_by is not null
        and reviewed_at is not null
        and review_outcome is not null
      )
    ),
  constraint ulms_clinician_reviews_session_result_unique
    unique (session_result_id)
);

drop trigger if exists upper_limb_motor_screen_clinician_reviews_updated_at
  on public.upper_limb_motor_screen_clinician_reviews;
create trigger upper_limb_motor_screen_clinician_reviews_updated_at
  before update on public.upper_limb_motor_screen_clinician_reviews
  for each row execute function public.set_updated_at();

alter table public.upper_limb_motor_screen_clinician_reviews enable row level security;

create policy "ulms_clinician_reviews: provider selects own"
  on public.upper_limb_motor_screen_clinician_reviews for select
  using (
    exists (
      select 1
      from public.upper_limb_motor_screen_session_results sr
      join public.upper_limb_motor_screen_assignments a on a.id = sr.assignment_id
      where sr.id = session_result_id
        and a.provider_id = auth.uid()
    )
  );

create policy "ulms_clinician_reviews: provider inserts own"
  on public.upper_limb_motor_screen_clinician_reviews for insert
  with check (
    exists (
      select 1
      from public.upper_limb_motor_screen_session_results sr
      join public.upper_limb_motor_screen_assignments a on a.id = sr.assignment_id
      where sr.id = session_result_id
        and a.provider_id = auth.uid()
    )
  );

create policy "ulms_clinician_reviews: provider updates own"
  on public.upper_limb_motor_screen_clinician_reviews for update
  using (
    exists (
      select 1
      from public.upper_limb_motor_screen_session_results sr
      join public.upper_limb_motor_screen_assignments a on a.id = sr.assignment_id
      where sr.id = session_result_id
        and a.provider_id = auth.uid()
    )
  );
