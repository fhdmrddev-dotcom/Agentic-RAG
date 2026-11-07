-- 226_email_dates_typed.sql — BUG-261106-04 (tester report BUG-31): emails were invisible to
-- every date filter.
--
-- documents.date_typed is GENERATED ALWAYS AS (public.view_iso_to_date(metadata->>'date')) STORED
-- (migration 074). view_iso_to_date accepted ONLY an exact 'YYYY-MM-DD'. The email extractor
-- stores the full RFC 3339 send time ('2025-12-15T09:12:00+04:00'), so every uploaded or
-- connected email got date_typed = NULL and counted as "undated": "what did HR announce in
-- December 2025?" matched nothing (production, HR-22, 2026-11-06). Measured on production the
-- same day: 116 of 180 dated documents carried a time and none of them were typed.
--
-- 1. The function also accepts a value that BEGINS with 'YYYY-MM-DD' followed by 'T' or a space.
--    It returns the date AS WRITTEN, before any offset: '2025-12-15T23:30:00+04:00' is the 15th,
--    the sender's own calendar day, never shifted to UTC. Everything 074 accepted or refused is
--    unchanged; a calendar-invalid date still returns NULL and never raises.
-- 2. A STORED generated column is only recomputed when its row is written, so the rows whose
--    value now parses are rewritten in place (metadata = metadata). No trigger on documents fires
--    for a metadata-only UPDATE (every UPDATE trigger names other columns), so nothing re-ingests,
--    re-embeds or emits a webhook.
--
-- Idempotent: re-running replaces the function with itself and finds no untyped row to rewrite.

CREATE OR REPLACE FUNCTION public.view_iso_to_date(s text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $fn$
BEGIN
  IF s !~ '^\d{4}-\d{2}-\d{2}([T ].*)?$' THEN
    RETURN NULL;  -- not 'YYYY-MM-DD', optionally followed by a time
  END IF;
  RETURN make_date(
    substring(s FROM 1 FOR 4)::int,   -- year
    substring(s FROM 6 FOR 2)::int,   -- month
    substring(s FROM 9 FOR 2)::int    -- day
  );
EXCEPTION WHEN others THEN
  RETURN NULL;  -- calendar-invalid (2026-13-99 / 2026-02-31) → NULL, never raises
END;
$fn$;

UPDATE public.documents
   SET metadata = metadata
 WHERE metadata->>'date' ~ '^\d{4}-\d{2}-\d{2}[T ]'
   AND date_typed IS NULL;
