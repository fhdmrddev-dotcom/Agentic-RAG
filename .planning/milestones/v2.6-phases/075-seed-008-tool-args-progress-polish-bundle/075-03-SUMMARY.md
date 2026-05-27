---
phase: 075-seed-008-tool-args-progress-polish-bundle
plan: 03
subsystem: sse-producer
tags: [sse, tool-args-progress, openai, anthropic, backend-only, provider-parity]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming
    provides: _emit XADD wrapper (D-061-10) — reused unchanged for the new tool_args_progress event type
  - phase: 067.1-streaming-render-storage-fixes
    provides: drain-into-queue parity helper (_drain_stream_with_close_on_cancel) + close_fn=stream.close binding that surfaced the _ClosableIterator test-shim requirement
  - phase: 073-token-col-asyncpg-hot-paths
    provides: real-Postgres binding-gate fixture pattern (test_073_concurrency.py:67-135) — copied for the Plan 03 seeded_thread fixture
  - phase: 074-seed-009-seed-011-polish
    provides: hoisted _reset_redis_singleton autouse fixture (D-074-11) + T-073-04 identifier-only log format strings (D-074-03)
  - phase: 075-01-snapshot-endpoint
    provides: closure of BUG-260518-01 + independent code zones — no overlap with Plan 03's :1666-1738 OpenAI accumulator
  - phase: 075-02-line-by-line-stdout
    provides: closure of POLISH-SEED-008-02 + independent code zones — no overlap with Plan 03's :1666-1738 OpenAI / :199-235 Anthropic accumulators
provides:
  - tool_args_progress SSE event type — emitted on every 5KB cumulative-byte boundary during in-flight tool argument streaming
  - OpenAI-path emit at threads.py:1666-1782 (init alongside tool_calls_buffer + emit after delta append)
  - Anthropic-path yield at anthropic_service.py:166-236 (init alongside tool_blocks + yield after partial_json append)
  - threads.py _on_chunk_anthropic dispatch branch routing the Anthropic yield through _emit
  - Both filter cases enforced: execute_code skipped (both paths) + STRUCTURED mode skipped (OpenAI only — Anthropic only runs in NATIVE)
  - 5KB UTF-8-aware sliding-window tail (args_so_far) + monotonic total_args_bytes_so_far per tool_index
affects:
  - Future v3.0 Skill Studio (tool_args_progress UI consumer + execute_code re-enable per REQUIREMENTS.md line 65)
  - Future Anthropic-path live UAT (deferred to /gsd:verify-work per auto-mode protocol)

# Tech tracking
tech-stack:
  added: []  # no new dependencies — pure additive emit on existing _emit XADD wrapper
  patterns:
    - "Producer-side 5KB-boundary emit pattern — per-key counter (_tool_args_emit_boundary[idx]) advances 0 → 1 → 2 → … as the accumulator crosses each 5KB; emit fires exactly once per boundary transition"
    - "Sliding-window UTF-8-aware byte tail: accumulator.encode('utf-8')[-5120:].decode('utf-8', errors='ignore') — bounded transport size + drops invalid trailing codepoint bytes left by the byte boundary"
    - "Provider-parity event ordering: tool_preparing → tool_args_progress (N times) → tool_start — the new event slots cleanly between the existing two without touching their emit sites"
    - "Generator yield + caller-dispatch pattern (Anthropic): producer (anthropic_service.py) yields a normalized dict; caller (threads.py _on_chunk_anthropic) routes to _emit — keeps the generator Redis-free and decoupled from the SSE layer"
    - "Per-iteration boundary-counter reset (Pitfall 3 mitigation): _tool_args_emit_boundary initialized at the same lexical scope as tool_calls_buffer / tool_blocks — guarantees no cross-iteration leakage"
    - "Test infrastructure: live-Postgres seeded auth.users + threads pair (test_073 pattern) for tests that need full agent-loop exercise; PG_AVAILABLE skipif degrades gracefully on CI without Postgres"

key-files:
  created:
    - backend/tests/integration/test_075_tool_args_progress.py
  modified:
    - backend/app/api/threads.py (OpenAI delta accumulator emit at :1666-1782 + Anthropic dispatch branch at :1616-1635)
    - backend/app/services/anthropic_service.py (per-iteration boundary counter init + input_json_delta yield at :166-236)

