---
id: BUG-260604-01
title: Agent ignores explicit "ask me per step" requests and never advances/marks todos (no interactive todo-execution loop)
reported: 2026-06-04
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [backend/agent-loop, backend/services/agent_loop.py, ask_user/HITL, write_todos, deep-mode, cross-provider]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-052]
re_open_trigger: v2.9 milestone kickoff / SEED-052 planning, OR any phase that touches the Deep agent-loop interactivity prompt (agent_loop.py ~545-572), the Deep-mode ask_user round-trip, or todo-driven execution.
reproduces_on:
  branch: v2.5-dev
  commit: 3fdb88ec (HEAD at report time; behavior observed 2026-06-02)
  date: 2026-06-02
---

# BUG-260604-01: Agent ignores "ask me per step" + never loops/marks todos

## What we observed

Live thread `4cad6241-652e-4c66-8c4d-a1fd8f27fd63` (Deep/General mode, **deepseek-v4-flash**,
18 messages — pulled from the local DB during `/gsd:discuss-phase 094`):

1. "plan for a trip to Paris" → agent produces a full plan (search_documents + 3× web_search). ✅
2. "create todo list" → agent calls `write_todos`, creates **13 todos**. ✅
3. **User: "let's decide on each step and mark it complete, you should ask me questions for each
   step then prepare a comprehensive md file with the results."** → Agent replies "Great idea!"
   and **asks the questions inline as prose — does NOT call `ask_user`.**
4. **User: "why you are not using ask user tool"** → Agent finally calls `ask_user`
   ("I've posted the question to your panel!").
5. **User: "you should mark each task based on my answer to your ask user and loop to the next
   question."** → Agent calls `write_todos` + `ask_user` but still shows **"Step 1 of 13"**.
6. User: "next" → Agent **repeats "Step 1 of 13" again** (turns 15, 17). It never advances to
   Step 2, and **not one of the 13 todos was marked complete** — all remained `pending` /
   `in_progress` at end of thread.

Expected: when the user explicitly asks to go step-by-step, the agent uses `ask_user` per step,
marks each todo complete on the answer, advances to the next, and assembles the final artifact.
Actual: the agent resists the interactive request, only complies after being told twice, and once
interactive it gets stuck on Step 1 with no advancement or completion.

## Why it matters

`severity: major` — felt-experience defect that makes an entire interaction style ("let's do this
together, step by step") non-functional, and the agent visibly **fights an explicit, repeated user
instruction** (four corrective turns in one thread). It erodes trust in the "AI colleague"
promise. It is not blocking — autonomous end-to-end delivery still works — but interactive guided
execution is effectively unusable.

## Hypothesized cause

Confirmed in code (two causes):

1. **Prompt bias toward autonomy.** `backend/app/services/agent_loop.py` ~545–572 instructs:
   "Execute the FULL pipeline end-to-end… continue to the next step rather than asking 'Shall I
   proceed to…'" and reserves `ask_user` for **genuine blockers only** ("when the intent is clear
   and safe, proceed without asking"). So an explicit "ask me each step" request runs against the
   system prompt. (This autonomy default was a deliberate fix for prior over-asking — must NOT be
   removed, only branched.)
2. **No interactive todo-execution loop.** `write_todos` and `ask_user` are independent tools;
   nothing binds answer → mark-complete → advance-to-next. The agent has no scaffolding to drive
   the list, so it spins on "Step 1".

## Surface classification

`Agentic-RAG` — this app's Deep agent loop + system prompt. Cross-checked at discuss-phase /
new-milestone / complete-milestone. Observed on deepseek-v4-flash, but the prompt lives in the
**shared** agent_loop path, so it is cross-provider — any fix must be verified across all native
providers (must not regress autonomous end-to-end delivery).

## Suggested routing

- **Fold into in-flight phase:** n/a — explicitly NOT 094 (rendering/legibility), 095 (chat
  cards), or 096 (eval). This is agent *behavior*, not panel rendering. (094 only helps the
  *visibility* of the ask_user prompt/draft, not the loop.)
- **Defer to future phase / milestone:** v2.9 — guided interactive execution capability.
- **Plant as seed:** **SEED-052** (planted 2026-06-04) — interactive todo-driven execution w/ HITL.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- **Today (user-side):** explicitly tell the agent "use the ask_user tool and ask me one question
  at a time, marking each todo complete before the next" — it complies after being told, though
  the advance/mark loop is still unreliable.
- **Near-term partial (code-side, optional):** a small prompt nudge in agent_loop.py so the agent
  *recognizes* "step-by-step / ask me each time" and switches to an interactive posture without
  being told twice. Stops the resistance; does NOT fix the advance-and-mark loop. Shippable via
  `/gsd:fast`, verified cross-provider. (Captured in SEED-052 "Near-term partial".)

## Reference / evidence links

- Thread: `4cad6241-652e-4c66-8c4d-a1fd8f27fd63` (local DB; messages + todos pulled 2026-06-04).
- System prompt bias: `backend/app/services/agent_loop.py` ~545–572.
- Capability capture: `.planning/seeds/SEED-052-interactive-todo-driven-execution-hitl.md`.
