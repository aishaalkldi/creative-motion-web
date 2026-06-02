-- ============================================================
-- Migration 009 — cv_session_metrics.motion_quality (JSONB)
--
-- Assistive / pilot motion evidence only. No video, landmarks, or scores.
-- Run manually in Supabase SQL Editor after 008_cv_session_metrics.sql.
-- ============================================================

alter table public.cv_session_metrics
  add column if not exists motion_quality jsonb;

comment on column public.cv_session_metrics.motion_quality is
  'Assistive motion evidence JSON (e.g. smtPilot). Not clinical quality scoring.';
