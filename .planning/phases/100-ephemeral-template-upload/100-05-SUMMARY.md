---
phase: 100-ephemeral-template-upload
plan: 05
subsystem: infra
tags: [asyncpg, lifespan-task, janitor-sweep, ttl, run-pin, greatest, workspace-files, ephemeral-template, run-honesty, g-5-hot-file, idempotent]

# Dependency graph
requires:
  - phase: 100-01
    provides: "the cross-plan TDD contract test_workspace_template.py — the test_sweep_deletes_rows_and_bytes / test_run_pin_extends_and_noop / test_expired_tool_read_errors stubs this plan flips green"
  - phase: 100-03
    provides: "get_storage_paths_for_file (file+ALL-version Storage path UNION — reused VERBATIM in the sweep), the gated read filter (the actual expiry guarantee — this sweep is pure GC), and read_file raising FileNotFoundError_('template expired') on is_expired (the D-10 seam Task 3 surfaces)"
provides:
  - "template_service.sweep_expired (D-07): in-process janitor — GC every expired template row + ALL its Storage version bytes; idempotent by construction (WORKER_COUNT=2 safe, no lock)"
  - "template_service.pin_templates_for_run (D-09): extend-only (GREATEST) kickoff run-pin so a run can't die mid-flight from template expiry; kind='template_input' WHERE so agent/NULL rows never matched (D-11)"
  - "template_service.run_cap_seconds: conservative whole-run wall-clock cap (sum-of-per-phase + margin) — there is no native whole-run cap"
  - "main.py _sweep_expired_templates lifespan task (~15 min cadence, best-effort) next to _resume_stranded"
  - "threads.py one thin delegating pin_templates_for_run call at the kickoff seam — zero inline logic (G-5 hot file honored)"
  - "D-10 run-honesty confirmed end-to-end: an expired-template agent read surfaces literal 'template expired' through the existing except WorkspaceError surface (no new branch, tool_dispatcher.py byte-identical)"
