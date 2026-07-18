---
phase: 150-secrets-at-rest
plan: 01
subsystem: infra
tags: [cryptography, fernet, multifernet, secrets, encryption, security, pydantic-settings]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery
    provides: "the model/settings management track this security sub-phase pairs with (Track-3)"
provides:
  - "secret_cipher module — the single source of key material + encrypt/decrypt/detect/sweep/status contract every downstream seam imports"
  - "SECRET_COLUMNS frozenset (12 secret columns) — the new single-source allowlist Plan 04 will re-point main.py onto"
  - "SECRETS_ENCRYPTION_KEY env binding (config.Settings.secrets_encryption_key) + declared cryptography dep + operator .env.example guidance"
affects: [150-02, 150-03, 150-04, 150-05]

# Tech tracking
tech-stack:
  added: ["cryptography>=44.0.0 (Fernet/MultiFernet — promoted from transitive to declared direct dep)"]
  patterns:
    - "Single-source cipher module — no Fernet(...) constructed anywhere else in the app"
    - "enc:v1: envelope — classify ciphertext by prefix, never by a blind decrypt (Pitfall 1)"
    - "Intent-based failure polarity: None (fail-open) / ValueError (fail-hard) / InvalidToken (fail-soft)"
    - "Idempotent rotation sweep — rotate only non-primary tokens (Pitfall 3)"
    - "Honest encryption_status — surfaces columns_unreadable AND lingering columns_plaintext (never false-green)"

key-files:
  created:
    - backend/app/security/secret_cipher.py
    - backend/app/security/__init__.py
    - backend/tests/test_150_cipher.py
  modified:
    - backend/app/config.py
    - backend/requirements.txt
    - backend/.env.example

key-decisions:
  - "enc:v1: explicit envelope over the raw gAAAAA Fernet prefix (idempotent sweep, versionable, honest fail-soft signal)"
  - "SEC-01 NOT marked complete at Plan 01 — false-green avoidance; the phase requirement closes at verify-work/secure-phase after all 5 plans land (148/149 convention)"
  - "backend/app/security/__init__.py added (not in frontmatter files_modified) — the package init is required for the new module to import"

patterns-established:
  - "Cipher module owns ALL key material: get_cipher() is the only place Fernet(...) is constructed and the only reader of SECRETS_ENCRYPTION_KEY"
  - "Lazy `from app.config import settings` inside _load_keys() so tests monkeypatch the key at the boundary (test_146 precedent)"

requirements-completed: []  # SEC-01 intentionally deferred to phase verify-work (false-green avoidance)

# Metrics
duration: 7min
completed: 2026-07-13
---

# Phase 150 Plan 01: Cipher Foundation Summary

**secret_cipher module wrapping MultiFernet with an enc:v1: envelope + idempotent sweep + honest encryption_status, plus the SECRETS_ENCRYPTION_KEY env binding and declared cryptography dep — the interface-first contract Plans 02–05 import.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-13T17:19:04Z
- **Completed:** 2026-07-13T17:26:07Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Declared `SECRETS_ENCRYPTION_KEY` as a pydantic-settings env binding (`secrets_encryption_key: str = ""`) — empty defaults to D-150-01 fail-open, a malformed key to D-150-04 fail-hard.
- Promoted `cryptography>=44.0.0` to a declared direct dependency (was transitive; venv already has 46.0.7) and documented the operator key-gen + `NEW,OLD` rotation flow in `.env.example` (placeholder only, no real key).
- Built `backend/app/security/secret_cipher.py`: the single source of key material and the full `get_cipher` / `is_encrypted` / `encrypt_secret` / `decrypt_secret` / `sweep_row` / `encryption_status` contract, with `SECRET_COLUMNS` set-equal to `main._API_KEY_COLUMNS` (verified live).
- Proved the contract with 10 unit tests (TDD RED → GREEN): roundtrip, malformed-key ValueError, no-key passthrough, MultiFernet rotation-to-primary + idempotence, idempotent plaintext sweep, and encryption_status error states (columns_unreadable + lingering columns_plaintext).

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare env var, dependency, operator guidance** — `e37518fb` (feat)
2. **Task 2 (TDD): secret_cipher module + unit tests**
   - RED: `1d3bc1e9` (test) — failing cipher tests (module absent)
   - GREEN: `b1b93f17` (feat) — module implementation, 10/10 green

