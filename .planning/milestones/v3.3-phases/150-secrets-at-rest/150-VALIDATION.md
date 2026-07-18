---
phase: 150
slug: secrets-at-rest
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
---

# Phase 150 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Backend-only phase (app-layer Fernet/MultiFernet secret encryption). The CLAUDE.md
> 4-axis cross-provider UAT recipe does NOT apply — this phase touches neither streaming,
> agent loop, provider routing, nor UI state (it is the settings substrate + one static
> health tile). See RESEARCH §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (backend venv) |
| **Config file** | backend/pytest.ini + backend/tests/conftest.py + backend/tests/integration/conftest.py |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/test_150_*.py tests/api/test_150_*.py -x -q` |
| **Integration run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_150_*.py -x -q` (live-PG guarded, DSN postgresql://postgres:postgres@127.0.0.1:54322/postgres) |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest -q` |
| **Frontend build gate** | `cd frontend && npx vite build` (exit 0) |
| **Estimated runtime** | ~20-40s unit; +live-PG for integration |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (fast unit seams).
- **After every plan wave:** Run quick + integration (adds live-PG sweep + the SC#1 ciphertext-at-rest proof).
- **Before `/gsd:verify-work`:** Full backend suite green; the SC#1 ciphertext-at-rest integration test is the acceptance anchor; `npx vite build` exit 0.
- **Max feedback latency:** < 60s (unit); integration runs against local PG.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Decision / SC | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|---------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 150-01-01 | 01 | 1 | SEC-01 | D-150-01 | T-150-P5 | env var + declared dep; no key material committed | smoke | `python -c "import app.config; from cryptography.fernet import MultiFernet"` | ❌ W0 | ⬜ pending |
| 150-01-02 | 01 | 1 | SEC-01 | D-150-04/06 | T-150-02/05/06/SC | cipher round-trip, malformed→ValueError, rotation, idempotent sweep, status states incl. honest lingering-plaintext (columns_plaintext) under an active key | unit | `pytest tests/test_150_cipher.py -x` | ❌ W0 | ⬜ pending |
| 150-02-01 | 02 | 1 | SEC-01 | D-150-08 | T-150-07 | idempotent DDL adds 10 text columns | source | `grep -cE 'ADD COLUMN IF NOT EXISTS ..._api_key text' supabase/migrations/100_*.sql` == 10 | ❌ W0 | ⬜ pending |
| 150-02-02 | 02 | 1 | SEC-01 | D-150-08 | T-150-04a | migration applied live; 12 secret columns exist as text | integration (psql) | psycopg2 12-column assertion (see plan) | ❌ W0 | ⬜ pending |
| 150-03-01 | 03 | 2 | SEC-01 | SC#1 / D-150-01 | T-150-01/02 | encrypt-on-write enc:v1:; no-key passthrough; no double-wrap | unit | `pytest tests/test_150_save_seam.py -x` | ❌ W0 | ⬜ pending |
| 150-03-02 | 03 | 2 | SEC-01 | D-150-04/05 / SC#3 | T-150-03/04/08 | decrypt-on-read on a copy; fail-soft to env; precedence preserved | unit | `pytest tests/test_150_read_seam.py -x` | ❌ W0 | ⬜ pending |
| 150-03-03 | 03 | 2 | SEC-01 | SC#1 | T-150-01 | raw read shows enc:v1:, decrypts back | integration | `pytest tests/integration/test_150_ciphertext_at_rest.py -x` | ❌ W0 | ⬜ pending |
| 150-04-01 | 04 | 2 | SEC-01 | D-150-07 / SC#2 | T-150-10 | failed save → HTTP 500 before audit/re-embed | unit (API) | `pytest tests/api/test_150_settings_error.py -x` | ❌ W0 | ⬜ pending |
| 150-04-02 | 04 | 2 | SEC-01 | D-150-01/03/04/06 / SC#4 | T-150-05/06/09 | boot validation hard-fail/warn; idempotent sweep; fail-open | integration | `pytest tests/integration/test_150_sweep.py tests/integration/test_150_failopen.py -x` | ❌ W0 | ⬜ pending |
| 150-05-01 | 05 | 2 | SEC-01 | D-150-02 | T-150-02b/03b | additive backpressure secrets_encryption over the RAW row; three-state field directly asserted; no crash | unit | `pytest -k backpressure -q && pytest tests/test_150_backpressure_secrets.py -x -q` | ❌ W0 (new: test_150_backpressure_secrets.py) | ⬜ pending |
| 150-05-02 | 05 | 2 | SEC-01 | D-150-02 | T-150-11 | three-state tile; plaintext NEUTRAL not red; error names unreadable/not-encrypted; back-compat optional | build | `cd frontend && npx vite build` | ✅ (existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_150_cipher.py` — cipher unit tests (roundtrip, malformed ValueError, rotation, no-key passthrough, sweep idempotence, encryption_status states incl. lingering-plaintext columns_plaintext under an active key).
- [ ] `backend/tests/test_150_save_seam.py` — encrypt-on-write in save_app_settings (StubPool asserts the enc:v1: param).
- [ ] `backend/tests/test_150_read_seam.py` — decrypt-on-read + fail-soft to env + precedence.
- [ ] `backend/tests/test_150_backpressure_secrets.py` — focused proof that get_backpressure's payload carries the additive secrets_encryption three-state field (mirror the existing `-k backpressure` harness; stub probe_dependencies + monkeypatch the raw-row loader).
- [ ] `backend/tests/api/test_150_settings_error.py` — D-150-07 HTTP 500 surfacing + no false audit/re-embed.
- [ ] `backend/tests/integration/test_150_ciphertext_at_rest.py` — SC#1 proof (raw read shows enc:v1:), reuse the _pg_reachable harness from test_081_1_settings_migration.py.
- [ ] `backend/tests/integration/test_150_sweep.py` — startup sweep idempotence (live PG, guarded).
- [ ] `backend/tests/integration/test_150_failopen.py` — no-key boot: plaintext + warning, settings load unchanged.
- [ ] Framework install: none — pytest/pytest-asyncio already present; cryptography already in venv.

---

## Manual-Only Verifications

The VALIDATION-level UAT (author + run at verify-work) must at minimum prove all four Success Criteria against the live app + DB:

| Behavior | Requirement / SC | Why Manual | Test Instructions |
|----------|------------------|------------|-------------------|
| Ciphertext at rest (SC#1) | SEC-01 / SC#1 | Needs a live DB read after a real Settings save | With SECRETS_ENCRYPTION_KEY set, save a provider/embedding key through the Settings UI; then psql/psycopg2 `SELECT {col} FROM app_settings WHERE id='global'` and confirm the stored value starts with `enc:v1:`, NOT the plaintext. |
| Failed save surfaces error (SC#2) | SEC-01 / SC#2 | Needs a forced persistence failure on the live route | Force a save failure (e.g. temporarily point at a bad column / kill the pool) and confirm the PUT /settings returns HTTP 500, not a silent 200; confirm no settings.update audit row is written for the failed attempt. |
| Env-only mode works (SC#3) | SEC-01 / SC#3 | Needs a boot with a secret supplied only via env, no DB secret | Boot with the provider key in env and the DB column empty; confirm the provider works (chat completes) — a DB read is never mandatory for a secret env can supply. Then confirm DB(decrypted) > env when both present. |
| No re-entry on existing deployments (SC#4) | SEC-01 / SC#4 | Needs a boot-without-key then boot-with-key transition on real stored data | Boot WITHOUT SECRETS_ENCRYPTION_KEY → plaintext + startup warning; Control Plane tile shows "Plaintext (no key set)" (NEUTRAL). Set the key, reboot → the eager sweep encrypts existing plaintext in place, keys still work with NO re-entry, and the Control Plane tile shows "Encrypted" (green). |
| Operator visibility (D-150-02) | SEC-01 / D-150-02 | Live board render | The `/admin` Control Plane health board shows the secrets_encryption tile in the correct state across the three transitions above; the raw field name appears under the Technical-names toggle. |
| Malformed key refuses start (D-150-04) | SEC-01 / D-150-04 | Boot-time behavior | Set SECRETS_ENCRYPTION_KEY to a malformed value → all workers refuse to start with a clear error + key-gen hint (mirrors 075.4). |

*The 4-axis cross-provider scoreboard is intentionally N/A for this phase (no streaming / agent-loop / provider-routing / UI-state surface).* 

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (Nyquist-compliant — every code task has a fast automated command; integration tasks are live-PG guarded).
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all MISSING references (8 new test files above).
- [ ] No watch-mode flags.
- [ ] Feedback latency < 60s (unit).
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending (execution not yet run)
