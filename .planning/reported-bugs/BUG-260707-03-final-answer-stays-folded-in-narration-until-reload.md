---
id: BUG-260707-03
title: Final answer stays folded inside the streaming-narration collapsible after a Deep run ends (until reload)
reported: 2026-07-07
surface: Agentic-RAG
severity: minor                    # FIXED 2026-07-07 (same day) — scoped content reconcile at clean Deep terminal
status: folded                    # folded_into 176 (2026-07-22) — extend reconcile to nav/mount path + live-verify; see 176-CONTEXT.md D-07/D-08
affected_areas: [frontend/chat-ui, frontend/streaming]
folded_into: "176, 243"   # residual #2 (the nav/mount path) routed to 243 / CHAT-05 at /gsd:plan-phase 243, 2026-09-11
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: null
resolution_applied: 2026-07-07
reproduces_on:
  branch: develop
  commit: cb9fef39
  date: 2026-07-07
---

# BUG-260707-03: Final answer stays folded under the "thinking" narration after a run ends

## What we observed

The StreamingNarration fold (the collapsible "thinking" gist added in Phase-3 of
the chat-UX work, commit `6df7f8a2`) collapses/expands correctly **during** a run.
But **after the run ends**, the final answer is still folded *inside* that
narration collapsible instead of rendering as a separate, normal answer. It only
"resolves" to a clean answer on a later page reload / thread navigation.

## Why it matters

Minor but felt: the user watches their final deliverable summary sit as a
one-line collapsed gist at run-end rather than reading as a clean answer. The
"resolve to answer" half of the original narration-fold design worked on reload
but never fired live.

## Root cause (confirmed in code)

`onDelta` may only APPEND to `message.content` (the StreamsProvider.tsx:358
invariant — required so Anthropic's interleaved text+tool_use isn't lost). So the
LIVE `message.content` is the WHOLE run's narration + final answer concatenated
into one growing blob. The backend, by contrast, persists only the **last
iteration's** content (the clean final answer — DB-verified: a 10-tool run saved
just the presentation summary).

`MessageItem.tsx:429` renders `StreamingNarration` while
`isMessageStreaming (= runStatus === "streaming")`. The final answer streams in as
the blob's tail *while runStatus is still "streaming"*, so it's folded with the
narration. At the clean terminal `runStatus` flips to "completed" → the render
switches to `MarkdownRenderer`, but it shows the accumulated blob (all narration +
answer), not the clean answer — and regular chat has **no run-completed content
reconcile** (`onRunCompleted` is harness-only, StreamsProvider.tsx:991). The clean
persisted answer only replaces the blob on the next `loadMessages` (reload / nav).

## Resolution applied (2026-07-07)

Scoped content reconcile in the send-path `onTerminal` (StreamsProvider.tsx): on a
clean Deep terminal (`done`/`reader_done`), fire-and-forget `getMessages(threadId)`,
find this run's persisted assistant message by `runId`, and swap **only** that
bucket message's `content` to the persisted answer. So the fold gives way to a
clean, separated answer **live** — no reload. Scoped to `content`, so it preserves
`tool_calls` / suggestions / output-files / `runStatus` (far lighter than a full
`loadMessages` replace, which would risk dropping streamed-only state). Best-effort
(the reload-time reconcile remains the floor, D-v2.5-03). Regression test:
`streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — streams a blob →
clean terminal → asserts content resolves to the persisted answer (fails pre-fix).

### Residuals (why status stays `open`)

1. **Not live-verified** — flip to `closed` after one live Deep run shows the
   answer resolving un-folded at run-end without a reload.
2. **Scoped to the send path** — the mount/reconcile-path terminal (a backgrounded
   run watched after navigation) still relies on reload; extend there if reported.
3. **Backend "wrong last-iteration content" edge** — for runs where the backend
   persisted a stray interim line instead of the real final answer (e.g. GLM run
   `c3bba996` saved "All checks pass. Let me finalize the task list."), the
   reconcile faithfully shows that stray line (consistent with reload). That is a
   separate backend final-answer-emit bug — see [[SEED-094]] (run-end honesty).

## Reference / evidence links

- Code: `StreamsProvider.tsx` (send-path onTerminal reconcile; :358 append invariant;
  :991 harness-only onRunCompleted); `MessageItem.tsx:429`; `StreamingNarration.tsx`.
- DB evidence: persisted assistant content = clean final answer for well-behaved
  runs (msg `d463ad62`), stray interim line for the GLM run (msg `c3bba996`).
- Introduced by: `6df7f8a2` (StreamingNarration fold). Related: SEED-094.

---

## Residual #2 routed to Phase 243 (CHAT-05) — 2026-09-11

Phase 176 shipped the **send-path** half of the reconcile. Residual #2 — *a run that finished while
the operator was on another page, watched after navigation* — **still relies on a reload**, and it is
now `CHAT-05` in Phase 243.

⭐ **Sketch 234 found its cause while drawing something else, and it is not the reconcile.** The
answer *is* already streaming: `StreamsProvider.tsx:415` appends `content: m.content + delta` per
token. But on a tool-bearing run `MessageItem.tsx:425` routes that content into `StreamingNarration`
— the folded italic gist — so it is written **inside the fold** and only surfaces when the run-end
reconcile swaps in the persisted text. **That makes `CHAT-01` and `CHAT-05` one defect, not two.**

⚠ Phase 243 must verify the **mount / navigation** path specifically, not only a live send — the
send path is exactly the half that already shipped, so a live-send check would pass while the
residual stands.
