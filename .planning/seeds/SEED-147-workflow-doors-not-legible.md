---
seed_id: SEED-147
title: The two authoring doors exist but are not legible — an operator using the Builder for real work could not tell "Describe & run" from "Author & govern", or say what the third control does
status: open
planted: 2026-08-10
planted_by: Operator, reviewing the workflow product after the v3.6 deploy (2026-08-10) — "there is no difference between governor and author and the other one if we want to draft the work"
surface: Agentic-RAG
severity: warning
category: product / workflow authoring IA + naming
priority: high
scope: Small-to-medium — naming, copy and entry-point design. NOT new capability.
affected_areas: [workflow-authoring, workflow-builder-header, workflow-door-switch, workflows-page]
related_seeds: [SEED-136, SEED-051, SEED-123]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the next workflow-authoring milestone opens — this is a
  naming/IA question and belongs with SEED-136's page IA, not on its own; (2) a second operator or
  any new user is observed hesitating at the door choice; (3) any phase adds a THIRD door or renames
  either existing one; (4) SEED-051's guided-authoring journey lands, which changes what the fast
  door even means.
trigger_when: unset
---

# SEED-147 — the doors are real, the difference is invisible

## The observation (operator, 2026-08-10)

> "there is no difference between governor and author and the other one if we want to draft the
> work."

Reported after using the shipped v3.6 Builder on live cloud — i.e. by someone who has more context
on this product than any future user will have.

## The current state, measured

The doors are **real and distinct** in the code. `WorkflowDoorSwitch.tsx` implements exactly two,
plus a return control:

| Control | What it actually is |
|---|---|
| **Describe & run** | the fast door — describe it, the model drafts it, run it |
| **🔧 Author & govern** | the STRICT door — mounts the full Builder with complete control |
| **‹ both doors** | a persistent return to the "both" chooser from inside either door |

So this is **not** a missing-feature seed. The distinction is designed, deliberate (D-05: "nothing
lost by picking fast") and implemented. What failed is that a real user could not perceive it — and
named all three controls as one undifferentiated blur.

## Why it matters more than it looks

The two doors ARE the product's answer to its own premise. v3.6's whole thesis is that a
non-technical person can author a governed workflow; the fast door is how they start and the strict
door is where governance lives. **If the choice is unreadable, the thesis is unreachable** — the user
either picks at random or, as observed, does not register that a choice was made at all.

Three specific suspects, none yet measured:

1. **"Author & govern" is two verbs joined by "and", and one of them is jargon.** "Govern" is the
   product's word, not the user's. Compare the KB affordance and the grounding dial, which both got
   plain-language passes; this control did not.
2. **The three controls sit in one strip in the header**, so a return control (`‹ both doors`) reads
   as a peer of the two doors rather than as an escape from them. The operator listed it as a third
   thing they could not distinguish, which is exactly that failure.
3. **Nothing states the consequence of the choice.** Neither door says what you gain or give up, so
   there is no basis on which to choose. D-05 says nothing is lost by picking fast — the UI never
   says so.

## What this is NOT

Not a request for a third door, and not a request to merge the two. The 187 lesson applies directly:
the template door was deliberately made to **seed the describe box** rather than open a second
forward path, precisely to avoid multiplying doors. Any fix here should reduce perceived choices, not
add them.

## Cheapest useful first step

Not code. Put the shipped Builder in front of one person who has never seen it, ask them to say out
loud what each control will do before clicking, and write down what they say. That transcript is the
naming brief. This is the same method that produced SEED-136 — the operator could not name what the
page's own categories meant — and the two seeds should be worked together.

## Suggested routing

Fold into the workflow-authoring milestone alongside **SEED-136** (page IA) and **SEED-051** (guided
authoring). It is a copy-and-placement change with no schema and no API surface, so it is small once
the naming is decided — the decision is the expensive part, not the edit.
