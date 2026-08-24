---
phase: 194-stop-a-running-workflow
plan: 01
task: 1
artifact: baseline
measured_at: 743965a1
base_asserted: d2a3b51b
branch: develop
measured_on: 2026-08-16
---

# Phase 194 — Wave 0 Baselines

> **Every gate this phase is scored against has a figure measured HERE, at this phase's own base
> commit — not inherited from RESEARCH (`05f664a0`) or PATTERNS (`0dcb4a8e`).**
>
> This repository's figures rot fast. The `WorkflowsPage.tsx` ledger cell has gone stale four
> consecutive times and once **within a single day**. A figure carried across three commits is a
> claim, not a measurement. Every later plan in Phase 194 compares its gates to **this file**, never
> to RESEARCH's or PATTERNS' numbers.

---

## ⚠ The commit these figures were measured at — and why it is not the one the plan names

`194-01-PLAN.md` § `<context>` asserts a base of **`d2a3b51b`**. That assertion is **satisfied, not
violated**: this plan ran on the **main working tree** (no worktree), on branch `develop`, at HEAD
**`743965a1`**, and `d2a3b51b` is a verified ancestor of it.

```
git rev-parse HEAD                              → 743965a18b76458690cca8216fb6bb3ba0b79511
git rev-parse --short HEAD                      → 743965a1
git merge-base --is-ancestor d2a3b51b HEAD      → exit 0   (ANCESTOR-OK)
```

The two commits between `d2a3b51b` and `743965a1` are **this phase's own planning documents**
(`docs(194): create phase plan — 13 plans in 8 waves`, ×2). No source file, no test file and no
migration moved. **So every figure below is recorded as measured at `743965a1`, and where the plan
or an upstream artifact quotes `d2a3b51b`, the newer commit is named beside it rather than the
older value being silently reused.** That is this project's standing habit and it is the entire
point of this task.

**Bottom line, stated explicitly so no later reader has to infer it: re-derived at `743965a1`; all
four gate verdicts and all six G-5 figures are UNMOVED from RESEARCH's readings at `05f664a0` and
PATTERNS' at `0dcb4a8e`. Exactly one subordinate figure moved — the backend-unit PASSED count — and
it is recorded beside its earlier value in § (d).**

---

## (a) Frontend count gate

**Command** (run from the repository root; the script resolves `FRONTEND_DIR` from `__dirname`, so
it is cwd-independent — `scripts/vitest-count-gate.cjs:2382-2383`):

```bash
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs
```

**Raw output — the verdict line VERBATIM, never a summary:**

```
  total                                      3868    3918     +50
  total 3918  ·  failed 0  ·  pinned total 3868
--------------------------------------------------------------
count gate OK — 75/75 pinned files present, no per-file decrease, 0 failing.
```

| Figure | Value at `743965a1` | RESEARCH at `05f664a0` | Moved? |
|---|---|---|---|
| verdict | `count gate OK` | `count gate OK` | no |
| total | **3918** | 3918 | no |
| failed | **0** | 0 | no |
| pinned total | **3868** | 3868 | no |
| pinned files present | **75/75** | 75/75 | no |
| exit code | **0** | 0 | no |

### ⚠ A GROWING TOTAL IS THE GATE WORKING, NOT A REGRESSION.

The gate's contract is **no per-file DECREASE** and **zero failing** — it is *never* a fixed grand
total. A later reader who runs this command and sees a number larger than **3918** has seen the
correct current one, not a broken gate. The `+50` in the raw output above is the live proof: fifty
tests have been ADDED since the pinned baseline of 3868 and the gate still reads `OK`. Re-derive
with the command above and read the **verdict line**, never a summary.

The figure has already rotted twice on record — `3604` (2026-08-14) → `3892` → `3918` — and the
second rot took **one day**. `CLAUDE.md` publishes the intermediate readings for exactly this
reason: *the rate is the point*.

### ⚠ Cap 2 is NOT deterministic — the protocol that was followed here

Phase 193.2 measured `failed` **4, 11 and 6** on three consecutive runs of a tree whose frontend
diff was **EMPTY**. The rule (`194-01-PLAN.md` Task 1a, `CLAUDE.md` § Parallel execution rule 2) is:
**if `failed` is non-zero, capture the failing FILENAMES before re-running anything**, then re-run
once and record both readings side by side.

