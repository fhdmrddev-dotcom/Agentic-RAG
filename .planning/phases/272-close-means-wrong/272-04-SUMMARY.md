---
phase: 272-close-means-wrong
plan: 04
subsystem: retrieval tool / agent loop
tags: [FIND-07, search_documents, filters, result-kinds, retry-lock, audit, prompt, vocabulary]
requires:
  - "272-02 — the `filters` argument contract on SEARCH_DOCUMENTS_TOOL"
  - "272-03 — resolve_document_scope / nearby_values / canonical_stored_values / top_document_types; search_documents(document_ids=...)"
provides:
  - "search_documents honours `filters` (and the mapped legacy metadata_filter) end to end"
  - "four result kinds + refused_retry, recorded by ONE audit writer (filters as applied + result_kind + counts)"
  - "ToolContext.empty_filter_fields_in_run — the D-09 per-turn retry lock, shared with sub-agents"
  - "per-run vocabulary in the filters description; today's date in the system prompt"
  - "Library trend no longer counts invalid_filter / refused_retry rows"
affects: [272-05]
tech-stack:
  added: []
  patterns:
    - "canonicalise before compile: enum options, RLS stored spellings, numeric coercion"
    - "an empty scope is a restriction to nothing, short-circuited before any retrieval call"
    - "a by-reference run accumulator shared (not copied) into sub-agent contexts"
    - "one audit writer every arm calls; keys additive over the pre-272 row"
key-files:
  created:
    - backend/tests/unit/test_272_filter_validation.py
    - backend/tests/unit/test_272_result_kinds.py
    - backend/tests/unit/test_272_retry_lock.py
    - backend/tests/unit/test_272_prompt_and_vocabulary.py
    - backend/tests/unit/test_272_knowledge_health_kinds.py
  modified:
    - backend/app/services/search_documents_tool.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/agent_loop.py
    - backend/app/services/task_service.py
    - backend/app/api/knowledge_health.py
    - backend/tests/unit/test_272_search_tool_move.py
    - backend/tests/unit/test_268_search_audit_keys.py
    - backend/tests/test_2171_search_error_audit.py
decisions:
  - "A5: the D-09 lock set is SHARED with task sub-agents by reference (unlike dead_gap_tokens_in_run=set()), so a sub-agent cannot become an unfiltered bypass"
  - "An empty folder scope (folder_subtree_ids == []) returns kind 2 before any retrieval call on BOTH the filtered and the unfiltered path (272-03 carry-forward; 266 CR-01)"
  - "SearchTruncatedError is caught before ResolveError (it subclasses it) and is kind 4; any other ResolveError with status >= 500 is kind 4, the rest kind 3"
  - "A filtered search whose hits are all removed by the folder clip reports kind 2 not_searchable_yet, not kind 1 with an empty array"
  - "_lock_set uses isinstance(set), so a MagicMock ctx (test_2171) never reads as a live lock"
  - "today_line reads the server clock in UTC; _relative_window reads date.today() — the same on the UTC containers, can differ by a day locally near midnight (A4)"
metrics:
  duration: "~70 min"
  completed: 2026-10-03
  tasks: 3
  files: 13
---

# Phase 272 Plan 04: search_documents honours the filter — result kinds, retry lock, vocabulary Summary

`search_documents` now runs a filter end to end. It validates the filter, matches values to how they are actually stored, and resolves the documents the caller is allowed to read. It then returns one of four distinct results, refuses an unfiltered retry after a zero match, and records what it applied on one audit row. Each Deep run also tells the model today's date and which fields and values it can filter on.

Ran on the main tree, `develop`, sequentially. Start HEAD was asserted as `d3fd02a90`. The "wave-2 merge" that diffs are compared against is `b511aaeec`. `WAVE1_MERGE_SHA` is `020a0f41f7f9155783eb38790fef40e052bbcfcf`.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 RED | `2705d0b83` | test: parse / validate / canonicalise suite |
| 1 GREEN | `717c09aff` | feat: SearchCondition, FilterRefusal, parse_filter_args, validate_and_canonicalise |
| 2 RED | `cc7316c84` | test: result kinds + retry lock suites |
| 2 GREEN | `4754b3a8d` | feat: the handler, the ToolContext field, the one writer, plus the move/268/2171 re-drives |
| 2 (fix) | `f2001aa34` | test: the history proof drops a leading docstring, so a rewrite fails on the body |
| 3 RED | `24a6fa99b` | test: prompt/vocabulary + knowledge-health kinds suites |
| 3 GREEN | `4b7e59e74` | feat: vocabulary, today_line, agent_loop lines, task_service share, trend line |

