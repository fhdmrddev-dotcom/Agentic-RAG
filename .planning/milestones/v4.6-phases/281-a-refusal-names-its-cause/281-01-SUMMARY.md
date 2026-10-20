---
phase: 281-a-refusal-names-its-cause
plan: 01
subsystem: harness (emit executor, engine gate loop, freshness)
tags: [harness, emit, cause, precedence, freshness, retrievable, closed-core, tdd]
requires: []
provides:
  - "harness/emit_cause.py: shot_record / classify_forced_failure / classify_rejection / terminal_failure_value / compose_emit_failure (281-03 consumes the contract)"
  - "new emit failure value: template_fields_missing"
  - "one composed failure string reaching _failure_reason, run_failed.reason, blocked_step.cause and the chat failure message"
  - "freshness queries filtered by RETRIEVABLE_COLUMN"
affects: [281-03 (frontend union + PhaseCard copy + whitespace-pre-line), 281-04 (G-4 live drive, ledger rows)]
tech-stack:
  added: []
  patterns: ["pure stdlib leaf + function-local import across the harness package cycle", "keyword-only defaulted flag (reason_is_final) keeps every other caller byte-identical", "imported constant concatenated into raw SQL at import, isidentifier() asserted"]
key-files:
  created:
    - backend/app/services/harness/emit_cause.py
    - backend/tests/unit/test_281_emit_cause.py
    - backend/tests/unit/test_281_engine_cause_precedence.py
    - backend/tests/unit/test_281_freshness_retrievable.py
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/freshness.py
    - backend/tests/unit/test_llm_emit_executor.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
decisions:
  - "The merge key for 'same cause' is the cause KIND; a shot that failed two checks counts under both bullets, so bullet counts can add up to more than the header total (recorded in the emit_cause docstring)"
  - "The WR-06 non-strict fallback keeps the failure value citation_gate_rejected, but its message is the composed cause too, so a refusal for missing keys is never worded 'uncited or invented' on that path either"
  - "Terminal records (render/integrity) take the passing shot's attempt number, so the header total stays 'model calls' (D-25); no_template_bound records 1 attempt"
  - "A terminal detail is shown on one line, cut to 200 characters, with no trailing period; when several records of one kind carry a detail, the most recent one is shown"
metrics:
  duration: "~46 min (18:19Z to 19:05Z)"
  completed: 2026-10-14
  tasks: 3
  commits: 7
---

# Phase 281 Plan 01: A Refusal Names Its Cause (backend) Summary

**One sentence:** a new pure leaf, `harness/emit_cause.py`, now writes every emit failure as one plain-text string. The string names the step only by its author-set name and gives one bullet per distinct cause, each with its count and one "Check …" line. The engine now prefers that diagnosis over the post-gate validator's shape message (`no field_map on output`) and writes it without the `Phase N (slug)` prefix. A refusal caused only by missing template keys now has its own failure value, `template_fields_missing`, and freshness reads only documents an agent may read.

## Base

- **PHASE_BASE = `95c62fc83c61d3867a10a77bff177b5eb14e64d5`** (develop, `docs(281): begin phase execution — STATE`).
- **The worktree did not start on that base.** It landed on **`a248672f0`** (the master merge of v4.6 277-279). `git merge-base HEAD 95c62fc83` returned `60ce3797c`, not the expected base. I ran the HEAD assertion (branch `worktree-agent-ab7b5ce4aa1b47d8a`, not a protected ref) first, then `git reset --hard 95c62fc83` before any work.
- Base failing set (normalised test ids, the ` - <reason>` suffix and the glued RuntimeWarning text removed): `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-281/base_failed_set_95c62fc83.txt`. **71 lines**, equal to the base gate's `71 failed, 7381 passed`. The raw `grep '^FAILED' | sort -u` capture is `base_failed_95c62fc83.txt` beside it, and the full gate output is `base_gate_281-01.txt`.
- Root-level base line: `tests/test_harness_engine.py tests/test_094_rc4_failure.py tests/unit/test_255_extension_contract_guard.py` → **71 passed**. Saved as `base_root_281-01.txt`.