key-decisions:
  - "Test infrastructure: real-Postgres binding-gate (test_073 pattern) over mock-pool — full agent-loop exercise is necessary to drive _on_chunk_openai / _on_chunk_anthropic closures; mock pool would bypass the actual emit code path"
  - "Test shim _ClosableIterator wraps list_iterator with no-op close() — agent-loop's _drain_stream_with_close_on_cancel binds close_fn=stream.close which list_iterator lacks; minimal shim preserves real producer code path"
  - "Test shim _adaptive_streaming_side_effect / _stream_anthropic_side_effect call-count guard: second LLM call (after tool execution) returns a quick stop chunk so the agent loop terminates without re-iterating the chunks — without this, duplicate boundary emits break the monotonic assertion"
  - "Naming convention: dispatch branch uses _etype == 'tool_args_progress' (matching existing _ant_event/_etype convention in _on_chunk_anthropic) rather than the plan's chunk['type'] — same intent, follows code's local idiom"
  - "load_user_settings patched via model_copy with active_provider='anthropic' + llm_model='claude-sonnet-4-6' (not via override_provider which silently no-ops if anthropic credentials aren't configured in dev .env) — forces the agent-loop branch reliably regardless of dev-env state"

patterns-established:
  - "Pattern: 5KB-boundary SSE emit on streaming accumulator — per-tool-index counter; emit when (len(accumulator.encode('utf-8')) // 5120) > last_boundary; UTF-8-safe sliding tail for transport"
  - "Pattern: provider-parity SSE event injection — producer-side hook for OpenAI delta accumulator + producer-side yield + caller-side dispatch for Anthropic generator; both end at the same _emit XADD wrapper"
  - "Pattern: live-Postgres binding-gate test for full agent-loop tests — PG_AVAILABLE skipif + seeded_thread fixture (auth.users + threads) + FK-safe cleanup; mirrors test_073_concurrency.py"

requirements-completed:
  - POLISH-TOOL-PROG-01

# Metrics
duration: 13min
completed: 2026-05-18
---

# Phase 075 Plan 03: tool_args_progress SSE primitive Summary

**Backend-only emit of a new tool_args_progress SSE event from both the OpenAI streaming delta accumulator (threads.py:1666-1782) and the Anthropic input_json_delta accumulator (anthropic_service.py:166-236) whenever a non-execute_code tool's accumulated argument JSON crosses every 5KB boundary during streaming. threads.py _on_chunk_anthropic gained a dispatch branch routing the generator yield through _emit. Both filter cases enforced: execute_code skipped (both paths), STRUCTURED mode skipped (OpenAI only — Anthropic only runs in NATIVE). All 6 integration tests GREEN.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-18T19:16:15Z
- **Completed:** 2026-05-18T19:29:33Z
- **Tasks:** 4 (3 autonomous code/test tasks + 1 auto-approved checkpoint:human-verify)
- **Files modified:** 3 (1 new test file, 2 backend modifications — non-overlapping with Plan 01 and Plan 02 zones)

## Accomplishments

