---
seed_id: SEED-191
title: The run surface's centre column repeats the right panel and carries no visual hierarchy — the answer is unreadable at 208 chars/line, the produced file is buried, and the whole main area is one grey
created: 2026-08-21
planted_during: Phase 200.1 execution (operator, watching real runs in the browser between wave 1 and wave 2)
status: planted
surface: Agentic-RAG
relates_to:
  - Phase 200 — moved the canvas off `WorkflowRunPage` and made `RunTranscript` the centre.
    This seed is the finding that the centre column did not become *content*, only a second list.
  - Phase 200.1 — shipped `deliverable_text` (the answer on the wire) and the live-row treatment.
    It supplies the DATA this redesign needs; it deliberately did not redesign the column.
  - SEED-185 — no URL router, so every arm of this surface is reached by a click path.
  - SEED-155 — a sketch that hand-writes its own CSS is a drawing, not an acceptance bar.
    This one must RENDER the shipped components.
  - `docs/HOT-FILE-LEDGER.md` → `frontend/src/pages/WorkflowRunPage.tsx`,
    `frontend/src/components/workflows/RunTranscript.tsx`,
    `frontend/src/components/workflows/RunSpine.tsx`
trigger_when: >
  The next phase that touches `WorkflowRunPage.tsx`'s centre column, OR any phase scoped to the
  run surface's readability / hierarchy. Run `/gsd:sketch` FIRST — G-2 fires (live UI, visual,
  "feels like"). The Stitch language pass is already done and is named below, so the sketch does
  not start from nothing.
---

## What the operator saw

Watching real runs during Phase 200.1, with both the app and the data open:

> "we are just duplicating content and we are not making it as bad a design … I don't know what is
> the logic behind that … the row markdown space is a little bit narrow … we have to highlight
> somehow the output files of the workflow because it's a little bit put it inside a lot of text …
> text are all in the same colour, there's no colour coding for the step-run main area"

Every part of that was measured and every part held.

## The measurements — all taken 2026-08-21 on the merged tree

### 1. The two columns are the same list

Centre column (`RunTranscript`) and right panel (`RunSpine`), one run, read from the DOM:

```
CENTRE                                         RIGHT
00:00  Pull usage and adoption data            ✓ Pull usage and adoption data              26s
00:26  Pull support history                    ✓ Pull support history                      23s
00:50  Pull commercial position and meeting…   ✓ Pull commercial position and meeting…     38s
01:28  Synthesize the QBR narrative            ✓ Synthesize the QBR narrative              31s
01:59  Fill the QBR template                   ✓ Fill the QBR template                     39s
```

The five names are **character-identical**. The clocks are not independent either — the left is the
running sum of the right: `00:00 +26 → 00:26 +23 → 00:49 +38 → 01:28 +31 → 01:59 +39 → 2m38s`
against a stated total of `2m39s`. **Same series, integrated.**

⚠ **`docs/HOT-FILE-LEDGER.md` defends this split in writing** — *"the GRAIN and the CLOCK are what
make it different"*. Arithmetic refutes it. The ledger cell should be corrected when this is taken,
not silently overwritten: the claim was reasonable when written and is now measured false.

⚠ **There is a THIRD copy.** The run's chat thread holds the same steps — and its whole record of a
5-step, 2m39s run is **two messages**, the second being 61 characters:
`"Produced the filled deliverable: /Northwind-QBR-Template.docx"`.

**Cost:** step rows end at `y=362`; the files strip sits at `y=1142`. **~780px of dead centre column**
to say five things already said 400px to the right.

### 2. The answer is unreadable — and it is not "narrow", it is too WIDE

| measured | value | comfortable |
|---|---|---|
| answer body width | **1454px** | — |
| font size | 14px | — |
| **characters per line** | **≈208** | **45–75** |
| vertical band | **280px**, at the very bottom of the page | — |
| `white-space` | `pre-wrap` | — |

Wide-and-thin is the worst shape for prose: the eye loses its place on the return sweep. The operator
read this as "narrow"; the measurement says the *band* is thin and the *measure* is ~3× too long.

⚠ **The answer also renders as RAW MARKDOWN** — literal `**bold**` and `>` blockquote markers,
because the region prints the string. Chat renders markdown; this surface does not.

### 3. The main area has no colour hierarchy, and the hierarchy that exists is backwards

