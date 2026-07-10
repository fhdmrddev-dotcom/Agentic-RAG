---
phase: 142-non-python-skill-script-honesty-stretch
plan: 02
subsystem: api
tags: [sandbox, tool-dispatcher, agent-loop, honesty, repeat-guard, run-scope]

# Dependency graph
requires:
  - phase: 142-non-python-skill-script-honesty-stretch (Plan 01)
    provides: "_classify_runtime_gap + GAP_MESSAGES/GAP_MESSAGES_JS/GAP_MESSAGES_MISSING_FILE + KNOWN_MISSING/JS_TOKENS allowlists"
  - phase: 120-collision-fix-context-isolation
    provides: "the run-scoped by-reference threading precedent (new_file_hashes_in_run / previous_files_in_run)"
provides:
  - "ToolContext.dead_gap_tokens_in_run — run-scoped by-reference repeat-guard set (default-off)"
  - "_handle_execute_code POST-HOC reshape — permanent-framed runtime_gap note on the model-facing llm_content on a classifier hit"
  - "_handle_execute_code PRE-FLIGHT repeat-guard — short-circuits a re-referenced dead token BEFORE the sandbox is acquired (caps BUG-260707-02 loop at ≤1 dead call/token)"
  - "_message_for_dead_token + _repeat_blocked_result short-circuit helpers"
  - "agent_loop run-scoped init + both ToolContext builds threaded; task_service fresh-set for sub-agents"
  - "test_142_repeat_guard.py — short-circuit / run-scope-not-setattr / sub-agent-fresh / D-03 loop-cap"
