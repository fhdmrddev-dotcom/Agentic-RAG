---
seed_id: SEED-156
title: Both authoring doors open onto the SAME first screen, word for word
status: open
planted: 2026-08-14
planted_by: Phase 193 close — code review WR-04, measured wider than the finding as written
surface: Agentic-RAG
severity: medium
affected_areas: [workflow-authoring, WorkflowDoorSwitch, WorkflowBuilderPage, door-vocabulary]
requirements: [AUTH-01]
re_open_trigger: >
  UAT rows U1/U2 being driven (a person who has not used the Builder predicting what each door
  does), OR any phase touching the pre-draft describe screen of either door, OR any sketch of the
  authoring chooser. Whichever comes first.
trigger_when: unset
---

# Both authoring doors open onto the same first screen

## The measurement, not an impression

Taken from Phase 193's own committed characterization captures
(`WorkflowDoorSwitch.baseline.test.tsx`), comparing the ordered non-empty text nodes of
`DESCRIBE_STANDALONE` (23 nodes) against `GOVERN_STANDALONE` (14 nodes):

**11 of the govern door's 14 text nodes are shared with the describe door's.**

```
SHARED: ‹ Change how I start
SHARED: ✎
SHARED: What recurring work should this automate?
SHARED: Write the first draft
SHARED: You describe the goal — the AI
SHARED: writes the steps
SHARED: sets how strict it is
SHARED: asks about anything it had to guess
```

Everything the two first screens do NOT share:

| | describe door | govern door |
|---|---|---|
| strip label | `⚡ Drafting it for you` | `Build it myself` + `🔒 judge always-on` |
| extra affordance | `🔧 Need to set citations, checks, or per-step sources yourself?` | — |

Below the header strip, **the two doors are the same screen.**

## Why this matters — it lands on the phase's own success criteria

The chooser sells the two doors as a real choice:

- door A — `⚡ · you write one paragraph · Draft it for me`
- door B — `🔧 · you decide every setting · Build it myself` ·
  *"Open the editor and set each step yourself — what it must cite, which checks have to pass,
  and which model runs each step."*

A person who picks **"you decide every setting"** is then shown a box asking them to describe the
goal in plain language, under the sentence **"the AI writes the steps, sets how strict it is"** —
which is door A's promise, restated on door B. The setting-by-setting editor door B advertises
appears only *after* a draft exists.

That bears directly on:

- **SC#1** — *a person who has not seen the Builder can predict what each door does before
  clicking.* If both doors open the same screen, a prediction cannot be checked against what opens.
- **SC#2** — *the number of perceived choices does not increase.* Two doors that behave identically
  at step 1 is arguably a choice that costs something and buys nothing yet.

## ⚠ This was NOT caused by Phase 193's fast-fix — it was EXPOSED by it

Stated precisely, because the opposite reading is the tempting one.

Before `294a2ac8`, the two screens were **already the same screen**, with synonymous wording:

| | describe door | govern door (before the fix) |
|---|---|---|
| CTA | `Write the first draft` | `Draft the workflow` |
| hint | `writes the steps` · `sets how strict it is` | `drafts the phases` · `sets the strictness` |

`WorkflowBuilderPage.tsx` held a second, ungoverned copy of those strings. The fast-fix moved them
onto the governed ids, which removed the cosmetic difference and made the duplication legible.
**The duplication is older than the fix.** Reverting the fix would restore ungoverned literals and
re-hide the problem — it would not solve anything.

## What was deliberately NOT done, and why

No new door-B copy was authored at Phase 193's close. Three reasons, in order of weight:

1. **G-2.** This is a UX change on a live surface; the guardrail requires an operator-approved
   sketch as the acceptance bar. Sketch 164 covers the door WORDS on the chooser and the strips —
   it draws **no mockup of either door's pre-draft screen** (`164/README.md:149-157` says so).
   Inventing copy here would ship a surface with no acceptance bar at all.
2. **The 187 template-door lesson.** The failure mode on this exact surface is *adding* a path
   rather than seeding the existing one. A third variant of the describe screen is an addition.
3. **It is a product ruling, and the instrument that settles it exists.** UAT rows **U1** and **U2**
   ask a person who has never used the Builder to predict what each door does and to count the
   choices they perceive. That is the same question from the side that actually decides it.

## The options, so whoever picks up this seed does not re-derive them

- **(a) Accept.** The doors converge by design — the chooser already says *"Both end up in the same
  place. You can switch between them at any time."* If a cold reader is not confused, there is
  nothing to fix and this seed closes on U1/U2 evidence.
- **(b) Differentiate the copy.** Door B gets its own ids (`describe.ctaGovern`, `hint.*Govern`),
  regenerated through `build.cjs` — **never re-typed onto the page**, which the D-24(a) copy fence
  now enforces on `WorkflowBuilderPage.tsx` (193 review WR-01).
- **(c) Differentiate the SCREEN, not just the words.** Door B could open directly into the editor
  with an empty draft, making the two doors genuinely different journeys. Largest change; the only
  one that makes the card's promise literally true at step 1.

## How to settle it cheaply

Drive **U1** in `193-UAT.md` with someone who has not used the Builder. Ask, before any click:
*"what happens if you pick the left one? the right one?"* — then let them click the one they chose
and watch whether the screen matches what they said. That single row produces the evidence for
SC#1, SC#2 and this seed at once.

Related: `SEED-147` (the operator could not name the door they were not standing in — the
observation this whole phase descends from), `SEED-155` (a sketch drew an atom the card could not
render), `193-REVIEW.md` WR-04.