**`failed` was 0 on the first run, so no filename capture and no second run was owed.** Only one
reading exists and it is the one above. Recording this explicitly matters: `193.2-02` broke this
rule and could not afterwards prove its three failing cases were innocent.

⚠ `GSD_VITEST_MAX_WORKERS=2` is load-bearing. `CLAUDE.md` documented a cap of **4** until
2026-08-14; that number **ROTTED** with suite size (cap 4 → `failed` 17, then 4, then 3 on ONE
identical commit; cap 2 → 0 and 0). Every frontend run in Phase 194 sets **2**.

---

## (b) Typecheck

**Command** (⚠ the `-p tsconfig.app.json` flag is **load-bearing** — a bare `--noEmit` checks
**ZERO** files and reports a meaningless 0):

```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit
```

**Raw output — the error count, derived by piping the same command through `grep -cE "error TS"`:**

```
33
```

Tail of the raw error stream, so the reading is attributable to real output rather than a bare
number:

```
      Type '() => StreamsState' is not assignable to type '() => { bucketsBySurface: Map<string, Map<string, Message[]>>; ... }'.
        Call signature return types 'StreamsState' and '{ ... }' are incompatible.
          The types of 'viewedThreadId' are incompatible between these types.
            Type 'string | null' is not assignable to type 'null'.
              Type 'string' is not assignable to type 'null'.
```

| Figure | Value at `743965a1` | RESEARCH at `05f664a0` | Moved? |
|---|---|---|---|
| `tsc -p tsconfig.app.json --noEmit` errors | **33** | 33 | no |

**33 is the documented, unmoved baseline.** Every task in Phase 194 re-runs this command after its
commit and expects **33**. A reading of 0 means the `-p` flag was dropped, not that the tree got
better.

---

## (c) Cancel-path pytest

**Command:**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/test_062_cancel_run.py tests/test_cancel_run.py tests/test_run_lifecycle.py tests/test_migration_115.py -q
```

**Raw output:**

```
............                                                             [100%]
12 passed, 1 warning in 0.75s
```

| Figure | Value at `743965a1` | RESEARCH at `05f664a0` | Moved? |
|---|---|---|---|
| cancel-path pytest (4 files) | **12 passed / 0 failed** | 12 passed | no |

The single warning is the pre-existing `RequestsDependencyWarning` about urllib3/chardet versions —
environmental, unrelated to the cancel path, present on every backend run in this repository.

These four files are the suites Phase 194's backend work extends (`test_062_cancel_run.py`,
`test_run_lifecycle.py`) or copies as a template (`test_migration_115.py` → the future
`test_migration_119.py`). **12 is the number a later plan must not lower.**

---

## (d) Backend unit rot baseline

**Command:**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/unit -q
```

**Raw output:**

```
62 failed, 2242 passed, 2 xfailed, 2 xpassed, 32 warnings in 30.55s
```

| Figure | Value at `743965a1` | Earlier reading | Moved? |
|---|---|---|---|
| failed | **62** | 62 (RESEARCH `05f664a0`; VALIDATION § Baselines) | no |
| passed | **2242** | **was ~2221** at `05f664a0` — recorded **beside**, not over | ⚠ **yes, +21** |
| xfailed / xpassed | **2 / 2** | not recorded upstream | — |

⚠ **The one figure in this whole file that moved.** The PASSED count rose from RESEARCH's `~2221`
to **2242** while the FAILED count stayed at exactly **62**. The earlier value is kept beside the
new one with its commit named, never overwritten — the habit the `CLAUDE.md` hot-file ledger keeps
about itself. A rising passed-count with a flat failed-count is tests being ADDED, which is the same
shape as § (a)'s `+50` and is the suite working.

### ⚠ EVERY LATER COMPARISON IN THIS PHASE IS BY **NAME**, NEVER BY COUNT (SEED-056 / SEED-165)

A count comparison cannot see one failure being fixed while a different one appears. The full list
of the **62** failing test names at `743965a1` follows, so a later wave can diff by name:

