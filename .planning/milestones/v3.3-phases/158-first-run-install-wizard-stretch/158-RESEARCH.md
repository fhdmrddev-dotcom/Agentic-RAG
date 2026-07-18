# Phase 158: First-Run Install Wizard (STRETCH) - Research

**Researched:** 2026-07-17
**Domain:** Self-host first-run provisioning — FastAPI lifespan/middleware/BaseSettings overlay, pure-ASGI gate, asyncpg/redis/supabase re-bind, Supabase Auth admin bootstrap, Vite runtime-config shim, pre-auth threat model
**Confidence:** HIGH (every load-bearing external API verified against official docs or the live codebase; two ecosystem framings MEDIUM)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-18 — verbatim intent)

- **D-01 — Two tiers, two homes.** Infra/bootstrap tier (`SUPABASE_URL` + 4 Supabase keys, `POSTGRES_DSN`, `REDIS_URL`, `SECRETS_ENCRYPTION_KEY`) → a **setup-store file** on a mounted volume. App-level tier (provider keys, `OPERATOR_EMAILS`, model pins, retrieval knobs, `setup_complete`) → **`app_settings`** via the Phase-150 encrypted `save_app_settings` seam. Rationale: `env_file:` is read once at container create; the container can't mutate its own env or write `./.env` (not bind-mounted); the DB can't hold its own connection string.
- **D-02 — Setup-store = a JSON file on a NEW persistent volume; config layer overlays env.** Add `setup_data:/data` to `backend`; wizard writes `/data/setup.json` (0600). `Settings` load gains an overlay: real env var → else setup-store → else default. Finalize re-initializes the asyncpg pool + Redis + Supabase client in-process; **restart-to-apply is the documented fallback**. Research resolves which is safe.
- **D-03 — Boot must be setup-mode-tolerant.** Lifespan must degrade, not crash, when DB/Redis unreachable. `supabase_url` is required but the preset ships a placeholder so it's never literally absent — setup-mode triggers on the **finalize marker being unset**, not config absence.
- **D-04 — `SetupMiddleware` mirrors `MaintenanceMiddleware` exactly.** Pure-ASGI, registered alongside Maintenance at `main.py:559`, cached flag. Gates all routes except allowlist (`/setup`, `/api/setup/*`, `/health`, `/api/public-config`, static). Literal no-op once finalized.
- **D-05 — Finalize marker: local file first (blip-proof), DB flag second (auditable).** Gate authority = file marker (`finalized: true`). DB `setup_complete` boolean (mig 102, `setup_complete()` helper beside `maintenance_mode()`). Finalize writes BOTH. Setup-needed = file marker absent/false.
- **D-06 — No react-router; pre-auth branch + literal `/setup` path.** Pre-auth branch in `App.tsx` (~line 161) on a public `GET /api/setup/status` probe → render `<SetupWizard/>`. Honor `/setup` via `window.location.pathname`. Post-finalize `/setup` = "already configured" lock-out. Real react-router is an allowed planner alternative; pathname check is the lean path.
- **D-07 — Runtime public-config endpoint so login works without a frontend rebuild (SHOULD).** `GET /api/public-config` → `{supabase_url, supabase_anon_key}`; `frontend/src/lib/supabase.ts` reads it at startup, overlaying the baked `VITE_*`. `/setup` never talks to Supabase directly. Fallback: document build-time `VITE_*` + warn on mismatch.
- **D-08 — Env-detect is LIGHT.** Probe: setup-store present? pre-set env reachable? in Docker? → informs defaults/pre-fill, not heavy auto-discovery.
- **D-09 — Preset pick: one-box is the default/primary.** Managed/on-prem selectable but only pre-fill defaults + show OPERATOR.md variant guidance. Not a multi-preset engine.
- **D-10 — Supabase/Redis bind: collect + validate LIVE, server-side.** Reuse `health_probe.probe_*` adapted to test **submitted** values (throwaway connections). Detect DB **schema presence** (sentinel table). If absent: MVP **guides** (show/copy OPERATOR.md Step-3 sequence). Server-side "run it for me" is a **SHOULD**, research-gated on asyncpg executing the `pg_dump` artifact.
- **D-11 — Bootstrap operator = create the first admin account directly.** Collect operator email+password; create the Supabase auth user via the **Auth admin API** → upsert `operator_users` (reuse `seed_operators_from_env`'s ON CONFLICT DO NOTHING) → persist `OPERATOR_EMAILS` to the setup-store. Operator can log in immediately.
- **D-12 — Provider keys: one required, matching the onebox preset.** Collect default LLM provider + key (+ optional embedding), persist via `save_app_settings` (auto-encrypted). One provider required (OpenAI default). Validated in the smoke step.
- **D-13 — Smoke test = green-checklist, and IS the finalize gate.** Validate: (1) Supabase Auth reachable, (2) Postgres reachable + schema present, (3) Redis PING, (4) provider key works, (5) operator row exists. Reuse `HealthSignals.tsx` / `PublishGauntlet.tsx`. All-green unlocks Finalize; any red blocks with a plain-language fix.
- **D-14 — Idempotent + hard lock-after-finalize.** Every step safe to re-run. After finalize refuse all config writes → "already configured." Re-config is an `/admin` operator action, never the public wizard.
- **D-15 — Security: DEDICATED THREAT MODEL REQUIRED.** First-boot **setup token** generated on first unfinalized boot, printed to backend stdout/logs, required on every `/api/setup/*` write. Rate-limit the token check; never log secrets; finalize lock is the boundary; be SSRF-aware on submitted URLs. `secure-phase` verifies every mitigation.
- **D-16 — `scripts/check-deploy-drift.sh` + same-commit CLAUDE.md sync rule.** 4 checks: preset keys vs `backend/.env.example`; OPERATOR.md seed-list vs `supabase/migrations/`; sandbox-tag consistency; `docker compose -f docker-compose.prod.yml config` parses (incl. new `setup_data` volume). Wire into CI + GSD gate.
- **D-17 — G-2 override (recorded to STATE.md); G-6 failure criteria; byte-identical invariant.** Wizard reuses shipped operator-approved patterns (`LifecycleStepper`/`HealthSignals`/`PublishGauntlet`/`ControlRoomPage`/`MaintenanceBanner`) — no fresh sketch. G-6 failure modes (a)–(f) are the verification bar.
- **D-18 — Explicit MVP cut-lines.** MUST = the 13 items satisfying all 3 SCs. SHOULD = D-07 public-config, D-10 auto-runner, D-09 managed/on-prem pre-fills. DEFER = full react-router, multi-preset engine, on-prem/BYO variants, ClamAV, **the live end-to-end operator UAT**.

### Claude's Discretion (from CONTEXT.md)
Setup-store file format (JSON vs dotenv) + exact `/data` mount path; the exact `/api/setup/*` endpoint shape + step ordering; whether the config overlay lives in `config.py` or a thin wrapper; the wizard component decomposition; CI job placement for the drift-check — planner/executor decide, honoring D-01..D-18.

### Deferred Ideas (OUT OF SCOPE)
- Live end-to-end operator UAT (operator-gated, analog of Phase 157's D-09 smoke) — code-complete + verify-work + secure-phase are autonomous; the live run needs a human at a browser against a real/local Supabase.
- Server-side DB-bootstrap "run it for me" beyond the schema-absent guarded path (SHOULD, not MUST).
- Full react-router migration.
- Managed / BYO-cloud / on-prem wizard variants beyond pre-fills.
- Malware scanning (ClamAV) on uploads.
- Multi-preset engine + preset authoring.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DEPLOY-02** (STRETCH) | A non-developer operator completes first-run setup through an idempotent, lock-after-finalize browser wizard at `/setup`, without hand-editing files. | Config-overlay + setup-store (Pattern 1); setup-mode-tolerant boot (Pattern 3 — the single crash path at `main.py:357` identified); pure-ASGI `SetupMiddleware` with a monotonic finalized-latch (Pattern 4); operator bootstrap via verified `auth.admin.create_user` (Pattern 6); schema-presence probe + verified asyncpg multi-statement feasibility (Pattern 7); public-config shim for SC#3 honesty (Pattern 8); drift-check (Pattern 9). All three ROADMAP Success Criteria are traced in the Validation Architecture map. |
</phase_requirements>

## Summary

Phase 158 is **not** a new-technology phase — it is a **provisioning-orchestration** phase built almost entirely by composing shipped seams (the Phase-147 `MaintenanceMiddleware` shape, the Phase-150 encrypted `save_app_settings`, the Phase-146 `operator_users` upsert, the Phase-147 `health_probe.probe_*`, and the Phase-137/147 frontend `LifecycleStepper`/`HealthSignals`/`PublishGauntlet` primitives). The genuinely new engineering is four small, load-bearing mechanisms: (1) a **config overlay** that reads a mounted `/data/setup.json` on top of env; (2) a **setup-mode-tolerant lifespan** that no longer hard-crashes on an unreachable DB; (3) a **pure-ASGI setup gate** that latches to a literal no-op once finalized; and (4) a **pre-auth, token-gated `/setup` API** that mints the first operator. Everything else is wiring and UI reuse.

Two facts were verified against authoritative sources and change the plan shape. First, **asyncpg's `Connection.execute()` runs multi-statement SQL scripts when no arguments are passed** `[CITED: magicstack.github.io/asyncpg]`, and `supabase/full-schema.sql` is clean for it (0 `COPY … FROM stdin`, 0 psql `\` meta-commands — verified by grep), so the D-10 "run it for me" auto-runner is *technically feasible* — but non-idempotent `CREATE TABLE` and an `auth.users` trigger privilege risk keep it a SHOULD behind a schema-absent probe; the **guide/copy path is the safe MUST**. Second, **`supabase.auth.admin.create_user({"email","password","email_confirm": True})` is the correct, real signature** `[CITED: supabase.com/docs/reference/python]` for the D-11 operator bootstrap (sync → wrap in `run_in_threadpool`; must run *after* schema bootstrap so the `on_auth_user_created` trigger has its tables).

The single most important boot finding: the lifespan's one **un-guarded** DB-touching hard-fail is `assert_action_types_synced(await get_pg_pool())` at `main.py:357` — every other startup step is already best-effort `try/except`. Guarding exactly that call (plus not spawning the background reconcilers) in setup mode is the whole of D-03.

**Primary recommendation:** Ship the MUST cut-line as: a JSON setup-store at `/data/setup.json` (0600) whose enumerated infra keys **override** env in the overlay; a **static, blip-proof** setup-needed check (marker absent AND infra still placeholder) with a **monotonic finalized-latch** gate; a **`docker compose restart backend` apply step** (in-process re-init is unreliable under `WORKER_COUNT=2`); a token-gated `/setup` router that validates submitted values via **throwaway** connections, guides DB bootstrap, mints the operator, and writes the dual finalize marker. Include the D-07 public-config shim — without it SC#3 ("no hand-editing files") is not truly met, because the browser's Supabase creds are otherwise baked at build.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Setup-store persistence (infra tier) | **Backend / mounted volume** | — | Values are needed *before* the DB is reachable; must live on a writable file the container owns (`/data/setup.json`). |
| App-level config (provider keys, operator email, flags) | **Database (`app_settings`)** | Backend (`save_app_settings`) | Only needed *after* the DB is reachable; reuses the Phase-150 encrypt-on-write seam. |
| Config overlay (env → store → default) | **Backend (`config.py` load path)** | — | The single point where the two tiers merge into the running `Settings`. |
| Setup gate / finalize latch | **Backend (pure-ASGI middleware)** | — | Must be byte-transparent to SSE and enforce before any router; the frontend branch is UX only, never the security wall. |
| Setup entry signal (`needs_setup`) | **Backend (`GET /api/setup/status`)** | Frontend (`App.tsx` branch) | The backend owns the authoritative marker; the SPA merely renders the wizard vs auth page. |
| Runtime public-config (browser Supabase creds) | **Backend (`GET /api/public-config`)** | Frontend (`supabase.ts` bootstrap) | Vite bakes `VITE_*` at build; only a runtime fetch lets the wizard-entered URL reach the browser without a rebuild. |
| Live connection validation | **Backend (throwaway probes)** | — | Submitted secrets must never reach the browser; the backend tests them and returns pass/fail only. |
| Operator account creation | **Backend (Supabase Auth admin API)** | Database (`operator_users`) | Service-role admin call + audit upsert are trusted-server-only. |
| Wizard step UI / stepper / green-checklist | **Frontend (composed primitives)** | — | Pure presentation over the backend's `/setup/*` responses. |
| Deployment-artifact drift-check | **CI / repo tooling (bash)** | — | Static repo invariants; no runtime surface. |

## Standard Stack

This phase introduces **zero new runtime dependencies** — it is built entirely from already-declared packages. Versions below are read from `backend/requirements.txt` and verified in-repo.

### Core (all already present)
| Library | Version (in-repo) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| FastAPI | `0.115.6` `[VERIFIED: requirements.txt]` | `/setup` + `/public-config` routers, pure-ASGI middleware, lifespan | Already the app framework; `MaintenanceMiddleware` is the exact model |
| pydantic-settings | `2.7.0` `[VERIFIED: requirements.txt]` | `Settings(BaseSettings)` — the overlay target (`config.py:742`) | Already the config layer |
| asyncpg | `>=0.29` `[VERIFIED: requirements.txt]` | Throwaway DB probe + (SHOULD) schema bootstrap runner | Already the hot-path pool; `execute()` runs multi-statement scripts |
| redis (`redis.asyncio`) | `>=5.2,<6` `[VERIFIED: requirements.txt]` | Throwaway Redis PING probe | Already the streaming client (`get_redis`) |
| supabase (supabase-py) | `>=2.29.0` `[VERIFIED: requirements.txt]` | `auth.admin.create_user`, schema-sentinel select | Already the Supabase client; admin API is service-role-only |
| cryptography (Fernet/MultiFernet) | `>=44.0.0` `[VERIFIED: requirements.txt]` | Inherited transitively via `save_app_settings` encrypt-on-write | Phase-150 seam; the wizard gets encryption for free |
| Python stdlib `secrets` | 3.x | Setup-token generation (`token_urlsafe`) | Cryptographically secure; no dependency |
| Python stdlib `json` | 3.x | Setup-store read/write | No dependency |

### Frontend (all already present)
| Component | Location | Reuse role |
|-----------|----------|------------|
| `LifecycleStepper` | `frontend/src/components/skills/studio/LifecycleStepper.tsx` | Wizard step rail |
| `HealthSignals` | `frontend/src/components/admin/HealthSignals.tsx` | Green-checklist smoke |
| `PublishGauntlet` | `frontend/src/components/workflows/PublishGauntlet.tsx` | Per-stage pass/block gated finalize |
| `ControlRoomPage` | `frontend/src/components/admin/ControlRoomPage.tsx` | Full-page shell pattern |
| `MaintenanceBanner` | `frontend/src/App.tsx:23` | Model for the setup-state probe/branch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pathname-check pre-auth branch (D-06) | `react-router` | Real routing enables deep-linking but is a net-new dependency + an app-wide refactor; DEFERRED per D-18. The `window.location.pathname` check is 5 lines. |
| JSON setup-store | dotenv-format store | dotenv round-trips into `os.environ` more naturally, but JSON is unambiguous for nested/typed values, matches Ghost's `config.production.json` precedent, and is trivial to `chmod 600` + parse. **Recommend JSON.** |
| Restart-to-apply | In-process pool/client re-init | In-process is unreliable under `WORKER_COUNT=2` (see Pattern 2). **Recommend restart.** |

**Installation:** No `pip install` / `npm install` step. (If the planner adds a dev-only test helper, verify it first with the ecosystem command below.)

**Version verification performed:**
```bash
# All already in backend/requirements.txt — confirmed present, no new installs:
#   fastapi==0.115.6 · pydantic-settings==2.7.0 · asyncpg>=0.29
#   redis>=5.2,<6 · supabase>=2.29.0 · cryptography>=44.0.0
```

## Package Legitimacy Audit

**No external packages are introduced by this phase.** Every backend capability composes already-declared, long-established dependencies; the frontend composes already-shipped components; D-06 explicitly avoids adding `react-router` or `cmdk`-style helpers.

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(none — phase adds no new package)* | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none (none proposed).
**Packages flagged as suspicious [SUS]:** none.

*slopcheck was available at research time (`slopcheck AVAILABLE`) but had nothing to check — the phase installs nothing. If planning later introduces a package, run the Package Legitimacy Gate before adding it.*

## Architecture Patterns

### System Architecture Diagram

```
FRESH BOX (no /data/setup.json marker)                 CONFIGURED BOX (finalized:true)
──────────────────────────────────────                ──────────────────────────────
Browser GET /  ──► nginx ──► index.html                Browser GET /  ──► nginx ──► index.html
   │                                                       │
   ▼  App.tsx bootstrap                                    ▼  App.tsx bootstrap
GET /api/public-config ─(nginx strip)─► /public-config  GET /api/public-config ─► {real supabase url,key}
   ▼                                                       ▼  supabase client overlays baked VITE_*
GET /api/setup/status ─► /setup/status                  GET /api/setup/status ─► {needs_setup:false}
   │  {needs_setup:true, has_token:true}                   │
   ▼                                                       ▼  useAuth → AuthPage → ChatLayout (BYTE-IDENTICAL)
render <SetupWizard/>                                    (SetupMiddleware = latched no-op; single bool check)
   │
   │  each step POSTs with header  X-Setup-Token: <from docker logs>
   ▼
┌─────────────────────── /setup/* router (token-gated, pre-auth) ───────────────────────┐
│ 1 env-detect   store-present? env reachable? in-docker?  (light)                        │
│ 2 preset pick  one-box default → pre-fill                                               │
│ 3 bind+validate  throwaway asyncpg/redis/supabase(submitted vals) → probe schema-present │
│      └─ schema ABSENT → GUIDE (show/copy full-schema.sql + 9 seeds + global row)         │
│                          └─ (SHOULD) "run it for me": conn.execute(full_schema) [gated]  │
│ 4 operator     supabase.auth.admin.create_user(email_confirm=True) → operator_users upsert│
│ 5 provider key  save_app_settings({..._api_key}) → auto-encrypted (Phase-150 seam)       │
│ 6 smoke         5-way green checklist  ─── all green ──► ENABLE Finalize                  │
│ 7 finalize      write /data/setup.json {finalized:true,...}  +  app_settings.setup_complete│
│                 └─ respond "restart to apply"  (docker compose restart backend)           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
   ▼ (writes)
/data/setup.json (0600)  ◄── overlay source for config.py on next boot
   ▼ restart
Boot: Settings overlay (env → /data/setup.json → default) → marker latched → gate no-op
```

*File-to-implementation mapping is in Component Responsibilities below, not the diagram.*

### Recommended Project Structure (new files)
```
backend/app/
├── api/setup.py               # /setup/* router (token-gated) + /public-config (open)
├── middleware/setup.py        # SetupMiddleware (pure-ASGI, mirrors maintenance.py)
├── services/setup_store.py    # read/write /data/setup.json (0600), finalized-latch, token
├── services/setup_service.py  # validate-submitted probes, schema-presence, operator bootstrap, (SHOULD) schema runner
supabase/migrations/102_setup_complete.sql   # app_settings.setup_complete boolean
frontend/src/
├── pages/SetupWizard.tsx      # step host (LifecycleStepper) + status branch
├── components/setup/*         # step panels (compose HealthSignals/PublishGauntlet)
└── lib/setupApi.ts            # UNAUTHENTICATED fetch helpers (X-Setup-Token, NOT getAuthHeaders)
scripts/check-deploy-drift.sh  # D-16 drift-check
```

### Component Responsibilities
| File | Owns |
|------|------|
| `config.py` (edit) | The overlay: after `Settings()` loads, merge `/data/setup.json` values for the enumerated infra keys. **Recommend a thin loader wrapper** (`load_settings_with_overlay()`) over editing `BaseSettings` internals. |
| `main.py` (edit) | Register `SetupMiddleware` before CORS (`:559` neighborhood); guard `assert_action_types_synced` + reconciler spawns in setup mode (`:357`+); include the two new routers. |
| `middleware/setup.py` | Pure-ASGI gate; monotonic finalized-latch; allowlist. |
| `services/setup_store.py` | The blip-proof file authority: `setup_finalized()` (sticky-True latch), `read_store()`, `write_store()` (atomic + 0600), `get_or_create_token()`. |
| `services/setup_service.py` | Submitted-value probes, schema-sentinel, `bootstrap_operator()`, `(SHOULD) run_schema_bootstrap()`. |
| `api/setup.py` | Wire order + token dependency + `GET /public-config` (reads infra tier, NEVER secrets). |
| `user_settings.py` (edit) | `setup_complete()` helper beside `maintenance_mode()` (`:910`). |

---

### Pattern 1: Two-tier config with a store-overrides-env overlay + blip-proof entry detection

**What:** Infra values live in `/data/setup.json`; the config load overlays them onto env. **The overlay precedence for the enumerated infra keys must be store-wins-over-env** — *not* the usual env-wins — because the onebox preset ships placeholders (`SUPABASE_URL=https://<project-ref>.supabase.co`) that are technically "set" env vars. If env won, the placeholder would shadow the wizard's real value. `[VERIFIED: deploy/onebox.env.example L36 placeholder]`

**Entry detection (resolves a real G-6(a) risk):** "setup-needed = marker absent" (D-05 as written) would show the wizard on a **hand-filled** 157-style box that has no marker file. Reconcile by making the entry check **static and blip-proof**: `needs_setup = (not finalized_marker) AND (infra config is still placeholder/blank)`. A pure string check (`"<project-ref>" in supabase_url or not supabase_url`) — **no live DB probe**, so a DB blip can never re-trigger the wizard (honors D-05's blip-proof intent). A hand-filled box has a real URL → `needs_setup=false` even without a marker. Lock-out after finalize is the marker (Pattern 4).

**Example:**
```python
# services/setup_store.py  — Source: pattern derived from config.py:742 + onebox placeholder
import json, os, secrets, tempfile
from pathlib import Path

STORE_PATH = Path(os.getenv("SETUP_STORE_PATH", "/data/setup.json"))
INFRA_KEYS = (  # D-01 infra tier — the ONLY keys the store overrides
    "supabase_url", "supabase_anon_key", "supabase_service_role_key",
    "supabase_publishable_key", "supabase_secret_key",
    "postgres_dsn", "redis_url", "secrets_encryption_key",
)

def read_store() -> dict:
    try:
        return json.loads(STORE_PATH.read_text())
    except Exception:
        return {}

def write_store(data: dict) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(STORE_PATH.parent))     # atomic write
    with os.fdopen(fd, "w") as f:
        json.dump(data, f)
    os.chmod(tmp, 0o600)
    os.replace(tmp, STORE_PATH)                                # 0600, atomic

def _is_placeholder(v: str) -> bool:
    return (not v) or ("<" in v and ">" in v)                  # onebox sentinel style
```
```python
# config.py  — thin overlay wrapper (Claude's Discretion: wrapper, not BaseSettings surgery)
def apply_setup_overlay(settings) -> None:
    store = read_store()
    for k in INFRA_KEYS:
        v = store.get(k)
        if v:                       # STORE WINS for infra keys (placeholder-safe)
            setattr(settings, k, v)
    # re-run the provider resolver if the store changed llm creds (mirrors config.py:790)
```

**When to use:** Always, for the infra tier. App-level tier never touches the store (it goes to `app_settings`).

### Pattern 2: Apply infra config via restart, not in-process re-init (the `WORKER_COUNT=2` verdict)

**What:** After the wizard writes the store, the running app must pick up the new infra config. The pools are lazy module-global singletons (`dependencies.py`: `_supabase:21`, `_redis:31`, `_pg_pool:79`). In-process re-init *seems* possible (close old, create new, reassign the global) — **but the app runs `WORKER_COUNT=2` uvicorn workers** (`deploy/onebox.env.example:58`), each a separate process with its **own** module globals. A finalize request lands on **one** worker; re-initializing that worker's singletons leaves the **sibling worker on stale placeholder config** until it is recycled. There is no in-process way for one worker to re-init its siblings.

**Verdict:** **`docker compose restart backend` is the recommended apply step.** It is a *command*, not file-editing, so SC#3 ("without hand-editing files") still holds. A fresh box has **zero live users**, so a restart is disruption-free — the byte-identical/no-bounce concern only applies to already-configured boxes, which never traverse this path. Crucially, the wizard's own validation and writes use **throwaway** connections built from the submitted values (Pattern 5), so they succeed *without* a restart; the restart only promotes the config to steady-state. `[CITED: fastapi lifespan model + uvicorn --workers process model]` `[VERIFIED: dependencies.py singletons + onebox WORKER_COUNT=2]`

**Anti-pattern:** Do NOT attempt to hot-swap the global pool while serving. Even single-worker, swapping `_pg_pool` mid-flight races in-flight `acquire()` holders. If a single-worker convenience re-init is added, gate it on `WORKER_COUNT==1` and treat restart as the contract.

### Pattern 3: Setup-mode-tolerant lifespan — the ONE crash path

**What:** On a fresh/unbound box the DB is a placeholder/unreachable. The lifespan (`main.py:286`) must degrade, not crash. **Audit result (verified line-by-line):**

| Startup step | Line | DB-touch? | Guarded today? | Action in setup mode |
|--------------|------|-----------|----------------|----------------------|
| AnyIO limiter bump | 291 | no | n/a | none |
| Redis boot PING | 300–304 | redis | ✅ try/except+timeout | none (logs "unreachable") |
| `_migrate_settings_override` | 308–312 | pg | ✅ try/except | none |
| cipher key validate | 324 | no (malformed-key only) | ❌ un-wrapped | none (placeholder = blank key = warn, not raise) |
| secret sweep | 326–334 | pg | ✅ try/except | none |
| **`seed_operators_from_env`** | 346–350 | pg | ✅ try/except | none |
| **`assert_action_types_synced(await get_pg_pool())`** | **356–357** | **pg** | **❌ UN-WRAPPED** | **GUARD / skip — this is the crash** |
| `_resume_stranded` (bg task) | 364–376 | pg | ✅ internal try/except | skip spawn (avoid log spam) |
| `_reconcile_orphans` (bg) | 387–399 | pg | ✅ internal | skip spawn |
| `_sweep_expired_templates` (bg) | 409–421 | pg | ✅ internal | skip spawn |
| `_reconcile_orphans_periodic` (bg) | 435–453 | pg | ✅ internal | skip spawn |

**Conclusion:** The *only* startup line that hard-crashes an unbound box is `assert_action_types_synced` at `main.py:357` (it awaits `get_pg_pool()`, which eagerly opens `min_size` connections and raises when the DB is unreachable). D-03 = guard exactly that call in setup mode; optionally skip spawning the four background reconcilers to keep the log clean.

**Example:**
```python
# main.py lifespan  — Source: existing main.py:286-357 + services/setup_store.py
from app.services.setup_store import setup_finalized
_setup_mode = not setup_finalized()          # cheap file read, no DB

if not _setup_mode:
    from app.services.audit_service import assert_action_types_synced
    await assert_action_types_synced(await get_pg_pool())   # keep the loud drift guard when configured
else:
    logger.warning("SETUP MODE — DB unbound; deferring audit-enum drift guard until finalize")
# ... gate the four asyncio.create_task(...) reconciler spawns behind `if not _setup_mode:` too
```

**Warning sign:** if `Settings()` itself raises at import, the box won't even reach the lifespan — but it won't, because `supabase_url`/`supabase_service_role_key` are typed `str` (no URL validation) and the preset ships non-empty placeholders (`config.py:745`). Verified: import succeeds; only the lifespan DB-touch fails.

### Pattern 4: Pure-ASGI setup gate with a monotonic finalized-latch

**What:** Copy the `MaintenanceMiddleware` pure-ASGI shape (`middleware/maintenance.py:80`) exactly — never `BaseHTTPMiddleware` (it buffers SSE). Polarity is **inverted**: maintenance blocks only writes; setup blocks **everything** except the allowlist until finalized. The finalized state is **monotonic** (a box never un-finalizes via the wizard), so **latch it sticky-True**: once the middleware observes `finalized:true`, cache `True` in a module global and never read the file again — every subsequent request is a single `if _finalized: passthrough`. This *is* the byte-identical invariant (G-6(a)): a configured box's hot path is one boolean check, zero I/O.

**Allowlist (backend-internal paths — post nginx `/api` strip):** the nginx `rewrite ^/api/(.*)$ /$1 break` (`frontend/nginx.conf:32`) means the backend sees **unprefixed** paths. The SPA page `/setup` and static assets are served by nginx and **never reach the backend**, so the backend allowlist only needs: exact `/health`, exact `/public-config`, and prefix `/setup` (covering `/setup/status`, `/setup/validate`, …). Register **before** CORS so CORS stays outermost (a 503 carries CORS headers; `main.py:559-574`).

**Example:**
```python
# middleware/setup.py  — Source: middleware/maintenance.py:80 (exact shape)
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

_ALLOW_EXACT = frozenset({"/health", "/public-config"})
_ALLOW_PREFIX = ("/setup",)               # /setup, /setup/status, /setup/validate, ...
_finalized_latch = False                  # monotonic: once True, stays True (per worker)

def _is_finalized() -> bool:
    global _finalized_latch
    if _finalized_latch:
        return True                       # byte-identical hot path: single bool, no I/O
    from app.services.setup_store import setup_finalized
    if setup_finalized():                 # reads /data/setup.json marker (blip-proof)
        _finalized_latch = True
    return _finalized_latch

class SetupMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http" or _is_finalized():
            await self.app(scope, receive, send)     # no-op once configured
            return
        path = scope.get("path", "")
        if path in _ALLOW_EXACT or any(path == p or path.startswith(p + "/") for p in _ALLOW_PREFIX):
            await self.app(scope, receive, send)
            return
        await JSONResponse(status_code=503,
            content={"error": "setup_required", "message": "first-run setup not complete — open /setup"}
        )(scope, receive, send)
```

**Anti-pattern:** reading the file marker on *every* request (I/O on the hot path) — the latch avoids it. Also: do not gate on the DB `setup_complete` flag in the middleware (a DB blip must never bounce users into the wizard — file marker is the authority; DB flag is auditable only, D-05).

### Pattern 5: Validate SUBMITTED values via throwaway connections (never the singletons)

**What:** `health_probe.probe_*` (`health_probe.py`) test the **configured** singletons (`get_supabase`/`get_redis`). The wizard must test the **submitted** values. Build throwaway clients from the request body, probe, close, and return pass/fail — the singletons stay bound to placeholder config until restart.

**Example:**
```python
# services/setup_service.py  — Source: health_probe.py:58 (adapted to submitted values)
import asyncio, asyncpg
import redis.asyncio as aioredis
from fastapi.concurrency import run_in_threadpool
from supabase import create_client

async def probe_submitted_postgres(dsn: str) -> dict:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=3.0)   # throwaway, NOT the pool
        try:
            # schema-presence sentinel: to_regclass returns NULL when the table is absent
            present = await conn.fetchval("SELECT to_regclass('public.app_settings') IS NOT NULL")
        finally:
            await conn.close()
        return {"state": "up", "schema_present": bool(present)}
    except Exception as exc:
        return {"state": "down", "reason": type(exc).__name__}            # sanitized — no host leak

async def probe_submitted_redis(url: str) -> dict:
    client = aioredis.from_url(url, socket_connect_timeout=3)
    try:
        await asyncio.wait_for(client.ping(), timeout=3.0)
        return {"state": "up"}
    except Exception as exc:
        return {"state": "down", "reason": type(exc).__name__}
    finally:
        await client.aclose()
```

**Schema-presence sentinel:** `SELECT to_regclass('public.app_settings') IS NOT NULL` (or `operator_users`) is the cheapest honest probe — `to_regclass` returns NULL for a missing relation instead of raising, so one round-trip tells you schema-present vs absent. `[ASSUMED: to_regclass is standard Postgres — verify no schema-qualification surprise on the pooler]`

### Pattern 6: Operator bootstrap via the verified Auth admin API

**What:** Create a confirmed auth user server-side, then upsert `operator_users`. **Ordering is load-bearing:** this must run *after* schema bootstrap, because creating the user fires the DB trigger `on_auth_user_created` (present in `full-schema.sql`); if its target tables don't exist, `create_user` fails. The wizard's step order (bind+schema → operator) already satisfies this.

**Verified signature** `[CITED: supabase.com/docs/reference/python/auth-admin-createuser]`: `admin.create_user({...})` accepts `email`, `password`, `email_confirm` (bool, default false), `user_metadata`; `email_confirm=True` marks the address verified with no confirmation email; it is on the `auth.admin` namespace (service-role only). supabase-py is **blocking** → wrap in `run_in_threadpool`.

**Example:**
```python
# services/setup_service.py  — Source: supabase docs + operator_service.py:136 upsert shape
from fastapi.concurrency import run_in_threadpool
from supabase import create_client

async def bootstrap_operator(supabase_url, service_role_key, email, password, pg_dsn) -> str:
    sb = create_client(supabase_url, service_role_key)                 # freshly-bound, service-role
    def _create():
        return sb.auth.admin.create_user({
            "email": email, "password": password, "email_confirm": True,   # verified, no email sent
        })
    resp = await run_in_threadpool(_create)                            # supabase-py is sync
    user_id = resp.user.id
    conn = await asyncpg.connect(pg_dsn)                               # throwaway
    try:                                                              # reuse the 146 upsert shape
        await conn.execute(
            "INSERT INTO operator_users (user_id, granted_by, note) "
            "VALUES ($1, NULL, 'setup-wizard') ON CONFLICT (user_id) DO NOTHING", user_id)
    finally:
        await conn.close()
    return user_id
```

**Pitfalls:** (1) idempotency — a re-run with the same email should detect the existing user (list/get by email) instead of erroring on duplicate; return "already exists, operator confirmed." (2) password policy — Supabase enforces a minimum length; surface the provider error verbatim to the wizard, not a 500. (3) also write `OPERATOR_EMAILS` into the setup-store so the lifespan `seed_operators_from_env` re-seeds on later restarts (belt-and-suspenders).

### Pattern 7: DB-bootstrap feasibility — asyncpg CAN run the pg_dump (SHOULD, gated)

**What:** D-10's "run it for me" over `POSTGRES_DSN`. **Verified feasible:** asyncpg `Connection.execute()` "can execute many SQL commands at once, when no arguments are provided" `[CITED: magicstack.github.io/asyncpg/current/api]` — it uses the simple query protocol for arg-less calls. `supabase/full-schema.sql` is clean for this: **0 `COPY … FROM stdin`**, **0 psql `\` meta-commands** (verified by grep), 110 `CREATE POLICY`, standard `SET`/`SELECT pg_catalog.set_config` lines (all valid SQL). So `await conn.execute(full_schema_sql)` works.

**But keep it a SHOULD behind a schema-absent gate, because:**
1. **Non-idempotent** — `CREATE TABLE`/`CREATE FUNCTION`/`CREATE POLICY` are **not** `IF NOT EXISTS`; a re-run errors "already exists." → Run **only** when the schema-presence probe (Pattern 5) says absent. The 9 seed migrations *are* idempotent (`ON CONFLICT`/`IF NOT EXISTS` per OPERATOR.md) so they're safe to always apply.
2. **Partial-apply risk** — pg_dump output isn't wrapped in a transaction; a mid-script failure leaves half a schema. → Wrap: `async with conn.transaction(): await conn.execute(full_schema_sql)`.
3. **Connection hygiene** — the dump runs `SELECT pg_catalog.set_config('search_path','',false)`; use a **throwaway** `asyncpg.connect()` (never the app pool, which registers a JSONB codec and is reused).
4. **Privilege risk (the real unknown)** — the dump creates a trigger on `auth.users` and `CREATE EXTENSION vector`. Whether the pooler role (`postgres.<project-ref>` on `:5432`) has auth-schema DDL + extension rights is **not guaranteed** the way the Supabase SQL editor (superuser context) is. `[ASSUMED — must be validated on a real Supabase before shipping the auto-runner]`

**Recommendation:** MUST = the **guide path** — probe schema-presence, and if absent render the exact OPERATOR.md Step-3 sequence (full-schema + the 9 ordered seeds + `INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING`) with copy buttons. SHOULD = the auto-runner, gated on schema-absent + wrapped in a transaction + surfacing the privilege error honestly if it fails (fall back to the guide). This satisfies SC#3 either way (copy-paste-into-SQL-editor is not "hand-editing files"; it's the documented OPERATOR.md flow made guided).

```python
# services/setup_service.py  (SHOULD) — Source: asyncpg docs (multi-statement execute)
async def run_schema_bootstrap(pg_dsn: str, full_schema_sql: str, seed_sqls: list[str]) -> None:
    conn = await asyncpg.connect(pg_dsn)                 # throwaway — never the app pool
    try:
        async with conn.transaction():                  # all-or-nothing (pg_dump isn't wrapped)
            await conn.execute(full_schema_sql)          # multi-statement, no args → simple protocol
        for sql in seed_sqls:                            # 9 idempotent seeds, in order
            await conn.execute(sql)
        await conn.execute("INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING")
    finally:
        await conn.close()
```

### Pattern 8: Vite runtime public-config shim (the SC#3 honesty hinge)

**What:** `frontend/src/lib/supabase.ts` builds the client at **module load** from baked `VITE_*` (`supabase.ts:3-6`). Two consequences for the wizard: (a) with **placeholder** `VITE_SUPABASE_URL` the `createClient`→`new URL()` can **throw at import**, white-screening the whole app — including `/setup`; (b) even valid-but-wrong baked creds won't match a wizard-entered Supabase. D-07 fixes both: fetch `GET /api/public-config` at bootstrap and build the client from runtime values, falling back to `VITE_*`.

**Why it's the SC#3 hinge (flag for the planner):** without D-07 the operator must hand-edit `VITE_*` in `./.env` and `--build` the frontend for the browser to reach Supabase — that *is* hand-editing a file, partially breaking SC#3. D-07 is nominally a SHOULD, but it is what makes "no hand-editing files" *true* for the browser tier. **Recommend implementing it.**

**Least-invasive shim:** make `supabase.ts` defensive (never throw at import) + expose an async bootstrap that overlays runtime config. `App.tsx` already calls `useAuth()` unconditionally (`App.tsx:78` → `useAuth.ts:21` calls `supabase.auth.getSession()` at mount), so the client must at minimum **construct without throwing** on a placeholder URL.

**Example:**
```typescript
// frontend/src/lib/supabase.ts  — Source: current supabase.ts + supabase-js createClient
import { createClient, SupabaseClient } from "@supabase/supabase-js"

const BAKED_URL = import.meta.env.VITE_SUPABASE_URL as string
const BAKED_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const isPlaceholder = (v: string) => !v || (v.includes("<") && v.includes(">"))

// Guard: never let a placeholder URL throw at import (white-screens /setup).
const safeUrl = isPlaceholder(BAKED_URL) ? "http://localhost:54321" : BAKED_URL
export let supabase: SupabaseClient = createClient(safeUrl, BAKED_KEY || "placeholder-anon-key")

// Called ONCE from App bootstrap before useAuth matters. Overlays runtime creds.
export async function hydrateSupabaseFromRuntime(apiBase: string): Promise<void> {
  try {
    const r = await fetch(`${apiBase}/public-config`)
    const cfg = await r.json()
    if (cfg?.supabase_url && cfg?.supabase_anon_key &&
        (isPlaceholder(BAKED_URL) || cfg.supabase_url !== BAKED_URL)) {
      supabase = createClient(cfg.supabase_url, cfg.supabase_anon_key)   // real creds win
    }
  } catch { /* keep baked client; /setup renders regardless (it never calls Supabase) */ }
}
```
**Fallback (if too invasive):** keep `VITE_*` required at build, guard the placeholder throw only, and have the wizard **warn** if the browser's baked URL ≠ the entered URL. Document "set `VITE_*` at build" as the known trade. `[CITED: docker-compose.prod.yml build.args — VITE_* baked at build]`

### Pattern 9: Deployment-artifact drift-check (D-16)

**What:** A `set -euo pipefail` bash script mirroring `scripts/pending-cloud-migrations.sh` (make the invisible drift visible; non-zero exit on drift). **Critical finding:** a *naive* `deploy/onebox.env.example` vs `backend/.env.example` key diff yields **41 false positives** (optional providers, S3, LangSmith, Supabase-CLI convenience vars — verified by `comm`). So check #1 **must** carry an explicit `OMITTED_FROM_ONEBOX` allowlist so only *new, unclassified* drift trips it.

The four checks:
1. **Preset keys** — keys in `backend/.env.example` not in `deploy/onebox.env.example` AND not in the curated `OMITTED_FROM_ONEBOX` ignore-list (seed the list with the 41 known-optional keys). A future phase adding a var it forgot to add to onebox → trips. *(Stronger optional: parse `config.py` `Settings` field names, uppercase, and flag any no-default field missing from onebox — catches a new REQUIRED var.)*
2. **Seed-migration list** — every filename in the OPERATOR.md Step-3 table exists under `supabase/migrations/` (catches a renamed/removed seed — 9 files verified present today); heuristic flag: a new migration numbered above the highest in the list containing `INSERT INTO`/`UPDATE ` on a seed table → **warn** for human review (auto-detecting "seed-bearing" is imperfect; be honest).
3. **Sandbox tag** — `SANDBOX_IMAGE=` in onebox == the tag in `CLAUDE.md` == the `-t` tag intent in `Dockerfile.sandbox` (today `101.1`).
4. **`docker compose -f docker-compose.prod.yml config`** parses (and now reflects the `setup_data` volume).

**CI wiring:** `.github/workflows/frontend-tests.yml` has `vitest` + `playwright` jobs `[VERIFIED: ls .github/workflows]`. Add a lightweight `deploy-drift` job (`runs-on: ubuntu-latest`, single `run: bash scripts/check-deploy-drift.sh`) — either to that file or a new `deploy-artifacts.yml`. No new secrets/actions.

**Proposed CLAUDE.md same-commit sync rule (exact wording):**
> **Deployment-artifact parity (same-commit rule).** Any change to an env var the app reads, a seed-bearing migration, a bundled service, or the sandbox image tag MUST update the Phase-157 artifacts (`deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3 seed list, `docker-compose.prod.yml`, and the `SANDBOX_IMAGE` tag) **in the same commit**. `scripts/check-deploy-drift.sh` enforces this in CI; a new intentionally-omitted var is registered in the script's `OMITTED_FROM_ONEBOX` list, never left to drift silently.

### Anti-Patterns to Avoid
- **`BaseHTTPMiddleware` for the setup gate** — buffers SSE. Pure-ASGI only (the whole reason `MaintenanceMiddleware` is pure-ASGI).
- **Env-wins overlay for infra keys** — the placeholder shadows the wizard value (Pattern 1).
- **Live-DB probe in the entry check** — a blip re-triggers the wizard on a configured box. Static string check only (Pattern 1).
- **In-process pool swap under `WORKER_COUNT=2`** — sibling worker keeps stale config (Pattern 2).
- **Routing setup writes through `api.ts` `getAuthHeaders`** — it calls `supabase.auth.getSession()` and throws "Not authenticated" (`api.ts:75-83`). Setup calls use a **separate** unauthenticated helper carrying `X-Setup-Token` (Pattern in `setupApi.ts`).
- **Reflecting raw connection errors to the browser** — leaks internal network topology (SSRF telemetry). Return `type(exc).__name__` + a plain message only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypting the provider key the wizard collects | A bespoke encrypt call | `save_app_settings({...})` (`user_settings.py:277`) | Encrypt-on-write is already the ONE seam (Phase-150 `SECRET_COLUMNS`); the wizard inherits it for free |
| Creating the first auth user | Manual `auth.users` INSERT + password hashing | `supabase.auth.admin.create_user(email_confirm=True)` | Password hashing, identity rows, and the confirmed-email flag are Supabase's job; a manual INSERT breaks GoTrue invariants |
| Operator membership row | New upsert logic | The `operator_users` `ON CONFLICT (user_id) DO NOTHING` shape (`operator_service.py:163`) | Already idempotent + `WORKER_COUNT=2`-safe |
| Connection health checks | New ping code | `health_probe.probe_*` shape (`health_probe.py`) | The bounded-timeout/best-effort pattern is proven; adapt to submitted values |
| The gate middleware | A new BaseHTTPMiddleware | Copy `MaintenanceMiddleware` (`maintenance.py:80`) | Pure-ASGI + fail-open + allowlist already solved |
| Wizard step rail / green-checklist / gated finalize | New components | `LifecycleStepper` / `HealthSignals` / `PublishGauntlet` | G-2 satisfied by reuse (D-17); operator-approved design |
| DB schema bootstrap SQL | Re-derive DDL | `supabase/full-schema.sql` + the 9 seeds | The exact artifact OPERATOR.md already prescribes |
| Setup token | A homegrown scheme | `secrets.token_urlsafe(32)` + constant-time compare | stdlib CSPRNG; the n8n/Jupyter idiom |

**Key insight:** the wizard is ~90% orchestration of existing seams. The failure mode of this phase is *re-implementing* a seam (a second encrypt path, a second operator upsert, a second ping) that then drifts from the original. Every write must funnel through the shipped seam.

## Runtime State Inventory

> This phase *introduces* runtime state rather than renaming it, but the inventory matters for idempotency + lock-out (D-14) + the byte-identical invariant.

| Category | Items introduced / touched | Action Required |
|----------|----------------------------|------------------|
| Stored data (new) | `/data/setup.json` (0600) on the new `setup_data` volume — infra tier + `finalized` marker + setup token + `OPERATOR_EMAILS` | Atomic write (tmp+rename), 0600, never logged; the finalize marker is the gate authority |
| Stored data (DB) | `app_settings.setup_complete` boolean (mig 102); provider keys written encrypted via `save_app_settings`; the `('global')` app_settings row (must exist before any settings write — the A6 gotcha) | mig 102 apply-live + regen `full-schema.sql`; ensure the `global` row is inserted during DB bootstrap |
| Stored data (auth) | The first operator: `auth.users` row (via admin API) + `operator_users` row | Idempotent — re-run detects existing user, ON CONFLICT DO NOTHING on the operator row |
| Live service config | The onebox `docker-compose.prod.yml` `backend` service gains a `setup_data` volume | Compose change → drift-check #4 + OPERATOR.md must reflect it; cloud-parity note |
| Secrets/env vars | Setup token (in-store + logs); `SECRETS_ENCRYPTION_KEY` collected into the infra store; provider keys never in plaintext | Token constant-time compared + rate-limited; encryption-key blank ⇒ Phase-150 fail-open plaintext + boot warning (surface in the wizard) |
| Build artifacts | Baked `VITE_*` in the frontend image | Pattern 8 shim overlays runtime creds so a rebuild isn't required (SC#3) |

**Nothing found needing a data migration of existing records** — this is greenfield provisioning; the only existing-data touchpoint is ensuring the `app_settings('global')` row exists (an INSERT, not a rewrite). Verified: no rename/refactor of a stored key.

## Common Pitfalls

### Pitfall 1: Wizard shows on an already-configured (hand-filled) box
**What goes wrong:** D-05 "setup-needed = marker absent" shows the wizard on a 157-style env-configured box that has no `/data/setup.json` (G-6(a) failure).
**Why:** the marker file only exists after the wizard runs; an env-only box never created it.
**How to avoid:** entry check = marker absent **AND** infra still placeholder (static string check, Pattern 1). A real `SUPABASE_URL` ⇒ not-placeholder ⇒ `needs_setup=false`.
**Warning sign:** a box configured via `./.env` renders `<SetupWizard/>` after `docker compose up`.

### Pitfall 2: Only one worker picks up the new config
**What goes wrong:** in-process re-init leaves the sibling `WORKER_COUNT=2` worker on placeholder config; login works ~half the time (whichever worker answers).
**Why:** module-global singletons are per-process.
**How to avoid:** restart-to-apply (Pattern 2); validate via throwaway connections so the wizard itself doesn't depend on the restart.
**Warning sign:** intermittent auth/DB failures immediately after finalize, before a restart.

### Pitfall 3: Boot crashes on the un-guarded audit-enum drift guard
**What goes wrong:** on a fresh box the lifespan raises at `main.py:357` and the container crash-loops — the operator never even reaches `/setup`.
**Why:** `assert_action_types_synced(await get_pg_pool())` is deliberately un-wrapped (a configured box *should* crash-loud on drift), but that awaits an unreachable DB in setup mode.
**How to avoid:** guard it behind `if not _setup_mode` (Pattern 3); re-enable it as the very first post-finalize boot does its job.
**Warning sign:** `docker compose logs backend` shows a connection error stack trace at startup, not the setup-token line.

### Pitfall 4: `createClient` throws at import → white-screen (including `/setup`)
**What goes wrong:** placeholder `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`) → `new URL()` inside supabase-js throws at module load → the entire SPA fails to mount, so even `/setup` is blank.
**Why:** `supabase.ts:3-6` constructs eagerly at import; `App.tsx` imports it transitively before any setup branch.
**How to avoid:** defensive client init (Pattern 8) — swap a placeholder URL for a harmless local default so construction never throws; hydrate real creds from `/public-config`.
**Warning sign:** blank page + a console `TypeError: Invalid URL` when `VITE_*` are placeholders.

### Pitfall 5: The `app_settings('global')` row is missing → silent "Saved" that persists nothing
**What goes wrong:** `save_app_settings` does `UPDATE … WHERE id='global'` (`user_settings.py:356-365`); with 0 matching rows the provider-key write silently no-ops (the lessons-log A6 gotcha).
**Why:** a fresh schema has no `global` row.
**How to avoid:** the DB-bootstrap step (guide or auto-runner) MUST include `INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING` before the provider-key step; the smoke step should verify the row exists.
**Warning sign:** the wizard reports the provider key saved, but a restart shows no key.

### Pitfall 6: Operator create fails because the schema (trigger) isn't there yet
**What goes wrong:** `auth.admin.create_user` fires `on_auth_user_created`; if its target tables are absent, creation errors.
**Why:** wrong step order (operator before schema).
**How to avoid:** enforce the wizard order bind+schema (step 3) → operator (step 4); the smoke step re-verifies schema-present before enabling operator creation.
**Warning sign:** a 500 from `create_user` on a fresh, un-bootstrapped DB.

### Pitfall 7: Setup writes leak past the finalize lock
**What goes wrong:** a `/setup/*` write succeeds after finalize (G-6(e) / lock bypass).
**Why:** the write endpoints check the token but not the finalized latch.
**How to avoid:** every `/setup/*` write dependency asserts `not setup_finalized()` first → 409 "already configured"; re-config is `/admin`-only (D-14).
**Warning sign:** re-POSTing a step after finalize mutates config.

## Code Examples

### Setup token — generate once, persist, print each unfinalized boot, verify constant-time
```python
# services/setup_store.py  — Source: stdlib secrets + n8n/Jupyter idiom
import hmac, logging, secrets
logger = logging.getLogger(__name__)

def get_or_create_token() -> str:
    store = read_store()
    tok = store.get("setup_token")
    if not tok:
        tok = secrets.token_urlsafe(32)
        store["setup_token"] = tok
        write_store(store)
    return tok

def announce_token_if_unfinalized() -> None:          # call from lifespan when setup_mode
    tok = get_or_create_token()
    logger.warning("FIRST-RUN SETUP TOKEN (needed at /setup): %s", tok)   # stdout → docker logs

def verify_token(supplied: str | None) -> bool:
    if not supplied:
        return False
    return hmac.compare_digest(supplied, get_or_create_token())           # constant-time
```
```python
# api/setup.py  — token dependency + finalize-lock, applied to every WRITE
from fastapi import Header, HTTPException, Depends
from app.services.setup_store import verify_token, setup_finalized

async def require_setup_token(x_setup_token: str | None = Header(default=None)) -> None:
    if setup_finalized():
        raise HTTPException(409, "Setup already complete — reconfigure from /admin.")
    if not verify_token(x_setup_token):
        raise HTTPException(401, "Invalid or missing setup token.")        # rate-limit this path
```

### `setup_complete()` helper — beside `maintenance_mode()` (auditable DB signal only)
```python
# user_settings.py:910 neighborhood  — Source: maintenance_mode() pattern
def setup_complete() -> bool:
    """Auditable/app-facing setup flag (NOT the gate authority — the file marker is, D-05).
    Default False on cold cache / DB blip (mirrors maintenance_mode's no-raise posture)."""
    try:
        return load_app_settings().setup_complete
    except Exception:  # noqa: BLE001
        return False
```

### `GET /api/public-config` — open, infra tier, NEVER secrets
```python
# api/setup.py  — Source: D-07; reads the bound infra tier, exposes ONLY the two public values
@router.get("/public-config")            # backend path /public-config (nginx strips /api)
async def public_config():
    from app.config import settings
    return {                              # anon key + url are PUBLIC by design (browser needs them)
        "supabase_url": settings.supabase_url,
        "supabase_anon_key": settings.supabase_anon_key,
    }                                     # never service_role_key / postgres_dsn / any secret
```

### Migration 102 (apply-live via SQL editor per CLAUDE.md, then regen full-schema)
```sql
-- supabase/migrations/102_setup_complete.sql
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-edit `./.env` + paste SQL (OPERATOR.md Home-B) | Guided browser wizard writing a mounted store + DB | This phase | SC#3: non-developer, no file edits |
| Legacy service_role key term | supabase-py `sb_secret_…` publishable/secret keys (both still supported; `service_role` bypasses RLS) | Supabase 2025 key rework | Onebox already collects all four keys; admin API works with service-role |
| `env-wins` config precedence (pydantic default) | store-wins for the enumerated infra tier | This phase (Pattern 1) | Placeholder-safe overlay |
| n8n first-run: "anyone who reaches the port takes ownership" (no token) | Token-gated first-run (this phase) | — | Our setup token is a **stronger** anti-hijack posture than n8n's default |

**Deprecated/outdated:**
- Following the recovered bare-VPS guide — superseded by `docs/OPERATOR.md` (the wizard automates its Home-B path).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The pooler role (`postgres.<project-ref>` on `:5432`) has privileges to run `full-schema.sql` (auth-schema trigger, `CREATE EXTENSION vector`) via asyncpg | Pattern 7 | The auto-runner (SHOULD) fails on a real Supabase → must fall back to the guide path (which is the MUST anyway, so low blast radius) |
| A2 | `SELECT to_regclass('public.app_settings')` behaves as schema-presence sentinel over the session pooler | Pattern 5 | Schema-presence probe misreads → validate against a fresh Supabase; fallback: catch the "relation does not exist" error from a trivial select |
| A3 | supabase-py `resp.user.id` shape from `admin.create_user` (response object with `.user`) | Pattern 6 | Attribute path differs across supabase-py 2.x minors → verify against the installed `>=2.29.0` at build; adjust to `resp.user.id` vs `resp["user"]["id"]` |
| A4 | `createClient` with a placeholder `<…>` URL throws at import (angle brackets → Invalid URL) | Pitfall 4 | If it doesn't throw, the defensive guard is still harmless (belt-and-suspenders); no downside |
| A5 | The onebox preset ships infra vars as non-empty placeholders so `Settings()` import never fails | Pattern 3 | If a future preset blanks a required field, import fails before the lifespan → the overlay must run at/before `Settings()` construction; verified true today (`onebox.env.example:36`) |

**If any A-row proves wrong, the MUST cut-line still stands** — every assumption above sits on a SHOULD (auto-runner) or a defensive guard, not on the core wizard path.

## Open Questions

1. **Does the auto-runner (Pattern 7) actually get schema-DDL privileges on a real Supabase pooler connection?**
   - Known: asyncpg executes the multi-statement script; `full-schema.sql` is COPY-free.
   - Unclear: auth-schema trigger + extension DDL rights via the pooler role.
   - Recommendation: ship the **guide path as MUST**; implement the auto-runner only if a live probe (during the operator UAT) confirms clean execution — otherwise keep it behind a "try, and on privilege error fall back to guide" branch.

2. **Should finalize trigger a self-restart, or instruct the operator to run `docker compose restart backend`?**
   - Known: restart is the reliable apply step; the box is user-less at that moment.
   - Recommendation: the wizard's finalize screen shows "Setup complete — restart to apply" with the one command, and (nice-to-have) a `WORKER_COUNT==1` in-process re-init that lets single-worker boxes skip even that. Keep the command as the contract.

3. **Token rotation across restarts** — persist the token (stable, operator reads it once) vs regenerate each unfinalized boot (more secure, but the operator must re-fetch)?
   - Recommendation: **persist** in the 0600 store, re-print each unfinalized boot so it's always discoverable; the finalize lock is the real boundary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| FastAPI / uvicorn | The whole app | ✓ | 0.115.6 / 0.32.1 | — |
| asyncpg | throwaway DB probe + (SHOULD) runner | ✓ | >=0.29 | — |
| redis.asyncio | throwaway Redis probe | ✓ | >=5.2,<6 | — |
| supabase-py | admin create_user + schema sentinel | ✓ | >=2.29.0 | — |
| cryptography | inherited via save_app_settings | ✓ | >=44.0.0 | — (blank key ⇒ plaintext + warning) |
| A reachable Supabase (submitted by operator) | live validation + operator create | ✗ at build; operator provides at runtime | — | The wizard is the tool that binds it; smoke step blocks finalize until reachable |
| Docker + Compose v2 (host) | the deployment target + `restart` apply | operator's host | — | — |
| slopcheck | package audit | ✓ | (available) | nothing to audit (no new packages) |
| ctx7 CLI / Context7 MCP | docs lookup | ✗ | — | Used WebFetch against official asyncpg + Supabase docs instead |

**Missing dependencies with no fallback:** none block the build (a live Supabase is the operator's to supply at runtime — that's the wizard's purpose, and the live end-to-end run is the DEFERRED operator UAT).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest `>=8.0.0` + pytest-asyncio `>=0.24.0` (+ `fastapi.testclient`) `[VERIFIED: requirements.txt]` |
| Frontend framework | vitest + @testing-library/react (existing `frontend/src/**/__tests__`) |
| Config file | `backend/` pytest config + `frontend/vitest` (existing) |
| Quick run (backend) | `cd backend && python -m pytest tests/test_setup_*.py -x -q` |
| Quick run (frontend) | `cd frontend && npx vitest run src/pages/__tests__/SetupWizard.test.tsx` |
| Full suite | `cd backend && python -m pytest -q` · `cd frontend && npx vitest run` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| SC#1 / D-06 | `GET /setup/status` returns `needs_setup` from the static marker+placeholder check | unit | `pytest tests/test_setup_status.py -x` | ❌ Wave 0 |
| SC#1 / D-08 | env-detect probe returns store/env/docker flags | unit | `pytest tests/test_setup_detect.py -x` | ❌ Wave 0 |
| SC#1 / D-10 | submitted-value probes: reachable→up, schema-absent→`schema_present:false`, bad DSN→down+sanitized reason | unit (mock asyncpg/redis) | `pytest tests/test_setup_probe.py -x` | ❌ Wave 0 |
| SC#1 / D-11 | operator bootstrap calls `admin.create_user(email_confirm=True)` + upserts operator (mock supabase + asyncpg) | unit | `pytest tests/test_setup_operator.py -x` | ❌ Wave 0 |
| SC#1 / D-12 | provider key routes through `save_app_settings` (encrypt-on-write asserted via SECRET_COLUMNS) | unit | `pytest tests/test_setup_provider.py -x` | ❌ Wave 0 |
| SC#1 / D-13 | smoke = 5-way checklist; any red ⇒ finalize disabled | unit | `pytest tests/test_setup_smoke.py -x` | ❌ Wave 0 |
| SC#2 / D-04 | `SetupMiddleware`: pre-finalize gates non-allowlisted → 503; allowlist passes; **post-finalize = literal passthrough (latched)** | unit (ASGI TestClient) | `pytest tests/test_setup_gate.py -x` | ❌ Wave 0 |
| SC#2 / D-05 | finalize writes BOTH markers; `setup_finalized()` latches sticky-True | unit | `pytest tests/test_setup_finalize.py -x` | ❌ Wave 0 |
| SC#2 / D-14 | re-POST a step after finalize → 409; every step idempotent (re-run = no dup) | unit | `pytest tests/test_setup_idempotent.py -x` | ❌ Wave 0 |
| SC#2 / D-15 | write without/with-wrong `X-Setup-Token` → 401; correct token passes; constant-time compare | unit | `pytest tests/test_setup_token.py -x` | ❌ Wave 0 |
| SC#3 / D-01/02 | overlay: store value overrides placeholder env for infra keys; app-level never overridden | unit | `pytest tests/test_setup_overlay.py -x` | ❌ Wave 0 |
| SC#3 / D-03 | setup-mode lifespan does NOT call `assert_action_types_synced` (guarded); configured-mode DOES | unit (monkeypatch marker) | `pytest tests/test_setup_boot_tolerant.py -x` | ❌ Wave 0 |
| SC#3 / D-07 | `hydrateSupabaseFromRuntime` overlays runtime creds; placeholder URL never throws at import | unit (frontend) | `npx vitest run src/lib/__tests__/supabase.test.ts` | ❌ Wave 0 |
| SC#3 / D-06 | `App.tsx` renders `<SetupWizard/>` when `needs_setup`; "already configured" post-finalize | unit (frontend) | `npx vitest run src/pages/__tests__/SetupWizard.test.tsx` | ❌ Wave 0 |
| D-16 | `check-deploy-drift.sh` exits non-zero on injected drift, zero on clean tree | script test | `bash scripts/check-deploy-drift.sh` (+ a fixture-drift CI assertion) | ❌ Wave 0 |
| **Byte-identical invariant** | a configured box: `SetupMiddleware` passes through with a single bool check; no `/setup` routes affect existing routers | integration | `pytest tests/test_setup_gate.py::test_configured_box_noop -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched `tests/test_setup_*.py` (backend) or the touched `*.test.tsx` (frontend).
- **Per wave merge:** full `pytest -q` (backend) + `npx vitest run` (frontend) + `bash scripts/check-deploy-drift.sh`.
- **Phase gate:** full suites green + drift-check green before `/gsd:verify-work`; the **live operator UAT is DEFERRED** (D-18) — code-complete/verify/secure are autonomous.

### Wave 0 Gaps
- [ ] `backend/tests/test_setup_gate.py` — the gate (503 vs allowlist vs latched no-op) + byte-identical invariant — SC#2
- [ ] `backend/tests/test_setup_token.py` — token 401/pass/constant-time — D-15
- [ ] `backend/tests/test_setup_overlay.py` — store-wins-over-placeholder — D-01/02/SC#3
- [ ] `backend/tests/test_setup_boot_tolerant.py` — the `main.py:357` guard — D-03/SC#3
- [ ] `backend/tests/test_setup_operator.py` + `test_setup_probe.py` + `test_setup_finalize.py` + `test_setup_idempotent.py` + `test_setup_smoke.py` + `test_setup_status.py` — the step contracts
- [ ] `backend/tests/conftest.py` fixtures: a temp `SETUP_STORE_PATH`, mock asyncpg/redis/supabase for submitted-value probes (reuse the existing `mock_asyncpg_pool` idiom from `test_146`)
- [ ] `frontend/src/pages/__tests__/SetupWizard.test.tsx` + `frontend/src/lib/__tests__/supabase.test.ts` — the branch + the runtime-config shim
- [ ] `scripts/check-deploy-drift.sh` + a CI fixture-drift assertion

## Security Domain

> `security_enforcement` enabled (absent = enabled). This is a **pre-auth surface that writes secrets, runs SQL, and mints the first operator** — a dedicated threat model is MANDATORY (D-15). The items below are direct inputs for the PLAN.md `<threat_model>`; `secure-phase` will verify each mitigation exists in code.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Two-tier config; the finalize latch is the trust boundary between "provisioning" and "running" |
| V2 Authentication | yes | The **setup token** is the pre-auth credential; the operator account is minted via GoTrue admin API (password policy = Supabase's) |
| V3 Session Management | partial | No session during setup — token-per-request; after finalize, normal Supabase JWT |
| V4 Access Control | yes | Finalize lock (D-14) + token gate; re-config is `/admin`-only (`require_operator`) |
| V5 Input Validation | yes | Submitted URLs/DSNs validated by connection attempt; provider key sentinel-checked in `save_app_settings` (`_is_valid_api_key`, `_VALID_COLUMN_NAME`) |
| V6 Cryptography | yes | Provider keys via Phase-150 MultiFernet (`secret_cipher.py`) — **never hand-roll**; token via `secrets.token_urlsafe` |
| V7 Errors & Logging | yes | Never log secrets or the token beyond the single boot announcement; sanitize connection-error reflection (SSRF telemetry) |
| V9 Comms | yes (deploy) | The token travels over the same channel as the app; on a real deploy that is HTTPS (nginx/Coolify) |

### Known Threat Patterns for {pre-auth first-run wizard on FastAPI + Supabase}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **First-run hijack** — attacker reaches `/setup` before the operator and configures the box (the exact n8n "anyone who reaches the port takes ownership" race) | Spoofing / Elevation | **Setup token** printed only to `docker compose logs backend` (requires host/log access = the legitimate operator); required + constant-time-verified on every `/setup/*` write; rate-limited |
| **Config write after finalize** (G-6(e)) | Tampering | Finalize latch (D-05) → every write dependency asserts `not setup_finalized()` → 409; re-config is `/admin`-only |
| **SSRF via submitted Supabase/Postgres/Redis URLs** — the backend connects to operator-supplied hosts | Info Disclosure / SSRF | Token-gated (submitter already has host access); **return only `type(exc).__name__` + a plain message** (never raw connection errors that leak internal topology); bounded timeouts; optional block of cloud-metadata IPs (169.254.169.254) — lower priority given the token gate |
| **Secret leakage** — provider key / service-role key / DSN in logs or `/public-config` | Info Disclosure | `/public-config` returns ONLY `supabase_url` + `supabase_anon_key` (both public by design); never log store contents; provider keys encrypted at rest via the Phase-150 seam |
| **DB blip bounces live users into the wizard** (G-6(a) inverse) | DoS | Gate authority is the **file marker** + sticky latch, never a live DB read (D-05) |
| **Weak/duplicate operator credentials** | Spoofing | Delegate password policy to Supabase GoTrue (surface its error verbatim); idempotent create (detect existing user, don't 500) |
| **Boot crash-loop hides the token** (setup-mode intolerance) | DoS | Guard `main.py:357` (Pattern 3) so the box boots into setup mode and *prints the token* instead of crash-looping |
| **Token brute-force** | Elevation | 256-bit `token_urlsafe(32)` + constant-time compare + rate-limit the verify path |

**Red-line reminder (v3.3):** the backend runs on the service-role key with **no RLS backstop** — the setup router enforces its own access (token + finalize latch) entirely in application code, exactly like the `/admin` surface's `require_operator`. A missing token check on any `/setup/*` write is a full pre-auth config-write hole.

## Sources

### Primary (HIGH confidence)
- **asyncpg API reference** — https://magicstack.github.io/asyncpg/current/api/index.html — confirmed `Connection.execute()` runs multiple statements when no args are passed (the D-10 feasibility hinge).
- **Supabase Python docs — Auth Admin `create_user`** — https://supabase.com/docs/reference/python/auth-admin-createuser — confirmed `admin.create_user({email,password,email_confirm,...})` signature + service-role requirement + "no confirmation email sent."
- **Supabase Python docs — Auth Admin API** — https://supabase.com/docs/reference/python/admin-api — the `auth.admin` namespace is service-role-only, server-side only.
- **In-repo code (VERIFIED):** `backend/app/middleware/maintenance.py:80` · `backend/app/main.py:286-357,559-628` · `backend/app/config.py:742-941` · `backend/app/dependencies.py:21-105` · `backend/app/models/user_settings.py:277-373,910` · `backend/app/services/operator_service.py:136-167` · `backend/app/services/health_probe.py` · `backend/app/security/secret_cipher.py:47-97` · `backend/app/api/admin.py:507-557` · `frontend/src/App.tsx:78-163` · `frontend/src/lib/supabase.ts` · `frontend/src/lib/api.ts:13,75-83` · `frontend/src/hooks/useAuth.ts:21-33` · `frontend/nginx.conf:32` · `docker-compose.prod.yml` · `deploy/onebox.env.example` · `docs/OPERATOR.md` · `supabase/full-schema.sql` (grep: 0 COPY-stdin, 0 psql meta) · `backend/requirements.txt`.

### Secondary (MEDIUM confidence)
- **n8n user-management docs** — https://docs.n8n.io/hosting/configuration/user-management-self-hosted/ — the first-run "anyone who reaches the port takes ownership" race + env-pre-provision alternative (frames the D-15 hijack threat; our token is a stronger control).
- **Nextcloud install-wizard + Docker image docs** — https://hub.docker.com/_/nextcloud/ and https://docs.nextcloud.com/server/latest/admin_manual/installation/installation_wizard.html — mounted-volume config persistence + env pre-config + "view merged config, not the file" (corroborates the D-02 overlay model).
- **Ghost self-host config** — `config.production.json` on a mounted volume (corroborates the JSON setup-store choice).

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Pooler-role DDL privileges for the auto-runner (A1); `to_regclass` sentinel over the pooler (A2); supabase-py 2.x response attribute path (A3) — all to be validated against a live Supabase during the deferred operator UAT.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — zero new packages; all versions read from `requirements.txt`.
- Architecture (overlay, gate, boot-tolerance, operator bootstrap): **HIGH** — every seam read in-repo; the two external APIs (asyncpg multi-statement, supabase admin) verified against official docs.
- DB auto-runner feasibility: **MEDIUM-HIGH** — execution mechanism verified; privilege posture assumed (A1), which is why it stays a guarded SHOULD.
- Public-config shim invasiveness: **HIGH** — the exact crash path (`createClient` at import) traced through `supabase.ts` → `useAuth` → `App.tsx`.
- Security/threat model: **HIGH** for the enumerated controls (all map to existing seams); MEDIUM for SSRF residual risk (accepted, token-gated).
- Drift-check: **HIGH** — the 41-false-positive naive-diff trap verified by `comm`; ignore-list design is the mitigation.

**Research date:** 2026-07-17
**Valid until:** ~2026-08-16 (stable — internal seams + long-lived deps; re-verify supabase-py response shape if the pin moves past a major).