## RED outputs (verbatim excerpts)

- **Task 1:** `30 failed, 1 passed`. The errors were 17× `AttributeError: module 'app.services.search_documents_tool' has no attribute 'validate_and_canonicalise'`, 6× `… 'parse_filter_args'`, 6× `… has no attribute 'canonical_stored_values'` and 1× `… 'SearchCondition'`. The one pass was the import-cycle source fence, which is green by design.
- **Task 2:** `22 failed, 1 passed`. There were 21× `AttributeError: … has no attribute 'resolve_document_scope'`. The ONE-writer fence failed with `AssertionError: exactly one write_audit_entry( call site, found 2`.
- **Task 3:** `16 failed, 3 passed`. The errors included `AttributeError: … no attribute 'with_search_vocabulary'` / `'today_line'` / `'SearchVocabulary'` / `'load_search_vocabulary'`, `AssertionError: assert 'Only add \`metadata_filter\`' not in 'You are a h…'`, and in the trend suite `assert 0 == 1` plus a dict mismatch. The 3 passes were trend cases that behave the same before and after the change: kind 2, provider error, and pre-272 rows.

## The four RED drives (each planted, run, then restored; restore checked with `cmp`)

| # | Plant | Result |
|---|---|---|
| (i) | `if scope.is_empty:` → `if False:` | `AssertionError: D-18: zero retrieval calls on an empty resolved set` / `assert [(('revenue',…)] == []`, giving `1 failed` |
| (ii) | lock check → `if False:` | `test_an_unfiltered_retry_is_refused_with_the_reason`: `json.decoder.JSONDecodeError` (the retry ran and returned `"No relevant documents found."`), giving `1 failed` |
| (iii) | history proof reads `HEAD` instead of `WAVE1_MERGE_SHA` | `AssertionError: at 020a0f41… handle_search_documents was not a verbatim move of _handle_search_documents`, giving `1 failed` |
| (iv) | `folder_ids=None` passed to `resolve_document_scope` | `test_d19_an_expert_restricted_scope_ands_with_the_filter`: `AssertionError: assert None == ['fx']`, giving `1 failed` |

Drive (iii) was first run before Task 2's commit, and it passed, because HEAD still held the 272-01 handler. Re-run after the commit, it failed on the import positive control, since the new handler opens with a docstring. Commit `f2001aa34` made the normalisation drop a leading docstring. The WAVE1 blob has no docstring, so the history proof is unchanged. The drive now fails on the body itself.

## Acceptance checks

- `grep -v '^\s*#' search_documents_tool.py | grep -c "write_audit_entry("` returns **1**.
- `grep -cE "^from app.services.(document_view_resolver|document_search_service|view_filter_compiler)" search_documents_tool.py` returns **0**.
- `grep -c "empty_filter_fields_in_run: set | None = None" tool_dispatcher.py` returns **1**.
- `grep -c "never guess filter values" agent_loop.py` returns **0**.
- `grep -c "today_line(" agent_loop.py` returns **1**, and it comes after `active_system_prompt = SYSTEM_PROMPT`.
- `grep -c "empty_filter_fields_in_run=_empty_filter_fields_in_run" agent_loop.py` returns **2**.
- `grep -c "empty_filter_fields_in_run=parent_ctx.empty_filter_fields_in_run" task_service.py` returns **1**.
- `git diff b511aaeec --stat` on the honoured-by-construction files:
  ```
  backend/app/api/knowledge_health.py     |  4 ++++
  backend/app/services/agent_loop.py      | 27 ++++++++++++++++++++++-----
  backend/app/services/task_service.py    |  3 +++
  backend/app/services/tool_dispatcher.py |  7 +++++++
  ```
  - `tool_dispatcher.py`'s 7 lines are the field plus its 6-line comment.
  - `knowledge_health` changed 4 lines (limit ≤ 6) and `task_service` 3 (limit ≤ 6).
- **D-16: agent_loop.py changed +22 / −5, so 27 changed lines.** Research estimated 15-20. The breakdown:
  - the prompt rewrite (+12/−5);
  - a 2-line import;
  - 1 `today_line` line;
  - 3 vocabulary lines (a comment, the statement, a blank);
  - 2 lock-init lines;
  - 2 kwarg lines.
  
  There is no logic change beyond those. The prompt-assembly seam stays **OWED → 273**.
