---
phase: 278-one-home-for-tools-and-filters
plan: 04
subsystem: backend/retrieval + records
tags: [merged-tree-gates, seam-02, ledger, live-smoke]
status: complete
requires:
  - "278-01 pins, 278-02 vocabulary home, 278-03 split (move 18abc1ed5)"
provides:
  - "SEAM-02 measured on the merged tree (Task 1)"
  - "SC#4 merged-tree gate evidence (Task 1)"
  - "SC#5 live Anthropic two-tool turn evidenced by audit rows (Task 2, 278-VALIDATION.md)"
  - "Records written LAST: CLAUDE.md rows, ledger sections, SEED-224 partially-answered (Task 3)"
affects: [278-VALIDATION.md, CLAUDE.md, docs/HOT-FILE-LEDGER.md, SEED-224]
key-files:
  modified:
    - backend/app/services/retrieval_service.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/seeds/SEED-224-document-space-redesign-five-tab-rag-honesty.md
  created:
    - .planning/phases/278-one-home-for-tools-and-filters/278-VALIDATION.md
decisions:
  - "The vitest count gate's single red (WorkflowBuilderPage.canvas.test.tsx, a named SEED-171 suite) is recorded as INHERITED by provenance: 278 changed zero frontend files and the suite ?raw-imports only frontend sources. It is recorded as provably unmodified, never as fine."
metrics:
  completed: "2026-10-13"
  tasks: "3 of 3"
---

# Phase 278 Plan 04: Merged-tree close Summary

SEAM-02 was measured closed. On the merged tree, SC#4's backend failing set is identical to base. One live Anthropic `claude-sonnet-5` turn after the split ran `search_documents` and `execute_code` and wrote `search.query` (non-null run_id) and `code.execute` audit rows, with key sets identical to pre-278 rows of the same outcome. The records were written LAST: `tool_dispatcher.py` reads G-5 DISCHARGED, the `retrieval_service.py` row is corrected beside its struck original, three newly-firing or previously-absent rows were added, and SEED-224 is `partially-answered`. Task 1 ran in the first executor; Tasks 2-3 ran in a continuation executor after the operator ran the turn.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `2757b9e51` | docs(278-04): retrieval_service back-compat comment names the post-split importer (AST-identical) |
| (partial summary) | `9a213e38e` | docs(278-04): partial summary — Task 1 merged-tree gates + SEAM-02 measurement; paused at Task 2 checkpoint |
| 2 | `42eca96c1` | docs(278-04): SC#5 live Anthropic two-tool smoke — UAT scoreboard with audit evidence |
| 3 | `3b625c8fd` | docs(278-04): ledger close — tool_dispatcher discharged, vocabulary rows, SEAM-02 records, SEED-224 partially-answered |

`git show --stat 2757b9e51` lists only `backend/app/services/retrieval_service.py` (1 file, +3/-1).

HEAD was checked for all three earlier plans before starting: `git log --oneline | grep -c "(278-0N)"` gives 278-01 = 4, 278-02 = 3, 278-03 = 3.

## SEAM-02 measurement (D-09: measured, not quoted)

- **Triple for `backend/app/services/retrieval_service.py` (CLAUDE.md recipe, before the comment commit): `23 / 12 / 174`.**
  - The 12 phase buckets are `044 058 08 098 111.1 164 20 231 241 26 272 28`. None is a six-digit quick-task bucket. The two-digit buckets are real phases (`feat(08-02)`, `feat(20-24)`, `feat(26-01)`, `feat(28-0x)`).
  - The stale CLAUDE.md row reads `19 / 11 / 456`.
  - ~~After `2757b9e51` the commit count is 24, because the comment commit has no numeric phase scope: it adds a commit, not a phase.~~ **CORRECTED at Task 3 (measured):** the comment commit's scope `docs(278-04)` IS numeric, so it adds the `278` bucket too. The final-tree triple is **`24 / 13 / 176`**.
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

## Task 2: SC#5 live smoke (evidence, read-only, LOCAL DB)

The operator restarted the backend on the post-split code and replied *"done, searched invoices"*. The prompt was sent in a new chat on Anthropic `claude-sonnet-5`: *"Search my documents for anything about invoices, then use execute_code to count how many results came back and print the count."*

