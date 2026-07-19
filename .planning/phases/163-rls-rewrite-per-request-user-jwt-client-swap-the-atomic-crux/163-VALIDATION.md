---
phase: 163
slug: rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 163 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `163-RESEARCH.md` § Validation Architecture (the two-user leak-test design is the D-08 acceptance gate).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio [VERIFIED: `backend/requirements.txt:31-33`] |
| **Config file** | `backend/pytest.ini` + existing integration `conftest.py` |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_163_*.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/integration -x` |
| **Live-DB tooling** | psycopg2 @ `127.0.0.1:54322` + the asyncpg pool (both proven in `test_110_dm_schema.py`) |
| **Estimated runtime** | ~30s (phase tests) / full integration suite varies |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/integration/test_163_*.py -x` (< 30s target)
- **After every plan wave:** Run the full integration suite + `test_058_concurrency.py` (the CONCUR-01 gate)
- **Before `/gsd:verify-work`:** Full suite green + the operator-run D-08 live two-user leak test + the SC#10 4-axis UAT
- **Max feedback latency:** ~30 seconds (phase tests)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are the requirement→test contract the plans must satisfy. `❌ W0` = authored in Wave 0.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | extraction | 0 | D-01 | — | Deep-Mode byte-identical after `threads.py` extraction; full suite green | integration + UAT | existing Deep byte-identical harness + full suite | ✅ pattern (Phase 089) | ⬜ pending |
| TBD | asyncpg-swap | — | TEN-02 | T-163-01 | `SET LOCAL ROLE authenticated` + claims makes `auth.uid()` resolve; user B reads 0 of user A's rows | integration (two-user) | `pytest tests/integration/test_163_leak_asyncpg.py -x` | ❌ W0 | ⬜ pending |
| TBD | supabase-swap | — | TEN-02 | T-163-01 | per-request user-JWT client (anon key + Bearer, no singleton mutation) reads 0 of A's rows | integration (two-user) | `pytest tests/integration/test_163_leak_supabase.py -x` | ❌ W0 | ⬜ pending |
| TBD | swap | — | TEN-02 | T-163-01 | role-swap-noop detector: WITHOUT `SET LOCAL ROLE` → all rows (BYPASSRLS); WITH it → own only | integration | `pytest tests/integration/test_163_role_swap.py -x` | ❌ W0 | ⬜ pending |
| TBD | rls-bundles | — | TEN-01 | T-163-02 | each cluster's SELECT/INSERT/UPDATE/DELETE enforces membership + preserves global/system branches | integration (per bundle) | `pytest tests/integration/test_163_rls_<cluster>.py -x` | ❌ W0 | ⬜ pending |
| TBD | ten04 | — | TEN-04 | — | `document_chunks`/`skill_embeddings` `org_id` backfill zero-NULL + NOT NULL + btree(org_id) present | integration/SQL | `pytest tests/integration/test_163_ten04_backfill.py -x` | ❌ W0 | ⬜ pending |
| TBD | ten04-perf | — | TEN-04 | — | CONCUR-01 <1s cross-tab-GET-during-streaming stays green with the client swap live (measures SET-LOCAL RTT) | integration (perf gate) | `pytest tests/integration/test_058_concurrency.py -x` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/test_163_leak_asyncpg.py` — TEN-02 asyncpg two-user leak (the D-08 core)
- [ ] `tests/integration/test_163_leak_supabase.py` — TEN-02 supabase-py two-user leak
- [ ] `tests/integration/test_163_role_swap.py` — role-swap-noop / claims-spoof detector
- [ ] `tests/integration/test_163_rls_<cluster>.py` — one per RLS bundle (documents / chat / skills / DM / workflow-eval / identity-audit)
- [ ] `tests/integration/test_163_ten04_backfill.py` — `org_id` backfill + btree(org_id) index assertions
- [ ] `tests/integration/conftest.py` fixtures — two seeded users in two orgs (reuse mig-105 personal orgs OR create two explicit orgs + memberships) + a `pg_get_functiondef('auth.uid()')` probe fixture
- [ ] The Deep-Mode byte-identical harness reused for the Wave-0 `threads.py` extraction (Phase-089 pattern)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **D-08 live two-user leak test** — user B provably reads 0 of user A's rows across BOTH DB paths on the live local DB, with fail-loud `auth.uid()` preflight + positive control + role-swap-noop diff + spoof/fail-closed cases + GUC-variant arbitration | TEN-01, TEN-02 | The crux gate — the exact `SET LOCAL`/GUC semantics must be proven against the running DB, not docs (research base MEDIUM-confidence). Operator starts the backend (`feedback_user_starts_backend`). | Operator runs the authored harness once; reads a pass/fail scoreboard. Preflight MUST assert `SELECT auth.uid()` == the user's UUID before any isolation assert (else a wrong GUC variant false-passes at "0 rows"). |
| **SC#10 4-axis UAT** — cross-provider × multi-tool × parallel-thread × long-message, Deep-Mode byte-identical with the swap live | D-09 | Live cross-provider streaming behavior + felt-experience; Chrome-MCP/operator-driven (`browser-uat-user-driven`). | Operator exercises OpenAI / Anthropic / Google / OpenRouter with a 2+-tool prompt, a parallel-thread pair, and a ≥50-message thread; confirms no regression + org context rides the request seam only. |
| **CONCUR-01 <1s perf gate** — benchmark before merge | TEN-04 | The real risk is the SET-LOCAL round-trip overhead the swap adds; must be measured against the binding gate on the live DB. | Run `test_058_concurrency.py` with the swap live; confirm cross-tab-GET-during-streaming stays <1s. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 6 new test files + conftest fixtures)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (set by the planner/Nyquist step once the per-task map is bound to real task IDs)

**Approval:** pending
