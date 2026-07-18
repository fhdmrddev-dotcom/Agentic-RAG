# Phase 146: Operator Foundation - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 18 (backend 5 · migrations 2 · frontend 6 · tests 4 · config/docs 1)
**Analogs found:** 17 / 18 (1 composite — the audit-floor yield-dependency has no existing yield-dep, composed from two shipped precedents)

> This phase is **pure integration onto shipped substrate** (RESEARCH: "zero new packages"). Every hard part already has a file:line precedent in this repo. The risk is failing to reuse the pattern and re-opening a solved security/concurrency hole. Copy from the analogs below verbatim; do not invent new shapes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/admin.py` (MODIFY) | route/controller | request-response | itself (existing router at `:21`) + `dependencies.py:103` | exact (self-upgrade) |
| `backend/app/dependencies.py` (MODIFY — add `require_operator`, `operator_audit_floor`) | middleware (FastAPI dep) | request-response | `get_current_user` (`dependencies.py:103`) | exact (same file, same shape) |
| `backend/app/services/operator_service.py` (NEW) | service | CRUD (membership read · audit write · seed upsert) | `backend/app/services/audit_service.py` | exact (role + write-swallow flow) |
| `backend/app/main.py` (MODIFY — seed in lifespan) | config/startup lifecycle | batch (per-worker startup) | `_migrate_settings_override` (`main.py:124`) + lifespan blocks (`main.py:237-269`) | exact (same file) |
| `backend/app/config.py` (MODIFY — add `operator_emails`, delete `backpressure_admin_user_ids`) | config | — | `backpressure_admin_user_ids` (`config.py:900`) | exact (same field family) |
| `supabase/migrations/095_operator_foundation.sql` (NEW) | migration | schema/DDL | `059_harness_audit_and_threads_col.sql` | exact (append-only audit table) |
| `supabase/migrations/096_org_id_stub_sweep.sql` (NEW) | migration | schema/DDL | `059_…sql:19,36-37` (org_id stub + COMMENT) | exact (same stub idiom) |
| `frontend/src/App.tsx` (MODIFY — add `"control-room"` to union + probe state) | provider/root | event-driven (ActiveView) | itself (`App.tsx:10-14,26-37`) | exact (self-extend) |
| `frontend/src/components/layout/ChatLayout.tsx` (MODIFY — add render branch) | layout/component | request-response | itself (`ChatLayout.tsx:321-343` governance/studio branches) | exact (same file) |
| `frontend/src/components/layout/NavPanel.tsx` (MODIFY — probe-gated shield in footer, NOT NAV_ITEMS) | component | request-response | footer buttons (`NavPanel.tsx:414-471`) + nav map (`:287-318`) | exact (same file) |
| `frontend/src/components/admin/ControlRoomPage.tsx` + sub-components (NEW) | component (page shell) | request-response | `frontend/src/pages/SkillStudioPage.tsx` | role-match (band+tabs+fetch-once) |
| `frontend/src/lib/api.ts` (MODIFY — `getOperatorProbe`/`getBackpressure`/`getOperatorAudit`) | utility (API client) | request-response | `getTunerLatest` (`api.ts:3388`, 404→null) + `listThreads` (`api.ts:46`) | exact |
| `frontend/src/hooks/useOperatorProbe.ts` (NEW) | hook | request-response (one-shot mount) | `frontend/src/hooks/useSkills.ts:23-39` | role-match |
| `backend/tests/test_146_operator_gate.py` (NEW) | test | — | `backend/tests/test_audit.py` | exact (client/mock idiom) |
| `backend/tests/test_146_operator_seed.py` (NEW) | test | — | `conftest.py` `_MockAsyncpgPool` (`:448-513`) | exact (recorder pool) |
| `backend/tests/conftest.py` (MODIFY — `require_operator` override helper) | test config | — | existing `dependency_overrides` (`conftest.py:80-97`) | exact (same file) |
| `frontend/src/…/useOperatorProbe.test.ts` (NEW) | test | — | (no vitest hook-test analog located — see No Analog) | none |
| `backend/.env.example` (MODIFY — add `OPERATOR_EMAILS`) | config/docs | — | (env var family; no code excerpt needed) | trivial |

> **NOT modified (deliberate):** `frontend/src/lib/nav-items.ts` — the shield is probe-gated and rendered OUTSIDE `NAV_ITEMS`. Adding it to that array (which `NavPanel.tsx:287` AND `ChatLayout.tsx:234` both map) would show the shield to every user and break D-07 byte-identity. The sketch-061 README's "extends NAV_ITEMS conditionally" is superseded by CONTEXT D-07.

---

## Pattern Assignments

### `backend/app/api/admin.py` (route/controller, request-response) — MODIFY

**Analog:** itself (the existing `/admin` router) + `get_current_user`. The whole file is the surface being upgraded (D-02).

**What exists today — the gate to DELETE** (`admin.py:24-49`, `_check_backpressure_auth` env-var fail-open) and its consumer (`admin.py:52-54`):
```python
def _check_backpressure_auth(current_user: dict = Depends(get_current_user)) -> dict:
    env = settings.environment.lower()
    is_production = env in ("production", "prod")
    allow_ids_raw = settings.backpressure_admin_user_ids.strip()
    if not allow_ids_raw:
        if is_production:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin endpoint not configured")
        return current_user            # DEV FAIL-OPEN — delete this entirely (D-02)
    ...