affects: [100-06-frontend-badge, ephemeral-template-upload, harness-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin-seam lifecycle service (template_service.py): all sweep/pin logic lives in the service; main.py + threads.py gain only delegating call-throughs — mirrors the 099 skill_snapshot.py / _ensure_skill_snapshots thin-seam shape so the G-5 hot file threads.py never grows inline query/Storage logic"
    - "Idempotent-by-construction janitor (no lock): SELECT only expires_at<=now() + DELETE-rowcount-skip a sibling-raced row + best-effort no-op Storage remove → WORKER_COUNT=2 workers each run their own sweep harmlessly (D-07)"
    - "Extend-only TTL pin via GREATEST(expires_at, now()+cap): the single exception to fixed-from-upload TTL (D-08), guaranteed never to shorten; kind='template_input' AND expires_at IS NOT NULL WHERE keeps agent/NULL rows byte-identical (D-11)"
    - "Storage-cleanup composition mirrored from workspace_service.delete_file: get_storage_paths_for_file (file+ALL versions) → DELETE row (CASCADE drops versions) → run_in_threadpool(storage.remove) best-effort per path"

key-files:
  created:
    - backend/app/services/template_service.py
    - .planning/phases/100-ephemeral-template-upload/100-05-SUMMARY.md
  modified:
    - backend/app/main.py
    - backend/app/api/threads.py
    - backend/tests/test_workspace_template.py

key-decisions:
  - "sweep_expired is the canonical name (plan must_haves / verify / acceptance greps); added sweep_expired_templates = sweep_expired alias because the Wave 0 TDD-contract test imports the longer name — both resolve to the same function (Rule 3 blocking reconciliation, no behavior change)"
  - "Used the already-in-scope module-level asyncio (asyncio.create_task / asyncio.sleep) in the lifespan rather than the plan's `import asyncio as _asyncio` — asyncio is already imported and used in this lifespan (asyncio.wait_for at :220), so the inner import was redundant; the 15*60 cadence grep still matches"
  - "Rephrased the threads.py pin comment to avoid the literal word GREATEST/UPDATE — the G-5 grep guard asserts those literals appear NOWHERE in threads.py (even in a comment), so the explanatory text says 'extend-only expiry write' instead"
  - "Task 3 changed NO production source: read_file already raises FileNotFoundError_('template expired') (Plan 03) and FileNotFoundError_ subclasses WorkspaceError, so the message flows through the existing `except WorkspaceError → ToolResult({'error': str(e)})` surface intact; Task 3 strengthened the test from a symbol-existence stub into a real GREEN drive of that path"

patterns-established:
  - "Lifecycle-plumbing thin seam: a NEW service owns ALL GC/pin logic; the lifespan + the G-5 hot-file kickoff seam are pure delegating call-throughs (the guarantee is the read filter from earlier plans, NOT the sweep)"
  - "Cross-plan TDD alias: when a Wave 0 stub imports a symbol under a longer name than the implementing plan's canonical export, alias the two so the contract resolves without renaming the plan-blessed export"

requirements-completed: [TMPL-01]  # the sweep+pin+D-10-wiring half of TMPL-01 lands here; the requirement marks complete at phase close (frontend badge 100-06 still pending)

# Metrics
duration: ~6min
completed: 2026-06-10
---

# Phase 100 Plan 05: Ephemeral Template Upload — Sweep Janitor + Kickoff Run-Pin + D-10 Wiring Summary

**The ephemeral-template LIFECYCLE plumbing: a new `template_service.py` owns the in-process ~15 min janitor sweep (D-07 — GC of expired rows + ALL their Storage version bytes, idempotent so WORKER_COUNT=2 is lock-free) and the kickoff run-pin (D-09 — extend-only via GREATEST so a run can't die mid-flight, no-op when templateless), wired into main.py's lifespan and threads.py's kickoff seam as THIN delegating call-throughs (G-5 hot file never grows inline logic); the D-10 'template expired' run-honesty already flows through the existing tool error surface with zero source change.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-10T11:51:25Z (plan start)
- **Completed:** 2026-06-10T11:56:58Z (last task verified)
- **Tasks:** 3 (Task 1 `auto` tdd, Task 2 `auto`, Task 3 `auto`)
- **Files modified:** 4 (198 insertions, 11 deletions)

## Accomplishments

- **Built `template_service.py` (Task 1) — the lifecycle home (G-5 honored):** `sweep_expired(pool, supabase)` SELECTs only `expires_at IS NOT NULL AND expires_at <= now()`, gathers ALL Storage paths via `get_storage_paths_for_file` (reused VERBATIM — file + every version), DELETEs the row (FK CASCADE drops versions), then `run_in_threadpool(storage.remove)` best-effort per path — idempotent by construction (a sibling-worker-deleted row isn't in the next SELECT; the DELETE-rowcount check skips a raced row; an already-removed object is a no-op remove), so WORKER_COUNT=2 is safe with NO lock. `pin_templates_for_run(pool, *, thread_id, run_wall_clock_cap)` is one `UPDATE ... SET expires_at = GREATEST(expires_at, now() + cap)` gated on `kind = 'template_input' AND expires_at IS NOT NULL` — extend-only (D-08 preserved), agent/NULL rows never matched (D-11), templateless thread → 0 rows → literal no-op. `run_cap_seconds(definition)` sums per-phase `wall_clock_seconds` (defensive getattr → the 3600 default for configs lacking the field) + a 600s margin (no native whole-run cap exists — Pitfall 4).
- **Wired the lifespan sweep + thin kickoff pin (Task 2):** `main.py` gained `_sweep_expired_templates()` next to `_resume_stranded()` — a `while True` best-effort loop (`logger.exception` + continue on error) on a `15 * 60` (~15 min) cadence, spawned via `asyncio.create_task(...)` before `yield`. `threads.py` gained ONE delegating call inside the existing `if _kickoff_definition is not None:` block (right after `_ensure_skill_snapshots`): `await _template_service.pin_templates_for_run(pool=..., thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id, run_wall_clock_cap=_template_service.run_cap_seconds(_kickoff_definition))`. The G-5 grep guard passes: NO `GREATEST` / `UPDATE workspace_files` literal anywhere in threads.py — all logic lives in template_service.
- **Confirmed D-10 run-honesty end-to-end (Task 3) with zero source change:** `FileNotFoundError_` subclasses `WorkspaceError`, and `read_file` (Plan 03) already raises `FileNotFoundError_("template expired")` on `is_expired`, so the literal message flows through the EXISTING `except WorkspaceError as e: return ToolResult(result=json.dumps({"error": str(e)}))` in `_handle_workspace_read` — NO new branch needed. Strengthened `test_expired_tool_read_errors` from a symbol-existence xfail stub into a real GREEN test that patches `ws_read_file` to raise the D-10 error and asserts the ToolResult JSON `error` equals the literal `"template expired"` (not a reshaped generic not-found). `tool_dispatcher.py` is byte-identical (git status empty).

## Task Commits

Each task was committed atomically (worktree, `--no-verify` per parallel-executor protocol):

1. **Task 1: Create template_service.py — sweep_expired + pin_templates_for_run + run_cap_seconds** — `c1708de1` (feat)
2. **Task 2: Wire lifespan sweep (main.py) + thin kickoff run-pin (threads.py)** — `da5ddeaf` (feat)
3. **Task 3: Assert D-10 'template expired' surfaces through the tool handler** — `9edcebde` (test)

_Task 1 is the TDD GREEN code for the pre-existing Wave 0 RED stubs (test_sweep_deletes_rows_and_bytes + test_run_pin_extends_and_noop, marked xfail(strict=False) in Plan 100-01); they flip from xfailed → xpassed. Task 3 is a `test(...)` commit because it changed no production source — only the contract test._

## Files Created/Modified

- `backend/app/services/template_service.py` (created, 125 lines) — `sweep_expired` (idempotent GC of rows + ALL Storage version bytes), `pin_templates_for_run` (GREATEST extend-only pin, kind='template_input' WHERE), `run_cap_seconds` (sum-of-per-phase + margin), and the `sweep_expired_templates = sweep_expired` TDD-contract alias.
- `backend/app/main.py` (modified, +21) — `_sweep_expired_templates()` lifespan task next to `_resume_stranded()`; ~15 min cadence; best-effort; idempotent so no lock; thin call-through to `template_service.sweep_expired` (service-role `get_supabase()` for Storage).
- `backend/app/api/threads.py` (modified, +13) — one thin delegating `pin_templates_for_run` call at the kickoff seam inside `if _kickoff_definition is not None:`, after `_ensure_skill_snapshots`. Zero inline query/Storage/GREATEST/UPDATE logic (G-5).
- `backend/tests/test_workspace_template.py` (modified, +39/−11) — `test_expired_tool_read_errors` strengthened from a symbol stub into a real GREEN D-10 drive (patches `ws_read_file` to raise `FileNotFoundError_("template expired")`, asserts the ToolResult JSON error is the literal message).

## Verification Results

- `pytest tests/test_workspace_template.py -q` (full contract file): **2 passed, 4 xfailed, 6 xpassed** — no hard failures/errors. The 2 passed = the SC#2 isolation guard + the new GREEN D-10 `test_expired_tool_read_errors`. The 6 xpassed include this plan's `sweep_deletes` + `run_pin` stubs (now resolving, `strict=False` tolerated). The 4 xfailed are the 100-02/04 stubs owned by other plans (migration smoke, validate_ooxml, REST gates) — correctly still RED, not this plan's deliverable.
- Task 1 slice `-k "sweep_deletes or run_pin"`: **2 xpassed** (flipped from `xx`/xfailed at baseline) + import smoke printed `template_service ok`.
- Task 2 slice `-k "run_pin"`: **1 xpassed**; `import app.main` + `import app.api.threads` clean (with the main-checkout `.env` loaded — the worktree shell otherwise lacks `supabase_url`/`supabase_service_role_key`, a documented pre-existing limitation, NOT this plan).
- Task 3 slice `-k "expired_tool_read"`: **1 passed** (real GREEN, the ToolResult JSON `error == "template expired"`).
- Acceptance greps (all matched):
  - `async def sweep_expired` ✓, `async def pin_templates_for_run` ✓, `GREATEST(expires_at` ✓, `kind = 'template_input'` ✓, `get_storage_paths_for_file` ✓, sweep SELECT `expires_at IS NOT NULL AND expires_at <= now()` ✓
  - `_sweep_expired_templates` in main.py ✓, `asyncio.create_task(_sweep_expired_templates` ✓, `15 * 60` cadence ✓, `pin_templates_for_run` in threads.py ✓
  - **G-5 guard:** `GREATEST` in threads.py → NONE ✓; `UPDATE workspace_files` in threads.py → NONE ✓
  - `except WorkspaceError` still present in tool_dispatcher.py (5 surfaces, intact) ✓
- Regression: `tests/unit/test_tool_dispatcher.py` → **15 passed**; `tests/test_harness_whitelist.py` → **8 passed** (the modules this plan touches/depends on stay green).
- Safety: no file deletions across the 3 commits; only the 4 expected files changed; Plan 100-04's files (`api/workspace.py`, `models/user_settings.py`) and STATE.md/ROADMAP.md untouched.

## Decisions Made

- **`sweep_expired_templates` alias.** The Wave 0 TDD contract (`test_sweep_deletes_rows_and_bytes`) imports `sweep_expired_templates`, while the plan's must_haves / verify command / acceptance greps use `sweep_expired`. Kept `sweep_expired` as the canonical export and added `sweep_expired_templates = sweep_expired` so the contract resolves to the same function — no behavior difference. (See Deviations — Rule 3.)
- **Used module-level `asyncio`** for `create_task`/`sleep` in the lifespan rather than the plan's redundant inner `import asyncio as _asyncio` — `asyncio` is already imported and used in this lifespan (`asyncio.wait_for` at :220); the `15 * 60` cadence grep still matches.
- **Rephrased the threads.py pin comment** to drop the literal words `GREATEST`/`UPDATE` so the G-5 grep guard (`grep GREATEST threads.py` MUST return nothing) passes even against comments — the explanatory text says "extend-only expiry write" instead. (See Deviations — Rule 1.)
- **Task 3 changed no production source.** The D-10 path was already complete after Plan 03 (`read_file` raises `FileNotFoundError_("template expired")`, which subclasses `WorkspaceError`, surfacing through the existing tool error path). The work was verifying it lands intact and pinning it with a real assertion — exactly as the plan anticipated ("NO new branch is required — verify it lands intact").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `sweep_expired_templates` alias for the Wave 0 TDD-contract import**
- **Found during:** Task 1
- **Issue:** The plan exports `sweep_expired`, but the Wave 0 contract test `test_sweep_deletes_rows_and_bytes` imports `from app.services.template_service import sweep_expired_templates`. Without the longer name the stub's import errors and the test stays RED — blocking the plan's own verify.
- **Fix:** Defined `sweep_expired_templates = sweep_expired` (a module-level alias). The canonical `sweep_expired` (plan must_haves / verify / acceptance greps) is unchanged; both names reference the identical function.
- **Files modified:** backend/app/services/template_service.py
- **Verification:** `test_sweep_deletes_rows_and_bytes` flips xfailed → xpassed; import smoke imports BOTH names cleanly.
- **Committed in:** `c1708de1` (Task 1 commit)

**2. [Rule 1 - Bug] Removed literal `GREATEST` from the threads.py pin comment to satisfy the G-5 grep guard**
- **Found during:** Task 2
- **Issue:** My first threads.py comment explained the pin as "the GREATEST extend-only UPDATE … lives in template_service". The G-5 acceptance criterion is a literal `grep -n "GREATEST" threads.py` returning NOTHING (and same for `UPDATE workspace_files`) — a comment mentioning the word fails the guard even though there is no inline logic.
- **Fix:** Rephrased the comment to "the extend-only expiry write + the cap formula" — no `GREATEST`/`UPDATE` literal anywhere in threads.py; the delegating call is unchanged.
- **Files modified:** backend/app/api/threads.py
- **Verification:** `grep GREATEST threads.py` → none; `grep "UPDATE workspace_files" threads.py` → none; `pin_templates_for_run` still present.
- **Committed in:** `da5ddeaf` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule-3 blocking alias, 1 Rule-1 G-5-guard comment fix)
**Impact on plan:** Both are mechanical reconciliations to the TDD-contract + the G-5 grep guard — no scope creep, no behavior change. The plan's behavioral intent and every acceptance grep are met exactly.

## Issues Encountered

- **Worktree shell lacks `supabase_url` / `supabase_service_role_key` env vars** for a bare standalone `import app.main` (Settings() validation fails at module load). This is the SAME pre-existing worktree-shell limitation documented in 100-03-SUMMARY (NOT caused by this plan) — confirmed by importing both modules cleanly once the main-checkout `backend/.env` is loaded (the way conftest provides them under the pytest harness, where every slice passes). No code impact.

## User Setup Required

None - no external service configuration required. (Migration 068 — the live `kind`/`expires_at` columns the sweep/pin read/write — was applied operator-side in Plan 100-02 via the Supabase SQL editor; no new migration here.)

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. All six registered threats are mitigated by this plan's code (no new network endpoint, auth path, or schema change — schema landed in 100-02):

- **T-100-05-01 (Elevation of Privilege — service-role sweep over-reaching):** `sweep_expired`'s SELECT/DELETE are scoped to `expires_at IS NOT NULL AND expires_at <= now()` ONLY; it never reads/returns user content (mirrors the harness_engine.py:1134 service-role precedent).
- **T-100-05-02 (DoS — unbounded Storage growth):** the sweep collects ALL version+file paths via `get_storage_paths_for_file` BEFORE the DELETE, then `storage.remove` each; best-effort + `logger.warning` on an individual failure; the next ~15 min sweep re-runs (Pitfall 3).
- **T-100-05-03 (DoS — run dies mid-flight):** `pin_templates_for_run` sizes to `run_cap_seconds` = sum-of-per-phase (default 3600) + 600s margin; `GREATEST` never shortens (D-08 preserved).
- **T-100-05-04 (Tampering — non-template files acquiring an expiry):** the pin WHERE requires `kind = 'template_input' AND expires_at IS NOT NULL` — agent/NULL rows are never matched (D-11).
- **T-100-05-05 (Spoofing — confabulation on expired read):** D-10 "template expired" surfaced through the existing `WorkspaceError → ToolResult` error path; the GREEN test pins the literal message reaches the model honestly.
- **T-100-05-06 (Tampering — threads.py G-5 hot-file growth):** the run-pin is a single delegating call; the grep guard confirms no inline `GREATEST`/`UPDATE workspace_files` in threads.py — all logic in template_service.

## Known Stubs

None introduced by this plan. This plan's two Wave 0 target stubs (`test_sweep_deletes_rows_and_bytes`, `test_run_pin_extends_and_noop`) now resolve (xpassed) and the D-10 stub is a real GREEN test. The 4 remaining `xfail` stubs in `test_workspace_template.py` (`test_existing_rows_valid`, `test_valid_ooxml_accepted`, `test_bad_file_rejected`, `test_oversized_rejected`) are owned by Plans 100-02/04 per the Wave 0 scaffold — NOT this plan's deliverable.

## Next Phase Readiness

- **Plan 100-06 (frontend Template badge + countdown)** is the only remaining behavior gate for TMPL-01; this plan's lifecycle backend (sweep GC + extend-only run-pin + D-10 honesty) is the last backend piece — the badge/countdown render against the `expires_at` the upload/pin already persist.
- **No blockers.** The sweep is idempotent + lock-free (WORKER_COUNT=2 safe); the pin is extend-only and no-ops on templateless threads (Deep-mode byte-identical); the D-10 error flows through the existing surface with `tool_dispatcher.py` untouched. The worktree main-venv interpreter + main-checkout `.env` load are the only environment notes for re-running the import-smoke inside this worktree.

## Self-Check: PASSED

- FOUND: backend/app/services/template_service.py
- FOUND: backend/app/main.py (modified)
- FOUND: backend/app/api/threads.py (modified)
- FOUND: backend/tests/test_workspace_template.py (modified)
- FOUND: .planning/phases/100-ephemeral-template-upload/100-05-SUMMARY.md
- FOUND commit: c1708de1 (Task 1)
- FOUND commit: da5ddeaf (Task 2)
- FOUND commit: 9edcebde (Task 3)

---
*Phase: 100-ephemeral-template-upload*
*Completed: 2026-06-10*
