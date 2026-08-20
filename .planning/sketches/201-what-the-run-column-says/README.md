---
sketch: 201
name: what-the-run-column-says
kind: language-sketch
question: "The run surface's centre column duplicates the right panel character-for-character. If it stops being a second list, what is it instead — and what fills its top slot when the run produced nothing?"
winner: "hero+ledger (A/B/D are its three states) — C ruled out"
tags: [run-surface, run-transcript, deliverable, seed-191, stitch-derived, hierarchy, empty-state]
seeds: [SEED-191, SEED-155]
built: 2026-08-21
renders_real_components: false
stitch_reference: "Aether Journey v2 (7797685529205337277) › screen b08b92ce024a4351b1e64944307557dd — 'Workflow Run — Finished Result'"
---

# Sketch 201: What the run column says

Step 2 of the Stitch→sketch loop. The Stitch pass gave the **language**; this applies it to our
**real data** and adds the states Stitch never drew.

⚠ **This is a LANGUAGE sketch, not the acceptance bar.** It does not render the shipped
`RunTranscript` / `WorkflowRunPage`. Per `SEED-155`, a rendered sketch is owed **before** planning —
that is the artifact that can prove a proposal is buildable. Treat these tabs as direction only.

## How to view

```bash
# any static server over the sketch directory
python -m http.server 8912 --directory .planning/sketches/201-what-the-run-column-says
# → http://127.0.0.1:8912/index.html
```

## The problem, measured (full derivation in SEED-191)

- The centre column and the right panel carry **character-identical** step names, and the left clock
  is the **running sum** of the panel's durations. Same series, integrated.
- **~780px** of the column is empty; the only sentence about output mentions files alone.
- The main area uses **white plus one grey at two opacities**. The *smaller* right panel is the one
  carrying status colour. The hierarchy is backwards.

## Variants

- **Today** — the problem drawn honestly, so every comparison is against the real thing.
- **A — Answer card leads** — the answer is a bordered hero card with an icon meta row, a `38 sources`
  chip and a filled *Open full text*. Steps below become cards with a plain-English **yield**.
- **B — Deliverable hero** — the produced **file** is the hero (amber icon, own Download); steps drop
  to a dimmed ledger.
- **C — One spine of cards** — no separate answer region at all; the answer is the last step card,
  already open. The run's totals move up into chips beside the title.
- **D — the "neither" arm** — `d1` what ships today (a bare sentence, which in a page of cards reads
  as a loading failure) vs `d2` the same fact given a shape.

## ⚠ The operator's question that reshaped the decision

> *"In one design you are saying file is the hero and the other one the answer is the hero. But this
> depends on the deliverable type of each workflow. So if I selected for example B, what will happen
> if the workflow does not produce the file?"*

**A and B are not rival designs — they are ONE hero slot filled by whatever the run made.** Picking B
and running a text-only workflow yields A, automatically. This is not a fallback: the four arms
already **ship** (`200.1-02`), and three of them were driven live on 2026-08-21. The sketch decides
how they LOOK, not whether they exist.

So the real choice is two, not three:

| Option | What it is | Strength |
|---|---|---|
| **Hero + ledger** (A / B / D are its three states) | a top card holds the deliverable, steps become a ledger | gives the thing you came for the most weight |
| **C — one spine** | no hero slot; the deliverable is the last step, open | kills the duplication hardest; no slot that can sit empty |

**D is the tie-breaker.** If the "neither" arm looks wrong under a hero slot, C is the safer shape —
it has no slot to leave empty.

## ✅ DECIDED 2026-08-21 — the adaptive hero, by the operator

> *"I don't want to select either A or B — I want the render to be based on the workflow type and the
> workflow scenario, which I assume is D."*

**The instinct is right; only the label was off. D is not a fourth design — it is the EMPTY STATE of
A and B.** All three are one family: **a hero slot the RUN fills according to what it produced.** The
operator never picks A or B; the deliverable type does, per run.

| the run produced | the hero renders |
|---|---|
| a file | file card + Download — looks like **B** |
| only a written answer | the answer card — looks like **A** |
| both | the file first, the answer beneath it |
| neither | the dashed placeholder + the work it still did — **D** |

**⛔ C IS RULED OUT.** It killed the duplication hardest, but it has **no hero slot**, so there is
nothing for the deliverable type to change. It cannot do the thing that was actually asked for.

⚠ **This is the shape the code is ALREADY built for.** `200.1-02` shipped exactly these four arms and
three of them were driven live on 2026-08-21. This decision is about how they LOOK — it is not a
rewrite, and any plan that treats it as one has misread the scope.

⚠ **Still open, and it is the duplication half:** the hero fixes *what the column leads with*. It does
NOT by itself stop the step rows repeating the right panel's names. The step **yields**
(`Read 38 sources`, `Wrote 517 characters`) are the proposed answer — new content beside a repeated
name — but whether that earns the repetition is exactly what the RENDERED sketch must settle.

## Binding refusals — carried from SEED-191, and honoured here

1. **No stored thinking process.** No substep/event table exists; `reasoning_content` is `0` on every
   workflow-run message; the live substep stream is an ephemeral Redis buffer. The Stitch reference's
   `Query:` / `Target:` / `confidence threshold > 0.85` block is therefore **NOT** reproduced. A real
   reasoning view is a **backend persistence phase**, not a design change.
2. **No fabricated relevance score.** `similarity_scores` held **7** entries against **38** citations
   on the same row — they do not correspond. The reference drew `Relevance: 0.94` beside a filename;
   these source cards carry the **real passage text** instead, which we do have.
3. **No invented per-step narration.** `RunTranscript` ships a refusal — every line is the step's own
   name plus at most one state word, asserted with a driven positive control.
4. **Colour is spent on state, never decoration.** Deep Midnight uses accent sparingly and Phase 185
   already spent the budget (*"governance spends no colour and no third badge"*). Prominence here
   comes from **weight, size, spacing and the card** — hue only marks state (green complete, amber
   human gate / file, violet primary action).

## What to look for

- Does the hero slot still feel right in **D**, or does an empty slot undo it?
- With step **yields** present (`Read 38 sources`, `Wrote 517 characters`), does repeating the step
  NAMES beside the panel still read as duplication — or is the yield enough new content to earn it?
- The source-card strip carries real passages. Is that the substance the column was missing?

## Data provenance — everything shown is real

`517`-character answer and `38 sources` from run `13691156…`; QBR `15 / 20 / 20 / — / 2 fields` from
run `bef870ba…`; `weekly_report_structure.md` passage from that run's `citations`. The `—` on
*Synthesize* is the honest absent arm, not a placeholder.

## Owed next

A **rendered** sketch that mounts the shipped components (SEED-155), then `/gsd:phase` to insert the
work. Do **not** go straight from here to code.
