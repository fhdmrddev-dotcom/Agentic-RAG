---
id: SEED-152
title: Workflow phase outputs carry NO confidence score — chat messages carry three. The operator's own "citation AND confidence" rule is satisfied in chat and silently unmet in workflows
status: planted
planted: 2026-08-12
planted_by: External review 2026-08-12 (finding F7, marked UNVERIFIED by the reviewer) — VERIFIED against the tree the same day
surface: Agentic-RAG
severity: warning
category: product / workflow honesty / governance
priority: medium-high
scope: Small-to-medium — the value is already computed for chat; the work is carrying it onto the harness run model and surfacing it. No new model call.
affected_areas: [harness, workflow-run-surface, phase-outputs, governance, triggers]
relates_to:
  - SEED-013 (public API / MCP server) — argues these three fields are the single most valuable thing an external caller receives, because they are what let a caller decide auto-reply vs human escalation
  - SEED-014 (triggered + scheduled runs) — already lists `confidence.low` as a trigger event, so the vocabulary exists elsewhere in the plan while the value does not exist in workflows
  - SEED-141 (the canvas has seven phase types) — confidence is the most defensible FIRST conditional, because the value is server-computed rather than author-authored: it needs no expression language
  - SEED-076 (filtered vector search recall) — the same retrieval layer produces the similarity this rides on
trigger_when:
  - Any conditional / branching work is scoped — this is the cheapest honest predicate to branch on, and picking a different one first bakes in an expression language
  - The public API or MCP server is scoped (SEED-013) — external callers need it per response, and a workflow response would ship without it
  - SEED-014 triggers are scoped — `confidence.low` cannot fire on a workflow run that computes no confidence
  - Any customer asks "how do I know when to review the output myself"
---

# SEED-152: a workflow step cannot say "I'm not sure"

## The gap, measured

**Chat messages carry three confidence fields.** `backend/app/models/message.py:37-39`:

```
confidence_level: str | None
confidence_avg_similarity: float | None
confidence_disclaimer: str | None
```

**Workflow phases carry none.** `grep -n "confidence" backend/app/models/harness.py` returns
**zero matches** (measured 2026-08-12).

So the same retrieval, in the same product, produces a calibrated "how sure am I" in chat and
produces nothing in a workflow run.

## Why it matters more than it looks

**1. It is an unmet rule the operator already wrote.** The standing requirement is that KB-sourced
content carries a **citation AND a confidence score**. Chat satisfies both halves. Workflows satisfy
the citation half and silently drop the other — on the surface being sold as the governed one. That
is a governance claim with a hole in it, not a missing nicety.

**2. It is the cheapest honest conditional.** `SEED-141` wants conditionals and asks what a
deterministic node should be graded on. Confidence sidesteps the hardest part of that question: the
value is **computed by the system, not authored by a user**, so "continue if confident, otherwise ask
a human" needs **no expression language, no operators, no parser**. Every other first-conditional
candidate drags an authoring surface behind it. Worth deciding this before branching work starts,
because whichever predicate ships first sets the shape.

**3. `SEED-014` already speaks the vocabulary.** It lists `confidence.low` as a triggered-run event.
A trigger cannot fire on a value the run never computes.

**4. It is the external-caller story.** `SEED-013` argues these fields are the single most valuable
thing an API hands back — they are what lets a caller auto-send versus escalate to a person. A
workflow-shaped API response would ship without the field that makes the API worth calling.

## What a customer can do afterwards that they cannot do now

Read a workflow's output and know which parts to check. Today every step's output is presented with
identical certainty whether the knowledge base answered it well or badly — which is exactly the
failure mode this product exists to avoid, appearing inside the product's own governed surface.

## What breaks or embarrasses us without it

Nothing crashes. The embarrassment is specific and demo-shaped: a customer asks *"how do I know when
to review it myself?"*, and the answer for chat is "look at the confidence" and the answer for
workflows — the enterprise surface — is "you can't."

## Open questions

1. **Per phase, per run, or both?** A phase-level value is what a conditional needs; a run-level
   rollup is what a human reads first. They are different aggregations and probably both wanted.
2. **What does confidence mean for a phase that did no retrieval?** An `external_action` or a
   `programmatic` step has no similarity to average. `None` is the honest answer and must render as
   *"not applicable"*, never as *"low"* — the same honesty rule the empty-state work in Phase 192
   just spent a fast-fix on (`60b8842f`).
3. **Does it belong on the phase output or on the run's audit record?** `harness_audit` already exists
   and is the natural home for something reviewers read after the fact.
4. **Does the canvas show it?** Per the D-12 constraint, the node card already has a **third badge as
   a typecheck error** and badge slot 1 reserved. A confidence mark on the card is NOT free — check
   `PhaseNodeCard`'s corner-mark rules before assuming a place exists.

## Confidence in this seed

**Measured 2026-08-12:** the three fields in `message.py`; zero occurrences in `harness.py`.
**Not checked:** where the chat value is computed and whether that code is reachable from the harness
path without refactoring; whether `harness_audit` has a natural column for it.

## Related

[[SEED-013]] · [[SEED-014]] · [[SEED-141]] · [[SEED-076]]
