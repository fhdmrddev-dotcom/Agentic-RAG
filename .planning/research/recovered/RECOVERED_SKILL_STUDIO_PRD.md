# PRD: Skill Studio — Iterative Skill Development & Evaluation

**Product:** Agentic RAG  
**Feature Area:** Skills System  
**Version:** v3.1 Target  
**Status:** Draft  
**Date:** 2026-04-12  
**Depends on:** v2.1 Stability & RAG Correctness (must ship first)

---

## Overview

The current skills system lets users create, import, export, and activate skills — but
offers no way to verify a skill actually works before relying on it, no way to compare
a skill against a baseline, and no way to iterate based on evidence rather than guesswork.

The result: users ship the first draft of a skill and have no feedback signal until
something goes wrong in a real conversation.

This feature introduces **Skill Studio** — a development and evaluation environment
embedded in the existing Skills tab. It gives users and the skill-creator agent the
infrastructure to draft, test, compare, iterate, and measure skills using the same
LLM and execution environment already powering the app.

The goal is not to replicate any external tool. It is to make the skill development
loop in this app complete, evidence-driven, and compounding — so that skills improve
over time rather than degrading silently.

---

## Problem

### The Gap Between Writing and Knowing

A user writes a skill, enables it, and uses it. They have no idea whether the skill
is actually changing the agent's behavior for the better. There is no comparison
point, no test history, no rating mechanism, and no way for the skill-creator agent
to close the loop automatically.

### The Skill Creator Agent Is Flying Blind

The skill-creator seed skill can write and save skills, but it cannot run them
against a test prompt and observe the result in isolation. It cannot compare
with-skill behavior against without-skill behavior. It cannot store or retrieve
feedback. Every improvement attempt requires the user to manually start a new
conversation and mentally compare outputs.

### Skills Decay Without Signals

As the knowledge base and use cases evolve, skills that worked well can drift
out of alignment. There is currently no way to detect this — no history, no
metrics, no regression signal.

---

## Goals

- Give the skill-creator agent the ability to run isolated test executions and
  compare results programmatically, within the existing tool dispatch loop
- Give users a UI surface to review side-by-side outputs, rate them, and leave
  feedback without leaving the Skills tab
- Persist all eval history in Supabase so it compounds — every run, rating, and
  improvement is recorded and can inform future iterations
- Make the skill-creator seed skill aware of this infrastructure so it uses it
  automatically as part of the creation flow
- Introduce no new infrastructure dependencies — use Supabase, the existing
  LLM client, the existing SSE loop, and the existing sub-agent pattern

---

## User Stories

**As a user creating a new skill,** I want the skill-creator agent to run my skill
against a few test prompts automatically and show me what the output looks like,
before I ever use it in a real conversation.

**As a user reviewing a skill,** I want to see the skill's output next to what the
agent would have said without the skill, so I can judge whether the skill is
actually helping.

**As a user iterating on a skill,** I want the agent to read my previous ratings
and feedback, understand what went wrong, and improve the skill instructions —
then re-run the same test prompts so I can compare the new version directly
against the old one.

**As a user with a library of skills,** I want to see which skills have been
tested, how they performed, and when they were last verified — without having
to re-read each skill's instructions.

**As the skill-creator agent,** I want tools that let me run a prompt with and
without a skill, store the results, retrieve past feedback, and close the
improvement loop without requiring the user to do it manually.

---

## Feature Requirements

### Infrastructure — New Persistence Layer

The feature needs two new tables. How they are designed, what indexes they carry,
what RLS policies they require, and how they relate to the existing `skills` and
`skill_files` tables is for the implementor to determine based on what the
queries in the rest of this document require.

The two concepts that need to be persisted are:

**Eval cases** — a saved test prompt associated with a skill, with an optional
description of what a good output looks like. These are reusable across iterations.

**Eval runs** — the result of executing an eval case. A run is always associated
with a specific eval case and records: which variant was run (with the skill or
without), what the output was, how long it took, how many tokens were used,
an optional user rating (numeric), and optional user feedback text.

