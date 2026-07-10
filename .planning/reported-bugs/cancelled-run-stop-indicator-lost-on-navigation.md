---
id: BUG-260710-01
title: "Stopped" indicator on a cancelled message disappears after navigating away and back
reported: 2026-07-10
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/streaming, frontend/chat-display]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 273090ed
  date: 2026-07-10
---

# BUG-260710-01: "Stopped" indicator on a cancelled message disappears after navigation

## What we observed

During Phase 145 live SC#10 UAT (Test 3 — live Stop per provider):

1. Start a streaming run on any provider (observed with OpenAI/Anthropic/etc.).
2. Click **Stop** mid-stream. The run is correctly cancelled — the answer stops and a "response stopped"/cancelled indicator shows on the message.
3. Navigate away from the thread and back (or reload).
4. **Actual:** the partial answer text is still there, but the "stopped"/cancelled indicator is GONE — the message now looks like a normal (just shorter) completed answer.
5. **Expected:** a cancelled message should still be visibly marked as "stopped/cancelled" after navigation, so the user can tell the response was cut short rather than finished.

DB ground truth (identifier-only): the cancel bookkeeping is correct — e.g. run `f2d7acef` (openai) → `runs.status='cancelled'`, `error=NULL`, removed from `runs:active`; the partial assistant message persisted with 1606 chars. Only the DISPLAY of the cancelled state is lost on re-render.

## Why it matters

Honesty gap (mild): after navigation the UI cannot distinguish a cancelled/truncated response from a naturally-completed one. Low blast radius — the content is intact and the run state is correct in the DB; only the visual "this was stopped" affordance is missing on reload. Cosmetic-to-minor.

## Hypothesized cause

The "stopped" affordance is live-only frontend state tied to the streaming lifecycle. On reload the message is reconstructed from persisted `messages` rows, and the cancelled flag lives on the `runs` row (`runs.status='cancelled'`), not on the message. The message renderer does not derive/show a persistent "cancelled" badge from the run status. (Hypothesis — not yet code-confirmed.)

## Surface classification

`Agentic-RAG` — this app's chat display. Cross-checked at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 145's executed scope was the backend cancel writer (`finalize_run_terminal` + ZREM) and the live streaming-state derive, both verified working. This is historical-message rendering, a separate concern. Operator elected (2026-07-10) NOT to reopen 145.
- **Defer to future phase / milestone:** a focused chat display-honesty / cancelled-message-rendering frontend phase.
- **Plant as seed:** candidate if a broader "message-level lifecycle badges (stopped/failed/interrupted) survive reload" theme emerges.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

None needed — the response content and run state are correct; only the visual marker is absent after navigation.

## Reference / evidence links

- Found during Phase 145 UAT: `.planning/phases/145-run-lifecycle-honesty-threads-py-extraction-stretch/145-HUMAN-UAT.md` (Test 3).
- Related display-desync bugs: `streaming-indicator-top-bottom-desync.md`, `timer-disappears-mid-cycle.md`.
- Sibling finding same session: BUG-260710-02 (empty cancelled bubble).
