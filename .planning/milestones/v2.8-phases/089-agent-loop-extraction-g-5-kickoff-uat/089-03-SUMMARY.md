---
phase: 089-agent-loop-extraction-g-5-kickoff-uat
plan: 03
subsystem: api
tags: [agent-loop, refactor, g-5, streaming, threads, cross-provider, verbatim-move]

# Dependency graph
requires:
  - phase: 089-01
    provides: agent_loop.py skeleton (frozen RunContext, AgentLoopResult, run_agent_loop stub), 3 pure helpers moved verbatim, operator-APPROVED SEAM.md (B1 + co-located _reconstruct_history)
provides:
  - run_agent_loop() in agent_loop.py owns the full iteration loop verbatim — 3 separate _on_chunk_* handlers, the persist functions, the tool-dispatch round, the B1 setup block, the inner try/except, the post-loop emits, and suggestion-gen/stream_end
  - threads.py agent_runner reduced to producer shell — builds RunContext, calls run_agent_loop, consumes AgentLoopResult; _shielded_finalize + _terminal_status classifier STAY
  - AgentLoopResult finalizer-seam test (test_089_agent_loop_result_seam.py)
  - All ~37 create_adaptive_streaming_chat monkeypatch targets repointed to agent_loop; MOCK_LLM_MODE install_mock fixed
affects: [089-04, 091, 092, 093]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verbatim G-5 extraction: lift the loop byte-identically (moved symbols proven IDENTICAL via dedented git diff), wire a thin seam, repoint Pitfall-1 monkeypatch targets — zero behavior change"
    - "result_sink + timeout_ctx by-reference containers: surface loop-internal finalizer outputs (persist callables, token totals, warnings, timed_out detail) on ALL exit paths incl. exception, cycle-free, without fattening RunContext or breaking the locked signature"
    - "Re-import moved module-level helpers into threads.py for backward-compat (one canonical copy in agent_loop.py) — same pattern as Plan 01's drain_step/_strip_nul"

key-files:
  created:
    - backend/tests/integration/test_089_agent_loop_result_seam.py
  modified:
    - backend/app/services/agent_loop.py
    - backend/app/api/threads.py
    - backend/app/_test_mock_llm.py
    - backend/tests/integration/test_075_4_terminal_race.py
    - backend/tests/integration/test_061_hard_timeout.py
    - (20 test files — create_adaptive_streaming_chat monkeypatch sweep)
    - (12 test files — source-grep guard repoints to agent_loop.py)

key-decisions:
  - "Module-level loop helpers (_is_transient_provider_error, SYSTEM_PROMPT, TOOL_USAGE_INSTRUCTIONS, _format_tool_list, CONFIDENCE_DISCLAIMER, _compute_confidence, _deduplicate_citations, _accumulate_chunk_usage) + _reconstruct_history MOVED to agent_loop.py and re-imported into threads.py — keeps the moved loop body referencing same-module symbols (cycle-free) AND keeps existing `from app.api.threads import ...` test/code imports resolving"
  - "AgentLoopResult extended with a 6th bound persist_system_warnings callable + run_agent_loop given two optional kw-only params (timeout_ctx, result_sink) — minimal Rule-3 structural necessities to keep the shielded finalizer (STAYS) byte-identical on ALL exit paths; documented in the dataclass/function docstrings"
  - "MOCK_LLM_MODE install_mock (app/_test_mock_llm.py) repointed to patch agent_loop.create_adaptive_streaming_chat — fixed a genuine functional regression (test_077_multi_worker)"

patterns-established:
  - "Pattern 1: byte-identical verbatim move proven by dedented AST extraction diff of every moved symbol BEFORE trusting the suite"
  - "Pattern 2: source-grep test guards that assert moved code lives in threads.py get repointed to agent_loop.py (intent-preserving, test-side) — Plan-01 precedent extended to ~12 guards"

requirements-completed: [FOUND-03]

# Metrics
duration: ~3h
completed: 2026-05-30
---

# Phase 089 Plan 03: THE Verbatim Move (G-5) Summary

**Lifted the entire agent loop — iteration loop, three separate provider chunk-handlers, persist functions, tool-dispatch round, B1 setup, inner try/except, post-loop emits, suggestion-gen — OUT of `threads.py:agent_runner` INTO `agent_loop.py:run_agent_loop()` byte-identically; threads.py now builds a frozen RunContext, calls the loop, and consumes the returned AgentLoopResult while the shielded finalizer + terminal-status classifier STAY. Full suite shows ZERO net regression (identical 102-failure set vs pre-move baseline).**

