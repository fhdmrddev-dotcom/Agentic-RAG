---
phase: 061
slug: run-backed-streaming-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 061 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest>=8.0.0` + `pytest-asyncio>=0.24.0` + `pytest-timeout>=2.4.0` |
| **Config file** | `backend/pytest.ini` (`asyncio_mode = auto`, `testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/pytest tests/integration/test_061_producer_survives_disconnect.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/pytest tests -q` |
| **Estimated runtime** | ~30s (quick) / ~3 min (full backend suite) |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/integration/test_061_*.py -x` (~5 tests, target <30s)
- **After every plan wave:** Run `pytest backend/tests -q` (full backend suite)
- **Before `/gsd-verify-work`:** Full backend suite + `e2e/tests/060-thread-race.spec.ts` (Playwright) must be green
- **Max feedback latency:** 30 seconds (per-task), 180 seconds (per-wave)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-01 | TBD | 0 | STREAM-04 (SC#1) | — | XADD on every SSE event keyed by `run:{run_id}` (single-field `data` payload) | unit | `pytest backend/tests/unit/test_061_emit_helper.py::test_emit_xadds_data_field -x` | ❌ W0 | ⬜ pending |
| TBD-02 | TBD | 0 | Pitfall 1 guard | — | Consumer advances `last_id` past `$` (no skipped events) | unit | `pytest backend/tests/unit/test_061_consumer.py::test_xread_advances_last_id -x` | ❌ W0 | ⬜ pending |
| TBD-03 | TBD | 0 | STREAM-04 (SC#6) | T-061-05 / Info-Disclosure | `/health` returns `{"redis": "ok" \| "unreachable"}`; never logs full DSN | unit | `pytest backend/tests/unit/test_health.py::test_health_includes_redis_status -x` | ❌ W0 | ⬜ pending |
| TBD-04 | TBD | 0 | STREAM-04 (SC#2 + SC#3) | T-061-04 / DoS | Killing consumer does NOT kill producer; XLEN grows post-disconnect; terminal sentinel lands | integration | `pytest backend/tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect -x` | ❌ W0 (D-061-15) | ⬜ pending |
| TBD-05 | TBD | 0 | STREAM-04 (SC#4) | T-061-03 / DoS | EXPIRE 600 on completed-bucket / 60 on failed-bucket | integration | `pytest backend/tests/integration/test_061_ttl.py::test_completed_run_expires_600s -x` AND `::test_failed_run_expires_60s -x` | ❌ W0 | ⬜ pending |
| TBD-06 | TBD | 0 | STREAM-04 (SC#5) | T-061-02 / Info-Disclosure | `runs` row INSERTed at start, UPDATEd in producer's `finally` | integration | `pytest backend/tests/integration/test_061_runs_table.py::test_runs_lifecycle_row -x` | ❌ W0 | ⬜ pending |
| TBD-07 | TBD | 0 | STREAM-04 (SC#5b) | T-061-01 / Info-Disclosure | RLS on `runs` enforced (`auth.uid() = user_id` SELECT-only) | integration | `pytest backend/tests/integration/test_061_runs_table.py::test_rls_select_own_only -x` | ❌ W0 | ⬜ pending |
| TBD-08 | TBD | 0 | D-061-01 invariant | T-061-03 / DoS | 120s `asyncio.timeout` fires → terminal error sentinel → `runs.status='failed' error='hard_timeout'` | integration | `pytest backend/tests/integration/test_061_hard_timeout.py::test_120s_timeout_fires_full_finally -x` | ❌ W0 | ⬜ pending |
| TBD-09 | TBD | 0 | STREAM-04 (SC#7b) / D-061-16 | — | 059 disconnect test INVERTED — producer SURVIVES on disconnect | integration | `pytest backend/tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect -x` | ✅ rewrite | ⬜ pending |
| TBD-10 | TBD | regression | STREAM-04 (SC#7) | — | 058 cross-tab GET <1s STILL passes | regression | `pytest backend/tests/integration/test_058_concurrency.py -x` | ✅ exists | ⬜ pending |
| TBD-11 | TBD | regression | STREAM-04 (SC#8) | — | 060 e2e thread-race STILL passes | regression | `npx playwright test e2e/tests/060-thread-race.spec.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are TBD until planner assigns them — the planner MUST map each row's automated command into a task's `<acceptance_criteria>` and emit a stable Task ID into this table during planning.*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_061_emit_helper.py` — covers `_emit()` XADD shape (single-field `data` payload, type discriminator)
- [ ] `backend/tests/unit/test_061_consumer.py` — covers two-mode XREAD loop, `last_id` advancement, terminal-sentinel break
- [ ] `backend/tests/unit/test_health.py` — extend with Redis-ping assertion (file may exist; verify)
- [ ] `backend/tests/integration/test_061_producer_survives_disconnect.py` — D-061-15 binding gate (slow-mock-LLM, abort consumer after 1 token, assert XADD count grows + terminal sentinel + `runs.status='completed'`)
- [ ] `backend/tests/integration/test_061_ttl.py` — covers SC#4 (600s completed / 60s failed EXPIRE)
- [ ] `backend/tests/integration/test_061_runs_table.py` — covers SC#5 (Postgres lifecycle row + RLS SELECT-only)
- [ ] `backend/tests/integration/test_061_hard_timeout.py` — covers D-061-01 (120s `asyncio.timeout` end-to-end with full `finally` ordering)
- [ ] Rewrite `backend/tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect` to assert producer SURVIVES (D-061-16). File header docstring references D-v2.5-08 + 061 phase as the source of new contract.
- [ ] `backend/tests/conftest.py` — add `redis_client` function-scoped fixture (per Pitfall 6 — pytest-asyncio per-function loop scope) + session-end FLUSHDB autouse fixture
- [ ] CI workflow gains `docker compose -f docker-compose.dev.yml up -d redis` before pytest (mirrors Supabase preamble)
- [ ] `redis>=5.2,<8` added to `backend/requirements.txt`
- [ ] `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` — manual two-tab DevTools timing checklist mirroring 058/059 format; document the contract inversion explicitly

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-tab DevTools timing checklist | STREAM-04 (foundation) | Human visual confirmation that the SSE event sequence renders correctly across tabs once the Redis-backed pipeline is live | Open Tab A: send a message; Tab B: open DevTools Network tab while Tab A's stream is mid-flight, navigate Tab A away, refresh Tab A — confirm assistant message body persists (058 cross-tab pattern; full instructions in 061-VERIFICATION.md) |
| Contract inversion notice | D-061-16 | Reviewer must understand `test_059_disconnect.py` change is intentional, not a regression | Read `061-VERIFICATION.md` §"Contract Inversion" + commit message body for `test_059_disconnect.py` rewrite; confirm both reference D-v2.5-08 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (11 new files / rewrites listed above)
- [ ] No watch-mode flags (all commands are one-shot, `-x` for fail-fast)
- [ ] Feedback latency < 30s per task / < 180s per wave
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes Task IDs and Wave 0 closes)

**Approval:** pending