These two concepts, and the queries the feature needs to support, should drive
the schema design. Consider what the eval panel UI needs to fetch, what the
agent tools need to read and write, and what RLS constraints are appropriate
given that eval cases and runs are user-specific.

All schema changes must be delivered as numbered migration SQL files following
the existing `backend/supabase/migrations/` pattern.

---

### Agent Tools — New Capabilities in the Dispatch Loop

The feature requires new tools available to the agent in General Mode. The
existing tool dispatch loop in `threads.py` and tool definitions in
`openai_service.py` should be extended — not restructured.

The agent needs to be able to do at least the following:

**Run an eval** — given a skill name and a test prompt, execute the prompt
twice: once with the skill's instructions injected into the system context,
and once without. Store both results. Return enough information for the agent
to describe what happened and prompt the user to review.

The execution model for these runs should be consistent with how the app
already handles isolated LLM calls. The existing `sub_agent_service.py`
provides a pattern — the question for the implementor is whether to extend
that service, create a parallel one, or handle it differently, and what the
right streaming behavior is given that two sequential runs may each take
several seconds.

**Retrieve eval history** — given a skill name or ID, return the stored eval
cases and their most recent run results and ratings. This lets the agent
understand what has been tested before and what feedback was given.

**Store feedback** — given a run ID, store a user rating and feedback string.
This should be callable by the agent after the user has reviewed an output,
so the agent can record what the user said without requiring a separate UI
action for simple feedback.

The naming, schema, and exact parameter structure of these tools is for the
implementor to decide based on consistency with the existing tool definitions.
The descriptions should follow the pattern established by existing tools —
precise about when to use them and explicit about what they do not do.

Whether these tools are available only when sandbox is enabled, or always
available in General Mode, is a design decision the implementor should make
based on the existing pattern of conditional tool registration.

---

### SSE Events — New Event Types

The eval runs involve sequential LLM executions that may each take several
seconds. The frontend needs to know what is happening during this time.

New SSE event types should be emitted during eval execution, following the
existing naming and JSON structure conventions established by events like
`sub_agent_start`, `sub_agent_delta`, `sub_agent_done`, `skill_activated`,
and `code_execution_start`.

The implementor should consider: what does the user need to see in the UI
during a two-run eval? What granularity of progress is useful vs. noisy?
The existing sub-agent streaming pattern is a useful reference point.

---

### Frontend — Eval Panel in Skills Tab

A new "Evals" section should appear within the existing Skill detail view in
the Skills tab. This is an addition to the existing UI — not a replacement
of the Overview or Files sections.

The panel needs to support:

**Test case list** — showing all saved eval cases for the skill, with enough
context (prompt preview, run count, average rating, last run date) to orient
the user at a glance.

**Run detail view** — when a user selects an eval case, they should be able
to see the most recent with-skill and without-skill outputs side by side.
The layout, visual design, and interaction model should follow the existing
Aether Intelligence design system — dark/light mode, CSS variables, existing
component patterns.

**Rating and feedback** — the user should be able to rate the with-skill
output (relative to the baseline) and leave feedback text. This should feel
lightweight — not a modal, not a form submission. The feedback should be
saveable without interrupting the user's review flow.

**Iteration history** — if a skill has been through multiple improvement
iterations, the user should be able to see how performance changed across
runs. What "performance" means visually — whether it is a numeric score, a
trend line, or something else — is a design decision for the implementor.

The frontend implementation should follow the existing hook patterns
(`useX` conventions), use the existing API client patterns, and not
introduce new state management libraries.

---

### Skill Creator Seed Skill — Updated Instructions

The skill-creator global seed skill currently has instructions that do not
reference the new eval tools, because those tools did not exist when it was
written.

Once the tools and infrastructure exist, the skill-creator instructions
should be updated in the database to incorporate the eval loop naturally
into the skill creation process. The updated instructions should guide the
agent to:

