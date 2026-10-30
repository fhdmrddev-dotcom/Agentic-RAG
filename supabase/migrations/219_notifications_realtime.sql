-- 219 — the waiting-on-you notice gets a Realtime HINT channel (Phase 301, NOTE-01 / NOTE-05; D-16,
-- D-17, D-33).
--
-- WHAT IT DOES
--   Adds public.notifications (migration 218) to the supabase_realtime publication, so a browser
--   subscribed with the filter recipient_id=eq.<uid> hears when one of its notices opens or closes.
--   That event is a HINT, never a source of truth: the client refetches GET /notifications on every
--   event and on every (re)connect, and never reads the payload (D-v2.5-03, D-17).
--
-- WHO RECEIVES WHAT
--   Realtime delivers row changes through RLS. 218's owner-only SELECT policy and its SELECT grant to
--   authenticated already decide who may receive a notice row: its recipient, and nobody else. anon
--   has no grant at all. This migration adds NO grant and NO policy.
--
-- NOTHING ELSE
--   * No REPLICA IDENTITY change. Supabase only needs FULL to filter DELETE events, notices are never
--     deleted by a client path, and the client ignores payloads anyway (do NOT copy 032's FULL line).
--   * No function, no trigger, no row written.
--
-- SCHEMA, NOT A SEED. Idempotent: the DO block swallows duplicate_object, so a re-run is a no-op.
-- scripts/full-schema-supplement.sql §4 carries the same line, because pg_dump of the public schema
-- does not emit publication membership (D-33).
--
-- LOCAL APPLY: paste into the Supabase SQL editor (or run it through the backend venv's asyncpg in one
--   transaction), never `supabase db push` / `supabase db reset`. Then
--   `bash scripts/regenerate-full-schema.sh` (no --reset).
-- CLOUD APPLY: an operator paste at deploy time, with per-action approval, followed by
--   get_advisors(security). Never from a phase executor.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  -- Already a member: a re-run is a no-op.
  NULL;
END $$;

-- VERIFY (read-only): expect one row reading PASS.
SELECT CASE
         WHEN EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime'
                         AND schemaname = 'public'
                         AND tablename = 'notifications')
         THEN 'PASS'
         ELSE 'FAIL'
       END AS migration_219_verify;
