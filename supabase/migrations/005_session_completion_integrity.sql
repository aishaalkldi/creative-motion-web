-- Migration 005 — session completion integrity
--
-- Run manually in Supabase SQL Editor after reviewing duplicates:
--   https://supabase.com/dashboard/project/_/sql/new
--
-- Pre-flight (inspect only — does not change data):
--   SELECT plan_session_id, COUNT(*) AS cnt
--   FROM public.session_logs
--   WHERE plan_session_id IS NOT NULL
--   GROUP BY plan_session_id
--   HAVING COUNT(*) > 1;
--
-- If any rows are returned, dedupe before applying this migration.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.session_logs
    WHERE plan_session_id IS NOT NULL
    GROUP BY plan_session_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migration 005 blocked: duplicate session_logs rows exist for the same plan_session_id. '
      'Run the pre-flight query above, dedupe manually, then re-apply.';
  END IF;
END $$;

-- One completion log per plan session (append-only; no updates/deletes).
-- Partial index: multiple NULL plan_session_id rows remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS session_logs_plan_session_id_unique
  ON public.session_logs (plan_session_id)
  WHERE plan_session_id IS NOT NULL;
