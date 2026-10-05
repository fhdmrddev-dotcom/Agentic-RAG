---
phase: 272-close-means-wrong
plan: 01
subsystem: retrieval / agent tools
tags: [refactor, pure-move, g-5, extraction, retrieval, tool-dispatcher, seam]
requires: []
provides:
  - "retrieval_rpc.py — _vector_literal, _call_as_user, _vector_search, _keyword_search"
  - "retrieval_rank.py — _rrf_fuse, _deduplicate_chunks, _avg_cosine"
  - "retrieval_documents.py — _enrich_with_filenames, resolve_document_id, fetch_full_document"
  - "retrieval_scope.py — RetrievalPredicate, DEFAULT_PREDICATES, requires_resolved_scope, ScopeResult"
  - "search_documents_tool.py — handle_search_documents"
  - "272-BASELINES.md — frozen backend failed SET + top-level suite results"
affects: [272-03, 272-04, 272-05]
tech-stack:
  added: []
  patterns:
    - "verbatim move proven by AST equality against `git show PLAN_BASE_SHA:<file>`"
    - "back-compat re-exports (same object, not a copy) for every measured importer"
    - "function-local import to break the tool_dispatcher import cycle"
    - "default predicates as DATA (frozen dataclass tuple), no branch per name"
key-files:
  created:
    - .planning/phases/272-close-means-wrong/272-BASELINES.md
    - backend/app/services/retrieval_rpc.py
    - backend/app/services/retrieval_rank.py
    - backend/app/services/retrieval_documents.py
    - backend/app/services/retrieval_scope.py
    - backend/app/services/search_documents_tool.py
    - backend/tests/unit/test_272_pure_move.py
    - backend/tests/unit/test_272_scope_seam.py
    - backend/tests/unit/test_272_search_tool_move.py
  modified:
    - backend/app/services/retrieval_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_retrieval_service.py
    - backend/tests/unit/test_241_hnsw_knobs.py
    - backend/tests/unit/test_246_hnsw_server_probe.py
    - backend/tests/test_098_scope_governance.py
    - backend/tests/test_2171_search_error_audit.py
    - backend/tests/unit/test_260_financial_analyzer_conversation.py
    - backend/tests/unit/test_267_cr02_empty_biased_scope_searches.py
    - backend/tests/unit/test_268_search_audit_keys.py
    - backend/tests/unit/test_retrieval_failure_honesty.py
    - backend/tests/unit/test_tool_dispatcher.py
decisions:
  - "The handler re-export sits at the top of tool_dispatcher.py, beside the retrieval_service import — not where the handler body was"
  - "retrieval_service keeps re-exporting embed_texts so test_271_no_embedding's hasattr fence still passes. That fence entry no longer blocks the live call, which now resolves from retrieval_rpc (deferred, see below)"
  - "td.search_documents stays importable but is no longer used by any dispatcher handler; patching it does nothing, and the positive control proves that"
  - "graphify update NOT run in the worktree: graphify-out/GRAPH_REPORT.md is tracked and was already dirty in the main checkout, so a worktree commit of it would conflict with 272-02. Run once on the merged tree"
metrics:
  duration: "~2h10m (mostly the two full backend gates and the hung test_096 runs)"
  completed: 2026-10-03
  tasks: 3
  files: 21
---

# Phase 272 Plan 01: Split retrieval_service.py and move the search_documents handler (pure moves) Summary

The extraction of `retrieval_service.py` had been owed since Phase 231. This plan does it before any behaviour lands, as a verbatim move into three modules: an RPC adapter, pure ranking helpers and document readers. The moved functions are AST-identical to PHASE_BASE. It also adds the D-13 filter-seam contracts as data and types (`retrieval_scope.py`). Finally, it moves the `search_documents` tool handler into `search_documents_tool.py` (D-15) and keeps the tool count at 29. Behaviour is unchanged, and the backend failed SET is identical to the baseline.

