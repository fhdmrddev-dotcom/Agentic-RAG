---
phase: 150-secrets-at-rest
plan: 03
subsystem: security
tags: [cryptography, fernet, multifernet, secrets, app_settings, encryption-at-rest, settings]

# Dependency graph
requires:
  - phase: 150-01
    provides: "secret_cipher module — get_cipher/encrypt_secret/decrypt_secret/is_encrypted/SECRET_COLUMNS (enc:v1: envelope, MultiFernet)"
  - phase: 150-02
    provides: "mig 100 — all 12 secret columns exist as text in app_settings (live local DB)"
provides:
  - "Encrypt-on-write seam in save_app_settings (the ONE write seam) — SECRET_COLUMNS encrypted to enc:v1: after the sentinel guard, before the UPDATE"
  - "Decrypt-on-read seam _decrypt_secret_columns at the top of _build_settings_from_row (the ONE read seam) — decrypts onto a COPY; undecryptable columns fail soft to env"
  - "SC#1 ciphertext-at-rest integration proof (raw DB read shows enc:v1:, decrypts back)"
affects: [150-04, 150-05, secure-phase-150, verify-work-150]

# Tech tracking
tech-stack:
  added: []  # cryptography already declared a direct dep in Plan 01
  patterns:
    - "One encrypt seam + one decrypt seam; no caller bypasses either (RESEARCH Pattern 3)"
    - "Decrypt on a shallow copy so the 30s settings cache keeps ciphertext (defense-in-depth)"
    - "Fail-soft via the EXISTING _val DB>env chain: undecryptable column -> None -> env fallback, zero new fallback code"

key-files:
  created:
    - backend/tests/test_150_save_seam.py
    - backend/tests/test_150_read_seam.py
    - backend/tests/integration/test_150_ciphertext_at_rest.py
  modified:
    - backend/app/models/user_settings.py

key-decisions:
  - "Classify encrypted-vs-plaintext strictly by the enc:v1: prefix (is_encrypted), never by a blind decrypt (Pitfall 1)"
  - "Undecryptable enc:v1: column dropped to None to reuse the existing _val DB>env fallback (D-150-04/05 fail-soft for free)"
  - "Encrypt in save_app_settings (the ONE write seam), NOT update_settings (anti-pattern); iterate SECRET_COLUMNS allowlist, never user key names (SQLi-safe posture)"
  - "get_cipher() left to propagate ValueError on a malformed key at the write seam (D-150-04 fail-hard intent; Plan 04 validates at boot)"

patterns-established:
  - "Encrypt-on-write / decrypt-on-read at exactly two functions no caller bypasses"
  - "Decrypt onto a COPY keeps the raw (ciphertext) row in the per-worker cache"

requirements-completed: []  # SEC-01 stays OPEN — closes at verify-work/secure-phase after all 5 plans (148/149 false-green-avoidance convention)

# Metrics
duration: ~12min
completed: 2026-07-13
---

# Phase 150 Plan 03: Encrypt/Decrypt Settings Seams Summary

