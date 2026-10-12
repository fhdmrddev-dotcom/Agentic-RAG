---
phase: 272-close-means-wrong
plan: 03
subsystem: retrieval / database
tags: [retrieval, rpc, migration, rls, pgvector, hnsw, filtered-search, resolver]
requires:
  - "272-01 — retrieval_rpc / retrieval_rank / retrieval_scope contracts (pure move)"
provides:
  - "migration 200 — p_document_ids on both chunk RPCs, p_exact_max_chunks + exact branch, idx_document_chunks_document_id, PUBLIC/anon revoked"
  - "retrieval_rpc — document_ids on both arms; FILTERED_EXACT_MAX_CHUNKS / FILTERED_ITERATIVE_SCAN / FILTERED_MATCH_FLOOR (provisional)"
  - "retrieval_rank — _select_filtered_vector_rows, _carry_low_similarity (D-10)"
  - "retrieval_service.search_documents(document_ids=...) — None byte-identical, empty -> ([], 0.0)"
  - "retrieval_scope — resolve_document_scope, nearby_values, canonical_stored_values, top_document_types"
  - "check-schema-acl-parity.cjs — DROP-aware (a later DROP FUNCTION retires exactly that signature)"
affects: [272-04, 272-05]
tech-stack:
  added: []
  patterns:
    - "two-step scope resolution: service-role PROPOSES candidates bounded to caller orgs, the caller's RLS DECIDES"
    - "exact-scan branch: ORDER BY (dist) + 0 so the HNSW index cannot serve a small filtered set"
    - "a fence retired on purpose: the pure-move proof kept as history against WAVE1_MERGE_SHA"
key-files:
  created:
    - supabase/migrations/200_filtered_retrieval_document_scope.sql
    - backend/tests/unit/test_272_filtered_both_arms.py
    - backend/tests/unit/test_272_scope_resolver.py
    - backend/tests/integration/test_272_rpc_document_scope.py
    - backend/tests/integration/test_272_scope_rls.py
  modified:
    - backend/app/services/retrieval_rpc.py
    - backend/app/services/retrieval_rank.py
    - backend/app/services/retrieval_service.py
    - backend/app/services/retrieval_scope.py
    - backend/tests/unit/test_272_pure_move.py
    - backend/tests/unit/test_241_hnsw_knobs.py
    - backend/tests/unit/test_271_no_embedding.py
    - scripts/full-schema-supplement.sql
    - scripts/check-schema-acl-parity.cjs
    - supabase/full-schema.sql
decisions:
  - "The low_similarity mark is carried across _enrich_with_filenames BY POSITION (enrich is 1:1 in order and drops the chunk id), in a new retrieval_rank helper; the pinned enrich body is untouched"
  - "test_search_documents_is_unchanged is retired as a passing assertion (renamed test_search_documents_fence_retired_by_272_03), not a skip, following 272-01's test_246 precedent"
  - "The resolver refuses a non-ISO `date` operand as ResolveError(422) naming YYYY-MM-DD before PostgREST sees it (Pitfall 12), in addition to FindDate's own validation for the date words"
  - "A date-word `eq` reads as the whole day (between d d)"
  - "check-schema-acl-parity.cjs became DROP-aware: without it, the only green state kept 181's old-signature REVOKEs in the supplement, which ERROR on a greenfield bootstrap"
  - "test_271_no_embedding gains retrieval_rpc.embed_texts (the 272-01 carry-forward), in this plan's feat commit"
metrics:
  duration: "~35 min"
  completed: 2026-10-03
  tasks: 3
  files: 15
---

# Phase 272 Plan 03: Filtered retrieval — migration 200, both arms, and the RLS-decided scope resolver Summary

This plan builds the database and service half of filtered retrieval:

- **Migration 200** restricts both chunk RPCs to a document set and adds an exact-scan branch for small sets, plus the btree index that branch needs. It also revokes EXECUTE from PUBLIC and anon.
- **Both retrieval arms** receive the same document set. The folder scope still applies.
- **The resolver** (`retrieval_scope.py`) turns Find's conditions into a document set in two steps. Every id and count it returns comes from a read under the caller's RLS.

Migration 200 is live on the local database, applied by Claude. Production is untouched.

