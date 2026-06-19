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
--   * lower(text)        — immutable.            ✅ valid in a generation expression.
--   * (text)::date       — immutable (no session-timezone dependency). ✅ valid.
--   * (text)::timestamptz — NOT immutable (reads session timezone).     ❌ rejected.
-- => the `date` column casts to `date`, NEVER `timestamptz`.
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
-- Section 2 — date → ISO-regex-guarded typed `date` column
-- ----------------------------------------------------------------------------
-- The CASE guard is LOAD-BEARING (R-114-B): the extraction prompt is told to PREFER
-- ISO 8601 (YYYY-MM-DD) but that is NOT a guarantee. A stored value that does not
-- match `^\d{4}-\d{2}-\d{2}$` yields NULL — it breaks neither this ALTER (the
-- auto-backfill of every existing row) nor any future insert. The cast is `::date`
-- (immutable), never `::timestamptz` (stable → rejected in a generation expr).
--
-- NOTE (Pitfall 2): the regex validates SHAPE, not calendar validity — a value like
-- `2026-13-99` passes the regex but would still fail `::date`. Plan 03's bad-date
-- dataset test (run against the FULL dataset on :54322) is the gate that proves no
-- regex-passing-but-invalid date exists before this ships; if one is found, the
-- regex is tightened (e.g. month `0[1-9]|1[0-2]`) per Open Q2.
-- ============================================================================
ALTER TABLE public.documents
  ADD COLUMN date_typed date
  GENERATED ALWAYS AS (
    CASE
      WHEN metadata->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (metadata->>'date')::date
      ELSE NULL
    END
  ) STORED;

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