**Encrypt-on-write in save_app_settings + decrypt-on-read in _build_settings_from_row (copy-based, fail-soft to env via the existing _val chain), with a live-DB raw-read proof that secrets are stored as enc:v1: ciphertext at rest (SC#1).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-13T21:35Z (approx)
- **Completed:** 2026-07-13T21:44Z
- **Tasks:** 3
- **Files modified:** 4 (1 source, 3 tests)

## Accomplishments
- Encrypt-on-write: secret columns are wrapped in the enc:v1: envelope on write when a master key is set, pass through plaintext when not (D-150-01), never double-wrap, and never touch non-secret columns (SECRET_COLUMNS allowlist).
- Decrypt-on-read: `_decrypt_secret_columns` decrypts enc:v1: secret columns onto a copy at the top of `_build_settings_from_row`; the 30s settings cache keeps ciphertext (D-150-05 defense-in-depth); no consumer (`_build_providers`/`_resolve_llm`/embedding/rerank/tavily reads) ever sees ciphertext.
- Fail-soft for free: an undecryptable column (wrong/rotated-away key or tampered ciphertext) is dropped to None, so the EXISTING `_val` DB>env chain returns the env value — the platform stays up (D-150-04/05) with zero new fallback code.
- SC#1 proven end-to-end: a save through the real write seam against the live local Postgres stores `enc:v1:` ciphertext (raw SQL read, not through the decrypt seam), the plaintext never appears at rest, and it decrypts back to the submitted value (D-150-07 round-trip meaning).

## Task Commits

Each task was committed atomically (Tasks 1 & 2 were TDD — RED assertion then GREEN in a single feat commit each):

1. **Task 1: Encrypt-on-write in save_app_settings** - `7b77e686` (feat)
2. **Task 2: Decrypt-on-read in _build_settings_from_row (fail-soft to env)** - `36e463f5` (feat)
3. **Task 3: SC#1 ciphertext-at-rest integration proof** - `3be966fd` (test)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `backend/app/models/user_settings.py` - Encrypt step inserted in `save_app_settings` (after the `clean` build / sentinel guard, before the parameterized UPDATE); new module-level `_decrypt_secret_columns(row)` helper; `row = _decrypt_secret_columns(row)` added as the first statement of `_build_settings_from_row`.
- `backend/tests/test_150_save_seam.py` - 4 behaviors: encrypts-on-write (round-trips), no-key plaintext passthrough, already-encrypted not double-wrapped, non-secret column untouched. Uses a `_StubPool` that records the SQL params.
- `backend/tests/test_150_read_seam.py` - 5 behaviors: decrypts-on-read, fail-soft-to-env (no raise), env-precedence-no-key (SC#3), DB-over-env precedence, legacy plaintext untouched.
- `backend/tests/integration/test_150_ciphertext_at_rest.py` - SC#1 acceptance anchor: live-PG-guarded raw read proving enc:v1: at rest + decrypt-back; restores the column afterward.

## Verification

- `pytest tests/test_150_save_seam.py` -> 4/4 green.
- `pytest tests/test_150_read_seam.py` -> 5/5 green.
- `pytest tests/integration/test_150_ciphertext_at_rest.py` -> 1/1 green (live PG on 127.0.0.1:54322; skips when unreachable).
- All three together -> 10/10 green.
- Regression: `tests/test_147_flag_failure_semantics.py` + `tests/test_150_cipher.py` -> 16/16 green (the seams these suites exercise are unchanged in behavior when no key is set).
- Source review: `from app.security.secret_cipher import` present at BOTH seams (user_settings.py:311 write, :607 read); `row = _decrypt_secret_columns(row)` is the first statement of `_build_settings_from_row` (:639); write seam iterates `clean` keys guarded by `k in SECRET_COLUMNS`, read seam iterates `for col in SECRET_COLUMNS` (allowlist, never user key names); decrypt-failure log names the COLUMN only.

## Decisions Made
- None beyond the plan — the RESEARCH Pattern 3 seams were implemented exactly as specified. The four `key-decisions` above were pre-locked by RESEARCH/CONTEXT (Pitfall 1 prefix classification, D-150-04/05 fail-soft via `_val`, write-seam placement, malformed-key fail-hard intent).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None — both seams are fully wired to the real `secret_cipher` module (Plan 01); no placeholder data, no mock data sources.

## User Setup Required
None - no external service configuration required. (The `SECRETS_ENCRYPTION_KEY` env var activation + Coolify cloud parity are Plan 04 / deploy-time concerns; these seams behave correctly with or without a key — D-150-01 plaintext passthrough.)

## Next Phase Readiness
- The two encryption seams are live; **Plan 04** can now add boot-time key validation + the eager idempotent sweep and surface the `save_app_settings` bool as an HTTP 500 (D-150-07) knowing writes already encrypt and reads already decrypt/fail-soft.
- **Plan 05** (Control Plane signal) can call `encryption_status()` over the real at-rest state.
- SEC-01 intentionally NOT marked complete (148/149 false-green-avoidance convention) — it closes at `/gsd:verify-work` / `/gsd:secure-phase` after all 5 plans land.

## Self-Check: PASSED
- Files: FOUND user_settings.py, test_150_save_seam.py, test_150_read_seam.py, test_150_ciphertext_at_rest.py.
- Commits: FOUND 7b77e686, 36e463f5, 3be966fd.

---
*Phase: 150-secrets-at-rest*
*Completed: 2026-07-13*
