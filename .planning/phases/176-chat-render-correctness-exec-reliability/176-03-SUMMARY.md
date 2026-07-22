---
phase: 176-chat-render-correctness-exec-reliability
plan: 03
subsystem: infra
tags: [sandbox, llm_sandbox, pip, execute_code, tool_dispatcher, redis, auto-heal, cross-provider]

# Dependency graph
requires:
  - phase: 142-runtime-gap-classification
    provides: "_NO_MODULE_RE + _classify_runtime_gap + KNOWN_MISSING_MODULES (reused for module extraction + KNOWN_MISSING pass-through)"
  - phase: 083-tool-dispatch-extraction
    provides: "ToolContext (ctx.redis / ctx.run_id) + _handle_execute_code handler seam"
provides:
  - "Reliable declared-library install via `python -m pip` (system interpreter, non-stream => reliable exit_code), retry x1, never swallowed"
  - "Bounded run-scoped ModuleNotFound auto-heal: install missing module + threadpool-wrapped re-run once, 1-per-module-per-RUN via a per-run Redis set (heal_attempted:{run_id}) with graceful call-local fallback"
  - "Honest install_failed note on the model-facing llm_content (never a raw traceback under a 'completed' status)"
affects: [execute_code, sandbox reliability, cross-provider tool-use, SEED-043]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-interpreter sandbox install: python -m pip (matches `python -u <file>`) instead of the venv-targeted, failure-swallowing session.install"
    - "Run-scoped bookkeeping via a per-run Redis SET keyed on ctx.run_id (SADD/SISMEMBER + EXPIRE 600), read+written entirely in the dispatcher, with a graceful call-local fallback (Deep byte-identical, no ctx field, no agent_loop touch)"
    - "Honest model-facing note on llm_content mirroring the _classify_runtime_gap runtime_gap injection (persisted/UI tool_result stays a normal error)"

key-files:
  created: []
  modified:
    - "backend/app/services/tool_dispatcher.py — _pip_install / _install_declared_libraries / _derive_actual_exit_code / _extract_missing_module / _install_failed_detail / _heal_bound_seen / _heal_bound_record / _autoheal_missing_module + wiring in _handle_execute_code"
    - "backend/tests/unit/test_tool_dispatcher.py — 12 new EXEC-01 unit tests"

key-decisions:
  - "Replaced session.install (venv pip, swallows failures — Defects A+B) with python -m pip install into the system interpreter, exit-code checked, retry once"
  - "Heal bound is RUN-SCOPED (per-run Redis key) not call-local — a call-local set re-initializes each _handle_execute_code call and could not bound the actual BUG-260708-02 cross-CALL re-attempt"
  - "Honest install_failed lives on llm_content only (model-facing); persisted/UI tool_result stays a normal error — mirrors the runtime_gap pattern"
  - "KNOWN_MISSING permanent-gap modules are left to _classify_runtime_gap (never healed); unknown modules are healed — mutually exclusive by construction"

patterns-established:
  - "Pattern 1: same-interpreter, non-streaming sandbox install with reliable exit code (python -m pip via session.execute_command, no stream callbacks)"
  - "Pattern 2: run-scoped 1-per-token bound via a per-run Redis set with a graceful call-local fallback (a Redis hiccup never breaks execute_code)"

requirements-completed: [EXEC-01]

# Metrics
duration: ~35min
completed: 2026-07-22
---

# Phase 176 Plan 03: Reliable execute_code Library Install + Bounded Auto-Heal Summary

**Declared `libraries` now install via `python -m pip` into the same interpreter that runs the code (retry x1, never swallowed), and an undeclared `ModuleNotFoundError` triggers a bounded, run-scoped auto-heal (install + one threadpool-wrapped re-run) with an honest `install_failed` result on persistent failure — entirely in `tool_dispatcher.py`, provider-uniform, Deep byte-identical.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-23T00:33:25+04:00 (first RED commit)
- **Completed:** 2026-07-23T00:38:55+04:00 (last GREEN commit) + finalization
- **Tasks:** 2 (both TDD — 4 task commits: 2 test + 2 feat)
- **Files modified:** 2 (`tool_dispatcher.py`, `test_tool_dispatcher.py`)

## Accomplishments

