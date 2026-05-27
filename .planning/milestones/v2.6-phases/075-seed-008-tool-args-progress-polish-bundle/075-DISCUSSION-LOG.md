# Phase 075: SEED-008 + tool_args_progress Polish Bundle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 075-seed-008-tool-args-progress-polish-bundle
**Areas discussed:** Snapshot endpoint shape + cutover, Sandbox line-by-line stdout mechanism, tool_args_progress payload + chunking, Reported bug fold-ins

---

## Snapshot endpoint shape + cutover

### Q1: What should GET /threads/{id}/snapshot return for since_cursors?

| Option | Description | Selected |
|--------|-------------|----------|
| Server-derived from Redis stream | Backend reads `run:{run_id}` stream state; frontend uses verbatim on subsequent reconnects; `lastSeenOffsetRef` wins after first attach | ✓ |
| Always '0' | Simplest contract; server stateless about replay position | |
| Omit when empty | Defer the field; risk of inconsistent contract vs SC #1 | |

**User's choice:** Server-derived from Redis stream
**Notes:** Captured as D-075-01. Implementation detail (XINFO STREAM vs XRANGE) deferred to planner.

### Q2: How should the frontend cut over from the 3-call chain to /snapshot?

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic swap in StreamsProvider.reconcile + loadMessages | Replace `Promise.all([getActiveRuns, loadMessages])` at L482-485 with single `getSnapshot()` call; no flag, no coexistence | ✓ |
| Behind feature flag (app_settings) | Gradual rollout; settings table touch | |
| Coexist permanently — opportunistic with fallback | Safest; double-maintenance forever | |

**User's choice:** Atomic swap in StreamsProvider.reconcile + loadMessages
**Notes:** Captured as D-075-02. Phase 067.5 Branch D-3 streaming-bucket guard at `useMessages.ts:572-590` preserved verbatim.

### Q3: Should /snapshot reuse the existing /messages enrichment logic?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — share helper function | Extract `_enrich_messages_with_runs`; both endpoints call it | ✓ |
| No — client merges | Spreads merge logic to frontend; breaks MessageResponse contract | |
| Yes — inline duplicate | Lower upfront cost; future drift risk | |

**User's choice:** Yes — share a helper function; both endpoints return identical message shape
**Notes:** Captured as D-075-03.

### Q4: How should /snapshot handle the auth/ownership + Redis-down failure modes?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror D-062-12 / D-062-13 exactly | 404 cross-user, 503+Retry-After:10 on Redis | ✓ |
| Partial degraded snapshot on Redis-down | Messages + active_runs serve from Postgres only; since_cursors null | |
| Skip Redis probe entirely | Pure Postgres; silent inconsistency if Redis down | |

**User's choice:** Mirror D-062-12 / D-062-13 exactly: 404 cross-user, 503+Retry-After:10 on Redis
**Notes:** Captured as D-075-04. Zero new posture; reads identical to existing endpoints.

---

## Sandbox line-by-line stdout mechanism

### Q1: How should we get line-by-line stdout out of the sandbox container?

| Option | Description | Selected |
|--------|-------------|----------|
| Stop using session.run(); Docker SDK exec_run with stream=True directly | Bypass InteractiveSandboxSession.run() for execute_code; llm-sandbox session stays for lifecycle + harvest_output_files | ✓ |
| Poll container's stdout file via tail | Redirect Python stdout to /tmp/sandbox_stdout; background thread tails; risks duplication or interleaving | |
| Switch to llm-sandbox streaming variant | Library may not have one; could block phase indefinitely | |
| Eat the latency — poll exec_result on separate path | Functionally equivalent to (a) but more complex | |

**User's choice:** Stop using session.run(); use Docker SDK exec_run with stream=True directly
**Notes:** Captured as D-075-05. Actually solves the root cause (the no-op callback) instead of working around it. llm-sandbox dependency stays for session lifecycle + harvest.

### Q2: What emit cadence should code_stdout use?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-line, no batching | Each stdout line = one code_stdout event with captured_at; trust SSE/Redis backpressure | ✓ |
| Batch by time (~100ms) / size (~4KB) | Fewer events; harder per-line semantic | |
| Hybrid adaptive (per-line until >20/s) | Smart but hard to test | |