- Propose test prompts before writing the first draft (not after)
- Run evals before asking the user to enable the skill in production
- Read existing eval feedback before making changes to instructions
- Re-run the same test prompts after each improvement so the user can
  compare iterations directly
- Offer to optimize the trigger description after the instructions are stable,
  by proposing trigger/no-trigger prompt pairs and reasoning about whether
  the current description would correctly activate or suppress the skill

The tone and style of the updated instructions should be consistent with the
existing skill-creator instructions — conversational, flexible, and focused
on the why rather than rigid step sequences.

---

## What Does NOT Need to Change

- The core skills CRUD API (`/skills` endpoints) — no changes needed
- The skill import/export ZIP format — no changes needed  
- The skill file storage pattern in Supabase — no changes needed
- The existing `run_sub_agent` service interface — extend or parallel, not replace
- The SSE streaming protocol structure — new event types extend it, not replace it
- The existing test suite structure — new tests follow existing patterns in
  `tests/integration/` and `tests/unit/`
- The `execute_code` sandbox — eval runs do not use the Docker sandbox

---

## Dependencies Between Components

The infrastructure (DB tables + migrations) must exist before the agent tools
can be wired in, since the tools write to those tables.

The agent tools must exist and be tested before the skill-creator instructions
are updated, since the instructions reference tools by name.

The SSE events must be defined alongside the agent tools, since the frontend
needs to handle them when an eval run is triggered from chat.

The frontend eval panel can be developed in parallel with the agent tools once
the API endpoints for reading eval data are defined, since the panel is a
read/write consumer of the persistence layer, not a dependency of the agent.

---

## Success Criteria

- The skill-creator agent can run a test prompt against a skill and a baseline
  in a single tool call, without the user having to do anything manually
- A user can see with-skill and without-skill outputs side by side in the
  Skills tab without leaving the app or starting a new conversation
- Eval runs, ratings, and feedback survive page refreshes and are associated
  with the skill permanently — not tied to a specific thread
- The skill-creator agent reads previous feedback before making changes to
  instructions, and re-runs the same test prompts after improvements
- A skill with three or more rated eval runs shows a meaningful summary of
  its performance history in the Skills tab
- All new agent tools are covered by integration tests following the pattern
  in `tests/integration/test_skills.py` and `tests/integration/test_threads_skills.py`
- All new DB tables have RLS policies that prevent users from reading or
  modifying each other's eval runs

---

## Feature Summary

| Component | What It Enables |
|---|---|
| Eval cases table | Reusable test prompts per skill, persisted across sessions |
| Eval runs table | Side-by-side output storage with ratings and feedback |
| `run_skill_eval` tool | Agent can compare with/without skill autonomously |
| `list_skill_evals` tool | Agent reads history before iterating |
| `store_eval_feedback` tool | Agent records user feedback programmatically |
| SSE eval events | Frontend shows progress during dual-run execution |
| Eval panel (Skills tab) | Human review without leaving the app |
| Updated seed skill | Skill-creator uses eval loop by default |

---

## Open Questions for the Implementor

These are genuine design decisions, not gaps in the requirements. The implementor
should make a choice, document the rationale in the Key Decisions section of
CLAUDE.md, and proceed.

1. Should eval runs execute sequentially (with-skill first, then baseline) or
   is there a way to express parallelism within the existing async SSE loop
   that would halve the wait time? What are the tradeoffs?

2. The with-skill run injects skill instructions into the system prompt. Should
   it also inject the skill catalog (as the main agent loop does), or only the
   target skill's instructions? What does a more isolated test look like vs. a
   more realistic one?

3. Eval runs currently store raw text output. If the skill being tested involves
   code execution or file generation, the output is a file, not text. How should
   the run record and the review panel handle this case?

4. Should the eval panel support creating new test cases directly from the UI
   (in addition to the agent creating them via tool), or is the agent-driven
   creation sufficient for v1?

5. The iteration history view requires knowing which runs belong to which
   "version" of a skill. The `skills` table has no version column. Does the
   implementor add one, derive version from timestamps, or handle this differently?
