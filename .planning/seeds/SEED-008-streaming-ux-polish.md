---
seed_id: SEED-008
title: Streaming UX polish — thread-switch latency + line-by-line stdout streaming
created: 2026-05-09
status: planted
priority: medium
re_open_triggers:
  - User complains about "delays" or "lag" when navigating between chat threads in any future UAT cycle
  - Sandbox-heavy users request "watch the code execute" feature (line-by-line stdout as it runs)
  - v2.6 milestone planning starts and rates UX polish as table-stakes
  - Single-user feedback consistently mentions perceived sluggishness (not just one-off observation)
relates_to:
  - Phase 067.4 closing UAT (2026-05-09) — user identified both gaps during Row 11 testing
  - SEED-001 scale-readiness (multi-user perf is the upstream constraint)
  - useMessages.ts:384-450 (ref-mirror sites flagged in Phase 067.4 RESEARCH.md)
---

# Streaming UX polish — two gaps surfaced during Phase 067.4 closing UAT

## Gap 1: Thread-switch perceived latency

**Observed (2026-05-09):** When clicking between chat threads in the sidebar, content does not paint immediately. There is a perceptible delay (sometimes "delay until other chats finish (partially)") before the destination thread renders.

**Root cause (already understood):** Each thread switch triggers a sequential chain:
1. `GET /threads/{id}/messages` — DB round-trip (~100-300ms)
2. `GET /threads/{id}/active-runs` — check streaming state
3. (If active run found) `GET /runs/{run_id}/stream?since=N` — reconnect SSE replay
Plus React state reconcile on the merge logic at `useMessages.ts:639-651`.

**Why it feels worse with multiple in-flight streams:** Single uvicorn worker (per CLAUDE.md D-v2.5-02) means all SSE connections share one Python event loop. Coupled with provider-specific latency variance (OpenRouter is observably slower than direct OpenAI/Anthropic — extra network hop through the OpenRouter proxy), the worker spends async time servicing slower streams while the user waits on a faster local DB call.

**What 067.x phases optimized for:** correctness (no cross-thread leak, no missed terminal events, no GeneratorExit on timeout). Performance was explicitly NOT in scope.

**Possible fixes (for future phase):**
- **Optimistic rendering on switch** — show cached `messagesByThread` bucket immediately; reconcile in background. Risk: stale content briefly visible.
- **Parallelize the 3 sequential calls** into a single combined endpoint (`GET /threads/{id}/snapshot` returning messages + active-runs in one round-trip). Adds backend work but cuts perceived latency.
- **Pre-fetch on hover** — mouse-over a thread title pre-fetches its messages, so the click is instant.
- **Service worker / IndexedDB cache** — persist thread content client-side; serve from cache while reconciling against server.

**Triggers to re-open:** any new round of "feels slow" feedback, or before v2.6 ships to multi-user beta.

## Gap 2: Sandbox stdout — line-by-line streaming during execution

**Observed (2026-05-09):** When the agent runs sandboxed Python code (e.g., `for i in range(5): print(i); time.sleep(1)`), the user sees:
- A live "Executing… 2.4s" elapsed counter during the run (Plan 03 R-5 ✅)
- A post-completion `Output (6 lines)` panel with all stdout at once

The user expected to see lines appear progressively — `0` at t=1s, `1` at t=2s, etc. — like watching a real terminal.

**Root cause:** Plan 03 explicitly chose NOT to revive the dead `on_stdout`/`on_stderr` callbacks at `backend/app/api/threads.py:2014-2024` (CONTEXT.md decision: "deletion is OPTIONAL ... chosen NOT to delete to keep diff minimal"). The current emit path waits for `code_execution_complete` then emits all stdout in one batch. The Plan 03 heartbeat ONLY emits `code_executing` ticks with `tool_index + elapsed_seconds` — no actual output content during execution.

**What's needed (for future phase):**
- Re-wire `on_stdout`/`on_stderr` callbacks to fire `code_stdout` SSE events as each line is captured by the sandbox
- Frontend handler appends lines progressively to the Output panel during execution (currently the Output panel only appears after completion)
- Consider buffering rate (one event per line vs batched every 100ms) to avoid flooding for noisy stdout
- Preserve the Plan 03 heartbeat — it's still useful for "is the code stuck?" indication when stdout is silent

**Test to add:** integration test that submits a sandbox prompt with timed prints (e.g., `[print(i) or time.sleep(0.5) for i in range(5)]`) and asserts the SSE stream contains AT LEAST 3 distinct `code_stdout` events with monotonically increasing timestamps spanning > 1 second (proves progressive emit, not batched).

## Adjacent observation: provider latency variance

User noted: "openrouter modles are much slower in response than direct providers, we should consider this also."

This is **expected** and not a bug:
- OpenRouter is a router/proxy — each request makes an extra network hop through OpenRouter's backend before reaching the actual model (Kimi, Minimax, etc.)
- Direct providers (OpenAI, Anthropic) talk SDK-direct
- Some OpenRouter-routed models also have weaker first-shot tool-use accuracy (e.g., Kimi 2.5 generated invalid code multiple times before recovering during the user's UAT)

**No fix needed at the streaming layer** — this is a provider characteristic. Could be surfaced in UI as a "via OpenRouter" badge near the model picker so users know to expect higher latency.