**User's choice:** Per-line, no batching — trust SSE/Redis backpressure
**Notes:** Captured as D-075-06. Makes SC #2 monotonic-captured_at assertion trivial.

### Q3: Should the post-completion stdout emit at threads.py:2213-2218 be removed?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it — mid-flight emit owns stdout entirely | Single source of truth; integration test asserts no double-emit | ✓ |
| Keep as safety net for unflushed suffix | Defensive against partial-line buffering inside Docker SDK | |
| Keep verbatim; dedup in frontend | Punts to frontend; masks real bugs | |

**User's choice:** Remove it — mid-flight emit owns stdout entirely; post-completion is dead code
**Notes:** Captured as D-075-07. Also applies to the stderr block at 2216-2218.

### Q4: Should code_executing heartbeats keep firing when code_stdout is actively emitting?

| Option | Description | Selected |
|--------|-------------|----------|
| Heartbeat only during silent windows (>1s with no stdout) | Reset heartbeat timer on every code_stdout flush | ✓ |
| Heartbeat every 1s regardless (Phase 067.4 verbatim) | Noisier SSE stream; no deviation from D-067.4-R5-01 | |
| Heartbeat only after >5s silence | Risks worsening BUG-260514-03 (longer blank windows) | |

**User's choice:** Heartbeat only during silent windows (>1s with no stdout)
**Notes:** Captured as D-075-08. Preserves SC #4 invariant ("code_executing heartbeat is preserved — code_stdout re-wire is additive") while eliminating redundant signals during chatty execution.

---

## tool_args_progress payload + chunking

### Q1: What should the args_so_far field in tool_args_progress contain?

| Option | Description | Selected |
|--------|-------------|----------|
| Cumulative full args buffer (truncated to last 5KB tail) | Sliding-window tail of accumulator; total_args_bytes_so_far has real size | ✓ |
| Cumulative unbounded | Simplest; breaches SC #3 size cap; floods large-tool streams | |
| Delta-only chunk | Smaller per-event; frontend must reconstruct; codepoint-split risk | |

**User's choice:** Cumulative full args buffer (truncated to last 5KB for transport)
**Notes:** Captured as D-075-09. UTF-8-aware truncation per planner.

### Q2: When should tool_args_progress fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Every 5KB-accumulated boundary (5KB, 10KB, 15KB, ...) | Track last_emit_boundary per tool_index | ✓ |
| On every delta past 5KB threshold | Maximum granularity; risk of chatty stream | |
| Time-based 200ms throttle | Smoother UI; doesn't compose with delta accumulator | |

**User's choice:** Every 5KB-accumulated boundary
**Notes:** Captured as D-075-10. Max event count = ceil(total_args / 5120).

### Q3: How should the execute_code filter + structured-mode work?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip execute_code AND skip when calling_mode == CallingMode.STRUCTURED | Two explicit filters in emit guard | ✓ |
| Skip execute_code; single-event for structured >5KB | Parity at finish_reason | |
| Skip execute_code only; ignore structured silently | Implicit; future contributor risk | |

**User's choice:** Skip when tool name is 'execute_code' AND skip when calling_mode == CallingMode.STRUCTURED
**Notes:** Captured as D-075-11. execute_code deferred to v3.0 Skill Studio per REQUIREMENTS.md line 65.

### Q4: Should a frontend consumer (tool-card preview) ship in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| No — backend SSE primitive only | Integration test asserts event fires; UI deferred to v3.0 | ✓ |
| Yes — minimal "Sending args (N KB)…" counter | One extra frontend file | |
| Yes — progressive args preview | Most polished; biggest scope increase; PII/privacy risk | |

**User's choice:** No — backend SSE primitive only; integration test asserts the event fires; no UI consumer yet
**Notes:** Captured as D-075-12. Same v3.0 Skill Studio milestone that re-enables execute_code emit.

---

## Reported bug fold-ins

