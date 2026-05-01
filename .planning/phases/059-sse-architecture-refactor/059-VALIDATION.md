---
phase: 059
slug: sse-architecture-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 059 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `059-RESEARCH.md` § Validation Architecture (pp. 673-742). Invariants I1–I4 are binding for plan acceptance criteria.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest>=8.0.0` + `pytest-asyncio>=0.24.0` (already pinned in `backend/requirements.txt`) |
| **Config file** | `backend/tests/conftest.py` (env vars + dependency overrides) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py -v` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds (single-test fast path); ~2 min full integration suite |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/integration/test_059_disconnect.py tests/integration/test_058_concurrency.py -x`
- **After every plan wave:** Run `cd backend && venv/Scripts/python -m pytest tests/integration/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green: `cd backend && venv/Scripts/python -m pytest tests/ -v`
- **Max feedback latency:** 30 seconds (per-task quick run)

---

## Per-Task Verification Map

> Final mapping is the planner's responsibility; this row stub gives the contract for plan checker verification.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-W0-fixtures | TBD | 0 | CONCUR-02 | T-059-Q1 (queue overflow) | Mock-LLM helper exists; counters expose `count_after(t)` | unit | `pytest tests/integration/test_059_disconnect.py::test_normal_stream_unchanged -v` | ❌ W0 | ⬜ pending |
| TBD-W1-agent-runner | TBD | 1 | CONCUR-02 | T-059-S1 (sentinel never sent) | `agent_runner` task always emits sentinel `None` in outermost `finally` | integration | `pytest tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v` | ❌ W0 | ⬜ pending |
| TBD-W1-consumer | TBD | 1 | CONCUR-02 | — | Consumer cancels producer task on disconnect; awaits task drain | integration | (same as above) | ❌ W0 | ⬜ pending |
| TBD-W1-shielded-persist | TBD | 1 | CONCUR-02 / STREAM-01 regression | T-059-P1 (persist failure on cancel) | `asyncio.shield(_persist_assistant_message())` runs to completion under `task.cancel()` | integration | `pytest tests/integration/test_059_disconnect.py::test_partial_response_persisted_on_cancel -v` (or single-test invariant I4) | ❌ W0 | ⬜ pending |
| TBD-W1-cancelled-raise | TBD | 1 | D-059-02 | — | `threads.py` `except asyncio.CancelledError: raise` (not `pass`) | structural | `grep -A1 "except asyncio.CancelledError" backend/app/api/threads.py \| grep -q "raise"` | ✅ exists | ⬜ pending |
| TBD-W2-delete-responses | TBD | 2 | D-059-05 | — | `backend/app/responses.py` deleted | structural | `[ ! -f backend/app/responses.py ] && echo OK \|\| echo FAIL` | n/a | ⬜ pending |
| TBD-W2-058-regression | TBD | 2 | D-059-07 | — | 058's cross-tab GET test still passes < 1.0s | integration | `pytest tests/integration/test_058_concurrency.py -v` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_059_disconnect.py` — new file. Two tests:
  - `test_agent_task_cancels_on_disconnect` (D-059-06 merge gate; covers I1+I2+I3+I4 in one)
  - `test_normal_stream_unchanged` (smoke — happy-path stream still emits `delta`/`done`/`stream_end` events as v2.4 did)
- [ ] Slow-mock-LLM helper: reuse 058's `_fast_chunks()` pattern but parameterise to slow chunks (`asyncio.sleep(0.3)` between each). Inline in `test_059_disconnect.py` or extract to a shared `tests/integration/_sse_helpers.py` (planner's discretion).
- [ ] LLM-call counter helper: instrument `create_adaptive_streaming_chat` (and Anthropic `stream_anthropic`) via patch to count invocations and expose `count_after(t)` to assertions.
- [ ] Add `pytest-timeout>=2.4.0` to `backend/requirements.txt` and decorate the disconnect test with `@pytest.mark.timeout(10)` to bound Pitfall 4/7 hangs.
- [ ] Framework install: none additional — `sse-starlette==2.4.1` is the only new package.

---

## Validation Invariants (Nyquist Dimension 8)

| # | Invariant | Test assertion | Rationale |
|---|-----------|----------------|-----------|
| I1 | **Cancellation latency ≤ 1.0s** from disconnect to `task.done()` / `task.cancelled()` | `t_cancel = time.monotonic() - t_disconnect; assert t_cancel < 1.0` | CONCUR-02 success criterion. |
| I2 | **No NEW LLM calls** fire after disconnect timestamp | `assert llm_call_counter.count_after(t_disconnect) == 0` | CONCUR-02 success criterion verbatim. |
| I3 | **Queue sentinel ordering** — consumer's last yielded event before exit is the producer's last queued event (sentinel reached, not a hang) | streamed lines list non-empty AND no error markers AND test does not time out | Pitfall 4 guard. |
| I4 | **Persist completion on cancel** — after disconnect, the messages table contains an assistant message row for `thread_id` with `role='assistant'` and non-null `content` | `mock_supabase.table('messages').insert.call_args_list` includes one call with `role='assistant'` | STREAM-01/03 regression guard (D-059-07 secondary). |

**Single-test command (preferred — runs all four invariants):**

```bash
cd backend && venv/Scripts/python -m pytest \
  tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect -v -s
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-tab DevTools disconnect drill | CONCUR-02 (D-059-08) | End-to-end real-browser timing only meaningful with a real Chromium; CI runs httpx ASGI which simulates `http.disconnect` cleanly but doesn't exercise the proxy/load-balancer ping path | Open Thread A streaming, close the tab. Watch backend logs for `CancelledError` within 1s. Confirm no further LLM API calls fire. Format mirrors `058-VERIFICATION.md`. Output to `059-VERIFICATION.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
