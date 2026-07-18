---
phase: 150-secrets-at-rest
verified: 2026-07-13T18:45:57Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 150: Secrets at Rest Verification Report

**Phase Goal:** Provider API keys in the DB are encrypted at rest while local dev + existing deployments keep working unchanged (SEC-01).
**Verified:** 2026-07-13T18:45:57Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, the contract)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | A provider API key saved through Settings is stored encrypted at rest (app-layer `cryptography` Fernet/AESGCM), not plaintext in `app_settings` | ✓ VERIFIED | `save_app_settings` (`backend/app/models/user_settings.py:326-350`) encrypts every `SECRET_COLUMNS` value with `encrypt_secret()` before the UPDATE. Live integration test `tests/integration/test_150_ciphertext_at_rest.py` passes against local Postgres (raw SELECT shows `enc:v1:` prefix, not plaintext, decrypts back). `Fernet(` construction confirmed confined to `backend/app/security/secret_cipher.py` only (grep across `backend/app/`). |
| 2 | Saving a key is round-trip verified — a failed save surfaces an error instead of silently succeeding | ✓ VERIFIED | `update_settings` (`backend/app/api/settings.py:468-469`) now does `if not await save_app_settings(updates): raise HTTPException(500, "Failed to save settings")`, placed BEFORE the audit write (:471) and re-embed kick (source-reviewed at line order). `tests/api/test_150_settings_error.py` (3/3 green) proves 500-on-failure, no-false-audit, and 200-on-success. |
| 3 | When a key is supplied via env var, the platform still works without any DB-stored secret (env-fallback precedence preserved) | ✓ VERIFIED | `_decrypt_secret_columns` (`user_settings.py:619`) drops undecryptable columns to `None`, re-using the EXISTING `_val` DB>env chain with zero new fallback code. `tests/test_150_read_seam.py` (5/5 green) proves `test_env_precedence_no_key`, `test_db_over_env`, and `test_failsoft_to_env` (no raise on a wrong-key ciphertext). |
| 4 | Existing deployments and local dev continue to function with no manual key re-entry required | ✓ VERIFIED | D-150-01 fail-open: `get_cipher()` returns `None` with no env var set → plaintext passthrough, no behavior change. `_validate_and_report_cipher()` in `main.py:229-248` logs a warning but never blocks boot when the key is absent. `tests/integration/test_150_failopen.py` proves the no-key boot path is unchanged. Live DB check: all 12 secret columns exist and are currently unset (no re-entry forced). |