**PHASE_BASE:** `f49d9ea2d354a42d66eb007de9d9ca6a451afe81`. The worktree started on master's `86d9559bb` and was reset to this commit before any work began.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 (0) | `c4073077e` | docs: 272-BASELINES.md frozen before any source edit |
| 1 (1) | `ed8c2954c` | test (RED): test_272_pure_move + test_272_scope_seam |
| 2 | `d1824fe1f` | refactor: retrieval split + retrieval_scope contracts + 3 retargeted suites |
| 3 (1) | `af912529c` | test (RED): test_272_search_tool_move |
| 3 (2-5) | `fdf05b575` | refactor: handler move + 7 retargeted suites |

## RED outputs (verbatim)

**Task 1, at PHASE_BASE** — `8 failed, 3 passed, 1 warning in 1.84s`:
- The pin passes, as it must: `test_unfiltered_rpc_calls_are_pinned[True]` and `[False]`. `test_search_documents_is_unchanged` also passes, because at base it compares the file with itself.
- Fails with `FileNotFoundError: … backend\app\services\retrieval_rpc.py`: `test_moved_functions_are_ast_identical`.
- Fails with `ModuleNotFoundError: No module named 'app.services.retrieval_rpc'`: `test_back_compat_names`.
- Five cases fail with `ModuleNotFoundError: No module named 'app.services.retrieval_scope'`, and the source fence fails with `FileNotFoundError: … retrieval_scope.py`. These are all six `test_272_scope_seam` cases.

**Task 3 (1)** — `5 failed, 1 warning in 1.04s`:
- Three cases fail with `ModuleNotFoundError: No module named 'app.services.search_documents_tool'`.
- The AST and module-level fences fail with `FileNotFoundError: … search_documents_tool.py`.

**GREEN:**
- Task 2: `11 passed` for the two suites. The six Task-2 suites read `15 failed, 110 passed`; all 15 failures are the inherited `test_retrieval_service.py` set (see below).
- Task 3: `1 failed, 236 passed` across the 18 targeted suites. The one failure is `test_098::test_run_start_resolution`, which is inherited.

## Inertness drives

1. **Old retrieval target misses (Task 2).** In `test_241::test_vector_search_passes_the_resolved_knobs_and_keyword_search_does_not`, I temporarily patched `app.services.retrieval_service._call_as_user` instead of `rrpc._call_as_user`. The result was `1 failed` with:
   ```
   E   asyncpg.exceptions.DataError: invalid input for query argument $2: 'u1' (invalid UUID 'u1': length must be between 32..36 characters, got 2)
   ```
   - The missed patch reached the real `_call_as_user`, which opened a real asyncpg user-context connection. It died at argument encoding: `'u1'` is not a UUID, and the statement is a SELECT anyway. Nothing was written.
   - **This is why the retarget mattered.** Before it, such a patch would have silently reached the local database.
   - The file was restored from a byte copy, and the case went back to green (`48 passed`).
2. **Old handler target misses (Task 3, a permanent test).** `test_272_search_tool_move` drives patch-where-used in both directions:
   - Patching `app.services.search_documents_tool.search_documents` records exactly 1 call.
   - Patching only `td.search_documents` records 0 calls. In that case the real `search_documents` runs against a stubbed `retrieval_rpc._call_as_user` and `embed_texts`, so nothing leaves the process.

## Retargeted sites per file