- **Backend provenance:** port 8000 is held by PID 40336, created 2026-10-13 07:38:06 local (03:38:06 UTC). That is after the move commit `18abc1ed5` (2026-10-12T22:20:42Z) and 47 s before the run started. The pre-split PID 32740 is gone. Both ran on the system Python (`C:\Python312`), not the venv; recorded as an observation only.
- **Query:** scratchpad `smoke_rows.py` / `smoke_runs.py`, asyncpg against `127.0.0.1:54322` with `SET default_transaction_read_only = on`, after asserting the DSN is local. The Supabase MCP was not used.

| action_type | audit_log.id | created_at (UTC) | run_id | keys |
|---|---|---|---|---|
| `search.query` | `b3d65512-1f21-4f31-b983-49204ff34e8e` | 2026-10-13 03:39:02.135852 | `09c962aa-3aa6-4061-be0d-ae076c3f5b21` | `document_ids, filters, folder_ids, parent_run_id, query_text, result_kind, run_id, similarities, thread_id` |
| `code.execute` | `447164bb-cb05-4a14-aadf-7785944c1584` | 2026-10-13 03:39:21.766717 | null (expected) | `language, thread_id` |

- **Key-set match, by outcome:**
  - The new `search.query` row has `result_kind = passages` and `filters = []`. Among pre-278 `passages` rows there are 3 variants, and the new key set is **IDENTICAL** to the 9-key variant (n=29, latest 2026-10-12 08:08:47 UTC, the `ref_rows.py` reference `0ffe8cd7…`).
  - The other two variants add `matched_document_count` (and `undated_excluded`). Only the filtered writer adds those keys (`search_documents_tool.py:1311`); this turn took the unfiltered writer (`:1153`).
  - The `code.execute` key set is IDENTICAL to its single pre-278 variant (n=200).
- **Cross-check:**
  - `runs.run_id = 09c962aa…` exists: `status completed`, `model claude-sonnet-5`, `provider anthropic`, 03:38:53 → 03:39:30 UTC, on thread `c1c1e6a7-5f49-476a-b6d0-ee712543c164`. It is that thread's only, and so latest, run. There is no `workflow_runs` row, as expected for chat.
  - The assistant message's `tool_calls` are `search_documents` (done) then `execute_code` (done).
  - The final answer reports 5 results. The audit row carries 3 distinct `document_ids`: passages vs distinct documents, so the two do not conflict.
- **SC#5: MET.** `278-VALIDATION.md` holds the 8-row roster derived from `MODEL_CAPABILITIES`: 1 run, and 7 ⛔ not run by decision. It also holds the 4 axes: multi-tool satisfied by the Anthropic row; parallel-thread and long-message ⛔ not run by decision. No row is omitted.

## Task 3: records written LAST

### Re-derived triples (final tree, CLAUDE.md recipe, six-digit buckets subtracted)

| File | Triple | Note |
|---|---|---|
| `backend/app/services/tool_dispatcher.py` | **99 / 44 / 274** (was `98 / 43 / 5068`) | `260529`, `260705` subtracted |
| `backend/app/services/retrieval_service.py` | **24 / 13 / 176** (was `19 / 11 / 456` in CLAUDE.md, `23 / 12 / 174` in the scan list) | |
| `backend/app/services/retrieval_scope.py` | **5 / 3 / 463** (was `4 / 2 / 464`) | ⚠ now FIRES (272, 275, 278) |
| `backend/app/services/document_search_service.py` | **5 / 3 / 584** (was `4 / 2 / 587`) | ⚠ now FIRES (271, 275, 278) |
| `backend/app/services/view_filter_compiler.py` | **7 / 6 / 302** (was `6 / 5 / 300`) | FIRES; had no CLAUDE.md row |
| `backend/app/services/document_vocabulary.py` | 1 / 1 / 38 | young |
| `tools/__init__.py` · `base.py` · `documents.py` · `skills.py` · `sandbox.py` · `runtime_gap.py` · `render_template.py` · `workspace.py` · `memory.py` · `agent_control.py` · `connector.py` | 1 / 1 / 20 · 149 · 762 · 759 · 1218 · 310 · 787 · 223 · 121 · 478 · 380 | young (all one commit, `18abc1ed5`) |

