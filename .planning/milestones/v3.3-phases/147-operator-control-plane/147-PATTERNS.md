# Phase 147: Operator Control Plane - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 18 (10 backend, 7 frontend, 1 migration)
**Analogs found:** 17 / 18 (the maintenance-middleware BODY has no in-repo custom-middleware analog — placement + research example only)

> This phase is **pure composition-and-extension**: nearly every file EXTENDS or RECOMPOSES a Phase-146 / shipped analog rather than inventing a shape. The load-bearing work is wiring shipped primitives correctly — especially factoring `cancel_run` internals for reuse and getting the maintenance allowlist exactly right. Excerpts below are copy-from targets with file:line.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/admin.py` | controller/route | request-response + CRUD | itself (146 `/backpressure`, `/me`, `/audit`) | exact (extend) |
| `backend/app/api/runs.py` | controller (refactor-extract) | request-response | `cancel_run` itself (`runs.py:1097-1265`) | exact (refactor) |
| `backend/app/services/run_lifecycle.py` | service | transform/co-write | `finalize_run_terminal` (already the terminal co-writer) | exact (new helper home) |
| `backend/app/services/health_probe.py` (NEW) | service/utility | request-response (probes) | `main.py health()` + `sandbox_service` docker + `admin.py:69` Redis ZCARD | composite role-match |
| `backend/app/services/tool_dispatcher.py` | service | event-driven (dispatch) | Phase-091 whitelist refuse (`dispatch_tool`, `3257-3279`) | exact |
| `backend/app/services/openai_service.py` | service | transform (schema build) | `get_tools()` hide layer (`1045-1050`) | exact (extend) |
| `backend/app/models/user_settings.py` | model/config | CRUD (settings) | `_val_bool` + `document_management_enabled()` + `save_app_settings` | exact (extend) |
| `backend/app/middleware/maintenance.py` (NEW) | middleware | request-response gate | CORS placement (`main.py:464`) + `require_operator` gate discipline | role-match (body: no analog) |
| `backend/app/main.py` | config/wiring | — | `_DIRECT_COLUMNS` (`97-106`) + `app.add_middleware` (`464`) | exact (extend) |
| `supabase/migrations/097_*.sql` (NEW) | migration | schema (DDL) | `053_settings_unification.sql:14-29` boolean columns | exact |
| `frontend/src/components/admin/ControlRoomPage.tsx` | component/page | orchestration + poll | itself (146 shell) | exact (recompose) |
| `frontend/src/components/admin/HealthSignals.tsx` | component (leaf) | props→DOM | itself (146 leaf) | exact (extend) |
| `frontend/src/components/admin/ActiveRunsSection.tsx` (NEW) | component | CRUD (list + kill) | `HealthSignals.tsx` (presentational grid leaf) + `AuditTab` list | role-match |
| `frontend/src/components/admin/CapabilityGrid.tsx` (NEW) | component | props→DOM + toggle write | `HealthSignals.tsx` grid leaf | role-match |
| `frontend/src/components/admin/MaintenancePanel.tsx` (NEW) | component | props→DOM + arm-to-confirm | `OperatorBand.tsx` (amber band) + `HealthSignals` | role-match |
| `frontend/src/components/chat/MessageItem.tsx` | component | props→DOM (render-only) | itself (`451`, `570-576`) | exact (fix) |
| Frontend app-shell maintenance banner (NEW) | component | props→DOM | `OperatorBand.tsx` (full-width band) | role-match |
| `frontend/src/lib/api.ts` | utility/api-client | request-response | `getBackpressure` + `BackpressureSignals` type (`3510-3577`) | exact (extend) |

---

## Pattern Assignments

### `backend/app/api/admin.py` (controller, request-response + CRUD) — EXTEND

**Analog:** itself — the Phase-146 operator router. New `/runs` (GET), `/runs/{run_id}/kill` (POST), `/flags` (PUT) endpoints and additive `dependencies{}` health fields on `/backpressure` all join THIS router. **NEVER a new router** (V4 headline threat — no RLS backstop).

**Router default-deny + audit-floor imports** (`admin.py:37-41`, 24-28) — copy verbatim, the new endpoints inherit the gate:
```python
router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_operator)])
```

**Floor-attached WRITE endpoint pattern** (`admin.py:44-60`) — set `audit_label`/`audit_action` on `request.state`, attach `_floor` dependency; the floor writes ONE row AFTER response:
```python
@router.get("/backpressure")
async def get_backpressure(request: Request, _floor: None = Depends(operator_audit_floor)):
    request.state.audit_label = "Viewed system health"
    request.state.audit_action = "health.view"
    ...