## Performance

- **Duration:** ~3h (highest-risk-if-done-wrong task of v2.8)
- **Completed:** 2026-05-30
- **Tasks:** 3 (all auto, no checkpoint)
- **Files modified:** 35 (2 source + 1 mock-harness + 32 test files; 1 created)

## Accomplishments
- `run_agent_loop` owns the full loop VERBATIM. Every moved symbol proven byte-identical via dedented AST diff against the pre-move file: `_on_chunk_anthropic`, `_on_chunk_google`, `_on_chunk_openai`, `_persist_assistant_message`, `_persist_system_messages`, `_reconstruct_history`, `_compute_confidence`, `_deduplicate_citations`, `_accumulate_chunk_usage`, `_format_tool_list`, `_is_transient_provider_error`.
- All 14 per-provider invariants (I1–I14) survive verbatim in agent_loop.py; both `active_provider_name` computes survive (5 assignments, not deduped — Pitfall 2); the `.neq("role","system")` filter is UNTOUCHED in threads.py route handlers (x2 — Phase 086 landmine); deferred Anthropic bugs untouched; dispatch_tool/ToolContext untouched.
- threads.py `agent_runner` reduced to producer shell: builds the frozen `RunContext`, calls `run_agent_loop(ctx, emit=_emit, emit_terminal=_emit_terminal, spawn=_spawn, timeout_ctx=..., result_sink=...)`, consumes `AgentLoopResult`. `_shielded_finalize` reads the result_sink and holds the byte-identical terminal-race order (persist → persist_system_warnings → finalize_run → sentinel → expire → zrem; I10 / Pitfall 5).
- Zero net regression: pre-move baseline = 102 failed / 877 passed; post-move = 102 failed / 878 passed (+2 new seam tests, −1 nothing) with an **IDENTICAL FAILED node-id set** (all pre-existing live-DB infra failures, routed to Phases 076/077).

## Task Commits

1. **Task 1: lift the agent loop verbatim into run_agent_loop, wire the seam** - `9bb2b073` (feat)
2. **Task 2: repoint ~37 create_adaptive_streaming_chat monkeypatch targets + mock-LLM install** - `448ee847` (test)
3. **Task 3: add AgentLoopResult seam test + repoint moved-code source-grep guards** - `12f3d546` (test)

## Files Created/Modified
- `backend/app/services/agent_loop.py` — replaced the stub with the verbatim loop body + moved module-level helpers + co-located `_reconstruct_history`; added `timeout_ctx`/`result_sink` kw-only params + `persist_system_warnings` field (~2354 LOC)
- `backend/app/api/threads.py` — removed the loop body + moved helper definitions; re-imports them from agent_loop; agent_runner builds RunContext + calls run_agent_loop + consumes AgentLoopResult; `_shielded_finalize` rewired to the result_sink (~1239 LOC, down from ~3009)
- `backend/app/_test_mock_llm.py` — `install_mock` now patches the agent_loop binding of create_adaptive_streaming_chat (Pitfall-1 fix for the MOCK_LLM_MODE subprocess harness)
- `backend/tests/integration/test_089_agent_loop_result_seam.py` — NEW: 2 tests proving the AgentLoopResult/result_sink → finalizer seam + I10 order
- 20 test files — create_adaptive_streaming_chat / stream_anthropic / stream_google / insert_assistant_message monkeypatch targets repointed to `app.services.agent_loop.*`
- 12 test files — source-grep guards repointed to read agent_loop.py where the moved code now lives

