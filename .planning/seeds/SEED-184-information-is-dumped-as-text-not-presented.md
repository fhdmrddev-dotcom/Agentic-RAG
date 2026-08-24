---
seed_id: SEED-184
title: The information is right and the presentation is wrong — everything arrives at once as flat text, with no hierarchy, no progressive disclosure, and none of the app's own colour or iconography carrying meaning
created: 2026-08-18
planted_during: Phase 197 close — operator observation, explicitly noted as a RECURRING complaint ("something that I mentioned before")
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-182 and SEED-183 — the same journey. This seed is the LANGUAGE those two surfaces must
    speak, which is why all three belong in ONE sketch: design the composing state or the persistent
    decisions panel before the density language is settled and both get drawn twice.
  - SEED-155 — the sketch drew an atom `WorkflowCard` STRUCTURALLY CANNOT render. Any sketch here
    must RENDER the shipped components, not redraw them (see the sketch-to-build-drift rule).
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/components/workflows/library/WorkflowCard.tsx`
    (8/3/818) — ⚠ **G-5 FIRING WITH AN UNDISCHARGED OBLIGATION: the next phase touching this file
    owes a refactor recommendation FIRST.** This seed is very likely that phase.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowsPage.tsx` (34/12/1176, satisfied 192).
  - The `sketch-findings-agentic-rag` skill — the icon convention (§4) and the existing soul-atom
    vocabulary are prior art and must be read before drawing.
trigger_when: >
  ALREADY TRUE, recurring, and raised by the operator more than once. It is a DESIGN question, so the
  trigger is a sketch, never a spec: `/gsd:sketch` over the workflow journey (library + draft +
  compose), with SEED-182 and SEED-183 in the same session.
---

# The information is good; the way it is presented is not

## What the operator said

> "not only in the draft workflow page but also on the main page of the workflows — which is something
> that I mentioned before — the information is too much. It contains too much text. It is not built to
> meet a good user experience. The information should be expandable, not only text; it should be
> coloured according to the theme of this application. And if the user wants information he can click
> and see, instead of just reflecting everything as a long text. A lot of information is there —
> information overall is good — but the way we are presenting it is not good, because we are just
> throwing everything in one go without considering colours, the buttons, the icons. I don't know how
> to describe this feeling but I hope you got the idea."

⚠ **Recorded verbatim on purpose.** The operator says twice that they cannot name the quality they
want. That is precisely the case the project's G-2 rule exists for: *"operator-approved mockup is the
acceptance bar."* **Do not convert this into a written spec and skip the drawing** — the words are the
symptom; the mockup is the specification.

## The name for what is being asked for

**Progressive disclosure**: show the one line that decides whether the reader cares, and let the rest
open on demand. Paired with using the design system's colour and iconography to CARRY meaning that
text is currently carrying — so that scanning works before reading does.

## Observed, not asserted

Measured during Phase 197's live UAT session:

- The library renders **111 cards**, each carrying a full stack of soul atoms — purpose, needs, spine
  dots, tier, output, fork consequence, identity line, provenance, version — all at one visual level,
  all expanded, all at once.
- The arrival card is **147 px** collapsed and **398 px** with both folds open. The folds are the one
  place in this surface where progressive disclosure IS already used — and the operator's complaint is
  effectively *do that everywhere else too*.
- The describe screen explains itself in full paragraphs beneath every control.

⚠ **The folds are prior art in the right direction and should be the starting point of the sketch,
not a thing to invent.**

## Scope — deliberately the whole journey, not one page

The operator named the library AND the draft page. The composing surface (SEED-182) and the persistent
decisions panel (SEED-183) do not exist yet and will be built in whatever language this settles. So
the sketch covers: **library card → draft/builder surface → composing state → arrival/decisions.**

## Constraints a sketch must honour

1. **Render shipped components, do not redraw them.** SEED-155 is the recorded cost of ignoring this —
   a sketch drew an atom the card structurally cannot render, and the gap was only found at build.
2. **The icon convention is single-source** (`sketch-findings-agentic-rag` → `references/icon-convention.md`
   §4): provider/model icons from `@lobehub/icons`, phase-type icons from the shared `PHASE_GLYPHS`
   map. Colour must come from the Deep Midnight theme tokens, never new hex.
3. **Nothing may be hidden that a person needs to make a decision.** Progressive disclosure that
   buries the governance state, the strict/loose door, or the deliverable would trade one bad
   experience for a worse one.
4. **The 14th atom / identity line and the governance corner mark are load-bearing** — Phase 185
   established that the card's top-right corner is claimed and that governance spends no extra colour.

## How we would know this failed

- The reader still cannot tell two cards apart at a glance.
- Colour is decorative rather than meaningful — it does not encode anything a person can learn.
- Something a person needs in order to choose is now behind a click they have no reason to make.
- A card is prettier but says less.
