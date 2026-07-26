---
sketch: 139
name: validation-while-building
question: "How do server verdicts read on the canvas while the flow is half-built — so 'you cannot draw an invalid workflow' holds without punishing someone for not being finished?"
winner: null
tags: [phase-184, valid-02, valid-03, severity-split, incomplete-vs-error, problems-tray, prevent-at-source, grounding-unavailable, g2-sketch-gate]
---

# Sketch 139: Validation while you build

## Design Question

VALID-02 says a user must be **prevented from drawing a structurally invalid workflow**, live, as the
canvas is built. VALID-03 says the per-node status must be **derived from the server verdict, never from
a client-side guess**.

Those two sentences are easy to satisfy badly. The trap is D-182-03's severity split:

| severity | means | but |
|---|---|---|
| `error` | broken — this cannot run | |
| `incomplete` | you are not finished | **this is not a mistake** |

Both set `ok: false` and both block a publish. Only one of them is bad news — and `incomplete` is the
state a canvas spends most of its life in. A surface that paints them the same colour tells a person
they have done something wrong every time they pause halfway.

## How to View

```
open .planning/sketches/139-validation-while-building/index.html
```

The **State of the draft** control switches between five real situations: Finished · Mid-build ·
Genuinely broken · Both at once · Check itself failed. The right rail shows the literal
`POST /workflows/validate` reply behind every mark on screen.

## Variants

- **A: A quiet mark on the node, the detail in a tray.** A small corner mark per affected step (red `✕`
  broken / dashed grey `○` unfinished); the cards keep their size. A tray at the bottom states the count
  in two separate words — *"1 problem · 2 things to finish"* — before you open it. Rows jump to the step.
- **B: The message lives on the card.** No tray: each verdict renders inside the step it belongs to with a
  severity stripe. Nothing hidden, one place to look — at the cost of growing cards and a noisy resting
  state.
- **C: Do not offer the invalid move.** The picker greys out choices that would break the flow *and says
  why*; a delete that would orphan the next step is refused before it happens; the server verdict shrinks
  to a quiet backstop strip.

## Everything on screen is real

No invented copy. The codes come from the modules that own them —
`reachability.LINT_CODES` (`bad_index`, `input_unsatisfied`, `no_terminal`, `orphan_phase`,
`unsatisfiable_skip`), `grounding.GROUNDING_VERDICT_CODES` (`folder_scope`, `unregistered_tool`,
`unregistered_skill`), the two the route mints itself (`business_requirement`, `interactive_phase`), and
the infrastructure-honesty code `grounding_unavailable`. The technical messages under ⌥ are the actual
f-strings those modules emit, e.g. `"input_key 'template_fields' is never produced by an upstream phase
or a run input"`.

That is not pedantry — a sketch that showed plausible-looking made-up verdicts would be sketching a
surface that cannot exist, and VALID-03 is specifically the rule against re-deriving anything client-side.

## What to Look For

1. **Switch to "Mid-build" and ask whether it feels like failure.** Three `incomplete` verdicts, zero
   errors, `ok: false`. If any variant reads as alarming here, it is wrong — that is the normal state.
2. **Then "Both at once."** One real error among two not-finished notes. Can you tell at a glance which
   one needs you *now*?
3. **"Check itself failed."** The registry read failed, so the route returns `grounding_unavailable` at
   severity `error` rather than a clean `ok: true`. **"We could not check" must never render as "fine"** —
   otherwise a database blip reads as a green light.
4. **Where a workflow-wide verdict lands.** The missing description belongs to no step. A has a home for
   it; **B does not** — watch it vanish from the canvas entirely.
5. **In C, open the `＋` at the end of the flow.** The options that would strand the deliverable are
   disabled *with a reason*, and deleting the first step is refused. Then read the backstop strip: it
   admits what prevention cannot cover.
6. **The rail, always.** Every mark on the canvas traces to one row keyed by `verdict.phase` — the phase
   `slug`, which is already `node.id`.

## The finding C forces

C is not really a third alternative. Prevention can decide anything about the *shape* of the flow, but it
cannot decide whether a tool exists, whether a folder is in scope, or whether you have written a
description — those can only be reported. **So C is "A or B, plus a gate."** The open question is whether
that gate is worth its cost, given it must never become the thing that stops someone building.

## Verification

Driven in Chrome DevTools at 1440×900 across 3 variants × 5 scenarios: mark rendering, tray counts and
row-focus, the workflow-wide row that has no node to point at, inline card verdicts, C's disabled picker
options and refused delete, the debounced "checking…" beat, and the degraded honesty block. No console
errors; inline JS passes `node --check`.
