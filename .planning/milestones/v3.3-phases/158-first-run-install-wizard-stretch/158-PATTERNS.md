# Phase 158: First-Run Install Wizard (STRETCH) - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 41 (new + modified)
**Analogs found:** 38 with a concrete in-repo analog / 41 total (3 are prose/config edits with a sibling, not a code analog)

> Every excerpt below was read from the live file this session — paths + line numbers are load-bearing. The wizard is **~90% composition of shipped seams** (RESEARCH "Key insight"): the failure mode is *re-implementing* a seam that then drifts. Each new file's job is to **call** the analog seam, not fork it.

---

## File Classification

### Backend — NEW
| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `backend/app/middleware/setup.py` | middleware | request-response (gate) | `backend/app/middleware/maintenance.py:80` | **exact** (copy shape, invert polarity) |
| `backend/app/services/setup_store.py` | service | file-I/O | `backend/app/security/secret_cipher.py:55-76` (lazy env read) + stdlib `secrets`/`json`/`tempfile` | role-match |
| `backend/app/services/setup_service.py` | service | request-response / transform | `backend/app/services/health_probe.py:45-113` + `operator_service.py:136` | **exact** (probes) / role-match (bootstrap) |
| `backend/app/api/setup.py` | route | request-response | `backend/app/api/admin.py:128` (router+dep) + `main.py:577` (`/health` open route) | role-match (token-gated, not operator-gated) |
| `supabase/migrations/102_setup_complete.sql` | migration | CRUD (DDL) | `supabase/migrations/097_operator_flags.sql` | **exact** |

### Backend — MODIFIED
| Modified File | Role | Data Flow | Analog / self-precedent | Match |
|---------------|------|-----------|-------------------------|-------|
| `backend/app/config.py` | config | transform (overlay) | `config.py:790-829` (`resolve_llm_provider` post-load mutator) | self-precedent |
| `backend/app/main.py` | bootstrap | event-driven + wiring | `main.py:324` (un-wrapped hard-fail precedent) · `:559` (mw add) · `:604-628` (router include) | self-precedent |
| `backend/app/models/user_settings.py` | model | CRUD | `user_settings.py:910` (`maintenance_mode()`) | **exact** (sibling helper) |

### Frontend — NEW
| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `frontend/src/pages/SetupWizard.tsx` | page | request-response (step host) | `components/admin/ControlRoomPage.tsx:36-93` (full-page tab machine, no router) | role-match |
| `frontend/src/components/setup/SetupTokenGate.tsx` | component | form | `pages/AuthPage.tsx:15-43` (centered card) + `components/auth/SignInForm.tsx` (fields) | role-match |
| `frontend/src/components/setup/EnvironmentDetectCard.tsx` | component | read-only display | `components/admin/HealthSignals.tsx:249-274` (dot+label tiles) | role-match |
| `frontend/src/components/setup/PresetPickerStep.tsx` | component | form (radiogroup) | `settings/ProviderPicker.tsx:187-195` (`<select>`) + `admin/CapabilityGrid` card | role-match |
| `frontend/src/components/setup/ConnectionBindStep.tsx` | component | form + probe | `settings/ProviderPicker.tsx:273-291` (masked `Eye`/`EyeOff`) | **exact** (masked secrets) |
| `frontend/src/components/setup/SchemaGuidancePanel.tsx` | component | display (copy block) | amber notice + copy button (no direct analog — compose) | partial |
| `frontend/src/components/setup/OperatorBootstrapStep.tsx` | component | form | `components/auth/SignUpForm.tsx` (email+password+confirm) | role-match |
| `frontend/src/components/setup/ProviderKeyStep.tsx` | component | form | **reuse** `settings/ProviderPicker.tsx` (whole) | **exact** (reuse) |
| `frontend/src/components/setup/SmokeChecklist.tsx` | component | display + gated verdict | **reuse** `admin/HealthSignals.tsx` rows + `workflows/PublishGauntlet.tsx:453,548` gate | **exact** (reuse) |
| `frontend/src/components/setup/FinalizedLockout.tsx` | component | display | `workflows/PublishGauntlet.tsx` success card + centered CTA | role-match |
| `frontend/src/lib/setupApi.ts` | utility | request-response | `lib/api.ts:13,75-83` (`API_BASE`; **but NOT** `getAuthHeaders`) | role-match (inverted: unauth + `X-Setup-Token`) |