| File | Sites | Change |
|---|---|---|
| `tests/unit/test_retrieval_service.py` | 13 | `patch("app.services.retrieval_service.embed_texts")` → `retrieval_rpc` (the plan said 14; **measured 13**) |
| `tests/unit/test_241_hnsw_knobs.py` | 11 | `rs` (retrieval_service) → `rrpc` (retrieval_rpc). That covers the import, the HNSW-line cap's `getsource`, the keyword fence, 2 setattrs and 2 calls in the wiring test, and 2 setattrs and 2 calls in the knobs-in-transaction test. Plus the deliberate G-5 re-drive and a 2-line comment on the cap |
| `tests/unit/test_246_hnsw_server_probe.py` | 1 | `test_retrieval_service_is_byte_unchanged` was **retired deliberately** and renamed `test_retrieval_service_fence_retired_by_272_01`, with the reason in its docstring. The docstring item 6 was updated and the unused `subprocess` import dropped |
| `tests/test_098_scope_governance.py` | 2 | `setattr(td, "search_documents")` → `"app.services.search_documents_tool.search_documents"` |
| `tests/test_2171_search_error_audit.py` | 3 | search ×2, write_audit_entry ×1 |
| `tests/unit/test_260_financial_analyzer_conversation.py` | 2 | `patch(...tool_dispatcher.search_documents)` |
| `tests/unit/test_267_cr02_empty_biased_scope_searches.py` | 4 | search ×2, write_audit_entry ×2 |
| `tests/unit/test_268_search_audit_keys.py` | 3 | search ×2, write_audit_entry ×1. The `'"run_id": str(ctx.run_id)' == 2` count was left as is and still passes |
| `tests/unit/test_retrieval_failure_honesty.py` | 3 | `patch(...tool_dispatcher.search_documents)` |
| `tests/unit/test_tool_dispatcher.py` | 2 | `setattr(td, "search_documents")` |

In the seven Task-3 suites, every changed line is a patch target: 19 `-`/`+` pairs, read from `git diff -U0`. No assertion, fixture or expected value moved. `test_259`, `test_261` and `test_085` show an empty `git diff f49d9ea2d` and pass unchanged.

## Gates (verbatim)

**Full backend unit gate after Task 3** (run in `backend/`):
```
71 failed, 6262 passed, 1 skipped, 2 xfailed, 2 xpassed, 45 warnings in 316.47s (0:05:16)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
- The failed SET is **identical** to 272-BASELINES.md, checked with `diff` and confirmed `SET-IDENTICAL`.
- Passed went from 6246 to 6262. The +16 are exactly the new suites: pure_move 5, scope_seam 6, search_tool_move 5.
- ⚠ Again, one `FAILED` line had a `RuntimeWarning` interleaved onto it, this time on a different id (`…test_returns_chunk_index_in_enriched_results`). I cleaned it before the diff. A naive grep reads a phantom new id.

**The five top-level suites after the move. All match the baseline:**
- `test_098_scope_governance.py`: 1 failed, 5 passed. The failure is the same inherited `test_run_start_resolution`.
- `test_2171_search_error_audit.py`: 5 passed.
- `test_096_ci_workflow_regression.py`: all 5 cases still time out at `--timeout=60`, exactly as at the base. Inherited.
- `test_147_flag_refuse.py`: 8 passed.
- `test_harness_whitelist.py`: 12 passed.

**Other `td.write_audit_entry` suites, checked because they could have been affected:** `test_223`, `test_224`, `security/test_adversarial_corpus` and `services/test_tool_dispatcher_trifecta_fence` read `2 failed, 22 passed`. The two failures are `test_223::test_execution_failure_audited` and `::test_success_audited`, both `TypeError: object MagicMock can't be used in 'await' expression`. I proved them inherited by measurement: I swapped in the PHASE_BASE `tool_dispatcher.py` (explicit path, byte copy restored afterwards) and got the same 2 failed, 4 passed.

**Import smoke:** `import app.services.tool_dispatcher, app.services.agent_loop, app.services.checked_query_service` and a direct `import app.services.search_documents_tool` both print OK. No import cycle.

**Acceptance greps:**
- `^(async )?def` in retrieval_service.py → **1**
- `async def _call_as_user` in retrieval_rpc.py → 1; `def _rrf_fuse` → 1; `async def fetch_full_document` → 1
- module-level `document_view_resolver` / `document_search_service` imports in retrieval_scope.py → 0
- `async def resolve_document_scope` → 0
- `async def _handle_search_documents` in tool_dispatcher.py → 0; `async def handle_search_documents` in search_documents_tool.py → 1; the re-export line → 1
- module-level tool_dispatcher import in search_documents_tool.py → 0
- `git diff ed8c2954c -- backend/tests/unit/test_272_pure_move.py` → **empty**
- `git diff --name-only f49d9ea2d HEAD` → exactly the 21 `files_modified`

## New-module line counts (for 272-05's ledger re-derivation)

