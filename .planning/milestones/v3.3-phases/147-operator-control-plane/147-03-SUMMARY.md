---
phase: 147-operator-control-plane
plan: 03
subsystem: api
tags: [fastapi, operator, run-cancel, zombie-heal, feature-flags, app_settings, audit-log]

# Dependency graph
requires:
  - phase: 147-01
    provides: "mig 097 app_settings kill-switch columns + fail-closed flag helpers + _DIRECT_COLUMNS allowlist"
  - phase: 147-02
    provides: "operator /admin/runs read surface (kind derivation, killable, not_responding) + operator_audit_floor seam"
  - phase: 145-02
    provides: "run_lifecycle.finalize_run_terminal atomic terminal co-writer (D-145-14)"
  - phase: 062
    provides: "cancel_run zombie-heal discipline (idempotent-terminal 204, PUBLISH-first sentinel, SETNX cancel-lock, EXPIRE)"
provides:
  - "run_lifecycle._cancel_run_internals — one shared cancel/zombie-heal helper reused by cancel_run AND the operator Kill (D-02, refactor-to-share)"
  - "POST /admin/runs/{id}/kill — operator cancel of ANY user's chat/workflow run with NO ownership filter, 404-non-discoverable, 409 for eval/tuner (D-01)"
  - "PUT /admin/flags — validated flag write on the code-constant allowlist through save_app_settings (FLAG-01)"