```
tests/unit/test_061_consumer.py::test_xread_advances_last_id
tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers
tests/unit/test_111_1_reembed_kickoff.py::test_model_change_kicks_reembed
tests/unit/test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed
tests/unit/test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize
tests/unit/test_111_1_reembed_kickoff.py::test_no_change_save_does_not_reembed
tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally
tests/unit/test_db_runs.py::test_insert_assistant_message_sql_shape
tests/unit/test_db_runs.py::test_insert_assistant_message_optional_fields_none
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_max_iterations_8
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_prompt
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explicit_default_mode_same_as_omitted
tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden
tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden
tests/unit/test_forced_emit.py::test_forced_emit_judge_verdict_unmocked
tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix
tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase
tests/unit/test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate
tests/unit/test_lifespan.py::test_supabase_aclose_after_pg_pool
tests/unit/test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox
tests/unit/test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily
tests/unit/test_multimodal_query.py::test_image_chunk_insertion
tests/unit/test_multimodal_query.py::test_query_tables_returns_data
tests/unit/test_multimodal_query.py::test_query_tables_document_not_found
tests/unit/test_multimodal_query.py::test_query_tables_column_filter
tests/unit/test_multimodal_query.py::test_query_tables_row_cap
tests/unit/test_phase56_iteration_start.py::TestIterationStartInProductionSource::test_threads_py_emits_iteration_start_at_loop_top
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_embed_texts_with_query
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_supabase_rpc_match_document_chunks
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_no_chunks_match
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_rpc_data_is_none
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_formatted_results
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_uses_unknown_filename_when_doc_not_found
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_multiple_results
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_value
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_zero_avg_sim_when_no_results
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_hybrid_empty_returns_tuple
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_chunk_index_none_when_missing
tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number
tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_defaults_version_number_to_1
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_uploads_and_inserts
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_empty_output
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_non_select_query
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_insert_query
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_query_with_semicolon
tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc
tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_raises_runtime_error_on_rpc_exception
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_empty
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_data_is_none
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_markdown_table_for_small_results
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_markdown_table_has_header_and_separator
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_truncates_to_20_rows_with_note
tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync
```

⚠ **None of the 62 touches the cancel path, `run_lifecycle.py`, `workflow_runs`, `workflow_phases`
or `finish_run`.** The rot set is concentrated in retrieval / SQL / multimodal / sandbox /
extraction / lifespan suites (SEED-056 / SEED-165). **Any NEW name appearing in this list after a
Phase 194 commit is that commit's regression**, and the count staying at 62 proves nothing on its
own.

---

## (e) The six G-5 figures (D-01 / D-02)

Both files are far past the ≥3-phase threshold and **neither is a ROW in the `CLAUDE.md` hot-file
ledger**. Writing those two rows is a phase deliverable (D-02), not a nicety — a hot file absent
from the table is permanently invisible to its own guardrail, which is how `WorkflowsPage.tsx`
escaped G-5 for ten phases, `WorkflowDoorSwitch.tsx` for six and `WorkflowBuilderPage.tsx` for ten.

### `frontend/src/components/chat/RunCard.tsx`

```bash
git log --oneline -- frontend/src/components/chat/RunCard.tsx | wc -l                → 20
git log --format=%s -- frontend/src/components/chat/RunCard.tsx \
  | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u                 → 9 buckets
wc -l frontend/src/components/chat/RunCard.tsx                                       → 550
```

Raw bucket output:

```
075.7 075.8 076.1 076.2 095 095.1 128 155 streaming
```

⚠ **THE NON-PHASE BUCKET, NAMED RATHER THAN MERELY SUBTRACTED: `streaming` IS NOT A PHASE.** It is
produced by an untagged 075.x follow-up **pair**, verified by direct `git log` at `743965a1`:

```
0dce56aa  fix(streaming): close silence gaps in multi-iteration agent runs (075.x follow-up)
61e5eb1e  revert(streaming): remove silence-gap SSE changes that caused UI regressions
```

Counted **OUT**, the same way the `WorkflowBuilderPage.tsx` ledger row already documents about its
own `260809` / `260814` quick-task buckets, and the same way the `publish_service.py` row documents
about `quick`.

> **⇒ `20 commits / 8 phases / 550 L`.**
> **The raw recipe prints 9 buckets; the PHASE count is 8. Both are recorded, the loser beside the
> winner** — because the next reader will run the same command and see the 9.

