-- 107_ten04_chunk_embedding_org_id.sql
-- Phase 163 (TEN-04) — denormalize org_id onto the two pgvector HOT tables document_chunks +
-- skill_embeddings, backfill from the parent FK, self-guarded NOT-NULL flip, add a btree alongside the
-- UNTOUCHED vector indexes, and attach both to the mig-106 BEFORE-INSERT autofill net.
--
-- WHY THIS EXISTS (the CONCUR-01 join-cliff mitigation — D-07):
--   document_chunks + skill_embeddings are the ONLY two user-facing tables mig 104 deliberately left
--   without org_id (104:442-443: "their org_id denormalize + composite index is TEN-04, the perf-gated
--   crux"). Without a DENORMALIZED org_id column, the only way to org-scope document_chunks RLS is a
--   per-row join to documents over the pgvector seq-scan — the single largest CONCUR-01 threat. This
--   migration lays the column so 163's RLS rewrite (migration 108) and Phase 164's SECDEF in-body
--   predicate both filter the denormalized org_id DIRECTLY, never a join.
--
-- ── MIGRATION ORDER (LOCKED — 107 BEFORE 108) ──────────────────────────────────────────────────
--   This TEN-04 migration is slot 107; the RLS rewrite is slot 108. The RLS predicates in 108 reference
--   the org_id column added HERE (document_chunks / skill_embeddings membership filters), and Postgres
--   applies migrations in integer filename order — so the org_id column MUST land first. The plan-set
--   INVERTED the pre-allocated "107=RLS / 108=TEN-04" intent for exactly this hard data-dependency. The
--   [BLOCKING] apply (plan 163-05) pastes 107 THEN 108. Filename is digits-only (`107_…`) — a letter
--   suffix like `107b` is silently skipped by the Supabase CLI.
--
-- ── SCOPE BOUNDARY (Phase 164, NOT here) ───────────────────────────────────────────────────────
--   163 lays the COLUMN only. It does NOT modify the SECURITY DEFINER retrieval functions
--   match_document_chunks / keyword_search_chunks — their org-scoping + search_path pin is Phase 164
--   (TEN-03). Those RPCs BYPASS RLS (SECDEF), so this RLS column is INERT on the hot retrieval path
--   until 164 threads org_id through the RPC bodies. Do NOT claim "retrieval is org-isolated" from 107.
--
-- FOUR INVARIANTS (mirrors mig 105/106 — the DB, not a human, enforces correctness):
--   * PARENT-FK BACKFILL — chunk/embedding org_id is resolved STRICTLY from the parent row
--     (document_chunks.org_id ← documents.org_id via document_id; skill_embeddings.org_id ← skills.org_id
--     via skill_id). Same owner ⇒ same org; the sharing flags are never read (T-163-BF).
--   * SELF-GUARDED NOT-NULL FLIP — a RAISE-EXCEPTION zero-NULL guard precedes each SET NOT NULL, so a
--     flip is structurally impossible on any residual NULL — no chunk ever ships org-less.
--   * HNSW / GIN UNTOUCHED — the document_chunks vector indexes (document_chunks_embedding_idx HNSW,
--     document_chunks_search_vector_idx GIN) are NOT dropped or recreated. No per-tenant partial vector
--     index (org count is unbounded). Only a plain btree(org_id) is added per table.
--   * AUTOFILL NET — a BEFORE-INSERT trigger (mig-106 autofill_org_id_from_parent) on each table fills
--     org_id from the parent FK before RLS WITH CHECK evaluates, so FUTURE chunk/embedding INSERTs pass
--     org scoping WITHOUT the app threading org_id (T-163-05).
--
-- IDEMPOTENT / RE-PASTE-SAFE: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP TRIGGER IF
--   EXISTS before CREATE TRIGGER, every backfill UPDATE carries WHERE org_id IS NULL, every flip is
--   IF-EXISTS-guarded, the procedure is CREATE OR REPLACE + dropped at the end. ALTER COLUMN SET NOT NULL
--   on an already-NOT-NULL column is a no-op (no error). Re-running the whole paste is a safe recovery.
--
-- ── APPLY DISCIPLINE (CLAUDE.md numbered-migration rules) — AUTHORED HERE, APPLIED IN PLAN 163-05 ──
--   * This plan (163-02) only AUTHORS the file. The operator APPLIES it in the [BLOCKING] Wave-3 plan
--     (163-05) by running it through psycopg2 autocommit=True @ 127.0.0.1:54322 (the proven mig-105 path
--     — the per-batch COMMIT in _mig163_backfill is ONLY legal in a non-atomic / autocommit context),
--     OR by pasting into the LOCAL Supabase SQL editor running each CALL as a SEPARATE execution. NEVER a
--     single wrapping-transaction paste (raises "invalid transaction termination" on the CALL), and NEVER
--     `supabase db push` / `db reset` (preserves dev data). Do NOT apply it here.
--   * AFTER applying (plan 163-05): run `bash scripts/regenerate-full-schema.sh` (no --reset) and commit
--     the migration AND the regenerated supabase/full-schema.sql together (D-06). NEVER hand-edit it.
--
-- ── CLOUD PARITY (do NOT touch cloud now) ──────────────────────────────────────────────────────
--   Migrations 099–106 + SECRETS_ENCRYPTION_KEY are already pending on the cloud (production) DB. 107
--   joins that pending set — applied to cloud only at the next operator-gated production push, in order
--   (099 → … → 106 → 107 → 108), per docs/DEPLOYMENT-WORKFLOW.md. This phase AUTHORS + applies LOCAL only.
--
-- ── DEPLOYMENT-ARTIFACT PARITY (NOT seed-bearing) ──────────────────────────────────────────────
--   107 adds only columns + indexes + BEFORE-INSERT triggers — it seeds NO reference data, touches NO
--   env var, no bundled service, no sandbox tag. So it is NOT seed-bearing and owes NO docs/OPERATOR.md
--   Step-3 or scripts/check-deploy-drift.sh change (D-16 parity satisfied by exclusion, as mig 105/106).

-- ================================================================================================
-- §1 — ADD COLUMN (nullable first; the NOT-NULL flip is §3, after the backfill)
-- Column + comment shape = 104_org_dept_role_schema.sql:448-450.
-- ================================================================================================
ALTER TABLE public.document_chunks  ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.skill_embeddings ADD COLUMN IF NOT EXISTS org_id uuid;

-- ================================================================================================
-- §2 — BATCHED PARENT-FK BACKFILL  (D-07)
-- One reusable batching PROCEDURE with a per-batch COMMIT (the lock-storm mitigation, T-162-02 — the
-- COMMIT is legal only in the autocommit / non-atomic apply context; see the header apply note). The
-- mig-105 procedure was DROPped at the end of 105, so it is RE-DECLARED here as _mig163_backfill. Both
-- parents (documents / skills) already carry NOT-NULL org_id (mig 105), so `WHERE p.org_id IS NOT NULL`
-- matches every parent. document_chunks is the LARGE table → ~10k windows. Each UPDATE keeps
-- WHERE org_id IS NULL (idempotent re-run) + a LIMIT $1 batch bound.
--
-- PAGING KEY differs per table: document_chunks has a uuid `id` PK → page on `id`. skill_embeddings has
-- NO `id` column (PK is `skill_id`, full-schema.sql:1458-1466) → page on `skill_id` (the non-`id`-PK
-- paging bug that bit the mig-105 apply, applied correctly here from the start).
-- ================================================================================================
CREATE OR REPLACE PROCEDURE public._mig163_backfill(p_sql text, p_batch int DEFAULT 10000)
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_rows int;
  v_iter int := 0;
BEGIN
  LOOP
    EXECUTE p_sql USING p_batch;             -- p_sql is a migration-authored UPDATE … LIMIT $1 (never user input)
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_iter := v_iter + 1;
    RAISE NOTICE '_mig163_backfill batch % -> % rows', v_iter, v_rows;
    COMMIT;                                  -- releases the lock window between batches
    EXIT WHEN v_rows = 0;
  END LOOP;
END;
$$;

-- document_chunks.org_id ← documents.org_id  (via the document_id FK; page on the uuid `id` PK)
CALL public._mig163_backfill($SQL$
  UPDATE public.document_chunks c SET org_id = p.org_id FROM public.documents p
  WHERE p.id = c.document_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.id IN (SELECT id FROM public.document_chunks WHERE org_id IS NULL LIMIT $1)
$SQL$);

-- skill_embeddings.org_id ← skills.org_id  (via the skill_id FK; page on skill_id — NO `id` column)
CALL public._mig163_backfill($SQL$
  UPDATE public.skill_embeddings c SET org_id = p.org_id FROM public.skills p
  WHERE p.id = c.skill_id AND c.org_id IS NULL AND p.org_id IS NOT NULL
    AND c.skill_id IN (SELECT skill_id FROM public.skill_embeddings WHERE org_id IS NULL LIMIT $1)
$SQL$);

-- ================================================================================================
-- §3 — PRE-FLIP NULL CENSUS + SELF-GUARDED NOT-NULL FLIPS  (SC#2 / T-163-BF)
-- Runs AFTER the §2 CALLs have COMMITted (never flip first — load-bearing). The census is operator
-- visibility; each flip is preceded by a RAISE-EXCEPTION zero-NULL guard, so the DB — not a human —
-- enforces "verified zero-NULL" (a flip is structurally impossible on any orphan chunk / embedding whose
-- parent was missing or had a NULL org_id). If the guard FIRES, the operator resolves the straggler
-- (delete the orphan or fix the parent) and re-pastes — the flip stays blocked until clean.
-- ================================================================================================

-- Pre-flip NULL census — both null_org_id counts MUST read 0 before the flips below.
SELECT 'document_chunks'  AS table_name, count(*) FILTER (WHERE org_id IS NULL) AS null_org_id FROM public.document_chunks
UNION ALL
SELECT 'skill_embeddings', count(*) FILTER (WHERE org_id IS NULL) FROM public.skill_embeddings
ORDER BY null_org_id DESC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.document_chunks WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'MIG163 document_chunks: % rows still NULL, NOT-NULL flip aborted',
      (SELECT count(*) FROM public.document_chunks WHERE org_id IS NULL);
  END IF; END $$;
ALTER TABLE public.document_chunks ALTER COLUMN org_id SET NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.skill_embeddings WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'MIG163 skill_embeddings: % rows still NULL, NOT-NULL flip aborted',
      (SELECT count(*) FROM public.skill_embeddings WHERE org_id IS NULL);
  END IF; END $$;
ALTER TABLE public.skill_embeddings ALTER COLUMN org_id SET NOT NULL;

-- ================================================================================================
-- §4 — BTREE INDEX on org_id  (D-07 — the CONCUR-01 join-killer; benchmark-driven shape)
-- A plain btree(org_id) is the recommended default. The composite (org_id, user_id) is the alternative
-- (RLS + the belt-and-suspenders .eq("user_id") both filter these) — the plan-163-09 CONCUR-01 benchmark
-- (test_058_concurrency.py:270 `assert elapsed < 1.0`) decides if the composite is needed before merge.
-- ⚠️ The HNSW (document_chunks_embedding_idx) + GIN (document_chunks_search_vector_idx) indexes are
-- LEFT UNTOUCHED — never dropped, never recreated, no per-tenant partial vector index.
-- ================================================================================================
CREATE INDEX IF NOT EXISTS idx_document_chunks_org_id  ON public.document_chunks  USING btree (org_id);
CREATE INDEX IF NOT EXISTS idx_skill_embeddings_org_id ON public.skill_embeddings USING btree (org_id);

COMMENT ON COLUMN public.document_chunks.org_id  IS 'TEN-04 (Phase 163): denormalized from documents.org_id via document_id. NOT NULL. RLS (mig 108) + Phase-164 SECDEF filter this directly — never a per-row join to documents (CONCUR-01).';
COMMENT ON COLUMN public.skill_embeddings.org_id IS 'TEN-04 (Phase 163): denormalized from skills.org_id via skill_id. NOT NULL. RLS (mig 108) filters this directly.';

-- ================================================================================================
-- §5 — ATTACH the mig-106 BEFORE-INSERT autofill net  (T-163-05)
-- Mirrors the mig-106 GROUP-3 owner-less-child attach (106:287-301 — todos/workflow_runs via their
-- parent FK). autofill_org_id_from_parent (created in mig 106) resolves the child org_id from the parent
-- row before the row is written, so future chunk/embedding INSERTs auto-fill org_id and pass RLS WITH
-- CHECK without the app threading org_id. The forward-compat `IF NEW.org_id IS NOT NULL THEN RETURN NEW`
-- guard (mig 106) makes it a pure no-op once the app DOES thread org_id. DROP … IF EXISTS + CREATE for
-- re-paste safety. Orthogonal to the existing document_chunks trg_update_search_vector (also BEFORE
-- INSERT) — two independent BEFORE-INSERT triggers coexist.
-- ================================================================================================
DROP TRIGGER IF EXISTS document_chunks_autofill_org_id ON public.document_chunks;
CREATE TRIGGER document_chunks_autofill_org_id BEFORE INSERT ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('document_id', 'documents', 'id');

DROP TRIGGER IF EXISTS skill_embeddings_autofill_org_id ON public.skill_embeddings;
CREATE TRIGGER skill_embeddings_autofill_org_id BEFORE INSERT ON public.skill_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_from_parent('skill_id', 'skills', 'id');

-- ================================================================================================
-- §6 — Drop the migration-scoped batching scaffolding
-- ================================================================================================
DROP PROCEDURE IF EXISTS public._mig163_backfill(text, int);

-- Closing note: 107 lays a NOT-NULL, parent-FK-backfilled, btree-indexed org_id on both pgvector hot
-- tables + wires their autofill triggers, with the HNSW/GIN vector indexes untouched — the SUBSTRATE the
-- RLS rewrite (migration 108) and Phase 164's SECDEF retrieval fns both consume. It touches ONLY
-- document_chunks + skill_embeddings + their triggers/indexes; the SECDEF retrieval functions are Phase
-- 164 (boundary held). Apply 107 BEFORE 108.
