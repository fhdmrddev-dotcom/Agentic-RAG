---
phase: 150-secrets-at-rest
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - backend/app/security/secret_cipher.py
  - backend/app/models/user_settings.py
  - backend/app/main.py
  - backend/app/api/settings.py
  - backend/app/api/admin.py
  - backend/app/config.py
  - frontend/src/lib/api.ts
  - frontend/src/components/admin/HealthSignals.tsx
  - supabase/migrations/100_secret_key_columns.sql
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 150: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 150 adds at-rest secret encryption (Fernet/MultiFernet, `enc:v1:` envelope) with an
encrypt-on-write / decrypt-on-read seam through the shared `app_settings` substrate, a
boot-time key gate + eager sweep, a `secrets_encryption` health field, and migration 100
that finally materialises the 10 missing secret columns.

The crypto core itself is sound: key material and plaintext values are never logged
(names + counts only), the cache holds ciphertext (decrypt operates on a copy), the
envelope-prefix classification avoids the blind-decrypt pitfall, the boot key gate is
correctly un-wrapped (malformed key ⇒ refuse start) while the sweep is best-effort, and the
`encryption_status` field is fed the raw ciphertext row and can never 500 the health
endpoint. The test suite is thorough for the happy paths and the documented fail-soft
polarity.

However, adversarial tracing surfaced one Critical issue and two Warnings that the phase's
own comments actively mis-describe as safe:

1. **CR-01 (Critical):** the encrypt-on-write comment claims a "SQLi-safe allowlist
   posture", but only the *encryption loop* is allowlisted — the actual SQL `SET` clause is
   still built from un-allowlisted, client-controlled column names (`f"{p.id}_api_key"`).
   This is a real column-name SQL-injection vector (operator-gated + prepared-statement
   constrained, but genuine).
2. **WR-01:** the sweep aborts entirely — and can never converge — when any secret column
   holds an `enc:v1:` value no configured key can decrypt, silently leaving *other* plaintext
   columns un-encrypted at rest every boot.
3. **WR-02:** the "honest" secrets health tile shows false-green **Encrypted** during a
   cold-cache DB outage, because `_load_settings_from_db()` swallows DB errors (returns `{}`)
   instead of raising, and `encryption_status({})` reports `encrypted`.

## Critical Issues

### CR-01: Client-controlled provider `id` becomes a raw SQL column name (SQL injection)

**File:** `backend/app/api/settings.py:328-329`, `backend/app/models/user_settings.py:283-327`
**Issue:**
`update_settings` builds the update key directly from the client-supplied provider id with
no validation:

```python
for p in body.providers:
    updates[f"{p.id}_api_key"] = p.api_key   # p.id is unvalidated client input
```

`save_app_settings` then filters values (sentinel / `_is_valid_api_key`) but performs **no
allowlist check on the key `k`** before interpolating it into the SQL `SET` clause:

```python
clean[k] = v                                   # user_settings.py:296 — no column allowlist
...
set_clause = ", ".join(f"{col} = ${i+1}" for i, col in enumerate(cols))   # :327
```

A crafted `p.id` (e.g. `"llm_model = 'x', a"`) produces the column name
`"llm_model = 'x', a_api_key"`, which ends with `_api_key` and therefore passes
`_is_valid_api_key` (it returns `True` by fall-through for any non-sentinel value on an
unknown `_api_key` field). The malicious string is then spliced verbatim into the `SET`
clause — a column-name injection allowing an authenticated caller to overwrite arbitrary
`app_settings` columns or inject subquery expressions.

