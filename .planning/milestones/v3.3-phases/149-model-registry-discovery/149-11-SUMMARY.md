---
phase: 149-model-registry-discovery
plan: 11
subsystem: api
tags: [agent-loop, tool-calling, structured-output, calling-mode, native-tools, provider-routing, cross-provider]

# Dependency graph
requires:
  - phase: 149 (plan 08)
    provides: "DB-aware resolve_calling_mode — an operator native_tools=False OVR routes STRUCTURED via the warm _model_overrides_cache (fix 56945cca)"
provides:
  - "_should_pre_inject_structured pure gate — fires TOOL_USAGE_INSTRUCTIONS pre-injection for compat-path STRUCTURED (native_tools=False OVR), preserving OpenRouter/xml + no-override + anthropic/google-native boundaries"
  - "run_agent_loop wiring: warm get_model_capability_async before the sync gate read so the DB toggle is honored even on the body.provider-set branch"
affects: [149 verify-work, 149 live UAT re-run (row 1), secure-phase, agent-loop, calling-mode, provider-gateway]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure gate helper mirroring an inline predicate for testability (branch (a) byte-identical to the prior inline gate)"
    - "Warm-cache-before-sync-read: await get_model_capability_async(effective_model) immediately before the sync resolve_calling_mode gate so the DB overlay is reflected without turning the hot path async (D-14 boundary)"

key-files:
  created: []
  modified:
    - backend/app/services/agent_loop.py
    - backend/tests/test_149_native_tools_routing.py

key-decisions:
  - "The pre-injection gate now fires for ANY compat-path provider (openai/deepseek/minimax/moonshot/zhipu/ollama/openrouter) whose effective mode resolves STRUCTURED — a shared gate, no per-provider fork (cross-provider RED LINE)"
  - "anthropic/google native-SDK branches EXCLUDED from the gate (WR-05): a stray native_tools=False OVR can never reroute a real native tool-carrying request through structured injection"
  - "The injection SITE (~1748) and post-stream fallback injection (~2046) and the native branch were left byte-identical — only the _needs_pre_injection computation changed"
  - "MODEL-01 NOT marked complete — the SERVED-artifact proof is the live UAT re-run (row 1), not green unit tests; mirrors the 149-08..10 false-green-avoidance posture"

patterns-established:
  - "Warm-then-sync-read: warm the TTL override cache with an await, then read it from a sync predicate — keeps resolve_calling_mode SYNC (D-14) while honoring an operator's DB toggle within the TTL window"

requirements-completed: []  # MODEL-01 intentionally left open — closes at phase verify-work (live UAT re-run + secure-phase)

# Metrics
duration: 18min
completed: 2026-07-13
---

# Phase 149 Plan 11: Structured-Path Pre-Injection Gate Summary

**Extended agent_loop's pre-injection gate so a DB-flipped `native_tools=False` compat-path model gets `TOOL_USAGE_INSTRUCTIONS` before the first stream — closing UAT Test-1's "still works" half where a STRUCTURED-routed model had no tool mechanism on iteration 0 and hallucinated a zero-tool non-answer.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-13T00:45Z (approx)
- **Completed:** 2026-07-13T01:05Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- **Root cause closed:** `_needs_pre_injection` previously hardcoded `active_provider == "openrouter" AND openrouter_tool_strategy == "xml"`. A DB-flipped model on any OTHER compat provider got NO pre-injection, and the STRUCTURED branch omits the native `tools` param — so iteration 0 had no tool mechanism at all. The post-stream fallback injection only takes effect "next iteration", but with no parsed tool call there IS no next iteration (circular — never activates for a fresh run).
- **Pure gate helper** `_should_pre_inject_structured(active_provider, effective_model, user_settings)` returns True when EITHER (a) OpenRouter+xml (byte-identical to the prior inline gate), OR (b) a non-anthropic/google provider whose sync `resolve_calling_mode` resolves STRUCTURED.
- **Warm-cache guarantee:** `run_agent_loop` now `await get_model_capability_async(_effective_model)` immediately before the sync gate read, so `resolve_calling_mode`'s DB-override consult reflects the operator's toggle even on the `body.provider`-set branch where `threads.py`'s warm-read is skipped.
- **Boundaries preserved:** OpenRouter+xml, the no-override native path (D-14 byte-identical), and the anthropic/google native-SDK branch (WR-05) are all unchanged; injection site + fallback injection are byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing gate tests** - `a91cb334` (test)
2. **Task 1 (GREEN): _should_pre_inject_structured helper** - `b6d1d6cf` (feat)
3. **Task 2: wire gate into run_agent_loop + warm-cache** - `22161913` (feat)