- **OpenAI-path emit live (Task 2).** At `threads.py:1737-1782`, after every `tool_calls_buffer[idx]["arguments"] += tc.function.arguments`, the cumulative byte length is checked against `_tool_args_emit_boundary[idx]`. When the new boundary advances (5KB → 1, 10KB → 2, …), a tool_args_progress event is emitted with `tool_index`, `name`, `args_so_far` (5KB UTF-8-aware sliding tail), and `total_args_bytes_so_far`. Both D-075-11 filters are applied in the same guard: `_tool_name != "execute_code"` AND `calling_mode != CallingMode.STRUCTURED`. `calling_mode` is captured by closure from the `create_adaptive_streaming_chat(...)` unpack at line 1645.
- **Anthropic-path yield live (Task 3).** At `anthropic_service.py:199-236`, after every `tool_blocks[event.index]["arguments"] += delta.partial_json`, the same boundary arithmetic yields `{"type": "tool_args_progress", "tool_index": event.index, "name": tb["name"], "args_so_far": <tail>, "total_args_bytes_so_far": <bytes>}`. The execute_code filter is enforced at the producer; the calling_mode filter doesn't apply (Anthropic generator only runs in NATIVE mode). Comment block documents both invariants.
- **threads.py dispatch routing.** `_on_chunk_anthropic` at `threads.py:1616-1635` gained a new `_etype == "tool_args_progress"` branch that calls `await _emit(redis, run_id, "tool_args_progress", tool_index=..., name=..., args_so_far=..., total_args_bytes_so_far=...)` — straight pass-through with no transformation (producer already applied filter logic). Position in the if/elif chain matches the wire ordering: tool_preparing → tool_args_progress → tool_start.
- **Pitfall 3 invariant (per-iteration reset) satisfied.** `_tool_args_emit_boundary: dict[int, int] = {}` is initialized at the SAME init point as `tool_calls_buffer` and `_announced_tools` (threads.py:1668-1675) — per-agent-loop-iteration reset. Same pattern in anthropic_service.py at the top of `stream_anthropic` (line 173) — per-generator-invocation reset. Grep audit returns exactly 1 hit per file for the canonical declaration.
- **Test scaffold landed (Task 1).** `backend/tests/integration/test_075_tool_args_progress.py` — 6 integration tests covering: 5KB-boundary firing (≥2 emits on 12 KB args), args_so_far ≤5120 bytes bounded, total_args_bytes_so_far monotonic, execute_code skipped (negative-assertion), STRUCTURED mode skipped (negative-assertion), Anthropic provider parity. Inherits `_reset_redis_singleton` autouse from conftest.py (D-074-11 hoist) + cross-imports `_reset_sse_starlette_app_status` from test_059_disconnect.py to fix the cached AppStatus loop-binding trap. Gated behind PG_AVAILABLE (test_073 pattern) so CI without Postgres skips gracefully.

## Task Commits

Each task committed atomically:

1. **Task 1: Wave 0 — test scaffold** — `70ac165` (test)
2. **Task 2: Backend — OpenAI-path emit at threads.py:1737-1782 + test infra refinements** — `6400a4c` (feat)
3. **Task 3: Backend — Anthropic-path yield + threads.py _on_chunk_anthropic dispatch branch** — `210a41f` (feat)
4. **Task 4: Live UAT checkpoint (Anthropic claude-sonnet-4-6 >5KB analyze_document)** — Auto-approved under `_auto_chain_active = true`. Live UAT deferred to `/gsd:verify-work` / human-driven session.

**Plan metadata commit:** pending (see Next Phase Readiness).

## Files Created/Modified

- **`backend/tests/integration/test_075_tool_args_progress.py`** — NEW. 6 integration tests covering the full POLISH-TOOL-PROG-01 contract:
  - `test_tool_args_progress_fires_on_5kb_boundary` — drives 12 × 1024-byte ASCII chunks through the OpenAI delta accumulator; asserts ≥2 progress events arrive on the wire (boundaries at 5 KB and 10 KB).
  - `test_args_so_far_bounded` — asserts `len(e["args_so_far"].encode("utf-8")) <= 5120` for every event (D-075-09 sliding-window tail).
  - `test_total_bytes_monotonic` — asserts the total_args_bytes_so_far sequence sorts equal to itself (monotonic).
  - `test_tool_args_progress_skipped_for_execute_code` — same chunks, tool_name="execute_code"; asserts zero progress events on the wire.
  - `test_tool_args_progress_skipped_in_structured_mode` — same chunks, calling_mode=STRUCTURED; asserts zero progress events.
  - `test_anthropic_path_emits_on_boundary` — drives the anthropic generator with input_json_delta-equivalent chunks; asserts ≥2 progress events arrive on the wire through threads.py's _on_chunk_anthropic dispatch.
  - Test infrastructure: `seeded_thread` async fixture (test_073 pattern) inserts an ephemeral auth.users + threads row in the live local Postgres so insert_run satisfies the runs_thread_id_fkey constraint; FK-safe cleanup. `_ClosableIterator` shim wraps the chunk iterator with a no-op close() method so `_drain_stream_with_close_on_cancel`'s `close_fn=stream.close` binding works on list_iterator. `_adaptive_streaming_side_effect` / `_stream_anthropic_side_effect` call-count guards return a quick stop chunk on the second LLM call so the agent loop terminates without re-iterating the chunks (preventing duplicate boundary emits that would break the monotonic assertion). PG_AVAILABLE skipif degrades gracefully on CI without Postgres.

