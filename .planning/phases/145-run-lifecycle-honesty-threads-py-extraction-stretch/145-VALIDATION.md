---
phase: 145
slug: run-lifecycle-honesty-threads-py-extraction-stretch
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
approved: 2026-07-09
---

# Phase 145 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `145-RESEARCH.md` → "## Validation Architecture" (Nyquist).
> Task IDs (`145-NN-MM`) are assigned by the planner; rows below are keyed to the
> decision/requirement they prove until the planner binds them to concrete tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | `pytest` + `pytest-asyncio` (`@pytest.mark.asyncio`) — pattern in `backend/tests/test_run_reconciler.py` |
| **Framework (frontend)** | `vitest` + `@testing-library`, `vi.hoisted`/`vi.mock('@/lib/api')`, `vi.useFakeTimers()` — pattern in `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` |
| **Config file** | backend: `backend/pytest.ini` / venv; frontend: `frontend/vitest.config.*` (both exist — no Wave 0 install) |
| **Quick run (backend)** | `cd backend && venv/Scripts/python -m pytest tests/test_run_lifecycle.py tests/test_run_reconciler.py -x` |
| **Quick run (frontend)** | `cd frontend && npx vitest run src/__tests__/providers/StreamsProvider.*.test.ts` |
| **Full suite (backend)** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | quick ~10–20s; full backend ~2–4 min |

---

## Sampling Rate

- **After every task commit:** run the relevant quick command (backend or frontend).
- **After every plan wave:** run the full backend suite + the frontend StreamsProvider suite.
- **Before `/gsd:verify-work`:** full suite green + the live SC#10 UAT matrix (below) exercised.
- **Max feedback latency:** ~20s (quick), ~4 min (full).

---

## Per-Task Verification Map

> Keyed by decision until the planner assigns `145-NN-MM` task IDs. `File Exists` = whether
> the test file is present today (❌ W0 = a Wave 0 gap to author before the behavior task).

| Decision / Req | Behavior | Test Type | Automated Command | File Exists | Status |
|----------------|----------|-----------|-------------------|-------------|--------|
| D-145-02 / 09 (FND-01) | `register_run_start` co-writes `runs.status='streaming'` + ZADD `runs:active` atomically | unit | `pytest tests/test_run_lifecycle.py::test_register_cowrites_status_and_active -x` | ❌ W0 | ⬜ pending |
| D-145-02 / 09 (FND-01) | `finalize_run_terminal` routes status via `db.runs.finalize_run` + ZREM ×2 atomically | unit | `pytest tests/test_run_lifecycle.py::test_finalize_cowrites_terminal_and_zrem -x` | ❌ W0 | ⬜ pending |
| D-145-06 (FND-01) | stale stream (old `last-generated-id`) + non-terminal PG row → terminalized `failed` | unit | `pytest tests/test_run_reconciler.py::test_stale_stream_flipped_to_failed -x` | extend | ⬜ pending |
| D-145-06 (FND-01) | fresh stream (recent `last-generated-id`) → NOT flipped | unit | `pytest tests/test_run_reconciler.py::test_fresh_stream_not_flipped -x` | extend | ⬜ pending |
| D-145-06 (FND-01) | **crux:** run PRESENT in `runs:active` mirror BUT stale stream → STILL flipped | unit | `pytest tests/test_run_reconciler.py::test_present_in_active_but_stale_is_orphan -x` | ❌ W0 | ⬜ pending |
| D-145-06 (FND-01) | missing stream (`no such key`) + non-terminal → orphan → flipped | unit | `pytest tests/test_run_reconciler.py::test_missing_stream_is_orphan -x` | ❌ W0 | ⬜ pending |
| D-145-06 / Pitfall 3 | `cap_paused` excluded from the **periodic** sweep (not killed) | unit | `pytest tests/test_run_reconciler.py::test_cap_paused_not_swept_periodically -x` | ❌ W0 | ⬜ pending |
| D-145-08 (FND-01) | periodic sweep `SET NX` single-flight — loser tick returns 0 | unit | `pytest tests/test_run_reconciler.py::test_set_nx_guard_returns_zero_when_held -x` | reuse | ⬜ pending |
| Pitfall 6 | Redis error on age read → SKIP (never false-flip) | unit | `pytest tests/test_run_reconciler.py::test_redis_error_skips_not_flips -x` | ❌ W0 | ⬜ pending |
| D-145-03 / 04 (FND-01) | watchdog silently finalizes on a terminal snapshot (fake timer, N elapsed) | unit | `vitest run …StreamsProvider.watchdog…::watchdog silent-finalizes on terminal` | ❌ W0 | ⬜ pending |
| D-145-03 (FND-01) | watchdog no-ops while snapshot still `streaming` | unit | `vitest run …::watchdog no-ops while streaming` | ❌ W0 | ⬜ pending |
| U7 / Pattern 2 (FND-01) | reconcile **clears** `streamingThreads` when `active_runs` empty (Direction A Stop clears) | unit | `vitest run …::reconcile clears streamingThreads on terminal snapshot` | ❌ W0 | ⬜ pending |
| U7 / Pattern 2 (FND-01) | reconcile **re-adds** `streamingThreads` when a still-active run is reconciled (Direction B Stop reappears) | unit | `vitest run …::reconcile re-adds streamingThreads on active snapshot` | ❌ W0 | ⬜ pending |
| U7 / Pitfall 1 | in-flight-send guard: reconcile never deletes a thread with a pending send | unit | `vitest run …::reconcile respects sendingThreadsRef guard` | ❌ W0 | ⬜ pending |
| D-145-10 (FND-01) | transient reattach RESTORES `streamingThreads` (no Stop→Send / feedback flip mid-run) | unit | `vitest run …StreamsProvider.transient…::transient reattach keeps streamingThreads` | extend | ⬜ pending |
| D-145-14 (FND-01) | cancel happy-path → `finalize_run_terminal('cancelled')` + ZREM ×2 | unit | `pytest tests/test_cancel_run.py::test_cancel_finalizes_and_zrems -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_run_lifecycle.py` — NEW: atomic co-writer tests (`register_run_start`, `finalize_run_terminal`) asserting status-write AND Redis ZADD/ZREM fire together for the same `run_id` (D-145-02 / 09).
- [ ] Extend `backend/tests/test_run_reconciler.py` `_FakeRedis` with `xinfo_stream(key)` (returns `{"last-generated-id": b"<ms>-0"}`, raises `ResponseError('no such key')` when absent) and `time()` (fixed `(sec, usec)`); add stale / fresh / missing / present-but-stale / cap_paused / redis-error cases (D-145-06, Pitfall 3/6).
- [ ] `frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts` — NEW (or extend `.transient.test.ts`): fake-timer watchdog + `streamingThreads` reconcile-derive (both directions) + in-flight-send guard (D-145-03 / 04, U7, Pitfall 1).
- [ ] `backend/tests/test_cancel_run.py` — NEW if absent: cancel happy-path routes through `finalize_run_terminal` parity (D-145-14).