_TDD: Task 1 split into test (RED) → feat (GREEN); no refactor needed (helper was clean)._

## Files Created/Modified

- `backend/app/services/agent_loop.py` — Added the `_should_pre_inject_structured` pure helper beside `_format_tool_list`; added `resolve_calling_mode` to the existing `openai_service` import block; replaced the inline `_needs_pre_injection` tuple with `_effective_model` computation + `await get_model_capability_async` warm + the helper call.
- `backend/tests/test_149_native_tools_routing.py` — Extended the existing file (reusing its `_warm_cache` monkeypatch) with 4 gate tests: A (openai native_tools=False → True), B (no-override native → False, D-14), C (anthropic/google excluded even with OVR → False, WR-05), D (openrouter xml True; native/quality False).

## Decisions Made

- **Shared gate, no per-provider fork** — the fix holds for all 7 compat providers via one predicate (cross-provider RED LINE).
- **WR-05 exclusion is mandatory** — anthropic/google route to always-native adapters that never read `native_tools`; structured injection there would pollute a real native tool-carrying request. Test C proves the exclusion (not the absence of an OVR) is what holds the boundary.
- **MODEL-01 left open** — per the plan's own verification note and the 149-08..10 posture: green unit tests alone are NOT the closing gate for this request-path fix (the twice-repeated wire-level lesson). The SERVED-artifact proof is the live UAT re-run of row 1 at verify-work.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's verify command used `python -c "ast.parse(open(...).read())"`; on Windows the default `open()` uses cp1252 and choked on the file's UTF-8 em-dashes (`UnicodeDecodeError`, NOT a syntax error). Re-ran with `encoding='utf-8'` (parses clean) plus a real `import app.services.agent_loop` (imports OK). No code impact.

## Verification

- `tests/test_149_native_tools_routing.py` — 9 passed (5 existing + 4 new gate tests).
- `tests/test_149_clamp.py tests/test_149_native_tools_routing.py` — 21 passed (shipped native_tools + clamp behavior unregressed).
- `agent_loop.py` parses (UTF-8 AST) and imports cleanly.
- **Pending (closing gate):** live UAT re-run of 149-HUMAN-UAT.md row 1 — with `native_tools` OFF on a compat model, "list the top-level folders" must FIRE a tool and return a real folder list (no hallucinated non-answer). Driven at `/gsd:verify-work 149`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap closed at code + unit level; ready for the live UAT re-run (row 1) + `/gsd:verify-work 149` → `/gsd:secure-phase 149`.
- Plan 149-12 (suggestion `<think>` leak, Test 7 minor) still pending — the remaining round-2 gap.
- MODEL-01/MODEL-02 close at phase verify-work once the live re-run confirms the SERVED behavior.

## Self-Check: PASSED

- FOUND: `backend/app/services/agent_loop.py` (helper `_should_pre_inject_structured` present, 2 refs)
- FOUND: `backend/tests/test_149_native_tools_routing.py`
- FOUND commit: `a91cb334` (test RED)
- FOUND commit: `b6d1d6cf` (feat GREEN)
- FOUND commit: `22161913` (feat wiring)

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-13*
