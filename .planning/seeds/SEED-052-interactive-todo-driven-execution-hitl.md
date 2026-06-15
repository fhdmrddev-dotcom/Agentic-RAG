---
id: SEED-052
title: Interactive todo-driven execution with proactive HITL — a "let's do this together, step-by-step" guided mode in Deep chat (work the todo list one item at a time, ask_user per step, mark complete on answer, advance, produce the final artifact)
status: planted
planted: 2026-06-04
planted_by: orchestrator (/gsd:discuss-phase 094 — operator surfaced the gap from a live "plan a trip to Paris" thread)
trigger_when: v2.9 milestone kickoff (/gsd:new-milestone), OR any phase that touches the Deep agent-loop system prompt (agent_loop.py interactivity guidance), the ask_user round-trip in Deep mode, or todo-driven execution. Pairs naturally with SEED-051 (NL→workflow authoring) as the "un-authored / ad-hoc" sibling of the harness.
priority: high
tags: [agent-loop, interactivity, human-in-the-loop, ask_user, write_todos, guided-execution, deep-mode, cross-provider, v2.9, SEED-051, SEED-034, BUG-260604-01]
---

# SEED-052: Interactive Todo-Driven Execution with Proactive HITL

## Context (how it surfaced)

During `/gsd:discuss-phase 094` (2026-06-04) the operator asked why, when a conversation
produces a todo list, the agent "creates todos and never logically loops through the items or
engages the user through the ask_user tool." A live DB pull of the real thread
(`4cad6241-652e-4c66-8c4d-a1fd8f27fd63`, Deep/General mode, **deepseek-v4-flash**, 18 messages)
demonstrated the gap precisely:

1. "plan for a trip to Paris" → full plan (search + web). ✅
2. "create todo list" → `write_todos` creates **13 todos**. ✅
3. **Operator: "let's decide on each step and mark it complete, you should ask me questions for
   each step…"** → agent says "Great idea!" then **asks inline as text — no `ask_user`.** ❌
4. **Operator: "why are you not using ask user tool"** → agent finally calls `ask_user`
   ("posted to your panel").
5. **Operator: "you should mark each task based on my answer and loop to the next question"** →
   agent repeats **"Step 1 of 13"** across turns 13 / 15 / 17, **never advances, never marks a
   single todo complete.** All 13 todos remained `pending`/`in_progress`.

The operator had to fight the agent across four turns to get an interactive posture, and even
then the loop never worked.

## The vision

A **"let's do this together, step-by-step" guided execution mode** for ad-hoc Deep chat: the
agent works a todo plan **one item at a time**, uses **`ask_user` per step**, **marks each todo
complete on the user's answer**, **advances to the next**, and at the end **produces the final
artifact** (e.g. the comprehensive .md file). It is **scenario-dependent** — the agent should
*recognize* when the user wants to drive interactively ("ask me each step", "let's go one by
one", "decide together") versus when they want autonomous end-to-end delivery.

This is the difference between an AI that **hands you a plan and walks away** and an **AI
colleague that executes the plan *with* you, checking in at each decision.** It is the
"durable automation engine / AI colleague" framing ([[feedback_business_value_framing]]) applied
to *interactive* knowledge work, and it keeps the human in control of a multi-step task.

## Root cause (grounded in code — why it doesn't happen today)

Two confirmed reasons:

1. **The system prompt actively discourages interactivity.** `backend/app/services/agent_loop.py`
   lines ~545–572 tell the agent to "Execute the FULL pipeline end-to-end… continue to the next
   step rather than asking 'Shall I proceed to…'" and reserve `ask_user` for **genuine blockers
   only** ("when the intent is clear and safe, proceed without asking"). That autonomy bias exists
   for a real reason (earlier frustration with an agent that asked permission constantly — see
   [[feedback_iterate_leverage_existing]] history), but it means "go step-by-step and check in
   each time" runs *against* the prompt. The agent is doing what it was told.

2. **There is no interactive todo-execution loop primitive.** `write_todos` and `ask_user` are
   independent tools; nothing binds them into *ask → mark that todo complete → advance → ask the
   next*. So even when the user forces interactivity, the agent has no scaffolding to drive the
   list and spins on "Step 1".

## What it would take (capability sketch — not a locked design)

- **Interactive-mode detection** — recognize "ask me each step / let's do this together / one by
  one / decide on each" as an explicit request to switch posture (and let the user leave the mode).
- **Prompt guidance for guided execution** — a *scenario-conditional* counterweight to the current
  autonomy bias (do NOT remove the autonomy default; add an interactive branch). Cross-provider:
  the instruction must hold across all native providers — tool-use discipline varies per provider
  ([[feedback_multi_provider_behavior_variance]], [[reference_provider_docs_glm_minimax]]); align
  with SEED-034 system-prompt cross-provider work.
- **The ask → mark → advance loop** — bind `ask_user` answers to `write_todos` status flips and
  step progression, so the agent reliably walks the list and ticks items off.
- **Clean Deep-mode `ask_user` UX** — today the agent says "check your panel" while the user
  answers in chat ("next"); the round-trip and where-the-user-answers need to be coherent. (Phase
  094's ask_user/draft panel legibility partly helps the *visibility* but not the loop.)
- **Final-artifact assembly** — gather the per-step answers into the promised deliverable.

## Relationship to the harness and SEED-051

This is essentially a **lightweight, un-authored harness**: a todo list behaves like an informal
phase plan with `ask_user` gates — but created on the fly in chat, with no published
WorkflowDefinition. The authored, locked path is the harness (v2.8) + NL authoring (SEED-051);
this seed is the **ad-hoc interactive** sibling. Decide at v2.9 whether to implement it as
(a) agent-loop prompting + a loop primitive in Deep mode, or (b) an auto-promoted lightweight
harness run. Keep both options open.

## Near-term partial (optional, NOT the full capability)

A small **prompt nudge** so the agent *recognizes* "step-by-step / ask me each time" requests and
switches into an interactive posture (uses `ask_user` per step instead of fighting the user). This
would stop the agent resisting an explicit request, but would **NOT** fix the advance-and-mark-
complete loop (turns 13–17 stuck on Step 1) — that needs the loop primitive above. Shippable as a
`/gsd:fast` prompt tweak if the operator wants relief before the full v2.9 capability. Must be
verified cross-provider so it doesn't regress autonomous end-to-end delivery on any native provider.

## Re-open trigger

v2.9 milestone kickoff, OR any phase touching the Deep agent-loop interactivity prompt
(agent_loop.py ~545–572), the Deep-mode `ask_user` round-trip, or todo-driven execution. Tracked
defect: **BUG-260604-01**.

## Business value

Guided interactive execution is the "AI colleague" promise made real — the agent doesn't just
produce a plan, it executes it *with* the user, keeping them in control at every decision. High
operator demand (fought for it across four turns in one thread).