```
For the D-02 kill endpoint the label NAMES THE VICTIM (064-B): `request.state.audit_label = f"Ended {victim}'s run on {model}"`, `request.state.audit_action = "run.kill"`. Free-text action — NO migration (see Shared Pattern: Audit floor).

**Floor-EXEMPT GET pattern** (`admin.py:106-119`, the `/me` precedent) — D-07 applies this to the poll GETs (`/backpressure`, `/runs`): NO `_floor` dependency attached. The visit-row ("Opened the Control Plane") is a dedicated tiny floor-attached call on tab-open, not a floor on every poll:
```python
@router.get("/me")
async def get_operator_me(request: Request):   # NOTE: no operator_audit_floor dependency
    op = request.state.operator
    ...
```

**Additive-only JSON on `/backpressure`** (`admin.py:95-103`) — D-078-08: append `"dependencies": {...}` to the returned dict; the existing 4 keys stay byte-identical. Redis reachability precedent already in this endpoint (`admin.py:69-72`: `await get_redis().zcard("runs:active")` in a try/except).

---

### `backend/app/api/runs.py` + `run_lifecycle.py` (refactor-to-share, D-02) — EXTRACT HELPER

**Analog:** `cancel_run` (`runs.py:1097-1265`). Factor Steps 2/3a/3b into a shared helper; the operator kill calls it WITHOUT the ownership filter. **Anti-pattern: copy-paste (it will drift from the D-062-13 zombie-heal discipline).**

**Step 1 — ownership SELECT (operator path SKIPS the `.eq user_id`)** (`runs.py:1103-1119`):
```python
# cancel_run (owner): .eq("user_id", current_user["id"]) → 404 on others' runs
row_resp = await aexec(
    supabase.table("runs").select("run_id, status, thread_id")
    .eq("run_id", str(run_id)).eq("user_id", current_user["id"]).maybe_single())
if not row: raise HTTPException(404, "Run not found")
```
Operator variant: same SELECT but `.select("run_id,status,thread_id,user_id,model")` and **NO `.eq(user_id)`** (fetch ANY user's row for victim naming) — still 404-non-discoverable on missing. That missing `.eq` is the ENTIRE difference.

**Step 2 — idempotent-terminal 204** (`runs.py:1121-1125`, keep verbatim in the shared helper):
```python
if row["status"] in ("completed", "failed", "cancelled", "timed_out"):
    return Response(status_code=status.HTTP_204_NO_CONTENT)  # NO UPDATE, NO Redis touch
```

**Step 3a — happy path: PUBLISH cancel sentinel BEFORE `task.cancel()`** (`runs.py:1133-1155`, D-085-04 ordering — keep):
```python
task = RUN_TASKS.get(run_id)
if task is not None and not task.done():
    try:
        from app.services.ask_user_service import publish_cancel_sentinel
        await publish_cancel_sentinel(redis, run_id)   # PUBLISH-first (best-effort)
    except Exception:
        logger.exception("ask_user cancel sentinel broadcast failed for run %s", run_id)
    task.cancel()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**Step 3b — zombie heal: atomic terminal co-write + SETNX-gated synthetic sentinel + EXPIRE** (`runs.py:1157-1265`, keep verbatim). The atomic co-write is the load-bearing part:
```python
from app.services.run_lifecycle import finalize_run_terminal
await finalize_run_terminal(pool=pool, redis=redis, run_id=run_id,
    thread_id=..., status="cancelled", error="cancelled_by_user",
    completed_at=datetime.now(timezone.utc))   # status + BOTH ZREM mirrors in ONE call
```
Plus the SETNX cancel-lock (`runs.py:1225-1247`) and `EXPIRE 60` (`runs.py:1256-1261`). **Recommended helper home:** `run_lifecycle.py` (already the terminal co-writer). Extend `tests/test_062_cancel_run.py` to prove the owner path still 404s cross-user after the refactor.

> **Note (operator-resolved 2026-07-11):** a "recovered a stuck run" (zombie-heal reached) reads DIFFERENTLY from "killed" in the audit label per 064-B honesty — derive the verb from which sub-path fired.

