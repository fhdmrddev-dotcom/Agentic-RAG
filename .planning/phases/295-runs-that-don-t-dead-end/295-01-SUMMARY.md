---
phase: 295-runs-that-don-t-dead-end
plan: 01
subsystem: harness-engine
tags: [refactor, g-5, pure-move, ask-user, harness]
requires: []
provides:
  - "backend/app/services/harness/engine_ask.py — the engine-ask disposition family, moved verbatim"
  - "test_295_engine_ask_seam.py — the pure-move proof (RETIRED registry for plans 03/04)"
affects:
  - backend/app/services/harness_engine.py
tech-stack:
  added: []
  patterns:
    - "end-of-module re-export to break the harness package import cycle (form b)"
    - "patch surface moved with the function: repoint direct-call sites, twin gate-drive sites"
key-files:
  created:
    - backend/app/services/harness/engine_ask.py
    - backend/tests/unit/test_295_engine_ask_seam.py
  modified:
    - backend/app/services/harness_engine.py
    - backend/tests/unit/test_ask_user_disposition.py
    - backend/tests/unit/test_185_engine_attachment.py
    - backend/tests/unit/test_187_armed_checkpoint_property.py
    - backend/tests/unit/test_214_approval_names_service.py
    - backend/tests/unit/test_publish_service.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/test_120_origin_filter.py
decisions:
  - "D-51 re-export form (b): the import of engine_ask sits at the END of harness_engine.py. Form (a), in the top import block, failed all four cold import orders (measured)."
  - "engine_ask binds only PhaseOutcome and _emit back from the engine; write_audit comes from app.db.workflows, settings from app.config."
  - "engine_ask's logger is getLogger('app.services.harness_engine'), not __name__, so log records keep the name they had before the move."
  - "A patch site whose spy would go vacuous after the move was repointed even when it stayed green (T-295-01-02), e.g. test_185's `await_count == 0` checks."
metrics:
  duration: "~1h40m"
  completed: 2026-10-21
  tasks: 2
  files: 10
---

# Phase 295 Plan 01: Engine-ask seam (D-51) Summary

The engine-ask disposition family (`_OnFailure` through `_resolve_failure_with_ask_user`, 10 names) moved verbatim out of `harness_engine.py` into `backend/app/services/harness/engine_ask.py`. The engine re-exports every name as the same object, and an AST-identity proof against base `7fdf86e70` pins the move. Behaviour is unchanged. `harness_engine.py` drops from 3,396 to 2,897 lines.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Probe the import cycle, write the pure-move proof RED | `d58e83158` | `backend/tests/unit/test_295_engine_ask_seam.py` |
| 2 | Verbatim move, re-export, repointed patch sites GREEN | `f62e6d593` | `engine_ask.py`, `harness_engine.py`, 7 test files |

## Cycle probe

I probed in fresh interpreters (`venv/Scripts/python -c "import <mod>"`, cwd=backend), using the real cut produced by a boundary-asserting script.

| Import order | base `7fdf86e70` | form (a): top import block | form (b): end of module |
|---|---|---|---|
| `import app.services.harness_engine` | exit 0 | **exit 1**: `ImportError: cannot import name 'PHASE_TYPE_REGISTRY' from partially initialized module 'app.services.harness_engine'` | exit 0 |
| `import app.services.harness` | exit 0 | **exit 1**: `cannot import name 'PhaseOutcome' from partially initialized module` | exit 0 |
| `import app.main` | exit 0 | **exit 1**: same `PhaseOutcome` partial-init error | exit 0 |
| `import app.services.harness.engine_ask` | n/a (module absent) | **exit 1**: same | exit 0 |

**Chosen: form (b).** The cycle runs like this. Importing `app.services.harness.engine_ask` executes the package `__init__`, which imports `phase_types`, whose `register_all()` runs `from app.services.harness_engine import PHASE_TYPE_REGISTRY`. In addition, the leaf binds `PhaseOutcome` and `_emit` from the engine. At the end of the engine module, every one of those names is already bound. Form (c), a sibling module outside the package, was not needed, so D-51's path holds and there is no deviation on location. `test_reexport_sits_after_every_engine_definition` pins the position, and `test_each_import_order_works_in_a_fresh_interpreter` pins all four orders.

## TDD gate record

- **RED (Task 1, `d58e83158`):** `pytest tests/unit/test_295_engine_ask_seam.py` gave `7 failed, 5 passed`. Every failure came from the missing module: `ModuleNotFoundError: No module named 'app.services.harness.engine_ask'`, the `_module_source` assertion "engine_ask.py does not exist — the D-51 seam has not been taken", and "expected ONE `from app.services.harness.engine_ask import`, got 0". The 5 that passed read only the base blob and the engine at base: the list sanity check, three import orders, and symtable on `harness_engine`.
- **GREEN (Task 2, `f62e6d593`):** `12 passed`.
- No REFACTOR commit was needed.

