---
id: BUG-260603-01
title: Chat send intermittently does nothing (silent drop) on the general chat path
reported: 2026-06-03
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, frontend/composer]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Reviewed at Phase 095.1 discuss-phase (2026-06-06): considered for the 095.1 cross-check but routed OUT — composer/send-path surface (frontend/chat, frontend/composer), unrelated to 095.1's run-honesty + provider-error + workspace-panel scope. Stays OPEN; re-route to a dedicated composer/send-reliability fix when scoped."
reproduces_on:
  branch: v2.5-dev
  commit: bf8ec00b
  date: 2026-06-03
---

# BUG-260603-01: Chat send intermittently does nothing (silent drop)

## What we observed

Operator (during the 093 D-21 re-UAT, 2026-06-03): "Sometimes we send a chat and it does not fire at all — nothing happens and the chat stays as if nothing happened. This is not related to workflows but it happens sometimes."

Independently corroborated during Chrome-MCP automation: on **freshly created/switched threads**, two sends did not register — the prompt + workflow pick stayed staged, the composer cleared/reset, no run was created (no `workflow_runs`/`runs` row, no streaming indicator). Re-issuing the send (type → confirm Send enabled → click the Send button) worked. In automation the trigger was `type_text` + Enter immediately after a thread switch; for a human typing naturally the cause may differ.

## Why it matters

A send that silently no-ops is a trust/usability defect: the user believes they asked a question and gets nothing, with no error or feedback. Low frequency but high annoyance; erodes confidence in the chat surface (the product's primary interface).

## Hypothesized cause

(Hypothesis, not verified.) A race on a freshly-selected/created thread: the composer's `value`/`selectedWorkflowId`/thread-binding state hasn't settled when the submit fires, so `handleSend` runs against a not-yet-ready thread context and is dropped without surfacing an error. Possibly the same window where the welcome→thread transition or the per-thread reconcile is in flight. NOT harness-specific (occurs on the general/Deep chat path).

## Surface classification

`Agentic-RAG` — this app's chat composer/send path. General chat (not the harness/workflow path), so out of Phase 093 scope.

## Suggested routing

- **Fold into in-flight phase:** n/a (093 closed; this is general chat, not harness)
- **Defer to future phase / milestone:** candidate for Phase 094/095 chat-surface work, or a standalone `/gsd:quick` once reproduced
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

Re-send the message (it works on the second attempt). Type into the composer and confirm the Send button is enabled before pressing Enter.

## Reference / evidence links

- Surfaced during 093-HUMAN-UAT.md D-21 re-UAT (operator observation #5 + Claude automation notes, 2026-06-03).
