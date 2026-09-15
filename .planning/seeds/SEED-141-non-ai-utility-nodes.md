---
seed_id: SEED-141
title: The canvas has seven phase types and all seven are AI steps — investigate a class of deterministic, non-AI utility nodes (the n8n-style primitives) for the plumbing between them
status: open
planted: 2026-08-08
planted_by: Operator, during the 189-16 owed-rows UAT (2026-08-08) — "maybe we should have some sort of nodes that are common that are not AI related directly, similar to n8n… some type of nodes that we will investigate later"
surface: Agentic-RAG
severity: info
category: product / workflow vocabulary + competitive positioning
priority: medium
scope: Large — a research + design question first, NOT an implementation ticket
affected_areas: [workflow-canvas, phase-types, harness-engine, workflow-vocabulary, publish-gauntlet]
related_seeds: [SEED-123, SEED-136, SEED-140]
re_open_trigger: >
  Re-open when ANY of these is true: (1) a user asks for branching, filtering, looping or "just
  reformat this between the two steps" and the only answer is "write a prompt for it"; (2) Phase 190
  lands connectors — a connector that cannot be preceded by a deterministic field map will push this
  immediately; (3) an eighth AI phase type is proposed — stop and ask whether the need is actually a
  utility node; (4) the competitive crawl is refreshed and n8n/Zapier-style primitives are again the
  visible gap; (5) any phase proposes adding conditional execution to the LINEAR spine.
trigger_when: unset
---

# SEED-141 — the missing half of the node vocabulary: deterministic utility nodes

## The observation (operator, 2026-08-08)

> "maybe how we develop those workflows further — maybe we should have some sort of nodes that are
> common that are not AI related directly, similar to n8n. So maybe we should have some type of nodes
> that we will investigate later."

Explicitly planted as **investigate later**, not as a build request.

## The current state, measured

The canvas ships **seven** phase types as of Phase 189, and **every one of them is an AI step**:

| # | Type | What it is |
|---|---|---|
| 1 | `llm_static` | a fixed step the server runs |
| 2 | `llm_single` | writes one piece in one pass |
| 3 | `llm_agent` | searches and decides its own next move |
| 4 | `llm_batch_agents` | several assistants in parallel |
| 5 | `llm_human_input` | pauses for a human answer |
| 6 | `llm_emit` | fills a template, produces the file |
| 7 | `external_action` | records an outward action (no egress until 190) |

Even the two non-generative ones are modelled as `llm_*`. There is no way to express a step that is
purely deterministic: no branch, no filter, no loop, no field map, no format conversion, no wait, no
arithmetic. Anything of that shape today must be asked of a model in a prompt — which costs a call,
introduces variance, and is exactly the kind of work a model should not be doing.

## Why this is worth real investigation rather than a quick add

**It is the competitor's home turf, and the milestone already studied them.** The v3.6 roadmap's
differentiator is *graded governance* — the thing Beam/Glean/n8n do NOT do. This seed is the mirror
image: the thing they all DO and we do not. Adding primitives badly would trade our differentiator
for a worse version of theirs; the question is which primitives earn their place in a
governance-first product, not how to catch up feature-for-feature.

**Three constraints in this codebase shape the answer, and any design must start from them:**

1. **The spine is LINEAR, not a free DAG** (recorded at v3.6 kickoff, `WorkflowDefinition` projects a
   linear spine). Branching and looping are precisely the primitives that want a graph. Either the
   primitives stay linear-compatible (map, format, filter-in-place) or the linear commitment is
   revisited — and that is a milestone-level decision, not a node addition.
2. **Governance is defined over AI steps.** Grounding strictness, the citations gate, the judge, the
   action-risk checkpoint — the gauntlet's vocabulary assumes a model did something that needs
   proving. A deterministic node needs an honest answer to "what does *must prove it* mean here?"
   The likely answer is "nothing, and it says so" — but that has to be designed, not defaulted, or
   the seal becomes noise.
3. **A node's face is computed from its config** (the D-13 ladder). A utility node's face has no
   prompt to derive from, so the vocabulary layer needs a new tier or the cards read empty.

**The cheapest useful first step is not code.** It is: look at real workflows people build here and
count how many prompts exist only to reshape data between two real steps. If that number is high,
the primitives are earning their place; if it is low, this stays a seed.

## Candidate primitives, unranked and unvalidated

Listed only so the investigation has a starting set, not as a proposal:
field map / rename · filter rows · format or parse (JSON, CSV, date) · merge or split ·
static value or constant · simple arithmetic or aggregate · delay or wait-until ·
conditional gate (linear-compatible: continue or stop, not branch) · dedupe.

⚠ Note that several of these already exist *inside* the sandbox as `execute_code`, which is the
honest incumbent answer and should be the baseline any proposal has to beat. "Why not just run code?"
is the first question a reviewer will ask, and it deserves a real answer — probably about legibility
on the canvas for non-technical authors, which is the whole premise of the Studio.

## Suggested routing

**Research phase, not a build phase.** Sequence after Phase 190 (connectors), because a connector is
the strongest forcing function for deterministic plumbing — a real integration will want its payload
shaped before it goes out, and that is where the need becomes concrete rather than theoretical.
