---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 07
subsystem: testing
tags: [scripts, restart-smoke, concurrency, measurement, harness, psycopg2, backpressure, sweep-line]

# Dependency graph
requires:
  - phase: 096-01
    provides: eval_coverage 5-type seed workflow (migration 066) + eval_slow_step ~20s mid-programmatic kill window (programmatic.py)
  - phase: "088 (D-02)"
    provides: eval_cross_provider.py five-piece plumbing kit (load_env / assert_localhost_only / report_env_presence / get_bearer_token / connect_db / BackendUnavailable / create_thread / run_prompt / wait_for_run)
  - phase: "092-07"
    provides: resume_stranded_workflows + resume_pending_prompt (the machinery restart_smoke.py VERIFIES, never rebuilds)
  - phase: "078 (WORKER-LIFT-04)"
    provides: GET /admin/backpressure JSON shape (anyio_threadpool_depth borrowed/total, redis_active_runs, postgres_pool_in_use, per_worker_run_count)
provides:
  - scripts/restart_smoke.py — D-08 operator-driven restart smoke (3 kill points; the human IS the restart mechanism; robot owns seed + KILL banner + post-restart DB-truth assertions)
  - scripts/conc_probe.py — CONC-01/SC#3 N=10 fan-out overlap + cross-tab latency p95 + AnyIO budget probe
  - mid-ask_user smoke leg = BUG-260605-01 live fix verification (prompt re-emitted post-restart + answer POST completes the run)