### Frontend — MODIFIED
| Modified File | Role | Data Flow | Analog / self-precedent | Match |
|---------------|------|-----------|-------------------------|-------|
| `frontend/src/App.tsx` | page | request-response (branch) | `App.tsx:161-163` (`!user` → `AuthPage`) + `:23-62` (`MaintenanceBanner` probe/poll) | self-precedent |
| `frontend/src/lib/supabase.ts` | config | request-response (runtime cfg) | `lib/supabase.ts:1-6` (the eager init to harden) | self (rewrite defensive) |
| `frontend/src/lib/api.ts` | utility | request-response | `api.ts` `getMaintenanceStatus` (public/unauth GET sibling) | self-precedent |

### Scripts / deploy / docs
| File | New/Mod | Role | Analog / sibling |
|------|---------|------|------------------|
| `scripts/check-deploy-drift.sh` | NEW | script (batch) | `scripts/pending-cloud-migrations.sh` (**exact** style) |
| `docker-compose.prod.yml` | MODIFIED | config | its own `backend` service + `env_file:` (add `setup_data:/data` volume) |
| `docs/OPERATOR.md` | MODIFIED | docs | Step-3 seed list (reflect volume + wizard) — prose, no code analog |
| `CLAUDE.md` | MODIFIED | docs | "## Deployment (cloud)" same-commit rule siblings — prose |
| `.github/workflows/frontend-tests.yml` (or new `deploy-artifacts.yml`) | MOD/NEW | CI | the existing `vitest`/`playwright` job shape |

### Tests — NEW / MODIFIED
| File | Role | Analog | Match |
|------|------|--------|-------|
| `backend/tests/test_setup_gate.py` | test (ASGI) | `test_147_maintenance_mw.py` (whole) | **exact** |
| `backend/tests/test_setup_token.py` | test | `test_147_maintenance_mw.py` (monkeypatch seam) | **exact** |
| `backend/tests/test_setup_overlay.py` | test | `test_150_save_seam.py` (monkeypatch `settings` attr) | role-match |
| `backend/tests/test_setup_boot_tolerant.py` | test | `test_147_maintenance_mw.py:189-211` (bare TestClient, no lifespan) | role-match |
| `backend/tests/test_setup_operator.py` | test | `test_150_save_seam.py` `_StubPool` + mock supabase | role-match |
| `backend/tests/test_setup_probe.py` | test | `test_150_save_seam.py` `_StubPool` (mock asyncpg/redis) | role-match |
| `backend/tests/test_setup_finalize.py` | test | `test_150_save_seam.py` idiom | role-match |
| `backend/tests/test_setup_idempotent.py` | test | `test_147` allowlist-boundary style | role-match |
| `backend/tests/test_setup_smoke.py` | test | `test_147_health_probe.py` / `test_150_save_seam.py` | role-match |
| `backend/tests/test_setup_status.py` | test | `test_setup_overlay` sibling | role-match |
| `backend/tests/test_setup_provider.py` | test | `test_150_save_seam.py` (**exact** encrypt-on-write) | **exact** |
| `backend/tests/conftest.py` | test (fixtures) MODIFIED | `conftest.py:233-254,564-571` | self-precedent |
| `frontend/src/pages/__tests__/SetupWizard.test.tsx` | test | existing vitest `__tests__` dirs | role-match |
| `frontend/src/lib/__tests__/supabase.test.ts` | test | existing vitest | role-match |

---

## Pattern Assignments

### `backend/app/middleware/setup.py` (middleware, request-response gate)

**Analog:** `backend/app/middleware/maintenance.py:80-113` — **copy the pure-ASGI class shape verbatim, invert the polarity** (maintenance blocks only mutating+non-allowlisted; setup blocks *everything* except the allowlist until finalized, then latches to a literal no-op).

