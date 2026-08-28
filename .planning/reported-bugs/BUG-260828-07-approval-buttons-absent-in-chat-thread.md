---
id: BUG-260828-07
title: Approve / Do-not-run render in the workflow panel but not in the chat thread
surface: Agentic-RAG
severity: high
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [frontend/src/components/panel/PendingAskCard.tsx, frontend/src/components/layout/ChatLayout.tsx]
re_open_trigger: n/a — open
---
# The same pause is actionable in one home and inert in the other

Driving an armed approval, the operator saw the pause render in **both** places with different controls:

- **Workflow run panel** — the question, plus `Approve this step`, `Do not run it`, a REASON field
  and `Send Answer`. Actionable.
- **Chat thread** — the question text rendered, **no buttons**. The run cannot be advanced from the
  surface the person was already looking at.

⚠ A human gate that appears without its controls is worse than one that does not appear: it tells the
operator a decision is required and then offers no way to make it. The run sat until it was stopped.

Related but DISTINCT from `SEED-219` (`stepIdentityVocabulary`'s six pause sentences are imported by
nothing and `PendingAskCard` still renders `Needs you`) — that one is the words, this one is the controls.
