---
phase: 089-agent-loop-extraction-g-5-kickoff-uat
plan: 02
subsystem: testing
tags: [eval, sse, redis-streams, cross-provider, zhipu, minimax, byte-identical, proof-harness]

# Dependency graph
requires:
  - phase: 088-eval-cross-provider-seed
    provides: "scripts/eval_cross_provider.py (6-provider gate, localhost hard-gate, secret-safe env reporting, real-route driver)"
provides:
  - "Native-7 eval gate (zhipu/GLM + minimax added to eval_cross_provider.py PROVIDERS + env-presence checks)"
  - "SSE capture/normalize/diff helper (scripts/capture_run_events.py) for the byte-identical SC#3 proof"
  - "Operator before/after SSE-diff runbook (scripts/SSE_DIFF_RUNBOOK.md) + eval backstop procedure"
  - "BEFORE-baseline capture procedure runnable against the PRE-MOVE loop (Wave 1)"
affects:
  - "089-03 (verbatim agent-loop move — AFTER capture diffs against the baseline this plan produces)"
  - "089-04 (CF-01 sweep — runs the eval backstop + AFTER SSE-diff per native-7)"
  - "091-096 (all read native-7, not the ROADMAP's stale 6)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE byte-identical proof via XRANGE run:{run_id} capture + normalize(mask volatile ids/timestamps) + per-index diff"
    - "Additive eval-gate extension: append (provider, model) PROVIDERS rows + (NAME, is_secret=True) env-presence rows; choices auto-derive"

key-files:
  created:
    - scripts/capture_run_events.py
    - scripts/SSE_DIFF_RUNBOOK.md
  modified:
    - scripts/eval_cross_provider.py

key-decisions:
  - "Pinned the representative multi-tool prompt (search_documents + execute_code) so before/after SSE captures use identical input (D-089-10 discretion)"
  - "capture_run_events robustly handles both decode_responses=True/False Redis clients (coerces bytes 'data' field) — defensive, no behavior assumption"
  - "diff_event_streams returns per-index (idx, before, after) tuples incl. length-mismatch (None for the short side) — operator sees exactly where a non-empty diff is"

patterns-established:
  - "Pattern 1: SSE-diff proof — normalize() masks message_id/run_id + drops captured_at; everything else (event type, ordering, content deltas) is the behavior under test and is preserved verbatim"
  - "Pattern 2: native-7 single source of truth — eval PROVIDERS mirrors config.py _PROVIDER_BASE_URLS keys; zhipu/minimax model IDs pinned to _SUB_AGENT_MODEL_DEFAULTS (config.py:554-555)"

requirements-completed: [FOUND-03]

# Metrics
duration: 6min
completed: 2026-05-30
---

# Phase 089 Plan 02: Native-7 Eval Gate + SSE-Diff Proof Harness Summary