**The class shape to copy** (`maintenance.py:80-113`):
```python
class MaintenanceMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        method = str(scope.get("method", "GET")).upper()
        path = scope.get("path", "")
        if ( method in _BLOCKED_METHODS and not _is_allowlisted(method, path) and _read_maintenance() ):
            response = JSONResponse(status_code=503, content={"error": "maintenance", ...})
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
```

**The cached-flag read to copy** (`maintenance.py:48-61`) — fail-safe, in-memory, NO per-request DB. For setup, replace with the **sticky-True latch** (RESEARCH Pattern 4): once `setup_finalized()` returns True, cache in a module global and never read the file again (the byte-identical hot path = one bool check, zero I/O).

**Allowlist boundary match to copy** (`maintenance.py:64-77`) — note the segment-boundary check that prevents `/administrate` from matching `/admin` (tested at `test_147_maintenance_mw.py:142-152`):
```python
for prefix in _ALLOWLIST_PREFIXES:
    if path == prefix or path.startswith(prefix + "/"):
        return True
```
Setup allowlist (post-nginx `/api` strip — backend sees unprefixed): exact `/health`, exact `/public-config`, prefix `/setup`.

**Registration** — `main.py:559` registers `MaintenanceMiddleware` **before** CORS so CORS is outermost (a 503 still carries CORS headers). Register `SetupMiddleware` in the same neighborhood.

**Pitfall:** NEVER `BaseHTTPMiddleware` — it buffers the SSE stream (the whole reason maintenance.py is pure-ASGI; `maintenance.py:9-13`). Do NOT read the DB `setup_complete` flag here — the file marker is the sole gate authority (a DB blip must never bounce live users into the wizard, D-05).

---

### `backend/app/services/setup_service.py` — submitted-value probes (service, request-response)

**Analog:** `backend/app/services/health_probe.py:45-113` — the bounded-timeout best-effort probe shape. **Adapt: test the SUBMITTED values via throwaway connections, never the `get_*` singletons** (RESEARCH Pattern 5).

**probe shape to copy** (`health_probe.py:45-55`, `:58-77`):
```python
async def probe_redis() -> dict:
    from app.dependencies import get_redis
    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=_PROBE_TIMEOUT_S)
        return _up(t0)
    except Exception as exc:
        logger.warning("health probe: Redis unreachable (%s)", type(exc).__name__)   # sanitized — no host leak
        return {"state": "down", "latency_ms": None}
```
Setup version builds a **throwaway** `asyncpg.connect(dsn)` / `aioredis.from_url(url)` from the request body, probes, closes. Schema sentinel: `SELECT to_regclass('public.app_settings') IS NOT NULL`. Return ONLY `type(exc).__name__` + plain message (SSRF telemetry — RESEARCH Anti-Patterns).

**Operator bootstrap** reuses the `operator_users` upsert from `operator_service.py:163-167`:
```python
await pool.execute(
    "INSERT INTO operator_users (user_id, granted_by, note) "
    "VALUES ($1, NULL, 'env-bootstrap') ON CONFLICT (user_id) DO NOTHING",
    r["id"],
)
```
Setup version: create the auth user first via `sb.auth.admin.create_user({"email","password","email_confirm": True})` (supabase-py is **blocking** → `run_in_threadpool`; RESEARCH Pattern 6), then upsert with note `'setup-wizard'`. **Ordering is load-bearing: schema bootstrap → operator create** (the `on_auth_user_created` trigger needs its tables, Pitfall 6).

---

### `backend/app/api/setup.py` (route, request-response)

**Analog (router + dependency gate):** `backend/app/api/admin.py:128-132`:
```python
# The single load-bearing security line: default-deny at the router (Pattern 1).
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
```
Setup **inverts** this: the `/setup/*` **write** routes gate on `Depends(require_setup_token)` (pre-auth, token-gated, NOT operator-gated); `GET /setup/status` and `GET /public-config` are **open** (in the middleware allowlist). The token dependency also asserts `not setup_finalized()` → 409 (RESEARCH Code Examples :591-596).

**Open-route precedent:** `main.py:577-590` (`/health`) — a top-level unauthenticated route returning a plain dict; `/public-config` mirrors it, returning ONLY `supabase_url` + `supabase_anon_key` (both public by design — never a secret; RESEARCH :610-620).