## Patch-surface RED and repoints

Before any repoint, I ran 20 engine-related files per file against a per-file base capture. Nine tests were new failures versus base, and every one was a `write_audit` spy count of `0 == 1`, or a moved source string:

- `test_ask_user_disposition.py`: 6 failures (`test_ask_user_proceed_continues_with_receipt`, `test_version_ambiguity_proceed_records_v1_cut_note`, `test_armed_approval_runs_the_body_and_writes_the_receipt`, `test_armed_typed_refusal_is_never_approval`, `test_armed_approval_by_choice_index_still_proceeds`, `test_non_armed_free_text_fall_through_is_unchanged`)
- `test_187_armed_checkpoint_property.py::test_p3_a_typed_refusal_runs_nothing_and_writes_zero_approval_receipts`
- `test_214_approval_names_service.py::test_MEASURED_the_approval_receipt_ALREADY_copies_the_whole_sentence_into_the_ledger`
- `test_120_origin_filter.py::TestHarnessSitesTagHarness::test_harness_engine_disposition_prompt_tags_harness` (source fence)

**Repointed (direct `_resolve_failure_with_ask_user` calls): `patch.object(harness_engine, "write_audit", …)` became `patch.object(engine_ask, "write_audit", …)`, plus a local `from app.services.harness import engine_ask`.**
- `test_ask_user_disposition.py`: lines 118, 146, 168, 193, 245, 268, 375, 401, 446, 472, 530 (`_drive`), 753 and 777 (line numbers at base). Tests that were red: the six above. Tests that stayed green but would have gone vacuous: the abort, expiry and decline tests that assert `write_audit.await_count == 0`.
- `test_185_engine_attachment.py`: lines 417, 439, 467, 503, 547, 586 and 620. None were red. All were repointed because `test_criterion_19…` asserts `write_audit.await_count == 0` on a spy that the function no longer reads (T-295-01-02: a vacuous guard). The rest replaced a neutralizer that no longer neutralized anything.
- Left alone: `test_185:695-696` and `:753-754`, and `test_harness_engine.py:1001-1002`. These patch the resolver itself, so they intercept engine-side calls only.

**Twinned (gate drives with the real resolver; both modules now read the names): the `harness_engine` patch is kept and an `engine_ask` patch with the same spy is added.**
- `test_187_armed_checkpoint_property.py:561-562` (`_drive`): red (P3).
- `test_214_approval_names_service.py:208-209` (`_drive`), plus a module-level import: red.
- `test_publish_service.py:1385-1386` (`_drive_armed_phase`): not red. It collects `audit_events`/`emits` from an armed phase that reaches the resolver.
- Left alone: `test_281_engine_cause_precedence.py:95-96` and `test_pre_post_timing.py:96-97/132-133`. Their validators are `fail_run` and not armed, so the resolver short-circuits to `_route_on_failure` and never reads `write_audit` or `_emit` from engine_ask.

**Re-derived fences:**
- `test_120_origin_filter.py:122`: the `"origin": "harness"` source fence now reads `app/services/harness/engine_ask.py`, because the prompt insert moved with the function.
- `test_256_finish_run_unchanged.py`: the full unit gate caught this one. Check (a), the per-file counts, stayed identical. Only the positions moved, by -522 lines: `2465→1943`, `2506→1984`, `2803→2281`, re-derived with `grep -n "await finish_run("` and recorded next to the originals.

No assertion was changed or weakened; only patch targets, a file path and line positions were edited.

## Backend unit gate (failing-id SET diff)

Command: `cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider -rf`, with ids extracted by `grep ^FAILED | sed | sort -u` and compared with `comm`.

- **Base** (`7fdf86e70` source plus the RED seam test): `77 failed, 8426 passed, 1 skipped, 2 xfailed, 2 xpassed`. That is 70 inherited failures plus the 7 RED `test_295` ids.
- **After the move** (before the test_256 re-derive): `71 failed, 8432 passed, 1 skipped, 2 xfailed, 2 xpassed`.
- `comm -13 base after` (new failures): only `test_256_finish_run_unchanged.py::test_the_finish_run_call_site_set_is_unchanged`. I fixed it by re-deriving the positions and confirmed it green (`16 passed` together with the seam test). Two other ids showed up in the diff only because of log text glued onto the id string (`…C:\Vibe`). `test_cross_worker_cancellation::test_the_registry_read_only_ever_turns_failed_into_cancelled` and `test_sql_service::…test_rejects_insert_query` fail in both sets.
- `comm -23 base after` (fixed): the 7 `test_295` RED ids.
- **Net new failing ids versus base: 0.**