| File | Lines |
|---|---|
| `backend/app/services/retrieval_rpc.py` | 163 |
| `backend/app/services/retrieval_rank.py` | 74 |
| `backend/app/services/retrieval_documents.py` | 174 |
| `backend/app/services/retrieval_scope.py` | 102 |
| `backend/app/services/search_documents_tool.py` | 234 |
| `backend/app/services/retrieval_service.py` (thinned, was 456) | 124 |
| `backend/app/services/tool_dispatcher.py` (was 5234) | 5038 |

## Deviations from Plan

1. **[Rule 3 - Blocking] The HNSW-line cap in test_241 would have hit 12 of 12.** My first `retrieval_rpc.py` module docstring mentioned HNSW and `retrieval_tuning.py`, which counted against the cap. I reworded that docstring line to point at `_call_as_user`, and the count is back to **11**, the same as before the move. The one line of slack is preserved and the cap is not loosened.
2. **[Rule 2] The `OWED since Phase 231` wording was rephrased in all four retrieval module docstrings** to "had been owed since Phase 231". The re-driven G-5 test asserts that no open "OWED since Phase 231" claim remains in `retrieval_rpc.py`. I applied the same phrasing to the other three modules for consistency.
3. **The 271 embedding fence has a gap the move opened.** `test_271_no_embedding.py` (not in this plan's files) blocks `("app.services.retrieval_service", "embed_texts")` and asserts `hasattr`. I kept `embed_texts` re-exported from retrieval_service so the fence still passes. But the live call now resolves `embed_texts` from `retrieval_rpc`, so that one fence entry no longer blocks anything. The Find path never reaches retrieval, and the fence still blocks `openai_service.embed_texts`, so no false green follows today. **Deferred:** add `("app.services.retrieval_rpc", "embed_texts")` to `_EMBED_SITES` (272-03 or 272-05). Not done here because the file is outside `files_modified`.
4. **graphify was not run in the worktree.** The reason is in the `decisions` frontmatter: committing the tracked `GRAPH_REPORT.md` from parallel worktrees would conflict. Run `graphify update .` once on the merged tree.
5. **The log record name changed.** The search handler now logs as `app.services.search_documents_tool` instead of `app.services.tool_dispatcher`, because the plan specifies the module's own logger. No test or reader depends on the old name (I grepped for it).
6. **The baselines record an inherited hang.** `test_096` hangs at PHASE_BASE in all 5 cases: `run_lifecycle._watch` spins on a failing `is_run_cancelled` registry read. It is recorded in 272-BASELINES.md as red at base, and it is evidence neither way for this phase.

## Known Stubs

None. `retrieval_scope.py` has no `resolve_document_scope` on purpose; 272-03 owns it. The contract module carries types and data only.

## Inherited, not fixed

- `tests/unit/test_retrieval_service.py`: all 15 cases are red at base and stay red. Sync tests call async functions (`TypeError: cannot unpack non-iterable coroutine object`). The retarget was mechanical only.
- The comments inside the moved handler and functions still cite their old locations (for example `retrieval_service._vector_search:73`). They were left verbatim, since a pure move does not edit them; refresh them when 272-04 rewrites the handler.

## Threat Flags

None. No new endpoint, auth path or schema. T-272-01..05 are mitigated as planned: the AST-equality suites, the retargeted audit patches with a positive control, the function-local imports with a source fence and an import smoke run, ScopeResult typed for D-18, and the registry count of 29 pinned by the unchanged test_259/261/085.

## TDD Gate Compliance

- RED `test(272-01)` `ed8c2954c` comes before GREEN `refactor(272-01)` `d1824fe1f`.
- RED `test(272-01)` `af912529c` comes before GREEN `refactor(272-01)` `fdf05b575`.
- These are refactors (pure moves), so GREEN is committed as `refactor`, as the plan specifies.

## Self-Check: PASSED

- All 9 created files exist on disk.
- All 5 commits (`c4073077e`, `ed8c2954c`, `d1824fe1f`, `af912529c`, `fdf05b575`) are present in `git log`.