**Flag-write precedent (D-05 DB half):** `admin.py:507-557` (`PUT /admin/flags`) shows the honest write-through: call `save_app_settings({...})`, and **surface a False return as a real 500** (never a false success) — the finalize step writes `setup_complete` the same way.

**Pitfall:** the setup router is a pre-auth surface with **no RLS backstop** (v3.3 red-line, RESEARCH :759) — a missing token check on ANY `/setup/*` write is a full config-write hole. `secure-phase` verifies each mitigation.

---

### `backend/app/config.py` — the store-overlay (config, transform)

**Self-precedent:** `config.py:790-829` (`resolve_llm_provider`, a `@model_validator(mode="after")` that mutates `self` post-load). The overlay is the same idea but sourced from `/data/setup.json`. RESEARCH (Component Responsibilities) **recommends a thin loader wrapper** (`apply_setup_overlay(settings)` / `load_settings_with_overlay()`) over `BaseSettings` surgery.

**The required fields it overlays** (`config.py:745-941`):
```python
supabase_url: str                 # :745  — required; onebox ships a "<project-ref>" PLACEHOLDER
supabase_service_role_key: str    # :746
redis_url: str = "redis://localhost:6379"    # :907
postgres_dsn: str = "postgresql://..."       # :916
operator_emails: str = ""         # :928  (app-tier, but seeded from store on restart)
secrets_encryption_key: str = ""  # :941
```

**Critical polarity (RESEARCH Pattern 1):** the overlay must be **store-WINS-over-env** for the enumerated infra keys — NOT the usual env-wins — because the onebox preset ships placeholders that are technically "set". `_is_placeholder(v)` = `not v or ("<" in v and ">" in v)`. Entry check (`needs_setup`) is a **static string check**, never a live DB probe (a blip must not re-trigger the wizard).

---

### `backend/app/main.py` — setup-mode-tolerant lifespan + wiring (bootstrap)

**The ONE crash path to guard** (RESEARCH Pattern 3 — verified line-by-line, every other startup step is already `try/except`): `main.py:356-357`:
```python
from app.services.audit_service import assert_action_types_synced
await assert_action_types_synced(await get_pg_pool())   # UN-wrapped — awaits an unreachable DB in setup mode
```
Guard it (and skip spawning the four background reconcilers at `:376/:399/:421/:453`) behind `if not _setup_mode:`. `_setup_mode = not setup_finalized()` — a cheap file read, no DB.

**Precedent for a deliberately un-wrapped hard-fail** (so you match the house style when re-enabling it post-finalize): `main.py:324` (`_validate_and_report_cipher()` — un-wrapped by design so a malformed key refuses startup). The best-effort blocks around it (`:308-312`, `:346-350`) show the `try/except → log + continue` posture the setup-mode guard mirrors.

**Middleware add:** `main.py:559` (`app.add_middleware(MaintenanceMiddleware)`) — add `SetupMiddleware` alongside, before CORS.
**Router include:** `main.py:604-628` (the `app.include_router(...)` block) — add `setup.router` (+ the `/public-config` route).

---

### `backend/app/models/user_settings.py` — `setup_complete()` helper (model, CRUD)

**Analog (exact sibling):** `user_settings.py:910-922`:
```python
def maintenance_mode() -> bool:
    """... INVERTED polarity: a cold-cache / DB-read failure returns False ..."""
    try:
        return load_app_settings().maintenance_mode
    except Exception:  # noqa: BLE001 — defensive: default-OPEN (False) on cold cache / read failure
        return False
```
Add `setup_complete()` right beside it (RESEARCH Code Example :601-607) — default `False` on cold cache. **This is the AUDITABLE DB signal only — NOT the gate authority** (the file marker is, D-05).

**The provider-key write seam the wizard REUSES (do not fork):** `save_app_settings():277-373`. Encrypt-on-write is already the ONE seam (`:339-350`): with a key set, each `SECRET_COLUMNS` value becomes an `enc:v1:` envelope before the parameterized UPDATE. The wizard calls this server-side and inherits encryption for free (D-12).

---

### Frontend: `App.tsx` pre-auth branch (page, request-response)