**Plan metadata:** bundled in the final docs commit (SUMMARY + STATE + ROADMAP).

## Files Created/Modified
- `backend/app/security/secret_cipher.py` — MultiFernet cipher wrapper + the encrypt/decrypt/detect/sweep/status helpers; single source of key material and the SECRET_COLUMNS allowlist.
- `backend/app/security/__init__.py` — new package init (empty).
- `backend/tests/test_150_cipher.py` — 10 cipher unit tests covering all seven behaviors + SECRET_COLUMNS set-equality + is_encrypted/encrypted-state cases.
- `backend/app/config.py` — added `secrets_encryption_key: str = ""` to `Settings` (binds `SECRETS_ENCRYPTION_KEY`).
- `backend/requirements.txt` — added `cryptography>=44.0.0` (commented-pin convention).
- `backend/.env.example` — added the `SECRETS_ENCRYPTION_KEY=` block with `Fernet.generate_key()` one-liner + rotation guidance.

## Decisions Made
- **enc:v1: envelope** over the raw `gAAAAA` Fernet prefix — classification by prefix keeps the sweep idempotent, distinguishes wrong-key ciphertext from plaintext (both raise InvalidToken on a blind decrypt), and leaves an `enc:v2:` upgrade path.
- **SEC-01 not marked complete** — this is Plan 01 of 5; the requirement is satisfied across the whole phase and closes at verify-work/secure-phase (mirrors the documented 148/149 false-green-avoidance convention). `requirements-completed: []`.
- **`decrypt` takes no `ttl`** (Pitfall 4) and **`Fernet(...)` is constructed nowhere else** (grep-verified) — both are locked acceptance criteria for downstream seams.

## Deviations from Plan

None - plan executed exactly as written. (`backend/app/security/__init__.py` is created as required by Task 2's `<files>` even though the plan frontmatter `files_modified` lists only `secret_cipher.py`; the package init is mandatory for import and is not a scope change.)

## Issues Encountered
None. TDD RED failed as expected (ModuleNotFoundError before the module existed); GREEN passed 10/10 on the first run.

## User Setup Required
None for this plan. Operator note for later phases / cloud parity: set `SECRETS_ENCRYPTION_KEY` in the backend env (and in Coolify for cloud) to activate encryption; unset = fail-open plaintext (D-150-01). No real key is committed.

## Next Phase Readiness
- The cipher contract is stable and importable — Plan 02 (migration 100), Plan 03 (encrypt/decrypt seams in `user_settings.py`), Plan 04 (lifespan key-validation + eager sweep + D-150-07 500), and Plan 05 (Control Plane `secrets_encryption` tile) can all import `app.security.secret_cipher` without exploring.
- No blockers.

## Self-Check: PASSED
- Files verified present: `backend/app/security/secret_cipher.py`, `backend/app/security/__init__.py`, `backend/tests/test_150_cipher.py`, `backend/app/config.py`, `backend/requirements.txt`, `backend/.env.example` — all FOUND.
- Commits verified present: `e37518fb` (Task 1), `1d3bc1e9` (RED), `b1b93f17` (GREEN) — all FOUND.
- `pytest tests/test_150_cipher.py -x` → 10 passed. `Fernet(` grep across `backend/app/` → only `secret_cipher.py`. `ttl=` grep in `secret_cipher.py` → none. `SECRET_COLUMNS == frozenset(main._API_KEY_COLUMNS)` → True.

---
*Phase: 150-secrets-at-rest*
*Completed: 2026-07-13*
