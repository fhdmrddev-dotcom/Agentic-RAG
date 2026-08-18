---
seed_id: SEED-182
title: The AI-is-composing moment is a greyed-out copy of the form you just filled in — two describe screens, one of them dead, and no sense that anything is happening
created: 2026-08-18
planted_during: Phase 197 close — operator observation after Claude drove 6 of 11 G-4 UAT rows live
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-183 — the draft configuration surface vanishing. SAME JOURNEY, and the operator raised both
    in one breath; sketching them apart guarantees the compose screen gets drawn twice.
  - SEED-184 — the information-density language. The composing surface is one of the places that
    language has to land, so it must not be designed before the language is settled.
  - Phase 197 (guided-authoring) — shipped the ARRIVAL moment (`DraftArrivalCard`). This seed is the
    moment immediately BEFORE it, which nothing has ever designed.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowBuilderPage.tsx` (47/14/2656, G-5 FIRING)
    and `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (12/8/522, G-5 FIRING). Both are
    firing rows; read their named seams before planning.
trigger_when: >
  The condition is ALREADY TRUE and reproducible in under a minute — this is not a wait-for-a-signal
  seed. Plan it with SEED-183 and SEED-184 in ONE sketch of the workflow journey.

  Reproduce: Workflows → Build a workflow → "Draft it for me" → type anything → press
  "Write the first draft". Watch the screen between the press and the draft landing.
---

# The composing moment is a greyed-out duplicate of the form you just filled in

## What the operator saw

> "once we compose then another page with the same information — same structure — asking to describe
> again, to select a knowledge base, and the composing is a button and it is disabled. This page we
> cannot do anything. Instead of this page we should put a nice loader that is describing that the AI
> is composing, with a nice animation and something that reflects an agentic feeling."

## Measured cause — two describe screens, and one screen serving three states

**There are TWO describe screens, and the first one does not generate anything.**
`WorkflowDoorSwitch.tsx:399-411` — the door's "Write the first draft" button is a HAND-OFF: it seeds
the text, sets `handoffDraft`, and flips `setDoor("govern")`. The Builder then renders its own
pre-draft describe screen, which asks the same questions again. The comment there records that an
earlier bug dropped the text entirely and *"the user landed on an empty screen"* — the hand-off was
armed to fix that, and the duplication is the residue.

**Then one screen serves three different states.** `WorkflowBuilderPage.tsx:1900`:

```
if (builderPhase === "empty" || builderPhase === "composing" || builderPhase === "error") {
```

During `composing`, the ONLY differences from the idle form are:

| Line | Difference |
|---|---|
| `:1919` | the describe textarea is `disabled` |
| `:1934` | the folder picker is `disabled` |
| `:1985` | the CTA label becomes `"Composing…"` |

So the author, having already answered these questions on the previous screen, is shown them a second
time, greyed out, with a dead button — for the entire duration of a real LLM generation.

## Why this is worth its own work rather than a tweak

The product's whole claim is that an agent is doing something for you. **The one moment where that is
literally true is the moment we render as a disabled form.** Every other surface in this app has been
given a considered live-execution treatment — the run-status strip, the phase spine, the tool-call
panel — and this one never was, because it falls between the door (which owns the question) and the
Builder (which owns the result).

## Feasibility — the state already exists, which is the good news

`BuilderPhase` is already `"empty" | "composing" | "drafted" | "error"` (`builderStore.ts:139`), and
`"composing"` is already set (`:417`) and already read (`useTemplateFirstDraft.ts:464`). **No new
state machine is needed.** What is missing is a surface for a state that is already modelled — the
work is design, not plumbing.

Two things a plan must decide rather than assume:

1. **Whether the second describe screen should exist at all.** If the door has already collected
   describe + KB + template, the Builder's pre-draft screen is only reachable via the "Build it
   myself" door and a cold entry. Collapsing it is a bigger change than adding a loader and must be
   priced separately.
2. **What the composing surface says.** It should reflect real progress if the backend can report any
   (steps composed, grounding applied), and must NOT fake progress it cannot observe — this project
   has a standing rule that a fabricated number is a lie a reader cannot see through.

## How we would know this failed

- The author cannot tell whether anything is happening.
- The composing surface animates on a timer unrelated to real work.
- The same questions are still asked twice.
