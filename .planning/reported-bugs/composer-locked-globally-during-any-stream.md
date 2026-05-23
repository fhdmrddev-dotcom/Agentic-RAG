---
id: BUG-260523-01
title: Composer input is locked across all threads while ANY stream is in flight (refresh required to unlock)
reported: 2026-05-23
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/chat-surface, StreamsProvider]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 46e8a63
  date: 2026-05-23
---

# BUG-260523-01: Composer input locked across threads during any active stream

## What we observed

User starts a long-running multi-tool task on Thread A (e.g., "search for Fahed Mrad dissertation, make a professional pptx…"). While Thread A is mid-stream, the user navigates to Thread B (or opens a brand-new chat). The composer / "Ask anything…" input on Thread B is **disabled** — the send button is greyed out and the user cannot type or submit a prompt to Thread B.

The lock persists until the Thread A stream completes OR the user performs a hard browser refresh (F5 / Cmd-R). After refresh, Thread B's composer is usable again (even if Thread A is still streaming server-side — the client's in-memory streaming flag was cleared by the navigation reload).

User-facing impact: parallel work is impossible. Any code-execution-heavy run (especially Anthropic + multi-iteration agent flows that can run 5–10 minutes) blocks the entire app's composer for that duration.

## Why it matters

This is a parallel-work regression that surfaced with the StreamsProvider Context Lift (Phase 068). Users cannot reasonably run a long Anthropic agent in one thread while typing a quick OpenAI question in another. For users with multi-thread workflows (the most engaged users), this functionally degrades the app to single-thread serial usage during any long agent run.

Refresh-to-unlock proves the bug is purely client-side state: the server has no per-thread lock; only the in-memory `isStreaming` boolean is gating the UI.

## Hypothesized cause

`isStreaming` is a **global** boolean on `useStreamsStore` (`frontend/src/stores/streamsStore.ts:46` — declared as `isStreaming: boolean` at the store root, not keyed by `threadId` or `surfaceId`).

It's flipped:
- `frontend/src/providers/StreamsProvider.tsx:912` → `isStreaming: true` when `sendMessage` opens an SSE stream
- `frontend/src/providers/StreamsProvider.tsx:1057` → `isStreaming: false` when that stream closes
- `frontend/src/providers/StreamsProvider.tsx:615` (reconcile path) → `isStreaming: false` when no active runs

`ChatArea.tsx:30` destructures `isStreaming` from `useMessages()` (which proxies the global store) and passes it directly to `<MessageInput disabled={isStreaming}>` at line 221. The disabling has **no thread-id check** — it gates the input on the global flag regardless of which thread is currently rendered.

The legacy comment block at `streamsStore.ts:10-15` even calls out this design ("`isStreaming AUDIT (Plan 2 Task 3 — Branch A required)` … `<MessageInput disabled={isStreaming} />`") suggesting the global single-flag shape was an explicit Phase 068 decision, not an accident. But it was made without accounting for the cross-thread interaction.

## Suggested fix path

Change `isStreaming` from `boolean` to `Set<string>` of streaming thread ids (or a `Map<threadId, runId>`). Update:

1. `streamsStore.ts:46` — `isStreaming: Set<string>` (set of `threadId`s currently streaming).
2. `StreamsProvider.tsx:912` / `:1057` / `:615` — `add`/`delete` the specific `threadId` instead of toggling a boolean.
3. Add a selector `useIsStreamingForThread(threadId): boolean` that does the per-thread lookup. Replace the global `useIsStreaming` consumer in `ChatArea.tsx:30` with the per-thread variant scoped to the currently-viewed thread.
4. Keep a derived global `useIsStreamingAny(): boolean` for any rare consumer that still needs the global flag (e.g., a "1 task running" badge in the nav).

Acceptance: opening Thread B while Thread A streams shows an enabled composer on Thread B; submitting a prompt on Thread B starts a second stream that the user can observe via the snapshot endpoint or tool card on its own thread.

## Related

- Phase 068 (StreamsProvider Context Lift) — introduced the global flag
- Phase 075 (snapshot endpoint) — adjacent to the streaming-state machinery but did not touch this flag
- BUG-260514-01 / `streaming-indicator-top-bottom-desync.md` — different bug but adjacent codepath (the indicator hook reads the same global)
