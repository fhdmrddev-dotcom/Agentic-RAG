---
phase: 146-operator-foundation
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - backend/.env.example
  - backend/app/api/admin.py
  - backend/app/config.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/services/operator_service.py
  - backend/tests/conftest.py
  - backend/tests/test_146_operator_gate.py
  - backend/tests/test_146_operator_seed.py
  - backend/tests/unit/test_backpressure.py
  - frontend/src/App.tsx
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/HealthSignals.tsx
  - frontend/src/components/admin/LockedTab.tsx
  - frontend/src/components/admin/OperatorBand.tsx
  - frontend/src/components/admin/RecentActionsCard.tsx
  - frontend/src/components/admin/TechnicalNamesToggle.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/hooks/useOperatorProbe.test.ts
  - frontend/src/hooks/useOperatorProbe.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/nav-items.test.ts
  - supabase/full-schema.sql
  - supabase/migrations/095_operator_foundation.sql
  - supabase/migrations/096_org_id_stub_sweep.sql
findings:
  critical: 2
  warning: 4
  info: 9
  total: 15
fixed: 6
remaining: 9
status: fixes_applied
fix_pass:
  date: 2026-07-11
  scope: critical_warning
  fixed: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04]
  remaining: info-only (IN-01..IN-09, out of --fix scope)
  commits:
    CR-01: 683216f2
    CR-02: 21990f41
    WR-01: 36ce6149
    WR-02: 8e3239ed
    WR-03: 50d71349
    WR-04: 145e9b7c
---

# Phase 146: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** standard
**Files Reviewed:** 28
**Status:** fixes_applied (all 2 Critical + 4 Warning fixed 2026-07-11; 9 Info remain, out of `--fix` scope)

## Fix Pass — 2026-07-11

All Critical and Warning findings were fixed with root-cause changes, each in its own
atomic commit; the 9 Info findings are out of the `--fix` scope and remain open.

| Finding | Status | Commit | Note |
|---|---|---|---|
| CR-01 | ✅ Fixed | `683216f2` | client unwraps `{entries}` envelope + regression test |
| CR-02 | ✅ Fixed | `21990f41` | read `deps._pg_pool` live; falsifiable non-zero test |
| WR-01 | ✅ Fixed | `36ce6149` | probe keyed to `userId`; re-probe/clear on session change |
| WR-02 | ✅ Fixed | `8e3239ed` | `/admin` auto_error=False bearer folds absent/invalid → 404 |
| WR-03 | ✅ Fixed | `50d71349` | verb + `is_write` floor derived from HTTP method (logic — human-verify on first write endpoint) |
| WR-04 | ✅ Fixed | `145e9b7c` | conftest `OPERATOR_EMAILS=""` guard — no real-DB seed in unit tests |

## Summary

Phase 146 ships the operator foundation: migrations 095/096 (operator_users + append-only operator_audit_log, deny-all RLS, org_id stubs), a router-level `require_operator` gate with a byte-identical 404, an audit floor, `OPERATOR_EMAILS` startup seeding, and a probe-gated Control Room frontend.

Scoping note: the configured `diff_base` (56c033a6, a 075.4-era commit) predates several shipped milestones and would have dragged unrelated work into scope; the review was re-scoped to the actual phase-146 commit window (`49895081..HEAD`), which matches the configured file list exactly.

