# Phase 164 — Deferred / Out-of-Scope Discoveries

Items discovered during execution that are OUT OF SCOPE for the plan they were found in
(per the executor scope-boundary rule: log, do not fix). Not caused by the current task's changes.

## Discovered during Plan 164-02 (SEED-091 owner-nulling)

### D-164-02-A — Two pre-existing 163 RLS suite failures (live-DB state, disjoint from 164-02)

- **Discovered during:** Plan 164-02 verification (`pytest tests/integration -k "163" -q` → 2 failed / 101 passed).
- **Failing tests:**
  - `tests/integration/test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org`
  - `tests/integration/test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org`
- **Symptom:** a global `classification_rules` (resp. `workflow_definitions`) row seeded in org A is visible to a cross-org user B over the asyncpg user-context — `assert crossorg_sees == 0` fails with `1 == 0`. The tests assert membership must gate the `is_global` branch on those tables post-163.
- **Why out of scope for 164-02:** Plan 164-02 touches ONLY the Python serialize paths (folders / skills / views list endpoints) + three Pydantic model loosens. It changes NO DB object, NO RLS policy, NO migration, and none of the `classification_rules` / `workflow_definitions` tables. The failing assertions are raw `SELECT count(*)` over asyncpg with zero execution path through the 164-02 diff (verified: `git show --name-only 07840986` = 7 serialize/model files only). The failures reproduce independent of this plan (live local-DB RLS state).
- **Likely root cause / owner:** the live local DB's RLS on `classification_rules` / `workflow_definitions` still allows cross-org visibility of `is_global` rows for co-members — an RLS/membership-gate concern (migration territory: the 108/109 membership rewrite coverage or the 164 migration-110 / later 166-167 org-membership work), NOT a serialize concern. Route to whoever owns the RLS gate on those two tables.
- **Action taken:** none (logged, not fixed — scope boundary). Does not block 164-02: the SEED-091 unit gate (`tests/test_seed091_owner_nulling.py`) is DB-independent and passes 6/6.

## Discovered during Plan 164-04 (producer client-swap)

### D-164-04-A — Pre-existing async-not-awaited rot in the retrieval/sql unit tests (NOT caused by 164-04)

- **Discovered during:** Plan 164-04 broad-regression sweep (`pytest tests/unit/test_retrieval_service.py tests/unit/test_sql_service.py`).
- **Failing tests:** 27 in `tests/unit/test_retrieval_service.py` (all `TestSearchDocuments*` / `TestEnrichWithFilenamesPhase28`) + `tests/unit/test_sql_service.py` (all `TestQueryDocuments*`).
- **Symptom:** every failing method is a **sync** `def test_...` that calls an **async** function (`search_documents` / `_enrich_with_filenames` / `query_documents`) **without `await` and without `@pytest.mark.asyncio`** → pytest emits `RuntimeWarning: coroutine '<fn>' was never awaited`; the coroutine body never runs, so mocks are never hit / validators never raise (`Expected 'embed_texts' to be called once. Called 0 times.`, `DID NOT RAISE ValueError`).
- **Why out of scope for 164-04:** the failure mechanism (coroutine created but never executed) is **independent of the function body** — it fails identically before and after the 164-04 swap because the body never runs either way. These functions have been `async` since Phase 073 / SEED-065 (the `run_in_threadpool` embed wrap), long before Phase 164; the test file was never migrated to `@pytest.mark.asyncio` + `await`. This is a pre-existing test-authoring rot (the "vitest/e2e rot" class), not a 164-04 regression.
- **Action taken:** none (logged, not fixed — scope boundary; a proper fix is a test-file migration to async, unrelated to the client-swap). The **behavioral** proof for the swapped path is the live exit-gate suite (`test_v3_4_org_isolation.py` 18/18 — prag01_retrieval, definer, text_to_sql) + `test_kb.py` (24/24, grep tests re-pointed at the user-context seam).

### D-164-04-B — `test_stale_model_chunks_excluded` broke at 164-03 (mig 110 org-scope), not 164-04

- **Discovered during:** Plan 164-04 broad-regression sweep (`pytest tests/integration/test_111_1_match_filters_stale.py`).
- **Failing test:** `tests/integration/test_111_1_match_filters_stale.py::test_stale_model_chunks_excluded` (the other two legs in the file pass; `test_111_1_reembed_rls.py` fully passes).
- **Symptom:** the positive-control leg `assert cur_chunk in ids_current` fails — `match_document_chunks(...)` returns 0 rows for the fixtured user.
- **Root cause / owner:** the test calls `match_document_chunks` **directly over a plain `pg_pool.acquire()` connection** (role `postgres`, `auth.uid()` = NULL). **Migration 110 (Plan 164-03)** org-scoped the function body (`WHERE dc.org_id = ANY(SELECT current_user_org_ids()) AND (dc.user_id = auth.uid() OR …)`), so on a non-user-context connection `current_user_org_ids()` is empty → 0 rows (the designed fail-closed behavior). This broke when the SQL half landed in **164-03**, not from the 164-04 Python swap (my changes never touch this test's direct-DB path).
- **Fix owed (not by 164-04):** re-point the test's fixtured calls at a **user-context** connection (the `open_user_conn` pattern the new `test_v3_4_org_isolation.py` already uses) + ensure the fixtured user has org membership and the chunks carry `org_id` — a 164-03 test-contract update. The stale-model *filter* itself is still verified: `pg_proc` shows the `p_embedding_model` param present, and the org-scoped body retains the `AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)` clause (migration 110 §1).
- **Action taken:** none (logged, not fixed — out of the 164-04 code scope; belongs to the 164-03 migration-contract cleanup / phase verify).