@router.get("/backpressure")
async def get_backpressure(_user: dict = Depends(_check_backpressure_auth)):  # ← swap dep for router-level gate
```

**Router declaration to CHANGE** (`admin.py:21`) — add the router-level dependency (this is the single load-bearing security line):
```python
# BEFORE
router = APIRouter(prefix="/admin", tags=["admin"])
# AFTER (Pattern 1 — default-deny at the router, not per-endpoint)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
```

**Backpressure handler body is UNCHANGED** — `admin.py:64-99` already emits the four real signals (`anyio_threadpool_depth`, `redis_active_runs`, `postgres_pool_in_use`, `per_worker_run_count`). Only its `Depends(_check_backpressure_auth)` param is removed (the router gate now covers it), and the per-action `operator_audit_floor` yield-dep is attached to it (NOT to the router, NOT to `/admin/me` — Pitfall 4). The four raw keys map to the four plain labels in the frontend (Server capacity · Agents working · Database connections · Work spread).

**New endpoints to add** (both inherit the router gate): `GET /admin/me` (probe — floor-EXEMPT, returns operator identity `{id,email,granted_at}`) and `GET /admin/audit` (recent operator actions for the ledger feed — floor-attached).

---

### `backend/app/dependencies.py` (middleware/FastAPI dependency, request-response) — MODIFY

**Analog:** `get_current_user` (`dependencies.py:103-114`) — the JWT dep `require_operator` composes on top of.

**Compose-on-top pattern** (`dependencies.py:103-114`, copy the `Depends(get_current_user)` + 401-shape idiom):
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
```

**`require_operator` shape to build** (RESEARCH Pattern 1 — byte-identical 404, decompose the membership check into an overridable `is_operator` sub-dep so conftest can drive both branches — Pitfall 6):
```python
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")  # byte-identical to Starlette's unknown-route 404

async def require_operator(request: Request, current_user: dict = Depends(get_current_user)):
    if not await is_operator(current_user["id"]):   # SELECT 1 FROM operator_users … (delegates to operator_service)
        raise _NOT_FOUND                             # 404-not-403 = non-discoverable
    request.state.operator = current_user
    return current_user
```

**Where `is_operator` reads the pool:** reuse `get_pg_pool()` (`dependencies.py:74-100`, the singleton asyncpg pool) exactly as `_migrate_settings_override` does. Parameterize the lookup (`WHERE user_id = $1`) — never f-string SQL (matches `coerce_uid` discipline, `utils/db.py:33`).

---

### `backend/app/services/operator_service.py` (service, CRUD) — NEW

**Analog:** `backend/app/services/audit_service.py` — the audit-write service (swallow-on-error, `aexec` off-loop). This new file keeps `admin.py`/`dependencies.py` thin (RESEARCH recommended structure).