### What changed (commit `3b625c8fd`; `git show --stat` = CLAUDE.md, docs/HOT-FILE-LEDGER.md, SEED-224)

- **CLAUDE.md FIRING table:**
  - `retrieval_service.py` → `24 / 13 / 176 (was 19 / 11 / 456) | ~~⛔ extraction still OWED (SEED-224, since 231)~~ ✅ DISCHARGED 272-01 (278)`.
  - `tool_dispatcher.py` → `99 / 44 / 274 (was 98 / 43 / 5068) | ✅ G-5 DISCHARGED (278-03): registry only; handlers in services/tools/ · ⛔`.
  - New FIRING rows for `retrieval_scope.py`, `document_search_service.py` and `view_filter_compiler.py`.
  - Every verdict cell is ≤ 80 chars (asserted in the edit script; the gate is clean).
- **docs/HOT-FILE-LEDGER.md:**
  - A `⚠ CORRECTED 2026-10-13 (Phase 278, SEAM-02)` paragraph was inserted directly after the "THE EXTRACTION IS STILL OWED" block. That block is unedited.
  - 5 scan rows were re-derived (each disposition ≤ 200 chars, asserted), and the 12 young rows read `1 / 1 / N (was 0 / 0 / 0)`.
  - Each "added AT PLANNING" section got a Phase-278-close line.
  - A new `## Phase 278 close` block holds 5 sections. The `tool_dispatcher.py` one copies the replaced CLAUDE.md verdict verbatim under "CLAUDE.md verdict cell as of 2026-10-13 (replaced by 278-04)", and records the split: move SHA, module line counts, 30 tools, registry/AST pins, D-07/no-loss, and the logger-name change.
- **SEED-224:**
  - `status: partially-answered`, with `partial: true` and `folded_into: "278"` kept.
  - The new `status_note` ends `Previously: ` followed by the old note verbatim.
  - The section-4 `retrieval_service.py` row is struck, with a correction line under the table.
  - The rest of the body is unchanged (4 hunks only).
- `278-VALIDATION.md` already carries the pointer to this SUMMARY's gate evidence (committed in `42eca96c1`).

### Gates (run on the final content)

| Command | Exit | Output |
|---|---|---|
| `node scripts/check-claude-md-size.cjs` | **0** | `CLAUDE.md 89980 chars 60% of limit headroom 60020 [OK]`. Under the 120k warn band; no cell/row findings |
| `node scripts/check-hot-file-ledger.cjs .planning/phases/278-one-home-for-tools-and-filters` | **0** | `scan list: 528 rows · subject: 71 files · watched: 17` → `ledger gate OK` |
| `node scripts/check-seeds-register.cjs` | **0** | `361/361 parsed, 0 duplicate ids, 361/361 carry all 5 required keys`. `partially-answered` is in the gate's status enum (`:351`); SEED-224 parsed with no error |

## Deviations from Plan

- **[Inherited, not fixed] `check-landing-drift.cjs` exits 1.** It was already in `deferred-items.md` from 278-03 and is out of scope by orchestrator instruction (held for phase close).
- **[Inherited, recorded] vitest gate `failed 1`.** The suite is a byte-unchanged SEED-171 suite and the frontend diff since base is empty. The evidence is above.
- **[Rule 1 - record correction] The partial summary's retrieval_service "adds a commit, not a phase" claim was wrong.** `docs(278-04)` is a numeric scope, so the final triple is `24 / 13 / 176`. The sentence is struck through above, not deleted.
- **[Plan option taken] view_filter_compiler.py got a CLAUDE.md FIRING row** even though 278 did not newly cross it. It had fired since 272 with no row.
- The plan's 15-minute audit window was widened to 60 minutes, per the orchestrator's query. Exactly 2 rows fell in it, and both are post-move.

## Self-Check: PASSED

- FOUND: `278-VALIDATION.md`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `SEED-224-document-space-redesign-five-tab-rag-honesty.md`
- FOUND commits: `2757b9e51`, `9a213e38e`, `42eca96c1`, `3b625c8fd` (each `git show --stat` lists only its intended paths)
- No STATE.md / ROADMAP.md writes; no `gsd-sdk query state.*` / `phase.complete` calls; no push; no graphify; no Supabase MCP use.