## Decisions Made
- **Module-level loop helpers + `_reconstruct_history` MOVED to agent_loop.py, re-imported into threads.py.** Importing them FROM threads.py into agent_loop.py would re-create the exact import cycle the seam avoids (Pitfall 4). Moving them (one canonical copy) keeps the loop body referencing same-module symbols while existing `from app.api.threads import _compute_confidence`/`SYSTEM_PROMPT`/`_reconstruct_history`/etc. call sites + test imports keep resolving via the re-export — the Plan-01 precedent.
- **AgentLoopResult gained a 6th bound `persist_system_warnings` callable; run_agent_loop gained two optional kw-only params (`timeout_ctx`, `result_sink`).** These are minimal Rule-3 structural necessities — not behavior changes. Pre-move, the shielded finalizer (which STAYS) called `_persist_assistant_message()` / `_persist_system_messages()` and read `_last_iteration`/token totals via the agent_runner closure on EVERY exit path. After the move those live inside run_agent_loop; the by-reference `result_sink` (populated in run_agent_loop's outer finally) and `timeout_ctx` are the cycle-free surface that survives a re-raise. The locked signature (`ctx, *, emit, emit_terminal, spawn`) stays positionally compatible (new params default to None).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Co-locate loop module-level helpers in agent_loop.py (beyond `_reconstruct_history`)**
- **Found during:** Task 1
- **Issue:** The moved loop body reads `SYSTEM_PROMPT`, `TOOL_USAGE_INSTRUCTIONS`, `_format_tool_list`, `CONFIDENCE_DISCLAIMER`, `_compute_confidence`, `_deduplicate_citations`, `_accumulate_chunk_usage`, `_is_transient_provider_error` (plus `_reconstruct_history`, which SEAM.md names explicitly). Importing them from threads.py into agent_loop.py re-creates the import cycle the seam avoids.
- **Fix:** Moved all of them verbatim into agent_loop.py (proven byte-identical) and re-imported them into threads.py for backward-compat — extends SEAM.md's `_reconstruct_history` co-location decision to its sibling pure helpers, same cycle-free rationale.
- **Files modified:** backend/app/services/agent_loop.py, backend/app/api/threads.py
- **Verification:** `import app.services.agent_loop, app.api.threads` exits 0 (no cycle); moved-symbol diff IDENTICAL; test_citations_confidence/test_tool_memory (import from threads.py) GREEN.
- **Committed in:** `9bb2b073` (Task 1)

**2. [Rule 3 - Blocking] `result_sink` + `timeout_ctx` by-reference containers + 6th AgentLoopResult field**
- **Found during:** Task 1
- **Issue:** The shielded finalizer (STAYS) must call the persist callables + read token totals + system warnings + the timed_out per-iteration detail on EVERY exit path (incl. exception). After the move those live inside run_agent_loop; the inner try/except RE-RAISES (so the return value is unavailable on the error path) and the persist functions are nested.
- **Fix:** Added two optional kw-only params to run_agent_loop (`timeout_ctx`, `result_sink`) populated in the loop's outer `finally` + each provider stream block; the finalizer reads them. Added a 6th bound `persist_system_warnings` callable to AgentLoopResult. Behavior-preserving: the finalizer's step order + the timed_out error string stay byte-identical.
- **Files modified:** backend/app/services/agent_loop.py, backend/app/api/threads.py
- **Verification:** test_089_agent_loop_result_seam (finalizer gets valid id + token totals + warnings, terminal order holds) GREEN; test_075_4_terminal_race GREEN.
- **Committed in:** `9bb2b073` (Task 1)

**3. [Rule 1 - Bug] MOCK_LLM_MODE install_mock targeted the wrong binding (functional regression)**
- **Found during:** Task 3 (full-suite gate)
- **Issue:** `app/_test_mock_llm.install_mock` patched `app.api.threads.create_adaptive_streaming_chat`. After the move the loop reads the agent_loop binding, so the subprocess mock LLM no longer intercepted the loop → `test_077_multi_worker::test_50_run_load` left `runs:active` non-empty (genuine regression, not a source-grep guard).
- **Fix:** `install_mock` now patches `app.services.agent_loop.create_adaptive_streaming_chat` (+ the threads binding defensively).
- **Files modified:** backend/app/_test_mock_llm.py
- **Verification:** test_077_multi_worker::test_50_run_load GREEN (18s, 50 runs complete, runs:active empties).
- **Committed in:** `448ee847` (Task 2)

**4. [Test guard] Repoint ~12 source-grep guards from threads.py to agent_loop.py**
- **Found during:** Task 3 (full-suite gate)
- **Issue:** ~12 tests assert (via `read_text`/`inspect.getsource`) that the loop body / suggestion-emit / per-call-timer / iteration-cap / final-output-files / Google+Anthropic gates / max_iterations live in threads.py. After the verbatim move they live in agent_loop.py.
- **Fix:** Repointed each guard's source read to agent_loop.py (intent-preserving, test-side) — same class as Plan 01's `_drain_stream` grep repoint. test_075_4_terminal_race's suggestion-order assertion split across the two modules (suggestion emit in run_agent_loop runs before agent_runner's finally triggers _shielded_finalize).
- **Files modified:** test_075_4_terminal_race, test_061_hard_timeout, test_075_4_subagent_truncation, test_075_1_observability, test_075_4_dedup_supersedes, test_075_4_empty_response_iter_count, test_075_4_final_output_files_payload, test_075_4_iteration_cap_drop, test_075_4_registry_sweep, test_075_5_google_native, test_explorer_agent (TestMaxIterationsConfig), test_threads_suggestions_threadpool
- **Verification:** All 58 repointed-guard tests GREEN; full-suite FAILED set identical to baseline.
- **Committed in:** `12f3d546` (Task 3)

