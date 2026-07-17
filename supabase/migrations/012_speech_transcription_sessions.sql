-- ============================================================
-- Migration 012 — speech_transcription_sessions (Speech AI S1)
--
-- Persists Speech AI transcription session metadata and transcript
-- text only. Raw audio is intentionally NOT stored — audio is
-- processed in memory on the server and discarded after STT.
--
-- Patient token path (source = patient_remote) writes are expected
-- through validated server routes using the service role after
-- remote_assessment_requests token checks — not via direct client
-- RLS insert for patient_remote rows.
--
-- FK delete behavior:
--   remote_request_id uses ON DELETE RESTRICT because patient_remote
--   rows require remote_request_id IS NOT NULL; SET NULL would violate
--   that CHECK when a parent request is deleted.
--
-- Prerequisites:
--   - 001_providers.sql
--   - 003_patients_provider_id.sql
--   - 004_assessments_add_columns.sql (assessments.provider_id)
--   - 006_remote_assessment_requests.sql
-- ============================================================

create table if not exists public.speech_transcription_sessions (
  id                uuid        primary key default gen_random_uuid(),
  provider_id       uuid        references public.providers(id) on delete restrict,
  patient_id        uuid        references public.patients(id) on delete set null,
  remote_request_id uuid        references public.remote_assessment_requests(id) on delete restrict,
  assessment_id     uuid        references public.assessments(id) on delete set null,
  source            text        not null,
  provider_name     text        not null,
  external_job_id   text,
  language_code     text        not null,
  status            text        not null default 'pending',
  transcript_text   text,
  duration_ms       integer,
  byte_size         integer,
  schema_version    text        not null,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,

  constraint speech_transcription_sessions_source_chk
    check (source in ('patient_remote', 'clinician_intake')),

  constraint speech_transcription_sessions_provider_name_chk
    check (provider_name in ('elevenlabs', 'assemblyai', 'browser')),

  constraint speech_transcription_sessions_status_chk
    check (status in ('pending', 'completed', 'failed')),

  constraint speech_transcription_sessions_duration_ms_chk
    check (duration_ms is null or duration_ms >= 0),

  constraint speech_transcription_sessions_byte_size_chk
    check (byte_size is null or byte_size >= 0),

  constraint speech_transcription_sessions_clinician_provider_chk
    check (source <> 'clinician_intake' or provider_id is not null),

  constraint speech_transcription_sessions_patient_remote_request_chk
    check (source <> 'patient_remote' or remote_request_id is not null),

  constraint speech_transcription_sessions_completed_fields_chk
    check (
      status <> 'completed'
      or (transcript_text is not null and completed_at is not null)
    ),

  constraint speech_transcription_sessions_pending_completed_at_chk
    check (status <> 'pending' or completed_at is null)
);

create index if not exists speech_transcription_sessions_provider_created_idx
  on public.speech_transcription_sessions (provider_id, created_at desc)
  where provider_id is not null;

create index if not exists speech_transcription_sessions_patient_created_idx
  on public.speech_transcription_sessions (patient_id, created_at desc)
  where patient_id is not null;

create unique index if not exists speech_transcription_sessions_provider_job_uidx
  on public.speech_transcription_sessions (provider_name, external_job_id)
  where external_job_id is not null;

-- AssemblyAI transcript IDs are stored as external_job_id (provider_name = assemblyai).
-- Unique per provider namespace; NULL allowed for browser and synchronous ElevenLabs paths.

create index if not exists speech_transcription_sessions_remote_request_idx
  on public.speech_transcription_sessions (remote_request_id)
  where remote_request_id is not null;

create index if not exists speech_transcription_sessions_assessment_idx
  on public.speech_transcription_sessions (assessment_id)
  where assessment_id is not null;

alter table public.speech_transcription_sessions enable row level security;

-- Clinician-facing reads: own clinician_intake rows only.
-- patient_remote rows are not exposed to authenticated clients.
create policy "speech_transcription_sessions: provider selects clinician_intake"
  on public.speech_transcription_sessions for select
  using (provider_id = auth.uid() and source = 'clinician_intake');

-- Clinician-facing inserts: clinician_intake rows owned by the caller only.
-- When patient_id or assessment_id are set, they must belong to auth.uid().
create policy "speech_transcription_sessions: provider inserts clinician_intake"
  on public.speech_transcription_sessions for insert
  with check (
    provider_id = auth.uid()
    and source = 'clinician_intake'
    and (
      patient_id is null
      or exists (
        select 1
        from public.patients p
        where p.id = patient_id
          and p.provider_id = auth.uid()
      )
    )
    and (
      assessment_id is null
      or exists (
        select 1
        from public.assessments a
        where a.id = assessment_id
          and a.provider_id = auth.uid()
          and (patient_id is null or a.patient_id = patient_id)
      )
    )
  );

-- No UPDATE or DELETE policies in S1 — append-only audit trail for now.
-- patient_remote inserts/reads use service role from validated server routes.
