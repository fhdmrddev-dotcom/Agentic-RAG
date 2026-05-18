---
phase: 075
slug: seed-008-tool-args-progress-polish-bundle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 075 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `075-RESEARCH.md` §Validation Architecture (lines 1007-1153).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (backend); vitest (frontend) |
| **Config file** | `backend/pytest.ini`, `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_075_*.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~30 seconds (quick), ~3-5 min (full) |

Shared fixture: `backend/tests/integration/conftest.py` provides `_reset_redis_singleton` autouse fixture (Phase 074 D-074-11) — auto-protects all 3 new test files.

---

## Sampling Rate

- **After every task commit:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_075_*.py -x -q` (~30s)
- **After every plan wave:** `cd backend && venv/Scripts/python -m pytest tests/ -q` (full backend suite; ~3-5 min)
- **Before `/gsd-verify-work`:** Full suite green + 3 Chrome MCP UAT scenarios green (SC #1 latency timing, BUG-260518-01 closure, BUG-260514-03 closure)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 075-01-XX | 01 | 1 | POLISH-SEED-008-01 | T-062-01 mirror | Cross-user → 404 not 403; ownership SELECT first | integration | `pytest tests/integration/test_075_snapshot.py::test_cross_user_returns_404 -x` | ❌ W0 | ⬜ pending |
| 075-01-XX | 01 | 1 | POLISH-SEED-008-01 | T-073-04 / D-074-03 | Identifier-only log format strings; no args content in logs | integration | `pytest tests/integration/test_075_snapshot.py::test_snapshot_returns_messages_active_runs_cursors -x` | ❌ W0 | ⬜ pending |
| 075-01-XX | 01 | 1 | POLISH-SEED-008-01 | D-062-13 mirror | Redis-down → 503 + Retry-After: 10 (no partial-degraded shape) | integration | `pytest tests/integration/test_075_snapshot.py::test_redis_down_returns_503 -x` | ❌ W0 | ⬜ pending |
| 075-01-XX | 01 | 1 | POLISH-SEED-008-01 | — | `_enrich_messages_with_runs` extraction preserves existing /messages behavior (regression) | integration | `pytest tests/integration/test_063_1_messages_runs_join.py -x` | ✅ exists | ⬜ pending |
| 075-01-XX | 01 | 1 | POLISH-SEED-008-01 (SC #1) | — | Cold-cache thread-switch latency reduced ≥50% | manual (Chrome MCP) | `performance_start_trace → reload → performance_stop_trace` at `http://localhost:5173/` | manual | ⬜ pending |
| 075-01-XX | 01 | 1 | BUG-260518-01 | — | Resume button stays hidden during >30s sandbox cell | manual (Chrome MCP UAT) | Drive long sandbox cell at `http://localhost:5173/` with `fhdmrd@gmail.com / 123456` | manual | ⬜ pending |
| 075-02-XX | 02 | 1 | POLISH-SEED-008-02 | — | 5-step printer produces ≥3 distinct `code_stdout` events ≥1s apart | integration (real sandbox) | `pytest tests/integration/test_075_code_stdout_progressive.py::test_five_step_printer_produces_progressive_events -x` | ❌ W0 | ⬜ pending |
| 075-02-XX | 02 | 1 | POLISH-SEED-008-02 | — | Monotonic `captured_at` per event | integration | `pytest tests/integration/test_075_code_stdout_progressive.py::test_captured_at_monotonic -x` | ❌ W0 | ⬜ pending |
| 075-02-XX | 02 | 1 | POLISH-SEED-008-02 | — | No duplicate emit at completion | integration | `pytest tests/integration/test_075_code_stdout_progressive.py::test_no_duplicate_emit_at_completion -x` | ❌ W0 | ⬜ pending |
| 075-02-XX | 02 | 1 | POLISH-SEED-008-02 (SC #4) | — | `code_executing` heartbeat preserved on silent-only workload (D-075-08 silent-window-only invariant) | integration | `pytest tests/integration/test_075_code_stdout_progressive.py::test_silent_workload_emits_heartbeat -x` | ❌ W0 | ⬜ pending |
| 075-02-XX | 02 | 1 | BUG-260514-03 | — | Bottom indicator stays animated during silent matplotlib renders | manual (Chrome MCP UAT) | Long pptx cell screenshot at t=30s/60s/120s | manual | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 | — | ≥2 progress events fire at 5KB / 10KB boundaries during streaming | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_fires_on_5kb_boundary -x` | ❌ W0 | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 | — | `args_so_far` ≤ 5120 bytes per event (sliding-window tail per D-075-09) | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_args_so_far_bounded -x` | ❌ W0 | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 | — | `total_args_bytes_so_far` is monotonically non-decreasing | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_total_bytes_monotonic -x` | ❌ W0 | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 | — | execute_code skipped (D-075-11 filter; v3.0 Skill Studio re-enables) | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_skipped_for_execute_code -x` | ❌ W0 | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 | — | STRUCTURED-mode skipped (D-075-11 filter; no streaming accumulator to walk) | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_tool_args_progress_skipped_in_structured_mode -x` | ❌ W0 | ⬜ pending |
| 075-03-XX | 03 | 1 | POLISH-TOOL-PROG-01 (Anthropic) | — | Anthropic `input_json_delta` accumulator emits boundary events (provider-parity) | integration | `pytest tests/integration/test_075_tool_args_progress.py::test_anthropic_path_emits_on_boundary -x` | ❌ W0 | ⬜ pending |
| 075-02-XX | 02 | 1 | POLISH-SEED-008-02 (frontend) | — | Existing StreamsProvider tests stay green post-edit | unit | `cd frontend && npm run test -- StreamsProvider.test.tsx` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_075_snapshot.py` — covers POLISH-SEED-008-01 backend half + BUG-260518-01 backend half
- [ ] `backend/tests/integration/test_075_code_stdout_progressive.py` — covers POLISH-SEED-008-02 + SC #4 invariant
- [ ] `backend/tests/integration/test_075_tool_args_progress.py` — covers POLISH-TOOL-PROG-01 (OpenAI + Anthropic paths, both filters)
- [ ] Framework install: none — `pytest`, `pytest-asyncio`, `httpx`, `ASGITransport`, `redis-py async`, `docker SDK` already installed in `backend/venv`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cold-cache thread-switch latency drops ≥50% (SC #1) | POLISH-SEED-008-01 | Perceived latency requires real browser timing; integration test cannot measure paint timeline | Chrome DevTools MCP: navigate to `http://localhost:5173/`, log in as `fhdmrd@gmail.com / 123456`, `performance_start_trace` → F5 reload → click thread with active runs → `performance_stop_trace`. Compare before-cutover (3 calls) and after-cutover (1 call) `loadEventEnd`-relative timing. |
| Resume button stays hidden during long sandbox cell (BUG-260518-01) | POLISH-SEED-008-01 | Requires real >30s sandbox execution + frontend reconcile fetch; mocking defeats the bug | Chrome MCP: drive prompt "build a 30-slide deck on this 50-page PDF" → watch assistant message during execution → Resume button MUST NOT appear → bottom indicator MUST stay animated → final result MUST paint cleanly when sandbox returns. |
| Bottom indicator stays animated through silent matplotlib renders (BUG-260514-03) | POLISH-SEED-008-02 | Visual-timing assertion requires screenshot diff over time window | Same long pptx-generation cell as above → Chrome MCP `take_screenshot` at t=30s, t=60s, t=120s → indicator text MUST be visible at all three timestamps ("Running code…" or "Running code… (N seconds)"). |
| Anthropic-path `tool_args_progress` provider-parity (live UAT) | POLISH-TOOL-PROG-01 | Real LLM response timing — integration test uses synthetic deltas; production UAT confirms accumulator triggers under real Anthropic streams | With `active_provider=anthropic` model `claude-sonnet-4-6`, drive a prompt that produces a >5KB `analyze_document` tool call. Verify backend logs show boundary emit (`tool_args_progress tool_index=N size=...`) and SSE replay via `GET /runs/{rid}/stream?since=0` contains the events between `tool_preparing` and `tool_start`. |

---

## Validation Dimensions Coverage for the 4 SCs

| SC # | Dimension | Coverage Method |
|------|-----------|-----------------|
| #1 (latency ≥50% reduction) | **Performance / timing** | Chrome DevTools MCP performance trace comparison before/after cutover. Integration test alone cannot measure perceived latency. |
| #1 (correctness) | **Correctness / shape** | Integration test on `/snapshot` response shape + auth posture (3 sub-tests). |
| #1 (regression — `_enrich_messages_with_runs` extraction) | **Regression** | Existing `test_063_1_messages_runs_join.py` MUST stay green (specifies the helper's exact behavior). |
| #1 (BUG-260518-01 closure) | **Integration + manual UAT** | Chrome MCP UAT against >30s sandbox cell — Resume button MUST stay hidden. |
| #2 (5-step printer ≥3 events ≥1s) | **Integration (real sandbox)** | New test drives a real Docker container — pytest fixtures launch sandbox manager. Real-sandbox tests already exist (`test_065_*`); pattern is verified. |
| #2 (monotonic captured_at) | **Correctness** | Same file, separate assertion. |
| #2 (no duplicate emit) | **Correctness / regression** | Same file — protects against D-075-07 deletion regression. |
| #2 (BUG-260514-03 closure) | **Manual UAT** | Chrome MCP screenshot at t=30s/60s/120s during long pptx generation. |
| #3 (tool_args_progress 5KB boundary) | **Integration** | Mock OpenAI/Anthropic deltas with big_args payload; assert event count + payload shape. |
| #3 (execute_code skipped) | **Negative-assertion integration** | Same scaffold, name="execute_code"; assert zero progress events. |
| #3 (STRUCTURED skipped) | **Negative-assertion integration** | Calling_mode = STRUCTURED branch; assert zero progress events. |
| #4 (heartbeat preserved) | **Regression / integration** | Silent-only workload (`time.sleep(5)` no prints) — assert ≥4 `code_executing` events in the 5s window. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 and per-task acceptance criteria are mapped by the planner)

**Approval:** pending
