---
phase: 120-collision-fix-context-isolation
plan: 01
subsystem: infra
tags: [sandbox, docker, sha256, harvest, dedup, run-scope, tdd]

# Dependency graph
requires:
  - phase: 075.4 (cross-provider cleanup)
    provides: "harvest_output_files SHA-256 content-hash dedup (previous_files baseline) — COLL-01 seeds it instead of replacing it"
provides:
  - "snapshot_output_baseline(session) helper — SHA-256-snapshots every pre-existing /sandbox/output/ file into the {hash: meta} previous_files shape"
  - "Lazy, once-per-run baseline seed in _handle_execute_code covering BOTH Deep and Harness (shared handler)"
  - "Headline live-repro collision regression suite (test_120_collision_regression.py)"
affects: [120-02 (CTX-01 origin isolation), 130 (COLL-02 template_input resolver run-scope), 131 (SRH-01 non-Python skill-script honesty)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-scope a harvest by SEEDING its existing hash-dedup baseline at run start (never a new filename comparison)"
    - "Lazy per-run seed guarded by a ctx sentinel attribute (per-RUN not per-cell), wrapped in run_in_threadpool (D-v2.5-01)"

key-files:
  created:
    - backend/tests/unit/test_120_collision_regression.py
  modified:
    - backend/app/services/sandbox_service.py
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "Option 2 (lazy seed in execute_code handler) — keeps G-5 hot file agent_loop.py untouched; agent_loop.py does not import sandbox_manager and the session already exists at tool_dispatcher.py:868"
  - "Seed reuses the existing SHA-256 hash-dedup (if h in previous_files: continue) — no new filename heuristic (explicitly disproven by COLL-03-EVIDENCE.md §Refinement 1)"
  - "D-120-02 honored: snapshot never clears/deletes /sandbox/output/ — it only stops RE-EMITTING pre-existing files; helper is fully try/except-wrapped (empty/failure → {} = legacy behavior)"

patterns-established:
  - "snapshot_output_baseline mirrors the harvest_output_files container-I/O idiom verbatim (mkdir -p + copy_from_runtime + os.walk + sha256) so a seeded entry collides on the hash key"
  - "ctx._output_baseline_seeded sentinel: per-RUN seed-once guard on the dataclass instance (set True after first harvest of a run)"

requirements-completed: [COLL-01]

# Metrics
duration: 4min
completed: 2026-06-21
---

# Phase 120 Plan 01: Collision Fix — Run-Scoped Sandbox Harvest Summary

**Run-scoped the sandbox-output harvest by seeding the existing SHA-256 dedup baseline at run start with `snapshot_output_baseline`, so a Deep/Harness run emits ONLY the files it created — closing the confirmed live 2-files collision (Mechanism A) where a prior workflow's leftover `.docx` re-emitted alongside a skill's real output.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-21T21:51:19Z
- **Completed:** 2026-06-21T21:54:54Z
- **Tasks:** 2 (TDD: RED test → GREEN implementation)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `snapshot_output_baseline(session)` helper in `sandbox_service.py` — SHA-256-hashes every pre-existing `/sandbox/output/` file into the `{content_hash: meta}` shape `harvest_output_files` consumes as `previous_files`; `iteration: -1` marks pre-run; fully try/except-wrapped so an empty dir / copy failure returns `{}` (never blocks the run, never deletes files).
- Lazy, once-per-run baseline seed in `_handle_execute_code` (`tool_dispatcher.py`) — runs `await run_in_threadpool(snapshot_output_baseline, session)` on the FIRST harvest of a run, guarded by `ctx._output_baseline_seeded`; one seed site covers BOTH Deep and Harness because they share the `execute_code` handler. The per-cell `_previous_files_in_run.update(_iter_files)` accumulation is unchanged.
- Headline live-repro regression suite (`test_120_collision_regression.py`, 4 tests) reproducing the TRUE live signature (one execution_id emitting more files than the code wrote, byte sizes 37328 / 11545 from the thread-`99af24d5` evidence anchor) — RED before the fix (ImportError), GREEN after.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Wave 0 headline regression test (RED)** — `d1e90d61` (test)
2. **Task 2: snapshot_output_baseline helper + lazy per-run seed (GREEN)** — `a56ad2ea` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `backend/tests/unit/test_120_collision_regression.py` — 4 regression tests: headline stale-leftover-excluded (SC#1), empty-baseline-emits-both fails-before-fix guard, snapshot-seeds-existing-files + empty-dir → {} (SC#2), Harness-phase-keeps-own-output (D-120-03 symmetry).
- `backend/app/services/sandbox_service.py` — added `snapshot_output_baseline(session)` immediately after `harvest_output_files`; reuses already-imported `hashlib`/`os`/`tempfile`.
- `backend/app/services/tool_dispatcher.py` — added `snapshot_output_baseline` to the `:34` import; lazy once-per-run seed in `_handle_execute_code` after `session = sandbox_manager.get_or_create(...)`.

## Decisions Made

- **Option 2 (lazy seed) locked over Option 1 (eager seed in `agent_loop.py`):** smaller blast radius, keeps the G-5 hot file `agent_loop.py` untouched, avoids forcing container creation for runs that never call `execute_code`. The session already exists at `tool_dispatcher.py:868`, and the same handler serves Deep + Harness.
- **Seed reuses the existing hash-dedup, no new comparison:** the `if h in previous_files: continue` branch already excludes seeded hashes; a filename-based heuristic was explicitly rejected by the live evidence.
- **D-120-02 honored:** no `/sandbox/output/` clear was added — the fix only stops re-emitting pre-existing files.
- **Seed guard via `ctx._output_baseline_seeded` dynamic attribute:** `ToolContext` is a plain `@dataclass` (no `slots=True`), so the sentinel attribute is settable; `getattr(ctx, "_output_baseline_seeded", False)` defaults safely to un-seeded.

## Deviations from Plan

None — plan executed exactly as written (Option 2 was the LOCKED decision; both tasks landed per spec).

## Issues Encountered

- **3 pre-existing failures in `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles`** surfaced during the regression-guard run (`test_harvest_files_uploads_and_inserts`, `_empty_output`, `_storage_path_format`). Confirmed PRE-EXISTING by stashing all Plan 01 changes and re-running — they fail identically on the base, so they are NOT caused by the COLL-01 seed. They assert the OLD filename-keyed `current_files_set == {"output.csv"}` return shape, obsolete since the Phase 075.4 D-075.4-D1 hash-keyed signature pivot. Logged out-of-scope to `.planning/phases/120-collision-fix-context-isolation/deferred-items.md` per the SCOPE BOUNDARY rule (not fixed). The directly-relevant shared dedup suite `test_075_4_dedup_supersedes.py` is 6/6 green and the new Plan 01 suite is 4/4 green.

## User Setup Required

None — no external service configuration required. No schema change, no package install (stdlib `hashlib`/`os`/`tempfile` + existing pinned stack only).

## Next Phase Readiness

- COLL-01 closed at the harvest baseline. The run-scoped seed is live for both Deep and Harness via the shared `execute_code` handler.
- Plan 02 (CTX-01 origin isolation) is independent of this plan's seam (it touches `agent_loop.py` history reconstruction + migration 076 `messages.origin`).
- Phase 130 (COLL-02, `template_input` resolver run-scope) and Phase 131 (SRH-01) build off this COLL-01 seam.
- No blockers.

## Threat Flags

None — no security surface introduced beyond the declared threat register. The snapshot reads the SAME per-thread `sandbox_manager.get_or_create(ctx.thread_id)` session the run already uses (no new cross-thread/cross-user attack surface; T-120-01 mitigated).

## Self-Check: PASSED

- Created/modified files all exist on disk (test_120_collision_regression.py, sandbox_service.py, tool_dispatcher.py, 120-01-SUMMARY.md, deferred-items.md).
- Task commits exist in git history: `d1e90d61` (test RED), `a56ad2ea` (feat GREEN).
- Regression suite: `test_120_collision_regression.py` 4/4 GREEN; `test_075_4_dedup_supersedes.py` 6/6 GREEN.

---
*Phase: 120-collision-fix-context-isolation*
*Completed: 2026-06-21*