**Additive proof harness for the byte-identical native-7 SSE bar (SC#3): extended the cross-provider eval to zhipu/GLM + minimax, authored the `capture_run_events`/`normalize`/`diff_event_streams` SSE helper, and wrote the operator before/after SSE-diff runbook — zero agent-loop edits.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-30T14:02:11Z
- **Completed:** 2026-05-30T14:05:04Z
- **Tasks:** 3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- Extended `scripts/eval_cross_provider.py` from 6 → native-7: appended `("zhipu", "glm-4-flash")` + `("minimax", "minimax-m2.7")` to `PROVIDERS` and `ZHIPU_API_KEY`/`MINIMAX_API_KEY` (is_secret=True, presence-only) to `report_env_presence()`. Model IDs verified live against `config.py:_SUB_AGENT_MODEL_DEFAULTS` (L554-555). The `--provider` choices auto-derive; the localhost hard-gate, queries, and print loop are untouched.
- Authored `scripts/capture_run_events.py`: `capture_run_events(redis, run_id)` (reads `XRANGE run:{run_id} - +`, the exact SSE wire payload), `normalize(events)` (drops `captured_at`, masks `message_id`/`run_id`), `diff_event_streams(before, after)` (per-index diff; `[]` == SC#3 PASS). Pure importable utility, no top-level execution.
- Authored `scripts/SSE_DIFF_RUNBOOK.md`: the operator-run before/after procedure with a pinned multi-tool prompt, per-native-7 baseline save path (`scripts/.sse_baseline/<provider>.json`), the AFTER empty-diff assertion, the native-7-hard / OpenRouter-best-effort gate split, and the `EVAL_SUMMARY` eval backstop — explicitly operator-run with uvicorn in a visible terminal, never `run_in_background`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend eval_cross_provider.py to native-7** - `a9d156b4` (feat)
2. **Task 2: Author the SSE capture helper** - `3741603c` (feat)
3. **Task 3: Write the before/after SSE-diff operator runbook** - `2940a78f` (docs)

**Plan metadata:** _(final docs commit below)_

## Files Created/Modified
- `scripts/eval_cross_provider.py` - +6 lines: 2 PROVIDERS rows (zhipu/minimax) + 2 env-presence checks (additive, secret-safe)
- `scripts/capture_run_events.py` - NEW: SSE capture + normalize + diff utilities for the byte-identical SC#3 proof
- `scripts/SSE_DIFF_RUNBOOK.md` - NEW: operator before/after SSE-diff procedure + eval backstop

## Decisions Made
- **Pinned the SSE-diff prompt** (`search_documents` + `execute_code`) plus a `write_todos` variant, so before/after captures use identical input (D-089-10 — Claude's discretion).
- **`capture_run_events` coerces the Redis `data` field robustly** for both `decode_responses=True` and `False` clients (bytes vs str), so the helper works regardless of how the operator's driver instantiates the Redis client — no behavior assumption baked in.
- **`diff_event_streams` reports per-index `(idx, before, after)` including length mismatch** (the short side reports `None`), so a non-empty diff tells the operator exactly which event position diverged.
- **Model IDs verified live before committing**, not trusted from RESEARCH alone: confirmed `_SUB_AGENT_MODEL_DEFAULTS["zhipu"]="glm-4-flash"` and `["minimax"]="minimax-m2.7"` at config.py:555/554, and the env-var names `ZHIPU_API_KEY`/`MINIMAX_API_KEY` at config.py:580-581.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<automated>` self-checks passed first try; the additive eval edits, the SSE helper, and the runbook each matched the planned interface verbatim.

## Issues Encountered
- A self-imposed AST cross-check of the runbook's referenced eval imports initially flagged `PROVIDERS` as "missing" — a false negative because `PROVIDERS` is an annotated assignment (`ast.AnnAssign`), which my first walker only matched on `ast.Assign`. Re-ran with `AnnAssign` handling: all runbook-referenced eval symbols (`load_env`, `assert_localhost_only`, `get_bearer_token`, `connect_db`, `create_thread`, `run_prompt`, `wait_for_run`, `PROVIDERS`, `DEFAULT_RUN_TIMEOUT_S`) confirmed present. No code change needed.

## Extraction-purity check (critical constraint)
- `git diff --name-only` across the 3 commits shows ONLY `scripts/` files (eval_cross_provider.py, capture_run_events.py, SSE_DIFF_RUNBOOK.md).
- **No agent-loop file touched** (threads.py / agent_loop.py): D-089-09 additive proof-harness work, D-089-09 extraction purity preserved.
- No file deletions across the plan (`--diff-filter=D` empty).

## Threat surface
- T-089-04 (info disclosure): the 2 new env-presence rows are `(NAME, is_secret=True)` — the UNCHANGED print loop emits `set`/`MISSING` only, never the value. No value-printing added.
- T-089-05 (localhost hard-gate): NOT touched — `assert_localhost_only()` and the `LOCALHOST_RE` gate are byte-identical.
- T-089-06 (SQL injection): no new queries added; `_COUNT_QUERIES` allowlist + parameterized thread_id unchanged.
- `capture_run_events.py` reads only the operator's own local run-buffer stream; `normalize()` masks volatile ids and never logs payload values. No new threat surface beyond the plan's register.

## User Setup Required
None - no external service configuration required by this plan. (Operator runs the SSE_DIFF_RUNBOOK procedure with live provider keys in their own `backend/.env` during Plan 03/04 — that is the documented operator step, not a setup task for this plan.)

## Next Phase Readiness
- **Plan 03 (verbatim move)** can capture the BEFORE baseline now (Wave 1, pre-move loop) via the runbook, then assert empty `diff_event_streams(before, after)` per native-7 provider AFTER the lift.
- **Plan 04 (CF-01 sweep)** has the `EVAL_SUMMARY` native-7 backstop procedure + the SSE-diff AFTER procedure ready.
- All downstream v2.8 phases (091-096) inherit the native-7 eval gate.
- No blockers.

## Self-Check: PASSED

All created files exist on disk (scripts/eval_cross_provider.py, scripts/capture_run_events.py, scripts/SSE_DIFF_RUNBOOK.md, 089-02-SUMMARY.md) and all 3 task commits exist in git history (a9d156b4, 3741603c, 2940a78f).

---
*Phase: 089-agent-loop-extraction-g-5-kickoff-uat*
*Completed: 2026-05-30*
