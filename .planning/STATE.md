---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Stability, Polish & UX Fixes
status: executing
stopped_at: Phase 54 context gathered
last_updated: "2026-04-26T15:00:00.000Z"
last_activity: 2026-04-26 -- Phase 54 context captured (discuss-phase complete)
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 33
  completed_plans: 27
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 54 — next phase in v2.4 milestone

## Current Position

Phase: 53 — COMPLETE
Plan: 4 of 4
Status: Executed and verified
Last activity: 2026-04-26 -- Phase 53 all plans executed and verified

Progress: [█████████░] 90%

Next: Phase 54 — TBD

## Phase 53 Plan Summary

1. **Plan 53-01: Capability Registry + Dual-Mode Backend** — MODEL_CAPABILITIES registry in config.py, create_adaptive_streaming_chat() with native/structured routing, OpenRouter quality enhancements (`:exacto`, `parallel_tool_calls=False`, Response Healing). Backend only.
2. **Plan 53-02: OpenRouter Strategy Setting** — `openrouter_tool_strategy` enum field (quality/native/xml) with backend settings stack and frontend dropdown in AI Model Settings tab.
3. **Plan 53-03: JSON Tool Call Parser** — Dedicated `tool_parser.py` module with `ToolCall` dataclass, markdown/inline JSON extraction, tool name validation. Integrates into threads.py event_stream().
4. **Plan 53-04: Validation & Zero-Regression Tests** — `test_tool_parser.py` (12+ tests), `test_calling_mode.py` (14+ tests), `test_openai_service.py` (6+ tests). Confirms zero regression in existing suite.

## Recent Completed Phases

### Phase 52: Multi-Provider Model Routing (Complete 2026-04-25)
- Full provider-aware routing for main, sub-agent, title, and follow-up models
- Cross-provider 404 fallback with SSE sentinel and user notification
- Save-time validation for sub_agent_model against provider's available models
- Resolved model labels in Settings UI

### Phase 51: Context Window Management (Complete 2026-04-24)
- Sub-agent keyword routing (generation tasks escalated to capable models)
- tiktoken integration for OpenAI token estimation
- Configurable sub_agent_max_output_tokens with Settings UI slider
- Model info cards in chat model selector

## Performance Metrics

**Velocity:**

- Total plans completed: 66 (across v1.0–v2.4)
- Previous milestones: v1.0 (8 phases), v2.0 (9), v2.1 (8), v2.2 (7), v2.3 (11), v2.4-in-progress (9)
- Average duration: ~1 day/phase

**Recent Trend:**

- Last phase shipped: Phase 52 (3 plans)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Roadmap Evolution

- Phase 52 added: Multi-Provider Model Routing — full provider-aware routing for all agent roles, cross-provider sub-agent fix, model fallback on unavailable models
- Phase 53 added: Cross-Provider Tool Calling Reliability — capability registry with native/structured dual-mode tool calling, user-controllable OpenRouter strategy, deterministic JSON parser for non-native models

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **D-53-01**: Two calling modes — Native (API tools param) for proven models, Structured (JSON-in-prompt) for everything else. No retries, no fallbacks, one-shot deterministic.
- **D-53-02**: Unknown models default to structured mode (`native_tools: false`). Safe by default; user flips flag after testing.
- **D-53-03**: OpenRouter strategy global setting with three modes: `quality` (default, uses `:exacto` + Response Healing), `native` (assumes tool support), `xml` (forces structured).
- **D-53-04**: OpenAI path is identical to before. Capability check is O(1) dict lookup. Zero additional latency.
- No cancel endpoint for SSE stop — GeneratorExit mechanism is fast enough for v2.4
- Side phase numbering uses `side-NNN` prefix (separate from sequential phases)
- SSEStreamingResponse uses stop_event mechanism for immediate client-disconnect detection
- `abortStream()` vs `stopStreaming()`: navigation aborts quietly (no "stopped" label), explicit Stop sets stopped flag
- AlertDialog confirmation before thread delete — client-side UX safeguard only; RLS provides actual security
- clearMessages on thread switch prevents ghost content flash — synchronous reset before async loadMessages
- NavPanel folder picker toggles visibility; collapsed sidebar hides picker via existing opacity-0 pattern
- scope=version|all delete: FastAPI Query(pattern=) for enum validation; user_id guard on both SELECT and DELETE paths
- Version-aware delete dialog: 3-button footer for multi-version, 1-button for single-version; error-in-dialog pattern

### Pending Todos

None — Phase 53 complete.

### Completed Todos (Phase 53)

| Phase | Task | Status |
|-------|------|--------|
| 53-01 | Create MODEL_CAPABILITIES registry | ✅ Complete |
| 53-01 | Implement create_adaptive_streaming_chat() | ✅ Complete |
| 53-01 | Add structured mode system prompt injection | ✅ Complete |
| 53-02 | Add openrouter_tool_strategy backend field | ✅ Complete |
| 53-02 | Add frontend dropdown UI | ✅ Complete |
| 53-03 | Create tool_parser.py module | ✅ Complete |
| 53-03 | Integrate parser into threads.py | ✅ Complete |
| 53-04 | Write 32+ unit tests | ✅ Complete |

### Blockers/Concerns

- UAT verification gaps from v2.3 (phases 038–042) still require live browser testing
- Metadata normalization only covers document_type/language
- 15 backend test failures remain from side-phase 002 (test-suite-remediation)
- Phase 46 human UAT (3 items): CASCADE cleanup, dialog rendering, non-contiguous version promotion

### Known Issues

- **KI-001:** In-flight LLM calls and tool executions continue after SSE disconnect because Python async generators can only receive `GeneratorExit` at `yield` points. The current LLM call or tool execution runs to completion before the generator stops. Iteration stops immediately after, preventing new rounds. See `.planning/KNOWN-ISSUES.md`.

## Deferred Items

Items acknowledged and carried forward from v2.3 milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UAT | Phases 038–042 need live browser verification | human_needed | v2.3 |
| Tech debt | Metadata normalization only covers document_type/language | Known | v2.1 |
| Test suite | 15 backend mock compatibility failures | side-002 | v2.4 |

## Session Continuity

Last session: 2026-04-26
Stopped at: Phase 53 execution complete
Next: Phase 54 — TBD