**WAVE1_MERGE_SHA:** `020a0f41f7f9155783eb38790fef40e052bbcfcf` (the merge of 272-01 + 272-02; 272-04 reuses it). Plan base: `c69e344388863c2c8288990438d62aa863665867`, asserted at start on `develop`, main working tree.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 RED | `3a02ace02` | test: filtered both-arms unit suite + migration-200 integration suite |
| 1 GREEN | `b14383a47` | feat: migration 200, document_ids on both arms, D-10 helpers, pure-move retirement, hnsw cap 13, 271 fence entry |
| 2 | `a08dfa862` | chore: local apply (Claude), supplement signatures, regenerated full-schema.sql, DROP-aware ACL gate |
| 3 RED | `7116e1350` | test: resolver unit suite + two-org RLS integration suite |
| 3 GREEN | `5923ef241` | feat: resolve_document_scope / nearby_values / canonical_stored_values / top_document_types |

## Spike: EXPLAIN on recall_bench (Task 1 step 1)

`recall_bench` was reachable: 100,000 chunks, vector(1536). The set was 4 documents holding 2,000 chunks. The candidate exact statement was `document_id = ANY($ids)`, `ORDER BY (embedding <=> $1) + 0 LIMIT 20`.

| Point | Plan nodes | shared read | Execution |
|---|---|---|---|
| BEFORE the index | Limit → Nested Loop → Gather Merge → Sort → **Seq Scan** (+ Memoize → Index Scan using documents_pkey) | **6,590** | 15.29 ms |
| AFTER a bench-only `CREATE INDEX` (cold) | Limit → Sort → Hash Join → Bitmap Heap Scan → **Bitmap Index Scan using idx_document_chunks_document_id** | **764** | 14.84 ms |
| AFTER (warm) | same | 0 | 12.96 ms |

- No HNSW node appears at any point, which confirms the `+ 0` shape.
- The bench-only index was dropped again afterwards, so the bench is left as it was found.
- 272-05 runs the full ladder.

## RED outputs (verbatim excerpts)

**Task 1:**
- Unit: `16 failed`. 11 cases raised `TypeError: search_documents() got an unexpected keyword argument 'document_ids'`, 2 raised `TypeError: _vector_search() got an unexpected keyword argument 'document_ids'`, and 3 raised `ImportError: cannot import name '_select_filtered_vector_rows'`.
- Integration: `9 failed, 1 passed`, with these errors:
  - `asyncpg.exceptions.UndefinedFunctionError: function public.match_document_chunks(vector, uuid, integer, double precision, unknown, unknown, unknown, uuid[], integer) does not exist`
  - the one-signature assertion diff
  - `exact branch did not use the btree: ['idx_document_chunks_org_id', 'documents_pkey', 'documents_pkey']`
- The one case that passed is the old-positional-callers regression guard, which is green by design.

**Task 3:**
- Unit: `18 errors`, all `AttributeError: <module 'app.services.retrieval_scope'> has no attribute '_resolve_caller_org_ids'`. The 2 source fences passed.
- Integration: `6 failed`, each an `AttributeError` for `resolve_document_scope` (3 cases), `nearby_values`, `canonical_stored_values` and `top_document_types`.

## test_272_pure_move: the retirement and its RED drive

- **`RETIRED` gained `_vector_search` and `_keyword_search`.** Each carries the reason: "pure move proven at 272-01's merge (WAVE1_MERGE_SHA); 272-03 is the intended behaviour change (D-14 / D-18 / D-19: document_ids on both arms)".
- **`test_search_documents_is_unchanged` was renamed to `test_search_documents_fence_retired_by_272_03`.** It now asserts that the live orchestrator differs from the base, which shows the retirement was necessary.
- **Two tests were added:**
  - `test_272_03_retired_cases_proven_at_wave1_merge`: 3 of 3 functions at WAVE1_MERGE_SHA are AST-identical to PHASE_BASE.
  - `test_272_03_retired_cases_changed_on_purpose`: the last parameter is `document_ids=None`.
- `grep -c WAVE1_MERGE_SHA` returns 7.
- **One-off `ast.dump` comparison, WAVE1_MERGE_SHA blob against HEAD:**
  ```
  test_unfiltered_rpc_calls_are_pinned AST-IDENTICAL
  test_back_compat_names AST-IDENTICAL
  test_moved_functions_are_ast_identical AST-IDENTICAL
  ```
