-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Add clinical columns to public.assessments
--
-- The assessments table already exists (created by the Supabase project) with:
--   id, patient_id, status, created_at, updated_at, selected_tests, mode
--
-- This migration adds:
--   provider_id     — direct ownership column (FK → providers.id RESTRICT)
--   type            — assessment category (default 'structured')
--   structured_data — full AssessmentData object as jsonb
--   notes           — free-text clinical notes shortcut
--
-- Apply via Supabase Dashboard → SQL Editor, or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add missing columns (idempotent)
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS provider_id     uuid REFERENCES public.providers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS type            text NOT NULL DEFAULT 'structured',
  ADD COLUMN IF NOT EXISTS structured_data jsonb,
  ADD COLUMN IF NOT EXISTS notes           text;

-- 2. Index for fast provider + patient queries
CREATE INDEX IF NOT EXISTS assessments_provider_id_idx  ON public.assessments(provider_id);
CREATE INDEX IF NOT EXISTS assessments_patient_idx       ON public.assessments(patient_id, created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- 4. Drop any stale policies before recreating
DROP POLICY IF EXISTS "providers_select_own_assessments"  ON public.assessments;
DROP POLICY IF EXISTS "providers_insert_own_assessments"  ON public.assessments;
DROP POLICY IF EXISTS "providers_update_own_assessments"  ON public.assessments;
DROP POLICY IF EXISTS "providers_delete_own_assessments"  ON public.assessments;

-- 5. Provider can only access their own assessments
CREATE POLICY "providers_select_own_assessments"
  ON public.assessments FOR SELECT
  USING (provider_id = auth.uid());

CREATE POLICY "providers_insert_own_assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "providers_update_own_assessments"
  ON public.assessments FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "providers_delete_own_assessments"
  ON public.assessments FOR DELETE
  USING (provider_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run after applying to confirm success):
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'assessments'
-- ORDER BY ordinal_position;
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'assessments';
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'assessments';
-- ─────────────────────────────────────────────────────────────────────────────
