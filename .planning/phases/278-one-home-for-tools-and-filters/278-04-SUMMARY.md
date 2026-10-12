---
phase: 278-one-home-for-tools-and-filters
plan: 04
subsystem: backend/retrieval + records
tags: [merged-tree-gates, seam-02, ledger, live-smoke]
status: checkpoint-task-2
requires:
  - "278-01 pins, 278-02 vocabulary home, 278-03 split (move 18abc1ed5)"
provides:
  - "SEAM-02 measured on the merged tree (Task 1)"
  - "SC#4 merged-tree gate evidence (Task 1)"
affects: [278-VALIDATION.md, CLAUDE.md, docs/HOT-FILE-LEDGER.md, SEED-224]
key-files:
  modified:
    - backend/app/services/retrieval_service.py
decisions:
  - "The vitest count gate's single red (WorkflowBuilderPage.canvas.test.tsx, a named SEED-171 suite) is recorded as INHERITED by provenance: 278 changed zero frontend files and the suite ?raw-imports only frontend sources. It is recorded as provably unmodified, never as fine."
metrics:
  completed: "Task 1 only (2026-10-13); Tasks 2-3 pending"
  tasks: "1 of 3"
---

# Phase 278 Plan 04: Merged-tree close (PARTIAL: stopped at the Task 2 checkpoint)

