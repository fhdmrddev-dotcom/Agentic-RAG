-- Phase 241 (QUEUE-06 / D-09 / D-12): the two HNSW search knobs are SETTINGS, not constants.
-- Apply via Supabase SQL editor — NEVER db push / db reset (CLAUDE.md).
--
-- ⚠ WHY THIS EXISTS — the collapse mechanism, measured live on 2026-09-10, not reasoned about:
--
--       hnsw.ef_search = 40      hnsw.iterative_scan = off      pgvector 0.8.0 / PG 17.6
--       hybrid_candidate_count = 20                             (backend/app/config.py)
--
--   `match_document_chunks` (migration 154:148-174) applies SEVEN predicates INSIDE the
--   `ORDER BY … <=> … LIMIT` scan — the org gate, the three-arm visibility predicate, the
--   similarity threshold, `is_latest`, `metadata @>`, `p_folder_ids` and `p_embedding_model`.
--   So the index walks 40 GLOBAL candidates, discards with seven predicates, and only then
--   takes 20. There is no unfiltered path in this product (241-CONTEXT D-05), and the collapse
--   is driven by SELECTIVITY: a tenant owning 0.2% of the corpus starves ef_search = 40 exactly
--   as one owning 0.2% of a corpus a hundred times larger does.
--
-- ⭐ WHY A SETTING RATHER THAN A CONSTANT. A migration-baked `SET hnsw.ef_search` inside
--   `match_document_chunks` would need ZERO Python — and could never be changed from the UI,
--   which is exactly what the operator asked for ("we should again have this configuration
--   allowed in the UI somehow with a minimal configuration in the hard coded values").
--   CLAUDE.md's standing rule says the same thing structurally: settings live in
--   `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra.
--   The cost is a small landing on `retrieval_service.py`, a G-5 hot file, and D-11 takes that
--   trade deliberately.
--
-- ⛔ TWO COLUMNS, AND THERE MUST NEVER BE A THIRD OR FOURTH. pgvector also exposes
--   `hnsw.max_scan_tuples` (20000) and `hnsw.scan_mem_multiplier` (1), which matter only once
--   iterative scan is ON. They stay MINIMAL HARDCODED DEFAULTS in `backend/app/config.py`
--   (D-09): a wrong value there is a MEMORY FOOTGUN, not a tuning choice with a safe bounded
--   control, and no request field or column may reach them (threat T-241-16).
--
-- ⛔ app_settings, NOT user_settings. `SET LOCAL hnsw.ef_search` costs work on a SHARED
--   Postgres for every search a user runs. A per-user dial on the database's own scan budget is
--   not a setting, it is a dial on the attack. app_settings is the global singleton with RLS
--   DISABLED — verified rather than assumed: no `app_settings ENABLE ROW LEVEL SECURITY` exists
--   anywhere under supabase/, so the table has never had RLS and this migration adds COLUMNS to
--   it. No new table, therefore NO NEW RLS SURFACE (threat T-241-18).
--
-- ⚠ NUMBER 176. Reserved for this phase by the ROADMAP; supabase/migrations/ ends at
--   175_documents_thread_key.sql. Numbers are monotonic and gaps are NEVER backfilled. The
--   filename matches `<digits>_name.sql` — a letter suffix like `176b` is SILENTLY SKIPPED by
--   the Supabase CLI.
--
-- ⚠ NOT APPLIED BY THE AUTHORING AGENT. Until an operator pastes this, both columns are absent,
--   `_val(row, "hnsw_ef_search", "hnsw_ef_search", 40)` reads config.py's 40 and
--   `hnsw_iterative_scan` reads "off" — which IS the live server configuration above. So the
--   authored-but-not-applied state changes NOTHING about any search, exactly as migration 174
--   was fail-soft before it was pasted. 241-04 carries the operator checkpoint and the
--   `bash scripts/regenerate-full-schema.sh` step that follows it.
--
-- ⚠ THE CHECK BELOW IS THE BACKSTOP, NOT THE LOAD-BEARING ARM — and that ordering is the
--   opposite of what it looks like. `BUG-260909-01` records that `save_app_settings` SWALLOWS a
--   CHECK violation and returns as if the write succeeded. The refusal that an operator
--   actually sees is the worded HTTP 400 in `backend/app/api/settings.py`, which states what a
--   bigger search breadth COSTS. This CHECK catches a hand-edit made in this very SQL editor.
--
--   * hnsw_ef_search 10..1000 — 1000 is pgvector's own maximum for this GUC; 10 sits BELOW the
--     server default of 40 so a deliberately smaller (faster, shallower) value stays reachable
--     and measurable. 0 would mean a scan that walks nothing.
--   * hnsw_iterative_scan is a THREE-member enum. `strict_order` and `relaxed_order` are
--     genuinely different modes; a boolean column would silently lose one of them.
--   * NULL MUST STAY LEGAL ON BOTH. NULL is what makes `_val` fall through to the config.py
--     default, and it is the state every existing row is in the moment this runs.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS hnsw_ef_search integer;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS hnsw_iterative_scan text;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_hnsw_ef_search_bounds;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_hnsw_ef_search_bounds
  CHECK (hnsw_ef_search IS NULL
         OR (hnsw_ef_search >= 10 AND hnsw_ef_search <= 1000));

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_hnsw_iterative_scan_values;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_hnsw_iterative_scan_values
  CHECK (hnsw_iterative_scan IS NULL
         OR hnsw_iterative_scan IN ('off', 'strict_order', 'relaxed_order'));

COMMENT ON COLUMN public.app_settings.hnsw_ef_search IS
  'Phase 241 / SEED-076. How many candidate vectors the HNSW index walks before the search''s '
  'filters are applied — pgvector''s hnsw.ef_search, applied per request with SET LOCAL inside '
  'the transaction get_user_pg_connection already opens (so it auto-reverts at COMMIT and can '
  'never leak to the next borrower of the pooled connection). The shipped server default is 40; '
  'every search in this product is a FILTERED search, so 40 global candidates can collapse to '
  'far fewer surviving rows for a tenant that owns a small share of the corpus. Bounded '
  '10..1000: 1000 is pgvector''s own maximum and 10 is below the server default so a smaller, '
  'faster value stays reachable. Raising it walks more vectors per query — slower searches and '
  'more memory. NULL reads as config.py''s 40.';

COMMENT ON COLUMN public.app_settings.hnsw_iterative_scan IS
  'Phase 241 / SEED-076. pgvector''s hnsw.iterative_scan: off | strict_order | relaxed_order. '
  'When on, the index KEEPS scanning until enough rows survive the query''s filters instead of '
  'returning a short list — the direct remedy for filtered-search under-fill. THREE values, not '
  'a boolean: strict_order preserves exact distance ordering, relaxed_order trades ordering for '
  'speed, and a boolean column would silently lose one of them. ⚠ This GUC DOES NOT EXIST below '
  'pgvector 0.8, so the application applies it in its own try and degrades the TUNING, never the '
  'SEARCH, on an older server. Its two memory companions (hnsw.max_scan_tuples, '
  'hnsw.scan_mem_multiplier) are deliberately NOT settings — they are hardcoded in config.py '
  'because a wrong value there is a memory footgun. NULL reads as config.py''s ''off''.';
