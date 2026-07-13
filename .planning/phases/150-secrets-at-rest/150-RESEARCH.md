# Phase 150: Secrets at Rest - Research

**Researched:** 2026-07-13
**Domain:** Application-layer symmetric encryption of DB-stored secrets (Python `cryptography` Fernet/MultiFernet), fail-soft settings substrate, idempotent startup migration
**Confidence:** HIGH (crypto API empirically verified against the installed library; seam + DB reality verified against live source and the running Postgres)

## Summary

This is a backend-only phase that adds app-layer encryption to provider/secret API keys stored in the `app_settings` row, using the PyCA `cryptography` library. The locked cipher direction (Fernet/MultiFernet) is **confirmed correct** by evidence: `MultiFernet` natively implements the exact D-150-06 rotation model (first key encrypts, all keys decrypt, `rotate()` re-encrypts under primary), and Fernet raises exactly the exceptions the failure-polarity table (D-150-04) needs — `ValueError` at key-construction for a malformed key (→ refuse-to-start) and `InvalidToken` at decrypt for a wrong/rotated-away key (→ fail-soft to env). AESGCM would require hand-rolling nonce management, a key-rotation container, and a version envelope that Fernet already ships. **Use Fernet + MultiFernet.**

The single most important finding is a **DB-reality divergence that the CONTEXT.md scope assumed away**: of the nominal "12 secret columns" in `_API_KEY_COLUMNS` (`main.py:125-130`), **only 2 actually exist as columns in the live database** — `embedding_api_key` and `rerank_api_key`. The 9 `{provider}_api_key` columns and `tavily_api_key` were designed in code but **never added by any migration**. Verified against the running Postgres (`information_schema.columns` → 61 columns, no provider-key columns; `llm_providers` jsonb = `[]`; a test `UPDATE app_settings SET openai_api_key=…` returns `UndefinedColumn`). This means (a) provider LLM keys are effectively **env-only** today, (b) saving a provider key through Settings **already fails silently** (the exact D-150-07 bug — `UndefinedColumn` → caught → `save_app_settings` returns `False` → `update_settings` ignores it → HTTP 200), and (c) the CONTEXT.md claim "the secret columns already exist; likely no migration needed" is false for 10 of 12. The planner MUST resolve a scope fork (see Open Questions Q1) before the plan locks.

