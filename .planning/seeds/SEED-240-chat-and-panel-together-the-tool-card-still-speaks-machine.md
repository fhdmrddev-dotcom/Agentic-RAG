---
seed_id: SEED-240
title: "With chat AND the workspace panel open, the chat column is 700px of four — and what it renders there is a raw `WRITE_TODOS`, a status sentence wearing a checkbox, and a tool card orphaned outside the run frame it belongs to"
created: 2026-09-02
planted_during: Operator-directed layout observation, 2026-09-02 — *"observe the layout, how the chat tools are not fitting exactly if we open the chat and the workspace altogether"*
status: planted
surface: Agentic-RAG
severity: medium
category: chat-surface / panel / step-identity / layout
priority: medium
relates_to:
  - SEED-128 (Claude.ai-style collapsible run/reasoning timeline) — the operator's OTHER standing observation, still `dormant` since 2026-07-22, and the natural companion to this one
  - BUG-260902-01 (a todo abandoned mid-run stays `in_progress` forever) — found in the SAME screenshot; that one is a data defect, this one is presentation
  - Phase 209 ("A step says what it actually does") and Phase 214 (`StepIdentity`) — the vocabulary this card predates and never adopted
  - SEED-098 (chat tool-card deduplication / unified essence line)
  - SEED-045 (UI/UX polish pass)
trigger_when:
  - Any milestone touching the chat surface, the workspace panel, or step identity
  - `/gsd:sketch` is run for a chat-polish phase — this is design input, and G-2 applies
  - Anyone widens `WorkspacePanel` or changes the four-column layout
  - The next phase that renders a tool card in chat
---

# SEED-240 — the two surfaces are correct apart and cramped together

**Measured at `e4cdec972`, viewport 1536 × 639, thread "generate weekly report", panel open.**

## The geometry

Four columns share the width, and two of them are chrome:

| column | width |
|---|---|
| nav rail | ~215 px |
| chat list | ~305 px |
| **chat** | **~700 px** |
| workspace panel | **308 px** |

⚠ **No horizontal overflow** — `scrollWidth === innerWidth`, so nothing is technically broken.
**The complaint is not overflow, it is proportion**: the surface that carries the conversation
gets 45% of a 1536px screen, and 1536 is a *common laptop width*, not a narrow one.

⚠ **The panel's 308 px is where it shows.** A todo label is allotted **186 px** before the
status badge, so *"Search knowledge base for report data"* wraps to two lines **and the badge
aligns to the first line only** — it sits beside `…knowledge base for` while `report data`
hangs beneath it. The wrap point is chosen by the badge, not by the phrase.

## What the chat column renders in that space

From the same screenshot, top to bottom:

1. `Run · 3 steps` · `google/gemma-4-26b-a4b` · `7m 23s` — a run frame, correct.
2. A collapsed row reading **`timed out`**. ⚠ **The card promises 3 steps and enumerates none.**
3. *"Agent reached time limit"* — prefixed by an **empty checkbox glyph `☐`**. ⚠ A statement
   about why the run died is wearing the costume of an unfinished task.
4. A separate card titled **`WRITE_TODOS`** — the raw machine identifier, uppercase with an
   underscore — with body **`☑ 1 todos`**.

### Three separate faults in item 4 alone

- ⚠ **`WRITE_TODOS` is the function name, not a sentence.** Phase 209 is literally titled *"A
  step says what it actually does"* and Phase 214 shipped `StepIdentity` for exactly this. **This
  card adopted neither.** It is the last place in the product still speaking machine at a person.
- **`1 todos`** is ungrammatical, and — worse — it does not say *which* todo. The panel three
  hundred pixels to the right knows the answer.
- ⚠ **The card sits OUTSIDE the run frame**, below *"Agent reached time limit"*, as a sibling of
  the run rather than one of its three steps. **The run says 3 steps; one of them is rendered as
  an orphan underneath it.** That is the composition fault, and it is why the column reads as
  cluttered rather than merely narrow.

## What this is NOT

- Not overflow, not a broken layout, not a responsive bug. Everything fits.
- Not `BUG-260902-01`. That one is a wrong *value* in the database; this is wrong *presentation*
  of correct values. **They were found in one screenshot and must not be folded into one fix.**

## For whoever picks this up

⚠ **G-2 FIRES** — this is live UI, and CLAUDE.md requires `/gsd:sketch` before planning. Do not
let a "quick tidy" skip it: the honest fix is a **composition** decision (does a tool card live
inside the run frame? does the panel keep a fixed 308 px when the viewport is 1536?), and
composition is precisely what a sketch decides and a patch cannot.

⭐ **Pair it with `SEED-128`.** The operator raised the reasoning/thinking timeline on
2026-07-22 and it is still `dormant`; they raised this on 2026-09-02. **They are the same
complaint at two altitudes** — *what the agent's own activity looks like while and after it
works* — and sketching them separately will produce two vocabularies for one surface.