**Self-precedent (the branch):** `App.tsx:153-163`:
```jsx
if (loading) {
  return ( <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /> </div> )
}
if (!user) {
  return <AuthPage onSignIn={signIn} onSignUp={signUp} />
}
```
Add the `needs_setup` branch **before** `if (!user)`: a public `GET /api/setup/status` probe (+ a `window.location.pathname === "/setup"` check, D-06) → `return <SetupWizard/>`. Post-finalize `/setup` renders `<FinalizedLockout/>`.

**Self-precedent (the public status probe/poll):** `App.tsx:23-62` (`MaintenanceBanner`) — a `useEffect` that polls a public endpoint (`getMaintenanceStatus`), resolves `false` on any failure, guards `setState` against unmount, 30s cadence. The startup `needs_setup` probe is the one-shot version of this.

---

### Frontend: `lib/supabase.ts` — defensive init + runtime hydrate (config)

**Self (the fragile init to harden):** `supabase.ts:1-6` (the WHOLE file):
```typescript
import { createClient } from "@supabase/supabase-js"
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
**Pitfall 4 (RESEARCH):** a placeholder `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`) → `new URL()` inside supabase-js **throws at import** → white-screens the whole SPA including `/setup`. Because `useAuth.ts:20-25` calls `supabase.auth.getSession()` at mount, the client MUST construct without throwing. Rewrite defensively (swap a placeholder for `http://localhost:54321`) + add `export async function hydrateSupabaseFromRuntime(apiBase)` that fetches `/public-config` and overlays real creds (RESEARCH Pattern 8, exact code at :437-459). `export let supabase` (reassignable) instead of `const`.

---

### Frontend: `lib/setupApi.ts` (utility, request-response) — the ANTI-analog

**Analog to DIVERGE from:** `api.ts:75-83`:
```typescript
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")   // ← setup calls must NEVER hit this
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}
```
Setup writes are **pre-auth** — routing them through `getAuthHeaders` throws "Not authenticated" (RESEARCH Anti-Patterns). `setupApi.ts` uses a **separate** unauthenticated helper carrying `X-Setup-Token: <token>` and reusing `const API_BASE = import.meta.env.VITE_API_BASE_URL` (`api.ts:13`). The public `getSetupStatus()` / `getPublicConfig()` GETs can live in `api.ts` beside `getMaintenanceStatus` (unauth sibling).

---

### The reused UI primitives (the wizard is ~90% these)

#### Step rail → `components/skills/studio/LifecycleStepper.tsx`
The `full`/`strip` variant stepper (`:31` variant prop; `:239-255` node render). Copy the tone map + glyph + connector (`:92-96`, `:205`):
```typescript
const NODE_TONE = {
  ok: "bg-emerald-500/15 border-emerald-500 text-emerald-500",
  warn: "bg-amber-500/15 border-amber-500 text-amber-500",
  dim: "bg-muted border-border text-muted-foreground",
} as const
// ...
const glyph = done || (here && stage.ok) ? "✓" : here ? "!" : String(i + 1)
```
Completed nodes are `<button aria-label={`Go to ${s.name}`}>` (`:241-249`) — the click-to-revisit idempotency (D-14) + a11y is already solved. Generalize the 4 domain stages → 6 wizard steps (`Detect · Preset · Connect · Operator · Provider · Smoke`).

#### Green-checklist → `components/admin/HealthSignals.tsx`
The status-dot vocabulary is the smoke checklist (`:117-133`):
```typescript
const DEP_DOT: Record<DepStatus, string> = {
  up: "bg-success", slow: "bg-amber-400", down: "bg-destructive",
  off: "bg-muted-foreground/40", unknown: "bg-muted-foreground/25",   // off/unknown NEUTRAL — never red (Pitfall 6)
}
const DEP_STATUS_LABEL: Record<DepStatus, string> = { up: "Healthy", slow: "Slow", down: "Down", off: "off by config", unknown: "—" }
```
Tile markup to clone (`:253-274`): `rounded-[10px] border border-border bg-card px-3.5 py-3`, dot + label + `text-sm font-semibold` value + `text-[11px] text-muted-foreground` sub. **Honesty lock:** a not-yet-run row is neutral, never optimistically green (a row is green ONLY when the server says so). Drives both `EnvironmentDetectCard` (read-only tiles) and `SmokeChecklist` (5 rows).