### Plan-Level Must-Haves (from PLAN frontmatter, merged/deduped against the above)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `get_cipher()` returns MultiFernet when keyed, None when unset (D-150-01); malformed key raises ValueError (D-150-04) | ✓ VERIFIED | `secret_cipher.py:67-76`; `tests/test_150_cipher.py` (10/10 green) covers both polarities. |
| 6 | `sweep_row()` is idempotent and rotates old-key tokens to the primary (D-150-03/06); does NOT abort the whole pass on one undecryptable column (WR-01 fix) | ✓ VERIFIED | `secret_cipher.py:100-162` — the WR-01 fix wraps `cipher.rotate()` in its own try/except and `continue`s past a poisoned column instead of propagating. `tests/integration/test_150_sweep.py` proves convergence + idempotence. |
| 7 | `encryption_status()` reports honest `error` states for both `columns_unreadable` and `columns_plaintext` (a swallowed sweep failure), and reports `unknown` — not false-green `encrypted` — on an empty/cold-cache row (WR-02 fix) | ✓ VERIFIED | `secret_cipher.py:165-234` — `columns_seen == 0 → {"state": "unknown"}` is the WR-02 fix; confirmed present and exercised by `tests/test_150_backpressure_secrets.py`. |
| 8 | Migration 100 adds the 10 missing secret text columns, idempotently, applied live | ✓ VERIFIED | `supabase/migrations/100_secret_key_columns.sql` (10 `ADD COLUMN IF NOT EXISTS ..._api_key text` statements, no DEFAULT). Live psycopg2 check against `127.0.0.1:54322` confirms all 12 secret columns present as `text`. `full-schema.sql` regenerated (contains `openai_api_key`, `tavily_api_key`, etc.). `pending-cloud-migrations.sh` correctly lists mig 100 as pending cloud (deferred, expected). |
| 9 | SQL-injection-safe write seam: client-controlled provider ids never reach the raw SQL column-name interpolation (CR-01 fix) | ✓ VERIFIED | Two-layer defense confirmed present: `settings.py:335-336` rejects unknown `p.id` with HTTP 422 (`KNOWN_PROVIDERS` allowlist); `user_settings.py:297-310` (`_VALID_COLUMN_NAME = re.compile(r"^[a-z_][a-z0-9_]*$")`) rejects any non-identifier key before it reaches `clean`/the SQL `SET` clause. |
| 10 | Boot-time key gate: malformed key hard-fails startup (un-wrapped), missing key warns + boots plaintext; eager sweep is best-effort (try/except) | ✓ VERIFIED | `main.py:229-334` — `_validate_and_report_cipher()` called UN-wrapped at line 324; `_sweep_secret_columns` wrapped in try/except at 326-334. Source-reviewed polarity matches the plan exactly. |
| 11 | Control Plane `secrets_encryption` tile: additive, fed the RAW ciphertext row, NEUTRAL (not red) for the deliberate no-key state, honest red for genuine errors | ✓ VERIFIED | `admin.py:190-219` feeds `_load_settings_from_db()` (raw/ciphertext) into `encryption_status()`, additive key on the existing payload, best-effort degrade. `HealthSignals.tsx:135-313` — `plaintext`/`unknown` map to `bg-muted-foreground/*` (never `bg-destructive`); `error` maps to `bg-destructive` with honest counts. `frontend/src/lib/api.ts:3628` types the optional field. `npx vite build` exits 0. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/security/secret_cipher.py` | MultiFernet wrapper, single source of key material | ✓ VERIFIED | 246 lines; exports `SECRET_COLUMNS`, `get_cipher`, `is_encrypted`, `encrypt_secret`, `decrypt_secret`, `sweep_row`, `encryption_status` via `__all__`. |
| `backend/app/config.py` | `secrets_encryption_key` Settings field | ✓ VERIFIED | Field present, binds `SECRETS_ENCRYPTION_KEY`, defaults `""`. |
| `backend/tests/test_150_cipher.py` | Cipher unit tests | ✓ VERIFIED (WIRED) | 10 tests, all green. |
| `supabase/migrations/100_secret_key_columns.sql` | 10 missing secret columns, idempotent | ✓ VERIFIED | 10 `ADD COLUMN IF NOT EXISTS` statements; applied live (12/12 columns confirmed via psycopg2). |
| `supabase/full-schema.sql` | Regenerated deploy artifact | ✓ VERIFIED | Contains `openai_api_key`, `tavily_api_key`, and the other 8 provider columns. |
| `backend/app/models/user_settings.py` | Encrypt-on-write + decrypt-on-read seams | ✓ VERIFIED (WIRED) | Encrypt block at :326-350 (write seam); `_decrypt_secret_columns` at :619, called first-line of `_build_settings_from_row` at :667. |
| `backend/tests/integration/test_150_ciphertext_at_rest.py` | SC#1 raw-read proof | ✓ VERIFIED | Passes against live local Postgres. |
| `backend/app/main.py` | Boot key gate + eager sweep | ✓ VERIFIED (WIRED) | `_validate_and_report_cipher()` + `_sweep_secret_columns()`, correct un-wrapped/wrapped polarity; `_API_KEY_COLUMNS` re-pointed to `SECRET_COLUMNS`. |
| `backend/app/api/settings.py` | D-150-07 raise-on-failed-save | ✓ VERIFIED (WIRED) | `if not await save_app_settings(updates): raise HTTPException(500, ...)` before audit write. |
| `backend/app/api/admin.py` | `secrets_encryption` on `/admin/backpressure` | ✓ VERIFIED (WIRED) | Additive key computed from RAW row; existing keys byte-identical. |
| `frontend/src/lib/api.ts` | Optional `secrets_encryption` type | ✓ VERIFIED | Three-state union + optional counters, additive/back-compat. |
| `frontend/src/components/admin/HealthSignals.tsx` | Three-state tile | ✓ VERIFIED (WIRED) | Dot/label/sub mapping + `showTechnical` raw-name reveal; build passes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `secret_cipher.py` | `config.py` | lazy `from app.config import settings` inside `_load_keys()` | ✓ WIRED | Confirmed present; enables test monkeypatching. |
| `user_settings.py` (write) | `secret_cipher.py` | `from app.security.secret_cipher import ...` at the encrypt block | ✓ WIRED | Present at `user_settings.py:339-344`. |
| `user_settings.py` (read) | `_val` DB>env fallback | dropped/undecryptable column → `None` → `_val` env value | ✓ WIRED | `test_failsoft_to_env` passes; no new fallback code needed. |
| `main.py` lifespan | `secret_cipher.py` | `get_cipher()` (un-wrapped) + `sweep_row()` (best-effort) | ✓ WIRED | Correct un-wrapped/try-except polarity confirmed via source review. |
| `settings.py` `update_settings` | `save_app_settings` bool | `if not ok: raise HTTPException(500)` | ✓ WIRED | Confirmed at line 468-469, before audit write at 471. |
| `admin.py` `get_backpressure` | `secret_cipher.py` `encryption_status` | fed the RAW row from `_load_settings_from_db()` | ✓ WIRED | Confirmed NOT using the decrypting `load_app_settings`. |
| `HealthSignals.tsx` | `GET /admin/backpressure` `secrets_encryption` | `signals.secrets_encryption` tile render | ✓ WIRED | Confirmed; absent/loading renders neutral, never a crash. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `HealthSignals.tsx` secrets tile | `signals.secrets_encryption` | `GET /admin/backpressure` → `encryption_status(raw_row)` → `_load_settings_from_db()` (real asyncpg `fetchrow` on `app_settings`) | Yes — real DB row, not a static stub | ✓ FLOWING |
| `save_app_settings` write path | `clean[col]` (post-encrypt) | Live asyncpg `pool.execute(UPDATE ...)` against `127.0.0.1:54322` | Yes — confirmed via live integration test + direct psycopg2 read | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live DB has all 12 secret columns as `text` | `psycopg2` query against `information_schema.columns` | 12/12 present, 0 missing | ✓ PASS |
| No live plaintext secrets lingering under the current (no-key) config | `psycopg2` SELECT of all 12 secret columns on the `global` row | All 12 unset (NULL) — no plaintext-vs-encrypted ambiguity | ✓ PASS |
| `Fernet(` constructed only inside `secret_cipher.py` | `grep -rn "Fernet(" backend/app/` | 1 match location (`secret_cipher.py`, 2 call sites) | ✓ PASS |
| No `ttl=` on any `decrypt()` call | `grep -n "ttl=" backend/app/security/secret_cipher.py` | No matches | ✓ PASS |
| Frontend production build has no new type errors | `npx vite build` | Exit 0 (pre-existing chunk-size/dynamic-import warnings only, unrelated) | ✓ PASS |
| `scripts/pending-cloud-migrations.sh` lists mig 100 | `bash scripts/pending-cloud-migrations.sh` | Lists `100_secret_key_columns.sql` as pending (deferred, expected) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention applies to this phase (settings/DB/crypto phase, not a migration-tooling phase with dedicated probe scripts). Full pytest suite run instead (see below) as the phase's own declared automated verification.

### Test Suite Results

| Suite | Command | Result |
|-------|---------|--------|
| Phase 150 full suite (unit + integration + api) | `pytest tests/test_150_cipher.py tests/test_150_save_seam.py tests/test_150_read_seam.py tests/test_150_backpressure_secrets.py tests/api/test_150_settings_error.py tests/integration/test_150_ciphertext_at_rest.py tests/integration/test_150_sweep.py tests/integration/test_150_failopen.py -q` | **36 passed** |
| Settings-substrate regression (147/081.1/111/settings) | `pytest tests/test_147_flag_failure_semantics.py tests/integration/test_081_1_settings_migration.py tests/integration/test_111_settings_readback.py tests/unit/test_settings.py tests/unit/test_settings_cache.py -q` | **32 passed, 2 xpassed** |
| Note on `test_eval_runner.py::test_post_applies_provider_override_to_user_settings` | Failed with 403 (expected 202) when run under a broad `-k settings` sweep | **Pre-existing rot, NOT a Phase 150 regression** — traced to `require_visible("skill_studio")` gating added in Phase 148 commit `3eb6f84f`, unrelated to any Phase 150 file. Confirmed the failure is identical regardless of local working-tree state (git stash test). Not counted against this phase. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| SEC-01 | 150-01, 150-02, 150-03, 150-04, 150-05 | Provider API keys encrypted at rest, app-layer cryptography, env-fallback preserved, round-trip verified | Implementation ✓ SATISFIED (requirement stays `Pending` in REQUIREMENTS.md by the documented 148/149 false-green-avoidance convention — it formally closes at `/gsd:secure-phase`, not at verify-work) | All 4 ROADMAP SCs verified above; no orphaned requirement IDs — every plan declares `requirements: [SEC-01]` and REQUIREMENTS.md maps exactly one row (`SEC-01 → Phase 150`) to this phase. |

No orphaned requirements found.

### Code Review Findings — Fix Verification

The phase's own code-review pass (`150-REVIEW.md`) found 1 Critical + 2 Warnings. All three fix commits were verified present in the actual code (not just claimed in commit messages):

| Finding | Fix Commit | Verified In Code |
|---------|-----------|-------------------|
| CR-01 (Critical): SQL injection via unvalidated provider id in the `SET` clause | `c6963655` | ✓ `settings.py:335-336` (422 boundary reject) + `user_settings.py:297-310` (`_VALID_COLUMN_NAME` identifier allowlist) — both layers present. |
| WR-01: sweep aborts the whole pass on one undecryptable column | `ddb41e68` | ✓ `secret_cipher.py:146-155` — nested try/except around `cipher.rotate()`, logs + `continue`s instead of propagating. |
| WR-02: false-green "Encrypted" tile on empty/cold-cache row | `00ae6893` | ✓ `secret_cipher.py:191,231-232` (`columns_seen == 0 → "unknown"`) + `HealthSignals.tsx` `unknown` state added to the `SecretsState` union and mapped to a neutral (never red) dot. |

IN-01 and IN-02 (Info-level, non-blocking) were left as documented — both are low-priority edge cases explicitly deferred by the reviewer's own severity classification, not silently dropped.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|not available|coming soon` across all phase-150-touched backend files returned zero matches (the two `PLACEHOLDER`-adjacent hits were pre-existing, legitimate conventions: `KEY_PLACEHOLDER = "***"` for the keep-existing-key UX sentinel, and SQL parameter placeholders in an unrelated admin.py function — neither is phase-150 debt).

### Human Verification Required

None. This phase is explicitly framed in `150-CONTEXT.md` as "Backend-only phase — no new UI surface, not sketch-gated." The single UI touch (the `secrets_encryption` Control Plane tile) has fully deterministic, mechanically-verifiable render logic (dot-color class mapping, label text) confirmed via source review, a focused backend unit test proving the three-state field, and a clean `vite build`. No live-appearance, real-time, or external-service behavior requires human judgment for this phase's goal to be considered achieved.

### Gaps Summary

No gaps. All 4 ROADMAP Success Criteria and all 7 plan-level must-have truths across the 5 plans are verified directly against the codebase — source review, live-DB checks (psycopg2 against `127.0.0.1:54322`), a full 36/36 green phase-specific pytest run, a 32/32 (+2 xpassed) green settings-substrate regression run, and a clean frontend production build. The 3 code-review findings (1 Critical, 2 Warnings) from `150-REVIEW.md` were independently confirmed fixed in the actual source, not merely claimed in commit messages. SEC-01 remains `Pending` in REQUIREMENTS.md by design (the documented 148/149 false-green-avoidance convention) and is expected to close at `/gsd:secure-phase 150` — this is not a gap, per the phase's stated convention and this verifier's briefing.

---

_Verified: 2026-07-13T18:45:57Z_
_Verifier: Claude (gsd-verifier)_
