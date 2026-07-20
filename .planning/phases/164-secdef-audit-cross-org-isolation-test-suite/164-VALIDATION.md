---
phase: 164
slug: secdef-audit-cross-org-isolation-test-suite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 164 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `164-RESEARCH.md` §Validation Architecture (committed `1a4c6cf8`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (+ pytest-asyncio) |
| **Config file** | `backend/pytest.ini` / `pyproject.toml` (existing; confirm at plan-time) |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_v3_4_org_isolation.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest tests/integration -k "163 or v3_4_org" -q` |
| **Live-DB guard** | `@requires_pg` (skip-guarded on :54322 via `_rls_harness`) |
| **Estimated runtime** | ~30–60 seconds (integration, live local DB) |

---

## Sampling Rate

- **After every task commit:** `pytest tests/integration/test_v3_4_org_isolation.py -x` + `pytest tests/integration -k "163" -q` (must not regress the crux)
- **After every plan wave:** full suite + `pytest tests/integration/test_058_concurrency.py -x` (CONCUR-01 <1s gate)
- **Before `/gsd:verify-work`:** `test_v3_4_org_isolation.py` fully green AND the red-anchor proven RED against a pre-164 checkout; SC#10 4-axis live UAT (operator-run)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Rows are seeded from RESEARCH §Phase Requirements → Test Map. The planner/nyquist-auditor binds each to concrete `{N}-PP-TT` task IDs during planning.

| Req ID | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------|-------------------|-------------|--------|
| TEN-03 | DEFINER body ignores spoofed `match_user_id` (org from `auth.uid()`) — the RED anchor | T-164-EoP-01 | integration (asyncpg) | `pytest tests/integration/test_v3_4_org_isolation.py::test_definer_ignores_spoofed_match_user_id -x` | ❌ W0 | ⬜ pending |
| TEN-03 | All 4 fns return 0 cross-org rows, both DB paths | T-164-EoP-01 | integration | `pytest tests/integration/test_v3_4_org_isolation.py -k definer -x` | ❌ W0 | ⬜ pending |
| TEN-03 | 4 fns are DEFINER + have a pinned `search_path` (`pg_proc` assert) | T-164-EoP-02 | integration (DB introspection) | `pytest tests/integration/test_v3_4_org_isolation.py -k search_path -x` | ❌ W0 | ⬜ pending |
| TEN-03 | text-to-SQL / grep cannot cross orgs (regex deleted, RLS via asyncpg user-ctx) | T-164-ID-03 | integration | `pytest tests/integration/test_v3_4_org_isolation.py -k text_to_sql -x` | ❌ W0 | ⬜ pending |
| TEN-05 | Every user-facing table: B reads 0 of A's rows, both paths | T-164-ID-03 | integration (data-driven matrix) | `pytest tests/integration/test_v3_4_org_isolation.py -k table_matrix -x` | ❌ W0 | ⬜ pending |
| TEN-05 | `X-Org-Id` spoof does not widen access | T-164-Spoof-04 | integration/API | `pytest tests/integration/test_v3_4_org_isolation.py -k org_header_spoof -x` | ❌ W0 | ⬜ pending |
| TEN-06 | Non-owner reader sees `user_id=None` on global folders/skills/views | T-164-ID-05 | unit (serialize) | `pytest tests/test_seed091_owner_nulling.py -x` | ❌ W0 | ⬜ pending |
| PRAG-01 | B's hybrid search never returns A's private chunks; shared per folder-ACL | T-164-ID-03 | integration (live retrieval) | `pytest tests/integration/test_v3_4_org_isolation.py -k prag01_retrieval -x` | ❌ W0 | ⬜ pending |
| PRAG-01 | CONCUR-01 <1s holds after the folder-visibility widening | — | integration (perf) | `pytest tests/integration/test_058_concurrency.py -x` | ✅ exists (re-run) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/test_v3_4_org_isolation.py` — the exit-gate matrix (TEN-03 / TEN-05 / PRAG-01)
- [ ] `tests/test_seed091_owner_nulling.py` — TEN-06 serialize unit tests (folders / skills / views)
- [ ] Confirm the `two_orgs_two_users` fixture is importable from the Phase-163 conftest scope (powers `test_163_leak_*`); extend its seed with a **shared-folder** doc for the PRAG-01 leg
- [ ] A `pg_proc`-introspection helper (assert `prosecdef=true` + `proconfig` contains `search_path`) for the audit assertions

*Existing infra reused: `_rls_harness`, `assert_auth_uid`, `open_user_conn`, `as_user_supabase_txn`, `test_058_concurrency.py`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#10 4-axis live cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message) | TEN-03 / PRAG-01 | Requires live LLM providers + real streaming; retrieval RPCs now run on the asyncpg user-context inside the producer | Operator-run after suite green: exercise hybrid search + text-to-SQL + code across OpenAI/Anthropic/Google/OpenRouter reps; confirm no cross-org leak, Deep byte-identical |
| Red-anchor proven RED against a pre-164 checkout | TEN-05 | Proves the exit gate tests the NEW behavior, not a tautology | Check out pre-164 DB state (or a function snapshot), run the spoofed-`match_user_id` assertion → MUST fail; then post-164 → passes |
| Frontend tolerates `user_id=None` on non-owned global rows | TEN-06 | UI-contract check (no UI build this phase) | Load folders/skills/views lists as a non-owner; owner-gated affordances stay inert with a null owner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (flip at plan-checker/nyquist-audit time)

**Approval:** pending
