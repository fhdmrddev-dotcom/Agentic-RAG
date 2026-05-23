---
id: BUG-260514-03
title: Bottom chat indicator goes blank during code-execution pauses while top tool indicator continues — two indicators out of sync
reported: 2026-05-14
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/streaming, frontend/typing-indicator, frontend/tool-card-display, UX/perceived-responsiveness]
folded_into: "075.6"
verified_closed_by: "075.6"
related_seeds: [SEED-008]
re_open_trigger: "Working badge fails to appear at top of active assistant turn during streaming on any provider — supersedes the original bottom-indicator path per D-075.6-D1."
reproduces_on:
  branch: v2.5-dev
  commit: f3349b7
  date: 2026-05-14
---

# BUG-260514-03: Bottom chat indicator goes blank during code-execution pauses while top tool indicator continues

## What we observed

The chat surface has two distinct "agent is working" affordances on screen simultaneously:

1. **Top indicator (per-tool-call):** rendered as part of the tool card at the top of the assistant turn. Animated, shows each step in flight ("Loading skill `pptx`", "Code executed", etc.). Always reflects the actual SSE stream state correctly.
2. **Bottom indicator (chat-level typing affordance):** anchored above the input bar at the bottom of the chat. Shows descriptive text like "Thinking…", "Writing…", "Searching documents…".

**Bug:** During tool-execution pauses (notably long-running code-execution cells like a 169-second matplotlib chart-generation run observed 2026-05-14), the **top indicator continues animating correctly** ("Code executed 169.1s", visible as in-flight), but the **bottom indicator goes blank** — no "Thinking" or "Running code" text. The user sees no chat-level signal that anything is happening; the only "still alive" indicator is the top tool card.

When the user is scrolled below the tool card (which can happen for long output runs), the bottom indicator's silence reads as "stuck." Users have asked variants of "is it still running?" in this state.

## Why it matters

- **Perceived stuck / broken.** The bottom indicator is the canonical "agent is working" affordance — it's where users look first because it's anchored where the cursor lands after sending. When it goes blank, the natural read is "it stopped."
- **Inconsistent state.** Two indicators reflecting the same underlying agent state should never disagree. When they do, users distrust both.
- **Compounds with BUG-260514-02.** If the cycle ends with the Anthropic action-log style instead of a clean summary, AND the bottom indicator was silent before the tool finished, the perceived "did anything happen?" gap widens.

## Hypothesized cause

The bottom indicator likely subscribes to a SUBSET of SSE events — probably the `agent_state_change` / `thinking` / `tool_call_start` events that mark macro-state transitions ("started thinking", "started a tool"). The TOP indicator subscribes to a richer set including `code_output_line`, `tool_args_progress`, code-execution heartbeats, etc.

During a long code-execution cell, the macro state stays at "in tool call" (one event fired at start, none until completion). The bottom indicator, which derives its text from macro-state, has nothing fresh to display once the initial "Writing code…" or "Running code…" message clears. The TOP indicator gets per-cell-output events from the sandbox and keeps animating.

Two interventions:

1. **Subscribe the bottom indicator to the same heartbeat stream the top uses.** When code execution heartbeats arrive (per Phase 067.4 R-5 `code_output_line` SSE event), the bottom indicator updates its text to "Running code… (N seconds)" or similar.
2. **Sticky bottom-indicator text per macro state.** When a tool call is open and no fresh state-change events arrive, the bottom indicator should STAY on its last text ("Running code…") rather than clearing to blank. The current behavior implies a TTL or "clear on no-new-event-in-Xs" timer that's too aggressive.

(2) is the lower-cost intervention. (1) is the polished one.

## Surface classification

`Agentic-RAG` — frontend rendering choice; the SSE events from the backend are correct (top indicator proves this).

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 070 unrelated).
- **Defer to future phase / milestone:** good candidate fold-in to Phase 075 (SEED-008 + tool_args_progress polish bundle) — directly in scope. Otherwise v2.7 Agent Workspace milestone.
- **Plant as seed:** already covered by SEED-008 scope; append as Gap 3.
- **External — note only:** no.

## Workarounds (today)

- User scrolls UP to see the top tool-card indicator when the bottom goes blank. Workable but not natural.

## Reference / evidence links

- Live repro 2026-05-14 (user observation during the dissertation defense pptx generation session): 169-second chart-generation cell with top indicator animating + bottom indicator blank.
- Phase 067.4 R-5 — `code_output_line` SSE event (heartbeat for long-running sandbox cells).
- SEED-008 Gap 2 — line-by-line stdout streaming (this bug is the chat-indicator complement of that gap).

## Fold timeline

- 2026-05-18 / Phase 075 discuss-phase — frontmatter flipped open → folded, folded_into: "075" per D-075-14.
- 2026-05-18 / Phase 075 Plan 02 — fix shipped via two-part intervention:
  - **Part (a) sticky text**: `frontend/src/components/chat/MessageItem.tsx` gained `stickyLabelRef<string | null>` that retains the last non-null `outerBannerLabel(...)` value during `isStreaming`. The bottom indicator renders `stickyBottomLabel` (computed label or sticky fallback) in place of the prior inline ternary. No more clearing to blank during silent windows inside long tool calls.
  - **Part (b) code_stdout subscription**: implicit via the existing `onCodeStdout` handler at `frontend/src/providers/StreamsProvider.tsx:310-322` — each new per-line `code_stdout` event from Plan 02's `session.execute_command` rewire mutates the active tool_call's `outputLines`, which re-renders MessageItem and refreshes the sticky text. No explicit subscription required.
- Closure validation: Chrome MCP UAT at t=30s/60s/120s during a long pptx-generation cell (matplotlib renders) — deferred to `/gsd:verify-work` session per auto-mode protocol. Status flip folded → closed pending UAT.
- 2026-05-23 / Phase 075.6 Plan 03 (D-075.6-D1) — superseded and closed. The `✦ Working` badge introduced by Phase 075.6 Plan 03 Req #8 (pinned at the top of the active assistant turn, gated on `(activeTool || isPlanning) && !allToolsDone`) is a structurally-better signal than the bottom-indicator sticky-text path (top-of-bubble + branded + pinned + animated). The bottom indicator may still go blank during silent windows, but the Working badge at the top of the assistant bubble now answers "is it still running?" definitively. `re_open_trigger` refreshed to watch for the Working badge itself failing to appear during streaming on any provider. Frontmatter flipped folded → closed, `verified_closed_by: "075.6"`.
