---
id: BUG-260518-01
title: Resume button appears mid-stream during long code execution
reported: 2026-05-18
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/chat-ui, backend/sse, backend/redis-streams]
folded_into: null
related_seeds: [SEED-007, SEED-008, SEED-025]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 2996d0a
  date: 2026-05-18
---

# BUG-260518-01: Resume button appears mid-stream during long code execution

## What we observed

During a long-running chat turn that includes Python code execution (e.g., the
`pptx` skill generating a presentation, multi-step data analysis, or any tool
call where the sandbox container runs for >~30 seconds), the **Resume button**
appears in the assistant message **while the code is still actively running**.

The user clicks Resume thinking the run failed; actual code execution is still
proceeding in the sandbox. The streaming UI is desynced from the real run
state — the SSE stream emitted a `buffer_expired_during_tail` event, the
frontend interpreted it as a terminal failure, but the backend run row in
`runs` was never set to `failed`.

Repro (post-Phase 074, commit `2996d0a`):
1. Open chat at `http://localhost:5173/`, select any model with sandbox tool use
2. Send a prompt that triggers a long Python execution (e.g., "build me a
   pptx from this document" against a >50-page PDF)
3. Watch the assistant message during execution — within ~30s the Resume
   button appears under the partial assistant content
4. Backend `runs.status` in Supabase remains `streaming` — final state still
   flips to `completed` when sandbox returns, but UI has already shown Resume

## Why it matters

**Severity: major** — user-visible UX regression. Clicking Resume during an
in-flight code execution would (a) duplicate the request, (b) cancel the
in-flight run, or (c) cause confusion about whether the original output is
trustworthy. None of these are acceptable for the long-running sandbox flows
v2.6 explicitly invests in (SEED-002 Skill Studio, SEED-025 sandbox telemetry).

Compounds with SEED-008 streaming UX polish (already on Phase 075 docket) —
this is the most visible streaming-UI defect right now.

## Hypothesized cause

**Trigger chain (Explore-agent diagnosis 2026-05-18):**

1. Backend code execution heartbeat (`code_executing` SSE events at ~1 Hz)
   gaps when sandbox container is doing CPU-bound work without yielding
   stdout — silent windows >5s are normal during e.g. matplotlib rendering or
   pandas aggregation
2. `backend/app/api/runs.py:221-235` `replay_tail_consumer` Redis BLOCK
   window is ~5s; combined with socket idle timeout (~2s), an idle gap
   between heartbeats triggers `redis.exists(stream_key)` check
3. If the consumer hits the deadline before next heartbeat arrives, it
   yields `{"type": "error", "error": "buffer_expired_during_tail"}` to the SSE
   stream
4. Frontend `lib/api.ts:390-408` onTerminal handler maps `kind="error"` →
   `runStatus: "failed"` via `_RUN_STATUS_TO_TERMINAL_TYPE` inverse lookup
5. `StreamsProvider.tsx:689-720` updates the Message with
   `runStatus: "failed"` + sets `isStreaming: false` in finally
6. `MessageItem.tsx:118` shows Resume button: `!isStreaming &&
   (runStatus === "failed" || runStatus === "timed_out")` — both conditions
   now true, button renders
7. Meanwhile backend `runs.status` is still `streaming` and will eventually
   flip to `completed` when sandbox returns — but the UI never re-syncs

## Surface classification

**Agentic-RAG** — own-code defect at the SSE/Redis-stream boundary, not an
upstream provider behavior. Cross-checks at `/gsd:discuss-phase 075` per the
CLAUDE.md MANDATORY rule.

## Suggested routing

- **Fold into in-flight phase:** **Phase 075 (SEED-008 streaming UX polish)** —
  natural fit. The cluster of streaming-resilience improvements lives here;
  adding "distinguish heartbeat-gap from genuine stream end" tracks the same
  surfaces.
- **Defer to future phase / milestone:** n/a — should ship in v2.6 before
  any production-shape rollout (SEED-008 is already v2.6 scope).
- **Plant as seed:** n/a — concrete bug with concrete fix surface.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- **User workaround today:** ignore the Resume button when an active
  `code_executing` indicator is visible. Wait for the final assistant message
  to render before deciding whether the run actually failed.
- **No reliable code-side workaround** — backend will eventually flip
  `runs.status` to `completed`; UI just doesn't reconcile from that state
  once the provisional `failed` was set.

## Reference / evidence links

- `frontend/src/components/chat/MessageItem.tsx:118` — Resume button visibility
  condition
- `frontend/src/providers/StreamsProvider.tsx:689-720` — onTerminal handler
  that sets `runStatus: "failed"`
- `frontend/src/lib/api.ts:390-408` and `:449` — defensive fallback that
  emits the error terminal kind
- `backend/app/api/runs.py:80-290` — `replay_tail_consumer` with deadline
  guard + TTL-expiry detection (the heartbeat-gap source)
- `backend/app/api/threads.py:90-102` — `TERMINAL_TYPES` and
  `_RUN_STATUS_TO_TERMINAL_TYPE` mapping table
- `frontend/src/types/index.ts:113` — `runStatus` enum:
  `"streaming" | "completed" | "failed" | "cancelled" | "timed_out"`

**Fix surface (3 files):**
1. `backend/app/api/runs.py:221-235` — distinguish "actively running code
   with heartbeat gap" from "stream genuinely expired"
2. `frontend/src/lib/api.ts:390-408` — map `buffer_expired_*` errors as
   transient/recoverable, not a terminal failure
3. `frontend/src/providers/StreamsProvider.tsx:689-700` — gate Resume on
   confirmed terminal `runs.status` (via reconcile fetch), not on
   provisional SSE error
