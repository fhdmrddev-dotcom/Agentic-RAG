# Phase 150: Secrets at Rest - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 11 (2 new code + 1 new migration + 6 modified + tests)
**Analogs found:** 11 / 11 (every file has a same-repo analog — this is an additive edit to well-established seams)

> Backend-only phase. RESEARCH.md already resolved the cipher choice (Fernet/MultiFernet), the `enc:v1:` envelope, and the exact seams. This map ties each file to the concrete in-repo code it should copy shape from, with line references the planner can paste into plan actions. **Every excerpt below is READ from the live tree.**

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/security/secret_cipher.py` (NEW) | service / utility (pure-CPU crypto) | transform | `backend/app/services/health_probe.py` (fresh Phase-147 additive module: module docstring w/ analog-composition note, lazy `from app.dependencies import …` inside fns, `__all__`, never-raises posture) | role-match (no `security/` pkg yet; health_probe is the closest small-pure-module analog) |
| `supabase/migrations/100_*.sql` (NEW) | migration | batch (DDL) | `supabase/migrations/099_model_registry_deprecated.sql` (idempotent `ADD COLUMN IF NOT EXISTS … text`) + `097_operator_flags.sql` (apply/parity header block) | exact |
| `backend/app/models/user_settings.py` (MOD) | model (settings substrate) | CRUD + transform | itself — `save_app_settings` (write seam :266-322), `_build_settings_from_row` (read seam :568-687), `_val` fallback chain (:416-428) | exact (edit-in-place; the seams already exist) |
| `backend/app/api/settings.py` (MOD) | controller / route | request-response | `backend/app/api/admin.py::set_flag` (:487-524) — `if not await save_app_settings(...)` → raise (Phase 147 CR-02) | exact (same `save_app_settings` bool, same raise-on-False) |
| `backend/app/main.py` (MOD) | config / startup (lifespan) | event-driven (boot) | Two blocks in the same `lifespan()`: `seed_operators_from_env` (:254-268, best-effort try/except → the SWEEP) + `assert_action_types_synced` (:270-275, hard-fail, no try/except → the KEY-VALIDATION) | exact |
| `backend/app/services/health_probe.py` (MOD) | service (probe) | request-response | itself — `probe_*` + `probe_dependencies` (:45-116) additive-probe pattern; the new `encryption_status()` lives in `secret_cipher.py` and is folded into the payload the same way | role-match (status is a cheap in-proc read, not a network probe) |
| `backend/app/api/admin.py::get_backpressure` (MOD) | controller / route | request-response | itself — `dependencies = await probe_dependencies()` append (:185-198) | exact |
| `frontend/src/components/admin/HealthSignals.tsx` (MOD) | component (presentational leaf) | request-response | itself — the Phase-147 `DEP_ORDER` dependency tile block (:75-213) + the `showTechnical` ⌥ reveal | exact |
| `frontend/src/lib/api.ts::BackpressureSignals` (MOD) | type / API client | request-response | itself — the additive `dependencies?:` block (:3614-3617) | exact |
| `backend/app/config.py::Settings` (MOD) | config | — | `operator_emails: str = ""` (:921) + `langsmith_api_key: str = ""` (:1149) | exact |
| `backend/requirements.txt` (MOD) | config / manifest | — | the Phase-071.3 Camelot / Phase-075.5 google-genai commented-pin entries (:43-55) | exact |
| `backend/tests/test_150_*.py` + `tests/integration/test_150_*.py` (NEW) | test | — | `test_147_flag_failure_semantics.py` (`_StubPool` unit), `test_147_health_probe.py` (monkeypatch-at-boundary unit), `test_081_1_settings_migration.py` (`_pg_reachable` live-PG guard) | exact |

---

## Pattern Assignments

### `backend/app/security/secret_cipher.py` (NEW — service, transform)

**Analog:** `backend/app/services/health_probe.py` (module shape) + the lazy-config-import idiom already used inside `user_settings.py`.

RESEARCH.md §Pattern 1 already gives the full module body (`_load_keys`, `get_cipher`, `is_encrypted`, `encrypt_secret`, `decrypt_secret`). Copy these repo conventions on top of it:

**Module-header + analog-note convention** (from `health_probe.py:1-34`): open with a docstring that names the phase, the responsibility, and the analog it copies; end the imports with `logger = logging.getLogger(__name__)`; close the file with an `__all__`:
```python
# health_probe.py — the shape to mirror
"""Phase 147 Plan 02 (ADMIN-02) — dependency-health probes ...
Analog composition (147-PATTERNS): Redis PING mirrors main.py health() ...
"""
from __future__ import annotations
import logging
logger = logging.getLogger(__name__)
...
__all__ = ["probe_redis", "probe_supabase", "probe_sandbox", "probe_dependencies"]
```

**Lazy `app.config` read (avoid an import cycle)** — `user_settings.py` imports `settings as env_settings` at module top, but RESEARCH §Pattern 1 reads it lazily inside `_load_keys()` so tests can monkeypatch. Use the lazy form (matches the many `from app.dependencies import get_pg_pool  # lazy import -- avoid circular` sites, e.g. `user_settings.py:243`, `:308`):
```python
def _load_keys() -> list[str]:
    from app.config import settings as env_settings
    raw = (getattr(env_settings, "secrets_encryption_key", "") or "").strip()
    return [k.strip() for k in raw.split(",") if k.strip()]
```