**Audit write MUST swallow (never break the request)** — copy `write_audit_entry` (`audit_service.py:57-74`) verbatim in shape:
```python
async def write_audit_entry(user_id, action_type, metadata, supabase) -> None:
    """Exceptions are caught, logged to stderr, and swallowed (D-05)."""
    try:
        await aexec(supabase.table("audit_log").insert({
            "user_id": user_id, "action_type": action_type, "metadata": metadata,
        }))
    except Exception as exc:
        logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```
Note: the operator-audit table has MORE columns than `audit_log` (`action`, `label`, `is_write`, `target_type`, `target_id`, `metadata`, `org_id`) — same insert-then-swallow shape, wider payload.

**Off-loop wrap** — use `aexec` (`utils/db.py:47-59`), which is just `run_in_threadpool(query.execute)` (D-v2.5-01, Pitfall 5 — never block the loop on `.execute()`).

**Seed function** (`seed_operators_from_env()`) — see the main.py assignment below; it lives here, called from lifespan.

---

### `backend/app/main.py` (startup lifecycle, batch) — MODIFY

**Analog:** `_migrate_settings_override` (`main.py:124-214`) — the multi-worker-safe idempotent startup-write precedent, and the lifespan try/except block wrapping (`main.py:237-243`).

**Idempotent-write precedent** (`main.py:193-208`) — copy the pool-execute + best-effort try/except:
```python
from app.dependencies import get_pg_pool
try:
    pool = await get_pg_pool()
    await pool.execute(query, *values)          # parameterized; column names from code constants, not user input
except Exception as e:
    logger.error("settings migration: DB write failed: %s", e)
    return                                       # D-03: never blocks startup
```

**Lifespan wiring precedent** (`main.py:237-243`) — the exact block the seed call mirrors (best-effort, logs + continues):
```python
from app.dependencies import get_pg_pool
try:
    await get_pg_pool()                          # ensure pool exists before the write
    await _migrate_settings_override()
except Exception as e:
    logger.error("Settings migration failed (app continues with file fallback): %s", e)
```

**Seed to add** (RESEARCH Pattern 3 — `ON CONFLICT DO NOTHING` = concurrent-safe under `WORKER_COUNT=2`; resolve `auth.users` by lowercased email; `granted_by=NULL` = env-bootstrap provenance; missing email logs a warning, not an error):
```python
async def seed_operators_from_env():
    emails = [e.strip().lower() for e in settings.operator_emails.split(",") if e.strip()]
    if not emails:
        return
    pool = await get_pg_pool()
    rows = await pool.fetch("SELECT id, email FROM auth.users WHERE lower(email) = ANY($1::text[])", emails)
    for r in rows:
        await pool.execute(
            "INSERT INTO operator_users (user_id, granted_by, note) VALUES ($1, NULL, 'env-bootstrap') "
            "ON CONFLICT (user_id) DO NOTHING", r["id"])
```
Call it in the lifespan after `get_pg_pool()`, wrapped in the same try/except-logs-and-continues shape shown above.

---

### `backend/app/config.py` (config) — MODIFY

**Analog:** the field being deleted (`config.py:896-900`):
```python
# Backpressure admin endpoint (Phase 078 — D-078-07 WORKER-LIFT-04)
backpressure_admin_user_ids: str = ""    # ← DELETE (D-02); also delete its comment block :896-900
```
**Add** `operator_emails: str = ""` in the same pydantic-settings style. `OPERATOR_EMAILS` is legitimately env (bootstrap/infra), not an `app_settings` value (CLAUDE.md settings-vs-env rule). `environment` (`config.py:905`) can stay — it is used elsewhere. Also add `OPERATOR_EMAILS` to `backend/.env.example`; the old var was never in `.env.example` (RESEARCH Runtime State Inventory), so no removal there.

---

### `supabase/migrations/095_operator_foundation.sql` (migration, schema/DDL) — NEW

**Analog:** `supabase/migrations/059_harness_audit_and_threads_col.sql` — the append-only audit-table precedent.