**5. [Test guard] Repoint stream_anthropic/stream_google/insert_assistant_message monkeypatch targets**
- **Found during:** Task 2
- **Issue:** The plan named only `create_adaptive_streaming_chat`, but the same Pitfall-1 applies to every symbol the moved loop calls via `from X import Y`: `stream_anthropic`, `stream_google` (provider branches), `insert_assistant_message` (persist fn).
- **Fix:** Repointed those patch targets to `app.services.agent_loop.*` too (3 extra in test_provider_router, test_075_tool_args_progress, test_066_langsmith_clean).
- **Files modified:** backend/tests/test_provider_router.py, backend/tests/integration/test_075_tool_args_progress.py, backend/tests/integration/test_066_langsmith_clean.py
- **Verification:** test_provider_router GREEN (full loop end-to-end through the seam); full-suite no new connection-refused.
- **Committed in:** `448ee847` (Task 2)

---

**Total deviations:** 5 auto-fixed (1 Rule-1 bug, 2 Rule-3 blocking-structural, 2 test-guard repoints)
**Impact on plan:** All deviations were necessary to keep the verbatim move behavior-preserving AND the suite at zero net regression. No scope creep — no logic change to the loop, no forbidden cleanup (3 chunk handlers separate, both active_provider_name computes intact, deferred Anthropic bugs + dispatch_tool + 086 filter untouched).

## Issues Encountered
- **`_extract_run_id_from_mock` doesn't fit the asyncpg-helper-mock pattern** — the seam test extracts run_id from the AsyncMock-patched `insert_run` (mirrors test_provider_router), not the supabase mock. Resolved with a local `_run_id_from_insert_run` helper.
- **Shared `_make_sse_chunk` leaves `reasoning_content` as an auto-MagicMock** — fine for tests that never await the producer, but fatal (non-JSON-serializable SSE emit) for the seam test that awaits to completion. Resolved with a local `_clean_chunks` builder that sets the optional fields to explicit None.

## TDD Gate Compliance
N/A — this is a behavior-preserving relocation (type: execute), not a TDD feature plan. The acceptance bar is byte-identical relocation + zero net regression, both verified.

## Known Stubs
None — pure relocation, no new data sources or placeholders introduced.

## User Setup Required
None — no external service configuration required for this plan.

## Next Phase Readiness
- **Plan 089-04 is unblocked** — the loop now lives in a clean `run_agent_loop` module. The operator's live-key AFTER-half SSE-diff runbook (Plan 02 capture) + the cross-provider eval (Plan 04) are the final byte-identical proof at the phase gate; the structural + zero-net-regression bars for THIS plan are met.
- **Operator action before the phase gate:** run the AFTER half of the SSE-diff runbook against the moved loop (live native-7 keys) and confirm `normalize(before) == normalize(after)` per provider; run the eval rows. The pre-move BEFORE snapshot was captured against `0d701ba4` (Plan 01 handoff).
- **Harness (091/092) readiness:** `run_agent_loop(ctx, *, emit, emit_terminal, spawn)` is the self-contained composition seam the harness sits on — no further threads.py surgery needed.

---
*Phase: 089-agent-loop-extraction-g-5-kickoff-uat*
*Completed: 2026-05-30*

## Self-Check: PASSED
- FOUND: backend/tests/integration/test_089_agent_loop_result_seam.py
- FOUND commit: 9bb2b073 (Task 1 — verbatim move)
- FOUND commit: 448ee847 (Task 2 — monkeypatch sweep + mock-LLM fix)
- FOUND commit: 12f3d546 (Task 3 — seam test + source-grep repoints)
- Full suite FAILED node-id set IDENTICAL to pre-move baseline (102/102, zero net regression)