The Phase-150 comment at `user_settings.py:308-309` ("the SQLi-safe allowlist posture — we
iterate code-owned column names, never user key names") describes **only the encryption
loop**, which iterates `SECRET_COLUMNS`. The SQL build that actually reaches Postgres still
uses `clean.keys()`, which can contain client-controlled names. This is exactly the CR-01
class the one-shot migration path (`main._migrate_settings_override`) *does* guard against
(`key in _API_KEY_COLUMNS` / `key in _DIRECT_COLUMNS`) — the runtime save seam was never
given the same guard.

Mitigating factors (still ship-blocking, but for honest prioritisation): the `PUT /settings`
endpoint is behind `require_visible("model_management")` (operators only by default), and
asyncpg's parameterised `execute()` uses the extended-query protocol, so multi-statement
`; DROP TABLE` is not possible — the exploit is constrained to single-statement `SET`-clause
manipulation by a privileged operator. It is nonetheless a textbook injection on a
security-critical seam whose comments assert safety it does not deliver.

**Fix:** Validate the provider id at the API boundary AND allowlist the column names before
the SQL build (defense-in-depth):

```python
# settings.py — reject unknown provider ids before they become column names
from app.models.user_settings import KNOWN_PROVIDERS
for p in body.providers:
    if p.id not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=422, detail=f"Unknown provider: {p.id}")
    updates[f"{p.id}_api_key"] = p.api_key
```

```python
# user_settings.py save_app_settings — allowlist keys before building SQL (mirror CR-01)
_WRITABLE_COLUMNS = _DIRECT_COLUMNS | SECRET_COLUMNS | {"provider_model_lists", "feature_visibility", ...}
for k, v in updates.items():
    ...
    if k not in _WRITABLE_COLUMNS:
        logger.warning("save_app_settings: rejected unknown column %s", k)
        continue
    clean[k] = v
```

## Warnings

### WR-01: `sweep_row` aborts the whole sweep on an undecryptable column — plaintext can never self-heal

**File:** `backend/app/security/secret_cipher.py:127-133`
**Issue:**
Inside the sweep loop, the rotate call is placed in the `except InvalidToken` block with no
protection of its own:

```python
token = value[len(_ENVELOPE_PREFIX):].encode()
try:
    primary.decrypt(token)            # already under primary key?
except InvalidToken:
    rotated = cipher.rotate(token).decode()   # <-- ALSO raises InvalidToken if no key decrypts
    changed[col] = f"{_ENVELOPE_PREFIX}{rotated}"
```

If a secret column holds an `enc:v1:` token that **no** configured key can decrypt (a
key fully removed from the env, or corrupt/tampered ciphertext), `primary.decrypt` raises
`InvalidToken` → the `except` runs `cipher.rotate(token)` → `MultiFernet.rotate` also raises
`InvalidToken` → the exception propagates out of `sweep_row`. Because `changed` is discarded
on the raised exception, **every other plaintext column already queued for encryption in the
same pass is dropped and never written**. The boot caller (`main._sweep_secret_columns`) is
best-effort so the app still starts, but the failure recurs identically on every boot, so
lingering plaintext at rest can never be auto-encrypted while the bad token sits in the row.

Note `encryption_status` handles the same input gracefully (per-column, no abort), so the
health tile will correctly show `error` + `columns_plaintext` + `columns_unreadable` — but
the self-healing guarantee the sweep is supposed to provide is silently defeated.

**Fix:** Guard the rotate and skip un-rotatable columns so the sweep converges the rest:

```python
except InvalidToken:
    try:
        rotated = cipher.rotate(token).decode()
        changed[col] = f"{_ENVELOPE_PREFIX}{rotated}"
    except InvalidToken:
        logger.error(
            "secret_cipher: column %s is not decryptable by any configured key; "
            "cannot rotate — skipping (surfaced via encryption_status)", col,
        )
        continue
```

### WR-02: secrets health tile reports false-green "Encrypted" during a cold-cache DB outage

**File:** `backend/app/security/secret_cipher.py:156-158,195`, `backend/app/api/admin.py:199-208`
**Issue:**
`encryption_status` returns `{"state": "encrypted"}` whenever no *present, non-empty* secret
columns are found — including for an empty row `{}`:

```python
cipher = get_cipher()
if cipher is None:
    return {"state": "plaintext"}
...  # loop finds nothing present
return {"state": "encrypted"}
```

`admin.get_backpressure` intends this to degrade safely — its comment says "a failed raw-row
load ... can NEVER raise out of the health endpoint — it degrades to the plaintext state."
But `_load_settings_from_db()` (user_settings.py:242-257) **swallows** DB errors and returns
`{}` (or a stale cache) rather than raising, so the `except` in admin.py is effectively dead
for DB faults. On a genuinely cold cache during a DB outage, the raw row is `{}` and the tile
renders green **Encrypted** while, in reality, nothing could be read at all. This directly
undercuts the phase's stated "honest status" contract (the tile is meant to be the operator's
trustworthy at-rest signal).

**Fix:** Distinguish "no data / could not read" from "encrypted". Either have
`encryption_status` return a neutral state when the row is empty, or have `get_backpressure`
detect an empty/failed raw load and emit `{"state": "unknown"}` (the frontend already renders
`unknown` as a neutral placeholder). For example:

```python
raw_settings_row = await _load_settings_from_db()
if not raw_settings_row:                       # cold cache / DB blip returned {}
    secrets_encryption = {"state": "unknown"}
else:
    secrets_encryption = encryption_status(raw_settings_row)
```

## Info

### IN-01: Envelope-prefix collision on adversarial plaintext input

**File:** `backend/app/security/secret_cipher.py:79-87`, `backend/app/models/user_settings.py:321`
**Issue:**
Classification is purely prefix-based. A plaintext secret whose value literally begins with
`enc:v1:` would be treated as already-encrypted by `is_encrypted`, so the write seam skips
encryption (stores it plaintext), and the read seam then strips the prefix and fails to
decrypt the remainder → the column is dropped to `None` → env fallback, leaving the saved key
permanently unusable. No real provider issues keys with this prefix, and the failure mode is
fail-soft (not a leak), so this is low priority — but it is an unhandled adversarial edge.
**Fix:** On write, reject (or escape) a plaintext secret that already carries the reserved
`enc:v1:` prefix, or document the reserved prefix as a disallowed key value.

### IN-02: `get_cipher()` / `encrypt_secret()` run outside `save_app_settings`' DB try/except

**File:** `backend/app/models/user_settings.py:317-322` vs `330-345`
**Issue:**
The encrypt-on-write block calls `get_cipher()` and `encrypt_secret()` *before* the
`try/except` that converts DB-write failures into a clean `return False`. A raise from either
(e.g. a malformed key, or a `cipher.encrypt` failure) would propagate as an unhandled
exception rather than the intended `False → HTTP 500 "Failed to save settings"` path in
`update_settings`. In practice this is unreachable post-boot (the key is env-only and already
validated fail-hard at lifespan, and `encrypt` does not raise on valid `str` input), so there
is no live leak — but the control-flow is inconsistent with the phase's "surface the failed
save as a clean 500" intent. **Fix:** Move the cipher/encrypt block inside the guarded
`try/except`, or add a comment documenting the boot-validated-key invariant that makes it
safe.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