Census of every text node, by computed `color`:

| | centre column (the main area) | right panel |
|---|---|---|
| distinct colours | **4 — but three are the SAME grey** (`rgb(151,161,180)` at 1.0, at 0.6, plus white `rgb(243,245,252)`) | 4 |
| status hue | `rgb(163, 165, 255)` × **1** — the live clock, shipped 2026-08-21 by `200.1-03` | `rgb(33, 196, 93)` green × 3 — the check marks |

**Before `200.1-03` the centre column contained no hue at all.** The smaller, less important column is
the one carrying status colour. ⚠ Note the constraint this must respect: Deep Midnight is deliberately
restrained (*"Accents … used sparingly … to maintain the midnight atmosphere"*), and Phase 185 spent
its colour budget on governance — *"governance spends no colour and no third badge"*. **The answer is
therefore NOT "add colours"; it is weight, size, spacing and position**, with hue reserved for state.

### 4. The produced file is buried by equal weight

`Files in this run's workspace` and its file row sit in the same bottom band as the answer, at the
same small size and the same grey. Nothing marks the file as the thing the person came for.

⚠ **And the heading is now wrong in one arm**: after `200.1-02`, the nothing-arm renders
`Files in this run's workspace` above `This run produced no file and no written answer.` — a heading
about files introducing a sentence about files *and* answers.

## What the column should hold — and the hard limit on it

⚠ **THERE IS NO STORED THINKING PROCESS. Measured, not assumed:**

- **No substep / event / trace table exists.** Per-step activity streams through the Redis buffer
  `run:{run_id}` while a run is going — ephemeral by design. Nothing durably records it.
- **`messages.reasoning_content` is `0` on every message of every workflow run.** The column exists;
  workflow runs never populate it.

So a "thinking process" view of a **finished** run would be fabrication. Live, it is partly real;
after the fact it does not exist. **Showing a real reasoning trace is a BACKEND PERSISTENCE PHASE,
not a design change** — that is the single most important thing this seed records.

What genuinely exists per step, after the fact:

| field | measured example |
|---|---|
| `output.text` | **4,411** chars on a `draft` step; 517 on `finalize` |
| `output._measure` | `{count: 15, noun: "sources"}` |
| `output.citations` | **38** entries, each with `document_id`, `filename`, `chunk_index` and the real `passage` text |
| `output.source_refs` | 38 entries (`document_id`, `filename`) |
| timing | start offset, duration |

**So the honest centre column is: the answer up top, then per step — what it yielded, and the real
passages it drew on, expandable.** 38 citations with actual passage text is far more substance than
five repeated names, and every element traces to a stored field.

## Two refusals this design must carry

1. ⚠ **NO FABRICATED RELEVANCE SCORE.** `similarity_scores` held **7** entries against **38**
   citations on the same row. They do **not** correspond, so no document can be labelled with a
   score. The Stitch pass drew exactly this (`Relevance: 0.94` beside a filename) and it is
   plausible enough to have shipped as a lie.
2. ⚠ **NO INVENTED PER-STEP NARRATION.** `RunTranscript` carries a shipped refusal — every line is
   the step's own name plus at most one state word — asserted by a test with a driven positive
   control. A redesign must not quietly overturn it.

## Prior art — the Stitch language pass is DONE, do not redo it

Project **Aether Journey v2** (`7797685529205337277`), design system **Deep Midnight**
(`assets/6c1f3b044c0f45ab9053649a6c4dcabe`), screen **"Workflow Run — Finished Result"**
(`screens/b08b92ce024a4351b1e64944307557dd`), generated 2026-08-21.

It proposed: **"The answer"** at the top with a provenance chip and *Open full text*, then a
**"Process trace"** of collapsed per-step blocks (name · one-line yield · measure chip), the human
step expanding to show the question, the answer and the approver.

Backable: the answer, the source count, the per-step measure, `Wrote N characters`, the real
passages, the human step's question/answer/approver. **Not backable:** its `Query:` / `Target:` /
`confidence threshold > 0.85` block — that is the thinking trace we do not store — and the
per-document relevance score above.

## The method, per the ratified rule

**Stitch first for language (done), then a sketch that RENDERS the real components** — never collapse
the two. The sketch is the acceptance bar; a sketch that hand-writes its own CSS is a drawing.
