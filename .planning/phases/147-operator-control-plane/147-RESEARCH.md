# Phase 147: Operator Control Plane - Research

**Researched:** 2026-07-11
**Domain:** Operator ops-console — live dependency-health probes, cross-user active-runs monitoring + Kill, fail-closed capability kill-switches, maintenance/read-only middleware, on an existing FastAPI + `app_settings` TTL substrate
**Confidence:** HIGH (all seams verified in the live codebase at file:line; only the run-kind derivation strategy carries a MEDIUM design-choice open question)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 Run-list scope:** EVERY `runs:active` entry renders with a kind badge — Chat / Workflow / Eval / Tuner (full monitoring honesty; the set is fed by chats, workflow runs, eval matrix runs, and skill-tuner jobs). Kill is wired day-one for **chat + workflow runs only**; eval/tuner jobs show as bounded internal jobs with honest "ends on its own" copy, no Kill affordance.
- **D-02 Operator kill path:** `cancel_run` (`backend/app/api/runs.py:1097`) is ownership-scoped (`eq user_id` → 404 on others' runs), so Kill needs a new admin-side endpoint that reuses the SAME cancel/zombie-heal internals (sentinel ordering, idempotent-terminal 204, D-062-13 Redis best-effort discipline) minus the ownership filter — refactor-to-share, never copy-paste. Audit label names the victim per 064-B ("Ended maria's run on GPT-5…", write `run.kill`).
- **D-03 Victim experience:** the killed user sees **exactly a self-cancel** — the "Stopped" indicator, no operator attribution in their chat. Who/why lives ONLY in `operator_audit_log`. Zero new shared-path render surface (G-5-safe); the folded BUG-260710 fixes make that display honest.
- **D-04 Capability OFF = two-layer, fail-closed:** new runs don't advertise the disabled tool at all (removed from the tool schema so models never try) AND any in-flight call gets a plain refusal ToolResult ("Code execution is currently disabled by the administrator") the agent can relay and work around. Enforced at the single `dispatch_tool` seam. Matches the sketch's "N runs using code will error on their next call" impact copy.
- **D-05 Workflows switch = block new launches only:** Run buttons refuse with plain copy; in-flight workflow runs finish normally. Shape rule: switches stop NEW work; the Kill button is the tool for in-flight work.
- **D-06 Maintenance/read-only = middleware write-block + banner:** a middleware-level gate rejects mutating requests (POST/PUT/PATCH/DELETE) with a plain "maintenance mode — read-only" error. Allowlist: auth/login, ALL `/admin` routes (the off-switch must stay reachable), and users cancelling their own runs. In-flight runs finish. End users get a persistent app-wide banner and can browse/read everything. Arm-to-confirm + persistent 062-A consequence banner on the operator side (065-A).
- **D-07 Poll + visit-row exemption:** the Control Plane auto-polls read-only data while open (~10s default; pause when the tab is hidden). Automated reads are floor-EXEMPT; instead the ledger records ONE deliberate row per visit ("Opened the Control Plane") plus the existing manual ↻ row. Writes are floor-logged always, no exceptions. Elapsed tickers are client-side math from `started_at` — no poll needed for ticking.
- **D-08 D-147-IA RATIFIED — Promote:** the 146 "Overview" tab becomes the live "Control Plane" landing tab (063-B composition: pinned vitals → Health detail → Active runs → Controls → Activity). Health lives in exactly ONE place; band tabs read Control Plane · Users&Access(🔒148) · Model Registry(🔒149) · Secrets(🔒150) · Audit log.

### Claude's Discretion
- The new operator-kill endpoint shape/name (e.g., `POST /admin/runs/{run_id}/kill`) and how the cancel internals are factored for reuse
- Long-running (>8 min per sketch) and "not responding" (stalled-stream) threshold mechanics for the 064-B card tags
- Workflow-run Kill delegation (whole-run cancel via the existing workflow-run cancel machinery)
- Flag key names for the net-new switches (self-improve / workflows / maintenance) alongside existing `web_search_enabled` + `sandbox_enabled`; flag-read failure semantics (fail-closed on genuinely unknown state without turning a transient DB blip into a platform outage — last-known-good TTL cache is the substrate)
- Dependency-probe implementation (Redis PING, trivial Supabase select, sandbox/Docker reachability + latency; healthy/slow/down thresholds; "off by config" vs "down" for a disabled sandbox)
- The impact-copy data source for switch cards ("2 runs using code…" — derive from runs:active + run metadata)
- Exact poll cadence/backoff, hidden-tab pause mechanics, and which GET endpoints are floor-exempt
- Where the maintenance middleware sits in the FastAPI stack and its exact allowlist expression
- Audit action vocabulary for the new writes (`run.kill`, `flag.*`, `maintenance.set` per sketch 066's linkage rows)

### Deferred Ideas (OUT OF SCOPE)
- Eval/tuner run cancellation (killable internal jobs) — bounded jobs with their own timeout/claim lifecycles
- Workflow pause/resume at phase boundaries — rejected as the workflows-switch semantics
- Operator-typed kill reason threaded to the victim — rejected D-03 variant (v3.4 multi-tenancy territory)
- Sub-tabbed Control Plane (sketch 063-C) — the documented scale-up if the runs table + audit browser outgrow the single scroll
- Audit browser filters/CSV + user management + impersonation (Phase 148), model registry (149), secrets encryption (150)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ADMIN-02** | Operator sees system health (Redis / Supabase / sandbox probes + backpressure) live in the `/admin` shell, plus an active-runs view (thread / user / model / elapsed) with a working Kill affordance (delegates to `cancel_run` zombie-heal). | Health probes are ADDITIVE fields on `GET /admin/backpressure` (`admin.py:44-103`); active-runs list reads `runs:active` (`run_lifecycle.py:53`) enriched via the `runs` table (`035_runs_table.sql`); Kill reuses `cancel_run` internals (`runs.py:1097-1265`). Frontend recomposes `ControlRoomPage.tsx`. |
| **FLAG-01** | Operator disables a misbehaving capability (kill-switches: web search, sandbox, self-improve, workflows) and enables maintenance/read-only mode — on the existing `app_settings` TTL substrate, fail-closed, no new flag infra. | `app_settings` TTL cache (`user_settings.py:210-241`); tool hide layer (`openai_service.py:1045-1050`); refuse layer (`dispatch_tool`, `tool_dispatcher.py:3257-3279`); maintenance = new FastAPI middleware in `main.py`; workflow-launch block at the kickoff seam (`threads.py:1156`). |
</phase_requirements>

## Summary

Phase 147 is a **pure composition-and-extension** phase: every substrate it needs already exists and is verified live. There is **no new library, no new runtime, no new flag infrastructure**. The work is (1) additive JSON fields on the existing `/admin/backpressure` endpoint for dependency health, (2) a net-new operator-scoped active-runs read + Kill endpoint that factors the existing `cancel_run` internals into a shared helper, (3) three new boolean columns on `app_settings` read through the already-live 30 s TTL cache, gated at the two existing tool seams plus the workflow kickoff seam, (4) a maintenance write-block middleware in the FastAPI stack, and (5) a frontend recompose of the Phase-146 `ControlRoomPage` per the locked 063-B/064-B/065-A/066 sketch contracts, plus two small honesty fixes in `MessageItem.tsx`.

The single genuinely-open technical question is **run-kind derivation** (D-01 kind badges). `runs:active` is a flat sorted set fed by four writers with *different* companion structures: chat + workflow + eval runs each have a `runs` table row; **tuner runs have NO `runs` row (Redis-only)**. Distinguishing chat-vs-workflow among the rows that DO exist requires a cross-reference (thread anchor / `workflow_runs`). This needs a decided strategy before planning — options are laid out in Open Questions.

The security posture is inherited and strong: the `/admin` router is default-deny 404-non-discoverable with NO RLS backstop (service-role backend), so every new endpoint MUST join the same router. The maintenance middleware is the one net-new cross-cutting security surface and its allowlist must be exactly right (the off-switch must stay reachable).

**Primary recommendation:** Extend `admin.py` with health/active-runs/kill/flag endpoints (all on the existing `require_operator` router); factor `cancel_run`'s Step-2/3a/3b internals into a shared `runs`/`run_lifecycle` helper the operator-kill endpoint calls without the ownership SELECT; add ONE migration (097) for three `app_settings` booleans; add a maintenance middleware after CORS in `main.py`; recompose `ControlRoomPage.tsx` and fix the two `MessageItem.tsx` cancelled-render bugs. Decide the run-kind derivation strategy first.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dependency-health probes (Redis/Supabase/sandbox) | API / Backend (`admin.py`) | — | Reachability + latency are server-side facts; ADDITIVE on `/admin/backpressure` JSON (D-078-08). |
| Active-runs list (cross-user) | API / Backend (`admin.py` + Redis + `runs` table) | Frontend (elapsed ticker) | Cross-user reads REQUIRE the operator gate (no RLS backstop); elapsed is client-side math from `started_at` (D-07). |
| Kill a run | API / Backend (shared cancel helper) | — | Reuses `cancel_run` zombie-heal internals minus ownership; Postgres `runs.status` is authoritative (D-145-01). |
| Capability kill-switches (read/enforce) | API / Backend (`app_settings` TTL + `dispatch_tool`/`get_tools`) | — | Flag read is per-worker cached; enforcement at the tool-schema + dispatch seams (fail-closed). |
| Capability kill-switches (write/toggle) | API / Backend (`admin.py` write endpoint → `save_app_settings`) | Frontend (065-A grid) | Writes go through `save_app_settings` (invalidates cache); UI is a presentational grid. |
| Maintenance / read-only mode | Frontend-Server-adjacent (FastAPI middleware in `main.py`) | Frontend (app-shell banner) | A write-block belongs in the middleware stack BEFORE routers; the end-user banner lives in the app shell OUTSIDE the admin surface. |
| Operator audit ledger (who/what/when) | API / Backend (`operator_audit_floor` + free-text action) | Frontend (062-A ledger) | Floor is a per-endpoint yield-dependency; the ledger row IS the receipt. |
| Cancelled-message honesty (BUG-260710) | Browser / Client (`MessageItem.tsx` render) | — | Pure render-derive from persisted `runStatus`; G-5 hot file, no shared-path fork. |

## Standard Stack

### Core (all already installed — verified in the running app)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | (in use) | Router + middleware stack; `admin.py` router + the maintenance middleware | The app's web framework; `app.add_middleware` already used for CORS (`main.py:464`). |
| `redis` (aioredis) | (in use) | `runs:active` sorted-set reads (`ZRANGE …WITHSCORES`), health `PING` | Already the run-buffer substrate (`get_redis()`, `dependencies.py`). |
| asyncpg | (in use) | `app_settings` reads/writes; `runs` table enrichment join | Already the settings + runs writer pool (`get_pg_pool()`). |
| supabase-py | (in use) | Trivial health `select`; `operator_audit_log` writes | Already the audit + auth client; MUST wrap in `run_in_threadpool` (D-v2.5-01). |
| `docker` (docker-py) | (in use) | Sandbox reachability probe (`docker.from_env().ping()`) | Already used by `SandboxSessionManager` (`sandbox_service.py:95-104`). |
| React + Vite + Tailwind + shadcn/ui | (in use) | `ControlRoomPage` recompose, run cards, capability grid, maintenance banner | The Aether Intelligence design system; 146 admin components already exist. |
| `@lobehub/icons` | (in use) | Cross-provider run-card provider marks (RDD 43 single-source) | Locked in sketch 048; sketch 064 uses the real marks. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | (in use) | Icons (Lock, RefreshCw already imported in `ControlRoomPage.tsx:27`) | Non-provider iconography. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `app_settings` booleans | LaunchDarkly / Unleash / Flagsmith | REQUIREMENTS.md line 70 explicitly rejects a flag SaaS: "Over-scoped for a handful of global booleans; `app_settings` substrate suffices (FLAG-01)". **Do not introduce.** |
| Middleware write-block | Per-route dependency on every mutating endpoint | Middleware is one seam; per-route would touch every router and be forgettable (the exact anti-pattern the router-level `require_operator` avoided). |
| A `runs.kind` column (schema) | Redis-key-namespace / cross-ref derivation | See Open Questions — a schema column is cleanest but touches many insert sites. |

**Installation:** None. No `npm install` / `pip install`. This phase adds zero dependencies.

## Package Legitimacy Audit

**Not applicable — this phase installs NO external packages.** All capabilities are built on libraries already present and running in the app (FastAPI, redis, asyncpg, supabase-py, docker-py, React/shadcn, `@lobehub/icons`). No `npm install`, no `pip install`, no new `requirements.txt` / `package.json` entry. slopcheck / registry verification is moot. If planning later discovers a genuinely-new dependency is warranted, run the Package Legitimacy Gate at that point.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌────────────────────────── OPERATOR (browser) ───────────────────────────┐
                          │  ControlRoomPage (recomposed per 063-B)                                  │
                          │   pinned vitals → Health → Active runs (064-B cards) → Controls (065-A)   │
                          │   → Activity (062-A ledger)                                               │
                          │   auto-poll ~10s (pause on tab hidden, D-07); elapsed = client math       │
                          └───────┬─────────────┬──────────────┬───────────────┬────────────────────┘
                                  │ GET          │ GET           │ POST           │ PUT
                                  │ /admin/       │ /admin/runs    │ /admin/runs/    │ /admin/flags
                                  │ backpressure  │ (active list)  │ {id}/kill       │ (toggle)
                                  ▼              ▼               ▼               ▼
   ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
   │  admin.py router  —  Depends(require_operator) [default-deny 404, NO RLS backstop]             │
   │  ├ /backpressure  : 4 backpressure signals + ADDITIVE health{redis,supabase,sandbox,latency}   │
   │  │                    floor-attached ("Viewed system health")                                  │
   │  ├ /runs (GET)     : ZRANGE runs:active WITHSCORES → enrich(runs table) → kind-derive           │
   │  │                    floor-EXEMPT (poll); ONE visit-row on tab-open instead (D-07)             │
   │  ├ /runs/{id}/kill : shared cancel helper (no ownership filter) → floor("run.kill", names victim)│
   │  └ /flags (PUT)    : save_app_settings({..._enabled}) → floor("flag.*"/"maintenance.set", ✎)    │
   └───────┬───────────────────────┬────────────────────────┬───────────────────────┬───────────────┘
           │ PING/ZRANGE            │ SELECT * runs          │ shared cancel_run      │ UPDATE app_settings
           ▼                        ▼    WHERE run_id∈active  ▼    internals           ▼   invalidate cache
   ┌───────────────┐   ┌──────────────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
   │ Redis         │   │ Postgres: runs table      │   │ finalize_run_terminal│  │ Postgres: app_settings │
   │ runs:active   │   │ (chat/workflow/eval rows; │   │ + zombie-heal +      │  │ web_search_enabled,    │
   │ (sorted set)  │   │  tuner has NO row)        │   │ ask_user sentinel    │  │ sandbox_enabled,       │
   └───────────────┘   └──────────────────────────┘   └────────────────────┘  │ + self_improve_enabled │
                                                                                │ + workflows_enabled    │
   ┌─────────────────────────── END-USER REQUEST PATH ────────────────────────┐ │ + maintenance_mode     │
   │  ASGI → CORS middleware → [NEW] MaintenanceMiddleware ──► if maintenance   │ └───────────┬────────────┘
   │    AND method∈{POST,PUT,PATCH,DELETE} AND path NOT in allowlist            │             │ 30s TTL cache
   │    → 503 "maintenance mode — read-only"  else → routers                    │             ▼ (per worker)
   │  allowlist: /auth/*, /admin/*, DELETE /runs/{id} (self-cancel)             │   load_app_settings_async()
   └───────────────────────────────────────────────────────────────────────────┘             │
                                                                                               ▼
   ENFORCEMENT of capability flags (fail-closed, two-layer per D-04):                get_tools() HIDE layer
     Layer 1 (hide): get_tools(user_settings) omits WEB_SEARCH_TOOL / EXECUTE_CODE_TOOL when flag off
     Layer 2 (refuse): dispatch_tool() returns a plain ToolResult refusal for an in-flight call
     Workflows (D-05): block NEW launches at the threads.py kickoff seam; in-flight finish
```

### Recommended structure (files this phase touches)
```
backend/app/
├── api/
│   ├── admin.py            # EXTEND: + /runs (GET), + /runs/{id}/kill (POST), + /flags (PUT); health fields on /backpressure
│   └── runs.py             # REFACTOR: extract cancel Step-2/3a/3b into a shared helper (D-02)
├── services/
│   ├── run_lifecycle.py    # candidate home for the shared cancel helper (already the terminal co-writer)
│   ├── health_probe.py     # NEW (small): probe_redis() / probe_supabase() / probe_sandbox() with latency + off-by-config
│   └── tool_dispatcher.py  # EXTEND dispatch_tool: refuse layer for self_improve/workflows/web/sandbox when off
│   └── openai_service.py   # EXTEND get_tools: hide layer already gates web/sandbox (1045-1050); add self_improve tool
├── models/user_settings.py # EXTEND: read self_improve_enabled / workflows_enabled / maintenance_mode (fail-closed helpers)
├── middleware/maintenance.py  # NEW: the write-block middleware (or inline in main.py)
└── main.py                 # WIRE: app.add_middleware(MaintenanceMiddleware) after CORS
frontend/src/
├── components/admin/
│   ├── ControlRoomPage.tsx # RECOMPOSE per 063-B + promote Overview→Control Plane + auto-poll (D-07)
│   ├── HealthSignals.tsx   # EXTEND: add dependency-health dots (up/slow/down) alongside the 4 backpressure signals
│   ├── ActiveRunsSection.tsx  # NEW (064-B cards + confirm sheet + honest Cancelling…→Cancelled)
│   ├── CapabilityGrid.tsx     # NEW (065-A 2×2 armed-OFF cards + impact copy)
│   └── MaintenancePanel.tsx   # NEW (065-A amber Platform-state panel + arm-to-confirm)
├── components/chat/MessageItem.tsx  # FIX BUG-260710-01/-02 (derive stopped from runStatus==='cancelled')
├── components/app-shell (banner)    # NEW end-user maintenance banner (outside admin)
└── lib/api.ts              # EXTEND BackpressureSignals type + add getAdminActiveRuns/killRun/setFlag
supabase/migrations/097_*.sql  # NEW: 3 app_settings booleans (cloud-parity note)
```

### Pattern 1: Router-level default-deny (inherited — DO NOT re-invent)
**What:** Every `/admin` route inherits `Depends(require_operator)` at the ROUTER level (`admin.py:37-41`), returning a byte-identical **404** (not 403) to non-operators — non-discoverable. There is **NO RLS backstop** (service-role backend), so this gate is the sole authority.
**When to use:** Every new operator endpoint MUST join this router. Never add an operator endpoint to any other router.
```python
# Source: backend/app/api/admin.py:37-41 (VERIFIED)
router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_operator)])
```

### Pattern 2: The audit floor as a per-endpoint yield-dependency (D-07 seam)
**What:** `operator_audit_floor` (`dependencies.py:221-256`) is attached PER-ACTION-ENDPOINT (never at the router), so a GET can be floor-EXEMPT. It reads `request.state.audit_label`/`audit_action`/`audit_is_write` and writes exactly ONE `operator_audit_log` row AFTER the response. `is_write` defaults from the HTTP method.
**D-07 application:** attach the floor to writes (kill/flag/maintenance) ALWAYS; do NOT attach it to the poll GETs (`/backpressure`, `/runs`); instead record ONE "Opened the Control Plane" row on tab-open (a dedicated tiny POST, or a floor-attached first fetch). The `/admin/me` no-floor precedent (`admin.py:106-119`) is the model.
```python
# Source: backend/app/api/admin.py:44-60 (VERIFIED) — set label/action then let the floor read them
request.state.audit_label = "Ended maria's run on GPT-5"
request.state.audit_action = "run.kill"          # free-text — NO migration needed (see Pitfall 3)
```

### Pattern 3: `cancel_run` internals to factor (D-02 refactor-to-share)
**What:** `cancel_run` (`runs.py:1097-1265`) has four sub-paths. The operator kill reuses **Steps 2, 3a, 3b** verbatim, skipping ONLY Step 1 (the ownership SELECT):
- **Step 1 (SKIP for operator):** ownership SELECT `.eq("user_id", current_user["id"])` → 404 (`runs.py:1103-1119`).
- **Step 2 (keep):** already-terminal → 204 silent, idempotent (`runs.py:1121-1125`).
- **Step 3a (keep):** happy path — PUBLISH ask_user cancel sentinel BEFORE `task.cancel()` (D-085-04 ordering), return 204 (`runs.py:1127-1155`).
- **Step 3b (keep):** zombie heal — `finalize_run_terminal(status="cancelled", error="cancelled_by_user")` + workflow anchor clear + SETNX-gated synthetic `zombie_healed` sentinel + EXPIRE 60 (`runs.py:1157-1265`).
**Recommended factoring:** extract Steps 2/3a/3b into `async def _cancel_run_internals(run_id, thread_id, redis, ...)` (candidate home: `run_lifecycle.py`, already the terminal co-writer). `cancel_run` does Step 1 then calls it with the row it fetched; the operator endpoint does its OWN operator-scoped SELECT (to get `thread_id`/`user_id`/`model` for the audit label + victim naming) then calls the same helper. **The operator SELECT is NOT `.eq(user_id)`** — that is the entire difference.
```python
# Operator kill (sketch): fetch ANY user's run row (for victim naming), then shared internals
row = await aexec(supabase.table("runs")
        .select("run_id,status,thread_id,user_id,model").eq("run_id", str(run_id)).maybe_single())
if not row.data: raise HTTPException(404, "Run not found")   # still non-discoverable
await _cancel_run_internals(run_id, row.data["thread_id"], redis, ...)   # Steps 2/3a/3b
request.state.audit_label = f"Ended {victim}'s run on {row.data['model']}"  # D-02 names the victim
```

### Pattern 4: Two-layer fail-closed capability gate (D-04)
**What:** A disabled capability is enforced at TWO seams (both already exist for web/sandbox):
- **Layer 1 — HIDE from schema** (`openai_service.py:1045-1050`): `get_tools()` appends `WEB_SEARCH_TOOL` only if `web_enabled`, `EXECUTE_CODE_TOOL` only if `sandbox_enabled`. New disabled tools are simply not appended → the model never sees them. Byte-identical when nothing is disabled.
- **Layer 2 — REFUSE in-flight** (`dispatch_tool`, `tool_dispatcher.py:3257-3279`): the Phase-091 whitelist precedent returns a plain `ToolResult(result=json.dumps({...}))` when a tool isn't allowed — provider-agnostic, the agent loop attaches the tool_call_id (no provider branch). Add a flag check here that returns a plain "disabled by the administrator" refusal.
**No-op guarantee:** both gates must be literal no-ops when flags are absent/on — Deep Mode byte-identical (the 091 `phase_whitelist is None` skip is the template).

### Pattern 5: `app_settings` TTL cache — flag read + failure semantics (FLAG-01 core)
**What:** All flags read through the 30 s per-worker TTL cache (`user_settings.py:210-241`). `_load_settings_from_db()` on a DB read failure returns the **stale/empty cache** (last-known-good) — a transient blip does NOT flip a flag. `_val_bool(row, key, env_attr, default)` (`user_settings.py:355-366`) resolves DB → env → default. Writes go through `save_app_settings()` which `invalidate_settings_cache()` on success (`user_settings.py:250-288`).
**Fail-closed helper polarity (the load-bearing subtlety):** compare the two existing helpers —
- `document_management_enabled()` (`user_settings.py:639-650`) falls back to **True** (default-ON) on read failure.
- A kill-switch must do the OPPOSITE for a *disable* toggle: on a genuinely-unknown state fail **closed**. BUT the "unknown state" is only a TRULY cold cache; the last-known-good TTL cache already prevents a transient DB blip from being "unknown" (it returns the prior value). Recommended: read `maintenance_mode`/`*_enabled` with a defensive helper that (a) trusts the last-known-good cache, and (b) on a cold-cache/exception returns the SAFE value (capability OFF / maintenance OFF-for-enable but the write-block itself should default to *not* locking everyone out on a cold read — see Open Questions Q4 for the maintenance polarity nuance).
```python
# Source: backend/app/models/user_settings.py:233-241 (VERIFIED) — last-known-good on DB failure
except Exception:
    logger.warning("_load_settings_from_db: DB read failed; returning stale/empty cache", exc_info=True)
    if _settings_cache is None: _settings_cache = {}
```

### Pattern 6: FastAPI middleware placement (D-06 maintenance)
**What:** CORS is added via `app.add_middleware(CORSMiddleware, ...)` at `main.py:464-471`. A maintenance middleware is a sibling `app.add_middleware(...)`. **Ordering note:** Starlette runs `add_middleware`-registered middleware in REVERSE registration order (last added = outermost). Add the maintenance middleware so it runs AFTER CORS resolves (CORS must still answer preflight even in maintenance). The middleware reads the flag via `load_app_settings_async()` (async, TTL-cached, cheap) — NOT a raw DB hit per request. Any supabase-py call inside it MUST use `run_in_threadpool` (D-v2.5-01), but the TTL-cached async read avoids blocking I/O entirely.

### Anti-Patterns to Avoid
- **Copy-pasting `cancel_run` for the operator path.** D-02 is explicit: refactor-to-share. A copy will drift from the zombie-heal discipline (D-062-13) the moment `runs.py` changes.
- **Adding operator endpoints outside the `admin.py` router.** They'd lose the default-deny 404 gate — a cross-user data leak (there is NO RLS backstop).
- **A `CHECK` constraint or enum for the new operator audit actions.** `operator_audit_log.action` is deliberately FREE-TEXT (`095_operator_foundation.sql:14-15,42`). Adding a constraint would fight the auto-floor. (Distinct from the general `audit_log` drift guard — see Pitfall 3.)
- **Blocking I/O in the maintenance middleware.** A raw `supabase.table(...).execute()` in an async middleware violates D-v2.5-01 and stalls the event loop on every request. Use the TTL-cached async read.
- **Optimistic Kill UI.** 064-B is explicit: the killed row does NOT vanish — it shows Cancelling… → Cancelled·recorded (mirrors the async cancel truth). Do not remove the card on click.
- **Attributing the operator in the victim's chat (D-03).** The victim sees exactly a self-cancel; who/why lives ONLY in `operator_audit_log`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cancel a runaway run | A fresh operator cancel path | Shared `cancel_run` internals (Steps 2/3a/3b) | The zombie-heal sentinel ordering (D-085-04 PUBLISH-first), idempotent-terminal 204, SETNX cancel-lock (WR-04), atomic `finalize_run_terminal` co-write (D-145-14), and best-effort Redis discipline (D-062-13) are all subtle and already correct. |
| Feature flags | A flag SaaS or a new flag table/service | `app_settings` boolean columns + the 30 s TTL cache | REQUIREMENTS.md rejects a flag SaaS; the cache + invalidate-on-write already gives sub-TTL propagation with no restart. |
| Active-runs elapsed timer | A server poll for ticking seconds | Client-side math from `started_at` (D-07) | The `runs:active` score IS the unix start time (`run_lifecycle.py:94`); the browser computes `now − score`. No poll needed for ticking. |
| Operator audit records | A new logging mechanism | `operator_audit_floor` + free-text `action` | The floor already writes one immutable row per action after the response; new action codes need NO migration. |
| Cross-user active-runs auth | UI-only hiding | The `admin.py` router gate | UI hiding is not a security boundary; the 404 gate is (no RLS backstop). |
| Tool-schema gating | Per-provider tool filtering | `get_tools()` conditional append + `dispatch_tool` refuse | Provider-agnostic; the agent loop attaches tool_call_ids so no provider branch is ever touched. |

**Key insight:** Nearly every piece of this phase is a *re-use* of a shipped, hard-won primitive. The value is in wiring them correctly (especially the cancel-internals factoring and the maintenance allowlist), not in building anything new.

## Common Pitfalls

### Pitfall 1: `runs:active` is a flat set of FOUR run kinds with DIFFERENT companion data
**What goes wrong:** Assuming every `runs:active` entry has a `runs` table row (for thread/user/model enrichment). **Tuner runs do NOT** (`skill_tuner.py:738` ZADDs `runs:active` with no `insert_run`). Eval runs DO (`evals.py:300-315` calls `insert_run` then ZADDs). Chat + workflow runs DO (via `register_run_start`, `threads.py:1118`).
**Why it happens:** The `runs` table has NO `kind` column (`035_runs_table.sql`); the only kind signal is the parallel `runs_by_thread:*` key namespace (`runs_by_thread:{tid}` chat/workflow, `runs_by_thread:eval:{skill_id}`, `runs_by_thread:tuner:{skill_id}`).
**How to avoid:** Decide the kind-derivation strategy (Open Questions Q1) before planning. A `runs` lookup that returns nothing means "tuner" (or a race); a lookup that returns a row is chat/workflow/eval — distinguish workflow via `threads.active_workflow_run_id` / `workflow_runs`.
**Warning signs:** A `KeyError`/`None` on model/user for a tuner run; a Kill button appearing on a tuner job (D-01 forbids it).

### Pitfall 2: The victim's cancelled state is invisible on reload (the folded bugs)
**What goes wrong:** BUG-260710-01 — after an operator Kill (or self-cancel), the "Response stopped" indicator vanishes on navigation. **Root cause (VERIFIED):** live-cancel sets `{runStatus:"cancelled", stopped:true}` (`StreamsProvider.tsx:1941`), but `message.stopped` is live-only. On reload `getMessages` maps `run_status`→`runStatus` (so `runStatus==='cancelled'` IS present) but `stopped` is NOT re-derived, and `MessageItem.tsx:570` only renders the indicator on `message.stopped || runStatus==='timed_out'` — cancelled is neither → indicator gone. The type comment (`types/index.ts:163`) already SAYS "'cancelled' renders 'Response stopped'", so the intent exists; the render condition is the bug.
**BUG-260710-02:** an early cancel (before first token, esp. DeepSeek) persists empty content; `MessageItem.tsx:451` gates on `message.content` so only the avatar renders, and (per above) no stopped indicator either → an empty broken-looking bubble.
**How to avoid:** In `MessageItem.tsx`, derive the stopped indicator from `runStatus==='cancelled'` too (persistent), and render a "cancelled — no output yet" affordance when `runStatus==='cancelled' && !content`. Both are render-only in a G-5 hot file — no shared-path fork (D-03/G-5 safe).
**Warning signs:** A cancelled message that looks like a short completed one after reload.

### Pitfall 3: New operator audit actions need NO migration — but the GENERAL audit_log enum DOES hard-fail
**What goes wrong:** Confusing `operator_audit_log` (free-text `action`, NO check — `095_operator_foundation.sql:14-15,42`) with the general `audit_log` whose action-type enum is drift-guarded at startup by `assert_action_types_synced` (`main.py:265-266`) and HARD-FAILS all workers on drift.
**How to avoid:** Write `run.kill`, `flag.web_search.off`, `maintenance.set` etc. directly to `operator_audit_log` — no migration, no enum edit. Do NOT route operator actions through the general `audit_log` path (they'd trigger the drift guard).
**Warning signs:** A startup crash "action types out of sync" after adding an audit call to the wrong table.

### Pitfall 4: The maintenance allowlist can lock the operator out of their own off-switch
**What goes wrong:** A maintenance write-block that blocks ALL mutating methods also blocks `POST /admin/flags` (turning maintenance OFF) and login — the platform wedges read-only permanently.
**How to avoid:** The allowlist (D-06) MUST include: auth/login routes, ALL `/admin/*` routes, and `DELETE /runs/{id}` (users self-cancelling in-flight runs). Verify by path-prefix. Also default the write-block to OPEN on a cold-cache read (do not lock everyone out because the settings cache hasn't warmed) — see Open Questions Q4.
**Warning signs:** A 503 on `POST /admin/flags`; inability to log in during maintenance.

### Pitfall 5: Multi-worker flag propagation lag (WORKER_COUNT=2)
**What goes wrong:** A flag flip on worker A is invisible to worker B until B's 30 s TTL expires (each worker has its own `_settings_cache`). `save_app_settings` only invalidates the CURRENT worker's cache.
**Why it happens:** The TTL cache is per-process; there is no cross-worker cache-bust.
**How to avoid:** This is EXPECTED and matches the sketch's "takes effect on their next call / within the TTL window" copy (065-A grounding). The maintenance middleware and both tool gates all read the same cache, so behavior is consistent per-worker; a ≤30 s cross-worker skew is acceptable and honest. Do NOT try to add a Redis pub/sub cache-bust (scope creep).
**Warning signs:** A flag appearing to "not take" for ~30 s — this is correct, not a bug.

### Pitfall 6: Sandbox "off by config" vs "down" (health probe honesty)
**What goes wrong:** Reporting the sandbox as "down/red" when `SANDBOX_ENABLED=false` — an operator misreads a deliberate config as a failure.
**Why it happens:** `settings.sandbox_enabled` gates whether the sandbox is even meant to run (`main.py:451`); a disabled sandbox has no container to ping.
**How to avoid:** The probe must report three states: **off-by-config** (grey/neutral, `sandbox_enabled=false`), **healthy** (docker `ping()` ok), **down** (docker unreachable). `docker.from_env()` is already the client (`sandbox_service.py:95-104`).
**Warning signs:** A red sandbox card on a deployment that intentionally runs sandbox-off.

## Code Examples

### Reading `runs:active` with scores (active-runs list — elapsed source)
```python
# runs:active score = unix start time (run_lifecycle.py:94 VERIFIED). Elapsed = now − score (client-side, D-07).
entries = await redis.zrange("runs:active", 0, -1, withscores=True)   # [(run_id, started_epoch), ...]
# Backpressure already ZCARDs this set: admin.py:70 `await get_redis().zcard("runs:active")`
```

### Dependency health probe (ADDITIVE on /admin/backpressure)
```python
# Source pattern: main.py:230-235 (Redis PING) + main.py:474-482 (/health) + sandbox_service.py:95-104 (docker)
async def probe_redis() -> dict:
    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=1.0)
        return {"state": "up", "latency_ms": round((time.perf_counter()-t0)*1000)}
    except Exception:
        return {"state": "down", "latency_ms": None}
# Return these UNDER a new additive key on the existing /admin/backpressure JSON (D-078-08 additive-only):
#   {..., "dependencies": {"redis": {...}, "supabase": {...}, "sandbox": {"state": "off"|"up"|"down", ...}}}
```

### The additive BackpressureSignals extension (frontend type)
```typescript
// Source: frontend/src/lib/api.ts:3520-3525 (VERIFIED) — extend, never break the 4 existing fields
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

### Migration 097 (three new app_settings booleans — mirrors the 053 pattern)
```sql
-- Source pattern: 053_settings_unification.sql:18-19 (VERIFIED web_search_enabled/sandbox_enabled booleans)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS self_improve_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS workflows_enabled    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS maintenance_mode     boolean DEFAULT false;
-- Apply via Supabase SQL editor (CLAUDE.md), then bash scripts/regenerate-full-schema.sh.
-- CLOUD PARITY: paste into cloud SQL editor at promotion (docs/DEPLOYMENT-WORKFLOW.md).
-- Then add each column to _DIRECT_COLUMNS (main.py:97-106) + _build_settings_from_row (user_settings.py:471+).
```

## State of the Art

| Old Approach (Phase 146) | Current Approach (Phase 147) | When Changed | Impact |
|--------------------------|------------------------------|--------------|--------|
| Manual ↻ refresh only, NO polling (D-04) | Auto-poll ~10 s, pause on hidden tab (D-07); floor-exempt + one visit-row | 147 | The pinned 063-B vitals can go amber/red while scrolled; polls are silent, one "Opened the Control Plane" row per visit. |
| "Overview" tab (thin health preview) | "Control Plane" landing tab (promoted, D-08) | 147 | Health lives in ONE place; System Controls tab merges INTO Control Plane; locked tabs rename (Users&Access/Model Registry/Secrets). |
| 2 capability flags (web/sandbox) | 5 controls (web/sandbox/self-improve/workflows + maintenance) | 147 | 3 new `app_settings` booleans on the same substrate. |
| Cancel = owner-scoped only (`cancel_run`) | + operator cross-user Kill (shared internals) | 147 | New endpoint, same zombie-heal discipline, victim-naming audit. |

**Deprecated/outdated in the 146 code that 147 supersedes:**
- The `ControlRoomPage.tsx:15-20` "NO auto-polling" honesty beat is REPLACED by D-07 poll+visit-row. The tab labels array (`ControlRoomPage.tsx:68-95`) is re-authored (Overview→Control Plane; System Controls dissolves into Control Plane; locked-tab names change).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "self-improve" kill-switch maps to the `save_skill` tool + the self-improvement proposer path (not a distinct runtime). | D-04 enforcement | If self-improve is a background loop with no single tool seam, the hide/refuse layers won't cover it — planner must locate the actual self-improve trigger (SI-01 Phase 135 / SI-02 Phase 139) and gate there. Verify at plan time. |
| A2 | Workflow producer runs enter `runs:active` via `register_run_start` on the shared `threads.py` POST /messages path (so workflow runs ARE in the list per D-01). | D-01 run-list | If a workflow's producer run is NOT in `runs:active`, the operator list would miss workflow runs; Kill delegation would need `workflow_runs` as the source instead. MEDIUM confidence — the kickoff seam is at `threads.py:1156` but the exact producer-run ZADD wasn't line-traced. |
| A3 | The `~10s` poll cadence and hidden-tab pause use `document.visibilitychange` + a `setInterval` cleared on unmount. | D-07 | Cosmetic — any equivalent works; no external dependency. |
| A4 | Starlette runs `add_middleware` in reverse registration order (last = outermost). | Pattern 6 | If wrong, maintenance/CORS ordering could misbehave on preflight — verify with a quick local test. |
| A5 | The three new flags default to the SAFE value (`*_enabled=true`, `maintenance_mode=false`) so existing behavior is byte-identical until an operator flips one. | Migration 097 | Low — matches the 053 default pattern; a wrong default would change default runtime behavior. |

## Open Questions

1. **Run-kind derivation strategy (D-01) — DECIDE BEFORE PLANNING.**
   - What we know: `runs:active` is fed by chat/workflow/eval (all with a `runs` row) + tuner (NO `runs` row, Redis-only). Kind signals available: (a) the parallel `runs_by_thread:*` key namespace prefix (`runs_by_thread:{tid}` vs `:eval:` vs `:tuner:`), (b) presence/absence of a `runs` row, (c) `threads.active_workflow_run_id` / `workflow_runs` to split chat-vs-workflow.
   - What's unclear: which strategy is cleanest without a schema change.
   - Recommendation: **Option A (no migration, recommended):** ZRANGE `runs:active` WITHSCORES → batch `SELECT run_id, thread_id, user_id, model, provider FROM runs WHERE run_id = ANY($ids)`. Rows found = chat/workflow/eval; split workflow via a join to `workflow_runs`/`threads.active_workflow_run_id`; split eval via the eval-thread marker or an `eval_runs` cross-ref. IDs NOT in the `runs` result = tuner (enrich name from the `runs_by_thread:tuner:{skill_id}` key via a targeted scan, or accept a generic "Tuner job" label with no per-run user). **Option B (migration):** add `runs.kind` — cleanest reads but touches every `insert_run` call site + a migration; heavier. Recommend A unless the planner wants the durable kind for future audit/billing.

2. **Which GET endpoints are floor-exempt, and how is the "Opened the Control Plane" visit-row written (D-07)?**
   - What we know: the floor is opt-in per endpoint; `/admin/me` is the exempt precedent. Writes always floor.
   - Recommendation: exempt `/admin/backpressure` + the new `/admin/runs` from the floor; write the single visit-row via a dedicated tiny floor-attached call on tab-open (or floor the FIRST backpressure fetch of a session only). Decide the exact mechanism in discuss/plan.

3. **Long-running (>8 min) + "not responding" (stalled-stream) thresholds (064-B card tags).**
   - What we know: elapsed = now − score (client math). "Not responding" implies a stalled stream, which the backend's stream-age reconciler already reasons about (`run_reconciler.py:204+`).
   - Recommendation: long-running = pure elapsed threshold (client-side, ~8 min per sketch). "Not responding" = a server-derived signal (stream last-write age); simplest is a backend field on the active-runs row computed from the `run:{id}` stream age — reuse the reconciler's stream-age oracle rather than re-deriving.

4. **Maintenance flag polarity on a COLD cache (fail-closed vs don't-lock-everyone-out).**
   - What we know: kill-switches fail CLOSED (capability off on unknown). But `maintenance_mode` inverts: failing "closed" (=locking the platform) on a cold-cache read would be a self-inflicted outage.
   - Recommendation: read `maintenance_mode` such that a cold-cache/exception yields `false` (platform OPEN) — the last-known-good TTL cache already prevents transient blips from flipping it; only a truly-uninitialized read defaults open. Capability `*_enabled` flags default the safe way for THEIR polarity (a cold read should not silently disable a capability either — default to the migration default `true` / last-known-good). Confirm this nuance with the operator in discuss-phase.

5. **Does "self-improve" have a single enforcement seam? (A1)** — locate the actual trigger (save_skill tool vs a proposer background job) and confirm the D-04 two-layer gate can cover it; if it's a background loop, the gate is a guard at that loop's entry, not a tool seam.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Health probe + `runs:active` reads | ✓ (docker-compose.dev.yml; PING at boot `main.py:230`) | local container | — (a down Redis is exactly what the probe reports) |
| Supabase/Postgres | `app_settings`, `runs` enrichment, `operator_audit_log` | ✓ (Supabase CLI local) | Postgres 15 | — |
| Docker (sandbox) | Sandbox reachability probe | ✓ (Docker Desktop; `docker.from_env()` `sandbox_service.py:103`) | local | Probe reports "off-by-config" when `SANDBOX_ENABLED=false` |
| `@lobehub/icons` | Cross-provider run-card marks | ✓ (installed; locked sketch 048) | in package.json | — |

**Missing dependencies with no fallback:** None — every external the phase probes is already provisioned locally (and probing a *missing* one is the feature, not a blocker).

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (existing `backend/tests/` — unit + integration; `test_146_operator_gate.py` precedent) |
| Frontend framework | Vitest (`frontend/src/__tests__/`; note ~14-17 pre-existing ROT tests — SEED-056, do not attribute to this phase) |
| Backend quick run | `cd backend && venv/Scripts/python -m pytest tests/test_147_*.py -x` |
| Frontend quick run | `cd frontend && npm run test -- MessageItem` (or the new admin components) |
| Full suites | `cd backend && venv/Scripts/python -m pytest` · `cd frontend && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-02 | `/admin/backpressure` carries additive `dependencies.{redis,supabase,sandbox}` with up/down/off + latency | unit | `pytest tests/test_147_health_probe.py -x` | ❌ Wave 0 |
| ADMIN-02 | `GET /admin/runs` returns cross-user active runs with kind badges; tuner rows have no Kill; non-operator → 404 | integration | `pytest tests/test_147_active_runs.py -x` | ❌ Wave 0 |
| ADMIN-02 | `POST /admin/runs/{id}/kill` cancels ANY user's run (no ownership filter); idempotent-terminal 204; zombie-heal; writes `run.kill` naming the victim | integration | `pytest tests/test_147_operator_kill.py -x` | ❌ Wave 0 |
| ADMIN-02 | Shared cancel helper is byte-equivalent for the owner path (regression: `cancel_run` still 404s cross-user) | integration | `pytest tests/test_062_cancel_run.py -x` (extend) | ⚠️ extend existing |
| FLAG-01 | `web/sandbox/self_improve` OFF → tool hidden from `get_tools()` schema (layer 1) | unit | `pytest tests/test_147_flag_hide.py -x` | ❌ Wave 0 |
| FLAG-01 | disabled tool called in-flight → `dispatch_tool` returns plain refusal ToolResult (layer 2); no-op when flags on (Deep byte-identical) | unit | `pytest tests/test_147_flag_refuse.py -x` | ❌ Wave 0 |
| FLAG-01 | `workflows_enabled=false` → new workflow launch refused at kickoff; in-flight unaffected (D-05) | integration | `pytest tests/test_147_workflows_flag.py -x` | ❌ Wave 0 |
| FLAG-01 | maintenance middleware blocks POST/PUT/PATCH/DELETE with 503; allowlist passes auth + /admin/* + DELETE /runs/{id}; GET always passes | integration | `pytest tests/test_147_maintenance_mw.py -x` | ❌ Wave 0 |
| FLAG-01 | flag write invalidates cache; last-known-good on DB read failure (no flip on transient blip) | unit | `pytest tests/test_147_flag_failure_semantics.py -x` | ❌ Wave 0 |
| BUG-260710-01 | cancelled message shows "Response stopped" derived from `runStatus==='cancelled'` after reload | unit (Vitest) | `npm run test -- MessageItem` | ⚠️ extend existing |
| BUG-260710-02 | early-cancel empty-content assistant message renders "cancelled — no output yet", not an empty bubble | unit (Vitest) | `npm run test -- MessageItem` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** the touched module's quick pytest / vitest file.
- **Per wave merge:** full backend pytest + frontend vitest (accepting the known SEED-056 rot baseline).
- **Phase gate:** full suite green (modulo documented rot) before `/gsd:verify-work`, THEN the SC#10 live UAT below.

### Wave 0 Gaps
- [ ] `tests/test_147_health_probe.py` — dependency probes (up/down/off + latency)
- [ ] `tests/test_147_active_runs.py` — cross-user list + kind derivation + tuner-no-Kill
- [ ] `tests/test_147_operator_kill.py` — operator Kill (shared internals, no ownership, victim audit)
- [ ] `tests/test_147_flag_hide.py` / `test_147_flag_refuse.py` — two-layer fail-closed gate
- [ ] `tests/test_147_workflows_flag.py` — D-05 block-new-launches
- [ ] `tests/test_147_maintenance_mw.py` — write-block + allowlist
- [ ] `tests/test_147_flag_failure_semantics.py` — last-known-good / cold-cache polarity
- [ ] Extend `tests/test_062_cancel_run.py` — owner path regression after the refactor
- [ ] Extend `MessageItem` vitest — the two cancelled-render bugs

### SC#10 Live UAT (MANDATORY — active-runs + Kill touch run/stream state)
Per CLAUDE.md UAT scoreboard, VALIDATION.md must carry the 4-axis matrix (authored under VALIDATION.md, NOT PLAN.md tasks):
- **Cross-provider:** operator active-runs list shows OpenAI / Anthropic / Google / OpenRouter runs side-by-side with correct `@lobehub` marks + live-ticking elapsed; Kill each and confirm the victim sees exactly a self-cancel (D-03).
- **Multi-tool:** a run using 2+ tools (e.g. `search_documents` + `execute_code`) appears once with an honest activity line; killing it mid-tool cancels cleanly.
- **Parallel-thread:** Thread A streaming while operator Kills a DIFFERENT user's run in Thread B — no cross-run leak; A unaffected.
- **Long-message:** a ≥50-message / ≥5 KB run appears with correct elapsed; the "long-running >8min" + "not responding" tags render on the right rows.
- **Flag axis:** flip each kill-switch and confirm the disabled capability stops for a live chat within the TTL window (both layers); flip maintenance ON and confirm end-user writes 503 + banner while reads + self-cancel still work; flip OFF and confirm recovery.

## Security Domain

> `security_enforcement` is not disabled in config — this section is REQUIRED. This phase adds cross-user read/write surfaces and a platform-wide state switch; the threat model is real.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | All operator surfaces on ONE default-deny router; NO RLS backstop → the gate is the sole authority. |
| V4 Access Control | **yes (headline)** | `require_operator` router gate (404-non-discoverable); operator Kill deliberately skips ownership but ONLY behind the operator gate; cross-user reads (active-runs, victim naming) explicitly operator-scoped. |
| V5 Input Validation | yes | `run_id` is a typed `UUID` path param; flag writes go through `save_app_settings` allowlist (column names are code constants, `main.py:97-121` — SQLi-safe). |
| V7 Error Handling & Logging | yes | `operator_audit_log` append-only free-text action; T-073-04 discipline (never log message content/tracebacks — short reason strings only). |
| V11 Business Logic | yes | Maintenance write-block allowlist MUST keep the off-switch reachable (Pitfall 4); idempotent-terminal Kill (no double-cancel side effects). |
| V6 Cryptography | no | No secrets handled here (that's Phase 150). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-operator reaches an operator endpoint (cross-user data / kill) | Elevation of Privilege | Join the `admin.py` router (`Depends(require_operator)`); byte-identical 404. NEVER a new router. |
| Operator endpoint leaks run existence to non-operators | Information Disclosure | 404-non-discoverable on missing/forbidden (same as `cancel_run` Step 1). |
| Maintenance lock-out (off-switch blocked) | Denial of Service (self-inflicted) | Allowlist auth + all `/admin/*` + DELETE `/runs/{id}`; cold-cache defaults OPEN (Q4). |
| A disabled capability still callable in-flight (fail-open) | Tampering / policy bypass | Two-layer gate: hide from schema AND refuse at `dispatch_tool` (fail-CLOSED). |
| Transient DB blip flips a flag → outage | Denial of Service | Last-known-good TTL cache (`user_settings.py:233-241`) — a read failure returns the prior value, never "unknown". |
| SQL injection via flag/settings write | Tampering | Column names are code-constant allowlists (`main.py:97-121`); values parameterized (`user_settings.py:274-287`). |
| Operator attribution leaked into victim's chat | Information Disclosure (privacy) | D-03: victim sees exactly a self-cancel; who/why ONLY in `operator_audit_log`. |
| Blocking I/O in async middleware stalls all requests | Denial of Service | TTL-cached async read; `run_in_threadpool` for any supabase-py call (D-v2.5-01). |

## Sources

### Primary (HIGH confidence — verified in the live codebase this session)
- `backend/app/api/admin.py:37-138` — the 146 operator router (`require_operator`, `operator_audit_floor`, `/backpressure` already ZCARDs `runs:active`, `/me` no-floor precedent).
- `backend/app/api/runs.py:1092-1265` — `cancel_run` full internals (Step 1 ownership SELECT, Step 2 idempotent-terminal, Step 3a happy path + PUBLISH-first sentinel, Step 3b zombie-heal + `finalize_run_terminal` + SETNX cancel-lock + EXPIRE).
- `backend/app/services/run_lifecycle.py:1-155` — `register_run_start`/`finalize_run_terminal`; the "runs:active is CHAT-SCOPED, tuner/eval writers NOT migrated" authority model; score = unix start time.
- `backend/app/models/user_settings.py:204-666` — the 30 s per-worker TTL cache, last-known-good failure semantics, `_val_bool`, `save_app_settings` + `invalidate_settings_cache`, `document_management_enabled()` default-ON polarity template.
- `backend/app/services/openai_service.py:1025-1051` — `get_tools()` HIDE layer (web/sandbox conditional append).
- `backend/app/services/tool_dispatcher.py:3189-3279` — `_TOOL_REGISTRY`, `dispatch_tool`, the Phase-091 whitelist no-op + plain-ToolResult refuse precedent.
- `backend/app/services/agent_loop.py:1356-1369` — the disabled-tools system-prompt note (web_search/execute_code precedent).
- `backend/app/api/evals.py:300-317` — eval run creates a `runs` row (`insert_run`) THEN ZADDs `runs:active` + `runs_by_thread:eval:{skill_id}`.
- `backend/app/api/skill_tuner.py:733-740` — tuner run ZADDs `runs:active` + `runs_by_thread:tuner:{skill_id}` with NO `runs` row.
- `backend/app/api/threads.py:298, 909-1164` — `run_status` populated from the joined runs row on message load; the workflow kickoff seam (`create_workflow_run`, D-05 enforcement point).
- `backend/app/main.py:97-121, 217-471, 464-471` — `_DIRECT_COLUMNS` allowlist (incl. `web_search_enabled`/`sandbox_enabled`), lifespan (Redis PING, sweeps), `add_middleware(CORSMiddleware)` site, `assert_action_types_synced` general-audit drift guard (`:265`).
- `backend/app/dependencies.py:201-256` — `require_operator` (404-non-discoverable) + `operator_audit_floor` (per-endpoint yield-dependency, method-derived is_write).
- `supabase/migrations/035_runs_table.sql` — runs schema (NO kind column); `053_settings_unification.sql:18-19` — the web/sandbox boolean-column pattern; `095_operator_foundation.sql:14-15,42` — free-text `operator_audit_log.action` (no CHECK).
- `frontend/src/components/admin/ControlRoomPage.tsx` + `HealthSignals.tsx` — the 146 shell + health leaf to recompose.
- `frontend/src/components/chat/MessageItem.tsx:451,456-457,570-574` + `StreamsProvider.tsx:1941` + `types/index.ts:163-164` + `api.ts:3520-3560` — the cancelled-render path (BUG-260710 root cause) and the additive BackpressureSignals type.
- `.planning/sketches/063|064|065|066/README.md` — the LOCKED UI contracts (pinned vitals, victim-naming confirm sheet, armed-OFF card grid + separated maintenance, the assembled linkage contract).
- `.planning/REQUIREMENTS.md:23-25,70` — ADMIN-02 / FLAG-01 text + the explicit flag-SaaS rejection.
- `.planning/config.json` — `nyquist_validation: true`, no `security_enforcement: false`.

### Secondary (MEDIUM confidence)
- `backend/app/services/harness_engine.py:1445-1610` — workflow producer-run / `producer_run_id` minting (used to reason about A2 — workflow runs in `runs:active`; not fully line-traced end-to-end).
- `backend/app/services/run_reconciler.py:149-320` — stream-age oracle (candidate source for the "not responding" tag).

### Tertiary (LOW confidence)
- The "self-improve" enforcement seam (A1/Q5) — inferred to be `save_skill`/proposer; not yet pinned to a single line.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is already installed and running; zero new deps.
- Architecture / seams: HIGH — every integration point verified at file:line.
- Run-kind derivation (D-01): MEDIUM — the four writers are confirmed, but the chosen derivation strategy is an open design decision (Q1).
- Fail-closed flag semantics: HIGH — the TTL cache + last-known-good behavior is verified; only the maintenance cold-cache polarity (Q4) needs an operator confirmation.
- Bug root causes (BUG-260710-01/-02): HIGH — traced live/reload divergence to `MessageItem.tsx:570` + `StreamsProvider.tsx:1941`.

**Research date:** 2026-07-11
**Valid until:** ~2026-08-10 (stable — internal codebase, no fast-moving external deps; re-verify only if `runs.py`/`run_lifecycle.py`/`admin.py` change before planning).
