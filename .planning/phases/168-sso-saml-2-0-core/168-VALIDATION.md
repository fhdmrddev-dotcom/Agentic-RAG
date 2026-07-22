---
phase: 168
slug: sso-saml-2-0-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 168 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `168-RESEARCH.md` → `## Validation Architecture`. The planner fills
> the Per-Task Verification Map from PLAN.md tasks; execute-phase samples against it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -q -k sso` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~{N} seconds (planner to confirm) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (`-k sso`)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds (planner to confirm)

---

## Per-Task Verification Map

> Populated by the planner from PLAN.md tasks. One row per task; every SSO-01 behavior
> must trace to at least one automated command OR a Manual-Only row below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 168-01-01 | 01 | 0 | SSO-01 | — | mig 113 grants `org-admin` the `sso:manage` permission (mig 104 deferred it) | integration | `pytest tests/ -k sso_permission` | ❌ W0 | ⬜ pending |
| 168-XX-XX | XX | X | SSO-01 | T-168-XX | {planner fills} | unit/integration | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_sso.py` — stubs for SSO-01 (provider-CRUD proxy, domain routing, domain-gated JIT)
- [ ] `backend/tests/conftest.py` — shared fixtures: mocked Supabase provider-CRUD (cloud Management API + self-hosted GoTrue Admin API adapters), fake `sso_configs` rows
- [ ] Frontend: identifier-first `SignInForm` routing test (domain match → `signInWithSSO`; no match → reveal password)

*Signals to observe (from RESEARCH.md `## Validation Architecture`):*
- **Provider registered → live:** create-proxy returns a `provider_id` UUID written to `sso_configs`; `status='active'` only after approval gate.
- **Domain routing correct:** email domain → `sso_configs` lookup drives `signInWithSSO({ domain })` vs password reveal; public/free domains rejected at create.
- **JIT idempotency under duplicate-email:** domain/provider-gated `org_members` insert creates exactly one membership; re-run and duplicate-email (SSO ≠ password UUID) never double-insert (`ON CONFLICT (org_id, user_id) DO NOTHING` + advisory lock).
- **Password fallback retained:** existing password user still signs in the old way (SSO enforcement deferred).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ONE live end-to-end SAML round-trip | SSO-01 (SC#1) | Local Supabase CLI stack cannot run SAML (Kong doesn't route `/sso` — supabase/cli#1335); no local IdP | Cloud staging (Pro+) + mocksaml.com per RESEARCH.md D-168-06: register provider via SSO tab → sign in with SSO email → land in correct org as `member` |

*Everything else (CRUD call, routing decision, JIT insert, password fallback) is mocked in automated tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
