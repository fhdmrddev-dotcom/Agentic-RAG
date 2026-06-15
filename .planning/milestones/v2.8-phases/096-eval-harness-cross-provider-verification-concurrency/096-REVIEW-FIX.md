---
phase: 096-eval-harness-cross-provider-verification-concurrency
fixed_at: 2026-06-07T06:07:33Z
review_path: .planning/phases/096-eval-harness-cross-provider-verification-concurrency/096-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 096: Code Review Fix Report

**Fixed at:** 2026-06-07T06:07:33Z
**Source review:** .planning/phases/096-eval-harness-cross-provider-verification-concurrency/096-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — 0 criticals, 4 warnings; 5 Info findings out of scope)
- Fixed: 4
- Skipped: 0

**Verification per fix:** `py_compile` on every touched module/script + the targeted suite `tests/test_096_ci_workflow_regression.py tests/test_096_askuser_cleanup.py tests/test_harness_resume.py` (32/32 green) after WR-02 and WR-03; `tests/test_dual_mode_wiring.py` (52/52 green) run as an extra shared-path prudence check for both harness-engine/dispatch changes. The additive-only / Deep-byte-identical constraint was preserved: every new field/guard defaults to `None`/no-op on the Deep path.

## Fixed Issues

### WR-01: restart_smoke single-completion detector false-FAILs every healthy run

**Files modified:** `scripts/restart_smoke.py`
**Commit:** 4b2229b6
**Applied fix:** Wrapped `_SQL_DOUBLE_COMPLETION`'s `metadata->>'phase'` in the same `CASE WHEN jsonb_typeof(metadata) = 'string' THEN (metadata #>> '{}')::jsonb ELSE metadata END` normalization that the sibling `scripts/eval_cross_provider.py` `duplicate_phase_completed` query already uses (mirrored byte-for-byte per DI-096-06-A — live DB has 386/386 double-encoded audit rows). Carried over the sibling's explanatory NOTE so the detector keeps working if the writer is ever fixed to store objects. The out-of-scope root cause (the double-encoding writer in `backend/app/db/workflows.py` + the pool codec) was NOT touched, per the review's own scoping note.

### WR-02: Resume sweep crashes on a missing definition and aborts ALL remaining stranded runs

**Files modified:** `backend/app/services/harness_engine.py`, `backend/tests/test_096_askuser_cleanup.py`, `backend/tests/test_harness_resume.py`
**Commit:** acffe95d
**Applied fix:** Added the additive `if definition is None: logger.warning(...); continue` guard in `resume_stranded_workflows` immediately after `_load_run_definition` (and BEFORE `_build_resume_context`, so no producer shell is minted for a skipped run). The loop was not restructured; the redrive-failure propagate behavior locked by `test_resume_finalizer_expires_on_failed_redrive` is untouched (per-run isolation deliberately NOT applied — review listed it as optional and the orchestrator scoped the fix to the guard). Three test stubs that returned `None` from a mocked `_load_run_definition` as a don't-care value ("the stubbed redrive ignores the definition") were updated to return a truthy `object()` sentinel — the exact pattern `test_dual_mode_wiring.py:1262` already uses — so the guard doesn't skip the runs those tests drive. The `None` in those stubs was incidental, not a locked behavior.

### WR-03: tool_refused audit rows keyed to the producer `runs` id, not the workflow run id

**Files modified:** `backend/app/services/tool_dispatcher.py`, `backend/app/services/harness/phase_types.py`, `backend/app/services/task_service.py`
**Commit:** 15d1259d (fixed: requires human verification — see note)
**Applied fix:** Threaded the workflow run id onto the dispatch context exactly as the review prescribed: (1) new `workflow_run_id: UUID | None = None` field on `ToolContext` (defaulted — Deep/tasks callers stay byte-identical); (2) `_build_phase_tool_context` sets `workflow_run_id=getattr(ctx, "run_id", None)` (verified against the Facet A docstring and `_build_resume_context`'s docstring that `ctx.run_id` IS `workflow_runs.id` on BOTH the live-producer and startup-sweep-resume paths); (3) `run_task_sub_agent`'s `sub_ctx` build propagates `workflow_run_id=parent_ctx.workflow_run_id` alongside the 096-02 `phase_whitelist` propagation; (4) `_spawn_tool_refused_audit` now resolves `run_id = ctx.workflow_run_id or ctx.parent_run_id or ctx.run_id`. Cross-checked against every other `write_audit` call site in `harness_engine.py` — all pass `workflow_runs.id` — so refusals now land in the same per-run namespace the audit readers (e.g., eval's per-run queries) use. Both `phase_whitelist` set-sites in the codebase are covered.

**Human-verification note:** this is an id-namespace logic fix — syntax checks and the CI suite (which asserts only that *a* `tool_refused` row is written against a mock pool) cannot semantically confirm the live row lands under `workflow_runs.id`. Recommend one live confirmation during phase verification: trigger a whitelist refusal in a harness run and query `harness_audit WHERE run_id = <workflow_run_id> AND event_type = 'tool_refused'`.

### WR-04: conc_probe asserts fan-out against a hardcoded 5

**Files modified:** `scripts/conc_probe.py`
**Commit:** d9f78b0b
**Applied fix:** The `fanout_bounded` assertion and its printed detail now use the live `max_parallel` value the script already resolves from the definition's batch phase (`(batch_phase.get("config") or {}).get("max_parallel_agents", 5)`), exactly as the review's fix snippet specified. The now-dead `MAX_ALLOWED_OVERLAP = 5` constant was removed (it had no other use-site) and replaced with a NOTE explaining the live-bound rule, closing the false-PASS window for `--workflow-slug` workflows with a lower cap.

## Skipped Issues

None — all 4 in-scope findings were fixed. (IN-01 through IN-05 are out of scope for this run: `fix_scope: critical_warning`.)

---

_Fixed: 2026-06-07T06:07:33Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
