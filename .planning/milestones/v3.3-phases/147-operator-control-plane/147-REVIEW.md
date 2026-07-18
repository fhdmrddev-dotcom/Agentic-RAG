---
phase: 147-operator-control-plane
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/runs.py
  - backend/app/api/settings.py
  - backend/app/api/threads.py
  - backend/app/main.py
  - backend/app/middleware/__init__.py
  - backend/app/middleware/maintenance.py
  - backend/app/models/user_settings.py
  - backend/app/services/health_probe.py
  - backend/app/services/openai_service.py
  - backend/app/services/run_lifecycle.py
  - backend/app/services/skill_proposer_service.py
  - backend/app/services/tool_dispatcher.py
  - supabase/migrations/097_operator_flags.sql
  - frontend/src/App.tsx
  - frontend/src/components/admin/ActiveRunsSection.tsx
  - frontend/src/components/admin/CapabilityGrid.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/HealthSignals.tsx
  - frontend/src/components/admin/MaintenancePanel.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/lib/api.ts
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 147: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 147 (FLAG-01 + ADMIN-02) wires the operator Control Plane: fail-closed capability
kill-switches, a maintenance/read-only write-block middleware, operator Kill, and the
per-feature flag write path. I focused adversarially on the phase's stated
security-critical properties and verified most of them hold:

- **REFUSE seam is provider-uniform.** `dispatch_tool` (`tool_dispatcher.py:3307`) is the
  single tool-execution seam for ALL providers — `agent_loop.py:2465`/`:1662` and the
  sub-agent path `task_service.py:753` all route through it, and the refusal is a plain
  provider-agnostic `ToolResult` string. No `provider ==` branch. The second self-improve
  entry (the eval→instruction proposer) is separately gated in
  `skill_proposer_service.propose`. No provider-specific bypass found.
- **D-Q4 polarity is correct.** Capability flags cold-read `True`, `maintenance_mode`
  cold-reads `False`; `load_app_settings()` returns last-known-good stale cache on a DB
  blip (never resets on read failure), and the belt-and-braces `except` fallbacks match
  the migration defaults.
- **Maintenance middleware** is pure-ASGI (never touches SSE GETs), reads an in-memory
  TTL flag (no event-loop block), and allowlists `/admin/*` + `/auth/*` + `DELETE /runs/`
  so the off-switch is never a one-way trap. Segment-boundary match guards `/administrate`.
- **PUT /admin/flags** validates `key` against the `_FLAG_KEYS` code-constant allowlist
  (422 on unknown) BEFORE `save_app_settings` — no SQLi via column name. `value` is a
  strict Pydantic bool.
- **Operator Kill** is 404-non-discoverable on missing, 409 on eval, and delegates to the
  shared `_cancel_run_internals` (owner-cancel semantics preserved: idempotent-204,
  PUBLISH-first, zombie-heal).
- All `/admin` routes inherit `require_operator` at the router level.

However, two BLOCKER-class defects were found: a duplicate `ActiveRun` interface that
breaks the frontend type-check build, and a silent-failure hole in the flag write path
that reports success (and writes a FALSE audit row) when the DB write fails — both land
squarely on the phase's own goals (a working control plane + honest audit ledger).

## Critical Issues

### CR-01: Duplicate `ActiveRun` interface collides — frontend build (`tsc -b`) fails

**File:** `frontend/src/lib/api.ts:231` and `frontend/src/lib/api.ts:3614`
**Issue:** Two module-level `export interface ActiveRun` declarations exist in the SAME
file. TypeScript declaration-merges same-named interfaces, and the two declare
`started_at` with **conflicting types** — `started_at: string` (line 233, the Phase 062
streaming mirror) vs `started_at: number` (line 3622, the new Phase 147 admin shape).
Conflicting member types on a merged interface is compile error **TS2717**
("Subsequent property declarations must have the same type").