**This summary is PARTIAL.** Task 1 is done and committed. The plan stopped at Task 2, the operator-run live Anthropic two-tool turn (SC#5). Task 3 (records written LAST) has not started. A continuation agent finishes this file.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `2757b9e51` | docs(278-04): retrieval_service back-compat comment names the post-split importer (AST-identical) |

`git show --stat 2757b9e51` lists only `backend/app/services/retrieval_service.py` (1 file, +3/-1).

HEAD was checked for all three earlier plans before starting: `git log --oneline | grep -c "(278-0N)"` gives 278-01 = 4, 278-02 = 3, 278-03 = 3.

## SEAM-02 measurement (D-09: measured, not quoted)

- **Triple for `backend/app/services/retrieval_service.py` (CLAUDE.md recipe, before the comment commit): `23 / 12 / 174`.**
  - The 12 phase buckets are `044 058 08 098 111.1 164 20 231 241 26 272 28`. None is a six-digit quick-task bucket. The two-digit buckets are real phases (`feat(08-02)`, `feat(20-24)`, `feat(26-01)`, `feat(28-0x)`).
  - The stale CLAUDE.md row reads `19 / 11 / 456`.
  - After `2757b9e51` the commit count is 24, because the comment commit has no numeric phase scope: it adds a commit, not a phase. Task 3 re-derives every triple on the final tree.
- **Top-level defs (`ast`): `['search_documents']`.** Exactly one, as expected.
- **`pytest tests/unit/test_272_pure_move.py -q`: `9 passed`.**
- **D-10:** the 7 back-compat re-exports are untouched.

### The comment-only fix (RESEARCH open question 1)

- The importer line `tool_dispatcher.py:47  search_documents, resolve_document_id, fetch_full_document` is kept, struck through (`~~…~~`).
- Under it, two new comment lines name the real importer after the split: `tools/documents.py:43` (`resolve_document_id`, `fetch_full_document`). They also say that nothing imports `search_documents` through `tool_dispatcher` any more.
- This was checked against the code: `backend/app/services/tools/documents.py:43` is `from app.services.retrieval_service import resolve_document_id, fetch_full_document`, and grep finds no `retrieval_service` reference in `tool_dispatcher.py`.

Whole-module AST identity against HEAD, before the commit:
```
ast.dump(ast.parse(git show HEAD:backend/app/services/retrieval_service.py)) == ast.dump(ast.parse(<working file>))
AST identical: True
```

## Merged-tree gates (SC#4)

### 1. Full backend unit gate (under the local-DB lock, taken with noclobber, released after)

`pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider` (backend/, venv, HEAD `2757b9e51`):

```
71 failed, 7222 passed, 1 skipped, 2 xfailed, 2 xpassed, 45 warnings in 369.97s (0:06:09)
```

- **0 collection errors:** `grep -c "ERROR collecting|errors during collection"` = 0. The `ERROR` lines in the log are captured logger output, not collection errors.
- **Set diff:** node ids were normalised by stripping `FAILED `, ` - msg`, comment lines, and the unraisable-warning text that pytest glues onto two ids. The base set is `278-base-failed.txt`.
  ```
  base=71 new=71
  comm -13 (new-not-in-base): EMPTY
  comm -23 (base-not-in-new): EMPTY
  ```
- The failing set is **identical** to the phase base. This confirms 278-03's wave-gate measurement on the whole merged tree.

### 2. Targeted pins

```
pytest "tests/unit/test_272_pure_move.py::test_unfiltered_rpc_calls_are_pinned" tests/unit/test_275_*.py tests/unit/test_278_*.py -q
281 passed, 1 warning in 19.37s
```

Plan verify command (`test_272_pure_move`, `test_278_registry_pin`, `test_278_pure_move`, `test_278_vocabulary_one_home`, `test_259_closed_core_inventory`): **67 passed**.

`test_272_pure_move.py` + `test_272_search_tool_move.py`: **15 passed**.

### 3. Vitest count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root, one run)

Verdict, verbatim:
```
total                                      9400   10192    +792
total 10192  ·  failed 1  ·  pinned total 9400
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

- **No per-file decrease.** The only violation reason is `[failing-tests]`. The table has 0 rows with a negative delta, and 5 files are `new`.
- **The failing test was captured from the gate's own persisted JSON before any re-run.** The report `vitest-count-gate-48560-1791844491972.json` was copied to the scratchpad.
  - `numFailedTests 1`.
  - File: **`src/pages/WorkflowBuilderPage.canvas.test.tsx`**.
  - Test: `WorkflowBuilderPage canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns`.
  - Error: `Error: STACK_TRACE_ERROR` (duration 6341 ms).
- **Inherited, shown by provenance (provably unmodified, NOT "fine"):**
  - `git diff --stat 25b4235c5 HEAD -- frontend/` is **empty**. `git diff --numstat` gives 0 rows, and `git status --short frontend/` shows only the untracked poster jpgs under `public/`.
  - The suite's `?raw` imports are `./WorkflowBuilderPage?raw` and `@/components/workflows/useTemplateFirstDraft?raw`. Both are frontend files, both unchanged. It imports no backend source, so every input to this suite is byte-identical to the phase base.
  - The suite is the fifth named SEED-171 cap-independent flaky suite (`docs/VITEST-COUNT-GATE.md` §(b)).
  - An isolated re-run *after* the capture gave `1 passed (1)`, `154 passed (154)`. That is one green sample, which does not prove innocence; it is recorded only as an observation.
- `count gate OK` was not reached on this run. The deterministic halves of the contract held: no per-file decrease, and the 278-scoped suites passed.

### 4. Guard scripts

| Command | Exit | Note |
|---|---|---|
| `node scripts/check-extension-contract.cjs` | **0** | `extension contract gate OK — all 17 files conform` |
| `node scripts/check-landing-drift.cjs` | **1** | **INHERITED, already logged in `deferred-items.md` by 278-03** (see below) |

`check-landing-drift`: `BUILTIN_TOOL_COUNT` source 30 vs `facts.ts` 29. Proof that this is inherited:
- At base `25b4235c5`, `frontend/src/landing/facts.ts:155` already reads `BUILTIN_TOOL_COUNT = 29`.
- The registry has held 30 tools since Phase 273, and `test_278_registry_pin.py` (green) proves the `_TOOL_REGISTRY` literal is identical to base.
- The frontend is untouched since base.

Per the orchestrator's instruction, this is not fixed here. The plan's "exit 0" acceptance item for it is **not met, by inheritance**.

### 5. D-07 retarget-only and no-loss on the merged history (move SHA `18abc1ed5`)

```
check-test-retarget-only.py 18abc1ed5^ 18abc1ed5           -> retarget-only: CLEAR (...)            exit=0
check-test-retarget-only.py --no-loss 18abc1ed5^ 18abc1ed5 -> no-loss: CLEAR (4332 removed lines ...) exit=0
```

## Task 2 preparation (done before pausing)

- **Anthropic model, derived from `MODEL_CAPABILITIES`: `claude-sonnet-5`.**
  - `config.py:414`: `capability_source: registry`, `native_tools: True`, `emit_tier: force`, live `/models` 2026-06-30.
  - It is newer than `claude-opus-4-8` (live 2026-06-07).
- **Pre-278 reference rows** come from a read-only asyncpg query against the LOCAL DB (`127.0.0.1:54322`, `default_transaction_read_only = on`), restricted to rows before the move commit `2026-10-13T02:20:42+04:00`. The Supabase MCP was not used.
  - `search.query`, latest: `0ffe8cd7…` (2026-10-12 08:08 UTC), run_id `7bbfff2e…` (non-null).
    - keys: `document_ids, filters, folder_ids, parent_run_id, query_text, result_kind, run_id, similarities, thread_id`.
    - ⚠ **The key set is conditional on the search outcome.** The last 200 pre-278 rows show 8 variants, including `+matched_document_count` (n=28, n=20), `+undated_excluded` (n=21) and a legacy 7-key set (n=92).
    - The post-smoke comparison must therefore match a new row against the pre-278 variant **for the same outcome**, not against one fixed set.
  - `code.execute`, latest: `defd6194…` (2026-10-05 14:54 UTC).
    - keys: `language, thread_id`.
    - `run_id` is NULL on every one of the last 200 rows (one variant, n=200). Only `search.query` carries a run_id.
  - Rows of either action since the move commit: **0**. Any row the smoke produces is therefore unambiguously post-split.
- **Port 8000:** a uvicorn is already listening.
  - PID 32740, started 2026-10-12 07:16, `C:\Python312\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
  - It was started **before** the 278 split, and with the **system Python**, not `backend/venv`.
  - It was not touched (operator rule).

## Deviations from Plan

- **[Inherited, not fixed] `check-landing-drift.cjs` exits 1.** It was already in `deferred-items.md` from 278-03 and is out of scope by orchestrator instruction.
- **[Inherited, recorded] vitest gate `failed 1`.** The suite is a byte-unchanged SEED-171 suite and the frontend diff since base is empty. The evidence is above.

## Self-Check (Task 1 scope)

- FOUND commit `2757b9e51` (`git show --stat` = retrieval_service.py only).
- No STATE.md / ROADMAP.md writes; no `gsd-sdk query state.*` calls.
