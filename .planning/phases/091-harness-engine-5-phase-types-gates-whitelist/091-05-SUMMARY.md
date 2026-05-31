---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 05
subsystem: harness-engine
tags: [harness, gates, validators, bounded-retry, on-failure, caps, retry-feedback]

# Dependency graph
requires:
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 01
    provides: ValidatorSpec{kind, config, on_failure, max_retries} + the Wave-0 test_harness_gates.py skeleton + shared fixtures (mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition/single_phase)
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    plan: 02
    provides: harness_engine.run_workflow + the _run_gates no-op SEAM + the asyncio.wait_for wall-clock seam + db/workflows helpers (fail_phase, skip_phase, finish_run, write_audit) + reachability.parse_skip_target
provides:
  - "harness/validators.py — VALIDATOR_REGISTRY (4 kinds: json_schema/regex_match/workspace_file_exists/programmatic) + GateResult + run_gates (first-failure fan-in) + closed PROGRAMMATIC_VALIDATOR_REGISTRY"
  - "harness_engine._run_phase_with_gates — bounded retry loop (≤3 attempts, never loops) + consecutive-identical short-circuit + ctx.retry_feedback PRODUCER + gate_failed audit+emit per attempt (D-08)"
  - "on_failure routing — fail_run (D-07 keep partials + plain reason) / skip_to_phase:<slug> (D-09) / unknown→fail_run (fail-safe T-091-18); wall-clock TimeoutError drives the same routing (D-12)"
  - "config.py — Settings.harness_phase_max_steps=8 (Explorer) + harness_phase_wall_clock_seconds=2400 (300×8), both env-overridable"