## RED evidence (TDD gate sequence)

| Task | RED commit | Failing at RED | GREEN commit |
|---|---|---|---|
| 1 | `017898048` | **39 failed**. All 34 `test_281_emit_cause.py` cases failed (module missing, `ModuleNotFoundError` / `FileNotFoundError`). That includes all four D-32 composer arms: `test_named_step_header_and_byte_identical_bullets`, `test_unnamed_step_reads_this_step[None/""/"   "]` and `test_named_step_singular`. Five executor cases failed too: `test_281_sc1_fixture_names_the_missing_field_not_citations` (`'citation_gate_rejected' == 'template_fields_missing'`), `test_281_provider_error_is_worded_as_a_provider_error`, and the D-32 executor cases `test_281_d32_named_step_leads_with_its_author_set_name` and `test_281_d32_unnamed_step_never_falls_back_to_the_slug[None/"  "]` (no header present) | `0ab03994e` (feat) |
| 2 | `337a65c67` | **9 failed, 1 passed.** Failed: `test_the_executor_diagnosis_wins_and_is_the_final_reason`, `test_gate_failed_audit_and_sse_carry_the_cause_and_keep_the_validator_text`, `test_retry_feedback_carries_the_executor_cause_not_the_validator_shape`, `test_identical_diagnosed_outputs_still_short_circuit` (3 executions, not 2), `test_d32_unnamed_step_reads_this_step[None/"   "]`, `test_d04_publish_twin_named`, `test_d04_publish_twin_unnamed_keeps_step_name_null` and `test_the_no_validator_branch_composes_the_same_cause`. The one pass, `test_a_non_diagnosed_failure_keeps_the_prefix_byte_identically`, is a regression pin and was meant to pass | `7704bd0f6` (fix) |
| 3 | `8a47d302f` | **3 failed, 1 passed.** Failed: `test_both_statements_carry_the_retrievable_predicate`, `test_the_predicate_is_derived_from_the_import_not_restated` and `test_the_rule_is_never_restated_in_this_file`. The no-f-string fence passed at base, as it should | `76bbc0601` (fix) |

I drove the AST leaf guard RED by planting `from app.services.harness import phase_types` into a **tmp_path copy** of the module (`test_leaf_guard_fires_on_a_planted_import`). App code was never planted into.

## The pinned composed string (golden-run shape, copied from a run of the leaf)

```text
This step failed after 9 attempts:
• 7 attempts — filled the template, but these fields were missing: rows. Check that the template's field names match what this step produces.
• 2 attempts — the model wrote prose instead of filling the template. Check which model this step uses.
• 1 attempt — the citation check failed: 2 values cited no source. Check that the step before this one finds the documents these values come from.
```

When the step is named, line 1 reads `Step "Write the report" failed after 9 attempts:` and the bullets are byte-identical (D-32, pinned). The SC#1 fixture (100% coverage, only `rows` missing) gives `out["failure"] == "template_fields_missing"` and never contains "citation" or "citations_required".

## What changed

- **`emit_cause.py` (new, 292 lines):** stdlib only, with `__all__` exactly as the interface block lists. It has one sentence and one "Check …" line per kind (10 kinds). The never-say list (`fix|soon|later|will`, whole word) is pinned over every kind.
- **`phase_types._exec_llm_emit`:**
  - Function-local imports of the leaf and of `publish_service._clean_label`. `step_name = _clean_label(getattr(phase, "name", None))`; the slug is never used.
  - It keeps one `records` list per invocation. A record is appended at state (a) and at every reject (before the retry `continue`), and one terminal record at no_template, render ×2, integrity and the unexpected backstop (`_emit_unexpected_failure` gains keyword-only `records`).
  - Every failure return carries `attempt_causes` and surfaces the composed string. The strict reject returns `terminal_failure_value(...)`, and the substep receives the same value.
  - `_emit_failure_output` gains keyword-only `attempt_causes` and never gets the retrieved-id set (the acceptance grep reads 0).
  - Audit metadata gains `emit_rejected.missing_keys` and `emit_failed.attempt` (state a), both additive.