**Secret-logging discipline (T-081.1-04)** — every log emits column NAMES + counts only, NEVER a value or a token. Mirror `main.py:219-223` ("never log API key values, only key names and counts") and the decrypt-failure log in RESEARCH §Pattern 3 (`logger.error("... column %s failed to decrypt ...", k)`).

**`encryption_status()` for the Control Plane** — returns `{"state": "encrypted"|"plaintext"|"error", "columns_unreadable": N}` (RESEARCH §Control Plane signal). This is the ONE new public read the admin payload calls.

---

### `supabase/migrations/100_*.sql` (NEW — migration, batch DDL)

**Analog:** `supabase/migrations/099_model_registry_deprecated.sql` (text-column add) — this is the closest recent migration and the immediately-preceding number.

**Text-column ADD (idempotent)** — the 10 missing secret columns are all `text` (D-150-08). Copy `099`'s idempotent shape verbatim (it already adds a `text` column — `deprecated_reason text`):
```sql
-- 099_model_registry_deprecated.sql:29-37
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated boolean NOT NULL DEFAULT false;
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated_reason text;
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS llm_model_locked boolean NOT NULL DEFAULT false;
```
For phase 150 → one `ALTER TABLE public.app_settings` with 10 `ADD COLUMN IF NOT EXISTS {col} text` lines, one per missing member of `_API_KEY_COLUMNS` (`main.py:125-130`): the 9 `{provider}_api_key` (`openai/anthropic/google/openrouter/ollama/deepseek/moonshot/minimax/zhipu`) + `tavily_api_key`. `embedding_api_key`/`rerank_api_key` already exist (research-verified) — the `IF NOT EXISTS` guard makes re-including them harmless, but the 10 missing ones are the target. Plain `text`, NO default (a NULL secret column is the correct "unset → env fallback" state).

**Header / apply / cloud-parity block** — copy the full comment header from `097_operator_flags.sql:1-24` (APPLY-via-SQL-editor, `regenerate-full-schema.sh` no-`--reset`, CLOUD PARITY note). Add the `097`-style ensure-global-row line if desired:
```sql
-- 097:31-32
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
```
Cloud-parity note per D-150-08: mig 100 joins mig 099 in `scripts/pending-cloud-migrations.sh` (do NOT touch cloud now).

---

### `backend/app/models/user_settings.py` (MOD — model, CRUD + transform)

**Analog:** itself. The two seams already exist and already return/consume exactly what the encryption needs.

**Encrypt-on-write** — insert AFTER the existing sentinel/`_is_valid_api_key` guard builds `clean`, BEFORE the `UPDATE` (`save_app_settings`, :283-306). The guard validates PLAINTEXT; encryption composes after it. Existing guard head to compose onto:
```python
# save_app_settings :283-299 (the existing guard — encrypt AFTER this)
clean: dict[str, Any] = {}
for k, v in updates.items():
    if v == KEY_PLACEHOLDER:
        continue
    if k.endswith("_api_key") and v is not None and not _is_valid_api_key(k, str(v)):
        logger.warning("save_app_settings: rejected api_key write ... key=%s", k)
        continue
    if v is None:
        continue
    clean[k] = v
if not clean:
    return True
# ── NEW (RESEARCH §Pattern 3): encrypt secret columns in-place here ──
```
Use `_API_KEY_COLUMNS` as the allowlist (already the SQLi-safe column allowlist at `main.py:125-130`). To avoid a `main` ↔ `user_settings` import cycle, RESEARCH recommends moving the constant into a shared module OR a lazy import; note the lazy-import idiom already pervades this file.