| Figure | `743965a1` | RESEARCH `05f664a0` | PATTERNS `0dcb4a8e` | CONTEXT | Moved? |
|---|---|---|---|---|---|
| commits | **20** | 20 | 20 | 20 | no |
| raw buckets | **9** | 9 | 9 | "~9" | no |
| PHASES (after subtraction) | **8** | 8 | 8 | not stated | no |
| lines | **550** | 550 | 550 | — | no |

### `frontend/src/components/panel/WorkspacePanel.tsx`

```bash
git log --oneline -- frontend/src/components/panel/WorkspacePanel.tsx | wc -l        → 13
git log --format=%s -- frontend/src/components/panel/WorkspacePanel.tsx \
  | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u                 → 8 buckets
wc -l frontend/src/components/panel/WorkspacePanel.tsx                               → 493
```

Raw bucket output:

```
087 088 094 095.1 100 124 155 188
```

⚠ **THE SUBTRACTION IS NAMED HERE TOO, AND ITS RESULT IS ZERO: there are NO non-phase buckets on
this file.** All eight are real phases — no `quick`, no `260809`, no `260814`, no untagged pair.
That is a measurement, not an omission: a reader who finds no subtraction paragraph on this file
should be able to tell *"checked, none exist"* from *"nobody checked"*.

> **⇒ `13 commits / 8 phases / 493 L`.** Raw bucket count and phase count coincide at 8.

| Figure | `743965a1` | RESEARCH `05f664a0` | PATTERNS `0dcb4a8e` | CONTEXT | Moved? |
|---|---|---|---|---|---|
| commits | **13** | 13 | 13 | 13 | no |
| raw buckets | **8** | 8 | 8 | "~8" | no |
| PHASES (after subtraction) | **8** | 8 | 8 | not stated | no |
| lines | **493** | 493 | 493 | — | no |

### The ledger-invisibility measurement (CONTEXT D-01's claim, re-checked)

```bash
grep -o "RunCard.tsx" CLAUDE.md | wc -l         → 0
grep -o "WorkspacePanel.tsx" CLAUDE.md | wc -l  → 0
```

**Both are 0 at `743965a1`, matching RESEARCH's reading at `05f664a0`.**

⚠ **CONTEXT D-01's wording is measurably too generous and the correction is recorded beside it, not
over it.** D-01 says both names *"occur only inside other rows' prose."* Measured, **neither
filename appears in `CLAUDE.md` at all** — not in a row, not in prose. The conclusion D-01 draws is
unchanged and **strengthened**: these two files are more invisible to G-5 than the decision claims,
which is precisely why D-02 makes writing their ledger rows a deliverable.

---

## Summary table — what every later Phase 194 plan is scored against

| # | Gate | Baseline at `743965a1` | Re-derive with |
|---|---|---|---|
| a | frontend count gate | `count gate OK` · total **3918** · failed **0** · pinned total **3868** · **75/75** · exit 0 | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| b | typecheck | **33** errors | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` |
| c | cancel-path pytest (4 files) | **12 passed** | `cd backend && venv/Scripts/python.exe -m pytest tests/test_062_cancel_run.py tests/test_cancel_run.py tests/test_run_lifecycle.py tests/test_migration_115.py -q` |
| d | backend unit rot | **62 failed / 2242 passed** — compare **by NAME** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit -q` |
| e | `RunCard.tsx` G-5 | **20 / 8 / 550** (9 raw buckets; `streaming` counted out) | the three commands in § (e) |
| e | `WorkspacePanel.tsx` G-5 | **13 / 8 / 493** (8 raw buckets; zero non-phase) | the three commands in § (e) |
| e | ledger invisibility | both filenames **0** occurrences in `CLAUDE.md` | `grep -o "<file>.tsx" CLAUDE.md \| wc -l` |

---

## ⚠ This file will go stale, and saying so is part of its job

`CLAUDE.md`'s ledger records a figure going stale **on the same afternoon it was written**, and one
cell has been corrected **three times, twice inside a single phase**. Every figure above is dated
`2026-08-16` at `743965a1`. **A later plan that measures a different number has measured the correct
current one** — re-derive with the command beside the figure, and record the new value **beside**
the old with the commit named. Never over it.
