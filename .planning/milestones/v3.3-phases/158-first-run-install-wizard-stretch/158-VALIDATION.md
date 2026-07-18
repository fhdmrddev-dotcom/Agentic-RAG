---
phase: 158
slug: first-run-install-wizard-stretch
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
---

# Phase 158 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `158-RESEARCH.md` → "## Validation Architecture" + "## Security Domain". This phase is **NOT SC#10-flagged** (no chat streaming / agent-loop / provider-routing surface); the load-bearing invariant is **"a configured box is byte-identical — `SetupMiddleware` is a single latched bool check"**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest `>=8.0.0` + pytest-asyncio `>=0.24.0` + `fastapi.testclient` `[VERIFIED: backend/requirements.txt]` |
| **Framework (frontend)** | vitest + @testing-library/react (existing `frontend/src/**/__tests__`) |
| **Config file** | existing `backend/` pytest config + `frontend/vitest` config (no new install) |
| **Quick run command** | `cd backend && python -m pytest tests/test_setup_*.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -q` · `cd frontend && npx vitest run` · `bash scripts/check-deploy-drift.sh` |
| **Estimated runtime** | backend setup suite ~15-30s · drift-check <5s |

---

## Sampling Rate

- **After every task commit:** the touched `tests/test_setup_*.py` (backend) or `*.test.tsx` (frontend).
- **After every plan wave:** full `pytest -q` (backend) + `npx vitest run` (frontend) + `bash scripts/check-deploy-drift.sh`.
- **Before `/gsd:verify-work`:** full suites green + drift-check green.
- **Max feedback latency:** ~30 seconds (setup suite).

---

## Per-Task Verification Map

| Req / SC | Wave | Behavior | Threat Ref | Test Type | Automated Command | File Exists |
|----------|------|----------|------------|-----------|-------------------|-------------|
| SC#1 / D-06 | 0/2 | `GET /setup/status` → `needs_setup` from static marker+placeholder check | — | unit | `pytest tests/test_setup_status.py -x` | ❌ W0 |
| SC#1 / D-08 | 0/2 | env-detect probe returns store/env/docker flags | — | unit | `pytest tests/test_setup_detect.py -x` | ❌ W0 |
| SC#1 / D-10 | 0/2 | submitted-value probes: reachable→up · schema-absent→`schema_present:false` · bad DSN→down+sanitized reason | T-158 SSRF | unit (mock asyncpg/redis) | `pytest tests/test_setup_probe.py -x` | ❌ W0 |
| SC#1 / D-11 | 0/2 | operator bootstrap calls `admin.create_user(email_confirm=True)` + upserts operator | T-158 weak-cred | unit (mock supabase+asyncpg) | `pytest tests/test_setup_operator.py -x` | ❌ W0 |
| SC#1 / D-12 | 0/2 | provider key routes through `save_app_settings` (encrypt-on-write via SECRET_COLUMNS) | T-158 secret-leak | unit | `pytest tests/test_setup_provider.py -x` | ❌ W0 |
| SC#1 / D-13 | 0/2 | smoke = 5-way checklist; any red ⇒ finalize disabled | — | unit | `pytest tests/test_setup_smoke.py -x` | ❌ W0 |
| SC#2 / D-04 | 0/1 | `SetupMiddleware`: pre-finalize gates non-allowlisted → 503; allowlist passes; **post-finalize = literal passthrough (latched)** | T-158 post-finalize-write | unit (ASGI TestClient) | `pytest tests/test_setup_gate.py -x` | ❌ W0 |
| SC#2 / D-05 | 0/1 | finalize writes BOTH markers; `setup_finalized()` latches sticky-True | T-158 DB-blip-bounce | unit | `pytest tests/test_setup_finalize.py -x` | ❌ W0 |
| SC#2 / D-14 | 0/2 | re-POST a step after finalize → 409; every step idempotent | T-158 post-finalize-write | unit | `pytest tests/test_setup_idempotent.py -x` | ❌ W0 |
| SC#2 / D-15 | 0/1 | write without/with-wrong `X-Setup-Token` → 401; correct passes; constant-time compare | T-158 hijack / brute-force | unit | `pytest tests/test_setup_token.py -x` | ❌ W0 |
| SC#3 / D-01/02 | 0/1 | overlay: store value overrides placeholder env for infra keys; app-level never overridden | — | unit | `pytest tests/test_setup_overlay.py -x` | ❌ W0 |
| SC#3 / D-03 | 0/1 | setup-mode lifespan does NOT call `assert_action_types_synced` (guarded); configured-mode DOES | T-158 boot-crash-loop | unit (monkeypatch marker) | `pytest tests/test_setup_boot_tolerant.py -x` | ❌ W0 |
| SC#3 / D-07 | 0/3 | `hydrateSupabaseFromRuntime` overlays runtime creds; placeholder URL never throws at import | — | unit (frontend) | `npx vitest run src/lib/__tests__/supabase.test.ts` | ❌ W0 |
| SC#3 / D-06 | 0/3 | `App.tsx` renders `<SetupWizard/>` when `needs_setup`; "already configured" post-finalize | — | unit (frontend) | `npx vitest run src/pages/__tests__/SetupWizard.test.tsx` | ❌ W0 |
| D-16 | 0/4 | `check-deploy-drift.sh` exits non-zero on injected drift, zero on clean tree | — | script test | `bash scripts/check-deploy-drift.sh` | ❌ W0 |
| **Byte-identical invariant** | 1 | configured box: `SetupMiddleware` single-bool passthrough; no `/setup` router affects existing routes | — | integration | `pytest tests/test_setup_gate.py::test_configured_box_noop -x` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. All rows ⬜ pending until Wave 0 scaffolds land.*

