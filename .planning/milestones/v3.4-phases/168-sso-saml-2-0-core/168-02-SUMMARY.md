---
phase: 168-sso-saml-2-0-core
plan: 02
subsystem: auth
tags: [sso, saml, supabase, httpx, secret-cipher, fernet, deploy-parity, tdd]

# Dependency graph
requires:
  - phase: 168-01
    provides: "mig 113 — app_settings.supabase_management_token column + sso_configs status/approval + org-admin sso:manage grant"
  - phase: 150
    provides: "secret_cipher (MultiFernet enc:v1: envelope, SECRET_COLUMNS allowlist, get_cipher/decrypt_secret) + boot sweep_row"
  - phase: 160
    provides: "4-tier no-code-fork transport contract (one body, adapter selects transport by env)"
provides:
  - "sso_provider_service: ONE provider-CRUD proxy with TWO env-selected async transport adapters (Cloud Management API vs self-hosted GoTrue Admin API)"
  - "build_body: the single identical SAML-provider request body (first_name/last_name attribute mapping only; email auto-detected; role/group never mapped)"
  - "fail-closed contract: non-2xx raises SsoProviderError (caller writes no sso_configs); create returns provider_id; delete calls the API first (no orphan)"
  - "get_management_token: call-time decrypt of the Cloud sbp_ token via the Phase-150 cipher, never logged"
  - "sso_domain_blocklist: hardcoded PUBLIC_EMAIL_DOMAINS + is_public_domain() (anti-hijack Control 1, no runtime fetch)"
  - "config adapter switch: supabase_project_ref + supabase_self_hosted; supabase_management_token added to SECRET_COLUMNS (12->13)"
  - "deploy-artifact parity for the two SSO env vars (backend/.env.example, onebox, compose, OPERATOR.md)"
affects: [168-03, 168-04, 168-05, 168-06]

# Tech tracking
tech-stack:
  added: []  # httpx / cryptography already deps — 0 new deps (per ROADMAP: "0 new hard deps")
  patterns:
    - "One-service-two-adapters: build the request body ONCE, select (base_url, headers) by env — no per-tier code fork (D-160)"
    - "async httpx.AsyncClient inside `async with` for all provider I/O (model_discovery_service idiom; no blocking client in an async fn — CLAUDE.md)"
    - "encrypted deployment secret read at call time via secret_cipher; logged by column name only (T-081.1-04 discipline extended to a new secret)"

key-files:
  created:
    - backend/app/services/sso_provider_service.py
    - backend/app/services/sso_domain_blocklist.py
    - backend/tests/unit/test_168_sso_provider_service.py
  modified:
    - backend/app/config.py
    - backend/app/security/secret_cipher.py
    - backend/.env.example
    - deploy/onebox.env.example
    - docs/OPERATOR.md
    - docker-compose.prod.yml

key-decisions:
  - "get_management_token + _transport are async (read app_settings via the asyncpg 30s-TTL seam) — a sync token read would be blocking I/O in an async path (CLAUDE.md). PATTERNS showed them sync; async is the correct realization."
  - "build_body defensively sanitizes attribute_mapping to a first_name/last_name allowlist — even if a caller passes email/role/group it is dropped (D-168-03 enforced at the seam, not just by convention)."
  - "SUPABASE_PROJECT_REF/SUPABASE_SELF_HOSTED also added to backend/.env.example (not in the plan's files_modified) to keep the onebox header's 'every key here also lives in backend/.env.example' contract true and the drift check honest."
  - "SSO-01 NOT marked complete — it is a phase-spanning requirement delivered across plans 02-06; marking it after plan 2/6 would be a false completion (left Pending for phase verify-work)."

patterns-established:
  - "Provider-CRUD proxy seam: token-bearing, network-facing integration isolated behind one tested service so Plan 04 endpoints are pure wiring."
  - "New at-rest deployment secret = add the column name to SECRET_COLUMNS (boot sweep encrypts it generically) + decrypt at call time; no bespoke crypto."

requirements-completed: []  # SSO-01 is phase-spanning (plans 02-06); intentionally NOT marked complete here