- **RED drive.** With `_vector_search` temporarily removed from `RETIRED`, the result was:
  `AssertionError: _vector_search in backend/app/services/retrieval_rpc.py is not AST-identical to its PHASE_BASE source — the move retyped it.` (`1 failed`).
  The file was then restored from a byte copy, and the suite read `7 passed`.

## test_241 HNSW cap (re-driven on purpose)

- I measured the non-comment `hnsw` lines in `retrieval_rpc.py` after the change: **13**, up from 11.
- The +2 are exactly the two keyword arguments on the one filtered call.
- The cap is set to the measured 13 (zero slack), with the reason written in the test body.
- `test_keyword_search_carries_no_hnsw_argument` is byte-identical and still green.

## Task 2: migration 200 applied to the LOCAL database

**Who applied it:** Claude.
- I first checked that 127.0.0.1:54322 was reachable, using asyncpg through the backend venv.
- I then executed the migration file's text with asyncpg from a script outside the repo, as user `postgres`.
- I ran it **twice**, and both runs printed `OK`, so it is idempotent.
- `psql` is not installed. No `supabase db push` and no `db reset` were used.

**pg_proc, BEFORE:**
```
keyword_search_chunks | search_query text, match_user_id uuid, match_count integer, metadata_filter jsonb, p_folder_ids uuid[]
match_document_chunks | query_embedding vector, match_user_id uuid, match_count integer, match_threshold double precision, metadata_filter jsonb, p_folder_ids uuid[], p_embedding_model text
```

**pg_proc, AFTER** (exactly one row per name):
```
keyword_search_chunks | search_query text, match_user_id uuid, match_count integer, metadata_filter jsonb, p_folder_ids uuid[], p_document_ids uuid[]
match_document_chunks | query_embedding vector, match_user_id uuid, match_count integer, match_threshold double precision, metadata_filter jsonb, p_folder_ids uuid[], p_embedding_model text, p_document_ids uuid[], p_exact_max_chunks integer
```

**VERIFY block (11/11):**
```
PASS | exactly one match_document_chunks
PASS | exactly one keyword_search_chunks
PASS | match_document_chunks has the 9-arg signature
PASS | keyword_search_chunks has the 6-arg signature
PASS | anon cannot exec keyword_search_chunks
PASS | authenticated can exec keyword_search_chunks
PASS | service_role can exec keyword_search_chunks
PASS | anon cannot exec match_document_chunks
PASS | authenticated can exec match_document_chunks
PASS | service_role can exec match_document_chunks
PASS | idx_document_chunks_document_id exists
```

**ACL after the apply:** `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` on both functions. This is the same ACL the old signatures carried, and it has no PUBLIC entry.

**`git diff --stat` (supplement + full-schema):**
- `scripts/full-schema-supplement.sql`: 22 lines changed (the 8 signatures plus a 5-line note).
- `supabase/full-schema.sql`: 91 lines changed, regenerated **without `--reset`**.

**Drift check.** The diff of `full-schema.sql` has 11 hunks, and all of them belong to migration 200: the two function headers and bodies, the index, and the supplement tail. There is **no unrelated drift**.

**Bootstrap checks:**
- `node scripts/check-schema-acl-parity.cjs`: `mirrored: 191/191 · tail: 694 lines`, then `schema ACL parity OK`.
- Its `--self-test`: 41/41.
- `scripts/check-greenfield-privileges.py`, run on a scratch DB (torn down and verified): `greenfield privileges OK -- 167 migrations scanned …`. A database bootstrapped from the regenerated artifact applies.

**Integration suites after the apply:**
- `test_272_rpc_document_scope.py`: **11 passed** (not skipped).
- `test_266_two_org_fence.py`: **6 passed**.
- `test_111_1_match_filters_stale.py`: 1 failed, 1 passed. The failure is **inherited**, and I proved that by measurement:
  - Inside one transaction that was then rolled back, I dropped the new function and recreated migration 170's 7-arg body, then ran 111_1's own call shape.
  - It returned **0 rows**. The reason is that the suite calls the RPC as the owner, where `auth.uid()` is NULL and `current_user_org_ids()` is `[]`, so the Phase-164 org gate empties it.
  - After the rollback the 9-arg function was back.

