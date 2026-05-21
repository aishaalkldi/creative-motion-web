-- ============================================================
-- Migration 001 — providers table
-- Run manually in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- providers stores the clinical user profile that extends auth.users.
-- One row per authenticated provider; id is a foreign key to auth.users.

create table if not exists public.providers (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  clinic_name text,
  email       text,
  role        text not null default 'provider',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at current automatically.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists providers_updated_at on public.providers;
create trigger providers_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────

alter table public.providers enable row level security;

-- A provider can read their own profile.
create policy "providers: select own row"
  on public.providers
  for select
  using (id = auth.uid());

-- A provider can update their own profile.
create policy "providers: update own row"
  on public.providers
  for update
  using (id = auth.uid());

-- A provider can insert their own row only (no spoofing other users).
create policy "providers: insert own row"
  on public.providers
  for insert
  with check (id = auth.uid());