- `git diff f49d9ea2d --name-only` contains no `validator_kinds.py` and no `user_settings` file. The only migration is `200_filtered_retrieval_document_scope.sql` (D-01 / D-05).
- `test_272_search_tool_move.py`:
  - `grep -c WAVE1_MERGE_SHA` returns 7.
  - `grep -c "def test_handler_ast_identical_to_base"` returns 0.
  - A one-off `ast.dump` comparison between `b511aaeec` and HEAD found every other function AST-IDENTICAL: `_blob_at_base, _tool, _td, _top_level_function, test_registry_and_reexport_are_the_moved_handler, test_no_module_level_import_of_tool_dispatcher, _ctx, _drive, test_patch_where_used_new_target_is_hit, test_patch_where_used_old_target_alone_is_missed`. The retired case is `test_handler_ast_identical_to_base`. Added: `_blob_at, _normalised_handler, test_handler_move_proven_at_wave1_merge, test_handler_was_rewritten_after_the_move`.
- **Tool count is 29, unchanged.** `test_259` / `test_261` / `test_085` are byte-unchanged against `b511aaeec` (empty `git diff --stat`) and green.
- The hot-file ledger gate reads `ledger gate OK — every watched file has a row`.

## Gates (verbatim)

**Full backend unit gate** (`node ../scripts/check-backend-unit-baseline.cjs`, in `backend/`):
```
71 failed, 6382 passed, 1 skipped, 2 xfailed, 2 xpassed, 49 warnings in 299.46s (0:04:59)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**Failed set.** Every `FAILED` line was cut at ` - ` and any glued trailing text stripped, then compared with the 71 ids in 272-BASELINES.md: `71 NEW [] GONE []`, then `SET-IDENTICAL`. This run had no glued lines.

**Passed went from 6308 to 6382 (+74), and every case is accounted for:**
- filter_validation 31
- result_kinds 14
- retry_lock 9
- prompt_and_vocabulary 14
- knowledge_health_kinds 5
- search_tool_move +1 (5 → 6)

**Top-level suites:**
- `test_2171_trend_segments`, `test_2171_search_error_audit`, `test_147_flag_refuse` and `test_harness_whitelist` are all green.
- `test_098_scope_governance` reads `1 failed`: the inherited `test_run_start_resolution`, the same as 272-03. Together the five read `1 failed, 32 passed`.
- `test_096_ci_workflow_regression` times out at `--timeout=60` in `run_lifecycle._watch` → `is_run_cancelled`, exactly as at base (it is inherited, and was run with a timeout per the carry-forward).

**graphify:** `graphify update .` ran with exit 0. It changed only `graphify-out/GRAPH_REPORT.md`, which was already dirty and is not staged.

## Behaviour delivered

- **Kind 1, passages.**
  - `result` is still the JSON array of hits.
  - `llm_content` carries `filter_applied` (a plain label such as "document date 1–31 Oct 2025 · legal entity = Acme GmbH"), `matched_documents`, `undated_excluded` with its sentence, `passages`, and a `low_similarity_note` when any passage carries `low_similarity` (D-10).
- **Kind 2, `no_documents_matched`.**
  - Reasons are `zero_documents` and `not_searchable_yet` (D-25).
  - The result carries the filter label, the matched count, the undated count, `nearby` (D-11) and an instruction to cite nothing and not search without the filter.
  - It has no `"error"` key, and no citations.
- **Kind 3, `invalid_filter`.** It carries `field`, `allowed`, `message` and `instruction`. Nothing is resolved or searched.
- **Kind 4, `retrieval_unavailable`.** It has the pre-272 shape for a provider failure. A truncated resolve says "narrow the filter".
- **`refused_retry` (D-09).** It names the locked fields and the reason. Nothing is resolved or searched.
- **The audit row.** All of these go through `_write_search_audit`, which records `filters` (canonical, as applied), `result_kind`, `matched_document_count` and `undated_excluded`. Every pre-272 key is kept.
- **The unfiltered call** still makes the pre-272 call: no `document_ids` kwarg, and the literal `"No relevant documents found."`.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 2 — the 272-03 carry-forward] An empty folder scope never reaches retrieval.**
- If `ctx.folder_subtree_ids == []`, both the filtered and the unfiltered call now return kind 2 before any resolver or retrieval call.
- Before this, the unfiltered call handed `[]` to `search_documents`, which both arms read as "no folder restriction". The folder clip then emptied the result, so the RPC had read the whole knowledge base (266 CR-01).
- The test `test_an_empty_folder_scope_never_reaches_retrieval` is parametrized over unfiltered and filtered calls. It was RED in `cc7316c84` (the 21× AttributeError run) and is green in `4754b3a8d`.
- Today this state is unreachable from the run path: an empty *biased* scope composes to `None`, and an empty *restricted* scope raises. So it is defence in depth.

**2. [Rule 1] `_lock_set` checks `isinstance(..., set)`.**
- `tests/test_2171_search_error_audit.py` drives the handler with a `MagicMock` ctx. A truthy `getattr` check would read a mock attribute as a live lock and refuse every search.

**3. [Rule 1] `SearchTruncatedError` subclasses `ResolveError`.**
- It is caught first and mapped to kind 4.
- Any other `ResolveError` with `status >= 500` is also kind 4; all others are kind 3.
- A failure reading the field definitions is kind 4 too: the filter could not be resolved, which is not the same as matching nothing.

**4. [Re-drive, with the reason in the test] `tests/test_2171_search_error_audit.py::test_written_metadata_is_a_dict_not_a_string_scalar`.**
- The plan re-drives test_2171 only "if its key assertion is an exact set". That is not what broke. Its source assertions (`metadata={` and `"retrieval_status": "provider_error"` inside the handler) broke when the write was centralised.
- The test now reads `_write_search_audit` (`metadata: dict = {` … `metadata=metadata`) and the module's `retrieval_status="provider_error"`. Its runtime key assertions are unchanged and green.

**5. [Test correction] `test_a_given_tool_list_is_substituted_in_place_order_preserved`** asserted that `"legal_entity"` was absent from the static description, but 272-02's description already names it as an example. The assertion now checks `"legal_entity (enum"` (that is, the input list is never mutated). Fixed in `4b7e59e74`.

**6. [Judgement] Folder-clip edge case.** If the folder clip removes every hit of a filtered search, which only happens when the RPC leaked out-of-scope rows, the result is kind 2 `not_searchable_yet` rather than kind 1 with an empty array.

**7. [Plan-directed] The success-path audit write is now inside the writer's own `try`.** Before 272 it was not. A diagnostics failure can no longer mask any answer. An unscheduled coroutine is closed.

### Recorded

- **A4.** `today_line` uses `datetime.now(timezone.utc)`, while `_relative_window` uses `date.today()` (server local time). They agree on the UTC containers and can differ by one day on a non-UTC dev box near midnight.
- **A5 (lock shared with sub-agents).** It is pinned by a source fence. The `sub_ctx = ToolContext(...)` construction sits inside the live sub-agent runner, which needs a run, a semaphore and an emit channel, so it is not reachable without a live run. The behavioural proof is `test_the_same_set_carries_the_lock_across_contexts` (two iterations plus a sub-agent sharing one set).
- **D-22 limit (known, not hidden).** The lock refuses only `search_documents`. `grep` / `query_documents` / `read_document` / `analyze_document` are covered by the prompt rule alone. 272-05's board checks every tool call.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: prompt-surface | backend/app/services/search_documents_tool.py | `with_search_vocabulary` renders the caller's own and system-global field keys and enum option strings, plus RLS-read document-type values, into the model's tool schema. This is the trust boundary in the plan's threat model. The values are the caller's own data and are not escaped. A hostile option string could carry instructions to that caller's own model. |

T-272-17..23 are all mitigated:
- the closed op Literal, the whitelist, the enum options, ISO checks and numeric coercion;
- the D-18 short-circuit, with drive (i);
- the D-09 lock shared with sub-agents, with drive (ii);
- RLS-intersected counts, nearby values and types (272-03);
- the ONE writer, with `filters` and `result_kind` on every arm;
- `load_search_vocabulary` returning None on failure;
- the D-24 reader line.

## TDD Gate Compliance

- `test(272-04)` `2705d0b83` comes before `feat(272-04)` `717c09aff`.
- `test(272-04)` `cc7316c84` comes before `feat(272-04)` `4754b3a8d`.
- `test(272-04)` `24a6fa99b` comes before `feat(272-04)` `4b7e59e74`.

All three RED outputs are quoted above.

## Self-Check: PASSED

- All 5 created test files and all 8 modified files exist.
- All 7 commits (`2705d0b83`, `717c09aff`, `cc7316c84`, `4754b3a8d`, `f2001aa34`, `24a6fa99b`, `4b7e59e74`) are present in `git log`.
- STATE.md and ROADMAP.md are untouched.