---

### `backend/app/services/tool_dispatcher.py` — `dispatch_tool` refuse layer (D-04 layer 2) — EXTEND

**Analog:** the Phase-091 whitelist refuse (`tool_dispatcher.py:3257-3279`). Add a flag check that returns a plain `ToolResult` refusal — provider-agnostic, the agent loop attaches the `tool_call_id`. **No-op guarantee: literal skip when flags on** (the `phase_whitelist is None` skip is the template).
```python
async def dispatch_tool(tool_name: str, args: dict, ctx: ToolContext) -> ToolResult:
    # 091 precedent: whitelist branch is skipped byte-identically when None (Deep Mode).
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        ...
        return ToolResult(result=json.dumps({"error": "tool_not_available_in_phase", ...}))
    handler = _TOOL_REGISTRY.get(tool_name)
    ...
```
D-04 addition (sibling branch, same shape): when `web_search`/`execute_code`/`save_skill` is called but its flag is OFF, return `ToolResult(result=json.dumps({"error": "capability_disabled", "message": "Code execution is currently disabled by the administrator"}))`. Read the flag via the TTL-cached settings (Shared Pattern: flag read).

---

### `backend/app/services/openai_service.py` — `get_tools` hide layer (D-04 layer 1) — EXTEND

**Analog:** `get_tools()` conditional append (`openai_service.py:1045-1050`). New disabled tools are simply NOT appended → the model never sees them. Byte-identical when nothing is disabled:
```python
web_enabled = effective.web_search_enabled if effective is not None else settings.web_search_enabled
sandbox_enabled = effective.sandbox_enabled if effective is not None else settings.sandbox_enabled
if web_enabled:     tools.append(WEB_SEARCH_TOOL)
if sandbox_enabled: tools.append(EXECUTE_CODE_TOOL)
return tools
```
Extend with the same shape for `self_improve_enabled` gating `SAVE_SKILL_TOOL` (verify the self-improve seam at plan time — Assumption A1/Q5: it may be the `save_skill` tool OR a proposer background job; if a loop, gate at the loop entry, not here).

---

### `backend/app/models/user_settings.py` — flag read + failure semantics — EXTEND

**Analog:** `_val_bool` (`355-366`), `document_management_enabled()` (`639-650`), `save_app_settings` (`250-288`), the TTL cache (`215-241`).

**Fail-closed helper — mind the POLARITY** (`document_management_enabled:639-650` is the default-ON template; a kill-switch inverts):
```python
def document_management_enabled() -> bool:
    try:
        return load_app_settings().document_management_enabled
    except Exception:  # cold cache / DB read failure → default-ON (DM must not hide)
        return True
```
- Capability `*_enabled` helpers: last-known-good cache trusts the prior value; cold-cache/exception → the migration default `true` (do NOT silently disable a capability on a blip).
- **`maintenance_mode` INVERTS (operator-resolved Q4):** cold-cache/exception → `False` (platform OPEN). Failing "closed" here = a self-inflicted outage. Only a truly-uninitialized read defaults open.

**Last-known-good on DB failure** (`user_settings.py:233-239`, the substrate that makes a transient blip safe — a read failure returns the STALE cache, never "unknown"):
```python
except Exception:
    logger.warning("_load_settings_from_db: DB read failed; returning stale/empty cache", exc_info=True)
    if _settings_cache is None: _settings_cache = {}
```

**Write path** (`save_app_settings:280-288`) — parameterized UPDATE + `invalidate_settings_cache()` on success. The operator `/flags` PUT calls this.

---

### `backend/app/services/health_probe.py` (NEW) — composite analog

**Analogs (three, composed):**
- Redis PING: `main.py health()` (`478`) — `await asyncio.wait_for(get_redis().ping(), timeout=1.0)` in try/except.
- Redis reachability in an admin endpoint: `admin.py:69-72` (ZCARD in try/except, report 0 on failure).
- Docker probe: `sandbox_service.py:94-104` — `docker.from_env()` is the client; `import docker` guarded by `ImportError`.

Return additive fields on `/admin/backpressure` (see RESEARCH Code Examples for the `probe_redis()` sketch). **Three sandbox states** (Pitfall 6): `off-by-config` (grey, `settings.sandbox_enabled=false`) vs `up` (docker ping ok) vs `down` — never red a deliberately-disabled sandbox.