affects: [091-07 seeds (07-T2 round-trip proof: this PRODUCER + Plan 03 CONSUMER), 092 publish/run-start]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VALIDATOR_REGISTRY mirrors _TOOL_REGISTRY / PROGRAMMATIC_PHASE_REGISTRY: closed dict + register_validator decorator; the programmatic kind resolves a SECOND closed PROGRAMMATIC_VALIDATOR_REGISTRY (unknown fn raises — never eval'd, T-091-17)"
    - "All 4 validator kinds FAIL CLOSED with a descriptive error_message — a malformed output/schema/pattern/path never crashes the run, it fails the gate"
    - "Bounded retry = loop-local state (attempt counter + last_output), NOT persisted across restart (OQ3 NO — re-run from attempt 0 is bounded + simpler); HARD bound max_retries+1 ≤ 3; consecutive-identical short-circuits even faster"
    - "PRODUCER/CONSUMER split for retry feedback: this plan SETS ctx.retry_feedback (cleared on success/exhaustion so it never leaks downstream); Plan 03 executors APPEND it to the phase prompt — round-trip jointly proven in 07-T2"
    - "Index-driven while-loop (not for-each) so skip_to_phase jumps the cursor; runtime guard on a dangling target → fail_run (lint catches it at publish, runtime fails safe)"
    - "Lazy intra-package imports (run_gates / parse_skip_target inside the engine functions) break the harness-package import cycle that phase_types.register_all() would otherwise trigger"

key-files:
  created:
    - backend/app/services/harness/validators.py
  modified:
    - backend/app/config.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/test_harness_gates.py

key-decisions:
  - "workspace_file_exists reuses the shipped db/workspace.get_file_by_path(pool, thread_id, path) typed helper (mock-friendly: the ctx carries the recording pool + thread_id) rather than a new lookup — zero new DB code"
  - "json_schema catches BOTH jsonschema.ValidationError (output non-conforming) AND SchemaError (author schema itself invalid) — both fail the gate with a message, never raise out of the validator"
  - "_failing_on_failure re-derives the disposition from the phase's validators because run_gates returns only the first failing GateResult (not its index); prefers a skip_to_phase validator when present, else the first validator's on_failure — the routing intent of the gate set"
  - "Settings.harness_phase_max_steps sourced into phase_types._EXPLORER_STEP_CAP too (single source of truth) so the magic 8 isn't duplicated; the engine surfaces _DEFAULT_PHASE_MAX_STEPS so both engine and executor agree on the step bound"
  - "ctx.retry_feedback is CLEARED (set None) on both success and exhaustion so a gated phase's feedback never pollutes a later phase's prompt"

requirements-completed: [HARNESS-04]

# Metrics
duration: 7min
completed: 2026-05-31
---

# Phase 091 Plan 05: Validation Gates + Bounded Retry + on_failure Routing + Caps Summary

**Filled the two SEAMs Plan 02 left open — the 4-kind VALIDATOR_REGISTRY (json_schema / regex_match / workspace_file_exists / programmatic, all fail-closed) plus the bounded-retry control flow that replaces the `_run_gates` no-op — so a deterministically-failing gate now reaches `failed` in ≤ 3 attempts and NEVER loops (the SC#3 bar), short-circuits even faster on identical output, feeds the validator error back via `ctx.retry_feedback` (the PRODUCER half of the Plan 03 round-trip), audits + emits `gate_failed` on every attempt (D-08), and routes `on_failure` to fail_run (keep partials + plain reason, D-07) / skip_to_phase (D-09) / unknown→fail_run (fail-safe) — with both a step cap (in the executor) and a wall-clock cap (`asyncio.wait_for`, D-12) on every phase.**

## Performance
- **Duration:** ~7 min
- **Started:** 2026-05-31T05:38:26Z
- **Completed:** 2026-05-31T05:45:48Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- **Task 1 — `harness/validators.py`:** A closed `VALIDATOR_REGISTRY` (mirrors `_TOOL_REGISTRY`) with a `register_validator(kind)` decorator and the 4 firm kinds. `json_schema` uses `jsonschema.validate` (declarative — NO eval, T-091-17) and catches both `ValidationError` and `SchemaError`. `regex_match` is `re.search(config["pattern"], output_text)`. `workspace_file_exists` reuses the shipped `db/workspace.get_file_by_path(pool, thread_id, path)`. `programmatic` resolves a SECOND closed `PROGRAMMATIC_VALIDATOR_REGISTRY` (unknown `fn` raises — never eval'd). Every kind fails closed with a descriptive `error_message`. `run_gates(phase, output, ctx)` runs each validator in order and returns the FIRST failing `GateResult` (or pass).
- **Task 2 — cap defaults (config.py, D-12):** `Settings.harness_phase_max_steps = 8` (the Explorer `max_iterations` convention, agent_loop.py:846) and `Settings.harness_phase_wall_clock_seconds = DEFAULT_LLM_CALL_TIMEOUT_SECONDS(300) × 8 = 2400` (a phase making up to N bounded LLM calls must allow ≥ N × the per-call timeout). The engine reads both off Settings (`_DEFAULT_PHASE_WALL_CLOCK`, `_DEFAULT_PHASE_MAX_STEPS`); `phase_types._EXPLORER_STEP_CAP` now sources `Settings.harness_phase_max_steps` so the `8` isn't duplicated. No new env var beyond the two Settings fields (free pydantic-settings override). A per-phase `config.wall_clock_seconds` overrides the default.
- **Task 3 — bounded retry + routing + caps (harness_engine.py):** `_run_phase_with_gates` runs the phase under the wall-clock cap, runs the gates, and on failure retries up to `max_retries` (default 2 → ≤ 3 total attempts) — a HARD bound that NEVER loops (SC#3). A consecutive-identical output short-circuits even faster. Every attempt writes a `gate_failed` audit row AND emits a `gate_failed` SSE event (D-08). The validator error is fed forward via `ctx.retry_feedback` (PRODUCER side; cleared on success/exhaustion so it never leaks). On exhaustion `_route_on_failure` maps the failing validator's `on_failure` to a `PhaseOutcome`: `fail_run` (the run flips `failed`, completed phases' outputs are kept untouched, a plain-language `run_failed` reason naming the phase reaches chat — D-07) or `skip_to_phase:<slug>` (the phase is marked `skipped`, the index-driven loop jumps the cursor — D-09; a dangling runtime target fails safe to fail_run, T-091-18). A wall-clock `asyncio.TimeoutError` is treated as a terminal gate failure (`wall_clock_timeout`) driving the SAME routing (D-12). The `for`-each loop became an index-driven `while` so the skip can jump.

## Task Commits
1. **Task 1: VALIDATOR_REGISTRY (4 kinds) + GateResult + run_gates** — `6fe81e66` (feat)
2. **Task 2: harness phase cap defaults from existing knobs (D-12)** — `c90d5a6c` (feat)
3. **Task 3: bounded retry loop + on_failure routing + caps wired into engine** — `f9b6c24c` (feat)

## Files Created/Modified
- `backend/app/services/harness/validators.py` — VALIDATOR_REGISTRY + 4 kinds + GateResult + run_gates + closed PROGRAMMATIC_VALIDATOR_REGISTRY (created)
- `backend/app/config.py` — Settings.harness_phase_max_steps + harness_phase_wall_clock_seconds (D-12)
- `backend/app/services/harness_engine.py` — _run_phase_with_gates bounded-retry loop + _parse_on_failure/_route_on_failure/_failing_on_failure + index-driven run_workflow loop + lazy imports (replaced the Plan-02 _run_gates no-op)
- `backend/app/services/harness/phase_types.py` — _EXPLORER_STEP_CAP sources Settings.harness_phase_max_steps (no duplicated magic number)
- `backend/tests/test_harness_gates.py` — flipped all 7 Wave-0 contracts live (4-kinds + first-failure + bounded(≤3) + short-circuit + retry-feeds-error + skip_to_phase + caps + fail_run-keeps-partial); 9 tests green

## Decisions Made
- **`workspace_file_exists` reuses `get_file_by_path`:** the shipped typed asyncpg helper already does exactly the thread+path lookup; the validator reads `pool`/`thread_id` off `ctx` so the recording-pool fixture mocks it cleanly. Zero new DB code.
- **`_failing_on_failure` re-derives the disposition:** `run_gates` intentionally returns only the first failing `GateResult` (not its index), so the routing helper re-scans the phase's validators — preferring a `skip_to_phase` validator (the recovery intent) and otherwise the first validator's `on_failure`. Exact for the common single-validator phase.
- **Retry state is loop-local, not persisted (OQ3 = NO):** per RESEARCH, a phase that exhausted retries is already `failed` (not `active`), so a restart re-runs an `active` phase from attempt 0 — bounded and simpler than persisting the attempt count.
- **`ctx.retry_feedback` cleared on success AND exhaustion:** prevents a gated phase's feedback string from polluting a downstream phase's prompt (the producer/consumer contract is per-phase).

## Deviations from Plan
- **[Rule 3 - Blocking] Broke a harness-package import cycle.** Adding top-level `from app.services.harness.reachability import parse_skip_target` / `...validators import run_gates` to the engine triggered `ImportError` (partially-initialized module): importing any submodule under the `app.services.harness` package runs its `__init__`, which imports `phase_types`, whose module-level `register_all()` imports back from `harness_engine` before `PHASE_TYPE_REGISTRY` is bound. **Fix:** import `run_gates` / `parse_skip_target` LAZILY inside the engine functions that use them (the same lazy-import pattern `phase_types.register_all` already uses for the engine). Documented inline. Caught on the first import-smoke after Task 2; one-import-style correction, no scope change.

No other deviations — Tasks 1–3 executed as written. Rules 1/2/4 did not fire.

## Threat Model Compliance
- **T-091-16 (DoS — unbounded gate retry):** mitigated. HARD bound (`max_retries+1 ≤ 3`) + consecutive-identical short-circuit + per-phase step cap (executor) AND wall-clock cap (`asyncio.wait_for`). Proven by `test_bounded_retry_reaches_failed_after_3_attempts` (exactly 3 executions, terminates) + `test_consecutive_identical_short_circuits` (2 executions) + `test_caps_step_and_wall_clock` (hanging phase times out → fail_run).
- **T-091-17 (Tampering — author config runs code):** mitigated. `json_schema` uses `jsonschema.validate` (declarative); `programmatic` resolves a CLOSED `PROGRAMMATIC_VALIDATOR_REGISTRY` (unknown fn raises `KeyError`, never imported/eval'd). Tested by the unknown-fn `pytest.raises(KeyError)` branch.
- **T-091-18 (Tampering/DoS — skip_to_phase to a non-existent slug):** mitigated. Lint catches it at publish (Plan 02 reachability) + a runtime guard (`index_by_slug.get(target) is None → fail_run`).
- **T-091-19 (Repudiation — silent failure / hidden retries):** mitigated. Every attempt writes `gate_failed` (audit) + emits `gate_failed` (SSE); `run_failed` is audited + emitted with a plain reason (D-07/D-08 — nothing silently dropped). Asserted by the audit-count + emit-count + run_failed-reason assertions.

## Cross-Provider Safety
Zero edits to any `*_service.py` provider streaming branch or `agent_loop.py`. The gate/retry logic lives entirely above the loop in `harness_engine.py` + the new pure `validators.py`. The only `phase_types.py` change is sourcing the step-cap default from Settings (a constant, not a behavior change). `ctx.retry_feedback` is the additive producer side of the contract the Plan 03 executors already consume.

## Cross-Plan Note (07-T2 round-trip)
This plan is the **PRODUCER** of `ctx.retry_feedback` (it SETS the validator error before a retry, then clears it). Plan 03's LLM executors are the **CONSUMER** (`_retry_suffix(ctx)` appends it to the phase prompt). Plan 03 and Plan 05 are same-wave (wave 3) siblings with no `depends_on`, so the full producer→consumer round-trip is NOT green within either plan alone — it is jointly verified end-to-end in **07-T2** (integration). Within this plan the producer side is wired-and-unit-proven (`test_retry_feeds_error_into_prompt` asserts the stub executor sees the feedback on retry).

## Verification
- `pytest tests/test_harness_gates.py -q` → **9 passed** (4-kinds pass/fail, run_gates first-failure, bounded≤3-never-loops, consecutive-identical short-circuit, retry-feeds-error, skip_to_phase routing, caps step+wall-clock, fail_run-keeps-partial).
- `pytest tests/test_harness_engine.py tests/test_harness_resume.py tests/test_harness_reachability.py tests/test_harness_gates.py tests/test_harness_whitelist.py tests/test_tool_budget.py -q` → **68 passed, 3 skipped** (the 3 skips are Plan 04 resume contracts) — no collateral breakage.
- Import smoke: `from app.services.harness.validators import run_gates, VALIDATOR_REGISTRY; assert set(VALIDATOR_REGISTRY) >= {'json_schema','regex_match','workspace_file_exists','programmatic'}` → **ok**.
- `from app.config import settings; assert settings.harness_phase_wall_clock_seconds == 2400` (300×8) and `harness_phase_max_steps == 8` → **ok**.
- No file deletions across the 3 commits (`git diff --diff-filter=D HEAD~3 HEAD` empty).

## TDD Gate Compliance
This plan is `type: execute`. Task 1 was authored `tdd="true"` — the implementation + the live test landed in the same `feat` commit (`6fe81e66`), with the Wave-0 skeleton skips as the pre-authored RED contracts that the implementation flips GREEN. Tasks 2–3 flipped the remaining Wave-0 gate contracts live in their `feat` commits. Per-task `pytest` gates passed before each commit.

## Known Stubs
None. The `_persist_output` placeholder spill path (`workspace-files://pending`) is Plan 02's documented seam (owned by Plan 03's large-blob executors), untouched here. All gate kinds are fully implemented and live-tested.

## Next Phase Readiness
- **Plan 07 (seeds / 07-T2):** the retry-feedback round-trip (this PRODUCER + Plan 03 CONSUMER) is wired on both sides and ready for the joint integration proof. `run_gates` + `VALIDATOR_REGISTRY` are importable; the 4 seed shapes (which carry no validators by default) run the gate path as a no-op pass.
- **Phase 092 (run-start):** `run_workflow` now fully owns gates + retry + on_failure + caps end-to-end; the 092 branch can call it knowing a failing gate terminates cleanly at `failed` (never hangs) keeping partial outputs.

## Self-Check: PASSED
- `backend/app/services/harness/validators.py` verified on disk.
- All 3 task commits (`6fe81e66`, `c90d5a6c`, `f9b6c24c`) present in git history.
- No accidental file deletions.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