*Existing infra covers the harness (pytest-asyncio + in-memory fakes on the backend, vitest + `vi.mock('@/lib/api')` on the frontend). No framework install needed.*

---

## Manual-Only Verifications — Live SC#10 UAT (D-145-13)

> Authored here (NOT as PLAN tasks) per the UAT scoreboard recipe. Operator drives; Chrome MCP / manual clicks + psycopg2 (:54322) + Redis observe. The desync was observed cross-provider, so both directions must be exercised across providers. **The LIVE repro (D-145-11) is the FIRST plan task and precedes any fix.**

| Behavior | Axis | Why Manual | Test Instructions |
|----------|------|------------|-------------------|
| Direction A self-heals with tab open | Cross-provider (OpenAI) + both-directions | Requires a real missed-terminal SSE + a live browser tab; timing/UX can't be asserted in a unit test | Complete a run (OpenAI), keep the tab open, do NOT reload. Confirm the Stop button clears and the message finalizes within N (~20s) with no phantom "running". Repro case: thread `f308d617…` run `9f69ddf1`. |
| Direction B corrects a dead producer | Cross-provider (DeepSeek + MiniMax) + both-directions | Requires a real producer death (`--reload` restart / broken SSE) across the multi-worker runtime | Start a stream (DeepSeek, then MiniMax — MiniMax is off the openai_compat path), kill/restart the backend mid-stream. Confirm the sweep terminalizes the dead producer (`runs.status` → `failed`, ZREM from `runs:active`) and the Stop reflects reality. Repro: DeepSeek run `2075b364` / MiniMax run `3bd13487`. |
| Live run shows a working Stop that actually cancels | Cancel (D-145-14) — per provider | Real cross-provider producer cancel; verify DB + Redis side effects | Stop a genuinely-live run per provider → confirm `runs.status='cancelled'` + ZREM from `runs:active`. **Also note whether the wrong-worker case reproduces** (Open Q1, WORKER_COUNT=2) — flag only, do NOT fix in 145. |
| Multi-tool run does not trip the watchdog/sweep | Multi-tool | Self-heartbeating code-exec must NOT be mistaken for a dead stream | Run a prompt using `search_documents` + `execute_code`; confirm neither the watchdog nor the sweep terminalizes it (the `code_executing` heartbeat keeps the stream fresh). |
| Parallel-thread isolation | Parallel-thread | Per-thread `streamingThreads` Set must not cross-contaminate | Thread A streaming while Thread B accepts a new prompt; confirm the watchdog / `streamingThreads` reconcile stays per-thread (A's state never flips B and vice versa). |
| Long silent-reasoning gap does not false-kill | Long-message / long-gap | Confirms STALE_TIMEOUT=2400s + short watchdog N are correctly separated | A silent-reasoning run (o-series or `*-pro`) with a > 60s first-token gap → watchdog no-ops (re-fetches, sees still-streaming), sweep does not kill. |

---

## Validation Sign-Off

- [x] All behavior tasks have an `<automated>` verify or a Wave 0 dependency *(plan-checker confirmed 2026-07-09 — every task carries a concrete `<automated>` command; Wave 0 gaps authored inline as RED→GREEN task pairs)*
- [x] Sampling continuity: no 3 consecutive tasks without automated verify *(plan-checker Dimension 8)*
- [x] Wave 0 covers all ❌ MISSING references above *(authored as tasks in 145-02/03/04/05; files become ✅ during execution)*
- [x] No watch-mode flags in any command
- [x] Feedback latency < 20s (quick) / < 4 min (full)
- [ ] Live SC#10 UAT matrix exercised (both directions × cross-provider × parallel-thread × long-gap × cancel) *(runs during /gsd:verify-work — operator-driven)*
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete: true` — flip once the Wave 0 test files are authored + green during execution

**Approval:** approved 2026-07-09 (plan-phase checker: 0 blockers)
