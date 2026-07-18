---
phase: 158-first-run-install-wizard-stretch
reviewed: 2026-07-17T14:05:29Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - backend/app/services/setup_store.py
  - backend/app/middleware/setup.py
  - backend/app/api/setup.py
  - backend/app/services/setup_service.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/app/security/secret_cipher.py
  - supabase/migrations/102_setup_complete.sql
  - frontend/src/App.tsx
  - frontend/src/hooks/useAuth.ts
  - frontend/src/lib/supabase.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/setupApi.ts
  - frontend/src/pages/SetupWizard.tsx
  - scripts/check-deploy-drift.sh
  - backend/Dockerfile
  - deploy/onebox.env.example
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 158: Code Review Report

**Reviewed:** 2026-07-17T14:05:29Z
**Depth:** deep
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 158 ships the first-run install wizard: a pre-auth setup-store file authority, a pure-ASGI `SetupMiddleware`, a setup-mode-tolerant lifespan, a token-gated `/setup/*` router, the six wizard steps, the config overlay, the `supabase.ts` runtime-config shim, the `App.tsx` pre-auth branch, and the `check-deploy-drift.sh` guard. The security scaffolding (constant-time token compare, atomic 0600 store write, sanitized SSRF-safe probes, server-side re-smoke at finalize, CORS-outermost middleware order, no secret logging beyond the one intended token announce) is genuinely careful and mostly correct.

The phase self-tested green (60 backend + 50 frontend), and — as the review brief anticipated — the tests did **not** exercise the two paths that matter most: the **configured-box byte-identical / restart-to-apply path** and the **hand-filled-157-box path**. Both are broken:

- **CR-01 (proven, empirical):** the config overlay `setattr`s three Supabase keys (`supabase_anon_key`, `supabase_publishable_key`, `supabase_secret_key`) that are **not declared Settings fields**. On the *first boot after finalize*, `apply_setup_overlay(settings)` raises `ValueError` at import — the backend **crash-loops and the box is bricked** the moment the wizard's "restart to apply" step runs. The wizard's finalize body demonstrably persists all three keys. This is the exact failure the deferred live-UAT would have caught.
- **CR-02:** the gate (`SetupMiddleware` + lifespan `_setup_mode`) keys off the finalize **marker alone**, while the entry-signal (`compute_setup_status` / `needs_setup`) keys off **marker AND placeholder**. A hand-configured Phase-157 box (real infra, no marker) is therefore told "you're configured, log in" by the frontend while the backend **503s every API call** and skips its reconcilers/audit-guard. Every existing 157 hand-fill deployment breaks on upgrade.

Six warnings follow (an unrecoverable operator-bootstrap idempotency gap, a WORKER_COUNT=2 token double-mint race, an unsanitized probe path, a raw-error leak on `/operator`, a schema auto-runner that can never run in the shipped container, and a Supabase-client hydrate/subscription race that defeats the D-07 no-rebuild login). Five info items round it out.

Line numbers are against the reviewed tree (HEAD `63a08e6a`).

## Critical Issues

### CR-01: Config overlay `setattr`s undeclared Settings fields → backend crash-loops on the first boot after finalize

**File:** `backend/app/config.py:1194-1197` (and `:1219`), `backend/app/services/setup_store.py:35-44`, `backend/app/config.py:745-746`

**Issue:**
`apply_setup_overlay(settings)` runs at module import (`config.py:1219`) and does:

```python
for k in INFRA_KEYS:          # setup_store.INFRA_KEYS
    v = store.get(k)
    if v:
        setattr(target, k, v)  # config.py:1197
```

`INFRA_KEYS` (`setup_store.py:35-44`) contains **eight** keys, but `class Settings` declares only **two** of the Supabase ones — `supabase_url` (`config.py:745`) and `supabase_service_role_key` (`:746`). The other three — `supabase_anon_key`, `supabase_publishable_key`, `supabase_secret_key` — are **never declared as Settings fields** (grep-confirmed: they appear only in `INFRA_KEYS`, `BindBody`/`FinalizeBody`, a `getattr` in `/public-config`, and tests). `Settings` uses `model_config = SettingsConfigDict(..., extra="ignore")`, and Pydantic v2 raises on `setattr` of an undeclared field.