**Decrypt-on-read** — at the TOP of `_build_settings_from_row` (:568), decrypt onto a COPY so the 30s cache keeps ciphertext. The existing `_val(row, key, env_attr, default)` chain (:416-428) is the fail-soft mechanism: a dropped/undecryptable column set to `None` in the copy makes `_val` fall through to env — SC#3 for free, NO new fallback code:
```python
# _val :416-428 — the EXISTING DB>env>default chain the decrypt seam reuses
def _val(row: dict, key: str, env_attr: str | None = None, default: Any = "") -> Any:
    v = row.get(key)
    if v is not None:
        return v
    if env_attr is not None:
        return getattr(env_settings, env_attr, default)
    return default
```
The secret columns already flow through `_val` with an env_attr today: `embedding_api_key` (:596), `rerank_api_key` (:603), `tavily_api_key` (:615), and each provider key via `_build_providers` → `api_key = str(_val(row, key_field, key_field, env_key))` (:483-487). Decrypting the row copy upstream means ZERO consumer changes.

**Write-seam-that-bypasses-save_app_settings caution** — `set_feature_visibility` (:865-885) is a SECOND write path that does its own `UPDATE app_settings SET …` (JSONB merge, not through `save_app_settings`). It writes `feature_visibility` only (not a secret column), so it needs NO encryption — but it documents that not every app_settings write funnels through `save_app_settings`. The secret write DOES funnel through `save_app_settings` (verified: `settings.py:329` `updates[f"{p.id}_api_key"]` → `save_app_settings`), so the single encrypt seam holds.

---

### `backend/app/api/settings.py` (MOD — controller, request-response)

**Analog:** `backend/app/api/admin.py::set_flag` (:487-524) — the canonical Phase 147 CR-02 "surface the `save_app_settings` bool" precedent, applied twice more in the model-lock endpoint (`admin.py:1291-1304`).

**The D-150-07 site** — `update_settings` currently fire-and-forgets the bool (`settings.py:453`):
```python
# settings.py:453 — TODAY (the bug): bool ignored, failed save returns HTTP 200
await save_app_settings(updates)
```
Copy the `set_flag` raise-on-False shape (`admin.py:520-524`):
```python
# admin.py:520-524 — the precedent
if not await save_app_settings({body.key: body.value}):
    request.state.audit_action = "flag.write_failed"
    request.state.audit_label = f"Flag change for {_FLAG_HUMAN_NAMES[body.key]} failed to persist"
    raise HTTPException(status_code=500, detail=...)
```
`update_settings` has no `operator_audit_floor` middleware, so the audit-stamp lines don't apply — RESEARCH §"Round-trip verification" gives the minimal form:
```python
ok = await save_app_settings(updates)
if not ok:
    raise HTTPException(status_code=500, detail="Failed to save settings")
```
**Ordering caveat:** the re-embed snapshot/kick logic straddles the save (`prev_*` read at :449-451, `new_settings` re-read + `start_reembed` at :471-481). Put the bool-check immediately after the `save_app_settings` call (replacing :453) so a failed save raises BEFORE the audit-write and the re-embed kick.

**Audit redaction already correct** — `settings.py:454` already redacts `_key`/`_secret` in the audit metadata (`"[REDACTED]" if "_key" in k or "_secret" in k`); encryption does not change this (never log the ciphertext either — T-081.1-04).

**Pitfall-2 guard (from RESEARCH):** provider-key columns did not exist pre-mig-100. With D-150-08 adding them, the `updates[f"{p.id}_api_key"]` build at `settings.py:329` now targets real columns — but confirm the plan applies mig 100 BEFORE relying on the D-150-07 500, else a provider-key save 500s the whole batch on `UndefinedColumn`.

---

### `backend/app/main.py` (MOD — config, boot lifespan)

**Analog:** two adjacent blocks in the SAME `lifespan()` — one for each polarity D-150-04 demands.