**Primary recommendation:** Build a single `crypto` module wrapping `MultiFernet` (comma-split `SECRETS_ENCRYPTION_KEY` env var), with an explicit `enc:v1:` envelope. Put encrypt at the one write seam (`save_app_settings`) and decrypt at the one read seam (`_build_settings_from_row`, operating on a decrypted copy so the 30s cache keeps ciphertext and decrypt-failure auto-falls-back to env via the existing `_val` chain). Validate the key + run the idempotent sweep in `lifespan()`. Surface the state on `/admin/backpressure`. **Escalate the column-existence fork to the operator** — recommended resolution is to add the 10 missing columns via one numbered migration (root-cause fix; makes SC#1 literally true for provider keys and fixes the latent silent-save), but this contradicts the "no migration" assumption and needs sign-off.

## Project Constraints (from CLAUDE.md)

Directives that bind this phase (treated with locked-decision authority):

- **Python backend must use a `venv`** — confirmed; `cryptography` 46.0.7 already present transitively in `backend/venv`.
- **No LangChain / LangGraph; raw SDK only** — N/A to crypto, but no framework wrappers.
- **Use Pydantic for structured outputs** — N/A here (no LLM output).
- **Env vars are for secrets and infra only** — the master key `SECRETS_ENCRYPTION_KEY` belongs in env (a secret), NOT in `app_settings`. Correct per D-150-01/06.
- **Do not run blocking I/O directly in async handlers; wrap with `run_in_threadpool`** (D-v2.5-01) — Fernet encrypt/decrypt is pure-CPU and microsecond-fast; it does NOT need threadpool offload. The DB writes it composes with already go through asyncpg (non-blocking).
- **Multi-worker `WORKER_COUNT=2` is the default** (D-PRD-12) — the startup sweep and key-validation run per-worker; both must be idempotent/concurrent-safe (mirror the Phase 146 `seed_operators_from_env` precedent).
- **Migrations ship as numbered SQL under `supabase/migrations/`, applied by pasting into the Supabase SQL editor** — never `db push`/`db reset`. `<digits>_name.sql` naming; regenerate `supabase/full-schema.sql` via `scripts/regenerate-full-schema.sh` (no `--reset`). Relevant ONLY if the column-fork (Q1) is resolved toward adding columns.
- **Never log secret values** (T-081.1-04; audit already redacts `_key`/`_secret`) — all crypto/sweep logs emit column NAMES + counts only.
- **Cloud config drifts from local; code deploying ≠ cloud configured** — the new env var must be documented for Coolify at promotion; mig 099 (Phase 149) is still pending on cloud (parity debt to carry).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-150-01 (missing master key):** Fail-open with a loud warning. No encryption env var → platform boots exactly as today, secrets stay/save plaintext, a prominent startup log warns and names the env var. Encryption activates on the next boot after the key is set. Auto-generating a key was REJECTED (Coolify FS is ephemeral — a redeploy would lose the key and brick every stored secret).
- **D-150-02 (operator visibility):** Encryption state visible in TWO places — backend startup logs AND a small honest field on the existing `/admin` Control Plane dependency-health board (Phase 147). States: `encrypted ✓` / `plaintext ⚠ (no key set)` / error state per D-150-05. This is the phase's only frontend touch (one field on an existing tile board, no new surface).
- **D-150-03 (migrate existing plaintext):** Eager startup sweep. On every boot where a valid key is present, an idempotent sweep encrypts any plaintext values in the secret columns in place. `app_settings` is one `id='global'` row → trivial. WORKER_COUNT=2-safe + idempotent (Phase 146 `seed_operators_from_env` precedent). Sweep failure = log + continue (read path tolerates plaintext), retry next boot. Lazy encrypt-on-save was REJECTED.
- **D-150-04 (failure polarity, intent-based):** No key → plaintext + warn (operator hasn't opted in). Key set but MALFORMED (invalid Fernet/base64, typo) → REFUSE TO START with a clear error + key-gen hint (mirrors 075.4 `UnknownProviderError` raise-at-startup). Key valid but a stored value WON'T DECRYPT → fail-soft per column: treat as unset so the existing env-fallback chain takes over; platform stays up; loud per-column log; Control Plane shows error state.
- **D-150-05:** A decrypt failure must NEVER take the platform down (settings reads sit on nearly every request path; uniform fail-soft/last-known-good posture).
- **D-150-06 (rotation):** Multi-key env from day one (MultiFernet). Env var accepts a comma-separated key list — FIRST encrypts, older keys decrypt-only. The sweep additionally re-encrypts any value not under the current primary key. Rotation = prepend new key → reboot (sweep re-encrypts) → remove old key. NO new admin endpoint, NO CLI, NO rotate-without-reboot.
- **D-150-07 (round-trip verification):** The silent-success bug is in scope: `update_settings` (`settings.py:453`) calls `save_app_settings` and ignores the returned bool — a failed key save returns HTTP 200 today. Must surface a failed save as a real HTTP error (Phase 147 CR-02 precedent). "Round-trip verified" = after an encrypted save, the value must decrypt back to what was submitted before the save is reported successful.

### Claude's Discretion
- Cipher choice within the locked library (Fernet vs AESGCM — Fernet/MultiFernet is the natural fit given D-150-06; researcher confirms). → **CONFIRMED: Fernet/MultiFernet** (see Standard Stack).
- Exact env var name (something like `SECRETS_ENCRYPTION_KEY`). → **RECOMMENDED: `SECRETS_ENCRYPTION_KEY`**.
- Stored-value envelope/marker format (Fernet's `gAAAAA` prefix vs an explicit `enc:v1:` wrapper — pick one that keeps D-150-03 idempotence + future format versioning clean). → **RECOMMENDED: explicit `enc:v1:` wrapper** (see Pattern 2).
- Where the encrypt/decrypt seam lives (natural single seams: `save_app_settings()` encrypt-on-write; `_load_settings_from_db()` / `_build_settings_from_row()` decrypt-on-read; ONE seam per direction, no caller sees ciphertext). → **RECOMMENDED: encrypt in `save_app_settings`; decrypt in `_build_settings_from_row`** (see Pattern 3).
- Whether the legacy `_migrate_settings_override()` path gets encryption or a comment + reliance on the D-150-03 sweep. → **RECOMMENDED: comment + rely on the sweep** (see Pattern 5).
- Test strategy, including the SC-level proof that a psql/SQL-editor read of `app_settings` shows ciphertext not plaintext. → **See Validation Architecture.**

### Deferred Ideas (OUT OF SCOPE)
- **HashiCorp Vault / external secret-store adapters** — REQUIREMENTS.md Future Requirements (enterprise tier, after SEC-01's abstraction proves out). D-150-06's multi-key + single-seam design IS that abstraction.
- **Rotate-without-reboot admin action** — explicitly rejected (D-150-06). Re-open trigger: an operator needs zero-downtime rotation (>1 org / SLA constraints in v3.4+ multi-tenancy).
- **pgsodium** — Supabase is deprecating it; app-layer `cryptography` chosen (locked in REQUIREMENTS.md).
- **Encrypting non-secret settings values** — out of scope; only the secret columns.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Provider API keys stored in `app_settings` are encrypted at rest (app-layer `cryptography` Fernet/AESGCM — NOT pgsodium) with env-var fallback precedence preserved so local dev and existing deployments keep working unchanged; key saves are round-trip verified (never silently swallowed). | Standard Stack confirms Fernet/MultiFernet + version. Architecture Patterns give the exact encrypt/decrypt seams, `enc:v1:` envelope, MultiFernet rotation, idempotent sweep, and the D-150-07 bool-surfacing fix. Open Question Q1 surfaces the load-bearing column-existence fork that decides whether "provider API keys" (LLM providers) can be encrypted at rest at all vs. only embedding/rerank keys. Validation Architecture gives the psycopg2 ciphertext-at-rest SC#1 proof. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Symmetric encrypt/decrypt of secret values | API / Backend (a new `app.services.crypto` or `app.security.secret_cipher` module) | — | Pure-CPU crypto; the master key lives in backend env only; no client/DB tier ever sees the key. |
| Encrypt-on-write | API / Backend — `save_app_settings()` (the ONE write seam) | — | Every secret write funnels here; composing encryption after the existing sentinel guard keeps one seam. |
| Decrypt-on-read | API / Backend — `_build_settings_from_row()` (the ONE build seam both sync + async read paths flow through) | — | Both `load_app_settings()` and `load_app_settings_async()` call it; decrypting on a copy keeps the 30s cache holding ciphertext. |
| Ciphertext persistence | Database / Storage — `app_settings` text columns | — | Base64 `enc:v1:…` fits existing `text` columns; NO column-type change needed (verified: `embedding_api_key text`, `rerank_api_key text`). |
| Key validation + eager sweep | API / Backend — `lifespan()` startup | Database (one `UPDATE`) | Config error (malformed key) = fail-hard at boot; sweep = one row rewrite, per-worker idempotent. |
| Encryption-state signal | API / Backend — `/admin/backpressure` payload | Browser — `HealthSignals.tsx` tile | Additive to the Phase 147 `dependencies` block; the frontend already renders that board. |
| Master key material | Backend env var (`SECRETS_ENCRYPTION_KEY`) — infra tier | — | CLAUDE.md: "env vars are for secrets and infra only"; Coolify/Vercel config at deploy. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cryptography` | `>=44.0.0` (installed & verified: **46.0.7**; latest 49.0.0) | Fernet + MultiFernet authenticated symmetric encryption | PyCA's reference library; Fernet is a complete misuse-resistant recipe (AES-128-CBC + HMAC-SHA256 encrypt-then-MAC + timestamp + url-safe base64). `MultiFernet` is the canonical key-rotation container. Already a transitive dep in the venv. [VERIFIED: empirical probe against installed 46.0.7 + PyPI `pip index versions`] |

**Cipher decision — Fernet/MultiFernet over AESGCM (CONFIRMED):**

| Requirement | Fernet / MultiFernet | AESGCM (`cryptography.hazmat`) |
|-------------|----------------------|-------------------------------|
| D-150-06 multi-key rotation, first-encrypts/all-decrypt | **Built in** — `MultiFernet([f_new, f_old])`; `.rotate()` re-encrypts under primary [VERIFIED] | Hand-roll: key-id tagging, iterate keys on decrypt, custom rotate |
| Nonce management | Handled internally (IV per token) | Caller MUST generate a unique 96-bit nonce per encryption (misuse = catastrophic) |
| Version envelope / format upgrade path | Token carries a version byte; wrap in `enc:v1:` for app-level versioning | None — hand-roll |
| Authenticated (tamper-evident) | Yes (HMAC) | Yes (GCM tag) |
| Malformed-key detection | `ValueError` at `Fernet(key)` construction [VERIFIED] | Manual length check |
| Wrong-key decrypt signal | `InvalidToken` [VERIFIED] | `InvalidTag` |

Fernet answers every D-150 requirement with library code; AESGCM answers none of the envelope/rotation needs and adds nonce-reuse foot-guns. **Fernet/MultiFernet is decisively correct.** AES-128 (Fernet) vs AES-256 (AESGCM) is irrelevant to this threat model (at-rest column encryption with an env-held key; AES-128 is not the weak link).

**Empirically verified against the installed library (46.0.7):**
- `Fernet.generate_key()` → 44-byte `bytes`, url-safe base64 of 32 raw bytes.
- Every Fernet token begins with `gAAAAA` (version byte `0x80` + timestamp, base64-encoded).
- `Fernet(bad_key)` → `ValueError: Fernet key must be 32 url-safe base64-encoded bytes.` for short/long/invalid-base64/empty inputs — raised at **construction** (perfect for boot-time fail-hard, D-150-04).
- `MultiFernet([Fernet(bad)])` also raises the same `ValueError` at construction.
- `Fernet(other_key).decrypt(token)` → `cryptography.fernet.InvalidToken`.
- `Fernet(k).decrypt(<plaintext or non-token>)` → `InvalidToken` too (so classification of plaintext-vs-ciphertext must NOT rely on catching decrypt — use the explicit `enc:v1:` prefix instead; see Pitfall 1).
- `MultiFernet([f_new, f_old]).decrypt(old_token)` → succeeds; `.rotate(old_token)` → re-encrypts under `f_new` (old key can no longer decrypt the rotated token). Rotation model matches D-150-06 exactly.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `base64` (stdlib) | — | Operator key-gen alternative / envelope handling | Only if not using `Fernet.generate_key()` directly. Prefer `Fernet.generate_key()`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fernet/MultiFernet | `cryptography.hazmat` AESGCM | Lower-level; must hand-roll nonce + rotation + envelope; nonce-reuse foot-gun. Rejected. |
| App-layer `cryptography` | pgsodium (Postgres extension) | Supabase deprecating it; locked OUT in REQUIREMENTS.md. |
| App-layer `cryptography` | Supabase Vault / external KMS | Deferred (Future Requirements); D-150-06 single-seam IS the abstraction those build on. |

**Installation:**
```bash
# Add to backend/requirements.txt:
#   cryptography>=44.0.0   # Phase 150 (SEC-01) — Fernet/MultiFernet at-rest secret encryption
# Already transitively present in the venv (46.0.7); explicit pin makes it a declared direct dep.
pip install 'cryptography>=44.0.0'
```

**Version verification:** `pip index versions cryptography` → latest 49.0.0; installed 46.0.7; the Fernet/MultiFernet API is stable back to ~1.0 (the `rotate()` addition and `ttl` semantics are years old). A `>=44.0.0` floor guarantees a recent OpenSSL/CVE posture without over-pinning. [VERIFIED: PyPI + installed venv]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `cryptography` | PyPI | ~13 yrs (first release 2014) | ~300M+/mo (PyCA reference lib) | github.com/pyca/cryptography | `[OK]` (pypi) | **Approved** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 ran `slopcheck install cryptography` → `1 OK` on PyPI. `pip index versions cryptography` confirms an authentic, deeply-versioned PyCA package. No postinstall/network risk (Python, not npm). This is the canonical, authoritative crypto package — tagged `[VERIFIED: PyPI + slopcheck OK]`.

## Architecture Patterns

### System Architecture Diagram

```
                    SETTINGS SAVE (encrypt-on-write)
  Settings UI ──PUT /settings──► update_settings (settings.py)
                                    │  builds updates{}: {pid}_api_key, embedding_api_key, …
                                    ▼
                          save_app_settings(updates)   ◄── THE ONE WRITE SEAM
                                    │  1. sentinel/_is_valid_api_key guard (validate PLAINTEXT)
                                    │  2. NEW: for k in clean if k in _API_KEY_COLUMNS:
                                    │         clean[k] = cipher.encrypt(clean[k])  → "enc:v1:gAAAAA…"
                                    │         (skipped when no master key → D-150-01 plaintext)
                                    ▼
                          UPDATE app_settings SET … (asyncpg)
                                    │  returns bool ─────────────► D-150-07: update_settings
                                    ▼                              MUST raise 500 on False
                          app_settings row  ── ciphertext at rest (SC#1)

                    SETTINGS READ (decrypt-on-read)
  any request ──► load_app_settings[_async]()
                                    │
                          _load_settings_from_db()  ── 30s TTL cache stores the RAW row (ciphertext)
                                    ▼
                          _build_settings_from_row(row)   ◄── THE ONE READ SEAM
                                    │  NEW: plain = decrypt_secret_columns(row)   (works on a COPY)
                                    │        for k in _API_KEY_COLUMNS present & "enc:v1:"-prefixed:
                                    │          try cipher.decrypt → plaintext
                                    │          except InvalidToken → DROP key (D-150-04 fail-soft)
                                    ▼
                          _build_providers(plain) + _val(plain, …)
                                    │  dropped/undecryptable column → _val falls back to ENV (SC#3)
                                    ▼
                          UserEffectiveSettings (plaintext) ── no consumer sees ciphertext

                    STARTUP (lifespan, per worker, WORKER_COUNT=2)
  boot ─► validate master key: MultiFernet(split(SECRETS_ENCRYPTION_KEY))
              │  malformed → ValueError → RE-RAISE → REFUSE TO START (D-150-04)
              │  absent → log loud "secrets NOT encrypted; set SECRETS_ENCRYPTION_KEY" (D-150-01)
              ▼
          eager idempotent sweep: read global row → for each existing secret column:
              plaintext (no enc:v1:) → encrypt in place
              enc:v1: not under primary key → rotate() to primary (D-150-06)
              already primary → skip (idempotent)  → UPDATE (fail → log + continue, D-150-03)

                    OPERATOR SIGNAL (D-150-02)
  GET /admin/backpressure ─► + "secrets_encryption": {state, columns_unreadable}
                                    ▼  HealthSignals.tsx renders a tile (encrypted ✓ / plaintext ⚠ / error)
```

### Recommended Project Structure
```
backend/app/
├── security/
│   └── secret_cipher.py    # NEW — MultiFernet wrapper: get_cipher(), encrypt_secret(),
│                           #        decrypt_secret(), is_encrypted(), encryption_status()
├── models/
│   └── user_settings.py    # EDIT — encrypt in save_app_settings; decrypt in _build_settings_from_row
├── main.py                 # EDIT — lifespan: validate key (fail-hard) + eager sweep; comment on _migrate_settings_override
├── api/
│   ├── settings.py         # EDIT — update_settings surfaces save_app_settings bool (D-150-07 → 500)
│   └── admin.py            # EDIT — /backpressure adds secrets_encryption block
├── config.py               # EDIT — add secrets_encryption_key: str = "" to Settings (env)
└── requirements.txt        # EDIT — cryptography>=44.0.0

frontend/src/components/admin/
└── HealthSignals.tsx       # EDIT — render the secrets_encryption tile (two-audience ⌥ reveal)
```

### Pattern 1: The cipher module (single source of key material)
**What:** One module owns key parsing, cipher construction, and the encrypt/decrypt/detect helpers. Read the env var lazily (via `env_settings` or `os.getenv`) so tests can monkeypatch it and the key is validated at first use / at boot.
**When to use:** All encrypt/decrypt goes through here — no `Fernet(...)` anywhere else.
**Example:**
```python
# backend/app/security/secret_cipher.py
# Source: cryptography.io/en/latest/fernet/ (Fernet + MultiFernet) — API empirically verified against 46.0.7
from __future__ import annotations
import logging
from cryptography.fernet import Fernet, MultiFernet, InvalidToken

logger = logging.getLogger(__name__)

_ENVELOPE_PREFIX = "enc:v1:"   # explicit, versionable marker (see Pattern 2)

def _load_keys() -> list[str]:
    from app.config import settings as env_settings
    raw = (getattr(env_settings, "secrets_encryption_key", "") or "").strip()
    return [k.strip() for k in raw.split(",") if k.strip()]   # FIRST encrypts, rest decrypt-only

def get_cipher() -> MultiFernet | None:
    """Return a MultiFernet, or None when no key is configured (D-150-01 plaintext mode).

    Raises ValueError (propagated) when a key is present but malformed — the caller at
    boot RE-RAISES to refuse startup (D-150-04). Fernet(...) is what raises the ValueError.
    """
    keys = _load_keys()
    if not keys:
        return None
    return MultiFernet([Fernet(k) for k in keys])   # ValueError here on a bad key

def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_ENVELOPE_PREFIX)

def encrypt_secret(plaintext: str, cipher: MultiFernet) -> str:
    token = cipher.encrypt(plaintext.encode()).decode()
    return f"{_ENVELOPE_PREFIX}{token}"

def decrypt_secret(value: str, cipher: MultiFernet) -> str:
    """Decrypt an enc:v1: value. Raises InvalidToken if it won't decrypt (D-150-04 fail-soft)."""
    token = value[len(_ENVELOPE_PREFIX):]
    return cipher.decrypt(token.encode()).decode()
```
Notes:
- **Never pass a `ttl`** to `cipher.decrypt(...)` — secrets do not expire; a `ttl` would make old stored keys undecryptable over time (Pitfall 4).
- The module also exposes `encryption_status()` for the Control Plane signal (below) and `sweep_row(row)`/`needs_rotation(value, cipher)` helpers for the startup sweep.

### Pattern 2: Explicit `enc:v1:` envelope (RECOMMENDED over the raw `gAAAAA` prefix)
**What:** Store ciphertext as `enc:v1:<fernet-token>`. Classify plaintext-vs-ciphertext by prefix, not by attempting a decrypt.
**Why over `gAAAAA`:**
- **Idempotent sweep stays clean:** "already encrypted?" = `value.startswith("enc:v1:")` — a cheap, allocation-free check with NO exception-driven control flow. (Relying on the `gAAAAA` Fernet prefix would work today but couples the sweep to Fernet's internal token format.)
- **Distinguishes the three read states unambiguously:** `enc:v1:…` that decrypts (happy path) / `enc:v1:…` that raises `InvalidToken` (wrong-or-rotated-away key → D-150-04 fail-soft to env) / no-prefix (legacy plaintext → use as-is + mark for the sweep). Without the marker, an undecryptable ciphertext and a plaintext value both surface indistinguishably (both raise `InvalidToken` on a blind decrypt — VERIFIED).
- **Future format versioning built in:** `enc:v2:` for a future scheme (e.g., a KMS-wrapped key) with a trivial dispatch on the version tag.
- **Visible ciphertext-at-rest proof:** a SQL-editor read shows `enc:v1:gAAAA…`, reinforcing SC#1 for a human.
**Anti-pattern:** classifying by "try decrypt, on `InvalidToken` assume plaintext" — this silently swallows a genuine wrong-key ciphertext as if it were plaintext, corrupting the D-150-04 fail-soft signal.

### Pattern 3: One encrypt seam + one decrypt seam
**Encrypt (write):** in `save_app_settings`, AFTER the existing `_is_valid_api_key`/sentinel guard builds `clean`, encrypt in place:
```python
# in save_app_settings, after `clean` is built, before the UPDATE
from app.security.secret_cipher import get_cipher, encrypt_secret, is_encrypted
from app.main import _API_KEY_COLUMNS   # or move the constant into a shared module to avoid a cycle
cipher = get_cipher()
if cipher is not None:
    for k in list(clean):
        if k in _API_KEY_COLUMNS and isinstance(clean[k], str) and not is_encrypted(clean[k]):
            clean[k] = encrypt_secret(clean[k], cipher)
# (no cipher → D-150-01: values persist plaintext)
```
**Decrypt (read):** at the TOP of `_build_settings_from_row`, decrypt onto a copy so the cache keeps ciphertext and undecryptable columns auto-fall-back via `_val`:
```python
def _build_settings_from_row(row: dict) -> UserEffectiveSettings:
    row = _decrypt_secret_columns(row)   # NEW — returns a shallow copy; dropped keys → env fallback
    providers = _build_providers(row)
    ...

def _decrypt_secret_columns(row: dict) -> dict:
    from app.security.secret_cipher import get_cipher, is_encrypted, decrypt_secret
    from cryptography.fernet import InvalidToken
    cipher = get_cipher()
    if cipher is None:
        return row
    out = dict(row)
    for k in _API_KEY_COLUMNS:
        v = out.get(k)
        if isinstance(v, str) and is_encrypted(v):
            try:
                out[k] = decrypt_secret(v, cipher)
            except InvalidToken:
                logger.error("secret_cipher: column %s failed to decrypt; falling back to env (D-150-04)", k)
                out[k] = None   # _val(row, k, k, env) → env fallback engages (SC#3)
    return out
```
**Why this exact placement:** both the sync `load_app_settings()` and async `load_app_settings_async()` funnel through `_build_settings_from_row`, so there is genuinely ONE decrypt seam no consumer bypasses. `_decrypt_secret_columns` is pure-CPU (no pool) so it works in the sync path. Decrypt-failure → `None` → the *existing* `_val(row, key, env_attr, default)` DB-over-env chain returns the env value with zero new fallback code — D-150-04/05 fail-soft for free.
**Anti-pattern:** decrypting inside `_load_settings_from_db` (would store plaintext in the 30s cache) — the copy-in-`_build` approach keeps the cache holding ciphertext (defense-in-depth) at a negligible per-request decrypt cost (Fernet decrypt is microseconds).

### Pattern 4: Boot-time key validation + eager idempotent sweep (mirror `seed_operators_from_env`)
**What:** In `lifespan()`, after the asyncpg pool is ensured:
1. **Validate** — `get_cipher()`. If it raises `ValueError` (malformed key) → RE-RAISE (fail-hard, D-150-04). If it returns `None` → log the loud D-150-01 warning naming `SECRETS_ENCRYPTION_KEY`. This is NOT wrapped in the best-effort try/except the other hooks use — a malformed key MUST crash all workers (mirrors the Phase 110 `assert_action_types_synced` hard-fail and the 075.4 `UnknownProviderError`).
2. **Sweep** (only when a key is present) — read the `id='global'` row; for each secret column that exists in the row: plaintext (no `enc:v1:`) → encrypt; `enc:v1:` not under the primary key → `rotate()` to primary (D-150-06); already primary → skip. One `UPDATE` with the changed columns. Wrap the sweep (not the validation) in try/except → log + continue (D-150-03), retry next boot.
**Rotation detection (idempotent, no rewrite-every-boot):** to decide "under primary key?", try `Fernet(primary_key).decrypt(token)`; success → already primary, skip; `InvalidToken` → `MultiFernet.rotate(token)` migrates it to primary. Do NOT blindly `rotate()` every value every boot — `rotate()` always produces a fresh timestamp/ciphertext, causing a needless write every boot. (Once all values are under the primary key the sweep becomes a pure no-op.)
**WORKER_COUNT=2 safety:** both workers may sweep the same single row concurrently. Encrypting the same plaintext twice → two valid ciphertexts, last-writer-wins, both decrypt to the same plaintext — harmless. Already-`enc:v1:` values are skipped by the prefix check. No lock/leader-election needed (identical to the `seed_operators_from_env` ON-CONFLICT precedent).
**Placement/order:** the sweep must run AFTER `_migrate_settings_override()` (currently `main.py:250`) so it encrypts whatever the legacy migration wrote in the same boot. Put it alongside the operator seed block (`main.py:263-268`).

### Pattern 5: Legacy `_migrate_settings_override()` — comment + rely on the sweep (RECOMMENDED)
**What:** Leave `_migrate_settings_override()` writing plaintext; add a comment that the D-150-03 sweep (running later in the same `lifespan`) encrypts anything it wrote.
**Why:** The path is one-shot and mostly dead (renames the file `.migrated` after the first run). Routing it through `save_app_settings` (to inherit encryption) is a larger refactor for a near-dead path. The sweep is the idempotent backstop by design and runs in the same boot. Note: the legacy path's own `UPDATE` targets `_API_KEY_COLUMNS` including provider-key columns that DON'T EXIST — a provider key in `settings_override.json` would already `UndefinedColumn`-fail that migration atomically (pre-existing behavior; not introduced here).

### Anti-Patterns to Avoid
- **Two cipher instances / reading the env var in multiple places** — one module, one `get_cipher()`.
- **Passing `ttl=` to `decrypt`** — makes aging secrets undecryptable.
- **Blind `try decrypt / except → plaintext`** — corrupts the fail-soft signal; use the `enc:v1:` prefix.
- **Encrypting in `update_settings` instead of `save_app_settings`** — `save_app_settings` is the ONE write seam (also called elsewhere); encrypting upstream leaks ciphertext handling into callers.
- **Logging the plaintext or the ciphertext value** — names + counts only (T-081.1-04).
- **Failing closed on decrypt error** — D-150-05: a decrypt blip must never wedge the platform.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticated symmetric encryption | AES + your own IV/MAC/padding | `cryptography.fernet.Fernet` | Encrypt-then-MAC, IV, timestamp, base64 all handled; nonce-reuse & padding-oracle foot-guns avoided. |
| Multi-key rotation container | key-id tags + decrypt loop | `cryptography.fernet.MultiFernet` + `.rotate()` | Exactly the D-150-06 model in library code (VERIFIED). |
| Key generation | custom RNG / base64 juggling | `Fernet.generate_key()` | Correct 32-byte url-safe base64 key; documented operator step. |
| Malformed-key detection | manual base64/length checks | catch `ValueError` from `Fernet(key)` | Library raises the precise error at construction — the fail-hard signal. |
| Wrong-key/tamper detection | compare hashes | catch `InvalidToken` from `decrypt` | Authenticated; the fail-soft signal. |
| Env-fallback precedence | new resolution logic | the existing `_val(row, key, env_attr, default)` chain | Dropping an undecryptable column to `None` reuses the DB>env>default chain verbatim (SC#3). |

**Key insight:** Fernet/MultiFernet turns this phase from "implement a crypto scheme" into "wire two seams and a boot hook around a library that already solved encryption, rotation, and key validation." The risk in this domain is in what you hand-roll (nonces, MACs, key handling); Fernet removes all of it.

## Runtime State Inventory

This phase migrates stored data (encrypts existing plaintext secrets in place) and introduces a new env var, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `app_settings.embedding_api_key` and `app_settings.rerank_api_key` are the **only** secret columns that exist (verified live). Both are **currently NULL/empty in local dev**. In cloud/prod they may hold **plaintext** keys. The 9 `{provider}_api_key` columns + `tavily_api_key` **do not exist** → nothing stored to migrate for them (they are env-only). | **Data migration:** the D-150-03 startup sweep encrypts any plaintext in the existing columns in place (one-row rewrite). **Code edit:** encrypt-on-write for future saves. Applies per-environment (cloud sweep runs when the cloud key is set). |
| **Live service config** | Cloud Coolify backend env: the new `SECRETS_ENCRYPTION_KEY` must be set there or cloud runs plaintext (D-150-01 fail-open). Phase 149 mig 099 is **still pending on cloud** (independent parity debt, do not couple). | **Manual (operator):** set `SECRETS_ENCRYPTION_KEY` in Coolify at promotion; document in the deploy parity checklist. No new migration needed for the encryption itself. |
| **OS-registered state** | None — no Task Scheduler / pm2 / systemd names reference secrets. | None — verified (this is a code + env-var + DB-value phase only). |
| **Secrets / env vars** | NEW `SECRETS_ENCRYPTION_KEY` (comma-separated MultiFernet key list; FIRST encrypts). Master key lives in env ONLY (CLAUDE.md). Existing provider key env vars (`OPENAI_API_KEY`, `EMBEDDING_API_KEY`, `RERANK_API_KEY`, `TAVILY_API_KEY`, …) are **unchanged** — env-fallback precedence preserved (SC#3). Document the new var in `backend/.env.example` (near the top secrets block) with `Fernet.generate_key()` instructions. | **Code + docs:** add `secrets_encryption_key` to `config.Settings`; add to `.env.example` with key-gen guidance; add to the deploy parity checklist. |
| **Build artifacts / installed packages** | `cryptography` becomes a **declared** direct dep (was transitive; venv already has 46.0.7). The Docker sandbox image is unaffected (crypto runs in the API process, not the sandbox). | **Build:** add `cryptography>=44.0.0` to `requirements.txt`; a fresh Coolify build `pip install`s it (wheels available — no build toolchain needed). No sandbox image rebuild. |

**Rotation note:** rotating a key is `edit SECRETS_ENCRYPTION_KEY (prepend new) → reboot (sweep re-encrypts under primary) → remove old key` — no data-migration tooling, no endpoint (D-150-06).

## Common Pitfalls

### Pitfall 1: Classifying encrypted-vs-plaintext by catching `InvalidToken`
**What goes wrong:** Both a genuine wrong-key ciphertext AND a plaintext value raise `InvalidToken` on a blind `decrypt` (VERIFIED). A "try decrypt / except → treat as plaintext" classifier silently swallows an undecryptable ciphertext as plaintext, corrupting the D-150-04 fail-soft signal and potentially re-encrypting garbage.
**Why it happens:** Fernet's `decrypt` rejects any non-token input the same way it rejects a wrong-key token.
**How to avoid:** Use the explicit `enc:v1:` prefix for classification; only attempt `decrypt` on prefixed values, and on `InvalidToken` drop the column to env fallback (never assume plaintext).
**Warning signs:** a "smart" helper that decrypts everything and falls back to the raw value on exception.

### Pitfall 2: Encrypting into columns that don't exist (the load-bearing DB divergence)
**What goes wrong:** `_API_KEY_COLUMNS` lists 12 columns; only 2 exist. A save that includes a provider key builds `clean = {"openai_api_key": <enc>, "embedding_api_key": <enc>}` → the single `UPDATE` fails atomically with `UndefinedColumn` → BOTH keys are lost. Today this is masked (silent 200); after the D-150-07 fix it becomes a 500 that also loses the embedding save.
**Why it happens:** The provider-key columns were designed in code but never migrated (verified against live Postgres).
**How to avoid:** Resolve Open Question Q1 first. If NOT adding columns, `save_app_settings`/`update_settings` must only ever write columns that exist (guard against nonexistent secret columns) so a provider-key entry can't sink an otherwise-valid save. If adding columns, ship the migration in this phase.
**Warning signs:** an integration test that saves `openai_api_key` and asserts 200 without reading the row back.

### Pitfall 3: Sweep re-writes every value every boot (rotation done wrong)
**What goes wrong:** Calling `MultiFernet.rotate()` on every stored value each boot produces a fresh ciphertext each time (new timestamp), causing an unnecessary `UPDATE` on every startup and defeating "idempotent."
**Why it happens:** `rotate()` always re-encrypts, even when already under the primary key.
**How to avoid:** Only rotate values NOT already decryptable by the primary key alone (`Fernet(primary).decrypt` succeeds → skip). Once converged, the sweep is a no-op.
**Warning signs:** `updated_at` on `app_settings` bumping on every boot with no functional change.

### Pitfall 4: Setting a `ttl` on `decrypt`
**What goes wrong:** Fernet `decrypt(token, ttl=…)` rejects tokens older than `ttl` seconds → stored secrets become undecryptable over time, cascading to env fallback and looking like "keys vanished."
**Why it happens:** Fernet tokens embed a timestamp; the `ttl` param is meant for short-lived tokens, not at-rest storage.
**How to avoid:** Always `decrypt(token)` with no `ttl`.
**Warning signs:** secrets that "work for a while then fall back to env."

### Pitfall 5: Master key in `app_settings` or auto-generated
**What goes wrong:** Storing the key in the DB (circular — you can't decrypt without it) or auto-generating on boot (Coolify FS is ephemeral → a redeploy loses the key → every stored secret bricks — explicitly rejected in D-150-01).
**How to avoid:** Key in `SECRETS_ENCRYPTION_KEY` env var only; documented operator-set step.

### Pitfall 6: Best-effort-wrapping the key validation
**What goes wrong:** Wrapping `get_cipher()` at boot in the same `try/except: log + continue` the other lifespan hooks use would let a MALFORMED key silently run plaintext — betraying explicit operator intent (D-150-04 says fail-hard).
**How to avoid:** Validation RE-RAISES (crash all workers); only the SWEEP is best-effort.
**Warning signs:** a typo'd key boots the app in plaintext mode with only a warning.

### Pitfall 7: Cross-worker cache skew misread as an encryption bug
**What goes wrong:** The 30s per-worker settings cache means a just-set key/sweep result can be ≤30s stale on the other worker — expected and honest (Phase 147 Pitfall 5), not an encryption failure.
**How to avoid:** Don't add Redis cross-worker cache-bust; the existing `invalidate_settings_cache()` on write is sufficient. Test with a single worker or account for the TTL.

## Code Examples

### Operator key generation (documented step for `.env.example` / OPERATOR runbook)
```bash
# Source: cryptography.io/en/latest/fernet/ — Fernet.generate_key()
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# → e.g. X9ThCRt6NC0O...==   (44-char url-safe base64)
# Set in backend/.env (and Coolify for cloud):
#   SECRETS_ENCRYPTION_KEY=<that value>
# Rotation: SECRETS_ENCRYPTION_KEY=<NEW_KEY>,<OLD_KEY>   (new first) → reboot → later drop <OLD_KEY>
```

### Round-trip verification for D-150-07 (surface a failed save)
```python
# in update_settings (settings.py), replacing the fire-and-forget `await save_app_settings(updates)`:
ok = await save_app_settings(updates)
if not ok:
    raise HTTPException(status_code=500, detail="Failed to save settings")   # Phase 147 CR-02 precedent
```
"Round-trip verified" (SC#2) is satisfied structurally: `save_app_settings` encrypts then writes; a subsequent read decrypts via the one read seam. A stricter in-line proof (decrypt-back-before-returning-success) can be added in the cipher module's unit tests rather than on the hot path.

### Config env var
```python
# backend/app/config.py — inside class Settings(BaseSettings)
# Phase 150 (SEC-01) — comma-separated MultiFernet key list; FIRST encrypts, rest decrypt-only.
# Secret/infra → env only (CLAUDE.md). Empty => D-150-01 fail-open plaintext + loud boot warning.
secrets_encryption_key: str = ""
```

### Control Plane signal (D-150-02, additive to /admin/backpressure)
```python
# secret_cipher.encryption_status() returns e.g.
#   {"state": "encrypted"}                              # key present, sweep clean
#   {"state": "plaintext"}                              # no key (D-150-01)
#   {"state": "error", "columns_unreadable": 2}         # key present, N columns InvalidToken (D-150-04)
# admin.py get_backpressure() adds:  "secrets_encryption": encryption_status()
# HealthSignals.tsx renders it as a tile alongside redis/supabase/sandbox, with the ⌥ Technical name.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgsodium (Postgres-side column encryption) | App-layer `cryptography` Fernet | Supabase deprecation cycle (ongoing) | Locked in REQUIREMENTS.md; portable across any Postgres/env, no extension dependency. |
| Plaintext secrets in `app_settings` / env | Env-held master key + at-rest ciphertext with env fallback | This phase | SC#1-4; env-only deployments unchanged (D-150-01). |
| Ignoring `save_app_settings` return bool (silent 200) | Surface the bool as a real HTTP error | Phase 147 CR-02 → this phase (D-150-07) | Failed saves become visible. |

**Deprecated/outdated:**
- pgsodium — do not use (Supabase deprecating).
- Any suggestion that the "12 secret columns" all exist — 10 of 12 do not (see Open Questions Q1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Env var name `SECRETS_ENCRYPTION_KEY` (Claude's-Discretion recommendation, not operator-locked). | User Constraints / Config | Low — a rename is a one-line change; confirm with operator. |
| A2 | `enc:v1:` explicit envelope chosen over the raw `gAAAAA` prefix. | Pattern 2 | Low — both work; `enc:v1:` is strictly more robust/versionable. Reversible. |
| A3 | Version floor `cryptography>=44.0.0`. Installed 46.0.7 verified; Fernet API stable back to ~1.0. | Standard Stack | Low — API is decades-stable; floor only affects OpenSSL/CVE posture. |
| A4 | Cloud `app_settings.embedding_api_key`/`rerank_api_key` MAY hold plaintext (local dev has them NULL). | Runtime State Inventory | Medium — if cloud holds plaintext, the sweep encrypts it on the first keyed boot; verify at deploy. Not verifiable from local. |
| A5 | The Docker sandbox image needs no rebuild (crypto runs in the API process). | Runtime State Inventory | Low — crypto is not a sandbox package; API `pip install` covers it. |

## Open Questions

1. **[LOAD-BEARING] Only 2 of the nominal 12 secret columns exist — resolve the scope fork before planning.**
   - **What we know (VERIFIED against live Postgres):** `app_settings` has 61 columns; the ONLY secret columns are `embedding_api_key` and `rerank_api_key` (both `text`, both currently NULL in dev). The 9 `{provider}_api_key` columns + `tavily_api_key` do NOT exist and no migration ever added them. `llm_providers` jsonb = `[]`. A test `UPDATE app_settings SET openai_api_key=…` → `UndefinedColumn`. So provider LLM keys are env-only, and saving one through Settings already fails silently (the D-150-07 bug's root cause is the missing column, not just the ignored bool).
   - **What's unclear:** Whether SEC-01/SC#1 ("a provider API key saved through Settings is stored encrypted at rest") must be satisfiable for the 9 LLM provider keys, or whether encrypting the 2 real secret columns (embedding/rerank) demonstrably satisfies it. The CONTEXT.md assumed all 12 columns exist ("likely no migration").
   - **Recommendation:** Escalate to the operator (ideally a brief discuss-phase confirmation). Two coherent options:
     - **Option A — Root-cause (RECOMMENDED):** Add the 10 missing columns via one numbered migration. Provider keys become DB-persistable + encrypted; SC#1 is literally true for LLM providers; the silent-save is fixed at the root. Costs: a migration + cloud parity (paste into cloud SQL editor; carry alongside pending mig 099) + a precedence behavior change (DB-over-env now actually engages for provider keys — verify `_build_providers` consumers are fine, which they are since they already read `_val(row, key, env)`). Matches the project's root-cause-over-band-aid ethos.
     - **Option B — Minimal:** Encrypt only the existing columns (embedding/rerank). SC#1 demonstrated via `embedding_api_key`. Provider keys stay env-only. Then `update_settings`/`save_app_settings` MUST guard so a provider-key entry (writing a nonexistent column) can't 500 the whole save after the D-150-07 fix (Pitfall 2). No migration.
   - The encryption machinery (cipher module, seams, sweep, Control Plane, fail-polarity, D-150-07) is **identical** either way — build it to operate over `_API_KEY_COLUMNS ∩ existing-columns`. Only the migration + the provider-key story differ.

2. **In-line round-trip proof vs. structural guarantee for SC#2.**
   - **What we know:** encrypt-then-write + one-seam-decrypt-on-read structurally guarantees round-trip.
   - **Recommendation:** Enforce the strict "decrypt-back-equals-input" assertion in unit tests (Validation Architecture) rather than on the request hot path; surface only the `save_app_settings` bool as the HTTP-level round-trip failure signal (D-150-07). Confirm with the planner this satisfies "round-trip verified."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `cryptography` (Python) | Fernet/MultiFernet encryption | ✓ | 46.0.7 (venv) | — (add explicit pin to requirements.txt) |
| OpenSSL (via cryptography wheels) | crypto primitives | ✓ | bundled in the cryptography wheel | — |
| Local Postgres :54322 | sweep + SC#1 ciphertext-at-rest test | ✓ | Supabase CLI local | — |
| `SECRETS_ENCRYPTION_KEY` env var | encryption activation | ✗ (not yet set) | — | D-150-01 fail-open plaintext + warning (this IS the designed fallback) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `SECRETS_ENCRYPTION_KEY` unset → intentional plaintext mode (D-150-01). Set it (per env) to activate encryption.

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest` 8.x + `pytest-asyncio` 0.24 (verified in `requirements.txt`) |
| Config file | `backend/tests/conftest.py` + `backend/tests/integration/conftest.py` |
| Unit run command | `cd backend && venv/Scripts/python.exe -m pytest tests/test_150_*.py -x` |
| Integration run command | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_150_*.py -x` (live-PG guarded, DSN `postgresql://postgres:postgres@127.0.0.1:54322/postgres`) |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest -q` |

Integration tests follow the established live-PG guard pattern (`PG_AVAILABLE = _check_pg_available_sync()` + `pytest.mark.skipif`) seen in `test_081_1_settings_migration.py` / `test_111_settings_readback.py`. Pure unit tests mock the asyncpg pool with `AsyncMock`/`MagicMock` and monkeypatch `SECRETS_ENCRYPTION_KEY`.

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| Cipher core | encrypt→decrypt round-trip; `enc:v1:` detection; `is_encrypted` | unit | `pytest tests/test_150_cipher.py::test_roundtrip -x` | ❌ Wave 0 |
| D-150-04 | malformed key → `ValueError` from `get_cipher()` | unit | `pytest tests/test_150_cipher.py::test_malformed_key_raises -x` | ❌ Wave 0 |
| D-150-06 | MultiFernet: old key decrypts; `rotate()` migrates to primary; only-primary can decrypt rotated | unit | `pytest tests/test_150_cipher.py::test_rotation -x` | ❌ Wave 0 |
| D-150-01 | no key → `encrypt_secret`/save passthrough plaintext + status `plaintext` | unit | `pytest tests/test_150_cipher.py::test_no_key_passthrough -x` | ❌ Wave 0 |
| SC#1 write | `save_app_settings` writes `enc:v1:…` for secret columns (mock pool asserts the param) | unit | `pytest tests/test_150_save_seam.py::test_encrypts_on_write -x` | ❌ Wave 0 |
| SC#1 read | `_build_settings_from_row` with an `enc:v1:` column surfaces plaintext | unit | `pytest tests/test_150_read_seam.py::test_decrypts_on_read -x` | ❌ Wave 0 |
| D-150-04/05 | undecryptable `enc:v1:` column → dropped → env fallback; platform up | unit | `pytest tests/test_150_read_seam.py::test_failsoft_to_env -x` | ❌ Wave 0 |
| SC#3 | no key + no DB secret → keys resolve from env; DB(enc) > env precedence preserved | unit | `pytest tests/test_150_read_seam.py::test_env_precedence -x` | ❌ Wave 0 |
| D-150-07 | `update_settings` → HTTP 500 when `save_app_settings` returns False | unit (API) | `pytest tests/api/test_150_settings_error.py -x` | ❌ Wave 0 |
| D-150-03 | sweep encrypts plaintext in existing columns; second run is a no-op (idempotent) | integration | `pytest tests/integration/test_150_sweep.py -x` | ❌ Wave 0 |
| **SC#1 proof** | after an encrypted save, a raw psycopg2/SQL read of `app_settings` shows `enc:v1:…`, NOT plaintext | integration | `pytest tests/integration/test_150_ciphertext_at_rest.py -x` | ❌ Wave 0 |
| SC#4 | boot with no `SECRETS_ENCRYPTION_KEY` → plaintext + warning; settings load unchanged | integration/manual | `pytest tests/integration/test_150_failopen.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_150_*.py -x` (fast unit seams).
- **Per wave merge:** `pytest tests/test_150_*.py tests/integration/test_150_*.py -q` (adds live-PG sweep + ciphertext-at-rest proof).
- **Phase gate:** full backend suite green before `/gsd:verify-work`; the SC#1 ciphertext-at-rest integration test is the acceptance anchor.

### Wave 0 Gaps
- [ ] `tests/test_150_cipher.py` — cipher module unit tests (round-trip, malformed key, rotation, no-key passthrough).
- [ ] `tests/test_150_save_seam.py` — encrypt-on-write in `save_app_settings` (mock pool).
- [ ] `tests/test_150_read_seam.py` — decrypt-on-read + fail-soft + env precedence.
- [ ] `tests/api/test_150_settings_error.py` — D-150-07 HTTP 500 surfacing.
- [ ] `tests/integration/test_150_sweep.py` — startup sweep idempotence (live PG, guarded).
- [ ] `tests/integration/test_150_ciphertext_at_rest.py` — **SC#1 proof** (raw read shows `enc:v1:`), reuse the `_pg_reachable` harness from `test_081_1_settings_migration.py`.
- [ ] Framework install: none — `pytest`/`pytest-asyncio` already present.

**Manual UAT note:** SC#4 (existing-deployment no-re-entry) is best confirmed by an operator: boot without the key (plaintext + warning), boot with the key (sweep encrypts, keys still work, Control Plane shows `encrypted ✓`). The 4-axis cross-provider scoreboard does NOT apply — this phase touches neither streaming, agent loop, provider routing, nor UI state (backend secret storage + one static health field).

## Security Domain

`security_enforcement` is not disabled in config → included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Operator-gating (require_operator) already enforced upstream at the router (Phase 146); unchanged here. |
| V3 Session Management | no | — |
| V4 Access Control | yes (inherited) | The Settings write + `/admin/backpressure` are already operator/auth-gated; this phase adds no new endpoint. |
| V5 Input Validation | yes | Existing `_is_valid_api_key`/sentinel guard validates plaintext BEFORE encryption; the `enc:v1:` prefix is a controlled internal format. |
| **V6 Cryptography (V6.2 secret storage / V6.4 key management)** | **yes (core)** | Fernet/MultiFernet (never hand-rolled); AES-128-CBC + HMAC-SHA256 authenticated; master key in env only, comma-separated rotation. |
| V7 Error Handling & Logging | yes | Never log secret values or ciphertext (T-081.1-04); logs = column names + counts; audit already redacts `_key`/`_secret`. |

### Known Threat Patterns for this stack (env-held-key at-rest column encryption)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext secrets readable via a DB dump / SQL editor / stolen backup | Information Disclosure | Encrypt at rest (SC#1); ciphertext `enc:v1:…` is useless without the env key. |
| Master key committed to git / in the DB / logged | Information Disclosure | Key in env only (CLAUDE.md); `.env` gitignored; never logged; `.env.example` holds a placeholder, not a real key. |
| Malformed key silently runs plaintext (betrays operator intent) | Tampering / Repudiation | Fail-hard at boot on `ValueError` (D-150-04) — refuse to start. |
| Wrong/rotated key bricks the platform | Denial of Service | Fail-soft per column to env (D-150-04/05); platform stays up; honest Control Plane signal. |
| Tampered ciphertext in the DB | Tampering | Fernet is authenticated (HMAC) → `InvalidToken` on tamper → fail-soft, not silent acceptance. |
| Nonce reuse / padding oracle (if hand-rolled) | Information Disclosure | Avoided entirely — Fernet handles IV/MAC/padding. |
| Key rotation leaving old ciphertext unreadable | Denial of Service | MultiFernet decrypts under any listed key; sweep re-encrypts under primary before the old key is dropped (D-150-06). |
| Token expiry (`ttl`) making aging secrets undecryptable | Denial of Service | Never pass `ttl` to `decrypt` (Pitfall 4). |

## Sources

### Primary (HIGH confidence)
- **Empirical probe against the installed `cryptography` 46.0.7** (`backend/venv`) — `Fernet.generate_key()` format, `gAAAAA` token prefix, `ValueError` on malformed key at construction, `InvalidToken` on wrong-key/plaintext decrypt, `MultiFernet` rotation semantics. [VERIFIED]
- **Live Postgres introspection** (`information_schema.columns`, `app_settings` row, rolled-back `UPDATE` probes) — the 2-of-12 secret-column reality, `llm_providers=[]`, empty embedding/rerank keys, `UndefinedColumn` on provider-key UPDATE. [VERIFIED]
- **Source reads:** `backend/app/models/user_settings.py` (seams, cache, `_val` fallback, `save_app_settings` bool), `backend/app/api/settings.py:453` (D-150-07 site), `backend/app/main.py` (`_API_KEY_COLUMNS`, `_migrate_settings_override`, `lifespan`, `seed_operators_from_env` precedent), `backend/app/services/health_probe.py` + `backend/app/api/admin.py:135-199` (backpressure `dependencies` block), `frontend/src/components/admin/HealthSignals.tsx` (tile shape), `backend/app/config.py:742+` (Settings pattern). [VERIFIED]
- **cryptography.io/en/latest/fernet/** — Fernet + MultiFernet API, `generate_key`, `encrypt`/`decrypt`, `rotate`, `InvalidToken`, `ttl`. [CITED]
- `slopcheck install cryptography` → `1 OK` (pypi); `pip index versions cryptography` → latest 49.0.0 / installed 46.0.7. [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` (SEC-01, pgsodium out-of-scope, Vault future), `.planning/phases/150-secrets-at-rest/150-CONTEXT.md` (D-150-01..07), `CLAUDE.md` (env-secrets rule, migrations, WORKER_COUNT=2).

### Tertiary (LOW confidence)
- None — all crypto claims were empirically verified against the installed library.

## Metadata

**Confidence breakdown:**
- Standard stack (Fernet/MultiFernet + version): HIGH — empirically verified against the installed library and PyPI.
- Architecture (seams, envelope, sweep, key mgmt): HIGH — verified against live source; seams are exact functions with line references.
- DB reality / column-existence fork: HIGH — verified against the running Postgres (this overrides the CONTEXT.md assumption).
- Pitfalls: HIGH — each is derived from verified library behavior or verified code paths.
- Scope resolution (Q1 Option A vs B): MEDIUM — the technical facts are HIGH; which option to take is an operator decision.

**Research date:** 2026-07-13
**Valid until:** 2026-08-12 (30 days — `cryptography` Fernet API is decades-stable; the only volatile input is the operator's Q1 scope decision).