- **Defect A + B closed (declared install):** `session.install(libraries=...)` (venv pip that silently swallows a non-zero exit AND installs where `python -u` can't see it) replaced with `_pip_install` → `python -m pip install --disable-pip-version-check <shlex-quoted libs>` via `session.execute_command` with **no** stream callbacks (non-streaming ⇒ reliable `exit_code` + `stderr`), retried exactly once, with the pip stderr carried forward on persistent failure (never swallowed).
- **Defect C closed (auto-heal + honest signal):** after `exec_result`, a failed run whose stderr/stdout carries `No module named 'X'` (via the reused `_NO_MODULE_RE`) installs `X` and re-runs the code **once** (threadpool-wrapped `session.execute_command(f"python -u {code_file}")`, D-v2.5-01) reusing the container-resident `code_file`; on persistent failure the model gets an honest `install_failed` payload (`module` + truncated pip `reason` + a preinstalled-lib `hint`) instead of a raw traceback under a "completed" status.
- **Run-scoped 1-per-module bound (the actual BUG-260708-02 fix):** the heal bound lives in a per-run Redis SET `heal_attempted:{ctx.run_id}` (SADD/SISMEMBER + EXPIRE 600), so a re-attempt of the same module in a *later* `execute_code` call in the same run is suppressed — a call-local set could not bound this (it re-initializes every call). Reads AND writes happen entirely in `tool_dispatcher.py` (no `ctx` field, no `agent_loop.py` touch).
- **Graceful degradation:** any Redis error/unavailability falls back to a call-local `set` and logs — `execute_code` never breaks on a Redis hiccup, and an unwired/duck-typed caller (no `ctx.redis` / no `ctx.run_id`) stays byte-identical (Deep unaffected).
- **Provider-uniform / D-14:** all edits are below the adapter boundary inside `_handle_execute_code` and its helpers — no `provider ==` fork, no shared Deep/agent-loop path change; a clean run never enters the heal (byte-identical).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing declared-install tests** — `bfcaaa62` (test)
2. **Task 1 (GREEN): declared-install hardening (`python -m pip`, retry x1)** — `c73fa838` (feat)
3. **Task 2 (RED): failing run-scoped auto-heal tests** — `6a4b25fe` (test)
4. **Task 2 (GREEN): run-scoped ModuleNotFound auto-heal + honest result** — `cfde2f2e` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified

- `backend/app/services/tool_dispatcher.py` — added `import shlex`; `_pip_install`, `_install_declared_libraries`, `_EXEC_ERROR_MARKERS` + `_derive_actual_exit_code` (hoisted/shared), `_extract_missing_module`, `_install_failed_detail`, `_heal_bound_seen`, `_heal_bound_record`, `_autoheal_missing_module`; wired the hardened install seam + the failed-run heal hook + the honest `install_failed` note into `_handle_execute_code`.
- `backend/tests/unit/test_tool_dispatcher.py` — 12 new EXEC-01 unit tests (declared-install retry/surface/success; module extraction; honest-payload shape; auto-heal install+re-run; run-scoped bound; Redis-unavailable fallback; install-failure honest result; KNOWN_MISSING pass-through; declared-failure honest surface).

## Decisions Made

- **Run-scoped over call-local heal bound.** The plan's D-02.2/D-03 (and RESEARCH's revised heal-bound-scope decision) require the bound to survive across `execute_code` calls within a run — implemented as a per-run Redis set on `ctx.run_id`, read+written in the dispatcher (D-04 locks the change out of `agent_loop.py`/`ToolContext`, so no `ctx.healed_modules_in_run` field was added).
- **Honest note on `llm_content` only.** Mirrors the existing `_classify_runtime_gap` `runtime_gap` injection so the model gets actionable framing while the persisted/UI `tool_result` stays a normal error.
- **`_EXEC_ERROR_MARKERS` hoisted to module scope + `_derive_actual_exit_code` helper.** The inline exit-code derivation was extracted so the post-heal re-run re-derives the effective exit code consistently (Defect C: a bare `python -u` streams exit 0 even on a traceback).

## Deviations from Plan

None — plan executed exactly as written. The plan's `<interfaces>` anchors (all cited by line) were re-verified against current code before editing; the D-04 lock (no `agent_loop.py`/`ToolContext` touch) was honored by using the per-run Redis key instead of the RESEARCH-suggested `ctx.healed_modules_in_run` sibling field.

## Issues Encountered

None. The line anchors in the plan had drifted (174/175 shipped since), so edits were made by content match rather than line number; all target-file tests stayed green.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>` (T-176-03-01/02/SC — all `accept`): the runtime `pip install` is a model-named, sandbox-contained fetch the model could already perform; pip stderr is truncated ~300 chars; the `heal_attempted:{run_id}` key is backend-internal run bookkeeping in the trusted Redis run-buffer namespace (module-name strings only, TTL 600s self-expire). No build-time dependency added; no new endpoint/auth/schema. No Threat Flags.

## Verification

- **Per-plan (Task 1):** `pytest tests/unit/test_tool_dispatcher.py -x -k "install"` → 4 passed.
- **Per-plan (Task 2):** `pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -x` → 42 passed (30 baseline + 12 new; runtime-gap regression suite unchanged/green).
- **Source acceptance:** `python -m pip install --disable-pip-version-check` present; `session.install` no longer used for declared libs (comment-only references remain); heal re-run is `run_in_threadpool(session.execute_command, f"python -u {code_file}")`; run-scoped bound key `heal_attempted:{run_id}`; module imports cleanly; no `provider ==` fork in new code.
- **Wave-merge (D-14 differential):** `cd backend && ./venv/Scripts/python -m pytest -q` — to be run at wave merge (per plan `<verification>`); this plan's scope tests are green and the module imports clean.

## User Setup Required

None — no external service configuration required. Live UAT (176-VALIDATION Manual-Only, SC#10 multi-tool axis: DeepSeek/fpdf2 warm-session declared install; an undeclared-import auto-heal; a bad-name honest "Could not install X"; a second same-module miss later in the same run not re-attempted) rolls forward as tracked validation.

## Next Phase Readiness

- EXEC-01 delivered; ready for wave-merge differential + the 176 live SC#10 UAT.
- No blockers. No migration, no new dependency, no cloud-parity added.

---
*Phase: 176-chat-render-correctness-exec-reliability*
*Completed: 2026-07-22*
