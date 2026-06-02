---
phase: 093-harness-cross-provider-parity
plan: 07
subsystem: api
tags: [harness, sub-agent, provider-gateway, thought_signature, reasoning_content, token-usage, cross-provider]

# Dependency graph
requires:
  - phase: 092.5
    provides: "provider gateway (open_stream → (stream, calling_mode)) emitting finish/usage/reasoning_delta events with thought_signature on finish.tool_calls"
  - phase: 093-02
    provides: "task_service._stream_one_iteration already drives the gateway (open_stream) + honors calling_mode (F9 core) — this plan extends its drain to consume the finish/usage events it was ignoring"
provides:
  - "Harness sub-agent consumer CONSUMES the gateway finish event: hydrates thought_signature (Google) onto the tool-call buffer, accumulates reasoning_content (Moonshot/Kimi/DeepSeek-thinking), SUMs usage"
  - "Assistant tool-call replay message round-trips thought_signature (per tool_call dict) + reasoning_content (on the message) so Google/Moonshot no longer 400 on round 2 of a multi-tool harness sub-agent loop"
  - "Sub-agent runs row persists accumulated input/output tokens (S4 closed) — was NULL on every harness run"
affects: [094, 096, harness, eval-cross-provider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive caller-supplied accumulator boxes (reasoning_box: list[str]|None, usage_box: dict|None) with None defaults — same F1-F8 pattern as structured_injected; public return stays (content, tool_calls) so the lone llm_single caller + every _fake_stream fixture are byte-identical"
    - "Conditional-spread metadata round-trip (thought_signature / reasoning_content) — no-op when absent → byte-identical for non-reasoning providers + Deep (mirror agent_loop.py:1866-1901)"

key-files:
  created: []
  modified:
    - "backend/app/services/task_service.py — _drain consumes finish/reasoning/usage; run_task_sub_agent hydrates the replay message + persists usage"
    - "backend/tests/unit/test_085_task_service.py — Test093FinishEvent (9 cases: 5 Task-1 drain + 4 Task-2 replay/persist)"
    - ".planning/phases/093-harness-cross-provider-parity/deferred-items.md — logged the pre-existing test_085_sub_agent_cross_provider model-resolver failures"

key-decisions:
  - "Box approach over tuple-widening: thread additive reasoning_box/usage_box accumulator boxes (None defaults) rather than widening _stream_one_iteration's (content, tool_calls) return — keeps the lone direct caller phase_types._exec_llm_single byte-identical (it passes neither) and avoids touching every _fake_stream fixture (lower blast radius, per the plan's preferred path)"
  - "Per-iteration reasoning_box (fresh [\"\"] each loop, mirror agent_loop.py:1907-1908 reset) but cross-iteration _sub_usage (SUM, NOT reset) — matches the Deep accumulator semantics exactly"
  - "finalize_run gets _sub_usage.get(input/output_tokens) → None when no usage emitted (graceful, preserves pre-093-07 behavior); emit logger.warning('runs.usage missing ...') before finalize when both None, per the TOKEN-COL-01 finalize_run docstring contract"

patterns-established:
  - "Finish-event hydration mirrors Deep verbatim: agent_loop.py:1399-1416 (usage SUM) + :1422-1432 (reasoning accumulate) + :1503-1506 (thought_signature buffer hydrate) + :1866-1901 (assistant-message conditional spreads)"

requirements-completed: [PARITY-02]

# Metrics
duration: 18min
completed: 2026-06-02
---

# Phase 093 Plan 07: Harness Finish-Event Hydration + runs.usage Persistence Summary

**The harness sub-agent now consumes the gateway finish event — round-tripping Google `thought_signature` + Moonshot/Kimi `reasoning_content` on the assistant tool-call replay message (no more round-2 400s) and persisting accumulated token usage to the sub-agent runs row (S4 closed) — as one additive, byte-identical-Deep change to `task_service.py`.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-02T20:19:23Z
- **Completed:** 2026-06-02T20:37:51Z
- **Tasks:** 3 (Tasks 1-2 production + tests; Task 3 deterministic guard, verification-only)
- **Files modified:** 3 (1 production, 1 test, 1 deferred-items doc)

## Accomplishments

- **D-16 finish-event consumption (`_drain`):** replaced the `task_service.py:271-273` `reasoning_delta` drop + the `:299-300` finish/usage IGNORE comment. `_drain` now (a) accumulates `reasoning_content` into a per-turn sink, (b) hydrates Google's `thought_signature` onto the matching `tool_calls_buffer` entry from the finish event's `tool_calls` (verbatim `agent_loop.py:1503-1506`), and (c) SUMs `usage`/`usage_delta` (verbatim `agent_loop.py:1399-1416`). The two metadata sinks surface via additive caller boxes (`reasoning_box`, `usage_box`); the public return stays `(content, tool_calls)`.
- **D-16 replay-message round-trip (`run_task_sub_agent`):** the assistant tool-call replay message now carries `thought_signature` per tool_call dict (Google) + `reasoning_content` on the message (Moonshot/Kimi/DeepSeek-thinking) via conditional spreads (mirror `agent_loop.py:1866-1901`). The NEXT gateway round echoes the per-turn reasoning metadata the provider requires → a Google multi-tool sub-agent no longer 400s `thought_signature missing in functionCall parts`; a Moonshot/Kimi(thinking) sub-agent no longer 400s `reasoning_content missing`.
- **D-17 / S4 token persistence:** `run_task_sub_agent`'s `finally` now passes the accumulated `_sub_usage` (summed across loop iterations) to `finalize_run` instead of the old `input_tokens=None, output_tokens=None` — the sub-agent `runs.input_tokens/output_tokens` are no longer NULL on the harness path. Graceful: still None when the provider emits no usage, with a `runs.usage missing` warning logged first (TOKEN-COL-01 contract).
- **Byte-identical-Deep guard (deterministic half):** Deep `task()`/`analyze_document` + the 4 already-passing providers (OpenAI/Anthropic/DeepSeek/MiniMax) are no-ops — the boxes are None-defaulted (no caller-visible signature break) and the conditional spreads add nothing when the metadata is absent. `sub_agent_service.py` + `agent_loop.py` are zero-diff; `test_085_task_service.py` = 43/43 GREEN.

## Task Commits

1. **Task 1: Consume the finish event in `_drain` — hydrate thought_signature, accumulate reasoning_content + usage** — `476d4848` (feat). TDD: RED tests authored first (5 `Test093FinishEvent` drain cases failing on the unknown `reasoning_box` kwarg), then the implementation flipped them GREEN.
2. **Task 2: Hydrate thought_signature + reasoning_content onto the assistant replay message + persist usage to the sub-agent runs row** — `9d0c96b0` (feat). TDD: 3 RED replay/persist cases authored first (usage-persist failing on `input_tokens=None`), then implementation flipped GREEN (+ 1 plain-provider no-op case).
3. **Task 3: Byte-identical-Deep + 4-passing-provider no-op guard** — `15efe830` (docs — deterministic guard, no production code; logged the pre-existing model-resolver failures to deferred-items.md).

**Plan metadata:** _final docs commit_ (this SUMMARY + STATE.md + ROADMAP.md).

_TDD note: this is a `type: execute` gap-closure plan with `tdd="true"` tasks (not a plan-level `type: tdd`). Tasks 1-2 each followed RED→GREEN — RED tests authored and confirmed failing before the implementation, then flipped GREEN in the same task commit (test + feat shipped together, the project's convention for gap-closure plans). No separate `test(...)` RED commit._

## Files Created/Modified

- `backend/app/services/task_service.py` —
  - `_stream_one_iteration`: + `reasoning_box: list[str] | None`, `usage_box: dict | None` additive kwargs (None → throwaway locals); `_drain` consumes `reasoning_delta` (accumulate), `finish` (hydrate `thought_signature` onto buffer), `usage`/`usage_delta` (SUM); surfaces reasoning to `reasoning_box[0]` + usage to `usage_box`.
  - `run_task_sub_agent`: + cross-iteration `_sub_usage` sink + per-iteration `_reasoning_box`; the assistant replay message gets the conditional `thought_signature` (per tool_call) + `reasoning_content` (message) spreads; `finalize_run` persists `_sub_usage.get(input/output_tokens)` with a `runs.usage missing` warning when both None.
- `backend/tests/unit/test_085_task_service.py` — `Test093FinishEvent` (9 cases): thought_signature hydrate / reasoning-into-box-not-content / usage+usage_delta SUM across iterations / plain-provider no-op / None-default byte-identical (Task 1); Google replay carries thought_signature / Moonshot replay carries reasoning_content / plain-provider replay carries neither + None tokens / accumulated usage SUM persisted (200/60) (Task 2).
- `.planning/phases/093-harness-cross-provider-parity/deferred-items.md` — 093-07 section documenting the 4 pre-existing `test_085_sub_agent_cross_provider` model-resolver failures.

## Decisions Made

- **Box approach over tuple-widening** (the plan's preferred low-blast-radius path): threaded additive `reasoning_box`/`usage_box` accumulator boxes with None defaults so the public return stays `(content, tool_calls)`. The lone direct caller `harness/phase_types.py:_exec_llm_single` passes neither → byte-identical; no `_fake_stream` fixture needed touching (they `**_kwargs`-absorb).
- **Per-iteration reasoning, cross-iteration usage:** `_reasoning_box` is freshly `[""]` each loop (mirror the Deep per-iteration reset at `agent_loop.py:1907-1908` — iteration 2 must not carry iteration 1's reasoning); `_sub_usage` accumulates across iterations (SUM) and is read once on finalize.
- **Graceful usage persistence + warn-before-finalize:** `_sub_usage.get(...)` returns None when no usage was emitted (preserves the pre-093-07 NULL behavior for providers emitting none); `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)` is emitted before `finalize_run` in that case, honoring the `finalize_run` docstring's TOKEN-COL-01 contract (db/runs.py:82-86).

## Deviations from Plan

None - plan executed exactly as written. Both production tasks followed the plan's box-thread + conditional-spread shape verbatim; no auto-fixes (Rules 1-3) were needed; no architectural decisions (Rule 4) were triggered.

## Issues Encountered

- **4 `test_085_sub_agent_cross_provider` failures surfaced in the Task-3 full-suite audit** (`test_cross_provider_default_path_no_footgun[anthropic|google|deepseek|moonshot]`). **PROVEN PRE-EXISTING relative to this plan:** checked out the pre-plan `task_service.py` (commit `a0c0603e`, the 093-06 head) and re-ran — all 4 fail IDENTICALLY. Root cause is the SAME 093-03 model-resolver field migration (`available_models` is now the field the resolver reads) vs this integration test's stale `llm_models` CSV fixture — in the model-resolver surface (093-03's territory), NOT in 093-07's `_drain`/replay/`finalize_run`-usage diff. Logged to `deferred-items.md`; left untouched per the executor scope boundary.

## Deterministic Byte-Identical-Deep Guard (Task 3)

- **Full-suite net-new failures = 0** vs the documented ~99-105 flaky baseline. Full run: **111 failed / 1110 passed / 7 skipped / 3 xfailed**. Of the 111: 4 are the PROVEN-pre-existing model-resolver `test_085_sub_agent_cross_provider` cases (above); the remaining 107 are the documented flaky baseline cluster (`test_sql_service`, `test_sandbox_service`, `test_retrieval_service`, `test_streaming_reliability`, live-DB FK-env integration tests). The failure-node set contains **ZERO** `test_085_task_service` / `provider_gateway` / `_drain`/replay/usage entries attributable to this change.
- **`sub_agent_service.py` + `agent_loop.py` = ZERO diff** across the plan (`git diff --stat 476d4848~1..HEAD` produces no output) — D-085-16 byte-frozen + D-14 Deep provider branches untouched. The harness CONSUMES the gateway, never re-implements the Deep provider logic.
- **`test_085_task_service.py` = 43/43 GREEN** — all Deep `task()`/`analyze_document` unit cases + the existing `Test093GatewayConsumption` cases + the new `Test093FinishEvent` cases pass. The additive boxes + conditional spreads are no-ops for the None-default Deep path.
- **`grep -c "async for" task_service.py` = 0** (IN-05 sync-generator trap re-confirmed — the gateway adapters return bare SYNC generators, driven `for event in stream:` inside `run_in_threadpool`, never `async for`).

**The LIVE proof — Google + Moonshot COMPLETE a multi-tool round, the 4-passing-providers non-regression, `runs.usage` non-NULL on the harness path, and the Deep Anthropic-twin skeleton diff — is the verifier+operator-owned D-21 re-UAT (093-VALIDATION.md). This plan closes only the deterministic half.**

## Acceptance Criteria Verification

| Criterion | Result |
|---|---|
| `grep -c "thought_signature" task_service.py` >= 2 | 8 ✓ |
| `grep -c "reasoning_content" task_service.py` >= 1 | 8 ✓ |
| `grep -c "async for" task_service.py` == 0 | 0 ✓ |
| `grep -c "usage ignored\|finish ignored"` == 0 | 0 ✓ |
| `grep -c "input_tokens=None" task_service.py` == 0 | 0 ✓ |
| `grep -c "_sub_usage" task_service.py` >= 2 | 6 ✓ |
| `pytest test_085_task_service.py -x` exits 0 (Test093FinishEvent + Test093GatewayConsumption GREEN) | 43 passed ✓ |
| `py_compile task_service.py` exits 0 | OK ✓ |
| `git diff --stat sub_agent_service.py agent_loop.py` empty | empty ✓ |

## User Setup Required

None - no external service configuration required. (Note: the D-20 backend file log-sink from 093-06 — `LOG_FILE_PATH=logs/backend.log` + uvicorn restart — is the operator's enabler for SEEING these fixes' signals in the D-21 re-UAT, but is owned by 093-06, not this plan.)

## Next Phase Readiness

- D-16 (Google/Moonshot round-2 400 fix) + D-17/S4 (runs.usage persistence) are CODE-COMPLETE and deterministically guarded. PARITY-02 stays Pending until the verifier-owned native-7 × 5-phase-type × 4-workflow LIVE UAT (D-21 re-UAT, 093-VALIDATION.md) passes — that is the binding gate for these fixes.
- Sibling Wave-4 plan 093-08 (D-18/S3 sub-agent model resolution) is independent and can run in parallel. After both, 093-09 (D-19 GLM diagnose-first), then phase close.

## Self-Check: PASSED

- FOUND: `.planning/phases/093-harness-cross-provider-parity/093-07-SUMMARY.md`
- FOUND: `backend/app/services/task_service.py`
- FOUND: `backend/tests/unit/test_085_task_service.py`
- FOUND: `.planning/phases/093-harness-cross-provider-parity/deferred-items.md`
- FOUND commit: `476d4848` (Task 1 — finish-event consumption in _drain)
- FOUND commit: `9d0c96b0` (Task 2 — replay-message round-trip + usage persist)
- FOUND commit: `15efe830` (Task 3 — deterministic guard + deferred-items doc)

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*