---

### `backend/app/middleware/maintenance.py` (NEW) + `main.py` wiring (D-06) — role-match placement, no body analog

**Analog (placement only):** `app.add_middleware(CORSMiddleware, ...)` (`main.py:464-471`). Add the maintenance middleware as a sibling. **There is NO existing custom ASGI/BaseHTTPMiddleware body in the repo to copy** — the body is new; use the research Pattern 6 + the allowlist below.

**Ordering** (Assumption A4 — verify locally): Starlette runs `add_middleware` in REVERSE registration order (last added = outermost). Register maintenance so CORS still answers preflight in maintenance.

**Allowlist (Pitfall 4 — MUST be exactly right or the off-switch wedges):**
- `/auth/*` (login), ALL `/admin/*` (the off-switch must stay reachable), `DELETE /runs/{id}` (self-cancel).
- Cold-cache reads maintenance as `False` (platform OPEN — Q4).
- Read the flag via the TTL-cached `load_app_settings_async()` — **NOT a raw supabase call** (Anti-pattern: blocking I/O in async middleware stalls the loop; D-v2.5-01).

**`_DIRECT_COLUMNS` extension** (`main.py:97-106`) — add the 3 new booleans to the allowlist so `save_app_settings` can write them (SQLi-safe: column names are code constants):
```python
_DIRECT_COLUMNS: set[str] = { ..., "web_search_enabled", "sandbox_enabled",
    "self_improve_enabled", "workflows_enabled", "maintenance_mode" }
```

---

### `supabase/migrations/097_operator_flags.sql` (NEW) — EXACT analog