# Metrics
duration: 13min
completed: 2026-07-22
---

# Phase 168 Plan 02: SSO Deployment Config + Provider-CRUD Proxy Summary

**One env-switched, fully-async Supabase provider-CRUD proxy (Cloud Management API vs self-hosted GoTrue, ONE identical body) with a fail-closed contract, a public-domain anti-hijack blocklist, and a call-time-decrypted management token — plus the config + deploy-artifact parity foundation every SSO endpoint stands on.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-22T07:52:00Z
- **Completed:** 2026-07-22T08:05:00Z
- **Tasks:** 2 (Task 2 was TDD: RED → GREEN)
- **Files created:** 3 · **Files modified:** 6

## Accomplishments
- **Provider-CRUD proxy (`sso_provider_service.py`)** — one service, two thin transport adapters selected by `supabase_self_hosted`: Cloud (`api.supabase.com` Management API, single `Authorization: Bearer <sbp_>`) vs self-hosted GoTrue Admin API (`{supabase_url}/auth/v1/admin/…`, BOTH `Authorization` + `apikey` = service_role). `build_body` is byte-identical across both (D-160 no-code-fork).
- **Fail-closed + anti-orphan** — any non-2xx raises `SsoProviderError` (caller writes no `sso_configs`, T-168-05a); `create_provider` returns the GoTrue `provider_id`; `delete_provider` calls the provider-CRUD DELETE first (never orphans a GoTrue provider, T-168-09). All CRUD via `httpx.AsyncClient` (non-blocking — CLAUDE.md).
- **Secret discipline (T-168-04)** — `get_management_token` reads `app_settings.supabase_management_token` and decrypts the Phase-150 `enc:v1:` envelope only at call time; logs by column name only; the caplog test proves the token appears in no log record.
- **Anti-hijack Control 1 (`sso_domain_blocklist.py`, T-168-02)** — hardcoded `PUBLIC_EMAIL_DOMAINS` (~30 providers) + case-insensitive `is_public_domain()`; no runtime fetch (SSRF/availability).
- **Config + parity foundation** — `supabase_project_ref` + `supabase_self_hosted` settings; `supabase_management_token` added to `SECRET_COLUMNS` (12→13) so the boot sweep encrypts it generically; both env vars landed in backend/.env.example + onebox + compose + OPERATOR.md; `check-deploy-drift.sh` exits 0.
- **13/13 unit tests green** — adapter selection, identical/sanitized body, provider_id return, fail-closed on 4xx + on missing id, delete-via-API, blocklist, decrypt-at-call-time, missing-token fail-closed, never-logged token.

## Task Commits

1. **Task 1: Deployment-config foundation (config + secret allowlist + deploy artifacts)** — `a5add126` (feat)
2. **Task 2 (TDD RED): failing tests for provider-CRUD proxy + blocklist** — `3c7c39d2` (test)
3. **Task 2 (TDD GREEN): provider-CRUD proxy (two async adapters) + public-domain blocklist** — `635a634f` (feat)

_No REFACTOR commit — the GREEN implementation needed no cleanup._

## Files Created/Modified
- `backend/app/services/sso_provider_service.py` — provider-CRUD proxy: `_transport` (env switch), `get_management_token` (call-time decrypt), `build_body` (one identical body), async `create/list/update/delete_provider`, `SsoProviderError` (fail-closed).
- `backend/app/services/sso_domain_blocklist.py` — `PUBLIC_EMAIL_DOMAINS` frozenset + `is_public_domain()`.
- `backend/tests/unit/test_168_sso_provider_service.py` — 13 tests (recording fake `httpx.AsyncClient`, no network).
- `backend/app/config.py` — `supabase_project_ref` + `supabase_self_hosted` adapter-switch settings.
- `backend/app/security/secret_cipher.py` — `supabase_management_token` added to `SECRET_COLUMNS` (12→13).
- `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md` — deploy-artifact parity for `SUPABASE_PROJECT_REF` / `SUPABASE_SELF_HOSTED` + the management-token seed step.