Empirically verified against the project venv (pydantic 2.12.5, pydantic-settings 2.7.0):

```
OK    setattr declared field supabase_url
RAISE ValueError -> "S" object has no field "supabase_anon_key"
```

Trigger chain (all confirmed in-tree, no speculation):
1. `SetupWizard.tsx:245-250` builds a `finalizeBody` that sends `supabase_anon_key`, `supabase_publishable_key`, and `supabase_secret_key`.
2. `POST /setup/finalize` → `store_finalize(body.model_dump(exclude_none=True))` → `setup_store.finalize()` writes every truthy `INFRA_KEYS` entry to `/data/setup.json` (`setup_store.py:167-169`) — including the three undeclared keys.
3. The endpoint returns `restart_required: true` (`setup.py:416-421`); the operator runs `docker compose restart backend` (the documented apply step).
4. On boot, `import app.config` → `settings = Settings()` → `apply_setup_overlay(settings)` hits `k = "supabase_anon_key"` with a truthy store value → `setattr` → **`ValueError` → import fails → every worker crash-loops.**

Impact: the box is **bricked after finalize** and is unrecoverable without hand-editing `/data/setup.json` or the code — i.e., the exact "hand-edit a file" outcome the wizard exists to eliminate (SC#3), and a direct hit on G-6(b) ("finalize succeeds but a restart loses the config"). Tests missed it because `test_setup_finalize.py` mocks `store_finalize` and never drives a real `Settings` through `apply_setup_overlay` with a finalized store.

Second face of the same root cause: even if the crash were guarded, `/public-config` reads `getattr(_settings, "supabase_anon_key", "")` (`setup.py:172`) → `""` (field absent) → the browser never receives the anon key → `hydrateSupabaseFromRuntime` skips the reassign (it requires a truthy `cfg.supabase_anon_key`) → the D-07 "login without a rebuild" path is dead. The setup.py docstring at `:166` already *notices* the field "may be absent from Settings" and defends the read with `getattr` — but nobody defended the `setattr`.

**Fix:** Declare the three missing infra keys as Settings fields (this fixes both the crash **and** the empty-anon `/public-config`):

```python
# backend/app/config.py — inside class Settings, beside supabase_url / supabase_service_role_key
supabase_anon_key: str = ""
supabase_publishable_key: str = ""
supabase_secret_key: str = ""
```

Additionally harden the overlay so a future `INFRA_KEYS` entry can never crash boot again (defense-in-depth, and closes IN-05):

```python
def apply_setup_overlay(target) -> None:
    from app.services.setup_store import INFRA_KEYS, read_store
    store = read_store()
    if not store:
        return
    fields = getattr(type(target), "model_fields", {})
    for k in INFRA_KEYS:
        v = store.get(k)
        if v and k in fields:          # never setattr a non-field
            setattr(target, k, v)
```

---

### CR-02: Gate (middleware + lifespan) uses "marker only"; entry-signal uses "marker AND placeholder" → a hand-configured 157 box is 503'd on every API call while the frontend shows the login page

**File:** `backend/app/middleware/setup.py:42-57` & `:89`, `backend/app/main.py:304` & `:380/405/429/485`, vs `backend/app/config.py:1200-1213` and `backend/app/services/setup_service.py:158-180`

**Issue:**
Two different definitions of "this box is set up" ship in the same phase and disagree:

- **Gate authority** — `SetupMiddleware._is_finalized()` (`middleware/setup.py:42-57`) and lifespan `_setup_mode = not setup_store.setup_finalized()` (`main.py:304`) both read the **finalize marker file alone**.
- **Entry signal** — `needs_setup()` (`config.py:1211-1213`) and `compute_setup_status()` (`setup_service.py:174-175`) both compute `(not finalized) AND _is_placeholder(supabase_url)`.

Now take a **hand-filled Phase-157 box**: the operator followed the shipped `docs/OPERATOR.md` Home-B runbook — real `SUPABASE_URL`/keys in `./.env`, migrations applied — but **never ran the wizard**, so `/data/setup.json` does not exist and `setup_finalized()` returns `False`.

- `GET /setup/status` → `compute_setup_status()` → `needs_setup=false` (URL is real, not a placeholder) → `App.tsx:197` renders `AuthPage`, **not** the wizard.
- `SetupMiddleware` → `_is_finalized()==False` → gates everything except `/health`, `/public-config`, `/setup/*` → **every `/threads`, `/settings`, `/runs`, … returns `503 setup_required`** (`setup.py`... actually `middleware/setup.py:99-106`).
- Lifespan → `_setup_mode==True` → **skips** the audit-enum drift guard (`main.py:380`) and **all four reconcilers** (`:405/429/485`), so a live, DB-bound box also silently loses orphan-run recovery and the audit-drift backstop.

Result: the frontend says "you're configured — log in" while the backend 503s the whole API, and because `needs_setup=false` the wizard is never auto-offered — a dead end. The config.py docstring at `:1205` explicitly names this as a *must-work* case ("a hand-filled 157-style box … reads False"), so this is an internal contradiction, not a design preference. Concretely: **every existing 157 deployment breaks the moment it pulls this backend version.** (There is a non-obvious manual recovery — navigate to `/setup`, where `atSetupPath && !finalized` forces the wizard, re-enter everything, finalize — but that defeats the purpose.)

Secondary consequence: because a hand-filled box never latches finalized, `_is_finalized()` performs a `read_store()` file read on **every request** (`setup_store.py:112`), not the intended one-bool no-op.

**Fix:** Make the gate and the entry-signal use the **same** definition of "configured." Gate on `needs_setup()` semantics (marker-absent AND placeholder), and latch once configured, so a hand-filled box is a true no-op:

```python
# middleware/setup.py
def _is_finalized() -> bool:
    global _finalized_latch
    if _finalized_latch:
        return True
    from app.config import settings, needs_setup
    if not needs_setup(settings):      # marker present OR infra already real
        _finalized_latch = True
    return _finalized_latch
```

```python
# main.py
from app.config import settings, needs_setup
_setup_mode = needs_setup(settings)    # not: `not setup_store.setup_finalized()`
```

This keeps a genuinely fresh box (placeholder + no marker) gated, un-gates hand-filled and finalized boxes, and stays blip-proof (no DB read).

## Warnings

### WR-01: `bootstrap_operator` duplicate path skips the `operator_users` upsert → a partial first attempt becomes an unrecoverable stuck state

**File:** `backend/app/services/setup_service.py:270-295`

**Issue:** The operator-row insert (`:283-287`) runs **only** on the non-duplicate path. The connect at `:281` is outside the `try`, and the Supabase Auth create (`:271`) and the direct-Postgres insert (`:281-287`) are two independent connections. Failure interleaving:

1. First `/operator`: `create_user` **succeeds** (auth user created), then `asyncpg.connect(pg_dsn)` **fails** (transient DB blip, or `pg_dsn` momentarily unreachable) → exception propagates to `setup.py:311` → `400`. Auth user exists; **no `operator_users` row**.
2. Operator retries `/operator` (same email): `create_user` → GoTrue "already registered" → `_looks_like_duplicate` True → returns `{already_exists:true}` at `:276` **without inserting the operator row.**

Now `operator_users` never gets the row, the `operator_row` smoke check (`_probe_operator_row`, `:351-366`) stays red forever, finalize is blocked (`setup.py:388`), and **there is no in-wizard recovery** — every retry says `already_exists`. A non-developer is stuck (breaks SC#3). (`_find_existing_user_id` at `:196-217` also fetches only the first `list_users()` page, so on a busier box it may not even find the id.)

**Fix:** On the duplicate branch, still upsert `operator_users` with the resolved `user_id`; and wrap create+insert so a partial failure is retry-safe:

```python
if _looks_like_duplicate(exc):
    existing_id = await _find_existing_user_id(sb, email)
    if existing_id:
        await _upsert_operator_row(pg_dsn, existing_id)  # same ON CONFLICT DO NOTHING insert
    _remember_operator_email(email)
    return {"status": "already_exists", "already_exists": True, "user_id": existing_id}
```

### WR-02: WORKER_COUNT=2 token double-mint race → two different setup tokens announced; the one the operator tries first may 401

**File:** `backend/app/services/setup_store.py:117-130` & `:133-143`, `backend/app/main.py:311`

**Issue:** `announce_token_if_unfinalized()` runs once **per worker** in the lifespan (`main.py:311`); with the default `--workers 2` both processes boot near-simultaneously. `get_or_create_token()` is a non-atomic read-modify-write (`:124-129`):

- Worker A: `read_store()` → no token → mint `tokenA` → write.
- Worker B: `read_store()` (before A's write) → no token → mint `tokenB` → write (clobbers A).

Both workers log a `FIRST-RUN SETUP TOKEN` line, but only the last-persisted token (`tokenB`) survives, and `verify_token` re-reads the file. The operator sees two different tokens in `docker compose logs backend`; if they try `tokenA` first they get `401`. Recoverable, but confusing on a security-sensitive pre-auth surface, and it undermines the "read it once from the logs" idiom.

**Fix:** Make token creation atomic (create-exclusive), or mint-then-reannounce the *persisted* value:

```python
def get_or_create_token() -> str:
    store = read_store()
    tok = store.get("setup_token")
    if tok:
        return tok
    # atomic first-writer-wins
    candidate = secrets.token_urlsafe(32)
    store["setup_token"] = candidate
    write_store(store)
    return read_store().get("setup_token", candidate)  # re-read: honor the winner of a race
```

(A file lock or `O_CREAT|O_EXCL` sentinel is the fully-robust version.)

### WR-03: `probe_submitted_redis` builds the client outside the try → a malformed/empty Redis URL raises uncaught (500 on `/validate` and `/detect`)

**File:** `backend/app/services/setup_service.py:98` (and the `detect_environment` caller at `:147`)

**Issue:** `client = aioredis.from_url(url, ...)` sits **before** the `try` (`:98`). `redis.asyncio.from_url` parses the URL eagerly and raises `ValueError` on a bad scheme or an empty string. So `POST /setup/validate` with a malformed `redis_url` (or `""`) raises out of the probe → unhandled → **500**, instead of the sanitized `{"state":"down","reason":...}` the docstring promises (and the SSRF-hygiene contract the sibling probes honor). Worse, `detect_environment()` (`:146-153`) calls this on `settings.redis_url` and is documented as "never raises" — but it will, if the configured URL is malformed, 500-ing `POST /setup/detect`.

**Fix:** Move construction inside the guarded block:

```python
async def probe_submitted_redis(url: str) -> dict:
    try:
        client = aioredis.from_url(url, socket_connect_timeout=_PROBE_TIMEOUT_S)
        await asyncio.wait_for(client.ping(), timeout=_PROBE_TIMEOUT_S)
        return {"state": "up"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("setup probe: submitted Redis unreachable (%s)", type(exc).__name__)
        return {"state": "down", "reason": type(exc).__name__}
    finally:
        try:
            await client.aclose()  # guard: client may be unbound if from_url raised
        except Exception:
            pass
```

(Guard the `finally` for the case where `client` was never bound.)

### WR-04: `/operator` returns `str(exc)` verbatim as the 400 detail → leaks DB host/user/DSN fragments and breaks the sanitized-reason discipline

**File:** `backend/app/api/setup.py:311-312`

**Issue:** `except Exception as exc: raise HTTPException(status_code=400, detail=str(exc))`. The intent (T-158-06) is to surface a GoTrue password-policy message. But `bootstrap_operator` also runs `create_client(...)` (`setup_service.py:263`, unguarded) and `asyncpg.connect(pg_dsn)` (`:281`); an asyncpg/connection error's `str(exc)` typically includes the **host, port, and username** (e.g. `connection failed: … host "db.internal" port 5432 … role "postgres"`). That is reflected verbatim to the caller — a break from the careful `type(exc).__name__`-only discipline every probe follows (`setup_service.py:74/102/120/…`), and a confusing raw error for the non-developer this wizard targets. (Token-gated, so bounded — but still info disclosure on a pre-auth surface.)

**Fix:** Only surface known password-policy/validation messages verbatim; sanitize the rest:

```python
except Exception as exc:  # noqa: BLE001
    logger.warning("setup /operator failed: %s", type(exc).__name__)
    detail = str(exc) if _is_password_policy_error(exc) else \
        "Could not create the operator account — check the Supabase URL, service-role key, and DB connection."
    raise HTTPException(status_code=400, detail=detail) from exc
```

### WR-05: The schema-bootstrap auto-runner can never run in the shipped container (artifacts absent), and a non-privilege DB error 500s instead of falling back

**File:** `backend/app/api/setup.py:219-234` & `:284-289`, `backend/Dockerfile:37`

**Issue:** `_load_schema_artifacts()` reads `repo_root / "supabase" / "full-schema.sql"`, where `repo_root = Path(__file__).resolve().parents[3]` (`setup.py:227`). But the backend image's build context is `backend/` and the Dockerfile does `COPY . .` (`Dockerfile:37`), so **`supabase/` is not in the image**. In-container, `parents[3]` resolves to `/`, and `/supabase/full-schema.sql` does not exist → `FileNotFoundError` → caught at `setup.py:281` → the "run it for me" SHOULD **always silently degrades to the copy-guide** in the exact deployment (the one-box container) it was built for. The guide is a valid MUST fallback, but a shipped, unit-tested feature that can never fire in production is a real defect (and a confusing UX: the operator's "run it for me" button mysteriously always hands back manual SQL).

Separately, the endpoint's `try` (`:284-289`) catches **only** `SchemaBootstrapPrivilegeError`. `run_schema_bootstrap` re-raises any non-privilege `asyncpg.PostgresError` (`setup_service.py:466`), which would propagate → **500**, with no guide fallback — the "never a half-applied silent success, always the guide" contract broken for that error class. (Also note: `run_schema_bootstrap` wraps only `full_schema_sql` in a transaction; the seeds + `app_settings('global')` insert at `setup_service.py:453-457` run auto-committed and outside it, so a mid-seed failure on a schema-present-next-time box leaves a permanently half-seeded DB the runner will then skip.)

**Fix:** Bundle the schema artifacts into the image (e.g. `COPY ../supabase ./supabase` with an adjusted context, or vendor them under `backend/`) if the auto-runner is meant to ship; otherwise gate/remove it and lean on the guide. And broaden the endpoint fallback:

```python
try:
    await run_schema_bootstrap(dsn, full_schema_sql, seed_sqls)
except (SchemaBootstrapPrivilegeError, asyncpg.PostgresError, OSError):
    logger.warning("setup: schema auto-run failed — falling back to the copy-guide")
    return {"ok": False, "fallback": "guide", "seed_sequence": list(_SEED_SEQUENCE)}
```

### WR-06: `useAuth` subscribes to the pre-hydrate Supabase client → on the D-07 no-rebuild path, a successful login never updates the UI

**File:** `frontend/src/hooks/useAuth.ts:20-33`, `frontend/src/lib/supabase.ts:53-71`, `frontend/src/App.tsx:95-105`

**Issue:** `useAuth`'s mount effect (`useAuth.ts:20-33`, deps `[]`) calls `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange(...)` on the **current** module `supabase` binding. `hydrateSupabaseFromRuntime` (`supabase.ts:53`) reassigns that binding, but only **after an awaited `fetch('/public-config')`** — which resolves a network round-trip *later* than the synchronous subscription in `useAuth`'s effect (and `useAuth` is called at `App.tsx:85`, before App's own hydrate effect at `:95`). So on the D-07 "configure-without-rebuild" path (baked `VITE_*` are placeholders → `safeUrl = http://localhost:54321`, `hydrate` *does* reassign to the real client):

1. `useAuth` subscribes `onAuthStateChange` to the **dummy** client; its `getSession()` returns null.
2. `hydrate` reassigns `supabase` to the **real** client.
3. `signIn` (`useAuth.ts:36`, reads the live binding) succeeds on the **real** client, which fires `onAuthStateChange` — but the subscriber is on the **dead dummy** client. `user` never updates → the UI stays on `AuthPage` despite a correct login. The session persists under the real project's storage key, so a reload doesn't help either (the dummy client checks a different key first).

The properly-built path (real baked `VITE_*`, or the onebox `VITE_*` build-arg) is unaffected — `hydrate` sees a matching URL and does not reassign — so this bites specifically the D-07 SHOULD it was built to enable.

**Fix:** Complete the runtime hydrate **before** mounting the auth-consuming tree, so `useAuth` subscribes to the final client:

```tsx
// App bootstrap: gate the auth tree on hydrate completion
const [ready, setReady] = useState(false)
useEffect(() => { hydrateSupabaseFromRuntime(API_BASE).finally(() => setReady(true)) }, [])
if (!ready) return <BootSpinner />
// ...render <AppInner/> (which calls useAuth) only after ready
```

Or have `hydrateSupabaseFromRuntime` emit an event that `useAuth` listens for to re-init its `getSession` + subscription against the new client.

## Info

### IN-01: `_is_placeholder` treats any value containing both `<` and `>` as a placeholder

**File:** `backend/app/services/setup_store.py:96-98`

**Issue:** `return (not v) or ("<" in v and ">" in v)`. A real infra value that legitimately contains both angle brackets (e.g. a Postgres DSN whose password is `p<a>ss`) would be misread as a placeholder → `needs_setup`/`compute_setup_status` misfire and the overlay skips it. Low likelihood for URLs and JWT/Fernet keys (no `<>`), but it's a value-shape assumption worth tightening.

**Fix:** Anchor on the actual sentinel token, e.g. `v.strip().startswith("<") and v.strip().endswith(">")`, or match the specific `<project-ref>`/`<...-key>` forms the presets ship.

### IN-02: Provider key is saved before `secrets_encryption_key` is active → a plaintext-at-rest window

**File:** `backend/app/services/setup_service.py:298-318`, `backend/app/main.py:344-354`

**Issue:** On a fresh one-box, `SECRETS_ENCRYPTION_KEY=` ships empty (`deploy/onebox.env.example:119`), so during the wizard the cipher is `None` and `persist_provider_key` → `save_app_settings` writes the provider key **plaintext** (Phase-150 fail-open). The wizard collects `secrets_encryption_key` only at finalize, and it only takes effect after restart. So there is a window where a provider secret sits plaintext in `app_settings`. It self-heals via the boot secret-sweep (`main.py:347`) on the post-restart boot **iff** a key was supplied and the box restarts; if the operator leaves the encryption key blank it persists plaintext (expected, warned). Worth a note in OPERATOR.md and, ideally, re-encrypting on finalize.

### IN-03: Store writes are non-atomic read-modify-write (no lock)

**File:** `backend/app/services/setup_store.py:157-173` & `:117-130`

**Issue:** `finalize()` and `get_or_create_token()` do `read_store()` → mutate → `write_store()` with no cross-process lock. `os.replace` keeps the file itself uncorrupt (never a partial JSON), and the finalize latch means only concurrent-with-first-finalize writers race, but two writers are last-writer-wins on the merged dict. Benign today (same client, identical payloads), latent if the surface grows. See WR-02 for the token instance.

### IN-04: drift-check "compose parses" degrades a broken compose to a soft warn

**File:** `scripts/check-deploy-drift.sh:209-228`

**Issue:** The check-4 `if` requires docker present **and** `docker compose config` to **succeed**. A docker-present-but-**parse-failure** (a genuinely broken `docker-compose.prod.yml`) makes the compound condition false → it falls to the "docker unavailable/denied" WARN branch (mislabeled) and the dependency-free structural fallback, which can still print `ok`. So a broken compose never hard-fails — the check's headline promise ("compose parses") is not enforced even in CI. The structural fallback (`:221-222`) also assumes a fixed 2-space indent for the `setup_data` declaration.

**Fix:** Distinguish "docker missing" from "compose failed to parse"; hard-fail the latter:

```bash
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if ! docker compose -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
    add_fail "docker compose config FAILED to parse $COMPOSE_FILE"; return
  fi
  # ...then the setup_data grep
fi
```

### IN-05: The preset-keys drift-check compares two env-example files, not the actual Settings fields

**File:** `scripts/check-deploy-drift.sh:111-135`

**Issue:** Check 1 diffs `backend/.env.example` against `deploy/onebox.env.example`. A variable the **code** reads that is absent from **both** example files is invisible to the check. This is precisely the gap class behind CR-01: nothing cross-checks `setup_store.INFRA_KEYS` against the declared `Settings` fields, so the missing `supabase_anon_key`/`publishable`/`secret` fields sailed through. Consider a lightweight assertion that every `INFRA_KEYS` entry is a declared `Settings` field (a 3-line pytest or a `python -c` in CI).

---

_Reviewed: 2026-07-17T14:05:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