## Task 3: the resolver

**Suite results:**
- `test_272_scope_resolver.py`: 20 passed.
- `test_272_scope_seam.py`: 6 passed.
- `test_272_scope_rls.py`: **6 passed (live, not skipped)**.
- `test_272_rpc_document_scope.py`: 11 passed.

**RED drive.** I made step 2 return the step-1 ids unchanged (`return list(ids)  # PLANT: bypass RLS`). The result was `2 failed, 4 passed`:
- `test_rls_decides_and_org_b_is_never_in_the_set`: the set comparison failed because the org-A private document leaked into it.
- `test_undated_count_is_rls_intersected`: `assert (2 == 1)`.

I restored the file from a byte copy (`cmp` identical), and the suite read `6 passed`.

**Acceptance greps:**
- `get_user_pg_connection(None` returns 6.
- Module-level imports of `document_view_resolver` / `document_search_service` return 0.
- f-string SQL returns 0.

**Import smoke:** `import tool_dispatcher, agent_loop, retrieval_scope, search_documents_tool` prints OK. There is no import cycle.

## Gates (verbatim)

**Full backend unit gate** (`node ../scripts/check-backend-unit-baseline.cjs`, in `backend/`):
```
71 failed, 6308 passed, 1 skipped, 2 xfailed, 2 xpassed, 49 warnings in 299.29s (0:04:59)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**Failed SET.** After cleaning, it is **identical** to 272-BASELINES.md: `71 71 NEW: [] GONE: []`, then `SET-IDENTICAL`.
- ⚠ The raw output had a `RuntimeWarning: coroutine '_enrich_with_filenames' was never awaited` glued onto `test_sql_service.py::…::test_truncates_to_20_rows_with_note`. That is a third id this has happened to.
- A space-split parametrized id (`[async def upload_document(]`) also has to be read from the full line. A naive grep reads two phantom new ids.

**Passed went from 6262 to 6308 (+46), and every case is accounted for:**
- `test_272_scope_resolver` adds 20.
- `test_272_filtered_both_arms` adds 16.
- `test_272_pure_move` adds 2 (5 → 7).
- 272-02's `test_272_tool_schema` adds 8; it merged after 272-01 measured 6262.

**Top-level suites:**
- `test_098_scope_governance`: `1 failed, 5 passed`. The failure is the same inherited `test_run_start_resolution`.
- `test_2171`: 5 passed.
- `test_147`: 8 passed.
- `test_harness_whitelist`: 12 passed.
- `test_096`: still times out at `--timeout=60` in `run_lifecycle._watch` → `is_run_cancelled`, exactly as at base. It is inherited, and run with a timeout as the carry-forward instructed.

**graphify:** `graphify update .` was run on the main tree (35,288 nodes). `graphify-out/GRAPH_REPORT.md` was already dirty before this plan and is **not** staged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The schema ACL parity gate could not represent a dropped signature.**
- **Found during:** Task 2.
- **Issue:** `check-schema-acl-parity.cjs` (run by a PostToolUse hook and by CI) expected every ACL tuple in any migration to appear in the supplement, forever.
  - After migration 200 drops the old signatures, the plan-mandated supplement edit makes the gate report migration 181's 8 old-signature tuples as `[not-mirrored]`, so it exits 1.
  - Its only green state would keep `REVOKE … ON FUNCTION <old signature>` in the supplement. On a greenfield database that statement ERRORS and rolls back the whole one-paste bootstrap.
- **Fix:**
  - A later `DROP FUNCTION` now retires the earlier tuples on **exactly** that signature. Argument types are compared with any `public.` / `pg_catalog.` prefix ignored, and statement order is respected within a file. Retirements are printed, never silent.
  - 4 new self-test arms cover: retirement, the printed line, the counterfactual (dropping `keep(integer)` does not retire `keep(text)`), and the case where the new signature written after the drop is still expected.
  - Self-test: 41/41. Real-tree scan: `mirrored: 191/191`, retired 8.
- **Files modified:** `scripts/check-schema-acl-parity.cjs`
- **Commit:** `a08dfa862`

**2. [Rule 2] Non-ISO `date` operands are refused before PostgREST sees them (Pitfall 12).**
- The plan's behavior list only covered FindDate. The compiler's `date` → `date_typed` leg does not check the format, so `"October"` would have been a PostgREST 400 that reads as "retrieval unavailable".
- It now raises `ResolveError(422)` naming YYYY-MM-DD. The unit test is parametrized over both routes.
- **Commit:** `5923ef241`

**3. [Rule 2] The 271 embedding-fence gap was closed in this plan** (the 272-01 carry-forward).
- `test_271_no_embedding._EMBED_SITES` gains `("app.services.retrieval_rpc", "embed_texts")`. Result: 51 passed.
- **Commit:** `b14383a47`

**4. [Test expectation corrected, no code change] The D-13 predicate-seam unit case.**
- It first expected `metadata->>document_type`. The 271 compiler routes `document_type eq` to the typed, indexed `document_type_norm` leg, which is correct, so the expectation was fixed.
- **Commit:** `5923ef241`

**5. [Test harness] The resolver integration suite reads the local service-role client from `backend/.env`** (`_271_gotrue_users._admin`).
- `tests/conftest.py` installs a placeholder `SUPABASE_URL`, so `get_supabase()` raised `getaddrinfo failed`. This follows the 271 precedent and skip-guards on `require_gotrue()`.

**6. The `low_similarity` re-attach is by position, not by chunk id.**
- `_enrich_with_filenames` rebuilds each hit and **drops the chunk `id`**, so a by-id re-attach is impossible without editing the pinned enrich body.
- Enrich is 1:1 in input order. The helper `_carry_low_similarity` (in `retrieval_rank.py`) carries the mark by position, and falls back to unmarked if the lengths ever differ.

## Known Stubs

None. `FILTERED_EXACT_MAX_CHUNKS = 2000`, `FILTERED_ITERATIVE_SCAN = "relaxed_order"` and `FILTERED_MATCH_FLOOR = -2.0` are **provisional by design**. They are marked "PROVISIONAL — 272-05 sets these from the SEED-273 ladder", and 272-05 owns them.

## Owed / handed forward

- **OWED (272-05, operator-gated):**
  - Apply migration 200 to production.
  - Run `get_advisors(security)` in the cloud.
  - Read the prod `document_chunks` count first. If it is large, run the header's `CREATE INDEX CONCURRENTLY` alone first.
- **272-05:** measure and set the three `FILTERED_*` constants (the SEED-273 ladder, with EXPLAIN at every point).
- **272-04 must know:** both arms still carry the pre-existing `folder_ids if folder_ids else None` idiom. A `search_documents(folder_ids=[])` call therefore still means "no folder restriction". The resolver treats `folder_ids=[]` as empty (D-18), but the handler must not hand an empty folder list to `search_documents` itself. I did not change this here, because it sits inside the pinned unfiltered call shape.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: guard-semantics | scripts/check-schema-acl-parity.cjs | The ACL-mirror gate now stops expecting tuples on a signature a later migration drops. The scope is exact signature identity, every retirement is printed, and the counterfactual self-test pins that a different argument list is never retired. A reviewer should confirm the drop regex cannot match a non-DROP statement. |

The mitigations T-272-10..16 are all in place:
- the two-org fence plus the step-2-bypass RED drive;
- org-B ids return 0 rows in both RPCs;
- PUBLIC/anon revoked, with VERIFY and `has_function_privilege` assertions;
- the empty array returns zero rows in the RPC, adapter and service, and the resolver's empties make zero queries;
- bound params everywhere, with no f-string SQL;
- the DROP plus one-signature check, and the bounded `p_exact_max_chunks` count;
- the CONCURRENTLY note in the header.

## TDD Gate Compliance

- `test(272-03)` `3a02ace02` comes before `feat(272-03)` `b14383a47`.
- `test(272-03)` `7116e1350` comes before `feat(272-03)` `5923ef241`.

Both RED outputs are quoted above.

## Self-Check: PASSED

- All 5 created files exist on disk.
- All 5 commits (`3a02ace02`, `b14383a47`, `a08dfa862`, `7116e1350`, `5923ef241`) are present in `git log`.
- STATE.md and ROADMAP.md are untouched.
