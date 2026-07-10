# v3.1 Operator Inputs — captured verbatim-intent (for /gsd:new-milestone)

Source: operator messages 2026-06-21 while shaping v3.1 (Workflow + Skill Eval Studio). These are the
acceptance pressures the milestone must answer. Nothing here is auto-scoped — they become candidate
requirements at discuss/spec time.

## A. Skills — quality, triggering, creation (msg 1)
- Make skills HIGH QUALITY: reliable triggering, easy creation of new skills, measurable improvement.
- Leverage Anthropic's **skill-creator** (attached zip, extracted at `screenshots/skill-creator-extracted/`):
  its authoring loop + eval loop + description-optimizer is the reference implementation.

## B. Workflow ↔ Skill collision (msg 1) — REAL bug
- A published workflow "weekly report" AND a skill "Weekly Report generator" coexist. Running the
  workflow produced the workflow's template (expected). Then a same-thread Deep chat re-request triggered
  the SKILL but produced **TWO files** — the skill's template AND the workflow's template. Workflow context
  bleeds into subsequent Deep chat. MUST: workflows are cleanly separated yet skills are still usable when
  needed; no cross-contamination.

## C. IA — one front door for workflows (msg 1)
- Remove the chat composer "Harness" mode + in-chat workflow selector. Workflows launch from ONE place
  (the Workflows page/base). Operator asked for agreement → interim: AGREE, keep "launch-in-context" as an
  explicit action, underlying requirement = run↔chat context isolation.

## D. Multi-provider — ALL providers, not just the big 3 (msg 2)
- Must work across **OpenAI, Anthropic, Google, OpenRouter, DeepSeek, MiniMax, Kimi/Moonshot, GLM/Zhipu**
  (the native-7+ set). The app integrates with ANY selected provider/model; **strong models do the heavy
  lifting**. Skills + eval + tool-use + structured emit must be reliable cross-provider (not OpenAI-only).

## E. Chat context management + memory (msg 2)
- Clarify + improve: does the agent REMEMBER what's in the chat (rolling window/trimming)? Is there
  CROSS-thread memory (remember/recall, user_memory)? Any bleed? How does context interact with skills +
  workflows (ties to the collision).

## F. Tool-call / todo / task DESCRIPTION parity across providers (msg 2)
- Observed: OpenAI shows CONCRETE, honest task descriptions; other providers show generic descriptions ~=
  the tool NAME being called. Make todos / workflow steps / "task being done" descriptions as descriptive
  as OpenAI **across all providers** — WITHOUT compromising anything that already works. (Known reports:
  non-anthropic-generic-code-task-descriptions, setting-up-agent-hides-model-activity.)

## G. Workflow Studio UX — too complex / crowded (msg 2)
- The Workflows base + design is good but **too complicated for the user**: information is intensive, messy,
  gathered from here and there, visually crowded, and does NOT show the CORE/SOUL of the (agentic) workflow.
- Enhance UX: support BOTH **strict and loose** authoring/running, with MORE transparency and LESS
  complication, while maintaining accuracy + solid control. Show the workflow's essence clearly.

## H. Self-learning / self-improving (msg 2 follow-up)
- Does Anthropic mention anything about **self-learning / self-improving** skills or agents? Are WE
  considering it? (Candidate: a closed loop run → eval → auto-propose skill/description improvement →
  human-approve → new immutable version; reuses the skill-creator eval loop + our skill versioning +
  Phase-102 judge. Assess Anthropic's published stance + memory/"learned skills" features, and whether a
  bounded, human-in-the-loop self-improvement loop belongs in v3.1 or is a later milestone.)

## Overall objective
Leverage skills + workflows so the app is usable by **any business, any size, any complexity** — strict
or loose — with transparency, accuracy, and solid control.
