-- 074_view_typed_columns.sql — Phase 114 (VIEW-03 / R-114-B).
-- Promote the two HOT virtual-folder filter fields (`document_type`, `date`) from
-- `documents.metadata` jsonb to typed, btree-indexed GENERATED ALWAYS AS (...) STORED
-- columns so range/date/equality comparisons use an INDEX (SC#3, ~10k docs) instead
-- of a lexical JSONB seq scan. A STORED generated column is physically materialized,
-- so it AUTO-BACKFILLS every existing `documents` row the instant this migration runs
-- — no backfill job, no app dual-write, no row rewrite, no re-extraction (R-114-B).
--
-- Apply by pasting this whole file into the Supabase SQL editor (or psycopg2 to
-- local :54322 per the 100/099/101.1/102/110 precedent) — NEVER `supabase db push` /
-- `db reset` (preserves dev data); then `bash scripts/regenerate-full-schema.sh`
-- (no --reset), commit migration + regenerated full-schema.sql + the code edits
-- together. Plan 03 (operator, autonomous:false) applies it + regenerates.
-- This plan (114-01) ONLY AUTHORS the file — it is NOT applied here.
--
-- Adds NO RLS: it ADDS COLUMNS to the already-RLS'd `documents` table — no new table,
-- no new policy. (Contrast 071's 4-policies-per-table template — does NOT apply here.)
--
-- Immutability facts (load-bearing — a GENERATED expression may use ONLY immutable
-- functions, postgresql.org/docs ddl-generated-columns):
--   * lower(text)              — immutable.                ✅ valid in a generation expr.
--   * (text)::date             — STABLE (the text→date I/O cast is DateStyle-sensitive)
--                                — ❌ REJECTED by Postgres in a generation expr.
--   * to_date(text, fmt)       — STABLE.                   — ❌ REJECTED too.
--   * (text)::timestamptz      — NOT immutable (session timezone). ❌ rejected.
--   * make_date(int,int,int)   — IMMUTABLE.                ✅ the safe parse primitive.
-- => the `date` column parses via an IMMUTABLE plpgsql helper (`view_iso_to_date`)
--    that regex-guards the ISO shape, parses the y/m/d substrings via make_date, and
--    wraps the parse in an EXCEPTION block returning NULL on any bad value (R-114-B).
--    [VERIFIED at apply time on local PG 15 :54322 — Plan 03, Open Q2/Assumption A1:
--     the original `(metadata->>'date')::date` cast is rejected "generation expression
--     is not immutable"; this helper is the immutable, calendar-safe replacement.]
--
-- Wrapped in one BEGIN; ... COMMIT; so a partial failure rolls back atomically.

BEGIN;

-- ============================================================================
-- Section 1 — document_type → lowercased, indexed generated column
-- ----------------------------------------------------------------------------
-- `document_type` is ALREADY stored lowercase at every write path (ingest, manual
-- edit, extraction prompt) — the `lower()` here is belt-and-suspenders so the
-- typed column is case-insensitive by construction. The view resolve path matches
-- it with a LOWERCASED query value via `.eq` (indexed, exact) — never `ILIKE`,
-- which would defeat this index (Pitfall 3).
-- ============================================================================
ALTER TABLE public.documents
  ADD COLUMN document_type_norm text
  GENERATED ALWAYS AS (lower(metadata->>'document_type')) STORED;

-- ============================================================================
-- Section 2 — date → ISO-regex-guarded, calendar-safe, IMMUTABLE-parsed `date` column
-- ----------------------------------------------------------------------------
-- The guard is LOAD-BEARING (R-114-B): the extraction prompt is told to PREFER ISO
-- 8601 (YYYY-MM-DD) but that is NOT a guarantee. A stored value that does not match
-- `^\d{4}-\d{2}-\d{2}$` — OR that matches the shape but is calendar-invalid
-- (`2026-13-99`, `2026-02-31` — Pitfall 2) — yields NULL. It breaks neither this
-- ALTER (the auto-backfill of every existing row) nor any future insert.
--
-- WHY A HELPER FN (Open Q2 / Assumption A1, decided at apply time): the originally
-- authored `CASE ... (metadata->>'date')::date` is REJECTED by Postgres —
-- "generation expression is not immutable" — because the text→date I/O cast (and
-- to_date()) is STABLE (DateStyle-sensitive). A generation expression may use ONLY
-- immutable functions. `make_date(int,int,int)` IS immutable, but raises
-- DatetimeFieldOverflow on a calendar-invalid value (so it can't sit bare in the
-- expression either — a bad stored row would error the backfill). The fix: an
-- IMMUTABLE plpgsql helper that regex-guards the shape, parses via make_date, and
-- traps the overflow in an EXCEPTION block returning NULL. A function declared
-- IMMUTABLE is permitted in a generation expression. This is STRICTLY SAFER than the
-- original `::date` would have been — it also NULLs calendar-invalid dates that the
-- shape regex alone would have let through to a hard error.
-- ============================================================================

-- IMMUTABLE ISO-date parser: NULL on non-ISO shape AND on calendar-invalid values.
-- STRICT → NULL input short-circuits to NULL. The EXCEPTION block is the R-114-B
-- "never raises on a bad date" guarantee.
CREATE OR REPLACE FUNCTION public.view_iso_to_date(s text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $fn$
BEGIN
  IF s !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;  -- not ISO YYYY-MM-DD shape
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

ALTER TABLE public.documents
  ADD COLUMN date_typed date
  GENERATED ALWAYS AS (public.view_iso_to_date(metadata->>'date')) STORED;

-- ============================================================================
-- Section 3 — btree indexes on the two promoted columns (SC#3 index-use)
-- ----------------------------------------------------------------------------
-- Naming convention: idx_<table>_<col> USING btree (mirrors 071:179-191). STORED
-- generated columns are physically materialized → a standard btree applies.
-- ============================================================================
CREATE INDEX idx_documents_document_type_norm ON public.documents USING btree (document_type_norm);
CREATE INDEX idx_documents_date_typed         ON public.documents USING btree (date_typed);

COMMIT;

-- ============================================================================
-- Post-apply verification (Plan 03 — run after applying, before regenerate):
-- ----------------------------------------------------------------------------
--   SELECT count(*) FILTER (WHERE document_type_norm IS NOT NULL) AS typed_dt,
--          count(*) FILTER (WHERE date_typed IS NOT NULL)        AS typed_date,
--          count(*)                                              AS total
--   FROM public.documents;
--   -- Expect typed_dt ≈ rows with a document_type; typed_date ≈ rows with an ISO date.
--
--   EXPLAIN ANALYZE SELECT id FROM public.documents
--     WHERE user_id = '<caller>' AND is_latest = true AND document_type_norm = 'invoice';
--   -- Expect: Index Scan using idx_documents_document_type_norm (NOT Seq Scan) — at ~10k rows.
-- ============================================================================