affects: [096-08 verification capstone, 096-VALIDATION.md restart-smoke matrix, CONC-01 sizing decisions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Five-piece script plumbing kit copied verbatim per script (self-contained, no cross-script imports) — eval_cross_provider.py is the canonical source"
    - "Runtime phase-slug resolution from definition JSONB (never hardcoded slugs) — kill-at maps to phase_type, slug read at runtime"
    - "Sweep-line interval-overlap analysis over runs(started_at, completed_at) with ends-before-starts tie-break for semaphore release/acquire honesty"
    - "Greppable assertion markers: SMOKE_KILL/SMOKE_DOWN/SMOKE_UP/SMOKE_ASSERT/SMOKE_RESULT and PROBE_ASSERT/PROBE_BUDGET/PROBE_PEAKS/PROBE_RESULT"

key-files:
  created:
    - scripts/restart_smoke.py
    - scripts/conc_probe.py
  modified: []

key-decisions:
  - "prompt_reemitted gates on the post-restart /ask_user/pending serve (exercises the D-06 liveness filter) + the unanswered durable row; the minted resume-shell runs row (model/provider='unknown') is reported as informational detail, never gating"
  - "no_duplicate_subagents reads durable truth (batch phase output.sub_run_ids vs split output.sub_questions + distinctness) rather than counting thread-wide sub-runs — an llm_agent re-run legitimately orphans one partial sub-run (Pitfall 5) and must not fail the assertion"
  - "conc_probe latency sampler uses one requests.Session (keep-alive) per thread — comparable to a live app client, never a browser (6-connection cap conflation guard)"
  - "Down-watch also polls workflow status: a run reaching terminal before the kill lands is a 'kill window missed' diagnostic exit, not a hang"

patterns-established:
  - "Operator-measurement scripts assert against DB truth (workflow_phases / harness_audit / runs), never against transient SSE"
  - "INSERT-only harness_audit HAVING count(*)>1 as the canonical double-execution detector"

requirements-completed: [EVAL-02, CONC-01]

# Metrics
duration: 10min
completed: 2026-06-07
---

# Phase 096 Plan 07: Restart Smoke + Concurrency Probe Summary

**Two operator measurement scripts: restart_smoke.py (D-08 — seed/banner/DB-truth assertions around an operator-driven uvicorn kill at 3 honest kill points, with the mid-ask_user leg doubling as the BUG-260605-01 live verification) and conc_probe.py (N=10 fan-out proving Semaphore(5) live via sweep-line interval overlap, cross-tab GET p95 vs 50ms, and the AnyIO threadpool budget reading)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-07T02:48:39Z
- **Completed:** 2026-06-07T02:58:30Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `scripts/restart_smoke.py` (855 lines): one command per kill point (`--kill-at {programmatic|llm_agent|ask_user}`) seeds eval_coverage, resolves the target phase slug FROM THE DEFINITION JSONB at runtime (verified live against the local DB: programmatic→`split`, llm_agent→`deep_dive`, ask_user→`confirm`), prints the unmistakable `SMOKE_KILL` banner exactly when the target phase is active (ask_user additionally waits for the pending durable prompt row), detects the operator's kill/restart via GET /health (`SMOKE_DOWN`/`SMOKE_UP`), then asserts DB truth: `no_skipped_phases`, `single_completion_audit` (HAVING count>1 detector on INSERT-only harness_audit), `no_duplicate_subagents` (batch `sub_run_ids` == split `sub_questions`, distinct). The script NEVER touches the backend process — zero matches for process-control patterns (acceptance-grepped).
- The mid-ask_user leg: post-restart it FIRST asserts `prompt_reemitted` (the prompt is served again by `/threads/{tid}/ask_user/pending` — exercising the D-06 liveness filter — with the durable row still unanswered, plus the resume-shell runs row as supporting evidence), then POSTs the answer via `/runs/{workflow_run_id}/ask_user_response` (the F10 workflow_run-id fallback) and asserts `answer_reached_engine` (run completes). This IS the BUG-260605-01 live fix verification.
- `scripts/conc_probe.py` (742 lines): drives the `literature_review` seed with EXACTLY 10 semicolon-separated sub-topics (constant verified against the live clause-split regex: 10 branches), creates an IDLE second thread first, then runs two sampling loops — `/admin/backpressure` every ~1s (borrowed/total + redis_active_runs + postgres_pool_in_use + per_worker_run_count) and a separate `threading.Thread` timing BOTH `GET /threads/{idle}/snapshot` AND `GET /threads` every ~500ms (the dual-endpoint requirement: idle /snapshot short-circuits before Redis; the list endpoint exercises the supabase-py threadpool). Post-run: `fanout_bounded` (sweep-line max overlap ≤ 5 AND total == 10), `cross_tab_latency` (p50/p95/max per endpoint, PASS iff p95 < 50ms), `PROBE_BUDGET total=<n> peak_borrowed=<n>` (the SC#3 documented reading).
- Sweep-line + percentile helpers unit-verified with synthetic data (Semaphore(5)-shaped windows → 5; unbounded 10-overlap → 10; release/acquire at same instant → sequential; nearest-rank p50/p95).

## Task Commits

Each task was committed atomically:

1. **Task 1: scripts/restart_smoke.py — seed, kill-signal, post-restart DB-truth assertions** - `f8f43c6f` (feat)
2. **Task 2: scripts/conc_probe.py — N=10 fan-out overlap + latency + AnyIO budget** - `607b0c4e` (feat)

## Files Created/Modified

- `scripts/restart_smoke.py` - D-08 operator-driven restart smoke helper (3 kill points; `--kill-at` CLI; greppable SMOKE_* markers; localhost hard-gated; constant-string allowlisted SQL with %s params only)
- `scripts/conc_probe.py` - fan-out overlap + latency + backpressure probe (greppable PROBE_* markers; same localhost gate + SQL discipline)

## Verification Results

All plan acceptance criteria verified:

| Check | restart_smoke.py | conc_probe.py |
|---|---|---|
| py_compile + --help exit 0 | PASS | PASS |
| Greppable markers | 12 (>= 6) | 8 (>= 5) |
| assert_localhost_only FIRST in main() | line 712, before any DB/HTTP | line 587, before any DB/HTTP |
| "HAVING count" >= 1 | 3 | n/a |
| run_in_background / proc-control == 0 | 0 matches | n/a |
| anyio_threadpool_depth / per_worker_run_count >= 1 | n/a | 4 / 4 |
| Kickoff constant ";" count == 9 (10 clauses) | n/a | 9 semicolons; live-regex split = 10 clauses |
| Both probe endpoints (snapshot + list) | n/a | 6 matches |
| Files in scripts/, not backend/ | PASS | PASS |

Live-DB cross-checks (read-only, localhost:54322): `eval_coverage` v1 published/global with 5 phases and `eval_slow_step` at phase 0; `literature_review` v1 published with split_topic `input_keys: ["topic","kickoff_prompt"]` (migration 065 fix confirmed live); runtime slug resolution returns split/deep_dive/confirm for the 3 kill points.

The 3 live kill-point runs and the live N=10 probe run are OPERATOR-DRIVEN at phase verification per 096-VALIDATION.md (the backend was not running during execution, by design — the human is the restart mechanism).

## Decisions Made

- `prompt_reemitted` gates on the post-restart `/ask_user/pending` serve + unanswered durable row; the resume-shell runs row (model/provider='unknown') is informational only — engine-internal placeholder values should not gate an operator smoke.
- `no_duplicate_subagents` reads the durable batch-phase output (`sub_run_ids` vs `sub_questions`, distinctness) instead of counting thread-wide sub-agent runs, because an `llm_agent` phase re-run legitimately orphans one partial sub-run on resume (Pitfall 5) and must not produce a false FAIL.
- Down-watch polls workflow status alongside /health so a "kill window missed" (run finished before the operator killed) exits with a clear diagnostic instead of waiting 10 minutes.
- conc_probe's latency sampler uses a `requests.Session` (keep-alive) — representative of a live app client; browser-based measurement explicitly rejected in code comments (6-connection-cap conflation).

## Deviations from Plan

None - plan executed exactly as written. (Procedural note: the worktree was created from a stale base and was hard-reset to the prescribed Wave-1 base commit `bbe5bbf2` before any work, per the worktree branch check protocol.)

## Issues Encountered

- The worktree has no `backend/venv` and no `backend/.env` (both gitignored) — verification used the main repo's venv interpreter against the worktree's script files; the missing-.env path doubled as a live demonstration of the script's clean no-traceback exit ("ERROR: backend/.env not found at ...", exit 1).

## Known Stubs

None — both scripts are complete, self-contained operator tools with no placeholder values or unwired data paths. The only intentionally-deferred work is the live measurement runs themselves, which are operator-driven by design (D-08) and authored in 096-VALIDATION.md.

## User Setup Required

None - no external service configuration required. (Live runs need the operator's usual local stack: Supabase up, Redis up, backend uvicorn in a visible terminal.)

## Next Phase Readiness

- D-08 deliverable complete: each kill point is one command with robot-owned setup + assertions; mid-programmatic is REAL (eval_slow_step's 20s window, verified live in the seeded definition).
- SC#3 measurable in one command: fan-out bound, latency p95, AnyIO budget — all greppable.
- The mid-ask_user leg is ready to serve as BUG-260605-01's live verification (Plans 03+04 shipped in Wave 1 and are on this base).
- Operator runbook for verification: start uvicorn, run `scripts/restart_smoke.py --kill-at <point>` per the VALIDATION.md restart-smoke matrix, and `scripts/conc_probe.py` once for the N=10 probe.

---
*Phase: 096-eval-harness-cross-provider-verification-concurrency*
*Completed: 2026-06-07*

## Self-Check: PASSED

- scripts/restart_smoke.py: FOUND
- scripts/conc_probe.py: FOUND
- Task commits f8f43c6f + 607b0c4e: FOUND
- All acceptance-criteria greps + py_compile + --help: PASS (logged above)