affects: [147-04, 147-05, 147-06, operator-control-plane-frontend, ActiveRunsSection, CapabilityGrid, MaintenancePanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refactor-to-share: extract the owner-path internals into a service helper the privileged path reuses WITHOUT the ownership filter (the missing .eq is the ENTIRE difference)"
    - "Outcome discriminator: the shared helper returns terminal_noop / task_cancelled / zombie_healed so callers pick the audit verb (064-B honesty)"
    - "Code-constant key allowlist before a dynamic-column write (T-147-01): validate against a frozen set, never let a client name a SQL column"

key-files:
  created:
    - "backend/tests/test_062_cancel_run.py"
    - "backend/tests/test_147_operator_kill.py"
  modified:
    - "backend/app/services/run_lifecycle.py"
    - "backend/app/api/runs.py"
    - "backend/app/api/admin.py"

key-decisions:
  - "Operator kill reads via the asyncpg pool (parity with 147-02 /admin/runs + the gate), delegating the cancel to the shared helper; supabase is passed only for the zombie anchor-clear"
  - "Eval refusal derived from eval_runs.id == run_id (D-Q1); a tuner run has no runs row so it 404s (non-discoverable) rather than 409"
  - "Repointed _emit_terminal to its true source app.api.threads so run_lifecycle no longer depends on the runs.py re-export"

patterns-established:
  - "Shared cancel discipline in run_lifecycle._cancel_run_internals — future kill/cancel surfaces call it, never copy-paste the D-062 subtleties"
  - "Operator write endpoints set request.state.audit_label/audit_action on the success path; the floor writes one row on teardown"

requirements-completed: [ADMIN-02, FLAG-01]

# Metrics
duration: 40min
completed: 2026-07-11
---

# Phase 147 Plan 03: Operator Kill + Flag Write Summary

**Factored the `cancel_run` zombie-heal internals into one shared `run_lifecycle._cancel_run_internals` helper and built the operator `POST /admin/runs/{id}/kill` (any user's run, no ownership filter, victim-named ledger, self-cancel for the victim) plus `PUT /admin/flags` on the code-constant allowlist — all on the sole-authority `/admin` router.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-11T08:52:00Z
- **Completed:** 2026-07-11T09:32:19Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5 (3 source, 2 test)

## Accomplishments
- Extracted Steps 2/3a/3b of `cancel_run` into `run_lifecycle._cancel_run_internals` — the idempotent-terminal 204, PUBLISH-first ask_user sentinel + `task.cancel()`, and `finalize_run_terminal` + SETNX cancel-lock + EXPIRE zombie heal now live in ONE home. `cancel_run` keeps Step 1's ownership SELECT (`.eq(user_id)`) and delegates — byte-equivalent for owners, still 404s cross-user.
- Built `POST /admin/runs/{id}/kill`: operator-scoped SELECT with NO ownership filter (the D-02 difference), 404-non-discoverable on a missing run, 409 refusal for eval/tuner internal jobs (D-01), delegates to the shared helper, and names the victim + model in the ledger (`run.kill`) — while a zombie-heal outcome reads "Recovered a stuck run" not "killed" (064-B). No operator attribution reaches the victim's run finalize (D-03).
- Built `PUT /admin/flags`: validates `key` against the five-name code-constant allowlist (unknown → 422, never a write — T-147-01), writes via `save_app_settings` (parameterized UPDATE + TTL-cache invalidation), and records `flag.<key>.<on|off>` (or `maintenance.set` for maintenance mode).
- 13 new tests green (4 shared-helper regression backstop + 9 kill/flag), full 146/147 admin + cancel regression 54/54.

## Task Commits

Each task followed the TDD RED → GREEN cycle:

1. **Task 1 (RED): shared-helper regression backstop** — `1f2f813b` (test)
2. **Task 1 (GREEN): extract shared cancel/zombie-heal helper** — `6d2a4eee` (refactor)
3. **Task 2 (RED): operator Kill + flag-write suite** — `0c846104` (test)
4. **Task 2 (GREEN): kill + PUT /admin/flags endpoints** — `93c6c700` (feat)

## Files Created/Modified
- `backend/app/services/run_lifecycle.py` — added `_cancel_run_internals` shared helper (Steps 2/3a/3b, returns the sub-path outcome discriminator; performs NO ownership check)
- `backend/app/api/runs.py` — `cancel_run` now keeps Step 1 and delegates to the shared helper; dropped now-dead `_emit_terminal` / `datetime` / `timezone` imports
- `backend/app/api/admin.py` — `POST /admin/runs/{id}/kill` + `PUT /admin/flags` + `_FLAG_HUMAN_NAMES`/`_FLAG_KEYS` allowlist
- `backend/tests/test_062_cancel_run.py` — NEW: shared-helper discipline regression backstop (correct data-layer mocks)
- `backend/tests/test_147_operator_kill.py` — NEW: 9-case kill + flag-write suite

## Decisions Made
- **Data layer for the kill reads:** used the asyncpg pool for the operator SELECT + eval detection + victim email (parity with 147-02's `/admin/runs` and the operator gate), passing supabase to the shared helper only for the zombie-path anchor-clear. This keeps the endpoint's reads on one layer and the test mocks aligned with the data-access layer (MEMORY lesson).
- **Eval refusal vs tuner:** an eval companion run is detected via `eval_runs.id == run_id` → 409; a tuner run has no `runs` row so the operator SELECT 404s it (non-discoverable), which is the correct D-01 outcome.
- **`_emit_terminal` source:** repointed the helper's late import to `app.api.threads` (its true definition) so `run_lifecycle` no longer relies on the `runs.py` re-export, letting `runs.py` drop the now-dead import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repointed `_emit_terminal` import + removed dead imports**
- **Found during:** Task 1 (extract shared helper)
- **Issue:** After moving the zombie-heal into `run_lifecycle`, `runs.py`'s `_emit_terminal` import became a dead re-export the helper depended on, and the top-level `datetime`/`timezone` imports became unused.
- **Fix:** Late-import `_emit_terminal` from `app.api.threads` (true source) inside the helper; removed the dead `_emit_terminal`, `datetime`, `timezone` imports from `runs.py`.
- **Files modified:** `backend/app/services/run_lifecycle.py`, `backend/app/api/runs.py`
- **Verification:** Both modules import cleanly; 062 cancel regression + 146/147 admin suites 54/54 green.
- **Committed in:** `6d2a4eee` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/cleanup, directly caused by the extraction)
**Impact on plan:** Necessary consequence of the refactor. No scope creep.

## Issues Encountered
- **Pre-existing integration-test rot (out of scope, logged to `deferred-items.md`):** `test_062_delete_zombie.py` and `test_062_delete_happy.py` fail at BASELINE — the former asserts the zombie-heal terminal write on the stale supabase `runs.update` mock (the 145-03 co-write moved it to the asyncpg pool), the latter hits a real-Postgres FK violation because it inserts a `runs` row without seeding the parent `threads`. Both predate and are unrelated to this plan's byte-equivalent refactor. The NEW `test_062_cancel_run.py` asserts the SAME cancel/zombie contract against the CORRECT data layer. `test_062_cross_user_404.py` (Step 1 ownership) and `test_062_delete_terminal_idempotent.py` (Step 2) both stay green after the refactor.

## User Setup Required
None — no external service configuration required. (mig 097 was applied in 147-01.)

## Next Phase Readiness
- The operator Kill + flag-write write-seams are live behind the `require_operator` router gate — 147's frontend plans (ActiveRunsSection Kill, CapabilityGrid, MaintenancePanel) can wire `killRun(runId)` / `setFlag(key, value)` against them.
- The maintenance middleware write-block (D-06) still reads `maintenance_mode` via the same `save_app_settings`-written flag; that middleware + the two D-04 capability gates are separate downstream plans.

## Threat Flags
None — no new security surface beyond the plan's `<threat_model>` (kill is behind the sole-authority router; the flag write is on the code-constant allowlist; zero new dependencies).

## Self-Check: PASSED

- All created/modified files verified on disk (`test_062_cancel_run.py`, `test_147_operator_kill.py`, `run_lifecycle.py`, `admin.py`, `147-03-SUMMARY.md`).
- All four task commits verified in git log (`1f2f813b`, `6d2a4eee`, `0c846104`, `93c6c700`).
- Plan verification `pytest tests/test_062_cancel_run.py tests/test_147_operator_kill.py -x` → 13 passed.

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