#### Masked secret inputs → `components/settings/ProviderPicker.tsx`
The `Eye`/`EyeOff` masked-input for the 4 Supabase keys + `POSTGRES_DSN` + `REDIS_URL` + provider key (`:273-291`):
```jsx
<Input
  type={showKey ? "text" : "password"}
  value={isMasked ? "" : value.api_key}
  placeholder={isMasked ? "Key saved — enter new key to replace" : "Enter API key…"}
  onChange={(e) => onChange({ ...value, api_key: e.target.value || "" })}
  className="h-8 text-xs font-mono bg-muted/30 ghost-border pr-8"
/>
{!isMasked && (
  <button type="button" onClick={() => setShowKey((s) => !s)}
    aria-label={showKey ? "Hide API key" : "Show API key"}>
    {showKey ? <EyeOff .../> : <Eye .../>}
  </button>
)}
```
Also reuse the preset `<select>` (`:187-195`) for `PresetPickerStep` and the always-on 🔒 endpoint footer (`:204-222`). `ProviderKeyStep` **reuses `<ProviderPicker>` whole** with `@/lib/providerLogo` (@lobehub) icons.

#### Gated verdict + elapsed + focus-trap → `components/workflows/PublishGauntlet.tsx`
The `Finalize` button = the ONLY gate, disabled-until-all-green (`:453`, `:548`):
```typescript
const canPublish = goldenInput.trim().length > 0 && !loading   // :453
// ...
<button disabled={!canPublish} ...>                            // :548
```
The live elapsed clock while a server op runs (`PublishingNotice`, `:380-404`, `data-testid="publish-elapsed"`, reduced-motion-gated) → the smoke-run + finalize in-flight notice. The Escape/Tab focus contract for the finalize confirm (`:696-724`) + `max-w-2xl` centered container (`:762`).

#### Full-page shell → `components/admin/ControlRoomPage.tsx`
The wizard's `SetupWizard.tsx` shell mirrors this: a full-page component holding a **tab/step state machine (no react-router)** + an `OperatorBand`-style header band (`:36-93`). The Control Room is entered with an identity prop and a tab; `SetupWizard` is entered on the `needs_setup` branch and holds `currentStep` state.

#### Centered-card + form → `pages/AuthPage.tsx` + `components/auth/SignInForm.tsx` / `SignUpForm.tsx`
`AuthPage.tsx:15-43` is the centered-card shell (`max-w-md`, gradient orbs, `CardHeader`/`CardContent`) the `SetupTokenGate` first screen mirrors. The actual email/password/confirm + inline-error field markup lives in `SignInForm.tsx` (token gate) / `SignUpForm.tsx` (operator bootstrap) — **planner: read those two files for the exact field/error markup** (not read this pass; ~thin form components).

---

### `supabase/migrations/102_setup_complete.sql` (migration, DDL)

**Analog (exact):** `supabase/migrations/097_operator_flags.sql`:
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false;
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
```
102 is one line (`ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false`). **Copy the apply header verbatim** (097 lines 8-16): paste into the LOCAL Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit both files. Keep the `INSERT ... ('global') ON CONFLICT DO NOTHING` (the A6 gotcha — `save_app_settings` UPDATEs `WHERE id='global'`; a missing row = silent no-op, Pitfall 5). **CLOUD PARITY still pending** (migs 099/100/101 + `SECRETS_ENCRYPTION_KEY` — MEMORY) → add 102 to that list.

---

### `scripts/check-deploy-drift.sh` (script, batch)

**Analog (exact style):** `scripts/pending-cloud-migrations.sh`:
```bash
set -euo pipefail                                    # :26
TARGET_REF="${1:-HEAD}"                              # clear usage + arg override
BASE_REF="${BASE_REF:-origin/production}"
PENDING=$(git diff --name-only --diff-filter=A "${BASE_REF}" "${TARGET_REF}" -- supabase/migrations/ | sort)
```
Copy the header-comment discipline (why it exists / usage / notes), `set -euo pipefail`, non-zero exit on drift. **Critical finding (RESEARCH Pattern 9):** a naive `onebox.env.example` vs `backend/.env.example` diff yields **41 false positives** → check #1 MUST carry an `OMITTED_FROM_ONEBOX` allowlist seeded with the 41 known-optional keys. Four checks: preset keys · OPERATOR.md seed-list vs `supabase/migrations/` · sandbox tag (`101.1`) consistency · `docker compose -f docker-compose.prod.yml config` parses (incl. the new `setup_data` volume).

---

### Backend tests (analogs are exact)

#### `test_setup_gate.py` → `backend/tests/test_147_maintenance_mw.py` (the whole file is the template)
The ASGI-gate idiom (`:33-90`): a tiny `_make_app()` wired with ONLY `SetupMiddleware` + dummy routes for each allowlist branch; drive the flag by monkeypatching the middleware's read seam:
```python
@pytest.fixture
def on_client(monkeypatch):
    monkeypatch.setattr(mw, "_read_maintenance", lambda: True)   # → for setup: patch the finalize latch
    return TestClient(_make_app())