---

## Wave 0 Requirements

_Test-scaffold Wave 0 delivered by plan 158-01 (commits `a18ac7b4` / `c765fcdb` / `ff9d3597`)._

- [x] `backend/tests/test_setup_gate.py` — gate (503 vs allowlist vs latched no-op) + byte-identical invariant — SC#2
- [x] `backend/tests/test_setup_token.py` — token 401/pass/constant-time — D-15
- [x] `backend/tests/test_setup_overlay.py` — store-wins-over-placeholder — D-01/02/SC#3
- [x] `backend/tests/test_setup_boot_tolerant.py` — the `main.py:357` guard — D-03/SC#3
- [x] `backend/tests/test_setup_operator.py` · `test_setup_probe.py` · `test_setup_finalize.py` · `test_setup_idempotent.py` · `test_setup_smoke.py` · `test_setup_status.py` · `test_setup_detect.py` · `test_setup_provider.py` — the step contracts
- [x] `backend/tests/conftest.py` fixtures: a temp `SETUP_STORE_PATH`, mock asyncpg/redis/supabase for submitted-value probes (reuse the `mock_asyncpg_pool` idiom from `test_146`)
- [x] `frontend/src/pages/__tests__/SetupWizard.test.tsx` + `frontend/src/lib/__tests__/supabase.test.ts` — the branch + the runtime-config shim
- [ ] `scripts/check-deploy-drift.sh` + a CI fixture-drift assertion — **NOT in plan 158-01** (production tooling, no test-file scaffold; D-16, its own plan)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Live end-to-end wizard run** (fresh `docker compose up` → open browser → token → 6 steps → finalize → restart → log in as operator) | SC#1/SC#2/SC#3 (lived-experience) | Structurally needs a human at a browser against a real/local Supabase — the analog of Phase 157's D-09 smoke. jsdom/TestClient can't exercise the real cross-container config-persist + restart + login path. | DEFERRED (D-18) — operator runs from `docs/OPERATOR.md`: `docker compose -f docker-compose.prod.yml up --build` → read token from `docker compose logs backend` → walk `/setup` → finalize → `docker compose restart backend` → log in. Code-complete + verify-work + secure-phase are autonomous. |
| **DB auto-runner over the pooler** (SHOULD) | D-10 | Pooler-role auth-schema/extension DDL privileges (assumption A1) unproven without a live Supabase. | Validate during the deferred operator UAT; the guide/copy-SQL path is the MUST fallback if privileges are insufficient. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references (all 14 SC-row test files exist; D-16 drift-check is a sibling non-test-file deliverable)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (backend setup suite ~0.6s; frontend stubs ~2s)
- [x] `nyquist_compliant: true` set in frontmatter (at Wave 0 completion)

**Approval:** test-scaffold Wave 0 complete (plan 158-01) — impl Waves 1-6 flip the reds/skips green.
