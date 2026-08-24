---
seed_id: SEED-183
title: The draft's configuration surface disappears the moment you navigate away — and with it the ONLY control that can rename a workflow — even though the workflow is still an unpublished draft
created: 2026-08-18
planted_during: Phase 197 close — operator observation, independently confirmed by Claude's live UAT (observation O-1)
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - Phase 197 D-06 — *fresh generations only*. This seed CHALLENGES that decision on lived
    experience. D-06 is not wrong; it is narrower than the surface it ended up governing.
  - Phase 197 D-17 — *the name has NO existing control anywhere, so row 4's inline field is not a
    second answer but the first*. That premise is exactly why the disappearance costs a capability.
  - SEED-182 — the composing moment. SAME JOURNEY; sketch together.
  - SEED-184 — the density language this surface must speak.
  - `.planning/phases/197-guided-authoring/197-HUMAN-UAT.md` → observation O-1, with the measurement.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowBuilderPage.tsx` (47/14/2656, G-5 FIRING).
trigger_when: >
  ALREADY TRUE and reproducible in three clicks. Plan it with SEED-182 and SEED-184 as one sketch.

  Reproduce: generate a draft → the arrival card appears with its two folds → press ✕ (or navigate to
  the library and re-open the draft). The card is gone. Then try to rename the workflow.

  Mechanical check, in the browser console on a re-opened draft:
    document.querySelectorAll('[data-testid="decision-name-input"]').length   // measured 0
---

# The configuration surface vanishes while the workflow is still a draft

## What the operator saw

> "once we land on the workflow draft page we see those two menus where I can configure. But if I
> clicked on any card or navigated away, this disappeared — even though the status of the workflow is
> still draft and it is not published. I want you to study if this is feasible technically and from a
> user perspective."

## Measured, twice, independently

Claude's live UAT of Phase 197 reached the same place from a different direction and recorded it as
observation **O-1**:

| State | `decision-name-input` count |
|---|---|
| arrival card open | 1 |
| after pressing ✕ | **0** |
| re-opened draft from the library | **0** |

The only other text input anywhere in the Builder is `business-requirement-input`. **So a workflow's
name is editable during exactly one moment — the arrival — and never again through the interface.**
An author who dismisses before renaming cannot rename at all.

This is a direct consequence of D-17's own premise, quoted from `197-09`: *"the name has NO existing
control anywhere, so the row's inline field is not a second answer but the first."* Row 4 is the first
control. It is also the **only** one, and it lives on a dismissible card.

⚠ It is also what makes `WR-01` (the empty-name blank title, fixed in `4e7326c7`) rare rather than
common: a name can only be emptied inside that same single moment.

## Feasibility — TECHNICAL: cheap. The gate is one line.

`showReceipt` is `useState(false)` at `WorkflowBuilderPage.tsx:767` and set `true` at exactly ONE site
(`:884`, inside `onDrafted`). The Builder always knows it is on a draft — its own save state reads
*"Saved · still a draft"*, and publishing is a separate act behind the gauntlet. So a
draft-lifetime gate is trivially available.

⚠ **But do NOT simply widen `showReceipt`.** Phase 197 spent eleven plans establishing that this card
carries **two different classes of value**, and the distinction is exactly what decides this:

- **The receipt** — *"Here's what I built — 2 steps"* — is PAST-TENSE and reads a SNAPSHOT of one
  generation. It is only TRUE at arrival. Persisting it would make the AI narrate the author's own
  later edits, which is the CR-01 shape this project has now hit five times.
- **The decisions rows** are LIVE — they read the definition as it is now, and they are the half the
  operator actually wants kept.

**So the design answer is to SPLIT the card, not to keep it:** the decisions become a persistent
draft-side surface for the whole draft lifetime; the receipt stays bound to the arrival moment.
That split is already load-bearing in the code and needs no new concept.

## Feasibility — USER: yes, and the current behaviour is the anomaly

The workflow is unfinished by definition — it is a draft. The controls that make it finishable
should not disappear because the author clicked something. The counter-argument D-06 was protecting is
real and must be preserved: *an AI just made these decisions for you* is a claim that is only true
once, so a re-opened draft must not be told a story about a generation it did not just witness. The
split honours both.

## What a plan must decide rather than assume

1. **Where the persistent decisions surface lives** — inline in the graph column (competing with the
   graph for space, and sketch 172 measured a fourth child stranding the graph at 0 px), or the
   right-side workspace panel, or a collapsed strip in the header.
2. **What it is called when it is no longer an arrival** — the copy is currently past-tense throughout
   and cannot be reused verbatim.
3. **Whether a re-opened draft shows it OPEN or COLLAPSED.**

## How we would know this failed

- A re-opened draft narrates a generation as though it just happened.
- The persistent surface pushes the graph below a usable height.
- The author still cannot rename a workflow after dismissing something.