```
Copy: the 503-body assertion (`:96-101`), the prefix-boundary test (`/administrate` NOT allowlisted, `:142-152`), the **byte-identical no-op** proof (`test_configured_box_noop` — latched passthrough), and the **bare-TestClient-no-lifespan** trick (`:189-211`) for the boot-tolerant test (`test_setup_boot_tolerant.py` asserts `assert_action_types_synced` is NOT called in setup mode).

#### `test_setup_provider.py` / `test_setup_operator.py` / `test_setup_probe.py` → `test_150_save_seam.py` (`_StubPool` idiom)
Drive the **data-access layer the seam actually uses** (MEMORY lesson: match mocks to the data-access layer). The `_StubPool` records `pool.execute(sql, *args)` so you assert the value that landed (`:28-55`); toggle the key via `monkeypatch.setattr(settings, "secrets_encryption_key", ...)` (`:48-49`). `test_setup_provider.py` asserts the provider key writes an `enc:v1:` envelope through `save_app_settings` (copy `test_encrypts_on_write` `:58-73` verbatim — same seam, D-12).

#### `conftest.py` (MODIFIED) → self-precedent
Add a temp `SETUP_STORE_PATH` fixture (`tmp_path` + `monkeypatch.setenv`) + mock asyncpg/redis/supabase for submitted-value probes. Reuse `_reset_pg_pool_singleton` (autouse, `:233-254`) and `mock_asyncpg_pool` (`:564-571`) as-is — they already reset the event-loop-bound singleton between tests.

---

## Shared Patterns

### Authentication / access control (the pre-auth token gate)
**Source:** `backend/app/api/admin.py:128-132` (router `dependencies=[Depends(require_operator)]`) + RESEARCH Code Example `:591-596`.
**Apply to:** every `/setup/*` **write** route.
The setup surface **inverts** the operator gate: `Depends(require_setup_token)` (constant-time `hmac.compare_digest`, RESEARCH :581-584) + a finalize-latch assert (`not setup_finalized()` → 409). The backend runs on service-role with **no RLS backstop** (RESEARCH :759) — this in-app gate is the sole authority, exactly like `/admin`. Never log the token beyond the single boot announcement.

### Error handling / probe sanitization
**Source:** `backend/app/services/health_probe.py:53-55` — `logger.warning("... (%s)", type(exc).__name__)` + return `{"state":"down"}`.
**Apply to:** all `setup_service.py` probes + `save_app_settings`-backed writes.
Return ONLY `type(exc).__name__` + a plain message to the browser (SSRF telemetry — never raw connection errors that leak internal topology). Surface a `save_app_settings` False return as a real 500, never a false success (`admin.py:540-548`).

### Encrypt-on-write (inherited, do NOT fork)
**Source:** `backend/app/models/user_settings.py:339-350` + `backend/app/security/secret_cipher.py:47-87`.
**Apply to:** the provider-key step (D-12).
The wizard calls `save_app_settings({..._api_key})` server-side and inherits `SECRET_COLUMNS` encrypt-on-write for free. Needs `SECRETS_ENCRYPTION_KEY` in the infra tier; blank ⇒ Phase-150 fail-open plaintext + boot warning (surface it in the wizard). **Never hand-roll a second encrypt path** (RESEARCH "Don't Hand-Roll").

### Lazy connection singletons (the restart-to-apply boundary)
**Source:** `backend/app/dependencies.py:18-105` (`_supabase:18`, `_redis:28`, `_pg_pool:55` module globals).
**Apply to:** the finalize apply-step decision.
Each is a **per-process** module global; under `WORKER_COUNT=2` one worker's re-init leaves the sibling stale (RESEARCH Pattern 2). **Verdict: `docker compose restart backend` is the apply step** (a command, not file-editing — SC#3 holds; a fresh box has zero live users). The wizard's own probes use **throwaway** connections so validation succeeds without the restart.

### Cached-flag gate, fail-safe polarity
**Source:** `backend/app/models/user_settings.py:910-922` (`maintenance_mode()` fail-OPEN) + `main.py:577-590` (`/health` public boolean).
**Apply to:** `setup_complete()` (DB signal, default False) + `GET /api/setup/status`.
Mirror the no-raise posture. But the **gate authority is the file marker, not this DB flag** (D-05) — the middleware latch reads the file, `setup_complete()` is auditable-only.

### Design language (G-2 reuse mandate — no fresh sketch)
**Source:** `Skill("sketch-findings-agentic-rag")` (auto-loads for these surfaces) + `frontend/src/index.css` `.dark` tokens.
**Apply to:** all wizard components. Deep Midnight dark-only; 4 type roles (Manrope/Inter/JetBrains Mono); `--primary #A3A5FF` reserved for active-step + single primary CTA + focus ring only; status = success/amber/destructive trio, never colour-alone (dot **+** word). Contract fully specified in `158-UI-SPEC.md`.

---

## No Analog Found

| File | Role | Data Flow | Reason / guidance |
|------|------|-----------|-------------------|
| `frontend/src/components/setup/SchemaGuidancePanel.tsx` | component | display (copy-to-clipboard SQL) | No shipped "copy this SQL block" primitive. Compose: an **amber** notice (not destructive — schema-missing is guidance, not error) + a mono code block + a copy button (`navigator.clipboard`). Content = OPERATOR.md Step-3 sequence (full-schema + 9 ordered seeds + the `('global')` row). Closest tone reference: the amber `overrideReceipt` in `LifecycleStepper.tsx:150-155`. |
| `docs/OPERATOR.md` | docs | prose | Reflect the new `setup_data` volume + the wizard path (Steps 2-5 become "open the browser"). No code analog — edit the existing Home-B runbook prose. Drift-check #2 tracks its seed-list. |
| `CLAUDE.md` | docs | prose | Add the same-commit deployment-artifact sync rule (exact wording in RESEARCH :476). Joins the existing "## Deployment (cloud)" / sandbox-tag sync-rule siblings. |

**Note:** the setup-store file (`setup_store.py`) has no single file analog — it composes stdlib `secrets.token_urlsafe(32)` / `json` / `tempfile` (atomic write + `os.chmod(0o600)` + `os.replace`), with the lazy-env-read idiom borrowed from `secret_cipher.py:55-64`. RESEARCH gives the exact code (`:205-232`, `:568-584`).

---

## Metadata

**Analog search scope:** `backend/app/{middleware,services,models,api,security,config,main}.py` · `frontend/src/{App.tsx,pages,components/{admin,skills/studio,workflows,settings,auth},lib,hooks}` · `scripts/` · `supabase/migrations/` · `backend/tests/`
**Files scanned (read this pass):** 24 (maintenance.py, health_probe.py, config.py, main.py ×2, user_settings.py ×2, operator_service.py, secret_cipher.py, dependencies.py ×2, admin.py ×2, App.tsx, supabase.ts, useAuth.ts, nginx.conf, api.ts, LifecycleStepper.tsx, HealthSignals.tsx, ProviderPicker.tsx, PublishGauntlet.tsx [grep+targeted], ControlRoomPage.tsx, AuthPage.tsx, pending-cloud-migrations.sh, 097_operator_flags.sql, test_147_maintenance_mw.py, test_150_save_seam.py, conftest.py ×3)
**Pattern extraction date:** 2026-07-17
