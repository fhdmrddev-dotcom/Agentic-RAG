---
phase: 148
slug: governance-audit-users-feature-visibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 148 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `148-RESEARCH.md` → Validation Architecture. Requirements: ADMIN-03, VIS-01.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_148_*.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | ~15–30 seconds (quick), ~2–4 min (full) |

Key fixtures (extend `conftest.py`): `operator_override` (overrides `require_operator`), `mock_asyncpg_pool` (drives `is_operator`/reads), `_supabase` mock via `get_supabase` override (GoTrue-admin mock), `authenticate_operator_request` override, `client`, `auth_headers`. **Wave 0 adds:** a `banned_user` asyncpg-pool fixture + a `feature_visibility` app_settings-row fixture.

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_148_*.py -x`
- **After every plan wave:** Run `pytest -q` (full backend suite — 146/147 tests are the regression backstop; must stay green)
- **Before `/gsd:verify-work`:** Full suite green **AND** the G-4 live UAT below all pass
- **Max feedback latency:** ~30 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| require_visible → 403 not 404 | 1 | VIS-01 | T-visibility | Non-operator hitting an Operators-only governed endpoint gets 403 + plain body | unit | `pytest tests/test_148_require_visible.py::test_non_operator_403 -x` | ❌ W0 | ⬜ pending |
| require_visible operator no-op | 1 | VIS-01 | T-visibility | Operator pass-through on any governed endpoint | unit | `pytest tests/test_148_require_visible.py::test_operator_noop -x` | ❌ W0 | ⬜ pending |
| Everyone-audience no-op | 1 | VIS-01 | T-visibility | Everyone feature → no-op for non-operator (byte-identical carve-out) | unit | `pytest tests/test_148_require_visible.py::test_everyone_noop -x` | ❌ W0 | ⬜ pending |
| Cold-read default per feature | 1 | VIS-01 | T-fail-open | Deny skill_studio/model_management, allow workflow/governance on cold read | unit | `pytest tests/test_148_visibility_cold_default.py -x` | ❌ W0 | ⬜ pending |
| Run carve-outs ungated | 1 | VIS-01 | T-visibility | `GET /settings/providers`, `GET /workflows/published`, workflow launch NOT gated | unit | `pytest tests/test_148_carveouts.py -x` | ❌ W0 | ⬜ pending |
| Effective-features map | 1 | VIS-01 | — | `GET /features` returns per-user map (operator all-true; end user only Everyone) | unit | `pytest tests/test_148_effective_features.py -x` | ❌ W0 | ⬜ pending |
| Platform browse filters → SQL | 1 | ADMIN-03 | T-leak | action_type IN + date range return only matching rows | unit | `pytest tests/test_148_platform_audit_filters.py -x` | ❌ W0 | ⬜ pending |
| No full-tenant leak | 1 | ADMIN-03 | T-leak | Paginated (page_size cap) + user-scoped param honored | unit | `pytest tests/test_148_platform_audit_scope.py -x` | ❌ W0 | ⬜ pending |
| CSV = exactly the filtered set | 1 | ADMIN-03 | T-leak | Over-cap → refuse; `audit.export` recorded with count | unit | `pytest tests/test_148_csv_export.py -x` | ❌ W0 | ⬜ pending |
| view_platform recorded | 1 | ADMIN-03 | T-audit | Switching to Platform source records `audit.view_platform` | unit | `pytest tests/test_148_view_platform_recorded.py -x` | ❌ W0 | ⬜ pending |
| Roster last-active honesty | 1 | ADMIN-03 | — | `never signed in` when `last_sign_in_at` NULL (never fabricated) | unit | `pytest tests/test_148_roster.py::test_last_active_honesty -x` | ❌ W0 | ⬜ pending |
| Disable → ban + run cancel | 1 | ADMIN-03 | T-ban | GoTrue `ban_duration` set + in-flight run cancelled via `_cancel_run_internals` | unit | `pytest tests/test_148_disable.py -x` | ❌ W0 | ⬜ pending |
| App-layer ban enforcement | 1 | ADMIN-03 | T-ban | Disabled user with a live token → 403 on any authed route | unit | `pytest tests/test_148_ban_enforcement.py -x` | ❌ W0 | ⬜ pending |
| Ban check fails OPEN | 1 | ADMIN-03 | T-lockout | DB read error → does not lock out everyone | unit | `pytest tests/test_148_ban_fail_open.py -x` | ❌ W0 | ⬜ pending |
| Enable → clear ban | 1 | ADMIN-03 | T-ban | Enable sets `ban_duration="none"` | unit | `pytest tests/test_148_enable.py -x` | ❌ W0 | ⬜ pending |
| Grant/revoke + self-guards | 1 | ADMIN-03 / D-01 | T-lockout | Grant populates `granted_by`; self-revoke + self-disable refused server-side | unit | `pytest tests/test_148_operator_grant.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file created in Wave 0*

---

## Wave 0 Requirements

- [ ] `tests/test_148_require_visible.py`, `..._effective_features.py`, `..._visibility_cold_default.py`, `..._carveouts.py` — VIS-01 stubs
- [ ] `tests/test_148_platform_audit_filters.py`, `..._scope.py`, `..._csv_export.py`, `..._view_platform_recorded.py` — audit browse stubs
- [ ] `tests/test_148_roster.py`, `..._disable.py`, `..._ban_enforcement.py`, `..._ban_fail_open.py`, `..._enable.py`, `..._operator_grant.py` — users stubs
- [ ] Extend `conftest.py`: `banned_user` asyncpg-pool fixture + `feature_visibility` app_settings-row fixture (reuse `mock_asyncpg_pool` + `_supabase` GoTrue-admin mock)

*Framework already present (pytest) — no install needed.*

---

## Manual-Only Verifications (G-4 lived-experience UAT — Chrome MCP / operator-clicks; wire format insufficient)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The disabled user is really out | ADMIN-03 | Cross-session eviction within one request cannot be proven by a single-process unit test | Operator disables user B (kept logged-in in a 2nd browser); B's next action (send a chat, open Documents) shows "This account is disabled — contact your administrator" within one request — not after token expiry. B's in-flight run shows Stopped. |
| The map is honest + the API is the wall | VIS-01 | Requires a live non-operator session + mid-session flip propagation | Non-operator sees no Skill Studio / Settings nav; hand-hitting `POST /skills/{id}/evals/runs` or `PUT /settings` returns 403 (not 404); flipping workflow authoring to Operators-only mid-session → Builder's next fetch 403s → plain refusal + routed to Chat; Run still works. |
| The export is exactly the filter | ADMIN-03 | Requires a real filtered live dataset + ledger receipt round-trip | Filter to one action type + 7d, note the live match count, export CSV → row count matches the shown count, and a `✎ Exported N audit entries` receipt appears in the ledger. |

*SC#10 cross-provider UAT is NOT required — this phase does not touch streaming/agent-loop/provider-routing paths beyond reusing the already-covered `_cancel_run_internals` (147 kill path carries its own SC#10 coverage).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