The frontend build script is `"build": "tsc -b && vite build"` (package.json), so
`npm run build` / CI type-check **fails hard**. (It survives `vite dev`/`vite build`
alone because esbuild strips types without checking — which is likely why it slipped
through.) Beyond the compile break, the merge corrupts the contract for BOTH consumers:
`getActiveRuns` (line 907) + `ThreadSnapshot.active_runs` (line 246) now nominally carry
the admin-only `kind`/`killable`/`not_responding`/`user_email` members at the type level
while the runtime `/threads/{tid}/active-runs` payload has none of them — a latent
type-safety hole (e.g. `active_run.kind` type-checks as `"chat"|...` but is `undefined`
at runtime). `ActiveRunsSection.tsx:139` also passes the merged `run.started_at` into
`elapsedSecondsSince(startedAt: number)`, which now errors on the merged type.

**Fix:** Rename the new Phase 147 admin interface (it is imported by the admin components
as `ActiveRun`) — e.g. `AdminActiveRun` — and update its consumers (`getAdminActiveRuns`,
`ActiveRunsSection`, `ControlRoomPage`, `CapabilityGrid` comment, the test) plus the
`FlagKey`/admin block. The Phase 062 `ActiveRun` at line 231 must stay as-is for the
streaming path.
```ts
// api.ts ~3614 — rename to avoid the collision with the Phase 062 ActiveRun (line 231)
export interface AdminActiveRun {
  run_id: string
  kind: "chat" | "workflow" | "eval" | "tuner"
  thread_id: string | null
  user_id: string | null
  user_email: string | null
  model: string | null
  provider: string | null
  started_at: number
  killable: boolean
  not_responding: boolean
}
export async function getAdminActiveRuns(): Promise<AdminActiveRun[]> { /* ... */ }
// ActiveRunsSection.tsx / ControlRoomPage.tsx: import { type AdminActiveRun as ActiveRun }
```

### CR-02: PUT /admin/flags reports success + writes a FALSE audit row when the DB write silently fails

**File:** `backend/app/api/admin.py:449` (calls `save_app_settings`), root cause
`backend/app/models/user_settings.py:289-302`
**Issue:** `set_flag` does `await save_app_settings({body.key: body.value})`, then
unconditionally sets `request.state.audit_label`/`audit_action` and returns 204. But
`save_app_settings` **swallows every exception** on the `pool.execute` UPDATE — it only
`logger.warning(...)` and returns `None`, never raising and never signalling failure:
```python
    except Exception:
        logger.warning("save_app_settings: DB write failed; settings not persisted", exc_info=True)
```
So when the DB write fails (pool exhausted, transient Postgres blip, connection reset),
`set_flag` cannot detect it: it returns **204 success**, and the `operator_audit_floor`
teardown (`dependencies.py:247`, `is_write` defaults to `True` for PUT) writes a
**"Turned ON maintenance mode" / "Turned OFF web search for everyone"** ledger row for an
action that **did not persist**. This is the whole point of the phase inverted:

- An operator flips a kill-switch in an emergency (disable code sandbox / self-improve),
  sees a success confirmation, but the capability **stays ON** (last-known-good cache is
  never invalidated because `invalidate_settings_cache()` is inside the swallowed try).
- The maintenance ON/OFF toggle can silently no-op while the operator believes the
  platform is (or is no longer) frozen.
- The audit ledger — explicitly designed for honesty (064-B "recovered vs killed")  —
  records a lie.

