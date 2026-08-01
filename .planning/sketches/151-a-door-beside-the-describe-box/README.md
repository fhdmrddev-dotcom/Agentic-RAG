---
sketch: 151
name: a-door-beside-the-describe-box
question: "How does start-from-a-template sit beside the describe box without breaking the calm first screen?"
winner: "C"
winner_note: "Template seeds the describe box. Preserves the calm first screen AND keeps ONE forward path (describe then draft); the gallery stays on the Workflows page per decision #19."
tags: [builder, templates, first-screen, phase-187, VOCAB-03]
phase: 187
---

# Sketch 151: A door beside the describe box

## Design Question

VOCAB-03: *"A user can start from a template / starter flow on the canvas (reuses the shipped
Starter Workflow Library)."*

This runs straight into three locked decisions:

- **#11** describe-box-only first screen — everything else is post-draft, revealed by the draft.
- **#12** the 3-second read at rest — the first screen must read in 3 seconds with no clutter.
- **#13** modals only for must-decide moments; teaching on a calm screen uses inline affordances.

A template gallery on the first screen breaks all three. The question is what the smallest honest
door looks like.

## Measured facts that shape the answer

- **There are exactly three curated starters.** `list_starter_workflows` (`db/workflows.py:291`)
  reads `definition->>'category' = 'starter'`; migration 094 seeds **Risk Register**, **Weekly
  Status Report**, **Compliance Gap Report**. A gallery is over-built for three — and all three are
  used verbatim in the sketch.
- **"Fork a starter" is already one of the four routes into the Builder**
  (`WorkflowBuilderPage.tsx:459`). The plumbing exists. What is missing is a door *on the first
  screen* — today you have to already know to come via the Workflows page.

## How to View

```
open .planning/sketches/151-a-door-beside-the-describe-box/index.html
```

Toggle **◱ 3-second read ruler** to count what the eye must process before it can act. The
comparison rail is pinned at the bottom.

## Variants

- **A: Quiet link** — one line under the CTA: *"or start from a template"* → opens a picker sheet.
- **B: Inline chips** — the three starters as chips directly under the box.
- **C: Template seeds the box** — same quiet link, but picking a template **fills the describe box**
  with its plain-language description instead of jumping to a canvas.

## What to Look For

| | Calm screen preserved? | A first-timer finds it? | One forward path? |
|---|---|---|---|
| A | ✓ 1 extra line | ✗ easy to miss | ✗ template → canvas skips drafting |
| B | ✗ 8 elements before acting | ✓ unmissable | ✗ template → canvas skips drafting |
| C | ✓ 1 extra line | ✗ same link as A | ✓ **always describe → draft** |

**The third column is the one that matters most and is easiest to overlook.** A and B both create a
*second forward path*: template → canvas, skipping generation entirely. That is a second way for a
workflow to come into existence, with different code, different failure modes, and no pass through
the describe → draft flow that everything else is built around. C collapses it back to one path.

**C's cost is real and should not be waved away.** It discards the starter's *curated definition* —
a workflow a human shaped — and re-derives one from a sentence. The draft may come back with
different steps than the starter. Press a template on tab C to see the honest note about this.

**Judge B with your eyes, not the count.** The "8 elements" framing is deliberately unflattering,
and B may well read calmer in practice than the number suggests — three chips are quiet. Use the
ruler, then decide whether the count is measuring anything you actually feel.

## Open Question

If C wins, does the starter's curated definition still have a home? Options: keep A/B's direct fork
on the **Workflows page** (where it already lives, and where a gallery is appropriate) and let the
first screen carry only C's sentence-seeding door. That would give both behaviours a home without
either one crowding the calm screen — worth deciding at discuss-phase rather than assuming.

## Lineage — what this inherits and what it feeds

**Inherits.** #11 describe-box-only first screen, #12 the 3-second read, #13 tiered guidance —
all three are the acceptance bar, not background. #19 the THREE-HOMES navigation contract is the
one that decides this: **authoring = the Builder, library + launch = the Workflows page.** A template
gallery is library work and #19 already gave it a home. #36 the workflow soul (glyph-dot phase spine)
is what identifies a starter at any size. #37 the strict/loose two-door fork is the precedent for
offering an alternative entry without cluttering the calm path.

**Feeds.** Whichever variant wins, the *curated definition* path and the *describe* path must not
both become first-class on the same screen — that is the second-forward-path risk this sketch names.

**Icon convention (#43) — corrected during operator review.** An earlier draft gave each starter ONE
phase-type glyph as a category icon. That misuses the shared map (`icon3d('llm_agent')` means "this
STEP is an agent step", not "this WORKFLOW is about risk"), and this system has no category-icon
vocabulary. Every starter is now identified by its **phase spine** per #36, at both sizes. Honest
side effect: the chips wrap to two lines, which strengthens rather than softens B's density cost.