Non-unit, engine-related files run per file at base and after the repoint: the failing set is identical (`comm` empty both ways). Inherited failures in those files: `test_200_human_gate_pause::test_no_twenty_fifth_audit_kind_was_added` (25 vs 24 audit kinds), 21 in `test_dual_mode_wiring`, 1 each in `test_096_askuser_cleanup`, `test_098_scope_governance`, `test_120…test_phase_types_ask_user_prompt_tags_harness`, `test_200_phase_counts` and `test_setup_boot_tolerant`.

## G-5 record

For plan 07's ledger write. Measured with `ast.walk` (`scratchpad/measure_295.py`):

| | base `7fdf86e70` | after `f62e6d593` |
|---|---|---|
| `harness_engine.py` triple (commits / phases / lines) | **62 / 25 / 3396** (matches the ledger row) | 63 / 26 / 2897 |
| `harness_engine.py` module `ast.If` | 107 | **83** (−24) |
| `harness_engine.py` defs (all / top-level) | 31 / 29 | 25 / 23 (−6) |
| `_run_phase_with_gates` `ast.If` / lines | 14 / 550 | 14 / 550 |
| `run_workflow` `ast.If` / nested defs / lines | 19 / 2 / 1092 | 19 / 2 / 1092 |
| `resume_stranded_workflows` `ast.If` / lines | 11 / 187 | 11 / 187 |
| `engine_ask.py` lines / `ast.If` / defs | n/a | 599 / **24** / 6 |

The engine's `If` count fell by exactly the 24 Ifs in the moved bodies, and the three named functions are unchanged. `engine_ask.py` needs a new ledger row (young: 1 commit / 1 phase / 599 lines), which plan 07 owns. I re-ran `RESEARCH`'s module `ast.If = 107` at this base and it matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2: missing critical guard] Repointed green-but-vacuous patch sites**
- **Found during:** Task 2
- **Issue:** The plan says to repoint "only those" sites that turn red. Several `test_185` and `test_ask_user_disposition` sites stayed green only because their spies went vacuous: `write_audit.await_count == 0` on a name the function no longer reads. That is exactly threat T-295-01-02.
- **Fix:** Every direct-resolver site was repointed, and every gate drive that reaches the real resolver was twinned (same spy on both modules).
- **Files:** test_185_engine_attachment.py, test_ask_user_disposition.py, test_publish_service.py
- **Commit:** f62e6d593

**2. [Rule 3: blocking] Two fences outside the plan's file list**
- `test_120_origin_filter.py`: a source fence on the moved prompt string. Its path was repointed.
- `test_256_finish_run_unchanged.py`: line-position pins shifted by the cut. Re-derived, with originals kept in the comments (that file's own precedent).
- **Commit:** f62e6d593

**3. Plan file list vs reality.** The plan listed `test_200_human_gate_pause.py`, `test_harness_templates.py` and `test_096_ci_workflow_regression.py`. None needed an edit: their `emit=harness_engine._emit` references still resolve, `_emit` stays in the engine, and the test_200 source fences pass unmodified.

## Deferred Issues (inherited, out of scope; not fixed)

- **Three non-unit files hang at base and after:** `tests/test_096_ci_workflow_regression.py` (its first test, `test_096_ci_workflow_regression_happy_path`, hangs), `tests/test_harness_gates.py::test_caps_step_and_wall_clock`, and `tests/test_harness_templates.py::test_each_seed_runs_end_to_end_mocked_llm[*]`. The hung process logs `is_run_cancelled: registry read failed` in a loop and grew to 8 GB in 20 minutes before I killed it. Measured: each file was killed after more than 300 s wall clock, both at base and after the move. `test_harness_gates.py` without the hanging test gives `1 failed, 9 passed`, identical at base and after (`test_bounded_retry_reaches_failed_after_3_attempts`, `0 == 3` gate_failed audits; inherited). The re-open trigger is any plan whose verify runs these files: they cannot run to completion on this box today.
- I did not run `graphify update .`, because it would write `graphify-out/` inside a parallel worktree. The orchestrator should run it once after the wave merges.

## Known Stubs

None.

## Threat Flags

None. A pure move adds no new surface. The consent allow-list (`_ACTION_RISK_APPROVE_CHOICE`, `_ABORT_LIKE_CHOICES`, `_is_abort_choice`) is AST-pinned against the base (T-295-01-01).

## Self-Check: PASSED

- FOUND: backend/app/services/harness/engine_ask.py
- FOUND: backend/tests/unit/test_295_engine_ask_seam.py
- FOUND: commit d58e83158 (test(295-01))
- FOUND: commit f62e6d593 (refactor(295-01))
- grep checks: `^async def _resolve_failure_with_ask_user` appears 1 time in engine_ask.py and 0 times in harness_engine.py; `^PhaseOutcome = namedtuple` 1; `from app.services.harness.engine_ask import` 1; `git diff --numstat 7fdf86e70 -- grounding.py phase_types.py` is empty.
