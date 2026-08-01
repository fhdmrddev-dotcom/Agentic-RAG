---
sketch: 150
name: the-seeded-canvas-arrives
question: "What does the AI-seeded canvas arrival feel like, and how does the auto-applied grounding become legible?"
winner: null
tags: [canvas, ai-seed, arrival, governance, phase-187, VOCAB-02]
phase: 187
depends_on: 148
---

# Sketch 150: The seeded canvas arrives

## Design Question

VOCAB-02's headline: describe a workflow in plain language, get a seeded editable canvas draft.
SC#3 adds the safety half — *"a seeded grounded node auto-gets its citation/confidence gate —
safe-by-construction."*

That safety is invisible. Two steps arrive carrying a governance seal **the user never asked for**,
and nothing on the canvas explains why. "Safe-by-construction" that nobody can see is
indistinguishable from magic, and magic is not trust.

## The constraint that shapes every variant

**Generation is single-shot, not streamed.** `generate_workflow_definition`
(`workflow_authoring.py:217`) makes exactly one provider call on a valid first emit — two only on a
first-pass `ValidationError`, never three — and returns the whole definition or an honest error. It
never yields a partial. The builder's state machine is `empty → composing → drafted`
(`WorkflowBuilderPage.tsx:11`).

So **a node-by-node reveal is pacing, not progress.** The work is finished before the first node
lands. Variant A is built and labelled as exactly that, on the canvas, because this project's
standing rule is that a surface never implies an event it did not receive.

## How to View

```
open .planning/sketches/150-the-seeded-canvas-arrives/index.html
```

Press **▶ Describe & draft** on each tab. The comparison rail is pinned at the bottom so you never
have to hold a previous tab in memory (the lesson from sketch 148).

## Variants

- **A: Staged placement** — nodes land one at a time. Carries an honesty note naming the pacing.
- **B: All at once + seed receipt** — the whole canvas appears (matching what happened), plus a
  dismissible receipt: *"Here's what I built — 5 steps. Two read your documents, so I set them to
  must prove it."* Each locked step named with its reason.
- **C: AI-drafted until touched** — every seeded node arrives dashed and marked ✦, clearing to
  ✓ reviewed when you click it.

## What to Look For

The three variants answer **different questions**, and none answers all three:

| | Where do I start reading? | Why is that step locked? | What have I reviewed? |
|---|---|---|---|
| A | ✓ the eye follows the sequence | ✗ never explained | ✗ no record |
| B | ✓ the receipt orients you | ✓ **named, with the reason** | ✗ no record |
| C | ✓ anything still ✦ | ✗ seal still unexplained | ✓ **the whole point** |

**B and C are complementary, not competing.** B is the only variant that discharges SC#3; C is the
only one that tracks review state. A's contribution — orientation — is delivered by both B and C
without the honesty tax.

**Cost to weigh on C:** the ✦/✓ mark sits at the card's **left edge, top** — which is where the
server's verdict mark lives (`PhaseNodeCard.tsx:~376`, `-left-2 top-1.5`). C as drawn would
collide with a validation verdict on the same node. That is a real placement conflict to resolve,
not a detail: the corners are already fully allocated (top-right = governance seal, permanently;
left = transient verdict).

**Cost to weigh on B:** a receipt is a thing to dismiss. Watch whether it feels like an answer or
an obstacle on the second and third run — the calm-first-screen rule (decisions #11/#12) applies to
what comes *after* the draft too.

## Open Question

C introduces a per-node state that must eventually resolve. If a draft is published with nodes
still marked ✦ unreviewed, does anything care? Either it is decorative (fine, but say so) or it
becomes a soft publish gate (a real scope addition, and one the 8-stage gauntlet has opinions
about). Decide which before planning.

## Lineage — what this inherits and what it feeds

**Inherits.** #11 requirement-first describe box and #12 progressive disclosure set the pre-draft
posture; this sketch governs the moment *after* the draft, which #11 says is where refinement
belongs. #16 the publish gauntlet established that honesty surfaces render the real verdict
verbatim, never re-derived — the seed receipt is the same discipline applied to grounding. Phase 185
supplies the ⛨ seal, the "must prove it" vocabulary, and the one-way lock (detection wins,
`groundingCauseOf`). 148-C supplies the titles.

**Feeds.** SC#3's safe-by-construction claim is only discharged if something explains the seal —
B is that something. **Phase 188** run state lands on these same nodes, so C's ✦/✓ marks compete
with the run-status treatment as well as with the verdict slot. **Phase 189** external actions will
add a second thing the seed applies without being asked, and will want the same receipt.

**Icon convention (#43).** Phase-type marks via `icon3d()`; the seal is the shipped `⛨`. C's `✦`
(drafted) and `✓` (reviewed) are **net-new and flagged as such** — they are proposals, not existing
vocabulary, and they occupy the verdict slot's coordinates.