**Copy these exact idioms from 059:**
- **PLAIN uuid, NO FK on the audit's actor** (`059:16`) — `run_id uuid, -- PLAIN stored uuid, NO FK — audit survives run deletion (NEVER CASCADE)`. Apply to `operator_audit_log.operator_user_id` (Anti-pattern: no FK CASCADE, or deleting an operator erases their history).
- **`org_id` forward-compat stub** (`059:19`) — `org_id uuid, -- D-11 forward-compat, nullable, NO FK` + the COMMENT (`059:36-37`).
- **RLS-enabled** (`059:43`) — `ALTER TABLE … ENABLE ROW LEVEL SECURITY;`. **STRICTER than 059:** 059 had owner SELECT+INSERT policies (`059:45-51`); the two operator tables ship RLS-enabled with **NO policies** = deny-all (only the service-role backend behind `require_operator` reads them).
- **text (NOT Postgres ENUM)** (`059:21`) — the harness table used `text + CHECK`; RESEARCH A4 recommends `operator_audit_log.action` be **free-text, NO CHECK** (the auto-floor derives an action per route; a CHECK would force a migration per new admin action, fighting D-03's by-construction goal). `label` (plain sentence) is the human-facing field.

DDL to author (RESEARCH Schema §Migration 095): `operator_users(user_id PK → auth.users ON DELETE CASCADE, granted_at, granted_by, note)` + `operator_audit_log(id, operator_user_id plain-uuid, action free-text, label, is_write bool, target_type, target_id, metadata jsonb, org_id, created_at)` + `idx_operator_audit_created ON (created_at DESC)` for feed order.

---

### `supabase/migrations/096_org_id_stub_sweep.sql` (migration, schema/DDL) — NEW

**Analog:** the `org_id` stub column + COMMENT in `059:19,36-37` (bare nullable column, no FK, no index, no backfill).

Split from 095 so the operator tables ship/rollback independently. **Target list (RESEARCH A3, VERIFIED against `full-schema.sql`):** `documents`, `folders`, `threads`, `skills` — the four unambiguous owned roots. Child tables (messages, chunks, skill_files…) inherit org via parent FK — do NOT stub them. `user_memory`/eval/tuner = planner call, default DEFER.
```sql
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id uuid;
COMMENT ON COLUMN public.documents.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
-- repeat for folders/threads/skills
```
**INDEX TENSION (RESEARCH flag):** the DM-era `org_id` columns added `idx_*_org_id`; `harness_audit.org_id` did NOT. D-05 follows the **harness_audit** precedent — bare column + COMMENT only, **NO index**. Do not "helpfully" add indexes.

**Apply rules (CLAUDE.md):** paste each into the Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (live dump, no reset). Filenames `095_…`, `096_…` — no letter suffixes (`007b` is silently skipped). Cloud parity: paste both into cloud Supabase SQL editor at promotion.

---

### `frontend/src/App.tsx` (root/provider, event-driven) — MODIFY

**Analog:** itself — the `ActiveView` union (`App.tsx:10`) and the per-view state+navigator pattern for Skill Studio (`App.tsx:26-37`).

**Union to extend** (`App.tsx:10`):
```tsx
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-studio"
// ADD: | "control-room"
```
**Per-view state precedent** (`App.tsx:26-32`) — App holds the selection/entry state and threads it to ChatLayout (the reachability triad: union + ChatLayout mount branch + entry action, all owned in-phase — the Phase-118 built-but-unreachable lesson):
```tsx
const [studioSkillId, setStudioSkillId] = useState<string | null>(null)
const handleOpenStudio = (skillId, tab = "evals") => { setStudioSkillId(skillId); setStudioTab(tab); setActiveView("skill-studio") }
```
For 146: hold the probe result (`isOperator`, `identity`) via `useOperatorProbe` at App level (or ChatLayout) so both the NavPanel shield and the ControlRoomPage read one source. No router — navigation stays a `useState<ActiveView>` switch (sketch 023-A).

---

### `frontend/src/components/layout/ChatLayout.tsx` (layout/component, request-response) — MODIFY

**Analog:** itself — the `activeView === …` render branches (`ChatLayout.tsx:295-346`).

**Render-branch precedent** (`ChatLayout.tsx:321-343`, governance + skill-studio — add a `control-room` branch BEFORE the trailing `KnowledgeHealthPage` else, exactly like these):
```tsx
) : activeView === "governance" ? (
    <GovernancePage />
) : activeView === "skill-studio" ? (
    <SkillStudioPage skillId={studioSkillId} tab={studioTab} onTabChange={onStudioTabChange} onBack={() => onNavigate("skills")} />
) : (
    <KnowledgeHealthPage />
)
```
The Control Room is a full-surface (like governance/studio), NOT the chat|panel grid — it renders in the `<main className="flex-1 overflow-hidden">` non-chat branch (`ChatLayout.tsx:296`).

---

### `frontend/src/components/layout/NavPanel.tsx` (component, request-response) — MODIFY

**Analog:** the footer buttons in the same file (`NavPanel.tsx:414-471`, theme + sign-out) — a probe-gated shield belongs here, rendered as a SEPARATE element, NOT in the `NAV_ITEMS.map` (`:287-318`).

**Footer-button + collapsed-tooltip idiom to copy** (`NavPanel.tsx:435-467`):
```tsx
const signOutButtonContent = (
  <button onClick={onSignOut} className={cn("flex items-center gap-3 h-10 px-2.5 …", isCollapsed ? "w-10" : "w-full")}>
    <LogOut className="w-5 h-5 shrink-0" />
    <span className={cn("text-sm whitespace-nowrap …", isCollapsed ? "opacity-0" : "opacity-100")}>Sign out</span>
  </button>
)
{isCollapsed ? (
  <Tooltip delayDuration={0}><TooltipTrigger asChild>{signOutButtonContent}</TooltipTrigger>
    <TooltipContent side="right" className="ml-2">Sign out</TooltipContent></Tooltip>
) : signOutButtonContent}
```
**Shield specifics (D-07, sketch 061-B):** render ONLY when `isOperator` (probe result) is true — a non-operator's rail is byte-identical to today. Use lucide **`Shield`** + amber tint — DISTINCT from Governance's `ShieldCheck` (which is already in `NAV_ITEMS` at `nav-items.ts:39`). Clicking sets `activeView="control-room"`. The same shield must also be added to the mobile drawer's bottom icon row (`ChatLayout.tsx:233-256`) if the operator must reach it on mobile — but again as a separate probe-gated element, NOT via `NAV_ITEMS`.

---

### `frontend/src/components/admin/ControlRoomPage.tsx` + sub-components (component/page shell) — NEW

**Analog:** `frontend/src/pages/SkillStudioPage.tsx` — a full-surface with a persistent header band + horizontal tab bar + fetch-once-on-entry, no router. This is the closest structural match for the 061-B shell (amber band + horizontal section tabs).

**Header-band + tab-bar structure to copy** (`SkillStudioPage.tsx:130-187`):
```tsx
<div className="flex h-full flex-col overflow-hidden">
  <header className="flex shrink-0 flex-col gap-3 border-b border-border/10 px-8 pt-6 pb-3">
    <button onClick={onBack} className="… inline-flex items-center gap-1 text-sm text-muted-foreground …">
      <ChevronLeft className="h-4 w-4" /> Skills          {/* → "‹ Back to app" in 146 */}
    </button>
    <div className="flex items-center gap-2.5">
      <Sparkles className="h-5 w-5 text-primary" />        {/* → amber Shield + "Control Room" + OPERATOR chip + identity + recording marker */}
      <h1 className="font-headline text-xl font-bold …">{skill?.name}</h1>
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold …">LIVE</span>  {/* → amber OPERATOR chip */}
    </div>
    <nav className="flex items-center gap-1" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === tab} onClick={() => onTabChange(t.id)}
          className={cn("rounded-md px-3 py-1.5 text-sm …", active ? "bg-primary/10 font-semibold text-primary" : "…")}>
          {t.label}
        </button>
      ))}
    </nav>
  </header>
  <div className="flex-1 overflow-y-auto">{/* active tab body */}</div>
</div>
```
**Fetch-once-per-entry idiom** (`SkillStudioPage.tsx:66-94`) — independent guarded reads on mount, each `.catch(() => {})` so one failure never nukes the others:
```tsx
const [gate, setGate] = useState(null); const [cases, setCases] = useState([])
useEffect(() => {
  getPublishGate(skillId).then((g) => alive() && setGate(g)).catch(() => {})
  listTestCases(skillId).then((c) => alive() && setCases(c)).catch(() => {})
}, [skillId])
```
For 146: on entry, fetch `getBackpressure()` (health) + `getOperatorAudit()` (ledger feed). The ↻ Refresh button re-runs `getBackpressure()` AND visibly prepends the "Viewed system health" row (D-04 honesty beat — the refresh itself is a recorded action; re-fetch `getOperatorAudit()` after so the new floor row appears, and it must survive a page reload because it lives in `operator_audit_log`, not client state — D-09 scenario 3).

**Day-one tabs (D-07):** Overview (health + ledger) + Audit LIVE; System Controls / Users & Access / AI Models / API Keys render `LockedTab` with "Not built yet — coming soon" — NEVER a phase number in shipped copy. All copy plain-first with an "⌥ Technical names" toggle (`TechnicalNamesToggle`) revealing raw field names (`anyio_threadpool_depth` etc.). Sub-components to build: `OperatorBand`, `HealthSignals`, `RecentActionsCard`, `LockedTab`, `TechnicalNamesToggle`. **Sketch-driven specifics (no code analog) live in** `.planning/sketches/061-control-room-shell/` and `.planning/sketches/062-gate-honesty-and-receipts/` — read those for exact copy/layout/animation (row-slides-in receipt, marker flash, ✎ write mark).

---

### `frontend/src/lib/api.ts` (utility/API client, request-response) — MODIFY

**Analog:** `getTunerLatest` (`api.ts:3388-3394`) for the **probe** (404→null, not a thrown error) and `listThreads` (`api.ts:46-51`) for the plain authed GET.

**404→null idiom for the probe** (`api.ts:3388-3394`) — the probe treats 404 as "not an operator, render nothing":
```tsx
export async function getTunerLatest(skillId: string): Promise<LatestTunerRun | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/latest`, { headers })
  if (res.status === 404) return null                      // ← getOperatorProbe: 404 → null (non-operator)
  if (!res.ok) throw new ApiError("…", res.status)
  return (await res.json()) as LatestTunerRun
}
```
**Plain authed GET idiom** (`api.ts:46-51`) for `getBackpressure()` + `getOperatorAudit()`:
```tsx
export async function listThreads(): Promise<Thread[]> {
  const headers = await getAuthHeaders()               // getAuthHeaders() at api.ts:29-37 — Bearer token from supabase session
  const res = await fetch(`${API_BASE}/threads`, { headers })
  if (!res.ok) throw new Error("Failed to list threads")
  return res.json() as Promise<Thread[]>
}
```
There is currently **NO** `getBackpressure` in `api.ts` (grep confirmed) — the `/admin/backpressure` endpoint has never had a frontend consumer; 146 adds the first. Add `getOperatorProbe(): Promise<OperatorIdentity | null>`, `getBackpressure()`, `getOperatorAudit()`.

---

### `frontend/src/hooks/useOperatorProbe.ts` (hook, request-response) — NEW

**Analog:** `frontend/src/hooks/useSkills.ts:23-39` — the fetch-on-mount hook shape (`useState` + `useCallback` loader + `useEffect(() => { load().catch(...) }, [load])`).
```tsx
export function useSkills(): UseSkills {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const loadSkills = useCallback(async () => {
    setLoading(true)
    try { setSkills(await listSkills()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadSkills().catch(console.error) }, [loadSkills])
  ...
}
```
For 146: a one-shot probe on mount → `{ isOperator: boolean, identity: OperatorIdentity | null, loading }`. `getOperatorProbe()` returns null on 404 → `isOperator=false`. The probe result decides **rendering only**; the 404 gate is the security authority (Pitfall 13 — a forged `isOperator=true` still gets 404 on every `/admin` call). The probe endpoint is floor-EXEMPT (Pitfall 4 — mount probes must not spam the ledger).

---

### `backend/tests/test_146_operator_gate.py` (test) — NEW

**Analog:** `backend/tests/test_audit.py` — the `client` + `auth_headers` + `mock_execute_result` + `mock_builder` idiom for gated endpoints.

**Idiom to copy** (`test_audit.py:4-16` — set `mock_execute_result.data`, hit the route via `client.get(..., headers=auth_headers)`, assert on status + body):
```python
def test_list_audit_logs_returns_paginated(client, auth_headers, mock_execute_result, mock_builder):
    mock_execute_result.data = [ {...} ]
    res = client.get("/audit-logs?page=1&page_size=50", headers=auth_headers)
    assert res.status_code == 200
```
**Drive the non-operator branch** by patching `app.dependencies._pg_pool` → `mock_asyncpg_pool` with `set_fetchrow_result(None)` (CORRECTED at plan-check: the membership read is asyncpg via `get_pg_pool()` — the supabase builder mock has NO effect on it; `tests/unit/test_lifespan.py:35` idiom). **Drive the operator-present branch** via `app.dependency_overrides[require_operator] = lambda: {"id": "op-1", …}` (conftest `dependency_overrides` idiom, `conftest.py:80`). Tests to author (RESEARCH Code Examples): route-enumeration 404 (`test_every_admin_route_404s_for_non_operator`), byte-identity vs unknown route (`test_admin_404_matches_unknown_route_404`), operator-reachable (`test_backpressure_reachable_for_operator`), floor-writes-once-but-probe-does-not (assert on the shared Supabase mock `insert` call).

**Note conftest global override (Pitfall 6):** `conftest.py:80` globally overrides `get_current_user` → a fixed mock user. Decompose the membership check into an overridable `is_operator`/`get_operator` sub-dep (`dependencies.py`) so the non-operator branch is expressible via the patched asyncpg mock pool (`set_fetchrow_result(None)`); `mock_execute_result` stays for audit-WRITE assertions only (the write path is supabase-py).

---

### `backend/tests/test_146_operator_seed.py` (test) — NEW

**Analog:** `conftest.py` `_MockAsyncpgPool` / `mock_asyncpg_pool` fixture (`conftest.py:448-513`) — the recording pool whose `.calls` lists every `(sql, args)` in order.

**Recorder-pool idiom** (`conftest.py:448-513`): drive `seed_operators_from_env()` with a `_MockAsyncpgPool`, set `set_fetch_result([{id, email}])` for the `auth.users` resolve, then assert the `INSERT … ON CONFLICT (user_id) DO NOTHING` SQL appears in `pool.calls` and that a second seed run produces no duplicate write (idempotence under concurrent startup).

---

### `backend/tests/conftest.py` (test config) — MODIFY

**Analog:** the existing `dependency_overrides` registration in the same file (`conftest.py:80-97`):
```python
app.dependency_overrides[get_current_user] = lambda: mock_user_data
app.dependency_overrides[get_supabase] = lambda: _supabase
```
Add a `require_operator` override helper (operator-present path) and confirm patching `app.dependencies._pg_pool` → `mock_asyncpg_pool` (`set_fetchrow_result(None)`) drives the non-operator branch. No new framework — pytest + the existing asyncpg recorder fixture suffice. The autouse `reset_mocks` fixture (`conftest.py:86-134`) must restore any new override so tests don't contaminate each other.

---

## Shared Patterns

### Router-level default-deny gate (the ONE security keystone)
**Source:** RESEARCH Pattern 1 · composes `dependencies.py:103` · applied at `admin.py:21`
**Apply to:** the `/admin` router — attach `require_operator` at the router level, NEVER per-endpoint (a per-endpoint gate is one forgotten `@router.get` away from a full-tenant leak; the backend runs on the service-role key with NO RLS backstop — Pitfall 1). 404-not-403 = non-discoverable.
```python
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")  # byte-identical to Starlette unknown-route 404
```

### Audit write that can NEVER break the request (swallow-on-error)
**Source:** `backend/app/services/audit_service.py:57-74` + `backend/app/utils/db.py:47-59` (`aexec`)
**Apply to:** every operator-audit write (the floor + any 147+ enrich). Off-loop via `run_in_threadpool`/`aexec`; try/except → log → swallow. A failed write logs LOUDLY, never silently drops (Repudiation mitigation).
```python
try:
    await aexec(supabase.table("operator_audit_log").insert({...}))
except Exception as exc:
    logger.error("operator audit write failed: %s", exc)   # swallow (D-05 precedent)
```

### Audit-floor yield-dependency (COMPOSITE — no existing yield-dep analog)
**Source:** composed from the swallow pattern above + `aexec` off-loop; NO existing yield-dependency exists in this codebase (this is the one genuinely new micro-shape).
**Apply to:** each per-action `/admin` endpoint (backpressure, audit, every 147+ write) — attach `Depends(operator_audit_floor)` at the **endpoint**, NOT the router (so the mount-probe `/admin/me` stays floor-EXEMPT — Pitfall 4). The yield-teardown runs AFTER the response (off the latency path), reads an enrich-`label`/`action`/`is_write` from `request.state`, writes exactly ONE append-only row (no UPDATE — preserves immutability). Views auto-derive a plain label ("Viewed system health"); write-endpoints set `request.state.audit_label` ("Turned ON maintenance mode"). Receipts are plain sentences, never action codes (062-A).

### Multi-worker-safe idempotent startup seed
**Source:** `backend/app/main.py:124-214,237-243` (`_migrate_settings_override` + its lifespan block)
**Apply to:** `seed_operators_from_env()` in lifespan. `INSERT … ON CONFLICT DO NOTHING` = concurrent-safe by construction under `WORKER_COUNT=2` (both workers race, first wins, second no-ops). Parameterized SQL (`$1::text[]`), never f-string. Wrapped best-effort — a seed failure logs and the app continues.

### Reachability triad (build-it-AND-wire-it in-phase)
**Source:** `App.tsx:26-32` + `ChatLayout.tsx:321-343` + `nav-items.ts`/probe-gated entry
**Apply to:** the Control Room surface — the ActiveView union entry, the ChatLayout mount branch, AND the entry action (probe-gated shield) must ALL land in this phase, or the surface is built-but-unreachable (the Phase-118 lesson, cited verbatim in `ChatLayout.tsx:324-325`).

### No-router navigation
**Source:** `App.tsx:14` (`useState<ActiveView>`), sketch 023-A precedent
**Apply to:** the Control Room is a new `ActiveView`, not a browser route. "Non-discoverable" is enforced at the API (404) + probe-gated rendering, NEVER by route hiding.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `operator_audit_floor` yield-dependency (in `dependencies.py`) | middleware | request-response | No existing FastAPI `yield`-dependency in the repo. COMPOSITE — build from the `audit_service.py` swallow pattern + `aexec` off-loop + `request.state` enrich. RESEARCH Pattern 2 is the spec. |
| `frontend/src/…/useOperatorProbe.test.ts` (vitest) | test | — | No vitest hook-test analog located in the scanned frontend tree (the located frontend test is `useResizablePanel.test.ts` — a pure-logic hook, not a fetch hook). Planner: model the 200→isOperator-true / 404→false assertions on the `getTunerLatest` 404-branch contract; keep it minimal per RESEARCH Wave-0 gap. |
| `OperatorBand` / `HealthSignals` / `RecentActionsCard` / `LockedTab` / `TechnicalNamesToggle` (visual specifics) | component | request-response | The SHELL shape has an analog (`SkillStudioPage`), but the amber-band identity, plain-label health signals, slides-in receipt row, marker flash, ✎ write mark, and "⌥ Technical names" toggle are SKETCH-driven with no code precedent. Copy exact copy/layout/animation from `.planning/sketches/061-control-room-shell/` + `.planning/sketches/062-gate-honesty-and-receipts/` (G-2 approved). |

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/`, `backend/tests/`, `supabase/migrations/`, `frontend/src/pages/`, `frontend/src/components/layout/`, `frontend/src/hooks/`, `frontend/src/lib/`
**Files scanned (read in full or targeted):** `admin.py`, `dependencies.py`, `audit_service.py`, `main.py` (lifespan), `utils/db.py`, `config.py` (:890-905), `059_…sql`, `conftest.py`, `test_audit.py`, `App.tsx`, `nav-items.ts`, `NavPanel.tsx`, `ChatLayout.tsx` (:220-352), `api.ts` (:1-80, :3383-3395), `SkillStudioPage.tsx`, `useSkills.ts`; migration ls (094 = highest, next = 095 CONFIRMED)
**Pattern extraction date:** 2026-07-10
