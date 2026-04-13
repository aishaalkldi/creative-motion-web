-- Creative Motion Lab (future Supabase/Postgres) schema
-- This file defines the production-minded MVP database tables.
-- No app integration is performed here.

-- Enable UUID generation (choose one extension depending on Postgres environment).
-- Supabase typically supports `pgcrypto`.
create extension if not exists pgcrypto;

-- Patients
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  age integer,
  gender text,
  diagnosis text,
  sport text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_created_at_idx on public.patients (created_at);

-- Assessments (one row per session; result fields remain embedded)
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,

  mode text not null,
  selected_tests text[] not null default '{}',
  status text not null default 'draft',

  score numeric(5,2),
  summary text,
  metrics jsonb,

  body_region text,
  side text,
  visit_type text,
  session_label text,
  duration_seconds integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint assessments_mode_chk check (mode in ('remote', 'in_clinic')),
  constraint assessments_status_chk check (status in ('draft', 'completed'))
);

create index if not exists assessments_patient_created_at_idx
  on public.assessments (patient_id, created_at desc);
create index if not exists assessments_status_idx on public.assessments (status);
create index if not exists assessments_mode_idx on public.assessments (mode);
create index if not exists assessments_metrics_gin_idx on public.assessments using gin (metrics);

