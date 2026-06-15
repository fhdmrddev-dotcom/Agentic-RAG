---
title: Workflow Authoring Exploration — reasoning, worked example, and the skills-vs-workflows distinction
date: 2026-06-03
context: /gsd:explore session with operator on the "workflows" (harness) feature — how the 4 seeds are built, how tools are equipped, how future NL-authoring works, how it differs from skills. Backed by a 12-agent grounding investigation (workflow wf_7faac1cf-4fa). Companion to SEED-051 (the vision) — this note holds the REASONING so it isn't re-derived.
---

# Workflow Authoring Exploration — Reasoning & Worked Example

## Why this note exists

The vision lives in **SEED-051**. This note captures the *reasoning* that produced it — the
worked example, the consistency reframe, the two-grounding-moments insight, and the
skills-vs-workflows taxonomy — so a future session doesn't have to re-derive any of it.

## How the harness actually works today (ground truth)

- A **workflow = an ordered list of locked phases**, stored as JSONB
  (`workflow_definitions.definition`), parsed by `WorkflowDefinition.model_validate()`
  (`backend/app/models/harness.py`). **The backend, not the LLM, owns phase order** — the engine
  drives an index loop; the model cannot reorder or skip (HARNESS-01).
- **5 phase types** (discriminated union on `phase_type`): `programmatic` (pure Python via
  `PROGRAMMATIC_PHASE_REGISTRY`, no LLM), `llm_single` (one bounded call, no tools), `llm_agent`
  (an agent that loops freely **but only over that phase's whitelisted tools**, capped by
  `max_steps` + wall-clock), `llm_batch_agents` (N agents in parallel + merge), `llm_human_input`
  (`ask_user` pause). Inside an `llm_agent` phase the model is free; *between* phases it has zero
  say.
- **Tools are equipped 100% by hand, zero auto-inference** — the author writes
  `available_tools: [...]` per phase in the seed JSON. Enforced twice: (1) `apply_tool_budget`
  filters tool schemas *before* the LLM sees them (model never sees off-list tools) + a
  per-provider `max_tools` cap that never drops a whitelisted tool; (2) `dispatch_tool`
  re-checks the whitelist at call time → clean JSON refusal + `tool_refused` audit row for any
  off-list call. The 4 seeds (migration `061`, fixed `065`) each get a *minimal task-specific*
  tool set; no phase gets the whole toolbox.

## The consistency reframe (the hinge of the whole conversation)

Operator's word was "perfect consistency." When asked what that means, he chose **"same steps"**
(over "same output" / "reliable quality"). That's decisive:

- **"Same steps" is ALREADY guaranteed** by the engine (backend owns order). So his consistency
  worry is solved by the architecture — the real problem is *authoring* (creating those locked
  steps by describing them), not *runtime consistency*.
- The field is blunt that **"perfect output consistency" from an LLM is unachievable** — even
  temperature 0 isn't deterministic (batching/MoE/float non-associativity), and
  schema-constrained decoding fixes **form, not meaning**. So consistency must be **engineered**:
  deterministic `programmatic` phases for the exact parts + gates + locked prompts + RAG golden
  context + an eval suite. Not "hope the model is consistent."
- His own instinct already reflected this: he proposed a *"deterministic step of sending the
  final contract."* He intuitively puts exactness in code, not in the model. Good.
- **Dynamic at design time, locked at run time** = the synthesis: the generator dynamically
  decides the input fields/phases; the human refines; it **locks on publish**; every run is
  deterministic in shape. That reconciles "describe it naturally" with "same steps."

## Worked example → phases (kept as illustration; SEED-051 generalizes it)

Operator's example: a recurring legal contract — extract data from a KB folder → fill a contract
template/form → analyze some clauses → produce final → (future) send to client. Mapped to our
actual primitives:

| # | Phase (our type) | Does | Status today |
|---|---|---|---|
| inputs | launch form | client / template / folder | ⚠️ gap — workflows take free-text only |
| 1 | `llm_agent` `[search_documents]` | pull needed data from the right KB folder | ✅ (per-phase folder scoping is a design choice) |
| 2 | `programmatic` **or** `llm_agent` `[execute_code]` | fill the template deterministically | ✅ sandbox ships python-docx + reportlab + openpyxl |
| 3 | `llm_single` / `llm_agent` | analyze specific clauses | ✅ |
| 4 | `llm_human_input` | human review/edit before anything leaves | ✅ first-class |
| 5 | `llm_single` | final version → workspace file | ✅ |
| 6 | `programmatic` **send** | email/DocuSign to recipient | ❌ the one new thing → v2.9 Plugin Contract |

**The honest split: ~80% is buildable on shipped primitives; the one genuinely-new surface is
outbound integrations (step 6), already deferred to the v2.9 Plugin Contract.** The operator's
"integrations later, deterministic send step" instinct is dead-on and already planned.

## Two grounding moments (where "DB-schema + RAG injection" belongs)

