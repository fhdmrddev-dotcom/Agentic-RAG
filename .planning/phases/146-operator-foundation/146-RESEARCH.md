# Phase 146: Operator Foundation - Research

**Researched:** 2026-07-10
**Domain:** FastAPI router-level access control + Supabase RLS/service-role schema shape + React (no-router) admin shell + append-only audit
**Confidence:** HIGH (every substrate claim verified against live code, migrations, and the shipped v3.2 backpressure/audit precedents; the only MEDIUM item is the exact byte-shape of FastAPI's default 404, which Wave 0 pins with an assertion test)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** First operator seeded via `OPERATOR_EMAILS` env var, idempotently upserted into `operator_users` on backend startup (auth users resolved by email). Identical local (`backend/.env`) + cloud (Coolify). DB table is runtime source of truth; env is bootstrap-only — removing an email does NOT un-operator anyone (Phase 148 territory). Idempotent + safe under multi-worker startup (`WORKER_COUNT=2`, concurrent upsert, ON CONFLICT-safe).
- **D-02:** Clean replace of `BACKPRESSURE_ADMIN_USER_IDS` — no dev fail-open. Delete the env var + `_check_backpressure_auth` fail-open logic; `/admin/backpressure` sits behind `require_operator` like every `/admin` route. Non-operators get 404 even in dev; local behaves exactly like prod. Cloud parity: `OPERATOR_EMAILS` into Coolify + old var removed at the same promotion.
- **D-03:** Auto-log floor + rich labels. The `require_operator` gate itself writes an `operator_audit_log` row for EVERY gated `/admin` request ("every operator action is recorded" holds by construction as 147–150 add endpoints). Write-endpoints enrich with the plain-sentence label ("Turned ON maintenance mode"); views get auto-derived plain labels ("Viewed system health"). Receipts are plain sentences, never action codes (062-A rule).
- **D-04:** Manual refresh only day-one — no auto-polling. Health loads on Control Room entry + the visible ↻ Refresh button (which visibly prepends its own "Viewed system health" ledger row — the honesty beat). Every ledger row is a deliberate human action. Auto-poll (+ the audit-floor exemption design it forces) deferred to Phase 147.
- **D-05:** `org_id` stub sweep = new tables + core user-data tables. `operator_audit_log` ships with `org_id` (nullable, no FK, no index, no backfill — the `harness_audit` mig-059 precedent), PLUS one migration adds the same stub to the core user-data tables v3.4 will org-scope (documents, folders, threads, skills, workflows, workflow_runs… **exact list finalized here from the live schema**). Metadata-only ALTERs, zero behavior change.
- **D-06:** `operator_users` is a system-level, org-agnostic principal — deliberately NOT a JWT custom claim, NOT an `is_admin` boolean, NOT a "special org" (REQUIREMENTS ADMIN-01 + research Pitfall 2; the v3.4 one-way door).
- **D-07:** Shell is sketch 061-B: operator-only amber shield entry at the bottom of the app rail (probe-gated — a non-operator's nav is byte-identical to today); full-width amber-warmed operator band (shield + "Control Room" + OPERATOR chip + identity + "every action recorded" marker + ‹ Back to app) over horizontal section tabs — NOT a second left nav rail. Day-one = full map, honest locks: Overview + Audit tabs live; System Controls / Users & Access / AI Models / API Keys render locked with calm "Not built yet — coming soon" refusals. Landing = System health (four real `/admin/backpressure` signals under plain labels: Server capacity · Agents working · Database connections · Work spread) + recent-operator-actions feed. ALL copy plain-first with an "⌥ Technical names" toggle revealing raw field/action/endpoint names (LANG-01 two-audience, born plain at 146).
- **D-08:** Receipt is sketch 062-A: the action lands at the top of the always-visible "Recent operator actions" card (row slides in; band's recording marker flashes) — no toasts, no counters; the ledger IS the receipt. Write actions carry a leading ✎ mark; full history in the Audit tab (count-pill). Consequence ≠ receipt: a write that stays in effect gets its own persistent banner (147+ inherits this).
- **D-09:** Three G-4 lived-experience UAT scenarios, all driven live (Chrome MCP or operator-clicks): (1) the invisible door, (2) the control room feels like a zone, (3) the ledger is the receipt. See CONTEXT.md for exact pass/fail wording — reproduced in Validation Architecture below.

### Claude's Discretion

- The operator-probe endpoint shape (e.g., `GET /admin/me` that 404s for non-operators; frontend treats 404 as "render nothing").
- `operator_audit_log` column schema + event/action vocabulary (follow `harness_audit`: jsonb metadata; text + CHECK vs free-text action field).
- The exact core-table list for the D-05 org_id sweep (derive from live schema — done below).
- How 404 indistinguishability is achieved (match FastAPI's default `{"detail": "Not Found"}` shape/headers exactly).
- The new `ActiveView` entry name for the Control Room + component file layout.
- RLS posture on the two new tables (backend is service-role so RLS never gates it; enable RLS + deny-all/no policies for anon/authenticated per the "all tables need RLS" project rule).
- Migration numbering/split (next free number is 095) + full-schema regeneration per project rules.

### Deferred Ideas (OUT OF SCOPE)

- Auto-poll for Control Room health + the audit-floor exemption design it forces — Phase 147.
- Operator add/remove management UI — Phase 148 (until then: env-seed additions or manual SQL).
- "Sign in as user" impersonation — Phase 148 STRETCH/named-trigger (ADMIN-03).
- Audit browser search/filters/CSV export — Phase 148; the 146 Audit tab is the honest minimal history view.
- Kill-switches / maintenance mode / active-runs view + Kill (147); model registry (149); secrets encryption (150). Locked tabs render day-one with honest "coming soon" copy — phase numbers NEVER appear in shipped copy.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | A system-level operator role exists (`operator_users` — org-agnostic principal, NOT a JWT claim or `is_admin` boolean, forward-compatible with v3.4 org-RBAC) with a default-deny `require_operator` gate at router level; non-operators get 404 (non-discoverable); every operator action writes to `operator_audit_log`. | Standard Stack (all deps already installed); Architecture Pattern 1 (router-level gate + 404), Pattern 2 (audit-floor yield-dependency), Pattern 3 (multi-worker idempotent seed); Schema section (`operator_users` + `operator_audit_log` DDL, RLS deny-all); D-05 org_id sweep list; 404-indistinguishability pitfall + regression test. |
</phase_requirements>

## Summary

This phase is **pure integration onto shipped substrate** — there are **zero new packages** to install. Every dependency the phase needs is already live: `fastapi==0.115.6`, `supabase>=2.29.0`, `asyncpg`, the `get_current_user` JWT dependency (`backend/app/dependencies.py:103`), the existing `/admin` router (`backend/app/api/admin.py`), the `aexec` threadpool wrapper (`backend/app/utils/db.py`), the `write_audit_entry` swallow-on-error pattern (`backend/app/services/audit_service.py:57`), and the `harness_audit` append-only table shape (`supabase/migrations/059`). The work is schema-shape discipline + one FastAPI dependency + a probe-gated React view, not new infrastructure.

The single load-bearing security fact (from `.planning/research/SUMMARY.md`, Pitfall 1): **the backend runs entirely on the Supabase service-role key, so `/admin` routes have NO RLS backstop.** A missing gate or a missing `WHERE user_id =` filter on an admin route is a full-tenant leak, not a scoped one. The mitigation is exactly what ADMIN-01 mandates: a **single** `require_operator` dependency applied at the **router level** (`APIRouter(dependencies=[...])`), default-deny, returning **404 not 403** so the surface is non-discoverable, plus a route-enumeration regression test that asserts every current and future `/admin` route 404s for a normal JWT. The schema is a genuine **v3.4 one-way door** (Pitfall 2): `operator_users` must be a separate, org-agnostic principal — never a JWT claim, `is_admin` boolean, or special org — or the v3.4 multi-tenancy RLS rewrite is poisoned.

**Primary recommendation:** Ship migration 095 (`operator_users` + `operator_audit_log`, both RLS-enabled with **no policies** = deny-all, service-role bypasses) and migration 096 (the `org_id` metadata stub on `documents`/`folders`/`threads`/`skills`). Add one `require_operator` router-level dependency that (a) reuses `get_current_user`, (b) checks `operator_users` membership → raises a byte-identical `404 {"detail":"Not Found"}` on miss, and (c) writes the audit floor via a `yield`-dependency reading a request-state label so endpoints enrich without breaking append-only immutability. Delete `_check_backpressure_auth` + the `backpressure_admin_user_ids` config field. Seed operators idempotently in the `lifespan` startup (mirrors `_migrate_settings_override`) with `INSERT … ON CONFLICT DO NOTHING`. Frontend: a new `control-room` `ActiveView` in `App.tsx` + `ChatLayout.tsx`, a probe-gated shield entry rendered **outside** the shared `NAV_ITEMS` array, and the 061-B/062-A shell.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Operator membership check + 404 gate | API / Backend (`require_operator` dependency) | — | Service-role has no RLS backstop; access control MUST live in application code at the router, never in the browser (Pitfall 13: UI-only gating forbidden) |
| Audit-floor write ("every action recorded") | API / Backend (gate `yield`-teardown) | Database (`operator_audit_log`) | Guarantee must hold by construction inside the gate, not per-endpoint discipline (D-03) |
| Operator bootstrap seed | Frontend Server / Backend startup (`lifespan`) | Database (`operator_users`) | Multi-worker startup, idempotent upsert; env is bootstrap, DB is source of truth (D-01) |
| Non-discoverable nav (shield hidden) | Browser / Client (probe-gated render) | API (probe endpoint 404s non-operators) | Nav byte-identity for non-operators is a client render decision, but the *authority* is the API probe result, never a client-side role flag |
| Control Room shell + ledger receipt | Browser / Client (React `ActiveView`) | API (health + audit-feed reads) | No URL router exists; navigation is `useState<ActiveView>` (sketch 023-A precedent) |
| Backpressure signals | API / Backend (existing `/admin/backpressure`) | Browser (plain-label rendering) | Endpoint already ships the four real signals (Phase 078); 146 only re-gates + re-skins it |
| `org_id` forward-compat stub | Database (metadata ALTER) | — | Pure schema shape for v3.4; zero runtime behavior |

## Standard Stack

### Core (ALL already installed — nothing to add)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115.6 | `APIRouter(dependencies=[Depends(require_operator)])` router-level gate; `HTTPException(404)` | Already the app's web framework `[VERIFIED: backend/requirements.txt:1]` |
| supabase (supabase-py) | >=2.29.0 | `get_current_user` JWT validation; audit + membership reads via service-role | Already the DB/auth client `[VERIFIED: backend/requirements.txt:7, backend/app/dependencies.py:16-20]` |
| asyncpg | (installed, pooled) | Direct SQL for the startup seed (`auth.users` email→id resolve, `operator_users` upsert) — same path `_migrate_settings_override` uses | Pool already exists (`get_pg_pool`) `[VERIFIED: backend/app/dependencies.py:74-100]` |
| starlette (via fastapi) | bundled | `run_in_threadpool` for the audit write off the event loop | Already used by `aexec` `[VERIFIED: backend/app/utils/db.py]` |

**Frontend:** React + Vite + Tailwind + shadcn/ui, Aether Deep Midnight theme — all existing. No new frontend packages. Shield glyph: a lucide shield **distinct from Governance's `ShieldCheck`** (use plain `Shield` + amber tint) `[CITED: sketch 061 README "shield glyph must stay distinct from Governance's ShieldCheck"]`.

### Supporting (existing patterns to reuse verbatim)

| Asset | Location | Purpose |
|-------|----------|---------|
| `get_current_user` | `backend/app/dependencies.py:103` | JWT→`{id, email}`; `require_operator` composes on top `[VERIFIED]` |
| `write_audit_entry` / swallow-on-error | `backend/app/services/audit_service.py:57` | The "audit write must never break the request" precedent (try/except, log, swallow) `[VERIFIED]` |
| `aexec` | `backend/app/utils/db.py` | `run_in_threadpool(query.execute)` — off-loop Supabase calls (D-v2.5-01) `[VERIFIED]` |
| `harness_audit` DDL | `supabase/migrations/059_harness_audit_and_threads_col.sql` | The append-only audit table shape: text + CHECK, jsonb metadata, PLAIN uuid NO-FK for tamper-resistance, nullable no-FK `org_id`, RLS with no mutation policy `[VERIFIED]` |
| `_migrate_settings_override` | `backend/app/main.py:124-214` | The multi-worker-safe idempotent startup-write precedent (runs per worker, idempotent via conflict-safe SQL, best-effort try/except, never blocks startup) `[VERIFIED]` |
| `/admin/backpressure` | `backend/app/api/admin.py:52-99` | The four real signals; re-gate behind `require_operator`, delete `_check_backpressure_auth` `[VERIFIED]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `operator_users` table | JWT custom claim / `is_admin` boolean / special org | **REJECTED — Pitfall 2 one-way door.** Poisons v3.4 org-RBAC. Locked by D-06. |
| Router-level single dependency | Per-endpoint gating | **REJECTED — Pitfall 1/13.** One forgotten endpoint = full-tenant leak (no RLS backstop). Router-level = default-deny by construction. |
| text + CHECK on `action` (harness_audit style) | Free-text `action`, no CHECK | Recommended: **free-text action** (see Schema rationale) — the auto-floor derives an action per route, so a CHECK would demand a migration per new admin action, fighting D-03's by-construction goal. `label` (plain sentence) is the human-facing field. |
| Yield-dependency audit floor | Middleware / per-endpoint call | Recommended: **yield-dependency** — writes exactly one row per gated request in teardown, reads an enrich-label from `request.state`, preserves append-only (no UPDATE). Middleware would fire for unmatched 404 paths too. |

**Installation:** None. `[VERIFIED: all deps present in backend/requirements.txt + backend/app/dependencies.py]`

## Package Legitimacy Audit

**No external packages are installed by this phase.** It uses only already-installed, long-established dependencies (`fastapi`, `supabase`, `asyncpg`, `starlette`), all verified present in `backend/requirements.txt` and imported across the live codebase. slopcheck / registry verification is **not applicable** — there is no install step. If the planner discovers a genuinely new dependency is needed during planning, run the Package Legitimacy Gate before adding it.

## Architecture Patterns

### System Architecture Diagram

```
                          NON-OPERATOR JWT                         OPERATOR JWT
                                │                                       │
   ┌────────────────────────────┼───────────────────────────────────────┼──────────────┐
   │  FRONTEND (React, no router)                                                        │
   │   App mount ──► GET /admin/me (probe) ──► 404 ──► render NOTHING     ──► 200 {id,…} │
   │                                          (nav byte-identical)         │  isOperator │
   │                                                                       ▼             │
   │                                                        rail shield entry appears     │
   │                                                        (rendered OUTSIDE NAV_ITEMS)  │
   │                                                        click ──► ActiveView="control-room" │
   │                                                                       │             │
   │                        Control Room shell (061-B): amber band + tabs  │             │
   │                        Overview (health + ledger) · Audit · 4 locked  │             │
   └───────────────────────────────────────────────────────────────────────┼───────────┘
                                                                            │ authed fetch
   ┌────────────────────────────────────────────────────────────────────────┼───────────┐
   │  BACKEND  APIRouter(prefix="/admin", dependencies=[Depends(require_operator)])       │
   │                                                                          ▼           │
   │   require_operator:                                                                   │
   │     1. current_user = get_current_user(JWT)          ── 401 on bad token             │
   │     2. SELECT 1 FROM operator_users WHERE user_id=…  ── miss ─► raise 404 {"detail":  │
   │                                                                    "Not Found"}       │
   │        (byte-identical to Starlette's unknown-route 404 — non-discoverable)          │
   │     3. yield operator_identity                                                        │
   │     4. [teardown] write operator_audit_log row (run_in_threadpool, swallow)          │
   │            label = request.state.audit_label OR route-derived plain label            │
   │            (probe endpoint /admin/me opts OUT of the floor — identity check ≠ action) │
   │                          │                                                            │
   │      ┌───────────────────┼───────────────────┬──────────────────────┐               │
   │      ▼                   ▼                   ▼                      ▼               │
   │  GET /admin/me      GET /admin/backpressure  GET /admin/audit    (147+ endpoints)    │
   │  (probe, no floor)  (4 real signals)         (recent op actions)  inherit the gate   │
   └────────────────────────────────────────────────────────────────────────────────────┘
                                        │ service-role (RLS bypassed)
   ┌────────────────────────────────────▼──────────────────────────────────────────────┐
   │  DATABASE (mig 095)  operator_users (RLS on, NO policies = deny-all)                 │
   │                      operator_audit_log (RLS on, NO policies; append-only; org_id)   │
   │  (mig 096)           documents/folders/threads/skills += org_id (nullable, no FK)    │
   └─────────────────────────────────────────────────────────────────────────────────────┘
      STARTUP lifespan (per worker, WORKER_COUNT=2): OPERATOR_EMAILS ─► resolve auth.users
      by email ─► INSERT operator_users ON CONFLICT DO NOTHING (idempotent, concurrent-safe)
```

### Recommended Backend Structure

```
backend/app/
├── api/admin.py              # UPGRADE: router-level require_operator dep; delete
│                             #   _check_backpressure_auth; add GET /admin/me (probe,
│                             #   floor-exempt) + GET /admin/audit (recent op actions)
├── dependencies.py           # ADD: require_operator (+ get_operator sub-dep for testability)
├── services/
│   └── operator_service.py   # NEW: is_operator(user_id), write_operator_audit(...),
│                             #   seed_operators_from_env()  — keeps admin.py thin
├── main.py                   # ADD: operator seed call in lifespan (mirror _migrate_settings_override)
└── config.py                 # ADD operator_emails; DELETE backpressure_admin_user_ids
```

```
frontend/src/
├── App.tsx                   # ADD "control-room" to ActiveView union + probe state
├── components/layout/
│   ├── ChatLayout.tsx        # ADD activeView==="control-room" render branch
│   └── NavPanel.tsx          # ADD probe-gated shield in the footer (NOT in NAV_ITEMS)
├── components/admin/         # NEW: ControlRoomPage, OperatorBand, HealthSignals,
│                             #   RecentActionsCard, LockedTab, TechnicalNamesToggle
├── lib/api.ts                # ADD getOperatorProbe(), getBackpressure(), getOperatorAudit()
└── hooks/useOperatorProbe.ts # NEW: one-shot probe on mount → { isOperator, identity }
```

### Pattern 1: Router-level default-deny gate returning a byte-identical 404

**What:** Attach `require_operator` to the router so it runs before every `/admin` endpoint; on non-membership raise a 404 whose body is identical to FastAPI's unknown-route 404.

**Why:** No RLS backstop (Pitfall 1). Router-level = a new endpoint can't forget the gate. 404-not-403 = non-discoverable (an attacker can't tell the route exists-but-forbidden).

```python
# backend/app/api/admin.py — Source: composes get_current_user (dependencies.py:103)
# + existing APIRouter(prefix="/admin") (admin.py:21)
from fastapi import APIRouter, Depends, HTTPException, Request

# FastAPI/Starlette default unknown-route 404 body is exactly {"detail":"Not Found"}
# with content-type application/json. Raising this from the dependency is byte-identical.
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")

async def require_operator(request: Request,
                           current_user: dict = Depends(get_current_user)):
    # get_current_user already raised 401 on a bad/absent JWT.
    if not await is_operator(current_user["id"]):   # SELECT 1 FROM operator_users …
        raise _NOT_FOUND                             # non-discoverable
    request.state.operator = current_user
    # audit floor happens in the yield-dependency (Pattern 2), NOT here
    return current_user

router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_operator)])
```

**404 indistinguishability — three things must match** `[VERIFIED: FastAPI 0.115.6 behavior; Wave 0 pins with an assertion test]`:
1. **Status** 404 and **body** `{"detail":"Not Found"}` — `HTTPException(404, detail="Not Found")` produces exactly this.
2. **Content-Type** `application/json` — FastAPI's default `HTTPException` handler emits JSON; matches the unknown-route handler.
3. **Method-mismatch leak (the subtle one):** Starlette matches *path+method* before dependencies run. `POST /admin/backpressure` (a GET-only route) returns **405 Method Not Allowed** with an `Allow` header — which reveals the path EXISTS. A genuinely nonexistent path returns 404 for all methods. See Pitfall 2 for the mitigation decision.

### Pattern 2: Audit-floor as a yield-dependency (append-only, enrichable)

**What:** A `yield` dependency writes exactly one `operator_audit_log` row per gated request in its teardown, using a label the endpoint may have set on `request.state`.

**Why:** D-03 wants "by construction" — the endpoint can't forget. Yield-teardown runs after the response, keeping the write off the response latency path. Reading the label from `request.state` lets write-endpoints enrich ("Turned ON maintenance mode") while views get an auto-derived plain label ("Viewed system health") — **without** an UPDATE (preserves append-only immutability, unlike a write-then-update-row approach).

```python
# Source: mirrors write_audit_entry swallow pattern (audit_service.py:57)
# + aexec run_in_threadpool (utils/db.py)
async def operator_audit_floor(request: Request):
    yield
    # teardown — after response. Never block the loop; never raise into the request.
    try:
        label = getattr(request.state, "audit_label", None) or _derive_plain_label(request)
        action = getattr(request.state, "audit_action", None) or _derive_action(request)  # e.g. "health.view"
        is_write = getattr(request.state, "audit_is_write", False)
        op = getattr(request.state, "operator", None)
        if op is None:
            return  # gate already 404'd a non-operator — nothing to record
        await write_operator_audit(operator_user_id=op["id"], action=action,
                                   label=label, is_write=is_write, metadata={})
    except Exception as exc:
        logger.error("operator audit floor failed: %s", exc)  # swallow (D-05 precedent)
```

**Probe exemption (a real 146 design point, not deferred):** The frontend calls `GET /admin/me` on **every** app mount to decide whether to show the shield. If the floor logged the probe, the ledger would fill with non-actions and violate D-04 ("every ledger row is a deliberate human action"). **Resolution:** the probe endpoint opts out of the floor. Recommended shape: apply `require_operator` (membership + 404) at the **router level** so `/admin/me` is still gated, but apply the `operator_audit_floor` yield-dependency **per-action-endpoint** (backpressure/health, audit view, and every 147+ write) — NOT to `/admin/me`. This keeps "every operator *action* is recorded" (actions = real endpoints) while the identity probe stays silent. (D-04 defers only the *auto-poll* exemption to 147; the probe exemption is in-scope here.)

### Pattern 3: Multi-worker-safe idempotent operator seed

**What:** In `lifespan` startup, resolve `OPERATOR_EMAILS` → `auth.users.id` by email, upsert into `operator_users` conflict-safely. Runs per worker under `WORKER_COUNT=2`.

```python
# Source: mirrors _migrate_settings_override (main.py:124) — per-worker, idempotent,
# best-effort try/except, never blocks startup.
async def seed_operators_from_env():
    emails = [e.strip().lower() for e in settings.operator_emails.split(",") if e.strip()]
    if not emails:
        return
    pool = await get_pg_pool()
    # Resolve by email (Supabase lowercases emails; match case-insensitively).
    rows = await pool.fetch(
        "SELECT id, email FROM auth.users WHERE lower(email) = ANY($1::text[])", emails)
    found = {r["email"].lower() for r in rows}
    for missing in set(emails) - found:
        logger.warning("OPERATOR_EMAILS: no auth.users row for %s — will seed on a later "
                       "restart once they sign up", missing)   # bootstrap, not error
    for r in rows:
        # ON CONFLICT DO NOTHING = concurrent-safe under WORKER_COUNT=2 (both workers race,
        # first wins, second no-ops). granted_by NULL = env-bootstrap provenance.
        await pool.execute(
            "INSERT INTO operator_users (user_id, granted_by, note) VALUES ($1, NULL, "
            "'env-bootstrap') ON CONFLICT (user_id) DO NOTHING", r["id"])
```

Call it in `lifespan` after `get_pg_pool()`, wrapped in try/except like the other startup blocks (`main.py:237-243`), so a seed failure logs and the app continues.

### Anti-Patterns to Avoid

- **Adding the shield to `NAV_ITEMS`** (`frontend/src/lib/nav-items.ts`). That array is the *single shared source* consumed by BOTH desktop `NavPanel` and the mobile drawer in `ChatLayout` `[VERIFIED: nav-items.ts:24-42; ChatLayout.tsx:25,234; NavPanel.tsx:24,287]`. Adding it there shows the shield to everyone → violates D-07 byte-identity. **The sketch 061 README says "extends NAV_ITEMS conditionally" — CONTEXT.md D-07 supersedes it: render the shield as a separate probe-gated element in the rail footer, NOT in the shared array.** (Flagged as a doc conflict — resolve in favor of D-07.)
- **Client-side role gating as the security boundary** (Pitfall 13). The probe result only decides *rendering*; the 404 gate is the authority. A non-operator who forges `isOperator=true` in the client still gets 404 on every `/admin` call.
- **Writing the audit row inside the request handler with a blocking `.execute()`** — blocks the event loop (D-v2.5-01). Use `run_in_threadpool`/`aexec`, swallow errors.
- **A CHECK-constrained `action` that grows every phase** — would force a migration per new admin action and re-introduce the audit-drift-guard tax; use free-text `action` (operator-internal, not a security enum).
- **FK CASCADE on `operator_audit_log.operator_user_id`** — deleting an operator would erase their action history. Use a PLAIN uuid, NO FK (matches `harness_audit.run_id` tamper-resistance rationale, mig 059 line 16).

## Schema (Claude's-discretion DDL — planner may refine)

### Migration 095 — operator tables

```sql
-- 095_operator_foundation.sql  (ADMIN-01)
-- operator_users: system-level, org-agnostic principal (D-06). Deliberately NO org_id —
-- an operator spans all orgs; per-org operators are a v3.4 concern, not a v3.3 stub.
CREATE TABLE IF NOT EXISTS public.operator_users (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by uuid,        -- NULL = env-bootstrap; set when Phase 148 adds grant-by-operator
    note       text
);

-- operator_audit_log: append-only (harness_audit precedent, mig 059).
CREATE TABLE IF NOT EXISTS public.operator_audit_log (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_user_id uuid NOT NULL,          -- PLAIN uuid, NO FK — survives operator deletion (tamper-proof)
    action           text NOT NULL,          -- free-text machine code, convention "<area>.<verb>" (e.g. health.view)
    label            text NOT NULL,          -- plain-sentence receipt ("Viewed system health") — 062-A
    is_write         boolean NOT NULL DEFAULT false,  -- the ✎ mark (write vs view)
    target_type      text,                   -- nullable; 147+ enrich (e.g. 'run','user','setting')
    target_id        text,                   -- nullable
    metadata         jsonb NOT NULL DEFAULT '{}',
    org_id           uuid,                   -- D-05 forward-compat stub: nullable, NO FK, NO index, NO backfill
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_operator_audit_created ON public.operator_audit_log(created_at DESC);  -- feed order

COMMENT ON COLUMN public.operator_audit_log.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';

-- RLS: ENABLE + NO policies = deny-all for anon/authenticated. Service-role (the backend)
-- bypasses RLS, so require_operator in app code is the sole gate (Pitfall 1 acknowledged).
-- STRICTER than harness_audit (which had owner SELECT/INSERT): a normal JWT must NEVER read
-- either operator table — only the service-role backend behind require_operator does.
ALTER TABLE public.operator_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_audit_log  ENABLE ROW LEVEL SECURITY;
-- (No CREATE POLICY statements — deny-all by omission.)
```

### Migration 096 — org_id stub sweep (D-05)

```sql
-- 096_org_id_stub_sweep.sql  (D-05 one-way door prep)
-- Metadata-only: nullable, NO FK, NO index, NO backfill (harness_audit mig-059 precedent).
-- Zero behavior change. Split from 095 so the operator tables can ship/rollback independently.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.folders   ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.threads   ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.skills    ADD COLUMN IF NOT EXISTS org_id uuid;
COMMENT ON COLUMN public.documents.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
-- (repeat COMMENT for folders/threads/skills)
```

**D-05 target list — derived from the live schema** `[VERIFIED: supabase/full-schema.sql — grep of org_id + CREATE TABLE]`:

| Table | Has `user_id`? | Already has `org_id`? | In this sweep? | Rationale |
|-------|---------------|----------------------|----------------|-----------|
| documents | yes (`:648`) | no | **YES** | Top-level owned entity v3.4 org-scopes |
| folders | yes (`:812`) | no | **YES** | Top-level owned entity |
| threads | yes (`:1224`) | no | **YES** | Top-level owned entity |
| skills | yes (`:1206`) | no | **YES** | Top-level owned entity |
| workflow_definitions | yes | **yes** (`:1317`) | already done | Stubbed in a prior phase |
| workflow_runs | yes | **yes** (`:1374`) | already done | Stubbed in a prior phase |
| classification_rules / document_views / document_relationships / metadata_field_definitions / harness_audit / workflow_phases | — | **yes** | already done | DM/harness phases stubbed them |
| messages, document_chunks/images/tables, skill_files/versions/test_cases, workflow_phases, todos, runs, code_executions | via parent FK | no | **NO** | Child tables inherit org through their parent FK (messages→threads, chunks→documents, skill_files→skills). Stubbing children is redundant and enlarges the one-way-door surface. |
| user_memory, eval_runs/results/ratings, tuner_runs | yes (some) | no | **OPTIONAL — planner call** | Judgment: v3.4 org-scoping of per-user memory/eval history is undecided (SUMMARY doesn't specify). Recommend **defer** unless discuss-phase says otherwise — keep the sweep to the four unambiguous roots. |

**Note the index tension:** the DM-era `org_id` columns (`classification_rules`, `document_views`, …) DID add `idx_*_org_id` indexes, but `harness_audit.org_id` did NOT. D-05 explicitly follows the **harness_audit** precedent: nullable, **no FK, no index, no backfill**. Follow D-05 (bare column + COMMENT only). Flagged so the planner doesn't "helpfully" add indexes.

**Project migration rules** `[CITED: CLAUDE.md]`: apply each migration by pasting into the Supabase SQL editor (never `db push`/`db reset`), then run `bash scripts/regenerate-full-schema.sh` (live dump, no reset) to rebuild `supabase/full-schema.sql`. Filenames must match `<digits>_name.sql` — `095_…`, `096_…` (no letter suffixes; `007b` is silently skipped). Cloud parity: paste both migrations into the cloud Supabase SQL editor at promotion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation for the gate | A new token parser | `get_current_user` (`dependencies.py:103`) | Already validates the Supabase JWT → `{id,email}` `[VERIFIED]` |
| Role model | JWT claim / `is_admin` col / special org | `operator_users` table | Pitfall 2 one-way door; locked D-06 |
| Off-loop DB writes | Manual thread juggling | `aexec` / `run_in_threadpool` | Already the SSE-path wrap (D-v2.5-01) `[VERIFIED]` |
| Audit write that can't break the request | try/except in each handler | `write_audit_entry` swallow pattern | Established precedent (`audit_service.py:57`) `[VERIFIED]` |
| The 404 body | A custom JSON error | `HTTPException(404, detail="Not Found")` | Byte-identical to FastAPI's unknown-route 404 |
| Client-side navigation | A URL router | `useState<ActiveView>` switch | No router exists; sketch 023-A precedent `[VERIFIED: App.tsx:10-14, ChatLayout.tsx:261-338]` |
| Multi-worker startup write | A lock/leader election | `INSERT … ON CONFLICT DO NOTHING` | Concurrent-safe by construction; mirrors `_migrate_settings_override` `[VERIFIED]` |

**Key insight:** Every hard part of this phase already has a shipped precedent in this codebase. The risk is not building something new — it's failing to reuse the existing pattern (and thereby re-opening a solved security or concurrency hole).

## Runtime State Inventory

> This phase is additive (new tables + new gate), not a rename/refactor/migration of existing runtime state. Included for completeness because D-02 deletes an env var and a config field.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — `operator_users`/`operator_audit_log` are net-new (verified: no prior migration or code references them). No existing rows carry an operator concept. | New tables only (mig 095). |
| Live service config | **Cloud env (Coolify):** must SET `OPERATOR_EMAILS` and REMOVE `BACKPRESSURE_ADMIN_USER_IDS` at the same promotion (D-02 parity). This config lives in Coolify, not git. | Operator-driven env change at deploy (docs/DEPLOYMENT-WORKFLOW.md). |
| OS-registered state | **None** — no Task Scheduler / pm2 / systemd references to the operator concept. | None. |
| Secrets/env vars | `BACKPRESSURE_ADMIN_USER_IDS` — defined in `backend/app/config.py:900` as `backpressure_admin_user_ids: str = ""`. **NOT present in `backend/.env.example`** (verified). New: `OPERATOR_EMAILS`. | DELETE the config field + `_check_backpressure_auth` (`admin.py:24-49`); ADD `operator_emails` to config + `OPERATOR_EMAILS` to `.env.example`. The old var needs no `.env.example` removal (it was never there). |
| Build artifacts | **None** — no compiled artifacts embed the old gate. | None. |

**The canonical question — after every file is updated, what runtime systems still carry the old string?** Only the **cloud Coolify env** (`BACKPRESSURE_ADMIN_USER_IDS` may be set there) and any developer's local `backend/.env` that set it manually. Both are addressed by the D-02 parity note; neither is a data migration (env only).

## Common Pitfalls

### Pitfall 1: A `/admin` route without the gate = full-tenant leak
**What goes wrong:** The backend uses the service-role key (`dependencies.py:19`), which **bypasses RLS**. Any `/admin` route not covered by `require_operator`, or any cross-user read missing a `WHERE user_id =` filter, exposes every tenant's data.
**Why:** No RLS backstop exists on service-role reads (`.planning/research/SUMMARY.md` Pitfall 1).
**How to avoid:** Attach `require_operator` at the **router level** (`APIRouter(dependencies=[…])`), never per-endpoint. Add the route-enumeration regression test (below) that fails if any `/admin` route returns non-404 for a normal JWT.
**Warning signs:** An endpoint added to `admin.py` with its own `Depends(get_current_user)` instead of inheriting the router gate.

### Pitfall 2: The 405 method-mismatch fingerprint
**What goes wrong:** `require_operator` returns a perfect 404 for the defined method, but Starlette matches path+method *before* dependencies run. `POST /admin/backpressure` (a GET route) returns **405 + `Allow: GET`**, revealing the path exists — a partial break of the "non-discoverable" contract (D-09 scenario 1).
**Why:** Method routing precedes dependency resolution in Starlette.
**How to avoid (planner decision):** Options, cheapest first — (a) **Accept**: 405 reveals only path existence, not data or operator-capability; the D-09 scenario tests direct API hits with the *correct* method (which 404 cleanly). Document the residual as known/acceptable. (b) Add a catch-all `/admin/{path:path}` handler (all methods) behind the gate that 404s, shadowing method-mismatch. (c) Register each admin route for all methods and 404 non-GET. **Recommend (a) for 146** — it satisfies D-09 as written and avoids over-engineering; revisit if a stricter contract is demanded. Surface this to discuss-phase as an `[ASSUMED]` acceptance.
**Warning signs:** A pentest/UAT probing `/admin/*` with POST/PUT and reading the `Allow` header.

### Pitfall 3: Poisoning the v3.4 one-way door
**What goes wrong:** Modeling the operator as a JWT claim, `is_admin` boolean, or special org forces v3.4 to special-case the operator inside every org-scoped RLS policy.
**Why:** `.planning/research/SUMMARY.md` Pitfall 2; locked D-06.
**How to avoid:** `operator_users` is a separate, org-agnostic principal with **no** `org_id` (an operator spans all orgs). The `org_id` stubs go on *data* tables + the *audit* log (so a future "operator X acted in org Z" is expressible), never on the principal.
**Warning signs:** Any temptation to add `org_id` to `operator_users`, or to read operator status from the JWT.

### Pitfall 4: The probe spamming the ledger
**What goes wrong:** The frontend probes `GET /admin/me` on every mount; if the audit floor logs it, the "Recent operator actions" feed fills with non-actions, breaking D-04's "every row is a deliberate human action."
**Why:** The floor is attached at the router level along with the gate.
**How to avoid:** Attach the `operator_audit_floor` yield-dependency **per-action-endpoint**, not at the router level. The probe endpoint gets the membership gate (router-level) but not the floor. See Pattern 2.
**Warning signs:** A "Viewed …" row appearing in the ledger on page load without a human clicking anything.

### Pitfall 5: Blocking the event loop on the audit write
**What goes wrong:** Calling supabase-py `.execute()` synchronously inside the async gate blocks the loop for every gated request (D-v2.5-01).
**How to avoid:** `aexec` / `run_in_threadpool`; swallow errors (`write_audit_entry` precedent).
**Warning signs:** Latency spikes on `/admin/*` under load; the audit write awaited directly on the request path.

### Pitfall 6: The conftest global `get_current_user` override hiding the gate in tests
**What goes wrong:** `backend/tests/conftest.py:80` globally overrides `get_current_user` → a fixed mock user. A naive test would make every request look authenticated *and* can't easily express "non-operator." If `require_operator` isn't decomposed, you can't drive the membership branch from the shared mock.
**How to avoid:** Split the membership check into a small seam (`is_operator`) reading via the asyncpg pool; tests patch `app.dependencies._pg_pool` with the `mock_asyncpg_pool` recorder — `set_fetchrow_result(None)` → 404, `set_fetchrow_result({…})` → pass (the `tests/unit/test_lifespan.py:35` idiom; the supabase-py `mock_execute_result` builder mock has NO effect on the asyncpg path — unmocked, the read would hit the REAL local Postgres). Provide `app.dependency_overrides[require_operator]` for the operator-present path. See Validation Architecture.
**Warning signs:** A test that can only assert 200s because it can't express a non-operator.

## Code Examples

### Route-enumeration 404 regression test (the by-construction guarantee)
```python
# backend/tests/test_146_operator_gate.py
# Auto-covers EVERY current and future /admin route — the ADMIN-01 non-discoverability contract.
from app.main import app

def _admin_paths():
    seen = []
    for r in app.routes:
        path = getattr(r, "path", "")
        methods = getattr(r, "methods", set()) or set()
        if path.startswith("/admin") and "GET" in methods:
            seen.append(path)
    return seen

def test_every_admin_route_404s_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)   # operator_users lookup → no row → non-operator
    for path in _admin_paths():
        # substitute path params with a throwaway uuid so the route matches
        url = path.replace("{run_id}", "00000000-0000-0000-0000-000000000000")
        res = client.get(url, headers=auth_headers)
        assert res.status_code == 404, f"{path} leaked (expected 404 for non-operator)"
        assert res.json() == {"detail": "Not Found"}          # byte-identical body
        assert "application/json" in res.headers.get("content-type", "")
```

### Byte-identity assertion (pin FastAPI's default 404 shape — Wave 0)
```python
def test_admin_404_matches_unknown_route_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)
    gated = client.get("/admin/backpressure", headers=auth_headers)   # exists, gated
    unknown = client.get("/admin/__definitely_not_a_route__", headers=auth_headers)  # unknown
    assert gated.status_code == unknown.status_code == 404
    assert gated.json() == unknown.json() == {"detail": "Not Found"}
```

### Operator-present path (dependency override, conftest idiom)
```python
def test_backpressure_reachable_for_operator(client, auth_headers):
    from app.api.admin import require_operator
    from app.main import app
    app.dependency_overrides[require_operator] = lambda: {"id": "op-1", "email": "op@x.co"}
    try:
        res = client.get("/admin/backpressure", headers=auth_headers)
        assert res.status_code == 200
        assert "anyio_threadpool_depth" in res.json()
    finally:
        app.dependency_overrides.pop(require_operator, None)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BACKPRESSURE_ADMIN_USER_IDS` env allow-list + dev fail-open (`admin.py:24-49`) | `operator_users` table + `require_operator` gate, no fail-open | This phase (D-02) | Local behaves exactly like prod; non-operators 404 even in dev |
| Per-user-ID env allow-list | DB-backed principal (env is bootstrap only) | This phase | Membership editable at runtime (148); env only seeds |
| 403 "Not authorized" | 404 "Not Found" | This phase | Non-discoverable surface (the whole ADMIN-01 point) |

**Deprecated/outdated:** `_check_backpressure_auth`, `settings.backpressure_admin_user_ids` — both deleted this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FastAPI 0.115.6's unknown-route 404 body is exactly `{"detail":"Not Found"}`, content-type `application/json` | Pattern 1 / Code Examples | LOW — standard FastAPI/Starlette behavior; Wave-0 assertion test (`test_admin_404_matches_unknown_route_404`) pins it empirically, so a mismatch fails loudly at build, not in prod |
| A2 | The 405 method-mismatch fingerprint is an ACCEPTABLE residual for D-09 (option (a)) | Pitfall 2 | MEDIUM — if the operator demands byte-identical behavior across *all* methods, planner must add the catch-all (option b/c). Surface at discuss/plan. |
| A3 | The four D-05 sweep targets are exactly documents/folders/threads/skills; children inherit org via parent FK; user_memory/eval/tuner deferred | Schema / D-05 table | MEDIUM — if v3.4 will org-scope memory or eval history at the row level, those need stubs too. A missed stub is a cheap follow-up ALTER, not a one-way door, so risk is low-cost. |
| A4 | Free-text `action` (no CHECK) is preferable to a harness_audit-style CHECK for `operator_audit_log` | Schema / Alternatives | LOW — reversible; a CHECK can be added later. Chosen to avoid a migration-per-action tax against D-03's by-construction floor. |
| A5 | `operator_users` should have NO `org_id` (org-agnostic principal) | Schema / Pitfall 3 | LOW — directly follows D-06; adding org_id later is trivial if v3.4 wants per-org operators (it explicitly does not for v3.3). |
| A6 | Auth users' email in `auth.users` is stored lowercased; case-insensitive match is correct for the seed | Pattern 3 | LOW — `lower(email)=ANY(...)` is safe regardless; worst case an unmatched email logs a warning and re-seeds next restart. |
| A7 | Emails in `OPERATOR_EMAILS` with no `auth.users` row are skipped-with-warning (not an error), seeded on a later restart once the user signs up | Pattern 3 | LOW — matches D-01 "env is bootstrap-only"; a first operator must sign up before/at bootstrap. Document in OPERATOR runbook. |

## Open Questions (RESOLVED)

1. **RESOLVED: 405 method-mismatch strictness (A2).**
   - What we know: correct-method hits 404 cleanly; wrong-method hits 405+Allow, revealing path existence.
   - What's unclear: whether D-09 scenario 1 ("indistinguishable from a nonexistent route") demands all-method parity.
   - Recommendation: accept for 146 (option a), document as known residual; add catch-all only if discuss-phase tightens the contract.
   - **Resolution (adopted at planning):** option (a) accepted — the residual is registered as T-146-03 (Severity: LOW — path-existence disclosure only; no data or operator-capability exposure) in the plan threat models; D-09 #1 tests correct-method hits.

2. **RESOLVED: Probe endpoint naming + whether it returns identity or bare 200.**
   - What we know: `GET /admin/me` 404s non-operators; 200 for operators; floor-exempt.
   - What's unclear: should it return `{id,email,granted_at}` (so the band can show identity without a second call) or bare 200?
   - Recommendation: return the operator identity payload — the 061-B band needs "identity" anyway; one call, not two.
   - **Resolution (adopted at planning):** `GET /admin/me` returns the identity payload `{id,email,granted_at}` and is floor-exempt (Plan 146-02 Task 3).

3. **RESOLVED: org_id sweep breadth (A3).**
   - What we know: four unambiguous roots. Children inherit via FK.
   - What's unclear: v3.4 org-scoping of `user_memory` / eval history.
   - Recommendation: keep to the four roots; note the optionals for the v3.4 planner.
   - **Resolution (adopted at planning):** sweep = the four unambiguous roots (documents/folders/threads/skills) in migration 096; user_memory/eval/tuner deferred to the v3.4 planner (Plan 146-01 Task 2).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres + auth.users) | seed + gate reads | ✓ | local CLI / cloud | — |
| asyncpg pool (`get_pg_pool`) | startup seed, membership check | ✓ | pooled (`dependencies.py:74`) | — |
| supabase-py service-role client | audit writes, reads | ✓ | >=2.29.0 | — |
| fastapi / starlette | router gate, 404 | ✓ | 0.115.6 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. This phase installs nothing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (`asyncio_mode = auto`) + vitest (frontend) `[VERIFIED: backend/pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/test_146_operator_gate.py -x` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Non-operator JWT → 404 on EVERY `/admin` route (route-enumeration) | unit | `pytest tests/test_146_operator_gate.py::test_every_admin_route_404s_for_non_operator -x` | ❌ Wave 0 |
| ADMIN-01 | 404 body byte-identical to unknown-route 404 | unit | `pytest tests/test_146_operator_gate.py::test_admin_404_matches_unknown_route_404 -x` | ❌ Wave 0 |
| ADMIN-01 | Operator JWT → `/admin/backpressure` reachable (200) | unit | `pytest tests/test_146_operator_gate.py::test_backpressure_reachable_for_operator -x` | ❌ Wave 0 |
| ADMIN-01 | `_check_backpressure_auth` deleted; `/admin/backpressure` behind `require_operator` | unit | same file — assert old dep gone / new gate present | ❌ Wave 0 |
| ADMIN-01 | Every gated action endpoint writes one `operator_audit_log` row; probe does NOT | unit | `pytest tests/test_146_operator_gate.py::test_audit_floor_writes_once -x` (assert on the shared Supabase mock `insert` call) | ❌ Wave 0 |
| ADMIN-01 | Seed idempotent under concurrent startup (ON CONFLICT DO NOTHING) | unit | `pytest tests/test_146_operator_seed.py -x` (drive `_MockAsyncpgPool` / shared mock; assert ON CONFLICT SQL + no duplicate) | ❌ Wave 0 |
| D-09 #1/#2/#3 | Lived-experience (invisible door / zone / ledger-is-receipt) | manual (Chrome MCP or operator-clicks) | VALIDATION.md — see below | manual |

### Sampling Rate
- **Per task commit:** `venv/Scripts/python -m pytest tests/test_146_operator_gate.py tests/test_146_operator_seed.py -x`
- **Per wave merge:** full `pytest` (backend) + `npm run build`/vitest (frontend)
- **Phase gate:** full suite green + the three D-09 manual scenarios pass live before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/test_146_operator_gate.py` — covers ADMIN-01 gate/404/audit-floor (route-enumeration + byte-identity + operator-present + floor-write + probe-exempt)
- [ ] `tests/test_146_operator_seed.py` — covers the idempotent multi-worker seed
- [ ] `conftest.py` addition (or per-test helper): an override for `require_operator` (operator-present) and the non-operator branch via patching `app.dependencies._pg_pool` → `mock_asyncpg_pool` with `set_fetchrow_result(None)`. No new framework install — pytest + the existing asyncpg recorder fixture suffice.
- [ ] Frontend: a vitest for `useOperatorProbe` (200→isOperator true, 404→false) and that the shield is absent from `NAV_ITEMS`.

### G-4 / SC#10 note
This phase does **not** touch streaming, the agent loop, provider routing, or provider-specific code, so the CLAUDE.md **4-axis cross-provider UAT (SC#10) does not apply**. The mandatory UAT is the **D-09 three lived-experience scenarios**, authored in `146-VALIDATION.md`, driven live (Chrome MCP / operator-clicks) at phase verification:
1. **The invisible door** — fresh normal user: app byte-identical (no shield, no admin hints); any `/admin` API hit (correct method) → plain 404 indistinguishable from a nonexistent route. Fail = any visible trace, a 403, or a branded/differently-shaped error.
2. **The control room feels like a zone** — seeded operator: shield appears; band shows shield + "Control Room" + OPERATOR chip + identity + recording marker; 4 plain-labeled health signals; locked tabs say "coming soon" with NO phase numbers; ⌥ toggle reveals raw names. Fail = missing zone identity, jargon-first copy, or phase numbers leaking.
3. **The ledger is the receipt** — ↻ Refresh slides "Viewed system health" into Recent operator actions + marker flash; the row persists across a page reload (it lives in `operator_audit_log`, not client state). Fail = no row, a toast instead, code-y labels, or the row vanishing on reload.

## Security Domain

`security_enforcement` is **absent → treated as enabled.** This is a security-critical phase (the access-control keystone for the whole milestone).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Single trust boundary: `require_operator` at the router; service-role has no RLS backstop (documented, compensated in app code) |
| V2 Authentication | yes (reuse) | Existing Supabase JWT via `get_current_user` — not re-implemented |
| V4 Access Control | **yes (core)** | Default-deny router-level gate; 404-not-403 (non-discoverable); route-enumeration regression test; DB-backed principal (not a client flag) |
| V5 Input Validation | yes | `OPERATOR_EMAILS` parsed defensively (split/strip/lower); email match parameterized (`$1::text[]`) — no string interpolation into SQL |
| V6 Cryptography | no | No secrets handled in 146 (SEC-01 is Phase 150) |
| V7 Error Handling / Logging | **yes** | 404 body must not leak that a route exists-but-forbidden; audit floor logs who/what/when to `operator_audit_log`; audit failures swallowed+logged, never surfaced |
| V8 Data Protection | yes | Operator tables RLS-enabled with NO policies (deny-all for anon/authenticated); only service-role behind the gate reads them |

### Known Threat Patterns for FastAPI + Supabase service-role

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Broken access control — a `/admin` route missing the gate (full-tenant leak, no RLS backstop) | Elevation of Privilege / Information Disclosure | Router-level dependency (not per-endpoint) + route-enumeration regression test (Pitfall 1) |
| Endpoint enumeration via 403 vs 404 | Information Disclosure | 404-not-403 for non-members (non-discoverable); byte-identical body |
| Method-mismatch fingerprint (405 + Allow reveals path) | Information Disclosure | Documented residual; catch-all option available (Pitfall 2) |
| Privilege model that poisons v3.4 RLS | Elevation of Privilege (future) | Org-agnostic `operator_users` principal; no JWT claim/`is_admin` (Pitfall 3) |
| SQL injection in the email seed | Tampering | Parameterized `$1::text[]`; no f-string SQL (matches `coerce_uid` discipline in `utils/db.py`) |
| Client-forged operator flag | Spoofing / EoP | Probe result decides render only; the 404 gate is the authority (Pitfall/Anti-pattern 13) |
| Audit-write failure masking an action | Repudiation | Floor write is best-effort+logged; a failed write logs loudly (never silently drops without a log) |

## Sources

### Primary (HIGH confidence)
- Live codebase (this session, file:line verified): `backend/app/api/admin.py:1-99`, `backend/app/dependencies.py:16-115`, `backend/app/main.py:120-269`, `backend/app/services/audit_service.py:1-75`, `backend/app/utils/db.py`, `backend/app/config.py:900`, `backend/pytest.ini`, `backend/tests/conftest.py:1-163`, `backend/tests/test_audit.py`, `frontend/src/App.tsx:10-72`, `frontend/src/lib/nav-items.ts`, `frontend/src/components/layout/NavPanel.tsx`, `frontend/src/components/layout/ChatLayout.tsx:220-338`, `frontend/src/lib/api.ts:1-55`
- Migrations / schema: `supabase/migrations/059_harness_audit_and_threads_col.sql`, `supabase/full-schema.sql` (org_id + CREATE TABLE audit; next migration = 095 confirmed by `ls supabase/migrations/`)
- `.planning/research/SUMMARY.md` (milestone ground truths — Pitfalls 1/2/13, no-RLS-backstop, one-way door)
- `.planning/REQUIREMENTS.md` (ADMIN-01), `.planning/phases/146-operator-foundation/146-CONTEXT.md` (D-01..D-09)
- Approved sketches: `.planning/sketches/061-control-room-shell/README.md`, `.planning/sketches/062-gate-honesty-and-receipts/README.md`
- `CLAUDE.md` (migration rules, run_in_threadpool, WORKER_COUNT=2, RLS-on-all-tables, no-LangChain, venv)

### Secondary (MEDIUM confidence)
- FastAPI 0.115.6 / Starlette default 404 + `HTTPException` JSON handler behavior — standard framework behavior (training knowledge), version confirmed in `backend/requirements.txt`; pinned empirically by the Wave-0 byte-identity test rather than trusted blind (A1).

### Tertiary (LOW confidence)
- None material — no unverified web claims were relied upon.

## Project Constraints (from CLAUDE.md)

- Python backend uses a `venv` — test commands invoke `venv/Scripts/python -m pytest`.
- No LangChain / LangGraph — N/A here (no LLM path).
- All tables need RLS — the two operator tables ship RLS-enabled (deny-all, no policies).
- Migrations are numbered SQL under `supabase/migrations/` (`095_…`, `096_…`), applied via the Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset); never hand-edit `full-schema.sql`.
- Don't run blocking supabase-py I/O in async handlers — audit write uses `run_in_threadpool`/`aexec` (D-v2.5-01).
- Multi-worker uvicorn (`WORKER_COUNT=2`) — the startup seed must be idempotent + concurrent-safe (ON CONFLICT DO NOTHING).
- Local↔cloud is a pure env-var switch — `OPERATOR_EMAILS` behaves identically local + cloud; no hardcoded IDs/paths.
- Settings vs env — `OPERATOR_EMAILS` is legitimately env (bootstrap/infra), not a runtime `app_settings` value.
- Deployment parity (operator-gated) — SET `OPERATOR_EMAILS` + REMOVE `BACKPRESSURE_ADMIN_USER_IDS` in Coolify, paste migrations into cloud Supabase SQL editor, at the same promotion (docs/DEPLOYMENT-WORKFLOW.md).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is already installed and verified in `requirements.txt` + live imports; nothing new to add.
- Architecture: HIGH — every pattern (router gate, yield-dep audit, idempotent seed, no-router ActiveView) has a shipped precedent cited file:line.
- Schema: HIGH — `harness_audit` precedent + live-schema org_id audit; the two Claude's-discretion choices (free-text action, no-org_id-on-principal) are documented with reversible-if-wrong risk.
- 404 byte-shape: MEDIUM (A1) — standard behavior, pinned by a Wave-0 test rather than trusted blind.
- Pitfalls: HIGH — grounded in the milestone SUMMARY's security findings + this codebase's own service-role/audit/test idioms.

**Research date:** 2026-07-10
**Valid until:** ~2026-08-10 (stable substrate; the only fast-moving item is FastAPI, and the 404 behavior is pinned by test).
