---
phase: 163
slug: rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
task_ids_bound: 2026-07-19
---

# Phase 163 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `163-RESEARCH.md` § Validation Architecture (the two-user leak-test design is the D-08 acceptance gate).
> Task IDs bound to real plan tasks at `/gsd:plan-phase 163` (10 plans, 5 waves).

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

> Task IDs are `<plan>-<Task#>` (e.g. `163-04 T1`). Wave 0 = the test scaffold authored in plans 01–04 (RED); GREEN at plan 05 (apply); operator-run gates at plan 10.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| precondition (Phase 162.5) | — | pre | D-01 | — | Deep-Mode byte-identical after the threads.py producer extraction; full suite green — SHIPPED as Phase 162.5 (verify-work 7/7, threats_open 0) | integration + UAT | Phase-162.5 Deep byte-identical harness (already passed) | ✅ landed | ✅ done |
| 163-01 T1/T2 | 01 | 1 | TEN-02 | T-163-01 | factories exist; get_user_pg_connection yields role=authenticated + auth.uid()=uid; get_service_role_supabase refuses missing org | integration (smoke) | `pytest tests/integration/test_163_factories.py -x` | ❌ W0 (plan 01) | ⬜ pending |
| 163-04 T1 · 163-05 T2 · 163-10 T2 | 04/05/10 | 2/3/5 | TEN-02 | T-163-01 | `SET LOCAL ROLE authenticated` + both GUC forms makes auth.uid() resolve; user B reads 0 of user A's rows (asyncpg) | integration (two-user) | `pytest tests/integration/test_163_leak_asyncpg.py -x` | ❌ W0 (plan 04) | ⬜ pending |
| 163-04 T1 · 163-05 T2 · 163-10 T2 | 04/05/10 | 2/3/5 | TEN-02 | T-163-01 | per-request user-JWT client (anon key + Bearer, no singleton mutation) reads 0 of A's rows (supabase-py) | integration (two-user) | `pytest tests/integration/test_163_leak_supabase.py -x` | ❌ W0 (plan 04) | ⬜ pending |
| 163-04 T2 · 163-05 T2 · 163-10 T2 | 04/05/10 | 2/3/5 | TEN-02 | T-163-01 | role-swap-noop detector: WITHOUT `SET LOCAL ROLE` → all rows (BYPASSRLS); WITH it → own only; spoof/fail-closed → 0 | integration | `pytest tests/integration/test_163_role_swap.py -x` | ❌ W0 (plan 04) | ⬜ pending |
| 163-03 T3 · 163-05 T2 | 03/05 | 2/3 | TEN-01 | T-163-02 | each cluster's SELECT/INSERT/UPDATE/DELETE enforces membership + preserves global/system branches | integration (per bundle) | `pytest tests/integration/test_163_rls_documents.py tests/integration/test_163_rls_dm.py tests/integration/test_163_rls_chat.py tests/integration/test_163_rls_skills.py tests/integration/test_163_rls_workflow_eval.py tests/integration/test_163_rls_identity_audit.py -x` | ❌ W0 (plan 03) | ⬜ pending |
| 163-02 T2 · 163-05 T2 | 02/05 | 2/3 | TEN-04 | T-163-BF | `document_chunks`/`skill_embeddings` `org_id` backfill zero-NULL + NOT NULL + btree(org_id); HNSW/GIN untouched | integration/SQL | `pytest tests/integration/test_163_ten04_backfill.py -x` | ❌ W0 (plan 02) | ⬜ pending |
| 163-10 T1 | 10 | 5 | TEN-04 | T-163-07 | CONCUR-01 <1s cross-tab-GET-during-streaming stays green with the client swap live (measures SET-LOCAL RTT) | integration (perf gate) | `pytest tests/integration/test_058_concurrency.py -x` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** no 3 consecutive tasks lack an automated verify — every plan (01–10) has at least one `<automated>` command; the two operator-gated tasks (163-05 T1 apply, 163-10 T2/T3) are each immediately backed by an automated `test_163_*` / `test_058` command.

---

## Wave 0 Requirements

- [ ] `tests/integration/test_163_factories.py` — factories smoke (plan 01)
- [ ] `tests/integration/conftest.py` fixtures + `_rls_harness.py` — two seeded users in two orgs + `pg_get_functiondef('auth.uid()')` probe + shared SET-LOCAL/supabase-txn helpers (plan 01)
- [ ] `tests/integration/test_163_ten04_backfill.py` — `org_id` backfill + btree(org_id) index assertions (plan 02)
- [ ] `tests/integration/test_163_rls_<cluster>.py` ×6 — documents / dm / chat / skills / workflow_eval / identity_audit (plan 03)
- [ ] `tests/integration/test_163_leak_asyncpg.py` — TEN-02 asyncpg two-user leak (the D-08 core) (plan 04)
- [ ] `tests/integration/test_163_leak_supabase.py` — TEN-02 supabase-py two-user leak (plan 04)
- [ ] `tests/integration/test_163_role_swap.py` — role-swap-noop / claims-spoof / fail-closed detector (plan 04)
- [ ] The Phase-162.5 Deep-Mode byte-identical harness — already passed (D-01 precondition; NOT re-run here)

---

## Manual-Only Verifications

| Behavior | Requirement | Task | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| **D-08 live two-user leak test** — user B provably reads 0 of user A's rows across BOTH DB paths on the live local DB, with fail-loud `auth.uid()` preflight + positive control + role-swap-noop diff + spoof/fail-closed cases + GUC-variant arbitration | TEN-01, TEN-02 | 163-10 T2 | The crux gate — the exact `SET LOCAL`/GUC semantics must be proven against the running DB, not docs (research base MEDIUM-confidence). Operator starts the backend (`feedback_user_starts_backend`). | Operator runs the authored harness once; reads a pass/fail scoreboard. Preflight MUST assert `SELECT auth.uid()` == the user's UUID before any isolation assert (else a wrong GUC variant false-passes at "0 rows"). |
| **SC#10 4-axis UAT** — cross-provider × multi-tool × parallel-thread × long-message, Deep-Mode byte-identical with the swap live + tier-parity (D-11) | D-09, D-11 | 163-10 T3 | Live cross-provider streaming behavior + felt-experience; Chrome-MCP/operator-driven (`browser-uat-user-driven`). | Operator exercises OpenAI / Anthropic / Google / OpenRouter with a 2+-tool prompt, a parallel-thread pair, and a ≥50-message thread; confirms no regression + org context rides the request seam only + live per-org isolation + preserved global-share + no hardcoded URL/key/role. |
| **CONCUR-01 <1s perf gate** — benchmark before merge | TEN-04 | 163-10 T1 | The real risk is the SET-LOCAL round-trip overhead the swap adds; must be measured against the binding gate on the live DB. | Run `test_058_concurrency.py` with the swap live; confirm cross-tab-GET-during-streaming stays <1s. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (task IDs bound above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the 8 new test files + conftest fixtures + `_rls_harness.py`)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (per-task map bound to real task IDs)

**Approval:** ready — bound to the 10-plan / 5-wave structure at plan-phase.