affects: [142-03 (SCRIPT_EXTS decode + load_skill flag), 142-05 (import note)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive default-off run-scoped by-reference state on ToolContext (mirror new_file_hashes_in_run), guarded `is not None` everywhere → literal no-op for unwired callers (D-14)"
    - "Post-hoc reshape ONLY on a fixed-allowlist classifier hit; classifier miss = byte-identical passthrough (T-142-01)"
    - "Pre-flight structural loop-cap: distrust the model-supplied code string, match a bounded token set case-insensitively, short-circuit before any I/O"

key-files:
  created:
    - backend/tests/unit/test_142_repeat_guard.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/agent_loop.py
    - backend/app/services/task_service.py

key-decisions:
  - "Pre-flight guard placed AFTER `code`/`libraries` extraction but BEFORE the `code_execution_start` emit — a short-circuited call fires NO sandbox SSE events and never acquires a session (the cleanest 'never touch the sandbox' point)."
  - "The recorded set stores only the token; the pre-flight message is reconstructed via `_message_for_dead_token` (GAP_MESSAGES → JS_TOKENS → G-A path) rather than storing the full class/message tuple — keeps the set bounded and byte-identical to the classifier wording."
  - "Short-circuit result is error-shaped (`status='error'`, `exit_code=1`) with `runtime_gap.repeat_blocked=True` + the 'already attempted this run' note so a weak model treats it as a hard failed call, not a transient one."

patterns-established:
  - "Reshape mutates ONLY the model-facing `llm_content`; the persisted/UI `tool_result` and raw stdout/stderr stay untouched — honesty is a model-facing concern, the UI keeps the literal sandbox output."

requirements-completed: [SRH-01]

# Metrics
duration: 8min
completed: 2026-07-08
---

# Phase 142 Plan 02: Reactive Reshape + Per-Run Repeat-Guard Summary

**Wired the Plan 01 classifier into the live `execute_code` path — a permanent-framed `runtime_gap` note now rides the model-facing `llm_content` on a known-gap failure (SC#2), and a run-scoped by-reference `dead_gap_tokens_in_run` set short-circuits any re-referenced dead token BEFORE the sandbox is acquired, structurally capping the BUG-260707-02 soffice/markitdown retry loop at ≤1 real dead call per token (D-03) — all default-off and byte-identical for every unwired caller (D-14).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-08T00:49:51Z
- **Completed:** 2026-07-08T00:58:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- **SC#2 / D-06 post-hoc reshape:** after `actual_exit_code` is derived and before `llm_content` is built, `_handle_execute_code` calls `_classify_runtime_gap(code, stdout, stderr, exit_code)`. On a hit it appends a `runtime_gap` `{class, token, message}` key to the model-facing `llm_content` and records the token in the run-scoped set (guarded `is not None`). On a miss the stdout/stderr pass through **byte-identical** — a real error still reaches the model (T-142-01, proven by the existing execute_code / tool_dispatcher tests staying green).
- **D-06 / D-03 pre-flight repeat-guard:** near the handler top (before the `code_execution_start` emit and any sandbox acquisition) the incoming `code` is scanned case-insensitively for any token already in `ctx.dead_gap_tokens_in_run`; on a match it returns an error-shaped short-circuit `ToolResult` carrying the same permanent message + the "you already attempted this in the current run" line, and **never touches the sandbox**. This caps the 8-round pptx loop at ≤1 real dead sandbox call per token by construction.
- **D-06 run-scope (T-142-05):** `dead_gap_tokens_in_run` is a new `set | None = None` field on `ToolContext`, init once per run in `agent_loop.py` (outside the iteration loop) and threaded by-reference into BOTH ToolContext builds (resume + main) exactly beside `new_file_hashes_in_run` — so it survives the per-iteration ctx rebuild (Pitfall 1). Sub-agents get a **fresh `set()`** in `task_service.py` (Pitfall 6) so a sub-agent's dead call never blocks a legitimately-different parent.
- **D-14 byte-identical:** every use is guarded `is not None`; every unwired caller (harness `phase_types.py`, `eval_runner_service.py`, tests, duck-typed callers) leaves the field `None` → literal no-op. `sandbox_service.py`, `Dockerfile.sandbox`, and the `python -u` invocation are untouched (D-02).

## Task Commits

Each task committed atomically (Task 2 is the GREEN half of the Task 1 RED scaffold — TDD):

1. **Task 1: repeat-guard test scaffold (RED)** — `bd4c4f34` (test)
2. **Task 2: ToolContext field + reshape + pre-flight guard (GREEN)** — `6ca79634` (feat)
3. **Task 3: thread run-scoped set through agent_loop + sub-agent fresh set** — `3cebe8ba` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — see final docs commit.

## Files Created/Modified
- `backend/tests/unit/test_142_repeat_guard.py` (new) — drives the LIVE `_handle_execute_code` through a fully-mocked sandbox stack. `test_repeat_short_circuits` (two soffice calls → `get_or_create` invoked exactly once + call 2 carries the repeat-blocked note), `test_run_scoped_not_setattr` (the same by-reference set drives the guard across two separately-built contexts; a separate run with its own set is unaffected), `test_subagent_fresh_set` (a parent's dead token never short-circuits a fresh sub-agent set), `test_pptx_soffice_loop_capped` (8 rounds → sandbox touched ≤ distinct-token count == 1).
- `backend/app/services/tool_dispatcher.py` — added `ToolContext.dead_gap_tokens_in_run`; the pre-flight guard (before the start emit) and post-hoc reshape (at the `llm_content` builder) inside `_handle_execute_code`; module-level `_message_for_dead_token` / `_REPEAT_BLOCKED_NOTE` / `_repeat_blocked_result` helpers beside `_classify_runtime_gap`.
- `backend/app/services/agent_loop.py` — `_dead_gap_tokens_in_run: set[str] = set()` init once per run; threaded into the resume and main-loop ToolContext builds (3 references total).
- `backend/app/services/task_service.py` — `dead_gap_tokens_in_run=set()` fresh set on the sub-agent `sub_ctx` build (mirrors `previous_files_in_run={}`).

## Decisions Made
- **Pre-flight placement (before the start emit):** the guard sits right after the `code`/`libraries` extraction and returns before `code_execution_start` fires, so a short-circuited call emits zero sandbox events and never acquires a session — the strictest reading of "never touch the sandbox."
- **Token-only set + message reconstruction:** the set stores just the gap token (bounded by the fixed allowlist — T-142-04); the pre-flight message is reconstructed with `_message_for_dead_token` (GAP_MESSAGES for binaries/modules, GAP_MESSAGES_JS for a JS marker, GAP_MESSAGES_MISSING_FILE for a G-A path). No unbounded/attacker-controlled key growth.
- **Reshape scope:** only `llm_content` (model-facing) grows the `runtime_gap` key; `tool_result` (persisted + UI copy) and the raw stdout/stderr are left untouched, so the honest framing is model-facing while the UI keeps the literal sandbox output.

## Deviations from Plan

None — plan executed exactly as written. The three decisions above are implementation-precision choices fully inside the plan's stated `<behavior>`; they change no test outcome and add no scope.

## Deferred Issues

None introduced by this plan. The `tests/unit` suite carries **60 pre-existing failures** (baseline rot from Phase 075.4's ~98 categorized pre-existing backend failures — test-vs-production drift in `test_sql_service.py`, `test_sandbox_service.py::TestHarvestOutputFiles`, `test_retrieval_service.py`, `test_streaming_reliability.py`). Proven pre-existing and out of scope: a throwaway worktree at the pre-change base commit (`871adc07`) shows **60 failed / 1131 passed** for `tests/unit`; HEAD shows **60 failed / 1135 passed** — my change added the 4 new repeat-guard tests and **zero net failures**. None of the failing files were touched by this plan.

## Threat Surface

No new security-relevant surface. The three registered threats are satisfied by construction: **T-142-01** — reshape fires only on a `_classify_runtime_gap` hit (existing execute_code tests stay byte-identical on a miss); **T-142-04** — only fixed-allowlist tokens are ever `.add`-ed, so the set is bounded regardless of model input; **T-142-05** — the set is by-reference per run, fresh `set()` for sub-agents, and `None` default = no-op for every unwired caller. No network endpoints, auth paths, file access, or schema changes.

## User Setup Required
None — honesty-only mechanism (D-02). No migration, no Docker rebuild, no new dependency.

## Next Phase Readiness
- Plan 03 can import `SCRIPT_EXTS` and extend `_decode_skill_file_bytes` (SC#3 read_skill_file caveat) + add the `load_skill` gap flag (D-05b); the classifier + all constants + the run-scoped substrate are live.
- Plan 05 can add the `import_skill` static SCRIPT_EXTS note (SC#1) + the `SkillsPage` render.
- No blockers. Live evidence of the SC#2/D-03 mechanism requires a real uninstalled-binary run (cross-provider UAT, per 142-VALIDATION.md) — the automated `test_pptx_soffice_loop_capped` proves the loop-cap by construction against a mocked sandbox.

## Self-Check: PASSED
- `backend/tests/unit/test_142_repeat_guard.py` — FOUND
- `backend/app/services/tool_dispatcher.py` — FOUND
- `backend/app/services/agent_loop.py` — FOUND
- `backend/app/services/task_service.py` — FOUND
- Commit `bd4c4f34` (test) — FOUND
- Commit `6ca79634` (feat) — FOUND
- Commit `3cebe8ba` (feat) — FOUND
- Verification: `test_142_repeat_guard.py` 4/4 GREEN; combined 142 + Deep no-op run 41/41 GREEN; `grep dead_gap_tokens_in_run` = tool_dispatcher 5 refs / agent_loop 3 refs / task_service 1 ref; `git diff` excludes `sandbox_service.py` / `Dockerfile.sandbox` / the `python -u` line.

---
*Phase: 142-non-python-skill-script-honesty-stretch*
*Completed: 2026-07-08*
