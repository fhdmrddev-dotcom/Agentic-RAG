-- 178_app_settings_vision_calls_bound.sql
-- Phase 242 (SHIP-01, ROADMAP SC#3, D-242-01) — a bound that lives only in Python is not a bound.
--
-- ⛔ WHAT WENT WRONG, AND WHY NO GATE SAW IT.
--
--   `app_settings.multimodal_max_vision_calls` has been bounded 1..1000 at
--   `backend/app/api/settings.py:467` since SEED-227, and by NOTHING else. Migration 044 added the
--   column with `DEFAULT 100` and no CHECK. So any writer that is not that one endpoint — a psql
--   session, a restored dump, a hand-edit in this very SQL editor — could store a value the API
--   would then refuse to accept back.
--
--   That is not hypothetical. The operator's local install held `1001`, and because
--   `SettingsPage.tsx` sends all 22 Search fields on every save, ONE stored out-of-range value
--   refused the ENTIRE tab — the reranker, the embedding model, the retrieval threshold, `rrf_k`,
--   and the two HNSW knobs Phase 246's whole remedy is delivered on. The operator saw "Images read
--   per document must be between 1 and 1000" while editing a threshold they had every right to
--   change, on a value they never typed.
--
-- ── WHAT THIS MIGRATION DOES ─────────────────────────────────────────────────────────────────
--
--   1. CLAMPS any out-of-range row into range — `least(greatest(col, lo), hi)`.
--   2. Adds the CHECK constraint, in the shape migrations 174 and 176 already established.
--
--   ⚠ THE ORDER IS LOAD-BEARING, NOT STYLISTIC. A CHECK cannot be added while a row violates it,
--     so the value must move first.
--
--   ⚠ THE CLAMP IS GENERALISED AND IS NOT KEYED TO THE `1001` WE HAPPENED TO SEE. Local held
--     1000 (already repaired by hand); cloud holds 100. This repairs WHATEVER is out of range, in
--     ANY environment, and is a no-op on an in-range row.
--
--   ⚠ RE-RUNNABLE. `DROP CONSTRAINT IF EXISTS` precedes every `ADD CONSTRAINT`, and the clamps are
--     no-ops the second time. Running this file twice produces an identical database — asserted by
--     `scripts/apply_migration_178.py`, which applies it twice in one run and diffs.
--
--   ⛔ REJECTED — reset the bad row to the column default (100): it silently makes every ingestion
--      read 10× fewer images than the operator asked for, and nothing announces it. That is the
--      same class of fault as the bug being fixed (D-242-01).
--   ⛔ REJECTED — fail the migration on an out-of-range row: honest, but blocks every environment
--      on manual work for a value we can repair correctly and announce in the phase record.
--
-- ── WHY TWO COLUMNS AND NOT ONE ──────────────────────────────────────────────────────────────
--
--   `242-CONTEXT.md` deferred "a CHECK on every other bounded settings column" as "a phase, not a
--   gap", naming five columns. MEASURED at HEAD against `pg_constraint` on the live local database:
--   THREE of the five already had one —
--
--       app_settings_source_max_file_size_mb_bounds      (migration 174)
--       app_settings_hnsw_ef_search_bounds               (migration 176)
--       app_settings_hnsw_iterative_scan_values          (migration 176)
--
--   — so the real gap was TWO columns, and the deferral was sized against a number that was wrong.
--   `vision_max_pages` is six lines in the identical pattern with no design work left to defer, and
--   ROADMAP SC#3 asks for "the general fix, not the specific one". Closing both makes
--   `backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py`'s allow-list EMPTY —
--   a fence with no exceptions, which is the only state in which such a fence certifies anything.
--
--   ⚠ What is genuinely still open is a DIFFERENT finding, and it is in SEED-271 rather than here:
--     `retrieval_top_k` and `rrf_k` have no bound in Python either (`settings.py:535-541` — a bare
--     `is not None`). They are not bounded-without-a-CHECK; they are UNVALIDATED.
--
-- ── NULL STAYS LEGAL, DELIBERATELY ───────────────────────────────────────────────────────────
--
--   `_val()` (backend/app/models/user_settings.py) falls back to the `config.py` default when the
--   column is NULL, and a database restored from before 044 has no column at all. Forbidding NULL
--   would make those states unrepairable. The API bound still refuses a NULL write — each site is
--   gated on `body.<field> is not None`. Migrations 174 and 176 say the same thing for the same
--   reason ("NULL MUST STAY LEGAL ON BOTH").
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor, or apply with
-- `scripts/apply_migration_178.py` (local only, hard-coded DSN, one transaction, counts asserted).
-- NEVER `supabase db push` / `db reset`. Apply to LOCAL first, verify, then CLOUD.
-- ============================================================================================

BEGIN;

-- ── 1. Clamp, so the constraints below can be created. Generalised; no literal `1001` anywhere.
UPDATE public.app_settings
   SET multimodal_max_vision_calls = least(greatest(multimodal_max_vision_calls, 1), 1000)
 WHERE multimodal_max_vision_calls IS NOT NULL
   AND (multimodal_max_vision_calls < 1 OR multimodal_max_vision_calls > 1000);

UPDATE public.app_settings
   SET vision_max_pages = least(greatest(vision_max_pages, 1), 500)
 WHERE vision_max_pages IS NOT NULL
   AND (vision_max_pages < 1 OR vision_max_pages > 500);

-- ── 2. The constraints, in the 174/176 shape.
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_multimodal_max_vision_calls_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_multimodal_max_vision_calls_bound
  CHECK (multimodal_max_vision_calls IS NULL
         OR (multimodal_max_vision_calls >= 1 AND multimodal_max_vision_calls <= 1000));

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_vision_max_pages_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_vision_max_pages_bound
  CHECK (vision_max_pages IS NULL
         OR (vision_max_pages >= 1 AND vision_max_pages <= 500));

COMMENT ON COLUMN public.app_settings.multimodal_max_vision_calls IS
  'SEED-227. The per-document ceiling on paid vision calls during ingestion. Bounded 1..1000 by '
  'the API (app/api/settings.py) and, since Phase 242, by app_settings_multimodal_max_vision_calls_bound '
  'here — because the two ends fail in opposite and equally silent ways: 0 disables image '
  'description for the whole install while every ingestion still reports success, and an '
  'unbounded value turns one upload into unbounded spend. Neither end announces itself, so a '
  'refusal is the only thing that can. NULL is legal and means "use the config.py default".';

COMMENT ON COLUMN public.app_settings.vision_max_pages IS
  'SEED-226. The per-document ceiling on transcribed pages during ingestion. Bounded 1..500 by the '
  'API and, since Phase 242, by app_settings_vision_max_pages_bound here. This one silently '
  'SHORTENS documents: 0 would transcribe nothing while every ingestion still reported success, '
  'and an unbounded value turns one 1,000-page scan into 1,000 paid calls. NULL is legal and '
  'means "use the config.py default".';

COMMIT;

-- ============================================================================================
-- VERIFY — run after applying, in the same editor. Every row must read PASS.
--
--   with c(what, ok) as (values
--     ('multimodal_max_vision_calls CHECK exists',
--      exists(select 1 from pg_constraint
--             where conname='app_settings_multimodal_max_vision_calls_bound')),
--     ('vision_max_pages CHECK exists',
--      exists(select 1 from pg_constraint
--             where conname='app_settings_vision_max_pages_bound')),
--     ('every stored vision-call value is in range',
--      not exists(select 1 from public.app_settings
--                 where multimodal_max_vision_calls is not null
--                   and (multimodal_max_vision_calls < 1 or multimodal_max_vision_calls > 1000))),
--     ('every stored page value is in range',
--      not exists(select 1 from public.app_settings
--                 where vision_max_pages is not null
--                   and (vision_max_pages < 1 or vision_max_pages > 500))),
--     ('the settings row still exists',
--      (select count(*) from public.app_settings) > 0)
--   )
--   select case when ok then 'PASS' else '*** FAIL ***' end as status, what from c;
-- ============================================================================================