1. **Authoring-time grounding** — feed the *generator's* prompt the KB folder tree + tool/skill
   registry + uploaded template → it proposes correct input fields, tools, scoping, fill steps.
   (Canonical analog: text-to-SQL schema-linking — serialize the relevant schema subset, prune
   to relevant, add domain descriptions. Prune is the key caveat.)
2. **Run-time grounding** — each phase pulls fresh KB data (scoped to the right folder) to fill
   the artifact. (Partly shipped: per-phase `search_documents` + F7 grounding union.)

Conflating these two is the usual mistake. They are different injection points with different
jobs.

## Skills vs Workflows vs Tools vs Agents (the operator's core question)

The load-bearing axis = **who decides the next step, and what loads when.**

| Primitive | What it is | Who drives it | Loading | In our code |
|---|---|---|---|---|
| **Tool** | one atomic function | the agent calls it | always in context | `_TOOL_REGISTRY` (~26) |
| **Skill** | a bundle of procedural knowledge + files | **model elects to load** when relevant | progressive disclosure | `skills` table; catalog in system prompt; `load_skill` on demand |
| **Workflow** | LLM+tools through predefined code paths | **author/code** | fixed at authoring | `WorkflowDefinition`; engine owns order |
| **Agent** | a model using tools in a loop | **the model** | dynamic | Deep mode (`phase_whitelist=None`) |

**Unmistakable difference:** a **skill** is *optional model-pulled judgment* (method, not
control; non-deterministic activation); a **workflow** is *author-locked orchestration* (control,
not judgment; deterministic). **Deep mode** is the agent end (full toolset, one global prompt,
model decides everything). **Harness phase** is the workflow end (per-phase whitelist + prompt,
backend-locked order). Anthropic's 5 workflow patterns map ~1:1 onto our phase types
(prompt-chaining → phase sequence + gates; parallelization → `llm_batch_agents`;
evaluator-optimizer → generate+verify-gate; the missing one = orchestrator-workers /
runtime-dynamic subtasks, which we deliberately DON'T have because it trades away determinism).
Anthropic explicitly endorses the **hybrid** (a bounded agentic loop inside a deterministic
structure) — which is exactly an `llm_agent` phase.

## Decision recorded in-session

**Approach = spike-first** (operator asked "what do you recommend?"; recommended A). Do not
pre-commit schema; the migration risk is low (JSONB + optional Pydantic fields grow cleanly).
Finish v2.8 (094 → 095 → 096), open v2.9 with a throwaway spike on a real case, design the
`inputs` + `assets` schema from the evidence. See SEED-051 + the companion spike todo + the open
decisions in `.planning/research/questions.md`.

## Session 2 addendum (2026-06-03) — modes/skills ground truth + UI-surface refinement

Backed by a 4-agent investigation (workflow `wf_a2e14a82-a53`).

**Skills ↔ Workflows — verified ORTHOGONAL today (zero overlap, no contradiction):**
- Deep mode injects the skills catalog into the system prompt (`agent_loop.py:930-951`, General
  only) and `load_skill` is always in `get_tools()`.
- A harness phase **REPLACES** the global prompt with `phase.config.prompt`
  (`phase_types.py:288`, `system_prompt_override`) → no skills catalog reaches the model; and
  `load_skill` is whitelisted in **none** of the 4 seeds. **A phase cannot use a skill today.**
  Two separate subsystems, not competitors. Decision: keep separate in v2.8; design a `skill_ref`
  authoring seam for v2.9 (research/questions.md #4).

**Deep mode — verified it is NOT a toggle/capability:**
- Exactly ONE branch (`threads.py:1146`): `active_workflow_run_id` non-null → Harness; else Deep
  (`run_agent_loop`). "Deep" = "not running a workflow." No `deep_mode` flag exists anywhere.
- True model = a 2×2: Deep/Harness ⟂ General/Explorer. General = 24 tools + skills + memory + 15
  iters; Explorer = `EXPLORER_SYSTEM_PROMPT` + 6 KB-nav tools + 8 iters (`agent_loop.py:909`).
- Operator's "Deep shouldn't be a mandatory pill" = D-092-UX exactly. His "execute with vs
  without Deep and compare" is a category error (Deep IS the baseline); the meaningful A/B is
  **Deep-vs-Harness** on a real KB task (and optionally General-vs-Explorer). Worth running live.

**Current composer (pre-094) for reference:** `MessageInput.tsx` renders THREE sibling dropdowns —
General/Explorer (275-321), Deep/Harness (323-371), workflow-picker (373-423); state in
`ChatArea.tsx:61,68`. This is the confusing surface 094 / D-092-UX fixes.

**UI surface (operator refinement) → captured in SEED-051's "Authoring surface & builder UX":**
Workflows become a nav PAGE (like Skills) = library + build + launch; execution lands in a
thread (no separate run route — D-092-UX preserved); composer loses the picker + the Deep/Harness
pill; builder = AI-led + HITL (observe/approve/suggest) + a LIVE, transparent, view-not-drag
visualization (renders the WorkflowDefinition + reachability graph we already compute). This
RESOLVES the earlier page-vs-panel tension by splitting library/builder (page) from execution
(thread). The visual is a /gsd:sketch deliverable (G-2).