**Key validation = HARD-FAIL (no try/except)** — mirror `assert_action_types_synced` (:270-275), the one lifespan hook that is deliberately NOT best-effort:
```python
# main.py:270-275 — the hard-fail precedent (copy this polarity for get_cipher())
# Phase 110 DMF-01 — audit-enum drift guard. MUST hard-fail (unlike the
# best-effort blocks above) ... Mirrors the 075.4 UnknownProviderError-at-startup pattern.
from app.services.audit_service import assert_action_types_synced
await assert_action_types_synced(await get_pg_pool())
```
Call `get_cipher()` un-wrapped: a malformed key raises `ValueError` → propagates → all `WORKER_COUNT=2` workers refuse to start (D-150-04). If it returns `None`, log the loud D-150-01 warning naming `SECRETS_ENCRYPTION_KEY`.

**Eager sweep = BEST-EFFORT (try/except → log + continue)** — mirror the `seed_operators_from_env` block (:254-268), the proven idempotent WORKER_COUNT=2-safe startup-write:
```python
# main.py:263-268 — the best-effort idempotent-write precedent (copy this for the sweep)
from app.services.operator_service import seed_operators_from_env
try:
    await get_pg_pool()  # ensure pool exists before the seed write
    await seed_operators_from_env()
except Exception as e:
    logger.error("Operator seed failed (app continues, no operators bootstrapped): %s", e)
```
**Placement (RESEARCH §Pattern 4):** the sweep MUST run AFTER `_migrate_settings_override()` (:250) so it encrypts whatever the legacy migration wrote, and alongside the operator seed (:263-268). Idempotence = the `enc:v1:` prefix check; rotation-detection = `Fernet(primary).decrypt(token)` succeeds → skip, else `MultiFernet.rotate()` (Pitfall 3 — never blind-rotate every boot).

**Legacy `_migrate_settings_override` (:133-223)** — D-150-Discretion / RESEARCH §Pattern 5: leave it writing plaintext, add a one-line comment that the sweep (later in the same boot) encrypts it. Note its `_API_KEY_COLUMNS` targets provider columns; post-mig-100 those exist.

---

### Encryption-state signal (D-150-02) — `health_probe.py` + `admin.py` + `HealthSignals.tsx` + `api.ts`

**Analog:** the entire Phase-147 dependency-health wire, end to end. The new `secrets_encryption` block rides the SAME additive path as `dependencies`.

**Backend payload append** — `admin.py::get_backpressure` (:185-198) appends `dependencies`; append `secrets_encryption` the identical way:
```python
# admin.py:185-198 — the additive-block precedent
from app.services.health_probe import probe_dependencies
dependencies = await probe_dependencies()
return {
    "anyio_threadpool_depth": {...},
    "redis_active_runs": redis_active_runs,
    "postgres_pool_in_use": pg_in_use,
    "per_worker_run_count": per_worker_run_count,
    "dependencies": dependencies,
    # NEW: "secrets_encryption": encryption_status(),   # from secret_cipher
}
```
`encryption_status()` is a cheap in-process read (no network) — it can be called directly in `get_backpressure` OR re-exported through `health_probe.py` for locality; the probe-module docstring convention (`health_probe.py:1-34`) is the shape if you add it there.

**Frontend wire type** — extend `BackpressureSignals` in `api.ts` (:3604-3617) additively, exactly like the `dependencies?:` block:
```typescript
// api.ts:3614-3617 — the additive optional-block precedent
dependencies?: {
  redis: { state: "up" | "down"; latency_ms: number | null }
  supabase: { state: "up" | "down"; latency_ms: number | null }
  sandbox: { state: "off" | "up" | "down"; latency_ms: number | null }
}
// NEW (optional, back-compat): secrets_encryption?: { state: "encrypted"|"plaintext"|"error"; columns_unreadable?: number }
```

**Tile render** — `HealthSignals.tsx` renders the `DEP_ORDER` tiles (:185-213). The encryption tile copies the dot-status + plain-word + ⌥ Technical-name pattern (`DEP_DOT` :117-123, `DEP_STATUS_LABEL` :127-133, the `showTechnical` reveal :201-209). Map the three D-150-02 states to the existing NEUTRAL/green/red vocabulary:
- `encrypted` → `bg-success` / "Encrypted"
- `plaintext` (no key) → NEUTRAL `bg-muted-foreground/40` / "Plaintext (no key set)" — a deliberate no-key config is NOT red (same Pitfall-6 reasoning the `off` sandbox uses at :121)
- `error` (N columns unreadable) → `bg-destructive` / "N secrets unreadable"
Add the `secrets_encryption` field to the `SIGNAL_ORDER`-style label map with its raw field name under ⌥ (`HealthSignals.tsx:168-172` / `:201-209`).