- **`harness_engine._run_phase_with_gates`:**
  - Records accumulate across engine attempts. `diagnosed = failure and attempt_causes is a list`. `cause = compose(records, step_name=_clean_label(phase.name)) or text or validator text` when diagnosed.
  - The `gate_failed` audit row carries `error=cause` plus additive `validator_error`. The SSE `error` is the cause, and so is `ctx.retry_feedback` (D-26).
  - `reason_is_final=diagnosed` threads through `_resolve_failure_with_ask_user` to both `_route_on_failure` calls and to the ask_user `reason_base`. The default is False, so behaviour is byte-identical for every other caller.
  - New `_attempt_identity` projection for the identical-output short-circuit.
  - `run_workflow`'s no-validator `fail_phase` reason is `compose_emit_failure(output.attempt_causes, step_name=…) or str(_emit_failure)`. The transition codes at :2554/:2561 still read `str(_emit_failure)`.
  - Not touched: the escape handler, `cancel_phase`, `finish_run` and the pause arm.
- **`freshness.py`:** `from app.services.retrieval_scope import RETRIEVABLE_COLUMN`, plus `assert RETRIEVABLE_COLUMN.isidentifier()`. `_NEWEST_SQL` / `_STEMS_SQL` are built by plain concatenation at import, and the `$1` bind args are unchanged. `retrieval_scope.py` is not edited (its diff against base is empty).
- **No-validator branch test:** this is checked **at source level** (an AST check of `run_workflow`'s one `fail_phase(..., output=durable_output)` call). Running `run_workflow` for real needs the root fixtures that hang (`test_harness_gates`).

## G-5: AST arithmetic (256-05 precedent), PHASE_BASE → HEAD

| File | def | If | IfExp | Try | For/While |
|---|---|---|---|---|---|
| `harness_engine.py` | 30 → 31 (+1, `_attempt_identity`) | 106 → 107 (+1, the `isinstance(output, dict)` extend guard) | 34 → 38 (+4) | 34 → 34 | 10 → 10 |
| `phase_types.py` | 55 → 55 | 112 → 113 (+1, `if attempt_causes is not None`) | 20 → 20 | 10 → 10 | 18 → 18 |

The four new IfExps in `harness_engine.py` are the `cause` expression, the `_route_on_failure` reason, the ask_user `reason_base` and the body of the new `_attempt_identity` helper. That makes **4 conditional nodes in the existing functions** (the diagnosed IfExp, the isinstance guard and the two reason_is_final IfExps, which is exactly what the plan listed), plus **1 inside the new def**.

⚠ **The plan's cap reads "at most 4 new conditional nodes". Counted strictly it is 5, because one sits inside the `_attempt_identity` helper the plan itself called for.** My verdict is honoured by construction: one composer call-out, one keyword-only flag, one projection helper, and no new branch family. The orchestrator owns STATE.md, and I was told not to edit it. If you read the cap strictly, record **OV-281-01** under `STATE.md → Guardrail overrides` with this measurement.

`publish_service.py` and `validator_kinds.py` are unchanged against PHASE_BASE (empty diff). The closed core is unchanged: `test_255_extension_contract_guard` passes (7 phase types / 1 emitter / 30 tools / 10 validator kinds).

## Gate result (set diff)

- **First HEAD gate: 72 failed (GATE FAILED).** The set diff named one new failure: `tests/unit/test_256_finish_run_unchanged.py::test_the_finish_run_call_site_set_is_unchanged`. Its check (a), the per-file counts, passed. Only check (b), the line positions, failed, and that was caused by my engine edit. The fence's own docstring calls this a bookkeeping re-derive, which I did in `9e2bf893c` (2390→2465, 2431→2506, 2713→2803).
- **Re-run gate: 71 failed, 7434 passed, 0 errors (GATE PASSED).** `comm -3 base_failed_set_95c62fc83.txt head_failed_set_281-01.txt` is **empty** (71 = 71). Two test ids show up in raw `comm` output only because pytest glued a `RuntimeWarning: coroutine … never awaited` line onto their FAILED lines. The same tests fail at base; the noise is only a formatting difference.
- **Root-level suites:** `test_harness_engine.py + test_094_rc4_failure.py + test_255` give **71 passed at base and 71 passed at HEAD**.
- **Plan verification command:** the nine named suites give **178 passed**. `node scripts/check-hot-file-ledger.cjs 281` → `ledger gate OK`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-derived the `finish_run` call-site position fence**
- **Found during:** the Task 3 wave gate
- **Issue:** `test_256_finish_run_unchanged` pins `await finish_run(` file:line positions. My engine edit moved three of them down by 75 or 90 lines. The per-file counts did not change.
- **Fix:** updated `_EXPECTED_CALL_SITES` and recorded the old → new positions inline, as the fence asks.
- **Files modified:** `backend/tests/unit/test_256_finish_run_unchanged.py` (not in the plan's `files_modified`)
- **Commit:** `9e2bf893c`

**2. [Rule 1 - Bug] A terminal detail cannot break the one-bullet-per-line shape**
- **Found during:** Task 1 GREEN
- **Issue:** a render error message can contain newlines or a trailing period. Either would split a bullet or print "..".
- **Fix:** `_detail_suffix` collapses whitespace, strips the trailing period, and cuts the text to 200 characters with "…". Pinned by `test_terminal_detail_is_bounded_and_single_line`.
- **Commit:** `0ab03994e`

**3. Plan path correction (no code impact):** the Task 2 verify command names `tests/unit/test_200_human_gate_pause.py`, but the file is root-level (`tests/test_200_human_gate_pause.py`). I ran it at the real path.

### Deferred Issues (out of scope; inherited, proven at base)

I am logging these here rather than in `deferred-items.md`, so the concurrent 281-02 worktree does not run into a merge conflict over a new shared file.

- `tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added`: `_AUDIT_EVENT_TYPES` has 25 kinds, and this plan did not touch it.
- `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key`: a `usage_box` kwarg TypeError at `phase_types.py:814`. `git blame` attributes that line to `59f2261c0`, not this plan.
- `tests/test_dual_mode_wiring.py`: 21 failures.
- **How I proved these are inherited:** I wrote the three base app files over the working tree with `git show 95c62fc83:<path>`, then ran `test_dual_mode_wiring + test_harness_resume + test_200_human_gate_pause + test_200_phase_counts`. Base: 23 failed, 75 passed. HEAD: 23 failed, 75 passed. The FAILED sets are identical. I then restored the HEAD contents (per-file `git checkout -- <file>`; the working tree is clean).
- **Owed to 281-04:** `docs/HOT-FILE-LEDGER.md` § `backend/app/services/harness/emit_cause.py` still says *"The string never leads with a step name or slug"*. That predates the D-32 operator ruling. The slug half still holds, but the step-name half is now false for author-named steps. The ledger was not in this plan's `files_modified`, so I left it unedited.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema surface. Every T-281-01..05 mitigation is in place and pinned: the isidentifier assert and the no-f-string fence (T-281-01); a bounded name, names capped at 5 and a detail capped at 200 characters (T-281-02); `validator_error`, `missing_keys` and `attempt` (T-281-03); the no-retrieved-ids grep and the D-30 assertion in the SC#1 test (T-281-04); the `_attempt_identity` test (T-281-05).

## Self-Check: PASSED

- FOUND: backend/app/services/harness/emit_cause.py, backend/tests/unit/test_281_emit_cause.py, backend/tests/unit/test_281_engine_cause_precedence.py, backend/tests/unit/test_281_freshness_retrievable.py
- FOUND commits: 017898048, 0ab03994e, 337a65c67, 7704bd0f6, 8a47d302f, 76bbc0601, 9e2bf893c
- STATE.md / ROADMAP.md: not modified (orchestrator-owned)
