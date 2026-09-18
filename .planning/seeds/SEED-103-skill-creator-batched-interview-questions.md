---
seed_id: SEED-103
title: Batched/paginated interview questions for skill-creator — a SEPARATE tool, never a retrofit of the shared ask_user
status: open
planted: 2026-07-05
phase_origin: "Operator, during Phase 137.2 live UAT (SC#4 walkthrough): asked why skill-creator's interview doesn't use the existing ask_user tool, then refined the idea into a purpose-built batch variant after investigation showed why a straight swap would hurt UX."
category: product idea — skill-creator interview UX, explicitly deferred
related_seeds:
  - SEED-101-skill-creator-native-builtin-protected (the phase that shipped the current interview approach)
related_memories: [feedback_vibe_coder_communication, feedback_separate_per_feature_safe_by_construction]
priority: low
surface: Agentic-RAG
trigger_when: unset
---

# SEED-103 — a batched, paginated interview tool for skill-creator (maybe), never a change to shared ask_user

## The investigation (2026-07-05)

During Phase 137.2's live SC#4 UAT, the operator asked: skill-creator's interview asks
several questions in one bundled chat message (input format, output format, sections,
tone, trigger phrase, etc.) — we already have an `ask_user` tool, why not use it?

Investigated `backend/app/services/tool_dispatcher.py:2522` (`_handle_ask_user`) and its
frontend renderer `frontend/src/components/panel/PendingAskCard.tsx`. Findings:

1. **`ask_user` is genuinely single-question.** One `prompt` string (+ optional single-
   question `options` list) per call. It fully **blocks the agent loop** via a Redis
   pub/sub subscribe-and-wait until the human answers in a pinned amber side-panel card,
   or it times out (default 300s, clamped up to `ask_user_max_timeout_seconds`).
2. **No batch/pagination exists today.** There's no "Next" button, no way to hand it an
   array of questions — each call is one full stop-and-wait round-trip.
3. **If skill-creator's interview used `ask_user` one question at a time**, a 4-6
   question interview becomes 4-6 separate full-loop freezes — objectively slower and
   choppier than the current single chat-message approach, which both live SC#4 test
   runs proved works smoothly (users answered bundled questions fluently in one reply
   each time).
4. **`ask_user` is used elsewhere for a different job**: a genuine hard-stop where the
   agent cannot proceed without one specific answer (e.g., destructive-action
   confirmation, workflow phase gates). It is explicitly excluded from sub-agent contexts
   (`_SUB_AGENT_EXCLUDED`), confirming it's architecturally scoped as a main-loop,
   single-blocking-question primitive by design — not an intake-interview tool.

## The idea (operator-refined, explicitly deferred)

A **separate, purpose-built tool** — not a modification of `ask_user` — that lets
skill-creator (and potentially other future multi-question flows) present a *batch* of
questions in one side-panel flow with pagination (a "Next" button stepping through them),
while still resolving as ONE agent-loop pause/resume round-trip for the whole batch
(not N).

**Operator's explicit condition, verbatim intent:** build this ONLY as an isolated,
separate tool. If a clean separate implementation isn't achievable without touching,
risking, or contradicting `ask_user`'s existing behavior at its current call sites, drop
this idea entirely and keep skill-creator's interview exactly as it is today (bundled
plain-chat-message questions, free-text batched answers). Never retrofit the shared tool.

## Why this is LOW priority / genuinely optional

The current approach isn't broken — it's the recommended default. Both live SC#4 UAT
attempts (Phase 137.2) show the bundled-questions-in-one-message pattern working exactly
as intended: natural, fast, no extra round-trips, and flexible enough for the user to
answer out of order or ask their own clarifying questions back. This seed exists purely
to preserve the idea, not because the current UX has a demonstrated problem.

## Re-open trigger

- A future phase needs a genuinely different multi-question flow (not just
  skill-creator) where free-text bundling has proven awkward in practice (e.g., a user
  reports being unsure what all is being asked in one dense message).
- Before building: re-derive whether `ask_user`'s current call sites (destructive-action
  confirmations, workflow gates) could tolerate a batch-capable superset, or whether a
  fully separate tool is cleaner — re-verify this against the code at build time, not
  from this seed's 2026-07-05 snapshot.