---

### `backend/app/config.py::Settings` (MOD — config)

**Analog:** `operator_emails: str = ""` (:921) — a comma-separated env-only string (same shape as the MultiFernet key list) — and `langsmith_api_key: str = ""` (:1149) — an env-only secret string.
```python
# config.py:921 + :1149 — the two shape precedents
operator_emails: str = ""
langsmith_api_key: str = ""
# NEW (RESEARCH §Config env var):
# Phase 150 (SEC-01) — comma-separated MultiFernet key list; FIRST encrypts, rest decrypt-only.
# Secret/infra → env only (CLAUDE.md). Empty => D-150-01 fail-open plaintext + loud boot warning.
secrets_encryption_key: str = ""
```
`Settings` is a pydantic-settings `BaseSettings` (instantiated `settings = Settings()` at `config.py:1156`), so the env var `SECRETS_ENCRYPTION_KEY` auto-binds. Also document it in `backend/.env.example` near the secrets block with the `Fernet.generate_key()` one-liner (RESEARCH §Code Examples).

---

### `backend/requirements.txt` (MOD — manifest)

**Analog:** the commented-pin entries added by prior phases (Camelot :43-46, google-genai :48-55, the Phase-071.3 undeclared-direct-imports block :57-63).
```
# requirements.txt — the commented-pin convention
camelot-py[base]>=1.0.0,<2.0.0     # Added by Phase 071.3 Plan 02 (D-071.3-05) ...
# NEW:
cryptography>=44.0.0               # Phase 150 (SEC-01) — Fernet/MultiFernet at-rest secret encryption
```
Already transitively present (venv has 46.0.7); this makes it a DECLARED direct dep. A fresh Coolify build `pip install`s it (wheels available — no build toolchain). No sandbox image rebuild.

---

### Tests — `backend/tests/test_150_*.py` + `tests/integration/test_150_*.py` (NEW)

RESEARCH §Validation Architecture already enumerates the full test→SC map. Analogs per test type:

**Pure-unit, monkeypatch-at-boundary** (cipher core, no-key passthrough, malformed-key `ValueError`, rotation) → **`test_147_health_probe.py`** (`:27-50` — `async def test_…(monkeypatch)`, `monkeypatch.setattr("app.dependencies.get_redis", …)`, assert on the returned dict). For the cipher, monkeypatch `app.config.settings.secrets_encryption_key`.

**Seam-unit with a fake pool** (encrypt-on-write asserts the `enc:v1:` param; decrypt-on-read + fail-soft) → **`test_147_flag_failure_semantics.py`** `_StubPool` (:37-70). It stands in as `app.dependencies._pg_pool`; `save_app_settings` calls `pool.execute(...)` (assert the encrypted value landed in `execute_calls`), `_load_settings_from_db` calls `pool.fetchrow(...)` (queue an `enc:v1:` row, assert plaintext surfaces). The module docstring (:18-22) is the canonical "mock the DATA-ACCESS layer the loader actually uses (asyncpg pool), NOT supabase" lesson — copy it.

**API-unit for D-150-07 500** → same `_StubPool` approach; make `execute` raise (or `save_app_settings` return `False`) and assert `update_settings` → HTTP 500.

**Integration (live-PG guarded)** — sweep idempotence + the SC#1 ciphertext-at-rest proof (a raw read shows `enc:v1:`, NOT plaintext) → **`test_081_1_settings_migration.py`** `_pg_reachable` guard (:32-64): the `_POSTGRES_TEST_DSN` default, `_pg_reachable`/`_check_pg_available_sync`, `PG_AVAILABLE` + `pytest.mark.skipif` module gate, and the function-scoped `pg_pool` fixture (:71+). The ciphertext-at-rest test reuses this harness to `SELECT embedding_api_key FROM app_settings` and assert it starts with `enc:v1:`.

Run commands (RESEARCH): `cd backend && venv/Scripts/python.exe -m pytest tests/test_150_*.py -x` (unit) / `... tests/integration/test_150_*.py -x` (live-PG).