### Q1: Fold BUG-260518-01 (Resume button mid-stream) into Phase 075?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold — snapshot endpoint IS the reconcile-fetch primitive that closes it | Backend + frontend three-file fix; ships in Plan 01 | ✓ |
| Defer to its own decimal phase (075.1) | Cleaner scoping; extra release cycle of the regression | |
| Defer to v2.7 Agent Workspace | Weakens v2.6 production-shape claim (major severity) | |

**User's choice:** Fold — and the snapshot endpoint (Plan 01) is the reconcile-fetch primitive that closes it
**Notes:** Captured as D-075-13. Folds into Plan 01.

### Q2: Fold BUG-260514-03 (top/bottom indicator desync) into Phase 075?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold — sticky text + subscribe to new code_stdout heartbeats | Composes with Plan 02 per-line emit | ✓ |
| Fold cheaper half only (sticky text) | Smaller diff; loses polished feel | |
| Defer — minor severity | Continued confusion during long executions | |

**User's choice:** Fold — sticky bottom-indicator text + subscribe to new code_stdout heartbeats
**Notes:** Captured as D-075-14. Folds into Plan 02.

### Q3: What to do with BUG-260514-02 (Anthropic narration vs synthesized summary)?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer again — same reasoning as Phase 074 routing | Refresh re_open_trigger; root cause is system-prompt / block ordering, orthogonal to 075 | ✓ |
| Fold narrow synthesis-tail task | Risk of half-fix if frontend hypothesis is right | |
| Promote to dedicated 075.1 | Reasonable middle path; adds backlog | |

**User's choice:** Defer again — same reasoning as Phase 074 routing
**Notes:** Captured as D-075-15. Refreshed re_open_trigger points at v2.7 Agent Workspace OR future Anthropic system-prompt redesign OR optional 075.1.

### Q4: Plan split — how should the 3-plan budget map to the work?

| Option | Description | Selected |
|--------|-------------|----------|
| 01: snapshot+cutover+BUG-518 \| 02: code_stdout+BUG-514-03 \| 03: tool_args_progress | Each plan ships a complete user-visible win; within-plan dependencies | ✓ |
| 01: snapshot backend \| 02: snapshot frontend+BUG-518 \| 03: code_stdout+tool_args+BUG-514-03 | Cleaner backend/frontend boundary; denser Plan 03 | |
| One plan per SC; bug fixes as extra tasks | Most literal ROADMAP read; less natural dependency bundling | |

**User's choice:** Plan 01: snapshot endpoint + frontend cutover + BUG-260518-01 fix | Plan 02: line-by-line code_stdout + BUG-260514-03 indicator | Plan 03: tool_args_progress
**Notes:** Captured as D-075-16. Plans 02 and 03 independent (parallel-able); Plan 01 also independent.

---

## Claude's Discretion

Areas explicitly left for Claude/planner to decide:
- Pydantic response model (new `ThreadSnapshotResponse` composing existing `MessageResponse` + `ActiveRunResponse`).
- Integration test file naming and scaffolding location (next to test_063_post_then_subscribe.py).
- Chrome MCP UAT cadence for SC #1 cold-cache latency measurement.
- Docker SDK exec_run API choice (high-level `container.exec_run(stream=True)` vs lower-level `client.api.exec_create + exec_start`).
- Per-line buffering from Docker SDK byte chunks (line-split on `\n`, trailing partial line flush at completion).
- Code-review depth (Standard for Plans 01 + 02; Quick for Plan 03).

## Deferred Ideas

- BUG-260514-02 (Anthropic narration vs synthesized summary) — deferred again per D-075-15; refreshed re_open_trigger.
- tool_args_progress for execute_code — out of scope; v3.0 Skill Studio.
- Frontend consumer for tool_args_progress — v3.0 Skill Studio.
- Adaptive emit cadence for code_stdout — rejected; trust Redis backpressure.
- Snapshot endpoint feature flag — rejected; atomic swap is the right move.
- Snapshot partial-degraded shape on Redis-down — rejected; mirror D-062-13.
- Frontend dedup for double-emit stdout — rejected; producer-side single source of truth.
- Fixed 1Hz heartbeat regardless of stdout — rejected per D-075-08.
- Switching to streaming-capable llm-sandbox variant — rejected per D-075-05.
- Multi-worker compatibility audit — Phase 077 / D-PRD-12 territory; no incremental risk.