## Decisions Made
- **Async token read + transport** — `get_management_token`/`_transport` are `async` because the token lives in `app_settings` read via the asyncpg 30s-TTL seam; a synchronous read would be blocking I/O inside an async request path (CLAUDE.md). The PATTERNS sketch showed them sync; async is the faithful, rule-compliant realization.
- **Defensive claim sanitization** — `build_body` rebuilds `attribute_mapping.keys` from a first_name/last_name allowlist, so a caller cannot smuggle in an `email`/`role`/`group` claim (D-168-03 enforced at the seam).
- **SSO-01 left Pending** — it is delivered across plans 02–06; marking it complete after plan 2/6 would be a false completion. Phase verify-work marks it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added the two SSO env vars to `backend/.env.example`**
- **Found during:** Task 1 (deploy-artifact parity)
- **Issue:** The plan's `files_modified` listed onebox / compose / OPERATOR.md but not `backend/.env.example`. The onebox header asserts "Every key here also lives in backend/.env.example, EXCEPT [FRONTEND_URL, ENVIRONMENT, VITE_*]"; adding `SUPABASE_PROJECT_REF`/`SUPABASE_SELF_HOSTED` only to onebox would silently break that contract and leave the canonical "keys the app reads" reference (the drift check's source of truth) incomplete.
- **Fix:** Declared both vars (config, not secrets) in `backend/.env.example` alongside the Supabase auth-key block.
- **Files modified:** `backend/.env.example`
- **Verification:** `check-deploy-drift.sh` exits 0 (no unclassified preset-key drift); onebox-header contract stays true.
- **Committed in:** `a5add126` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / artifact-consistency)
**Impact on plan:** Keeps the deploy-artifact parity honest and the onebox header accurate. No scope creep — same two config vars the plan already introduces.

## Issues Encountered
None — RED failed as expected (module ImportError), GREEN passed 13/13 on first run, drift check green.

## Known Stubs
None. `PUBLIC_EMAIL_DOMAINS` is a deliberately hardcoded set (D-168-05 Control 1 — no runtime fetch, by design), not a placeholder; the service returns real GoTrue `provider_id`s and fails closed on error.

## Threat Flags
None. All security-relevant surface introduced here (the token-bearing egress call, the domain gate, the delete path, the fail-closed contract) is already covered by the plan's `<threat_model>` (T-168-02 / T-168-04 / T-168-09 / T-168-05a) — no new un-modeled surface.

## User Setup Required
Cloud SAML SSO needs operator config before live use (documented in `docs/OPERATOR.md`): set `SUPABASE_PROJECT_REF` (+ leave `SUPABASE_SELF_HOSTED=false`) and seed `app_settings.supabase_management_token` with a Supabase Management/PAT (`sbp_…`) token — the `service_role` key does NOT work against the Management API. Self-hosted GoTrue (`SUPABASE_SELF_HOSTED=true`) needs neither (uses `service_role`). The plan's `user_setup` block captures the same.

## Next Phase Readiness
- The network seam is isolated + tested — **Plan 04's `/org/sso/providers` endpoints are now pure wiring** (call `create/list/update/delete_provider`, write `provider_id`, gate on the blocklist + approval status).
- Plan 03 (`require_sso_manage` guard + JIT `provision_sso_membership`) is independent of this seam and unblocked.
- **Cloud-parity owed (unchanged):** migrations 099→113 + `SECRETS_ENCRYPTION_KEY`, in order, at the next operator-gated push (mig 113 already carries the `supabase_management_token` column this plan now sweeps).

## Self-Check: PASSED
- All 9 created/modified files verified present on disk.
- All 3 task commits verified in git history (`a5add126`, `3c7c39d2`, `635a634f`).
- Task 1 verification: settings import clean (`''`/`False`), `supabase_management_token ∈ SECRET_COLUMNS` (count 13), `check-deploy-drift.sh` exit 0.
- Task 2 verification: `pytest tests/unit/test_168_sso_provider_service.py` = 13 passed; async-only (`httpx.Client(` absent), `decrypt_secret|get_cipher` present, no role/group claim mapped.

---
*Phase: 168-sso-saml-2-0-core*
*Completed: 2026-07-22*