---

## Shared Patterns

### Fail-soft settings posture (D-150-04/05)
**Source:** `backend/app/models/user_settings.py` — `_val` chain (:416-428), the FLAG-01 helpers' explicit polarity (`self_improve_enabled`/`workflows_enabled` default-True :789-812; `maintenance_mode` default-False :815-827), and `_load_settings_from_db`'s never-reset-on-blip cache (:242-257).
**Apply to:** the decrypt seam (dropped column → env fallback), the sweep (log + continue), the read path (never fail-closed).
The intent-based failure polarity table (D-150-04) is the phase through-line: no-key → plaintext+warn (fail-open); malformed key → refuse-to-start (fail-hard, mirror `assert_action_types_synced`); undecryptable value → env fallback (fail-soft, mirror the `_val` chain).

### Never log secret values (T-081.1-04)
**Source:** `backend/app/main.py:219-223` ("never log API key values, only key names and counts") + `backend/app/api/settings.py:454` (audit `[REDACTED]` for `_key`/`_secret`).
**Apply to:** every crypto/sweep/decrypt-failure log — column NAMES + counts only, never the plaintext OR the ciphertext token.

### SQLi-safe column allowlist
**Source:** `backend/app/main.py:125-130` `_API_KEY_COLUMNS` (the "CR-01 fix: allowset for API key column names prevents SQL injection from crafted JSON keys"). Values are always parameterized `$N` (`save_app_settings:302-314`).
**Apply to:** the encrypt seam's column iteration, the sweep's column set, and the mig-100 column list — all three iterate `_API_KEY_COLUMNS`, never user-supplied key names.

### Idempotent WORKER_COUNT=2-safe startup write
**Source:** `backend/app/services/operator_service.py::seed_operators_from_env` (:136-167, `ON CONFLICT DO NOTHING`, "both workers race, first wins, second no-ops — NO lock/leader-election"), wired best-effort at `main.py:263-268`.
**Apply to:** the D-150-03 sweep — the `enc:v1:` prefix check makes a double-encrypt of the same plaintext harmless (last-writer-wins, both decrypt identically).

### Additive Control-Plane signal (D-078-08 additive-only)
**Source:** the Phase-147 dependency-health wire — `probe_dependencies` (`health_probe.py:107-116`) → `get_backpressure` append (`admin.py:185-198`) → `BackpressureSignals.dependencies?` (`api.ts:3614-3617`) → `HealthSignals` tiles (`HealthSignals.tsx:75-213`).
**Apply to:** the `secrets_encryption` block — ride the same additive path, keep every existing key byte-identical, back-compat optional on the frontend (`secrets_encryption?`).

### Pitfall-6 NEUTRAL-not-red for deliberate config
**Source:** `frontend/src/components/admin/HealthSignals.tsx` — the sandbox `off` state renders `bg-muted-foreground/40`, NEVER `bg-destructive` (:105-133).
**Apply to:** the `plaintext (no key set)` encryption state — a no-key deployment (D-150-01) is a deliberate config, so NEUTRAL grey, never red. Only `error` (columns unreadable) is red.

---

## No Analog Found

None. Every file is either an edit to an existing seam or copies a same-repo additive precedent. The one structurally-new file (`security/secret_cipher.py`) has its full body in RESEARCH.md §Pattern 1 and copies `health_probe.py`'s module conventions.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `backend/app/security/` (new package dir) | — | — | No `security/` package exists yet; create it with the module. Not a missing-analog — the module SHAPE has an analog (`health_probe.py`); only the directory is new. |

---

## Metadata

**Analog search scope:** `backend/app/{models,api,services,security,config.py,main.py}`, `backend/tests/**`, `supabase/migrations/09*.sql`, `frontend/src/{components/admin,lib}`.
**Files scanned (read):** `user_settings.py`, `main.py` (lifespan + constants), `health_probe.py`, `admin.py` (backpressure + set_flag), `settings.py` (update_settings), `config.py` (Settings tail), `HealthSignals.tsx`, `api.ts` (BackpressureSignals), migrations 097/099, `operator_service.py` (seed), `requirements.txt`, `test_147_flag_failure_semantics.py`, `test_147_health_probe.py`, `test_081_1_settings_migration.py`.
**Pattern extraction date:** 2026-07-13