**The core security machinery is sound**: the gate is default-deny at the router (a future /admin endpoint cannot forget it), the 404 body is genuinely byte-identical to the unknown-route 404 for authenticated non-operators (verified: no custom exception handlers in `main.py`, both paths hit FastAPI's default `http_exception_handler`), all operator SQL is parameterized (`$1`, `$1::text[]` — no string interpolation anywhere), the seed is `ON CONFLICT DO NOTHING` idempotent, `full-schema.sql` is consistent with migrations 095+096 (tables, PK/FK, index, RLS-enable, all four org_id stubs), and the frontend probe is correctly render-only.

**But the Control Room itself is broken for real operators**: the audit-feed client casts a `{"entries": [...]}` envelope to a bare array, which crashes the entire Control Room React tree the moment the audit fetch resolves (CR-01). Separately, the "Database connections" health signal is structurally always 0 due to a stale from-import snapshot of the asyncpg pool singleton (CR-02 — pre-existing from Phase 078, but re-authored and newly surfaced in this phase's UI). Neither defect is caught by the phase's tests: no frontend test covers `getOperatorAudit`, and the backend backpressure tests monkeypatch a module attribute (`app.dependencies._pg_pool`) that `admin.py` never re-reads, then assert only key presence.

Four warnings follow: the probe is keyed to App mount instead of the auth session (operator gets no shield after a fresh SPA sign-in; stale operator state leaks across a same-tab user switch), the non-discoverability contract does not hold for unauthenticated probes (403/401 vs 404 enumeration), the audit-floor fallback would mislabel future write endpoints as reads, and the new lifespan seed performs privilege-granting writes against the real local DB from the unit-test suite.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `getOperatorAudit` response-shape mismatch crashes the Control Room for real operators — BLOCKER

**Status:** ✅ Fixed 2026-07-11 — commit `683216f2`. `getOperatorAudit` now unwraps `body.entries ?? []` (mirroring `getAuditLogs`); added `frontend/src/lib/api.operatorAudit.test.ts` pinning the unwrap.

**File:** `frontend/src/lib/api.ts:3564-3570`, `backend/app/api/admin.py:131`, `frontend/src/components/admin/ControlRoomPage.tsx:233,237`
**Issue:** The backend audit feed returns an envelope:

```python
# backend/app/api/admin.py:131
return {"entries": entries}
```

but the client casts the raw JSON to a bare array:

```ts
// frontend/src/lib/api.ts:3569
return (await res.json()) as OperatorAuditRow[]
```

The `as` assertion silences TypeScript, so `ControlRoomPage` stores the `{entries: [...]}` object into `auditRows` state. On the next render, `auditRows.slice(0, OVERVIEW_PREVIEW)` (ControlRoomPage.tsx:233) throws `TypeError: auditRows.slice is not a function` (plain objects have no `.slice`); `rows.map` in `AuditTab.tsx:53` / `RecentActionsCard.tsx:52` fails identically. There is no error boundary above this tree (App.tsx renders ChatLayout bare), so the whole app subtree unmounts — a real operator gets a white screen as soon as the audit fetch resolves after entering the Control Room. The `.catch(() => {})` on the fetch does not help: the fetch succeeds; the crash is in render. The side effects mask each other in review: `auditRows.length > 0` evaluates `undefined > 0 → false`, so the tab count-pill silently never appears either. No vitest covers `getOperatorAudit` (only `getOperatorProbe` is tested), which is how this shipped.
**Fix:**

```ts
export async function getOperatorAudit(limit?: number): Promise<OperatorAuditRow[]> {
  const headers = await getAuthHeaders()
  const qs = limit != null ? `?limit=${encodeURIComponent(limit)}` : ""
  const res = await fetch(`${API_BASE}/admin/audit${qs}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the operator audit feed.", res.status)
  const body = (await res.json()) as { entries: OperatorAuditRow[] }
  return body.entries ?? []
}
```

The codebase already models this envelope correctly elsewhere (`entries: AuditEntry[]` at api.ts:2361) — mirror that. Add a contract test pinning the unwrap.

### CR-02: `postgres_pool_in_use` is structurally always 0 — stale from-import snapshot of the pool singleton — BLOCKER

**Status:** ✅ Fixed 2026-07-11 — commit `21990f41`. `admin.py` now reads the live `deps._pg_pool` at call time (via `import app.dependencies as deps`) instead of a from-import snapshot; added a falsifiable test that installs a fake pool via the production rebind seam and asserts `postgres_pool_in_use == 7`.

**File:** `backend/app/api/admin.py:24,76-80` (origin: Phase 078; re-authored in this phase's import block)
**Issue:** `admin.py` does `from app.dependencies import _pg_pool` at module import time, when the singleton is `None`. `get_pg_pool()` later rebinds `app.dependencies._pg_pool` to the real pool, but Python from-imports copy the binding — `app.api.admin._pg_pool` stays `None` forever. So:

```python
pg_in_use = 0
if _pg_pool is not None:   # always False in production
    pg_in_use = _pg_pool.get_size() - _pg_pool.get_idle_size()
```

The Control Room's "Database connections" card — one of the four signals this phase puts in front of the operator, on a surface whose design theme is honesty — will always render 0. The tests cannot catch it: they monkeypatch `app.dependencies._pg_pool` (which `admin.py` never re-reads) and assert only that the key exists (`test_backpressure_response_shape`), not that the value ever reflects a live pool. Pre-existing from Phase 078, but Phase 146 rewrote this exact import statement and shipped the first consumer of the value.
**Fix:**

```python
import app.dependencies as deps
...
if deps._pg_pool is not None:
    pg_in_use = deps._pg_pool.get_size() - deps._pg_pool.get_idle_size()
```

(or add a sync accessor `get_pg_pool_if_ready()` in dependencies.py). Add a test that installs a fake pool via the same seam production uses and asserts a non-zero reading.

## Warnings

### WR-01: Operator probe keyed to App mount, not the auth session — no shield after fresh sign-in; stale operator state across a user switch

**Status:** ✅ Fixed 2026-07-11 — commit `36ce6149`. `useOperatorProbe(userId)` is now keyed to the authenticated user id (App passes `user?.id ?? null`): re-probes on user change, clears operator state on sign-out, one probe per session, fail-closed. Tests cover signed-out no-probe, re-probe on fresh sign-in, and stale-state clear on a same-tab user switch.

**File:** `frontend/src/hooks/useOperatorProbe.ts:35-52`, `frontend/src/App.tsx:47`
**Issue:** The probe runs exactly once, in a `useEffect(..., [])` at App mount. Two real flows break:

1. **Fresh sign-in:** on the login screen there is no session, so `getAuthHeaders()` rejects ("Not authenticated") and the probe resolves `null`. When the operator then signs in (SPA state change via `onAuthStateChange` — no page reload), the effect never re-fires. Result: a legitimate operator sees no shield and cannot reach the Control Room until they happen to hard-refresh. The feature silently does not exist in the primary sign-in path.
2. **Same-tab user switch:** after signOut → signIn as a *different, non-operator* user, the stale `isOperator=true` and the *previous operator's identity* (including their email in `OperatorBand`) persist. The non-operator sees the shield and can open the (data-empty, correctly 404-gated) Control Room shell — violating the D-07 "nav byte-identical for non-operators" contract render-side and leaking the prior operator's email.

**Fix:** key the probe to the authenticated user — accept the user id (or read it from `useAuth`) and re-run/clear on change:

```ts
export function useOperatorProbe(userId: string | null): UseOperatorProbe {
  ...
  useEffect(() => {
    if (!userId) { setIdentity(null); setLoading(false); return }
    setLoading(true)
    ...probe...
  }, [userId])
}
```

In `App.tsx`: `useOperatorProbe(user?.id ?? null)`. This preserves the one-probe-per-session budget (Pitfall 4) while fixing both flows.

### WR-02: Non-discoverability contract does not hold for unauthenticated probes — /admin routes are enumerable without a token

**Status:** ✅ Fixed 2026-07-11 — commit `8e3239ed`. Added a dedicated `_admin_bearer_scheme = HTTPBearer(auto_error=False)` used only by the gate via a new `authenticate_operator_request` dependency that folds absent AND invalid/expired credentials into the same byte-identical 404. The shared `get_current_user` path is untouched. Regression test asserts an unauthenticated `/admin/backpressure` is byte-identical to the unknown-route 404.

**File:** `backend/app/dependencies.py:15` (`bearer_scheme = HTTPBearer()`), `backend/app/dependencies.py:150-166`
**Issue:** The 404-not-403 contract is enforced only *after* authentication. `HTTPBearer()` defaults to `auto_error=True`, so a request with **no** Authorization header to any real /admin route returns **403 "Not authenticated"**, and a bad token returns **401** — while `/admin/anything-else` returns 404 (routing fails before dependencies run). An anonymous scanner can therefore distinguish existing gated routes (`/admin/me`, `/admin/backpressure`, `/admin/audit` → 403/401) from nonexistent ones (→ 404), defeating the "the surface is non-discoverable" claim made in admin.py's module docstring and the gate test's docstring. The tests only pin the authenticated-non-operator case. This grants no access — but the entire premise of choosing 404 over 403 was that a non-operator "cannot tell an /admin route exists-but-forbidden vs. simply not existing," and today anyone without a JWT can tell.
**Fix:** if the contract is meant to be absolute, give /admin its own credential handling that folds auth failures into the same 404 — e.g. a `HTTPBearer(auto_error=False)` used only by `require_operator`, raising `_NOT_FOUND` when credentials are absent/invalid — and add a test asserting an unauthenticated `/admin/backpressure` matches the unknown-route response. If the contract is deliberately JWT-scoped, correct the docstrings so the shipped claim matches the shipped behavior.

### WR-03: Audit-floor fallback mislabels future write endpoints as reads

**Status:** ✅ Fixed 2026-07-11 — commit `50d71349` (logic fix — human-verify recommended when the first write endpoint lands). `_derive_action` derives the verb from the method (GET → `view`, POST/PUT/PATCH/DELETE → `write`) and the floor derives `is_write` from the method when the endpoint didn't set `request.state.audit_is_write`. Unit test pins `_derive_action` across methods and the known-path override.

**File:** `backend/app/dependencies.py:140-147,190`
**Issue:** The floor's route-derived fallback always produces `"<area>.view"` (`_derive_action`) and `is_write` defaults to `False` — regardless of HTTP method. The floor exists so a future /admin endpoint gets audited "by construction" even when its author forgets the explicit `request.state.audit_*` enrichment. But if a Phase-147+ author adds `POST /admin/users/{id}/disable` and forgets the state-set, the ledger records a harmless-looking `users.view` read with no ✎ mark — the floor under-reports exactly the destructive actions it exists to catch, and the free-text `action` column (deliberately no CHECK, mig 095) means nothing downstream will flag it.
**Fix:** derive the verb and write-flag from the method in the fallback:

```python
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

def _derive_action(request: Request) -> str:
    ...
    verb = "view" if request.method == "GET" else "write"
    return f"{area}.{verb}"

# in operator_audit_floor:
is_write = getattr(request.state, "audit_is_write", request.method in _WRITE_METHODS)
```

### WR-04: Lifespan operator seed performs privilege-granting writes against the real local DB from the unit-test suite

**Status:** ✅ Fixed 2026-07-11 — commit `145e9b7c`. Added `os.environ.setdefault("OPERATOR_EMAILS", "")` to `backend/tests/conftest.py`'s env block (before the app import), so the lifespan seed short-circuits at the empty-list check with zero pool activity — no real-DB role grants as a side effect of running unit tests.

**File:** `backend/app/main.py:254-259`, `backend/tests/conftest.py:146-149`, `backend/app/config.py:726,892`
**Issue:** The `client` fixture runs `TestClient(app)` as a context manager, which executes the full lifespan — now including `seed_operators_from_env()`. `Settings` reads `backend/.env` (`env_file=".env"`, config.py:726) and `postgres_dsn` defaults to the live local Supabase Postgres (`127.0.0.1:54322`, config.py:892). conftest neutralizes SUPABASE_URL/keys via `os.environ.setdefault` but sets **no** `OPERATOR_EMAILS` guard. On a dev machine with the local stack up and `OPERATOR_EMAILS` populated in `.env` (the documented setup), every TestClient startup connects to the real DB and INSERTs real `operator_users` rows — a role-granting write fired as a side effect of running unit tests. The pre-existing `_migrate_settings_override` block set the precedent for real-DB lifespan access in tests, but this phase extends it from a read-mostly migration to a security-relevant grant.
**Fix:** one line in conftest.py's env block, before the app import:

```python
os.environ.setdefault("OPERATOR_EMAILS", "")
```

(real env vars take precedence over `.env` in pydantic-settings, so the seed short-circuits at the empty-list check with zero pool activity — exactly what `test_seed_noop_when_no_emails` pins).

## Info

### IN-01: `/admin/audit` `limit` query param is unvalidated

**File:** `backend/app/api/admin.py:119`
**Issue:** `limit: int = 50` accepts negative and unbounded values; a bad value reaches PostgREST and collapses to `[]` via the swallow-all in `get_recent_operator_audit` (silent, misleading empty feed).
**Fix:** `limit: int = Query(50, ge=1, le=500)`.

### IN-02: Silent `except Exception: pass` on the pg-pool signal

**File:** `backend/app/api/admin.py:79-80`
**Issue:** The Redis branch logs a warning on failure; the pool branch swallows silently — inconsistent, and would have made CR-02 harder to diagnose even if the snapshot bug were fixed.
**Fix:** `except Exception as exc: logger.warning("backpressure: pool stats unavailable: %s", type(exc).__name__)`.

### IN-03: Audit labels have two sources of truth

**File:** `backend/app/dependencies.py:130-133`, `backend/app/api/admin.py:59-60,128-129`
**Issue:** `_AUDIT_LABELS` maps `/admin/backpressure` and `/admin/audit` to the same label/action strings the endpoints also set explicitly via `request.state` — the dict entries are dead in practice (state wins) and will drift silently if either side is edited alone.
**Fix:** keep the endpoint state-sets as the single source and reduce `_AUDIT_LABELS` to the generic fallback, or drop the endpoint state-sets and let the dict drive.

### IN-04: `operator_override` fixture is unused

**File:** `backend/tests/conftest.py:174-195`
**Issue:** Defined this phase, used by no test (all 146 tests correctly drive the real gate via the asyncpg mock instead). Dead test code until a future phase adopts it.
**Fix:** keep only if Phase 147/148 plans consume it; otherwise delete.

### IN-05: `OperatorIdentity.granted_at` typed `string` but can be `null`

**File:** `frontend/src/lib/api.ts` (interface `OperatorIdentity`), `backend/app/api/admin.py:112-113`
**Issue:** `/admin/me` returns `granted_at: null` when the `operator_users` read misses or errors (`get_operator_record` returns None on any failure). The TS type claims non-null. Currently benign (only `email` is rendered), but the lie will bite the first consumer of `granted_at`.
**Fix:** `granted_at: string | null`.

### IN-06: Migration 095 mixes idempotent and non-idempotent DDL

**File:** `supabase/migrations/095_operator_foundation.sql:52`
**Issue:** Tables use `CREATE TABLE IF NOT EXISTS` but the index is a bare `CREATE INDEX` — an accidental re-paste into the SQL editor half-succeeds (tables no-op) then errors on the index.
**Fix:** `CREATE INDEX IF NOT EXISTS idx_operator_audit_created ...`.

### IN-07: Append-only ledger is convention-only at the DB layer

**File:** `supabase/migrations/095_operator_foundation.sql:39-63`
**Issue:** RLS deny-all blocks client roles, but the service-role backend (and any SQL-editor session) can UPDATE/DELETE `operator_audit_log` rows freely — "append-only" and "tamper-resistant" rest entirely on app discipline. Matches the mig-059 harness_audit precedent, so this is an accepted posture, but worth recording: a `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION` trigger would make the immutability claim structural.
**Fix:** optional hardening trigger in a future migration; at minimum keep the claim scoped to "no client role can touch it" in docs.

### IN-08: Refresh honesty beat pulses "recorded" even when nothing was recorded

**File:** `frontend/src/components/admin/ControlRoomPage.tsx:139-158`
**Issue:** `handleRefresh` flashes the "every action recorded" marker unconditionally — including when `getBackpressure()` failed at the network layer (no request reached the floor, no ledger row exists). On a surface explicitly designed around "the ledger IS the receipt," the pulse can assert a receipt that doesn't exist.
**Fix:** only pulse when the backpressure call resolved (set a flag in the first `try` block).

### IN-09: Gate-enumeration test covers only GET routes despite claiming "every current AND future /admin route"

**File:** `backend/tests/test_146_operator_gate.py:20-28`
**Issue:** `_admin_get_paths()` filters on `"GET" in methods`. A future POST/DELETE /admin endpoint is still protected by the router gate itself, but escapes this regression lock — the test's docstring promises more than it checks.
**Fix:** enumerate all methods and issue `client.request(method, url, ...)` per route (skipping HEAD/OPTIONS), or rename the test's claim to GET-only.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