**Analog:** `053_settings_unification.sql:14-29` (the `web_search_enabled`/`sandbox_enabled` boolean-column pattern). **Next free number confirmed: 097** (live tree tops out at `096_org_id_stub_sweep.sql`).
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS self_improve_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS workflows_enabled    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS maintenance_mode     boolean DEFAULT false;
```
Defaults keep existing behavior byte-identical (A5). Then: add each column to `_build_settings_from_row` (`user_settings.py`) + the Pydantic settings model. **Process (CLAUDE.md):** apply via Supabase SQL editor (never `db push`/`db reset`) → `bash scripts/regenerate-full-schema.sh` (no-reset live dump) → commit both. **Cloud parity:** paste into cloud SQL editor at promotion.

> The operator audit actions (`run.kill`, `flag.*`, `maintenance.set`) need **NO migration** — `operator_audit_log.action` is free-text with NO CHECK (`095_operator_foundation.sql:42`). Do NOT route them through the general `audit_log` (its enum is drift-guarded at startup by `assert_action_types_synced`, `main.py:265` — a wrong-table write HARD-FAILS all workers).

---

### `frontend/src/components/admin/ControlRoomPage.tsx` — RECOMPOSE (D-08 promote + D-07 poll)

**Analog:** itself (146 shell). RECOMPOSE per 063-B: pinned vitals → Health → Active runs → Controls → Activity. **Supersede** the "NO auto-polling" honesty beat (`ControlRoomPage.tsx:14-20, 115-133`) with D-07 auto-poll (~10s, pause on hidden tab).

**Tab array re-authored** (`ControlRoomPage.tsx:68-95`): Overview→"Control Plane"; "System Controls" dissolves INTO Control Plane; locked tabs rename (Users & Access 🔒148 · Model Registry 🔒149 · Secrets 🔒150 · Audit log). Keep the `TabDef`/`lockedDescription` shape and the 146 `LockedTab` refusal for the locked tabs.

**Entry-load + alive-guard idiom** (`ControlRoomPage.tsx:112-133`) — keep the `alive = useRef(true)` unmount guard; convert the one-shot `useEffect` to a `setInterval` + `document.visibilitychange` pause (Assumption A3), cleared on unmount.

**Manual ↻ still prepends its ledger row** (`ControlRoomPage.tsx:139-158`) — polls are silent (floor-exempt), the visible Refresh keeps its "Viewed system health" recording pulse.

---

### `frontend/src/components/admin/HealthSignals.tsx` — EXTEND (add dependency dots)

**Analog:** itself. PURE PRESENTATIONAL LEAF (props in, DOM out; `null` signals → dimmed placeholder, never a crash). The status-dot idiom already exists (`HealthSignals.tsx:82`: `<span className="... rounded-full bg-success" />`). Extend the `SIGNAL_ORDER` map / add a dependency-health row rendering up/slow/down/off dots from the new additive `signals.dependencies`. Keep the `showTechnical` raw-field reveal (`HealthSignals.tsx:89-93`).

---

### `frontend/src/components/admin/ActiveRunsSection.tsx` (NEW, 064-B) — role-match

**Analog:** `HealthSignals.tsx` (presentational leaf shape: props in, DOM out, `null`→calm placeholder) for the section frame; the shell owns the fetch/poll and passes rows down. Provider marks come from `@lobehub/icons` (RDD 43 single-source, NEVER placeholder art). **Anti-pattern (Pitfall / RESEARCH): optimistic Kill UI** — the killed card does NOT vanish; it shows Cancelling… → Cancelled·recorded (mirrors the async cancel truth). Elapsed = client math `now − started_at` (no poll for ticking). Tuner rows render with NO Kill affordance (D-01) + honest "ends on its own" copy.

---

### `frontend/src/components/admin/CapabilityGrid.tsx` (NEW, 065-A) + `MaintenancePanel.tsx` (NEW, 065-A) — role-match

**Analog:** `HealthSignals.tsx` grid leaf (the `grid grid-cols-1 sm:grid-cols-2 ...` card grid at `HealthSignals.tsx:71-96`) for the 2×2 capability grid; `OperatorBand.tsx` (the amber full-width band, `OperatorBand.tsx:38`) for the amber-framed Platform-state / maintenance panel. OFF cards look ARMED (red tint + "off for everyone" + concrete impact copy) — a kill-switch is not a preference. Maintenance uses arm-to-confirm + persistent 062-A consequence banner. Direct-flip switches vs arm-to-confirm maintenance (the 065-A distinction).

---

### `frontend/src/components/chat/MessageItem.tsx` — FIX BUG-260710-01/-02 (render-only, G-5 safe)

**Analog:** itself. Two render-only edits, no shared-path fork (D-03/G-5 safe).

**BUG-260710-01** — the stopped indicator (`MessageItem.tsx:570-576`) only fires on `message.stopped || runStatus==='timed_out'`; `stopped` is live-only and NOT re-derived on reload, so a persisted `runStatus==='cancelled'` shows nothing:
```tsx
{(message.stopped || message.runStatus === "timed_out") && !isStreaming && (
  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
    <Square className="w-3 h-3" />
    <span className="italic">
      {message.runStatus === "timed_out" ? "Agent reached time limit" : "Response stopped"}
    </span>
  </div>
)}
```
Fix: add `|| message.runStatus === 'cancelled'` to the guard so the indicator is persistent across reload (the `types/index.ts:163` comment already SAYS 'cancelled' renders 'Response stopped' — the render condition is the bug).

**BUG-260710-02** — the content gate (`MessageItem.tsx:451`, `message.content && ...`) leaves an empty bubble on an early cancel (before first token). Fix: render a "cancelled — no output yet" affordance when `runStatus==='cancelled' && !content`.

---

### Frontend app-shell maintenance banner (NEW) — role-match

**Analog:** `OperatorBand.tsx` (`38-85`) — the full-width persistent band shape (`<header className="border-b ... px-6 py-3.5">`). The end-user banner lives at App/ChatLayout level OUTSIDE the admin surface (`App.tsx:64-70` mounts `StreamsProvider > TooltipProvider > ChatLayout` — the banner wraps above/around ChatLayout). Reads the maintenance flag from a public/lightweight endpoint (end users are not operators — the `/admin/*` surface is 404 to them, so the banner needs a non-admin flag source). Persistent, plain "maintenance mode — read-only" copy; users can browse/read everything.

---

### `frontend/src/lib/api.ts` — EXTEND (types + client fns)

**Analog:** `BackpressureSignals` type (`api.ts:3520-3525`) + `getBackpressure` (`3555-3560`) + the `getOperatorAudit` envelope-unwrap idiom (`3570-3577`).

Extend `BackpressureSignals` additively (never break the 4 fields):
```typescript
export interface BackpressureSignals {
  anyio_threadpool_depth: { borrowed: number; total: number }
  redis_active_runs: number
  postgres_pool_in_use: number
  per_worker_run_count: number
  dependencies?: {                       // NEW — additive, optional for back-compat
    redis: { state: "up" | "down"; latency_ms: number | null }
    supabase: { state: "up" | "down"; latency_ms: number | null }
    sandbox: { state: "off" | "up" | "down"; latency_ms: number | null }
  }
}
```
Add `getAdminActiveRuns()` / `killRun(runId)` / `setFlag(...)` following the `getBackpressure` authed-GET + `ApiError` idiom. Remember `getOperatorAudit` proves the backend returns `{entries: [...]}` ENVELOPES — unwrap `.entries` (`api.ts:3575-3576`).

---

## Shared Patterns

### Router default-deny (V4 headline — apply to ALL new operator endpoints)
**Source:** `backend/app/api/admin.py:37-41` + `backend/app/dependencies.py:201-218`
**Apply to:** every new endpoint in this phase (`/runs`, `/runs/{id}/kill`, `/flags`, health fields).
```python
router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_operator)])   # byte-identical 404, NO RLS backstop
```
NEVER add an operator endpoint to any other router — it would lose the sole authority gate (cross-user data leak).

### Audit floor as a per-endpoint yield-dependency (D-07 seam)
**Source:** `backend/app/dependencies.py:221-256` + `backend/app/api/admin.py:44-60` (attached) / `106-119` (exempt)
**Apply to:** WRITES always (`run.kill`, `flag.*`, `maintenance.set`) — attach `_floor: None = Depends(operator_audit_floor)` + set `request.state.audit_label`/`audit_action`. GET polls (`/backpressure`, `/runs`) are floor-EXEMPT (the `/me` model). Action is FREE-TEXT — NO migration, NO CHECK (`095_operator_foundation.sql:42`). `is_write` auto-derives from HTTP method if unset (`dependencies.py:244-246`).

### `app_settings` TTL cache — flag read/write + fail-closed polarity (FLAG-01 core)
**Source:** `backend/app/models/user_settings.py:215-241` (cache + last-known-good), `250-288` (write+invalidate), `355-366` (`_val_bool`), `639-650` (polarity template)
**Apply to:** the maintenance middleware, both tool gates, the `/flags` write endpoint. Per-worker 30s TTL — a ≤30s cross-worker skew is EXPECTED and honest (Pitfall 5; matches "takes effect on their next call" copy — do NOT add Redis pub/sub cache-bust). Capability flags fail toward last-known-good/default-`true`; `maintenance_mode` cold-cache → `False` (Q4).

### Two-layer fail-closed capability gate (D-04)
**Source:** hide = `openai_service.py:1045-1050`; refuse = `tool_dispatcher.py:3257-3279` (091 no-op template)
**Apply to:** web / sandbox / self-improve. Both gates MUST be literal no-ops when flags on (Deep Mode byte-identical). Workflows (D-05) blocks NEW launches at the kickoff seam (`threads.py:1156` `create_workflow_run`) — in-flight runs finish.

### Presentational-leaf discipline (frontend)
**Source:** `HealthSignals.tsx:14-16, 64-98` + `OperatorBand.tsx:11-15`
**Apply to:** all new admin components (ActiveRunsSection, CapabilityGrid, MaintenancePanel). Props in, DOM out; the shell (ControlRoomPage) owns fetch/poll/state and threads it down; `null` data → calm dimmed placeholder, never a crash.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/middleware/maintenance.py` (NEW) — BODY | middleware | request-response gate | The repo has NO custom ASGI/BaseHTTPMiddleware to copy a body from (only `CORSMiddleware` via `add_middleware`). **Placement** is an exact analog (`main.py:464`), but the write-block body + allowlist come from RESEARCH Pattern 6 + Pitfall 4, not an in-repo file. Planner uses the research example. |

---

## Metadata

**Analog search scope:** `backend/app/{api,services,models,middleware}`, `backend/app/main.py`, `frontend/src/{components/admin,components/chat,components/layout,lib}`, `supabase/migrations/`
**Files scanned:** ~15 read + 3 glob/grep sweeps
**Pattern extraction date:** 2026-07-11
**Next free migration number (verified live):** 097
**Cross-refs for planner:** RESEARCH.md §Architecture Patterns 1-6, §Common Pitfalls 1-6, §Code Examples; CONTEXT.md D-01…D-08; operator-resolved supplements (run-kind Option A no-migration; maintenance cold-cache defaults OPEN).