**Fix:** Make the write path signal failure and surface it BEFORE the audit label is set,
so a failed flip 500s (and writes no false receipt):
```python
# user_settings.py — let save_app_settings report success/failure
async def save_app_settings(updates: dict[str, Any]) -> bool:
    ...
    try:
        await pool.execute(...)
        invalidate_settings_cache()
        return True
    except Exception:
        logger.warning("save_app_settings: DB write failed; settings not persisted", exc_info=True)
        return False

# admin.py set_flag — 500 on a failed write, BEFORE setting audit_label
    if not await save_app_settings({body.key: body.value}):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not persist the flag — it was not changed.",
        )
    # only now set request.state.audit_label / audit_action ...
```
(`update_settings` in `settings.py` shares the same swallow; consider the same treatment
so a settings save failure isn't reported as success there either.)

## Warnings

### WR-01: Operator Kill of an already-terminal run records "Ended {victim}'s run" — a kill that never happened

**File:** `backend/app/api/admin.py:409-415`
**Issue:** `_cancel_run_internals` returns `"terminal_noop"` when the run is already
terminal (`completed`/`failed`/`cancelled`/`timed_out`) — NO cancel occurred (D-062-09
idempotent). But `kill_run` only special-cases `"zombie_healed"`; every other outcome,
including `"terminal_noop"`, falls into the `else` branch and records
`audit_label = f"Ended {victim}'s run on {model}"`. So killing a run that finished
naturally in the race window between the list poll and the click writes a ledger row
claiming the operator ended a live run. On a control plane whose audit honesty is a
first-class design goal (the code goes out of its way to say "Recovered a stuck run"
instead of "killed"), recording a phantom "Ended …" is an integrity gap.
**Fix:** Distinguish the no-op outcome:
```python
    if outcome == "zombie_healed":
        request.state.audit_label = f"Recovered a stuck run on {model}"
    elif outcome == "terminal_noop":
        request.state.audit_label = f"{victim}'s run on {model} had already ended"
    else:
        request.state.audit_label = f"Ended {victim}'s run on {model}"
    request.state.audit_action = "run.kill"
```

### WR-02: Maintenance mode strands paused/interactive in-flight runs — `ask_user_response` and `continue` are blocked (503), losing the user's answer

**File:** `backend/app/middleware/maintenance.py:64-77`
**Issue:** The allowlist passes reads, `/auth/*`, all `/admin/*`, and `DELETE /runs/{id}`
(self-cancel), but NOT `POST /runs/{id}/ask_user_response` or `POST /runs/{id}/continue`.
When maintenance is ON, a run paused on an `ask_user` prompt can no longer be answered —
the answer POST (which is the **durable persistence** of the user's reply, `runs.py:494`)
gets a 503, so the typed answer is lost, and a `cap_paused` run cannot be Continued. The
only forward action available for an in-flight interactive run is Cancel. This may be the
intended "nothing new runs" reading, but it silently freezes existing interactive work in
a way an operator flipping maintenance is unlikely to anticipate, and it diverges from the
in-flight-runs-untouched posture the workflows kill-switch (D-05) follows.
**Fix:** Decide explicitly. If resuming an EXISTING run is meant to be allowed under
read-only, allowlist those two "resume-existing-run" POSTs; if the freeze is intended,
document it in the middleware docstring so it is a deliberate contract, not an accident of
which paths were listed:
```python
    # resume-an-existing-run POSTs stay reachable so a paused run isn't stranded
    if method == "POST" and path.startswith("/runs/") and (
        path.endswith("/ask_user_response") or path.endswith("/continue")
    ):
        return True
```

## Info

### IN-01: `probe_supabase` selects `*` (incl. secret api-key columns) just to measure reachability

**File:** `backend/app/services/health_probe.py:70`
**Issue:** The reachability probe runs `.table("app_settings").select("*").limit(1)`,
pulling every column of `app_settings` — including the encrypted/provider api-key columns
— on every ~10s Control Plane poll, only to discard the rows and report latency. The data
isn't logged or returned, so there's no leak today, but selecting all secret columns for a
liveness ping is needless exposure surface.
**Fix:** Select a single cheap column: `.table("app_settings").select("id").limit(1)`.

### IN-02: Tuner Kill returns 404, not the 409 the "non-killable kinds" contract implies

**File:** `backend/app/api/admin.py:362-380`
**Issue:** The phase contract states eval/tuner kills should 409. Eval does (companion
`runs` row + `eval_runs.id` lookup → 409). A **tuner** job has no `runs` row at all, so
`kill_run` 404s on it (indistinguishable from a nonexistent run). This is defensible —
404 is non-discoverable and the frontend never renders a Kill affordance for tuner
(`killable === false`), so it is only reachable via a crafted request — but it diverges
from the stated 409-for-non-killable behavior. No security impact (operator-gated +
non-discoverable).
**Fix:** Acceptable as-is; if strict 409 parity is desired, cross-check `runs:active`
membership for a tuner id before the 404 and return 409 with the "ends on its own" copy.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