- **`backend/app/api/threads.py`** — MODIFIED in two zones (non-overlapping with Plan 01 and Plan 02):
  - **`threads.py:1668-1675` (init):** Added `_tool_args_emit_boundary: dict[int, int] = {}` at the SAME init point as `tool_calls_buffer: dict = {}` and `_announced_tools: set[int] = set()` (Pitfall 3 — per-iteration reset).
  - **`threads.py:1737-1782` (emit):** Inside the OpenAI delta accumulator after `tool_calls_buffer[idx]["arguments"] += tc.function.arguments`, added a guarded boundary check + emit. Filters: `_tool_name and _tool_name != "execute_code" and calling_mode != CallingMode.STRUCTURED`. Tail: `tool_calls_buffer[idx]["arguments"].encode("utf-8")[-5120:].decode("utf-8", errors="ignore")`. Reuses the existing `_emit` XADD wrapper (no new helper).
  - **`threads.py:1616-1635` (dispatch):** Inside `_on_chunk_anthropic`, added new branch `elif _etype == "tool_args_progress":` that routes the generator yield to `await _emit(redis, run_id, "tool_args_progress", tool_index=..., name=..., args_so_far=..., total_args_bytes_so_far=...)`. Position in the chain: tool_preparing → tool_args_progress → tool_start (matches wire event ordering).

- **`backend/app/services/anthropic_service.py`** — MODIFIED in two zones (within Plan 03's documented zone :199-225):
  - **`anthropic_service.py:173` (init):** Added `_tool_args_emit_boundary: dict[int, int] = {}` at the same scope as `tool_blocks: dict[int, dict] = {}` (top of the `stream_anthropic` generator body). Comment documents that the calling_mode filter from D-075-11 doesn't apply on this path (Anthropic is NATIVE-only).
  - **`anthropic_service.py:204-236` (yield):** Inside the `input_json_delta` branch, after `tool_blocks[event.index]["arguments"] += delta.partial_json`, added a guarded boundary check + yield. Filter: `_tool_name and _tool_name != "execute_code"`. Tail: same UTF-8-aware byte slice. Yields a normalized dict; threads.py dispatch (above) routes it to `_emit`.

## Decisions Made

- **Test infrastructure: real-Postgres binding gate over mock pool (Task 1 / 2).** Plan 03 NEEDS the agent loop to actually drive `_on_chunk_openai` and `_on_chunk_anthropic` (the emit code lives inside those closures). A mock pg pool would bypass the producer entirely — there's no surrogate that exercises the accumulator. The test_073_concurrency.py `test_thread_user` fixture pattern (seed real auth.users + threads + FK-safe cleanup) was the right answer: it satisfies the runs_thread_id_fkey constraint without inventing new infrastructure. The PG_AVAILABLE skipif preserves CI compatibility — tests skip gracefully when Postgres isn't reachable, matching Phase 073 / 074 / 075 Plan 02 precedent.
- **Test shim _ClosableIterator (Task 2).** OpenAI 2.x `Stream` exposes a sync `.close()` that `_drain_stream_with_close_on_cancel` binds via `close_fn=stream.close`. A plain `list_iterator` lacks `.close()`, causing AttributeError before any chunk is drained. The minimal shim wraps the iterable and exposes a no-op `close()` — preserves the real producer code path without mocking the agent loop's drain helper.
- **Test shim call-count guard (Task 2 / 3).** When `tool_calls_buffer` is populated, the agent loop executes the tool and calls the LLM AGAIN with the tool result. Without a guard, the patched `create_adaptive_streaming_chat` returns a fresh `_ClosableIterator(<same list>)` on the second call, re-iterating the chunks and emitting duplicate boundary events — which broke `test_total_bytes_monotonic`. The `_call_counter` guard returns a quick stop+usage chunk on call #2, terminating the loop after one tool execution round. Same pattern applied to the Anthropic helper.
- **Naming convention for dispatch branch (Task 3).** Plan acceptance criterion mentioned `chunk["type"] == "tool_args_progress"`. The existing `_on_chunk_anthropic` uses `_ant_event` for the dict variable and `_etype` for the local. I followed the local idiom (`elif _etype == "tool_args_progress":`) — same intent, consistent with the surrounding 9-branch `if/elif` chain.
- **load_user_settings patching strategy for the Anthropic test (Task 3).** The standard `override_provider(effective, "anthropic")` silently no-ops if the anthropic provider isn't configured in the dev `.env`. I bypassed it with a direct `model_copy(update={"active_provider": "anthropic", "llm_model": "claude-sonnet-4-6", "llm_api_key": "test-anthropic-key"})` so the test forces the agent-loop branch reliably regardless of dev-env credentials.

## Deviations from Plan

None of substance — plan executed as written. Three judgement calls inside the plan-as-written latitude:

1. **Task 1/2 test scaffold deepening:** PLAN.md Task 1 said "Use httpx + ASGITransport if needed for full SSE flow, OR mock the LLM provider deltas directly inline and call the internal accumulator function (simpler / faster)." I picked the full ASGI flow because the internal accumulator is inside a closure inside an agent loop — no clean way to call it directly without reconstructing the full closure scope. The full-flow choice required four additional pieces (PG_AVAILABLE skipif, seeded_thread fixture, _ClosableIterator shim, _reset_sse_starlette_app_status cross-import, _adaptive_streaming_side_effect call-count guard) that the plan didn't anticipate. All five are documented in the test file's docstrings / inline comments and in this SUMMARY's Decisions section.

2. **Task 4 (Live UAT checkpoint):** auto-mode (`_auto_chain_active = true`) routed this checkpoint via the "auto-approve human-verify" protocol per `references/checkpoints.md`. Live UAT with claude-sonnet-4-6 + >5KB analyze_document prompt (verifying the SSE wire shows tool_args_progress events between tool_preparing and tool_start) and the execute_code negative case (verifying zero events fire even at >5KB code body) deferred to a human-driven session at `/gsd:verify-work` time. The executor logged the auto-approval and continued to SUMMARY generation.

3. **Dispatch branch placement (Task 3):** PLAN.md Step B in Task 3 said "Order doesn't matter for correctness, but for readability put it between [tool_preparing and tool_start] (tool_preparing → tool_args_progress → tool_start mirrors the event ordering on the wire)." Done — branch sits at `threads.py:1616-1635`, between the existing tool_preparing branch (line 1613-1622) and the tool_start branch (line 1636-1647).

## Issues Encountered

- **Test infra friction — same `test_063_post_then_subscribe.py` pre-existing FK failure documented by Plan 01 and Plan 02 SUMMARIES as `D-074-02-DEFER-1` carry-forward.** When the test scaffold first ran, the POST→GET ASGI flow hit `asyncpg.exceptions.ForeignKeyViolationError: insert or update on table "runs" violates foreign key constraint "runs_thread_id_fkey"`. Root cause: post-Phase-073 `insert_run` uses asyncpg (not supabase-py) and bypasses the mock_supabase intercept. Plan 01 worked around by only GET-testing /snapshot. Plan 02 gated tests behind SANDBOX_ENABLED=1. Plan 03 NEEDS full agent-loop exercise, so I adopted the test_073_concurrency.py real-Postgres seeded_thread pattern (PG_AVAILABLE skipif + ephemeral auth.users + threads row + FK-safe cleanup). This is the right fix going forward — same pattern any future test needing the producer's actual code path should use. The pre-existing test_063 failure stays as a separate carry-forward; not Plan 03's responsibility to fix that specific file.
- **Loop-binding trap on the SECOND test (sse-starlette `AppStatus.should_exit_event`).** First test passed cleanly; second test crashed with `RuntimeError: <asyncio.locks.Event object at ...> is bound to a different event loop` — the cached `AppStatus.should_exit_event` from test 1 leaked into test 2's fresh event loop. Fix: cross-imported `_reset_sse_starlette_app_status` autouse fixture from `test_059_disconnect.py` (same pattern as `test_063_post_then_subscribe.py:40`). Resolved on the next run.
- **Duplicate boundary emits on the SECOND LLM iteration.** With `tool_calls_buffer` populated, the agent loop executes the tool and calls the LLM again. The patched `create_adaptive_streaming_chat` returned a fresh iterator over the SAME chunks list on the second call → boundaries fired twice → `test_total_bytes_monotonic` failed with `[5120, 10240, 5120, 10240]`. Fix: `_call_counter` guard returns a quick stop+usage chunk on call #2. Resolved.

## Deferred Issues

- **Live Anthropic UAT for SC #3** (Task 4) deferred to `/gsd:verify-work` human-driven session per auto-mode protocol. UAT scope: with `active_provider=anthropic` and model `claude-sonnet-4-6`, drive a prompt that produces a >5KB `analyze_document` tool call; verify the SSE wire (Chrome DevTools Network → EventSource for `/runs/{rid}/stream`) shows tool_args_progress events between `tool_preparing` and `tool_start`; sanity-check the execute_code negative case (prompt that triggers execute_code with >5KB code body must show ZERO progress events on the wire).
- **test_063_post_then_subscribe.py FK constraint failure** stays open as D-074-02-DEFER-1 — pre-existing carry-forward documented in Plan 01 and Plan 02 SUMMARIES. Not Plan 03's responsibility. The pattern landed in this plan (real-Postgres seeded_thread fixture) is the suggested fix template for whatever phase reopens that issue.

## TDD Gate Compliance

Plan-level type is `execute` with task-level `tdd="true"` on Tasks 1-3. The gate sequence is visible in git log:

- Task 1 RED: `test(075-03): add failing test scaffold for tool_args_progress SSE primitive` (`70ac165`)
- Task 2 GREEN (OpenAI emit): `feat(075-03): emit tool_args_progress on 5KB boundary in OpenAI delta accumulator` (`6400a4c`) — 5/6 tests went GREEN here (negative-assertion tests passed-by-accident pre-Task-2 because no events fired at all; positive-assertion OpenAI tests went GREEN after the emit landed).
- Task 3 GREEN (Anthropic emit + dispatch): `feat(075-03): emit tool_args_progress in Anthropic input_json_delta + dispatch in threads.py` (`210a41f`) — 6/6 tests GREEN at this commit.

## User Setup Required

None — no new env vars, no new dependencies, no migrations. The new event type rides the existing Redis Stream + SSE infrastructure (D-061-09 MAXLEN 10000 cap, D-061-10 keepalive cadence) with zero changes.

The frontend SSE consumer ignores unknown event types harmlessly (existing pattern); the v3.0 Skill Studio milestone wires the actual UI consumer per D-075-12.

## Next Phase Readiness

- **Phase 075 verify-work:** ready. All 3 plans complete. Recommended verify scope:
  - **Plan 01 Chrome MCP UAT** (cold-cache thread-switch latency ≥50% reduction + Resume-button-stays-hidden during >30s sandbox cell).
  - **Plan 02 SANDBOX_ENABLED test run** (`for i in range(5): print(i); time.sleep(1)` produces ≥3 distinct `code_stdout` events with monotonic captured_at + silent-workload heartbeat preserved) + Chrome MCP UAT (bottom indicator stays animated through long matplotlib renders at t=30s/60s/120s).
  - **Plan 03 Anthropic-path live UAT** (`claude-sonnet-4-6` + >5KB `analyze_document` prompt — SSE wire shows tool_args_progress events between tool_preparing and tool_start; execute_code negative-case sanity check shows zero events).
- **Future v3.0 Skill Studio:** Plan 03 ships the backend SSE primitive; the UI consumer (progressive args preview / "Sending args N KB…" counter) is locked-in scope for the v3.0 Skill Studio milestone per REQUIREMENTS.md line 65 + D-075-12. The execute_code filter at the producer side will be flipped off in the same milestone (re-enabling tool_args_progress for execute_code).

## Threat Flags

None — no new threat surface introduced. T-075-12 through T-075-16 from PLAN.md threat_model section were honored:
- **T-075-12 (log leak):** zero `logger.*args_so_far` hits across both modified files (grep audit clean). No logger lines added at all in the emit guards — only the canonical `_emit` XADD wrapper.
- **T-075-13 (PII / secrets in args):** accepted — args are LLM-generated, RLS-bound on the SSE wire to the same user who provided the prompt; no widening of the trust boundary.
- **T-075-14 (DoS via event flood):** mitigated — D-075-10 5KB boundary caps event rate at `ceil(total_args / 5120)`. The pre-existing Redis Stream MAXLEN 10000 (D-061-09) caps total run buffer at ~2MB. No change in per-LLM-call timeout (Phase 066). Severity: medium.
- **T-075-15 (LLM injects fake event):** accepted — `json.dumps` in `_emit` quotes any embedded `"type": "tool_args_progress"` literal in the args string; no injection vector at the producer side.
- **T-075-16 (cross-iteration boundary leak):** mitigated — Pitfall 3 invariant: `_tool_args_emit_boundary: dict[int, int] = {}` initialized at the SAME init point as `tool_calls_buffer = {}` / `_announced_tools = set()`. Acceptance criterion `grep -n "_tool_args_emit_boundary: dict\[int, int\] = {}" backend/app/api/threads.py backend/app/services/anthropic_service.py` returns exactly 1 hit per file. Verified.

## Self-Check: PASSED

Verification (run after writing this SUMMARY.md):

- `backend/tests/integration/test_075_tool_args_progress.py` — FOUND. 6 test functions: `test_tool_args_progress_fires_on_5kb_boundary`, `test_args_so_far_bounded`, `test_total_bytes_monotonic`, `test_tool_args_progress_skipped_for_execute_code`, `test_tool_args_progress_skipped_in_structured_mode`, `test_anthropic_path_emits_on_boundary`. All 6 collect cleanly and pass under live Postgres (6/6 GREEN).
- `backend/app/api/threads.py` grep gates:
  - `_tool_args_emit_boundary` — 3 hits (init + .get + assignment).
  - `_tool_args_emit_boundary: dict[int, int] = {}` (Pitfall 3 canonical) — 1 hit.
  - multi-line `await _emit(\s*redis, run_id, "tool_args_progress"` — 1 hit (the emit call).
  - `_tool_name != "execute_code"` — 1 hit (D-075-11 filter 1).
  - `calling_mode != CallingMode.STRUCTURED` — 1 hit (D-075-11 filter 2).
  - `encode("utf-8")[-5120:]` — 1 hit (D-075-09 sliding-window tail).
  - `_etype == "tool_args_progress"` — 1 hit (Anthropic dispatch branch).
  - `logger.(info|warning|exception).*args_so_far` — 0 hits (T-073-04 clean).
  - AST parses without syntax error.
- `backend/app/services/anthropic_service.py` grep gates:
  - `"type": "tool_args_progress"` — 1 hit (yield).
  - `_tool_args_emit_boundary` — 3 hits (init + .get + assignment).
  - `_tool_args_emit_boundary: dict[int, int] = {}` (Pitfall 3 canonical) — 1 hit.
  - `_tool_name != "execute_code"` (via local) — 1 hit (D-075-11 filter — Anthropic side).
  - `encode("utf-8")[-5120:]` — 1 hit (D-075-09 sliding-window tail).
  - `logger.(info|warning|exception).*args_so_far` — 0 hits (T-073-04 clean).
  - AST parses without syntax error.
- Zone non-overlap:
  - Plan 01 marker `/snapshot` in `backend/app/api/threads.py` — 6 hits preserved (helper + endpoint + comments).
  - Plan 02 marker `python -u` in `backend/app/api/threads.py` — 3 hits preserved (sandbox branch + comments).
- Commits FOUND in git log: `70ac165`, `6400a4c`, `210a41f` (3 task commits via `git log --oneline 70ac165..HEAD`).
- Test gate: `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_075_tool_args_progress.py -x -q` → 6 passed in 12s.
- Regression gate: `pytest test_075_snapshot.py test_063_1_messages_runs_join.py test_062_active_runs.py` → 11/11 PASS.

---

*Phase: 075-seed-008-tool-args-progress-polish-bundle*
*Plan: 03*
*Completed: 2026-05-18*
